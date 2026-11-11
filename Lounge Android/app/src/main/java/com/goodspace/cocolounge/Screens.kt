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
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
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
    Devices("Devices", Icons.Rounded.Devices), Island("Island", Icons.Rounded.AutoAwesome), Settings("Settings", Icons.Rounded.Settings)
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

/** One line per account: what the platform granted, until when, how renewal went, the latest health check. Never a credential. */
private fun accountFacts(a: JSONObject): String = listOfNotNull(
    a.s("state").replace('_', ' '),
    a.optJSONArray("scopes")?.length()?.takeIf { it > 0 }?.let { "$it permissions granted" },
    a.s("token_expires_at").takeIf { it.isNotBlank() }?.let { "authorization until ${it.take(10)}" },
    a.s("refresh_state").takeIf { it.isNotBlank() && it != "unknown" }?.let { "renewal ${it.replace('_', ' ')}" },
    a.s("health_status").takeIf { it.isNotBlank() }?.let { "health ${it.lowercase().replace('_', ' ')}" },
    a.s("last_success_at").takeIf { it.isNotBlank() }?.let { "last success ${it.take(10)}" },
).joinToString(" · ")

// ---------- small pieces ----------
@Composable
fun StatusChip(state: String, text: String? = null) {
    val lux = LocalLux.current
    val (bg, fg, label) = when (state) {
        "running", "working", "done", "approved", "live", "connected", "verifying" -> Triple(lux.goodC, lux.good, text ?: state.replaceFirstChar { it.uppercase() })
        "waiting", "needs_yes", "need_approval", "waiting_yes", "waiting_pc", "next", "planned", "queued", "late", "partial" -> Triple(lux.warnC, lux.warn, text ?: mapOf("partial" to "Partly connected", "need_approval" to "Needs YES", "waiting" to "Needs YES", "needs_yes" to "Needs YES", "waiting_yes" to "Needs YES", "waiting_pc" to "Waits for a PC", "next" to "Next", "planned" to "Planned", "queued" to "Queued", "late" to "Late")[state].orEmpty())
        "failed", "rejected", "off", "blocked", "not_connected", "error" -> Triple(lux.badC, lux.bad, text ?: mapOf("blocked" to "Blocked", "not_connected" to "Not connected", "error" to "Error", "failed" to "Failed", "rejected" to "No", "off" to "Not connected")[state].orEmpty())
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
    var code by remember { mutableStateOf("") }
    GateCard("Coco Lounge", "Good Space") {
        Muted("Private to the founders of Good Space, on their four devices only. Ask for the pairing code from Coco on a device that is already open - it works once and lasts ten minutes.")
        OutlinedTextField(code, { code = it.uppercase().take(20) }, label = { Text("Pairing code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        MuButton({ vm.connect(code) }, enabled = !vm.busy && code.length >= 8, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Connect this device") }
    }
}

@Composable
fun Pair(vm: Lounge) {
    var code by remember { mutableStateOf("") }
    GateCard("Pair this phone", "One of four") {
        Muted("Good Space opens only on your PC and your phone. Type the 8-letter pairing code for this phone.")
        OutlinedTextField(code, { code = it.uppercase().take(12) }, label = { Text("Pairing code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        MuButton({ vm.pair(code) }, enabled = !vm.busy && code.length >= 6, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Pair phone") }
        TextButton({ vm.signOut() }, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
    }
}

// ---------- the Lounge ----------
@Composable
fun LoungeApp(vm: Lounge) {
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    var more by rememberSaveable { mutableStateOf<MorePage?>(null) }
    var house by rememberSaveable { mutableStateOf("gigi") }
    var member by rememberSaveable { mutableStateOf<String?>(null) }
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
                        AnimatedContent(if (tab == Tab.More && more != null) more!!.label else tab.label, label = "title", transitionSpec = {
                            (slideInVertically(MuMotion.spatial()) { it / 2 } + fadeIn(MuMotion.effects())) togetherWith (slideOutVertically(MuMotion.spatial()) { -it / 2 } + fadeOut(tween(90)))
                        }) { title -> Text(title, style = MaterialTheme.typography.headlineMedium) }
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
        bottomBar = { FloatingNav(tab, waiting, { t -> tab = t; if (t == Tab.More) more = null }) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        AnimatedContent(tab to more, Modifier.padding(pad).consumeWindowInsets(pad), transitionSpec = {
            // Shared-axis spring: screens to the right slide in from the right, going back slides from the left.
            val dir = (targetState.first.ordinal - initialState.first.ordinal).let { if (it == 0) (if (targetState.second != null) 1 else -1) else Integer.signum(it) }
            (slideInHorizontally(MuMotion.spatial()) { w -> dir * w / 5 } + fadeIn(tween(220, delayMillis = 60))) togetherWith
                (slideOutHorizontally(MuMotion.spatial()) { w -> -dir * w / 5 } + fadeOut(tween(120)))
        }, label = "screens") { (t, m) ->
            if (t == Tab.Chat) ChatScreen(vm)
            else LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (t) {
                    Tab.Home -> home(vm, go) { member = it }
                    Tab.Teams -> teams(vm, house) { house = it }
                    Tab.Remote -> remote(vm)
                    Tab.More -> when (m) {
                        null -> moreMenu(vm) { more = it }
                        MorePage.Approvals -> approvals(vm)
                        MorePage.Board -> board(vm)
                        MorePage.Rules -> rules(vm)
                        MorePage.Devices -> devices(vm)
                        MorePage.Island -> islandPage()
                        MorePage.Settings -> settings(vm)
                    }
                    Tab.Chat -> {}
                }
            }
        }
    }
    member?.let { MemberSheet(vm, it) { member = null } }
    Dialogs(vm)
}

/** Bottom room every screen keeps free for the floating nav (it floats over the content). */
val NavRoom = 96.dp

// ---------- HOME: the dashboard ----------
fun LazyListScope.home(vm: Lounge, go: (Tab, MorePage?, String?) -> Unit, onMember: (String) -> Unit = {}) {
    val d = vm.data
    item(key = "hero") {
        Appear(0) {
            Surface(shape = RoundedCornerShape(32.dp), color = Mu.plum, contentColor = Mu.bubblegum, modifier = Modifier.fillMaxWidth()) {
                Box {
                    DriftBlobs(listOf(Mu.wine, Mu.cherry, Mu.tomato), Modifier.matchParentSize())
                    LivingMark(Marks.coco.copy(bg = Mu.wine), 150.dp, Modifier.align(Alignment.TopEnd).offset(x = 40.dp, y = (-30).dp))
                    Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Coco", fontFamily = Fun, fontSize = 22.sp, color = Mu.bubblegum)
                        val hour = remember(rememberTicker(60_000L)) { java.time.LocalTime.now().hour }
                        Text(greeting(hour, vm.callMe), style = MaterialTheme.typography.displaySmall, color = Mu.cream)
                        val w = d.approvals.count { it.s("state") == "waiting" }
                        Text(if (d.paused) "Coco is paused. Nothing new starts until you resume." else if (w > 0) "$w things need your YES." else "Everything is moving. Nothing needs you.", style = MaterialTheme.typography.bodyLarge, color = Mu.cream)
                    }
                }
            }
        }
    }
    // Coco HQ: the team at work, live, with Coco coordinating in the middle
    item(key = "hq") { Appear(1) { CocoHQ(vm, onMember) } }
    // Quick command to your own PC (online one first), right on Home
    val myPc = d.devices.filter { it.s("kind") == "pc" && it.s("id") != vm.cloud.deviceId && it.optBoolean("active", true) }
        .sortedWith(compareBy({ !online(it) }, { !it.s("id").startsWith(vm.cloud.deviceId?.substringBefore('-') ?: "~") }))
        .firstOrNull()
    if (myPc != null) item(key = "quick") { Appear(1) { CommandBar(vm, myPc, "Tell ${myPc.s("name")}") } }
    item(key = "tiles") {
        Appear(1) {
            val waiting by animateIntAsState(d.approvals.count { it.s("state") == "waiting" }, tween(600), label = "w")
            val running by animateIntAsState(d.tasks.count { it.s("status") in setOf("running", "working") }, tween(600), label = "r")
            val chan = d.offerings.filter { it.s("kind") == "channel" }
            val conn by animateIntAsState(chan.count { it.optBoolean("connected") }, tween(600), label = "c")
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
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
    val talk = TalkRules.talk(d.agentMessages, d.activity, d.members)
    item(key = "talkh") { Section("Team talk") }
    if (talk.isEmpty()) item(key = "talke") { Muted("Quiet right now. The team's messages to each other show here, live, as they work.") }
    items(talk.take(14), key = { "talk-" + it.atIso + "-" + it.from }) { t -> Box(Modifier.animateItem()) { TalkRow(vm, t) } }
    item(key = "housesh") { Section("Houses") }
    item(key = "houses") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
            d.houses.forEach { h ->
                val id = h.s("id"); val mark = Marks.houses[id] ?: Marks.coco
                val mine = d.offerings.filter { it.s("house_id") == id }
                Surface(Modifier.weight(1f).clip(RoundedCornerShape(24.dp)).bounceClick { go(Tab.Teams, null, id) }, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) { LivingMark(mark, 52.dp); Spacer(Modifier.width(8.dp)); Column { Text(h.s("name"), style = MaterialTheme.typography.titleLarge); Muted(h.s("role"), 1) } }
                        StatusChip(h.s("state"), when (h.s("state")) { "working" -> "Working"; "next" -> "Next"; "later" -> "Later"; else -> null })
                        Muted("${mine.size} ${if (id == "gigi") "channels" else "products"} · ${mine.count { it.optBoolean("connected") }} connected", 1)
                    }
                }
            }
        }
    }
    item(key = "connh") { Section("Connections") }
    item(key = "conn") {
        Card {
            if (d.integrations.isEmpty()) Muted("No connections listed yet.")
            d.integrations.forEach { c ->
                Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    NetLogo(LOGO_DOMAINS[c.s("id")], 30.dp); Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) { Text(c.s("platform"), style = MaterialTheme.typography.titleSmall); Muted(c.s("next_action").ifBlank { c.s("account") }, 2) }
                    StatusChip(c.s("state"))
                }
                d.accounts.filter { it.s("provider") == c.s("id") }.forEach { a ->
                    Column(Modifier.padding(start = 40.dp, bottom = 6.dp)) {
                        Text(a.s("external_name"), style = MaterialTheme.typography.bodyMedium)
                        Muted(accountFacts(a), 3)
                        if (a.s("reconnect_steps").isNotBlank()) Muted("To reconnect: ${a.s("reconnect_steps")}", 2)
                    }
                }
            }
        }
    }
    item(key = "provh") { Section("Cloud providers") }
    item(key = "prov") {
        var armed by remember { mutableStateOf("") }   // approve / roll back need a second tap
        Card {
            if (d.cloudProviders.isEmpty()) Muted("No cloud providers are registered yet.")
            d.cloudProviders.forEach { p ->
                Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(p.s("label"), style = MaterialTheme.typography.titleSmall); Muted("${p.s("capability")} · ${p.s("role")}", 1) }
                    StatusChip(p.s("state"))
                }
            }
            d.switches.forEach { s ->
                val id = s.s("id"); val st = s.s("state")
                Column(Modifier.padding(top = 8.dp)) {
                    Text("${s.s("capability")}: ${s.s("from_provider").ifBlank { "none" }} → ${s.s("to_provider")}", style = MaterialTheme.typography.titleSmall)
                    Muted("${st.replace('_', ' ')} · backup ${if (s.optBoolean("backup_verified")) "verified" else "NOT verified"}", 2)
                    Row {
                        if (st == "validated" && s.optBoolean("backup_verified"))
                            TextButton({ if (armed == "approve:$id") { armed = ""; vm.providerSwitch("approve", id) } else armed = "approve:$id" }) {
                                Text(if (armed == "approve:$id") "Tap again to approve" else "Approve cut-over") }
                        if (st in listOf("planned", "exported", "imported", "validated", "approved", "cut_over"))
                            TextButton({ if (armed == "rollback:$id") { armed = ""; vm.providerSwitch("rollback", id) } else armed = "rollback:$id" }) {
                                Text(if (armed == "rollback:$id") "Tap again to roll back" else "Roll back") }
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
    Surface(modifier.fillMaxHeight().clip(RoundedCornerShape(24.dp)).bounceClick(onClick), shape = RoundedCornerShape(24.dp), color = bg, contentColor = fg) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 14.dp)) {
            // "13/15" used to break into two lines: long values get a smaller size and never wrap.
            Text(value, style = if (value.length > 3) MaterialTheme.typography.titleLarge else MaterialTheme.typography.headlineMedium, color = fg, maxLines = 1, softWrap = false)
            Text(label, style = MaterialTheme.typography.labelLarge, color = fg, maxLines = 2)
        }
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
    // Live mic (Boss, 2026-10-21): stays on like an assistant. Every sentence runs at once on this device, and it keeps
    // listening for the next one until "bas" / "stop" / "mic band" (or a tap).
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var live by remember { mutableStateOf(false) }
    var hearing by remember { mutableStateOf("") }
    val heardLog = remember { androidx.compose.runtime.mutableStateListOf<String>() }
    val rec = remember { runCatching { android.speech.SpeechRecognizer.createSpeechRecognizer(ctx) }.getOrNull() }
    val main = remember { android.os.Handler(android.os.Looper.getMainLooper()) }
    val speechIntent = remember { Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
        .putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        .putExtra(android.speech.RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1200L) }
    // Silent mic (Boss, 2026-10-21): Android beeps every time listening starts or stops, and in silence it restarts every
    // 3-4 s. While the live mic is on, the beep streams are muted; music keeps playing (it is muted only for a moment, and
    // only when nothing is playing).
    val am = remember { ctx.getSystemService(android.media.AudioManager::class.java) }
    val mute = { stream: Int, on: Boolean -> runCatching { am.adjustStreamVolume(stream, if (on) android.media.AudioManager.ADJUST_MUTE else android.media.AudioManager.ADJUST_UNMUTE, 0) } }
    androidx.compose.runtime.LaunchedEffect(live) {
        mute(android.media.AudioManager.STREAM_SYSTEM, live); mute(android.media.AudioManager.STREAM_NOTIFICATION, live)
        if (!live) mute(android.media.AudioManager.STREAM_MUSIC, false)
    }
    val startOnce = {
        if (live) {
            val quietMusic = !am.isMusicActive
            if (quietMusic) mute(android.media.AudioManager.STREAM_MUSIC, true)
            runCatching { rec?.startListening(speechIntent) }
            if (quietMusic) main.postDelayed({ mute(android.media.AudioManager.STREAM_MUSIC, false) }, 700)
        }
    }
    androidx.compose.runtime.DisposableEffect(rec) {
        rec?.setRecognitionListener(object : android.speech.RecognitionListener {
            override fun onResults(b: android.os.Bundle?) {
                val heard = b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty().trim()
                hearing = ""
                if (Regex("^(bas|stop|stop listening|mic band|mic band karo|thank you coco|band karo mic)\b", RegexOption.IGNORE_CASE).containsMatchIn(heard)) { live = false; return }
                if (heard.isNotBlank()) { heardLog.add(0, heard); if (heardLog.size > 5) heardLog.removeAt(5); send(heard) }
                main.postDelayed({ startOnce() }, 250)
            }
            override fun onPartialResults(b: android.os.Bundle?) { hearing = b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty() }
            override fun onError(error: Int) { main.postDelayed({ startOnce() }, if (error == android.speech.SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 600 else 250) }
            override fun onReadyForSpeech(p: android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, b: android.os.Bundle?) {}
        })
        onDispose { live = false; mute(android.media.AudioManager.STREAM_SYSTEM, false); mute(android.media.AudioManager.STREAM_NOTIFICATION, false); mute(android.media.AudioManager.STREAM_MUSIC, false); runCatching { rec?.destroy() } }
    }
    val askMic = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) { live = true; startOnce() } else vm.message = "Allow the microphone to talk to Coco"
    }
    val listen = {
        when {
            rec == null -> vm.message = "Voice is not available on this phone"
            live -> { live = false; runCatching { rec.stopListening() } }
            androidx.core.content.ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED -> askMic.launch(android.Manifest.permission.RECORD_AUDIO)
            else -> { live = true; startOnce() }
        }
    }
    Surface(shape = RoundedCornerShape(28.dp), color = Mu.plum, contentColor = Mu.cream, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(title, style = MaterialTheme.typography.titleLarge, color = Mu.cream)
                    Text(if (live) (hearing.ifBlank { "Listening… keep talking. Say \"bas\" to stop." }) else "Tap the mic once: it keeps listening and does each thing you say.", style = MaterialTheme.typography.bodyMedium, color = Mu.bubblegum)
                }
                Spacer(Modifier.width(10.dp))
                FilledIconButton({ listen() }, Modifier.size(64.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = if (live) Mu.bubblegum else Mu.tomato, contentColor = if (live) Mu.plum else Mu.cream)) { Icon(if (live) Icons.Rounded.GraphicEq else Icons.Rounded.Mic, if (live) "Stop listening" else "Speak", Modifier.size(32.dp)) }
            }
            if (live && heardLog.isNotEmpty()) heardLog.forEach { Text("✓ $it", style = MaterialTheme.typography.bodySmall, color = Mu.cream.copy(alpha = 0.85f)) }
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
                Column(Modifier.weight(1f)) { Text(dev.s("name"), style = MaterialTheme.typography.titleLarge); Muted(if (online(dev)) "online · Coco Lounge connected" else if (dev.s("key_hash").isBlank()) "not paired yet" else "offline · seen ${ago(dev.s("last_seen"))} · runs if back within 10 min"); dev.optJSONObject("info")?.optString("summary")?.takeIf { it.isNotBlank() }?.let { Muted("$it · ${ago(dev.optJSONObject("info")?.optString("at"))}") } }
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
        // Home & Office (Boss, 2026-10-22): runs on the laptop through office-mode.exe; the result comes back in Recent commands.
        if (pc) Card {
            Eyebrow("Home & Office")
            dev.optJSONObject("info")?.optString("summary")?.takeIf { it.isNotBlank() }?.let { Muted(it.split(" · ").take(4).joinToString(" · ")) }
            Button({ confirm = "close_all" }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) { Icon(Icons.Rounded.Cancel, null); Spacer(Modifier.width(8.dp)); Text("Close All Tabs & Desktop Sessions") }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("save" to "Save Current Session", "restore_home" to "Restore Home Session", "restore_office" to "Restore Office Session",
                    "switch_home" to "Switch to Home Mode", "switch_office" to "Switch to Office Mode").forEach { (op, label) ->
                    AssistChip({ if (op.startsWith("switch_")) confirm = op else send("workspace", JSONObject().put("op", op)) }, { Text(label) })
                }
            }
            Muted("Runs on ${dev.s("name")}, not on this phone. Every close saves the session first; if the save fails nothing is closed.")
        }
        // Power or phone tools
        Card {
            var msgOpen by remember { mutableStateOf(false) }
            if (msgOpen) {
                var msg by remember { mutableStateOf("") }
                AlertDialog(onDismissRequest = { msgOpen = false }, title = { Text("Message to ${dev.s("name")}") },
                    text = { OutlinedTextField(msg, { msg = it }, placeholder = { Text("Type anything, emojis ok 😊") }, minLines = 2, modifier = Modifier.fillMaxWidth()) },
                    confirmButton = { MuButton({ if (msg.isNotBlank()) send("notify", JSONObject().put("text", msg.trim())); msgOpen = false }) { Text("Send") } },
                    dismissButton = { TextButton({ msgOpen = false }) { Text("Cancel") } })
            }
            Eyebrow(if (pc) "Power" else "Phone")
            val actions = if (pc) listOf(Triple("lock", "Lock", Icons.Rounded.Lock), Triple("sleep", "Sleep", Icons.Rounded.Bedtime), Triple("restart", "Restart", Icons.Rounded.RestartAlt),
                Triple("shutdown", "Switch off", Icons.Rounded.PowerSettingsNew), Triple("cancel_power", "Cancel", Icons.Rounded.Cancel), Triple("notify", "Message", Icons.Rounded.Chat))
            else listOf(Triple("ring", "Ring it", Icons.Rounded.NotificationsActive), Triple("notify", "Message", Icons.Rounded.Chat))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 3) {
                actions.forEach { (a, label, icon) ->
                    FilledTonalButton({ when (a) { "restart", "shutdown" -> confirm = a; "notify" -> msgOpen = true; else -> send(a, JSONObject()) } },
                        Modifier.weight(1f), shape = RoundedCornerShape(18.dp), contentPadding = PaddingValues(6.dp, 12.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { Icon(icon, null); Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
                    }
                }
            }
            if (pc) Muted("Restart and switch off wait 60 seconds so you can cancel. Unlock is not possible from a phone: Windows only unlocks with your PIN or face at the PC.")
        }
    }
    confirm?.takeIf { it == "close_all" || it.startsWith("switch_") }?.let { op -> AlertDialog(onDismissRequest = { confirm = null },
        title = { Text(if (op == "close_all") "Close everything on ${dev.s("name")}?" else "Switch ${dev.s("name")} to ${op.removePrefix("switch_")} mode?") },
        text = { Text(if (op == "close_all") "All tabs, windows and app sessions on the laptop close. The session is saved first. Apps with unsaved work ask and stay open. Coco and the Claude terminals keep running." else "The open windows are saved, then closed, and the ${op.removePrefix("switch_")} apps open.") },
        confirmButton = { MuButton({ send("workspace", JSONObject().put("op", op)); confirm = null }) { Text(if (op == "close_all") "Close all" else "Switch") } },
        dismissButton = { TextButton({ confirm = null }) { Text("Cancel") } }) }
    confirm?.takeIf { it == "restart" || it == "shutdown" }?.let { a -> AlertDialog(onDismissRequest = { confirm = null }, title = { Text(if (a == "restart") "Restart ${dev.s("name")}?" else "Switch off ${dev.s("name")}?") },
        text = { Text("It happens in 60 seconds. Unsaved work on that PC can be lost. You can cancel from here.") },
        confirmButton = { MuButton({ send(a, JSONObject()); confirm = null }) { Text(if (a == "restart") "Restart" else "Switch off") } },
        dismissButton = { TextButton({ confirm = null }) { Text("Keep it on") } }) }
}

// ---------- MORE ----------
fun LazyListScope.moreMenu(vm: Lounge, open: (MorePage) -> Unit) {
    val waiting = vm.data.approvals.count { it.s("state") == "waiting" }
    items(MorePage.entries, key = { "more-" + it.name }) { p ->
        Surface(Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).bounceClick { open(p) }, shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
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
        // The same decision the PCs show: who, when, and the approval's own id. There is one approval
        // row in the cloud for all four devices, so a phone opening a decided request sees it decided.
        Muted(listOfNotNull(
            a.s("raised_on").takeIf { it.isNotBlank() },
            a.s("decided_by").takeIf { it.isNotBlank() }?.let { (if (a.s("state") == "rejected") "No" else "YES") + " by $it" },
            a.s("decided_at").takeIf { it.isNotBlank() }?.take(16)?.replace('T', ' '),
            a.s("id").takeIf { it.isNotBlank() },
        ).joinToString(" · "), maxLines = 2)
        if (a.s("state") == "waiting") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { MuButton({ vm.decide(a, true) }) { Text("YES") }; TextButton({ vm.decide(a, false) }) { Text("No") } }
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
            MuButton({ if (title.isNotBlank()) { vm.submitTask(title.trim(), null, house, needs); title = "" } }, enabled = title.isNotBlank()) { Text("Send to Coco") }
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
            MuTonal({ vm.dialog = Lounge.Dialog.AddPoints(id, t.s("title")) }) { Text("Add points") }; TextButton({ vm.stopTask(id, t.s("title")) }) { Text("Stop") }
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
            MuButton({ vm.addRule(title.trim(), body.trim()); title = ""; body = "" }, enabled = title.isNotBlank() && body.isNotBlank()) { Text("Save rule for everyone") }
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
            else if (d.optBoolean("active", true)) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { MuTonal({ vm.makePairingCode(id) }) { Text("Make pairing code") }; var ask by remember { mutableStateOf(false) }; TextButton({ ask = true }) { Text("Switch off") }
                if (ask) AlertDialog(onDismissRequest = { ask = false }, title = { Text("Switch off ${d.s("name")}?") }, text = { Text("It will stop opening Good Space and stop taking commands until you switch it on again.") },
                    confirmButton = { TextButton({ vm.switchOff(id); ask = false }) { Text("Switch off") } }, dismissButton = { MuButton({ ask = false }) { Text("Keep it on") } }) }
            else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { Text("Switched off", color = LocalLux.current.bad, style = MaterialTheme.typography.labelLarge); MuTonal({ vm.switchOn(id) }) { Text("Switch on") } }
        }
    }
}

fun LazyListScope.settings(vm: Lounge) {
    item(key = "s-account") { Card { Eyebrow("Account"); Text("${vm.name} · ${vm.callMe}", style = MaterialTheme.typography.titleLarge); Muted(vm.cloud.email.orEmpty()); MuOutlined({ vm.signOut() }) { Text("Sign out") } } }
    item(key = "s-notify") { Card {
        Eyebrow("Notifications")
        key(vm.notifyTick) { listOf("approvals" to "Approvals waiting for YES", "done" to "Tasks finished", "merged" to "Coco merged a task", "tasks" to "Tasks from the other founder", "rules" to "New rules").forEach { (k, label) ->
            Row(verticalAlignment = Alignment.CenterVertically) { Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f)); Switch(vm.notifyOn(k), { vm.setNotify(k, it) }) } } }
    } }
    item(key = "s-look") { Card {
        Eyebrow("Appearance")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) { listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEachIndexed { i, (v, l) -> SegmentedButton(vm.theme == v, { vm.chooseTheme(v) }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(l) } } }
        Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Calm motion", style = MaterialTheme.typography.bodyLarge); Muted("Logos and screens keep still") }; Switch(vm.calm, { vm.chooseCalm(it) }) }
        if (android.os.Build.VERSION.SDK_INT >= 31) Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text("Match my wallpaper", style = MaterialTheme.typography.bodyLarge); Muted("Material You colours from your wallpaper instead of the Good Space palette") }; Switch(vm.wallpaper, { vm.chooseWallpaper(it) }) }
        MuOutlined({ vm.refreshNow() }) { Text("Refresh now") }
    } }
    item(key = "s-remote") { Card {
        val ctx = androidx.compose.ui.platform.LocalContext.current
        Eyebrow("Remote control when the app is closed")
        Muted(if (android.provider.Settings.canDrawOverlays(ctx)) "On: your PC can open YouTube and other apps here even when Coco Lounge is closed." else "Off: allow \"Display over other apps\" once, so your PC can open apps here even when Coco Lounge is closed.")
        if (!android.provider.Settings.canDrawOverlays(ctx)) MuButton({ ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + ctx.packageName))) }) { Text("Allow") }
    } }
    item(key = "s-update") { Card { Eyebrow("Updates"); Text("Coco Lounge ${vm.appVersion}", style = MaterialTheme.typography.titleLarge); Muted("Updates install by themselves. Tap to check right now."); MuButton({ vm.checkUpdate() }) { Text("Check for update") } } }
    item(key = "s-about") { Card { Eyebrow("About"); Text("Coco Lounge ${vm.appVersion} · Android", style = MaterialTheme.typography.titleLarge); Muted("Good Space, managed by Coco. House theme: Material You Design Theme v1. Private: founder login plus this device's key.") } }
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


val LOGO_DOMAINS = mapOf("youtube" to "youtube.com", "github" to "github.com", "supabase" to "supabase.com", "chrome_store" to "chromewebstore.google.com",
    "play_console" to "play.google.com", "autodraft" to "autodraft.in", "roblox" to "roblox.com", "meta" to "facebook.com", "udemy" to "udemy.com", "coursera" to "coursera.org")

private val logoCache = mutableMapOf<String, androidx.compose.ui.graphics.ImageBitmap?>()

// Each platform's own logo (site favicon), loaded once and cached; Coco's mark while loading or offline.
@Composable
fun NetLogo(domain: String?, size: androidx.compose.ui.unit.Dp) {
    var img by remember(domain) { mutableStateOf(domain?.let { logoCache[it] }) }
    LaunchedEffect(domain) {
        if (domain == null || img != null) return@LaunchedEffect
        img = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                okhttp3.OkHttpClient().newCall(okhttp3.Request.Builder().url("https://www.google.com/s2/favicons?sz=64&domain=$domain").build()).execute()
                    .use { r -> r.body?.bytes()?.let { android.graphics.BitmapFactory.decodeByteArray(it, 0, it.size) }?.asImageBitmap() }
            }.getOrNull()
        }
        logoCache[domain] = img
    }
    val b = img
    if (b != null) androidx.compose.foundation.Image(b, null, Modifier.size(size).clip(RoundedCornerShape(6.dp)))
    else LivingMark(Marks.coco, size)
}
