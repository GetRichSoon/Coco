@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.goodspace.cocolounge

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeDown
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// ---------- the five tabs of the Lounge Standard v2 ----------
enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Rounded.Home), Teams("Teams", Icons.Rounded.Groups), Chat("Chat", Icons.Rounded.Forum),
    Remote("Remote", Icons.Rounded.SettingsRemote), More("More", Icons.Rounded.Menu)
}
enum class MorePage(val label: String, val icon: ImageVector) {
    Approvals("Approvals", Icons.Rounded.Verified), Board("Board", Icons.Rounded.ViewKanban), Rules("Rules", Icons.Rounded.Gavel),
    Devices("Devices", Icons.Rounded.Devices), Settings("Settings", Icons.Rounded.Settings)
}

val LocalCalm = staticCompositionLocalOf { false }

private fun parse(iso: String?): Instant? = if (iso.isNullOrBlank() || iso == "null") null else runCatching {
    java.time.OffsetDateTime.parse(iso.replace(" ", "T").let { if (Regex("[+-]\\d\\d$").containsMatchIn(it)) "$it:00" else it }).toInstant()
}.getOrNull() ?: runCatching { Instant.parse(iso) }.getOrNull()
fun ago(iso: String?): String {
    val t = parse(iso) ?: return "never"
    val s = Duration.between(t, Instant.now()).seconds
    return when { s < -60 -> inTime(iso); s < 90 -> "just now"; s < 3600 -> "${s / 60} min ago"; s < 86400 -> "${s / 3600} h ago"; else -> "${s / 86400} d ago" }
}
fun inTime(iso: String?): String {
    val t = parse(iso) ?: return ""
    val s = Duration.between(Instant.now(), t).seconds
    val zone = ZoneId.systemDefault()
    val clock = DateTimeFormatter.ofPattern("h:mm a").withZone(zone).format(t)
    val sameDay = t.atZone(zone).toLocalDate() == java.time.LocalDate.now(zone)
    val tomorrow = t.atZone(zone).toLocalDate() == java.time.LocalDate.now(zone).plusDays(1)
    return when { s < 0 -> "was due ${ago(iso)}"; s < 3600 -> "in ${s / 60} min"; sameDay -> "today $clock"; tomorrow -> "tomorrow $clock"
        else -> DateTimeFormatter.ofPattern("EEE d MMM, h:mm a").withZone(zone).format(t) }
}
fun online(d: JSONObject) = parse(d.optString("last_seen"))?.let { Duration.between(it, Instant.now()).seconds < 150 } ?: false
private fun JSONObject.s(k: String) = optString(k).let { if (it == "null") "" else it }

// ---------- small pieces ----------
@Composable
fun StatusChip(state: String, text: String? = null) {
    val lux = LocalLux.current
    val (bg, fg, label) = when (state) {
        "running", "working", "done", "approved", "live", "connected" -> Triple(lux.goodC, lux.good, text ?: state.replaceFirstChar { it.uppercase() })
        "waiting", "needs_yes", "waiting_yes", "waiting_pc", "next", "planned", "queued", "late" -> Triple(lux.warnC, lux.warn, text ?: mapOf("waiting" to "Needs YES", "needs_yes" to "Needs YES", "waiting_yes" to "Needs YES", "waiting_pc" to "Waits for a PC", "next" to "Next", "planned" to "Planned", "queued" to "Queued", "late" to "Late")[state].orEmpty())
        "failed", "rejected", "off" -> Triple(lux.badC, lux.bad, text ?: mapOf("failed" to "Failed", "rejected" to "No", "off" to "Not connected")[state].orEmpty())
        else -> Triple(MaterialTheme.colorScheme.surfaceContainerHighest, MaterialTheme.colorScheme.onSurface, text ?: state.replaceFirstChar { it.uppercase() })
    }
    Surface(color = bg, contentColor = fg, shape = RoundedCornerShape(50)) { Text(label, Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 1) }
}

@Composable
fun Appear(index: Int, content: @Composable () -> Unit) {
    if (LocalCalm.current) { content(); return }
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val p by animateFloatAsState(if (shown) 1f else 0f, tween(420, delayMillis = index.coerceAtMost(8) * 45, easing = FastOutSlowInEasing), label = "appear")
    Box(Modifier.graphicsLayer { alpha = p; translationY = (1f - p) * 36f }) { content() }
}

@Composable
fun Card(modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.surfaceContainerLow, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = color) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content) }
}

@Composable fun Muted(text: String, maxLines: Int = Int.MAX_VALUE) = Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
@Composable fun Eyebrow(text: String, color: Color = MaterialTheme.colorScheme.primary) = Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = color)
@Composable fun Section(text: String) = Text(text, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(top = 10.dp))

// ---------- gates ----------
@Composable
fun GateCard(title: String, eyebrow: String, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).systemBarsPadding().imePadding().padding(20.dp), contentAlignment = Alignment.Center) {
        Appear(0) {
            Surface(shape = RoundedCornerShape(32.dp), color = MaterialTheme.colorScheme.surfaceContainerLow, modifier = Modifier.widthIn(max = 440.dp)) {
                Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        LivingMark(Marks.coco, 64.dp)
                        Column { Eyebrow(eyebrow); Text(title, style = MaterialTheme.typography.headlineMedium) }
                    }
                    content()
                }
            }
        }
    }
}

@Composable
fun SignIn(vm: Lounge) {
    var mail by remember { mutableStateOf(vm.cloud.email.orEmpty()) }
    var pass by remember { mutableStateOf("") }
    GateCard("Coco Lounge", "Good Space") {
        Muted("Private to the founders of Good Space, on their four devices only.")
        OutlinedTextField(mail, { mail = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(pass, { pass = it }, label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        Button({ vm.signIn(mail, pass) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Sign in") }
        TextButton({ vm.signUp(mail, pass) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text("First time on Good Space? Create your password") }
    }
}

@Composable
fun Pair(vm: Lounge) {
    var code by remember { mutableStateOf("") }
    GateCard("Pair this phone", "One of four") {
        Muted("Good Space opens only on your PC and your phone. Type the 8-letter pairing code for this phone.")
        OutlinedTextField(code, { code = it.uppercase().take(12) }, label = { Text("Pairing code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button({ vm.pair(code) }, enabled = !vm.busy && code.length >= 6, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Pair phone") }
        TextButton({ vm.signOut() }, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
    }
}

// ---------- the Lounge ----------
@Composable
fun LoungeApp(vm: Lounge) {
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    var more by rememberSaveable { mutableStateOf<MorePage?>(null) }
    var house by rememberSaveable { mutableStateOf("gigi") }
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(vm.message) { vm.message?.let { snack.showSnackbar(it); vm.message = null } }
    val waiting = vm.data.approvals.count { it.s("state") == "waiting" }
    val go: (Tab, MorePage?, String?) -> Unit = { t, m, h -> tab = t; more = m; h?.let { house = it } }

    Scaffold(
        snackbarHost = { SnackbarHost(snack) },
        topBar = {
            TopAppBar(
                navigationIcon = { if (tab == Tab.More && more != null) IconButton({ more = null }) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back") } },
                title = {
                    Column {
                        Text("Good Space · ${vm.callMe}".uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        Text(if (tab == Tab.More && more != null) more!!.label else tab.label, style = MaterialTheme.typography.headlineMedium)
                    }
                },
                actions = {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 12.dp)) {
                        Box(Modifier.size(9.dp).background(if (vm.live) Color(0xFF2E9E57) else MaterialTheme.colorScheme.outline, CircleShape))
                        Spacer(Modifier.width(6.dp)); Muted(if (vm.data.paused) "paused" else if (vm.live) "live" else "reconnecting")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(selected = tab == t, onClick = { tab = t; if (t == Tab.More) more = null }, label = { Text(t.label, style = MaterialTheme.typography.labelSmall, maxLines = 1, softWrap = false) },
                        icon = { BadgedBox(badge = { if (t == Tab.More && waiting > 0) Badge { Text("$waiting") } }) { Icon(t.icon, t.label) } })
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        AnimatedContent(tab to more, Modifier.padding(pad), transitionSpec = {
            (fadeIn(tween(220, delayMillis = 90)) + scaleIn(tween(220, delayMillis = 90), initialScale = 0.96f)) togetherWith fadeOut(tween(90))
        }, label = "screens") { (t, m) ->
            if (t == Tab.Chat) ChatScreen(vm)
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (t) {
                    Tab.Home -> home(vm, go)
                    Tab.Teams -> teams(vm, house) { house = it }
                    Tab.Remote -> remote(vm)
                    Tab.More -> when (m) {
                        null -> moreMenu(vm) { more = it }
                        MorePage.Approvals -> approvals(vm)
                        MorePage.Board -> board(vm)
                        MorePage.Rules -> rules(vm)
                        MorePage.Devices -> devices(vm)
                        MorePage.Settings -> settings(vm)
                    }
                    Tab.Chat -> {}
                }
            }
        }
    }
    Dialogs(vm)
}

// ---------- HOME: the dashboard ----------
fun LazyListScope.home(vm: Lounge, go: (Tab, MorePage?, String?) -> Unit) {
    val d = vm.data
    item(key = "hero") {
        Appear(0) {
            Surface(shape = RoundedCornerShape(32.dp), color = Mu.plum, contentColor = Mu.bubblegum, modifier = Modifier.fillMaxWidth()) {
                Box {
                    LivingMark(Marks.coco.copy(bg = Mu.wine), 150.dp, Modifier.align(Alignment.TopEnd).offset(x = 40.dp, y = (-30).dp))
                    Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Coco", fontFamily = Fun, fontSize = 22.sp, color = Mu.bubblegum)
                        Text("Hello ${vm.callMe}", style = MaterialTheme.typography.displaySmall, color = Mu.cream)
                        val w = d.approvals.count { it.s("state") == "waiting" }
                        Text(if (d.paused) "Coco is paused. Nothing new starts until you resume." else if (w > 0) "$w things need your YES." else "Everything is moving. Nothing needs you.", style = MaterialTheme.typography.bodyLarge, color = Mu.cream)
                    }
                }
            }
        }
    }
    // Quick command to your own PC (online one first), right on Home
    val myPc = d.devices.filter { it.s("kind") == "pc" && it.s("id") != vm.cloud.deviceId && it.optBoolean("active", true) }
        .sortedWith(compareBy({ !online(it) }, { !it.s("id").startsWith(vm.cloud.deviceId?.substringBefore('-') ?: "~") }))
        .firstOrNull()
    if (myPc != null) item(key = "quick") { Appear(1) { CommandBar(vm, myPc, "Tell ${myPc.s("name")}") } }
    item(key = "tiles") {
        Appear(1) {
            val waiting by animateIntAsState(d.approvals.count { it.s("state") == "waiting" }, tween(600), label = "w")
            val running by animateIntAsState(d.tasks.count { it.s("status") == "running" }, tween(600), label = "r")
            val chan = d.offerings.filter { it.s("kind") == "channel" }
            val conn by animateIntAsState(chan.count { it.optBoolean("connected") }, tween(600), label = "c")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Tile("$waiting", "need YES", Mu.tomato, Mu.cream, Modifier.weight(1f)) { go(Tab.More, MorePage.Approvals, null) }
                Tile("$running", "running", Mu.cobalt, Mu.sky, Modifier.weight(1f)) { go(Tab.More, MorePage.Board, null) }
                Tile("$conn/${chan.size}", "channels on", Mu.forest, Mu.butter, Modifier.weight(1f)) { go(Tab.Teams, null, "gigi") }
            }
        }
    }
    val upcoming = d.events.filter { it.s("status") in setOf("planned", "waiting_yes", "late") }.sortedBy { parse(it.s("due_at")) ?: Instant.MAX }
    item(key = "nexth") { Section("Next up") }
    if (upcoming.isEmpty()) item(key = "nexte") { Muted("Nothing planned yet.") }
    items(upcoming.take(5), key = { "ev-" + it.s("id") }) { e -> Box(Modifier.animateItem()) { EventRow(vm, e) } }
    item(key = "housesh") { Section("Houses") }
    item(key = "houses") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
            d.houses.forEach { h ->
                val id = h.s("id"); val mark = Marks.houses[id] ?: Marks.coco
                val mine = d.offerings.filter { it.s("house_id") == id }
                Surface(Modifier.weight(1f).clickable { go(Tab.Teams, null, id) }, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { LivingMark(mark, 52.dp); Spacer(Modifier.width(8.dp)); Column { Text(h.s("name"), style = MaterialTheme.typography.titleLarge); Muted(h.s("role"), 1) } }
                        StatusChip(h.s("state"), when (h.s("state")) { "working" -> "Working"; "next" -> "Next"; "later" -> "Later"; else -> null })
                        Muted("${mine.size} ${if (id == "gigi") "channels" else "products"} · ${mine.count { it.optBoolean("connected") }} connected", 1)
                    }
                }
            }
        }
    }
    item(key = "clubh") { Section("Bonbon Club") }
    item(key = "club") {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            d.members.forEach { m ->
                val mark = Marks.members[m.s("id")] ?: return@forEach
                Surface(Modifier.width(150.dp), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LivingMark(mark, 56.dp); Text(m.s("name"), style = MaterialTheme.typography.titleMedium)
                        Muted(m.s("doing").ifBlank { m.s("job") }, 3)
                    }
                }
            }
        }
    }
    item(key = "pause") {
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("Coco is ${if (vm.data.paused) "paused" else "working"}", style = MaterialTheme.typography.titleMedium); Muted("Emergency switch for every device and the cloud") }
                Switch(!vm.data.paused, { vm.setPaused(!it) })
            }
        }
    }
}

@Composable
fun Tile(value: String, label: String, bg: Color, fg: Color, modifier: Modifier, onClick: () -> Unit) {
    Surface(modifier.clickable(onClick = onClick), shape = RoundedCornerShape(24.dp), color = bg, contentColor = fg) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 14.dp)) { Text(value, style = MaterialTheme.typography.headlineMedium, color = fg); Text(label, style = MaterialTheme.typography.labelLarge, color = fg) }
    }
}

@Composable
fun EventRow(vm: Lounge, e: JSONObject) {
    val ctx = LocalContext.current
    val off = vm.data.offerings.firstOrNull { it.s("id") == e.s("offering_id") }
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (off != null) PlatformMark(off.s("platform_id"), 30.dp) else LivingMark(Marks.houses[e.s("house_id")] ?: Marks.coco, 34.dp)
            Column(Modifier.weight(1f)) {
                Text(e.s("title"), style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Muted(listOfNotNull(off?.s("name"), Marks.houses[e.s("house_id")]?.name, e.s("due_at").takeIf { it.isNotBlank() }?.let { inTime(it) }).joinToString(" · "), 1)
            }
            StatusChip(e.s("status"))
        }
        e.s("url").takeIf { it.isNotBlank() }?.let { u -> TextButton({ ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) }) { Text("Open") } }
    }
}

// ---------- TEAMS: each House, its channels or products, connected, last and next post ----------
fun LazyListScope.teams(vm: Lounge, house: String, pick: (String) -> Unit) {
    item(key = "picker") {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            vm.data.houses.forEach { h ->
                val id = h.s("id")
                FilterChip(house == id, { pick(id) }, { Text(h.s("name")) }, leadingIcon = { LivingMark(Marks.houses[id] ?: Marks.coco, 24.dp) })
            }
        }
    }
    val h = vm.data.houses.firstOrNull { it.s("id") == house } ?: return
    val mark = Marks.houses[house] ?: Marks.coco
    item(key = "head-$house") {
        Appear(0) {
            Surface(shape = RoundedCornerShape(28.dp), color = mark.bg, contentColor = mark.fg, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LivingMark(mark.copy(bg = mark.fg.copy(alpha = 0.25f), fg = mark.fg), 72.dp)
                    Column(Modifier.weight(1f)) {
                        Text(h.s("name"), style = MaterialTheme.typography.headlineMedium, color = mark.fg); Text(h.s("role"), style = MaterialTheme.typography.labelLarge, color = mark.fg)
                        Text(h.s("doing"), style = MaterialTheme.typography.bodyMedium, color = mark.fg, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
    val pipes = vm.data.pipelines.filter { it.s("house_id") == house }
    if (pipes.isNotEmpty()) item(key = "pipes-$house") {
        Card {
            Eyebrow("How the work flows")
            pipes.forEach { p ->
                Text("${p.s("name")}${if (!p.optBoolean("active", true)) " (off)" else ""}", style = MaterialTheme.typography.titleMedium)
                val steps = runCatching { org.json.JSONArray(p.s("steps")) }.getOrNull()
                if (steps != null) Muted((0 until steps.length()).joinToString(" → ") { i -> steps.optJSONObject(i)?.let { st -> (Marks.members[st.s("member")]?.name ?: st.s("who").ifBlank { "Coco" }) + if (st.s("gate").contains("YES")) " (YES)" else "" } ?: steps.optString(i) })
            }
        }
    }
    vm.data.categories.filter { it.s("house_id") == house }.forEach { c ->
        val list = vm.data.offerings.filter { it.s("category_id") == c.s("id") }
        if (list.isEmpty()) return@forEach
        item(key = "cat-${c.s("id")}") { Eyebrow("%02d · %s".format(c.optInt("code"), c.s("name")), MaterialTheme.colorScheme.onSurfaceVariant) }
        items(list, key = { "off-" + it.s("id") }) { o -> Box(Modifier.animateItem()) { OfferingCard(o) } }
    }
    val loose = vm.data.offerings.filter { it.s("house_id") == house && vm.data.categories.none { c -> c.s("id") == it.s("category_id") } }
    if (loose.isNotEmpty()) {
        item(key = "loose-h") { Eyebrow("Other", MaterialTheme.colorScheme.onSurfaceVariant) }
        items(loose, key = { "offl-" + it.s("id") }) { o -> Box(Modifier.animateItem()) { OfferingCard(o) } }
    }
}

@Composable
fun OfferingCard(o: JSONObject) {
    val ctx = LocalContext.current
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PlatformMark(o.s("platform_id"), 34.dp)
            Column(Modifier.weight(1f)) { Text(o.s("name"), style = MaterialTheme.typography.titleMedium); Muted(o.s("status"), 1) }
            if (o.optBoolean("connected")) StatusChip("connected", "Connected") else if (o.s("kind") == "channel") StatusChip("off")
        }
        o.s("last_post_title").takeIf { it.isNotBlank() }?.let { Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { Muted("Last: $it · ${ago(o.s("last_post_at"))}", 1) }
            o.s("last_post_url").takeIf { u -> u.isNotBlank() }?.let { u -> TextButton({ ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) }) { Text("Watch") } }
        } }
        o.s("next_post_title").takeIf { it.isNotBlank() }?.let { Text("Next: $it · ${inTime(o.s("next_post_at"))}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }
    }
}

// ---------- CHAT with Coco ----------
@Composable
fun ChatScreen(vm: Lounge) {
    val list = rememberLazyListState()
    val msgs = vm.data.chat
    LaunchedEffect(msgs.size) { if (msgs.isNotEmpty()) list.animateScrollToItem(msgs.size) }
    var text by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().imePadding()) {
        LazyColumn(Modifier.weight(1f), state = list, contentPadding = PaddingValues(16.dp, 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item(key = "intro") { Muted("Tell Coco anything: a task, a question, a rule. Coco answers from the cloud, then acts or asks for your YES.") }
            items(msgs, key = { "m-" + it.s("id") }) { m ->
                val mine = m.s("role") == "founder"
                Row(Modifier.fillMaxWidth().animateItem(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom) {
                    if (!mine) { LivingMark(Marks.coco, 34.dp); Spacer(Modifier.width(8.dp)) }
                    Surface(shape = RoundedCornerShape(22.dp, 22.dp, if (mine) 6.dp else 22.dp, if (mine) 22.dp else 6.dp),
                        color = if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHigh,
                        contentColor = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface, modifier = Modifier.widthIn(max = 300.dp)) {
                        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                            if (!mine || m.s("author") != vm.name) Text(m.s("author"), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                            Text(m.s("body"), style = MaterialTheme.typography.bodyLarge)
                            Text(when (m.s("status")) { "new" -> "sent · Coco will answer"; "thinking" -> "Coco is working on it"; else -> ago(m.s("created_at")) }, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(text, { text = it }, placeholder = { Text("Message Coco…") }, modifier = Modifier.weight(1f), maxLines = 4, shape = RoundedCornerShape(24.dp))
                Spacer(Modifier.width(8.dp))
                FilledIconButton({ if (text.isNotBlank()) { vm.sendChat(text.trim()); text = "" } }, enabled = text.isNotBlank(), modifier = Modifier.size(52.dp)) { Icon(Icons.AutoMirrored.Rounded.Send, "Send") }
            }
        }
    }
}

// ---------- REMOTE: control a PC from the phone, or the other phone ----------
private val pcApps = listOf("chrome" to "Chrome", "brave" to "Brave", "vscode" to "VS Code", "cursor" to "Cursor", "spotify" to "Spotify", "whatsapp" to "WhatsApp", "files" to "Files", "notepad" to "Notepad", "calculator" to "Calculator", "settings" to "Settings")
private val phoneApps = listOf("youtube" to "YouTube", "ytmusic" to "YT Music", "whatsapp" to "WhatsApp", "instagram" to "Instagram", "chrome" to "Chrome", "maps" to "Maps", "spotify" to "Spotify", "gmail" to "Gmail", "camera" to "Camera", "settings" to "Settings")

fun LazyListScope.remote(vm: Lounge) {
    val targets = vm.data.devices.filter { it.s("id") != vm.cloud.deviceId && it.optBoolean("active", true) }.sortedBy { if (it.s("kind") == "pc") 0 else 1 }
    item(key = "rnote") { Muted("Pick a device and control it: play YouTube songs, music keys, volume, open apps, lock, restart. The device's Coco Lounge app runs it and reports back here.") }
    item(key = "rpick") {
        var sel by rememberSaveable { mutableStateOf(targets.firstOrNull()?.s("id").orEmpty()) }
        val dev = targets.firstOrNull { it.s("id") == sel } ?: targets.firstOrNull()
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                targets.forEach { d -> FilterChip(dev?.s("id") == d.s("id"), { sel = d.s("id") }, { Text(d.s("name")) },
                    leadingIcon = { Icon(if (d.s("kind") == "pc") Icons.Rounded.Computer else Icons.Rounded.PhoneAndroid, null, Modifier.size(18.dp)) }) }
            }
            if (dev != null) key(dev.s("id")) { RemotePanel(vm, dev) }
        }
    }
    item(key = "rhist") { Section("Recent commands") }
    items(vm.data.commands.take(10), key = { "cmd-" + it.s("id") }) { c ->
        Box(Modifier.animateItem()) {
            Card {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        val what = c.optJSONObject("args")?.let { a -> a.optString("q").ifBlank { a.optString("app").ifBlank { a.optString("key") } } }.orEmpty()
                        Text("${c.s("action").replace('_', ' ')}${if (what.isNotBlank()) " · $what" else ""} → ${vm.deviceName(c.s("target_device"))}", style = MaterialTheme.typography.titleMedium)
                        Muted("${c.s("created_by")} · ${ago(c.s("created_at"))}")
                    }
                    StatusChip(c.s("status"), mapOf("queued" to "Waiting", "running" to "Running", "done" to "Done", "failed" to "Failed")[c.s("status")])
                }
                c.s("result").takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }
        }
    }
}

/** One bar to command a device: type or tap the mic and speak (English or Hinglish). Used on Home and Remote. */
@Composable
fun CommandBar(vm: Lounge, dev: JSONObject, title: String = "Tell ${dev.optString("name")} what to do") {
    val pc = dev.optString("kind") == "pc"
    var say by remember(dev.optString("id")) { mutableStateOf("") }
    val send = { text: String -> if (text.isNotBlank()) { vm.sendCommand(dev.optString("id"), "say", JSONObject().put("text", text.trim())); say = "" } }
    val mic = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { r ->
        r.data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { heard -> say = heard; send(heard) }
    }
    val listen = {
        runCatching {
            mic.launch(Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Tell ${dev.optString("name")}…"))
        }.onFailure { vm.message = "Voice typing is not available on this phone" }
    }
    Surface(shape = RoundedCornerShape(28.dp), color = Mu.plum, contentColor = Mu.cream, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleLarge, color = Mu.cream)
                    Text("Tap the mic and speak, or type. Runs in about a second.", style = MaterialTheme.typography.bodyMedium, color = Mu.bubblegum)
                }
                Spacer(Modifier.width(10.dp))
                FilledIconButton({ listen() }, Modifier.size(64.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = Mu.tomato, contentColor = Mu.cream)) { Icon(Icons.Rounded.Mic, "Speak", Modifier.size(32.dp)) }
            }
            OutlinedTextField(say, { say = it }, placeholder = { Text(if (pc) "play kesariya · open vs code · lock" else "play kesariya · open whatsapp · ring", color = Mu.cream.copy(alpha = 0.7f)) },
                singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { send(say) }),
                colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Mu.cream, unfocusedTextColor = Mu.cream, focusedBorderColor = Mu.bubblegum, unfocusedBorderColor = Mu.cream.copy(alpha = 0.6f), cursorColor = Mu.cream),
                trailingIcon = { IconButton({ send(say) }) { Icon(Icons.AutoMirrored.Rounded.Send, "Do it", tint = Mu.bubblegum) } })
        }
    }
}

@Composable
fun RemotePanel(vm: Lounge, dev: JSONObject) {
    val id = dev.s("id"); val pc = dev.s("kind") == "pc"
    var confirm by remember { mutableStateOf<String?>(null) }
    var song by remember { mutableStateOf("") }
    var link by remember { mutableStateOf("") }
    val send: (String, JSONObject) -> Unit = { a, args -> vm.sendCommand(id, a, args) }
    val play = { if (song.isNotBlank()) { send("play_youtube", JSONObject().put("q", song.trim())); song = "" } }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CommandBar(vm, dev)
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (pc) Icons.Rounded.Computer else Icons.Rounded.PhoneAndroid, null, Modifier.size(30.dp), tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) { Text(dev.s("name"), style = MaterialTheme.typography.titleLarge); Muted(if (online(dev)) "online · Coco Lounge connected" else if (dev.s("key_hash").isBlank()) "not paired yet" else "offline · seen ${ago(dev.s("last_seen"))} · runs when it comes back") }
                StatusChip(if (online(dev)) "live" else "off", if (online(dev)) "Online" else "Offline")
            }
            TextButton({ send("status", JSONObject()) }) { Icon(Icons.Rounded.MonitorHeart, null); Spacer(Modifier.width(6.dp)); Text("Check status") }
        }
        // Music and YouTube
        Surface(shape = RoundedCornerShape(28.dp), color = Mu.tomato, contentColor = Mu.cream, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { PlatformMark("youtube", 28.dp); Spacer(Modifier.width(8.dp)); Text("Play on YouTube", style = MaterialTheme.typography.titleLarge, color = Mu.cream) }
                OutlinedTextField(song, { song = it }, placeholder = { Text("Song, singer or video", color = Mu.cream.copy(alpha = 0.7f)) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go), keyboardActions = KeyboardActions(onGo = { play() }),
                    colors = OutlinedTextFieldDefaults.colors(focusedTextColor = Mu.cream, unfocusedTextColor = Mu.cream, focusedBorderColor = Mu.cream, unfocusedBorderColor = Mu.cream.copy(alpha = 0.6f), cursorColor = Mu.cream),
                    trailingIcon = { IconButton(play) { Icon(Icons.Rounded.PlayArrow, "Play", tint = Mu.cream) } })
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    listOf(Triple("media", "prev", Icons.Rounded.SkipPrevious), Triple("media", "playpause", Icons.Rounded.PlayCircle), Triple("media", "next", Icons.Rounded.SkipNext),
                        Triple("volume", "down", Icons.AutoMirrored.Rounded.VolumeDown), Triple("volume", "up", Icons.AutoMirrored.Rounded.VolumeUp), Triple("volume", "mute", Icons.AutoMirrored.Rounded.VolumeOff)).forEach { (a, k, icon) ->
                        FilledIconButton({ send(a, JSONObject().put("key", k)) }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = Mu.cream, contentColor = Mu.tomatoDeep), modifier = Modifier.size(46.dp)) { Icon(icon, k) }
                    }
                }
            }
        }
        // Open apps
        Card {
            Eyebrow("Open an app")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                (if (pc) pcApps else phoneApps).forEach { (k, label) -> AssistChip({ send("open_app", JSONObject().put("app", k)) }, { Text(label) }) }
            }
            OutlinedTextField(link, { link = it }, label = { Text("Open a link") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                trailingIcon = { IconButton({ if (link.startsWith("https://")) { send("open_url", JSONObject().put("url", link)); link = "" } else vm.message = "Use an https link" }) { Icon(Icons.AutoMirrored.Rounded.OpenInNew, "Open") } })
            if (!pc) Muted("On a phone, Android opens apps at once only while Coco Lounge is on screen; otherwise a notification asks for one tap.")
        }
        // Power or phone tools
        Card {
            Eyebrow(if (pc) "Power" else "Phone")
            val actions = if (pc) listOf(Triple("lock", "Lock", Icons.Rounded.Lock), Triple("sleep", "Sleep", Icons.Rounded.Bedtime), Triple("restart", "Restart", Icons.Rounded.RestartAlt),
                Triple("shutdown", "Switch off", Icons.Rounded.PowerSettingsNew), Triple("cancel_power", "Cancel", Icons.Rounded.Cancel), Triple("notify", "Message", Icons.Rounded.Chat))
            else listOf(Triple("ring", "Ring it", Icons.Rounded.NotificationsActive), Triple("notify", "Message", Icons.Rounded.Chat))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 3) {
                actions.forEach { (a, label, icon) ->
                    FilledTonalButton({ when (a) { "restart", "shutdown" -> confirm = a; "notify" -> send(a, JSONObject().put("text", "Hello from ${vm.callMe.ifBlank { vm.name }}")); else -> send(a, JSONObject()) } },
                        Modifier.weight(1f), shape = RoundedCornerShape(18.dp), contentPadding = PaddingValues(6.dp, 12.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(icon, null); Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
                    }
                }
            }
            if (pc) Muted("Restart and switch off wait 60 seconds so you can cancel. Unlock is not possible from a phone: Windows only unlocks with your PIN or face at the PC.")
        }
    }
    confirm?.let { a -> AlertDialog(onDismissRequest = { confirm = null }, title = { Text(if (a == "restart") "Restart ${dev.s("name")}?" else "Switch off ${dev.s("name")}?") },
        text = { Text("It happens in 60 seconds. Unsaved work on that PC can be lost. You can cancel from here.") },
        confirmButton = { Button({ send(a, JSONObject()); confirm = null }) { Text(if (a == "restart") "Restart" else "Switch off") } },
        dismissButton = { TextButton({ confirm = null }) { Text("Keep it on") } }) }
}

// ---------- MORE ----------
fun LazyListScope.moreMenu(vm: Lounge, open: (MorePage) -> Unit) {
    val waiting = vm.data.approvals.count { it.s("state") == "waiting" }
    items(MorePage.entries, key = { "more-" + it.name }) { p ->
        Surface(Modifier.fillMaxWidth().clickable { open(p) }, shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
            Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(p.icon, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(14.dp))
                Text(p.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (p == MorePage.Approvals && waiting > 0) Badge { Text("$waiting") }
            }
        }
    }
}

fun LazyListScope.approvals(vm: Lounge) {
    item(key = "anote") { Muted("Your YES is recorded with your name and device. Nothing goes public, costs money or gets deleted without it.") }
    val w = vm.data.approvals.filter { it.s("state") == "waiting" }; val r = vm.data.approvals.filter { it.s("state") != "waiting" }
    item(key = "wh") { Section("Waiting (${w.size})") }
    items(w, key = { "aw-" + it.s("id") }) { a -> Box(Modifier.animateItem()) { ApprovalCard(vm, a) } }
    item(key = "rh") { Section("Decided") }
    items(r, key = { "ar-" + it.s("id") }) { a -> Box(Modifier.animateItem()) { ApprovalCard(vm, a) } }
}

@Composable
fun ApprovalCard(vm: Lounge, a: JSONObject) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("${a.s("code")} · ${a.s("team")}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)); StatusChip(a.s("state")) }
        Text(a.s("what"), style = MaterialTheme.typography.bodyMedium)
        Muted(listOfNotNull(a.s("raised_on").takeIf { it.isNotBlank() }, a.s("decided_by").takeIf { it.isNotBlank() }?.let { "decided by $it" }).joinToString(" · "))
        if (a.s("state") == "waiting") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button({ vm.decide(a, true) }) { Text("YES") }; TextButton({ vm.decide(a, false) }) { Text("No") } }
    }
}

fun LazyListScope.board(vm: Lounge) {
    item(key = "form") {
        var title by remember { mutableStateOf("") }; var house by remember { mutableStateOf("gigi") }; var needs by remember { mutableStateOf("any") }
        Card {
            Text("Give Coco a task", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(title, { title = it }, label = { Text("What should be done?") }, modifier = Modifier.fillMaxWidth())
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                vm.data.houses.forEach { h -> FilterChip(house == h.s("id"), { house = h.s("id") }, { Text(h.s("name")) }, leadingIcon = { LivingMark(Marks.houses[h.s("id")] ?: Marks.coco, 22.dp) }) }
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) { listOf("any" to "Anywhere", "cloud" to "Cloud", "pc" to "PC").forEachIndexed { i, (v, l) -> SegmentedButton(needs == v, { needs = v }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(l) } } }
            Button({ if (title.isNotBlank()) { vm.submitTask(title.trim(), null, house, needs); title = "" } }, enabled = title.isNotBlank()) { Text("Send to Coco") }
        }
    }
    val open = vm.data.tasks.filter { it.s("status") !in setOf("done", "stopped", "merged") }
    item(key = "oh") { Section("Open (${open.size})") }
    items(open, key = { "t-" + it.s("id") }) { t -> Box(Modifier.animateItem()) { TaskCard(vm, t) } }
    val done = vm.data.tasks.filter { it.s("status") in setOf("done", "stopped") }.take(15)
    item(key = "dh") { Section("Finished") }
    items(done, key = { "td-" + it.s("id") }) { t -> Box(Modifier.animateItem()) { TaskCard(vm, t) } }
}

@Composable
fun TaskCard(vm: Lounge, t: JSONObject) {
    val id = t.s("id")
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LivingMark(Marks.members[t.s("member_id")] ?: Marks.houses[t.s("house_id")] ?: Marks.coco, 36.dp); Spacer(Modifier.width(10.dp))
            Text(t.s("title"), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)); StatusChip(t.s("status"))
        }
        Muted("${vm.houseName(t.s("house_id"))} · by ${t.s("created_by")} · ${ago(t.s("created_at"))}${t.s("claimed_by_device").takeIf { it.isNotBlank() }?.let { " · working on " + vm.deviceName(it) } ?: ""}")
        vm.data.notes.filter { it.s("task_id") == id }.forEach { Muted("+ ${it.s("note")} (${it.s("by_email")})") }
        t.s("result").takeIf { it.isNotBlank() }?.let { Text("Result: $it", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold) }
        if (t.s("status") in setOf("queued", "running", "waiting_pc", "needs_yes")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledTonalButton({ vm.dialog = Lounge.Dialog.AddPoints(id, t.s("title")) }) { Text("Add points") }; TextButton({ vm.stopTask(id, t.s("title")) }) { Text("Stop") }
        }
    }
}

fun LazyListScope.rules(vm: Lounge) {
    item(key = "ruleform") {
        var title by remember { mutableStateOf("") }; var body by remember { mutableStateOf("") }
        Card {
            Text("Set a rule for all of Good Space", style = MaterialTheme.typography.titleLarge); Muted("Every device, every team and Coco follow it at once.")
            OutlinedTextField(title, { title = it }, label = { Text("Rule in a few words") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(body, { body = it }, label = { Text("Details") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            Button({ vm.addRule(title.trim(), body.trim()); title = ""; body = "" }, enabled = title.isNotBlank() && body.isNotBlank()) { Text("Save rule for everyone") }
        }
    }
    items(vm.data.rules, key = { "rule-" + it.s("id") }) { r -> Box(Modifier.animateItem()) { Card { Text(r.s("title"), style = MaterialTheme.typography.titleLarge); Text(r.s("body").take(700), style = MaterialTheme.typography.bodyMedium) } } }
}

fun LazyListScope.devices(vm: Lounge) {
    item(key = "dn") { Muted("Only these four devices can open Good Space. A device switched off stops at once.") }
    items(vm.data.devices, key = { "d-" + it.s("id") }) { d ->
        val id = d.s("id"); val mine = id == vm.cloud.deviceId
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (d.s("kind") == "pc") Icons.Rounded.Computer else Icons.Rounded.PhoneAndroid, null, tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(10.dp))
                Text(d.s("name"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(if (online(d) || mine) "live" else "off", if (online(d) || mine) "Online" else "Offline")
            }
            Muted("${if (d.s("key_hash").isNotBlank()) "paired ${ago(d.s("paired_at"))}" else "not paired yet"} · seen ${ago(d.s("last_seen"))}")
            if (mine) Text("This device", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            else if (d.optBoolean("active", true)) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { FilledTonalButton({ vm.makePairingCode(id) }) { Text("Make pairing code") }; TextButton({ vm.switchOff(id) }) { Text("Switch off") } }
            else Text("Switched off", color = LocalLux.current.bad, style = MaterialTheme.typography.labelLarge)
        }
    }
}

fun LazyListScope.settings(vm: Lounge) {
    item(key = "s-account") { Card { Eyebrow("Account"); Text("${vm.name} · ${vm.callMe}", style = MaterialTheme.typography.titleLarge); Muted(vm.cloud.email.orEmpty()); OutlinedButton({ vm.signOut() }) { Text("Sign out") } } }
    item(key = "s-notify") { Card {
        Eyebrow("Notifications")
        key(vm.notifyTick) { listOf("approvals" to "Approvals waiting for YES", "done" to "Tasks finished", "merged" to "Coco merged a task", "tasks" to "Tasks from the other founder", "rules" to "New rules").forEach { (k, label) ->
            Row(verticalAlignment = Alignment.CenterVertically) { Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f)); Switch(vm.notifyOn(k), { vm.setNotify(k, it) }) } } }
    } }
    item(key = "s-look") { Card {
        Eyebrow("Appearance")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) { listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEachIndexed { i, (v, l) -> SegmentedButton(vm.theme == v, { vm.chooseTheme(v) }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(l) } } }
        Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Calm motion", style = MaterialTheme.typography.bodyLarge); Muted("Logos and screens keep still") }; Switch(vm.calm, { vm.chooseCalm(it) }) }
        OutlinedButton({ vm.refreshNow() }) { Text("Refresh now") }
    } }
    item(key = "s-about") { Card { Eyebrow("About"); Text("Coco Lounge 2.0 · Android", style = MaterialTheme.typography.titleLarge); Muted("Good Space, managed by Coco. House theme: Material You Design Theme v1. Private: founder login plus this device's key.") } }
}

@Composable
fun Dialogs(vm: Lounge) {
    when (val d = vm.dialog) {
        is Lounge.Dialog.Merged -> AlertDialog(onDismissRequest = { vm.dialog = null }, title = { Text("Already being worked on") },
            text = { Text("Coco found the same work already ${d.status}${d.device?.let { " on " + vm.deviceName(it) } ?: ""}, given by ${d.by}:\n\n${d.title}\n\nYour points were added, so nothing runs twice.") },
            confirmButton = { TextButton({ vm.dialog = null }) { Text("Good") } }, dismissButton = { TextButton({ vm.stopTask(d.taskId, d.title); vm.dialog = null }) { Text("Stop that task") } })
        is Lounge.Dialog.PairCode -> AlertDialog(onDismissRequest = { vm.dialog = null }, title = { Text("Pairing code for ${d.device}") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(d.code, style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary); Muted("Valid for 10 minutes. Works once.") } },
            confirmButton = { TextButton({ vm.dialog = null }) { Text("Done") } })
        is Lounge.Dialog.AddPoints -> {
            var text by remember { mutableStateOf("") }
            AlertDialog(onDismissRequest = { vm.dialog = null }, title = { Text(d.title) }, text = { OutlinedTextField(text, { text = it }, label = { Text("Your points") }, minLines = 3, modifier = Modifier.fillMaxWidth()) },
                confirmButton = { TextButton({ if (text.isNotBlank()) vm.addPoints(d.taskId, text.trim()); vm.dialog = null }) { Text("Add") } }, dismissButton = { TextButton({ vm.dialog = null }) { Text("Cancel") } })
        }
        null -> {}
    }
}
