@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.goodspace.cocolounge

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.Duration
import java.time.Instant

// ---------- Lounge Standard pieces ----------
enum class Tab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Rounded.Home), Board("Board", Icons.Rounded.ViewKanban), Approvals("Approvals", Icons.Rounded.Verified),
    Company("Company", Icons.Rounded.Apartment), Club("Club", Icons.Rounded.Diversity3), Rules("Rules", Icons.Rounded.Gavel), Devices("Devices", Icons.Rounded.Devices),
    Settings("Settings", Icons.Rounded.Settings)
}

/** Calm motion: when on (Settings or the phone's own animation setting), screens keep still. */
val LocalCalm = staticCompositionLocalOf { false }

fun ago(iso: String?): String {
    if (iso.isNullOrBlank() || iso == "null") return "never"
    val s = runCatching { Duration.between(Instant.parse(iso.replace(" ", "T").let { if (it.endsWith("Z") || it.contains("+")) it.replace("+00:00", "Z").replace("+00", "Z") else it + "Z" }), Instant.now()).seconds }.getOrDefault(0)
    return when { s < 90 -> "just now"; s < 3600 -> "${s / 60} min ago"; s < 86400 -> "${s / 3600} h ago"; else -> "${s / 86400} d ago" }
}
fun online(d: JSONObject) = d.optString("last_seen").let { it.isNotBlank() && it != "null" && ago(it).let { a -> a == "just now" || a == "1 min ago" || a == "2 min ago" } }

@Composable
fun StatusChip(state: String) {
    val lux = LocalLux.current
    val (bg, fg, text) = when (state) {
        "running" -> Triple(lux.goodC, lux.good, "Running"); "working" -> Triple(lux.goodC, lux.good, "Working")
        "done" -> Triple(lux.goodC, lux.good, "Done"); "approved" -> Triple(lux.goodC, lux.good, "Approved")
        "waiting" -> Triple(lux.warnC, lux.warn, "Waiting for YES"); "needs_yes" -> Triple(lux.warnC, lux.warn, "Needs YES")
        "waiting_pc" -> Triple(lux.warnC, lux.warn, "Waiting for a PC"); "next" -> Triple(lux.warnC, lux.warn, "Next")
        "failed" -> Triple(lux.badC, lux.bad, "Failed"); "rejected" -> Triple(lux.badC, lux.bad, "No")
        "queued" -> Triple(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.colorScheme.onSurface, "Queued")
        "on-hold" -> Triple(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.colorScheme.onSurface, "On hold")
        else -> Triple(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.colorScheme.onSurface, state.replaceFirstChar { it.uppercase() })
    }
    Surface(color = bg, contentColor = fg, shape = RoundedCornerShape(8.dp)) { Text(text, Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall) }
}

/** Breathing live dot: drawn on the graphics layer only, so it never makes the screen work hard. */
@Composable
fun LiveDot(on: Boolean) {
    val t = rememberInfiniteTransition(label = "live")
    val pulse by t.animateFloat(1f, 1.8f, infiniteRepeatable(tween(1400, easing = FastOutSlowInEasing), RepeatMode.Restart), label = "pulse")
    val color = if (on) Color(0xFF3FB46A) else MaterialTheme.colorScheme.onSurfaceVariant
    Box(Modifier.size(10.dp), contentAlignment = Alignment.Center) {
        if (on && !LocalCalm.current) Box(Modifier.size(10.dp).graphicsLayer { scaleX = pulse; scaleY = pulse; alpha = (1.8f - pulse) / 0.8f * 0.5f }.background(color, CircleShape))
        Box(Modifier.size(8.dp).background(color, CircleShape))
    }
}

/** Cards slide up and fade in once, a little after each other. Uses graphicsLayer for smooth 60 fps motion. */
@Composable
fun Appear(index: Int, content: @Composable () -> Unit) {
    if (LocalCalm.current) { content(); return }
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val p by androidx.compose.animation.core.animateFloatAsState(if (shown) 1f else 0f, tween(420, delayMillis = (index.coerceAtMost(8)) * 45, easing = FastOutSlowInEasing), label = "appear")
    Box(Modifier.graphicsLayer { alpha = p; translationY = (1f - p) * 36f }) { content() }
}

@Composable
fun LuxCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp), color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
    }
}

@Composable
fun Muted(text: String, maxLines: Int = Int.MAX_VALUE) = Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = maxLines, overflow = TextOverflow.Ellipsis)

@Composable
fun Eyebrow(text: String) = Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = LocalLux.current.gold)

// ---------- gates ----------
@Composable
fun GateCard(title: String, eyebrow: String, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).systemBarsPadding().imePadding().padding(20.dp), contentAlignment = Alignment.Center) {
        Appear(0) {
            Surface(shape = RoundedCornerShape(32.dp), color = MaterialTheme.colorScheme.surfaceContainerLow, modifier = Modifier.widthIn(max = 440.dp)) {
                Column(Modifier.padding(26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(Brush.linearGradient(listOf(Color(0xFFF3C9B5), Color(0xFF7B4F6B)))), contentAlignment = Alignment.Center) {
                            Icon(painterResource(R.drawable.ic_coco_face), null, tint = Color.Unspecified, modifier = Modifier.size(64.dp))
                        }
                        Column { Eyebrow(eyebrow); Text(title, style = MaterialTheme.typography.headlineSmall) }
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
        Button({ vm.signIn(mail, pass) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text("Sign in") }
        TextButton({ vm.signUp(mail, pass) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text("First time on Good Space? Create your password") }
    }
}

@Composable
fun Pair(vm: Lounge) {
    var code by remember { mutableStateOf("") }
    GateCard("Pair this phone", "One of four") {
        Muted("Good Space opens only on your PC and your phone. Type the 8-letter pairing code for this phone.")
        OutlinedTextField(code, { code = it.uppercase().take(12) }, label = { Text("Pairing code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button({ vm.pair(code) }, enabled = !vm.busy && code.length >= 6, modifier = Modifier.fillMaxWidth().height(50.dp)) { Text("Pair phone") }
        TextButton({ vm.signOut() }, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
    }
}

// ---------- the Lounge ----------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoungeApp(vm: Lounge) {
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(vm.message) { vm.message?.let { snack.showSnackbar(it); vm.message = null } }
    val waiting = vm.data.approvals.count { it.optString("state") == "waiting" }

    Scaffold(
        snackbarHost = { SnackbarHost(snack) },
        topBar = {
            TopAppBar(
                navigationIcon = { if (tab == Tab.Rules || tab == Tab.Devices || tab == Tab.Settings) IconButton({ tab = Tab.Home }) { Icon(Icons.Rounded.ArrowBack, "Back") } },
                title = { Column { Eyebrow("Good Space · ${vm.callMe}"); AnimatedContent(tab.label, label = "title") { Text(it, style = MaterialTheme.typography.headlineSmall) } } },
                actions = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(end = 16.dp)) { LiveDot(vm.live); Muted(if (vm.live) "live" else "reconnecting"); IconButton({ tab = Tab.Settings }) { Icon(Icons.Rounded.Settings, "Settings") } } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                Tab.entries.take(5).forEach { t ->
                    NavigationBarItem(selected = tab == t, onClick = { tab = t }, label = { Text(t.label) },
                        icon = { BadgedBox(badge = { if (t == Tab.Approvals && waiting > 0) Badge { Text("$waiting") } }) { Icon(t.icon, t.label) } })
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        // Material fade-through between screens
        AnimatedContent(tab, Modifier.padding(pad), transitionSpec = {
            (fadeIn(tween(220, delayMillis = 90)) + scaleIn(tween(220, delayMillis = 90), initialScale = 0.96f)) togetherWith fadeOut(tween(90))
        }, label = "screens") { t ->
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (t) {
                    Tab.Home -> home(vm) { tab = it }
                    Tab.Board -> board(vm)
                    Tab.Approvals -> approvals(vm)
                    Tab.Company -> company(vm)
                    Tab.Club -> club(vm)
                    Tab.Rules -> rules(vm)
                    Tab.Devices -> devices(vm)
                    Tab.Settings -> settings(vm)
                }
            }
        }
    }
    Dialogs(vm)
}

fun LazyListScope.home(vm: Lounge, go: (Tab) -> Unit) {
    item(key = "hero") { Appear(0) { Hero(vm) } }
    item(key = "more") {
        Appear(1) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilledTonalButton({ go(Tab.Rules) }, Modifier.weight(1f)) { Icon(Icons.Rounded.Gavel, null); Spacer(Modifier.width(6.dp)); Text("Rules") }
                FilledTonalButton({ go(Tab.Devices) }, Modifier.weight(1f)) { Icon(Icons.Rounded.Devices, null); Spacer(Modifier.width(6.dp)); Text("Devices") }
            }
        }
    }
    itemsIndexed(vm.data.houses, "h") { i, h ->
        LuxCard {
            Row(verticalAlignment = Alignment.CenterVertically) { Text(h.optString("name"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(h.optString("state")) }
            Muted(h.optString("role"))
            Text(h.optString("doing").let { if (it == "null") "" else it }, style = MaterialTheme.typography.bodyMedium)
            Muted("Next: ${h.optString("next").let { if (it == "null") "" else it }}")
        }
    }
    item(key = "acth") { Text("Latest activity", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp)) }
    itemsIndexed(vm.data.activity, "a") { _, a ->
        LuxCard {
            Text("${a.optString("action")} · ${a.optString("detail").let { if (it == "null") "" else it }}", style = MaterialTheme.typography.bodyMedium)
            Muted("${a.optString("actor")}${a.optString("device_id").let { if (it.isBlank() || it == "null") "" else " · " + vm.deviceName(it) }} · ${ago(a.optString("at"))}")
        }
    }
}

/** Keeps item keys stable so lists animate instead of jumping. */
fun LazyListScope.itemsIndexed(list: List<JSONObject>, prefix: String, content: @Composable (Int, JSONObject) -> Unit) {
    items(list.size, key = { "$prefix-${list[it].optString("id", list[it].optString("code", it.toString()))}-$it" }) { i ->
        Box(Modifier.animateItem()) { Appear(i + 2) { content(i, list[i]) } }
    }
}

@Composable
fun Hero(vm: Lounge) {
    val d = vm.data
    val waiting = d.approvals.count { it.optString("state") == "waiting" }
    val running by animateIntAsState(d.tasks.count { it.optString("status") == "running" }, tween(600), label = "run")
    val products by animateIntAsState(d.offerings.size, tween(900), label = "prod")
    val houses by animateIntAsState(d.houses.count { it.optString("state") == "working" }, tween(600), label = "houses")
    val onlineCount by animateIntAsState(d.devices.count { online(it) }, tween(600), label = "on")
    val t = rememberInfiniteTransition(label = "glow")
    val moving by t.animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = LinearEasing), RepeatMode.Reverse), label = "shift")
    val shift = if (LocalCalm.current) 0.3f else moving
    val rose = MaterialTheme.colorScheme.primaryContainer; val gold = LocalLux.current.goldSoft; val base = MaterialTheme.colorScheme.surfaceContainerLow
    Surface(shape = RoundedCornerShape(30.dp), color = Color.Transparent, contentColor = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.drawBehind {
            drawRect(Brush.linearGradient(listOf(rose, gold.copy(alpha = 0.75f), base), start = Offset(size.width * shift, 0f), end = Offset(size.width * (1 - shift) + size.width, size.height)))
        }.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Hello ${vm.callMe}", style = MaterialTheme.typography.headlineSmall)
            Text(if (waiting > 0) "$waiting things wait for your YES." else "Nothing waits for you.", style = MaterialTheme.typography.bodyLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stat("$houses", "Houses working", Modifier.weight(1f)); Stat("$running", "running", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stat("$products", "channels and products", Modifier.weight(1f)); Stat("$onlineCount/4", "devices online", Modifier.weight(1f))
            }
        }
    }
}

@Composable
fun Stat(value: String, label: String, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.background.copy(alpha = 0.6f)) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) { Text(value, style = MaterialTheme.typography.headlineSmall); Muted(label) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
fun LazyListScope.board(vm: Lounge) {
    item(key = "form") {
        Appear(0) {
            var title by remember { mutableStateOf("") }; var details by remember { mutableStateOf("") }
            var house by remember { mutableStateOf("gigi") }; var needs by remember { mutableStateOf("any") }; var open by remember { mutableStateOf(false) }
            LuxCard {
                Text("Give Coco a task", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(title, { title = it }, label = { Text("What should be done?") }, modifier = Modifier.fillMaxWidth())
                ExposedDropdownMenuBox(open, { open = it }) {
                    OutlinedTextField(vm.houseName(house), {}, readOnly = true, label = { Text("House") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(open) }, modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth())
                    ExposedDropdownMenu(open, { open = false }) { vm.data.houses.forEach { h -> DropdownMenuItem({ Text("${h.optString("name")} · ${h.optString("role")}") }, { house = h.optString("id"); open = false }) } }
                }
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf("any" to "Anywhere", "cloud" to "Cloud", "pc" to "PC").forEachIndexed { i, (v, l) ->
                        SegmentedButton(needs == v, { needs = v }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(l) }
                    }
                }
                OutlinedTextField(details, { details = it }, label = { Text("Details (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                Button({ if (title.isNotBlank()) { vm.submitTask(title.trim(), details.trim().ifBlank { null }, house, needs); title = ""; details = "" } }, enabled = title.isNotBlank()) { Text("Send to Coco") }
            }
        }
    }
    val open = vm.data.tasks.filter { it.optString("status") !in setOf("done", "stopped") }
    val closed = vm.data.tasks.filter { it.optString("status") in setOf("done", "stopped") }.take(15)
    item(key = "openh") { Text("Open (${open.size})", style = MaterialTheme.typography.titleLarge) }
    itemsIndexed(open, "o") { _, t -> TaskCard(vm, t) }
    item(key = "doneh") { Text("Finished", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp)) }
    itemsIndexed(closed, "c") { _, t -> TaskCard(vm, t) }
}

@Composable
fun TaskCard(vm: Lounge, t: JSONObject) {
    val id = t.optString("id")
    LuxCard {
        Row(verticalAlignment = Alignment.CenterVertically) { Text(t.optString("title"), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)); StatusChip(t.optString("status")) }
        val by = t.optString("created_device").let { if (it.isBlank() || it == "null") "" else " on " + vm.deviceName(it) }
        val where = t.optString("claimed_by_device").let { if (it.isBlank() || it == "null") "" else " · working on " + vm.deviceName(it) }
        Muted("${vm.houseName(t.optString("house_id"))} · by ${t.optString("created_by")}$by · ${ago(t.optString("created_at"))}$where")
        t.optString("details").takeIf { it.isNotBlank() && it != "null" }?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
        vm.data.notes.filter { it.optString("task_id") == id }.forEach { Muted("+ ${it.optString("note")} (${it.optString("by_email")})") }
        t.optString("result").takeIf { it.isNotBlank() && it != "null" }?.let { Text("Result: $it", color = LocalLux.current.gold, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold) }
        if (t.optString("status") in setOf("queued", "running", "waiting_pc", "needs_yes")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledTonalButton({ vm.dialog = Lounge.Dialog.AddPoints(id, t.optString("title")) }) { Text("Add points") }
            TextButton({ vm.stopTask(id, t.optString("title")) }) { Text("Stop") }
        }
    }
}

fun LazyListScope.approvals(vm: Lounge) {
    item(key = "note") { Muted("Your YES is recorded with your name and device. Nothing goes public, costs money or gets deleted without it.") }
    val w = vm.data.approvals.filter { it.optString("state") == "waiting" }
    val r = vm.data.approvals.filter { it.optString("state") != "waiting" }
    item(key = "wh") { Text("Waiting (${w.size})", style = MaterialTheme.typography.titleLarge) }
    itemsIndexed(w, "w") { _, a -> ApprovalCard(vm, a) }
    item(key = "rh") { Text("Decided", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp)) }
    itemsIndexed(r, "r") { _, a -> ApprovalCard(vm, a) }
}

@Composable
fun ApprovalCard(vm: Lounge, a: JSONObject) {
    LuxCard {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("${a.optString("code")} · ${a.optString("team")}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f)); StatusChip(a.optString("state")) }
        Text(a.optString("what"), style = MaterialTheme.typography.bodyMedium)
        Muted(listOfNotNull(a.optString("raised_on").takeIf { it != "null" }, a.optString("decided_by").takeIf { it.isNotBlank() && it != "null" }?.let { "decided by $it" }).joinToString(" · "))
        if (a.optString("state") == "waiting") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button({ vm.decide(a, true) }) { Text("YES") }
            TextButton({ vm.decide(a, false) }) { Text("No") }
        }
    }
}

fun LazyListScope.company(vm: Lounge) {
    item(key = "tabs") {
        var sel by rememberSaveable { mutableStateOf("gigi") }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScrollSafe()) {
                (vm.data.houses.map { it.optString("id") to it.optString("name") } + ("decisions" to "Decisions")).forEach { (id, n) -> FilterChip(sel == id, { sel = id }, { Text(n) }) }
            }
            AnimatedContent(sel, transitionSpec = { fadeIn(tween(200, 60)) togetherWith fadeOut(tween(60)) }, label = "house") { s ->
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (s == "decisions") vm.data.decisions.forEach { d -> LuxCard { Text(d.optString("text"), style = MaterialTheme.typography.bodyMedium); Muted("${d.optString("decided_on")} · ${d.optString("by_name")}") } }
                    else {
                        val h = vm.data.houses.firstOrNull { it.optString("id") == s }
                        if (h != null) LuxCard {
                            Row(verticalAlignment = Alignment.CenterVertically) { Text("${h.optString("name")} · ${h.optString("role")}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(h.optString("state")) }
                            Text(h.optString("cadence"), style = MaterialTheme.typography.bodyMedium); Muted(h.optString("publish_rule"))
                            h.optString("blocked").takeIf { it.isNotBlank() && it != "null" }?.let { Text("Blocked: $it", color = LocalLux.current.warn, style = MaterialTheme.typography.bodyMedium) }
                        }
                        vm.data.categories.filter { it.optString("house_id") == s }.forEach { c ->
                            val items = vm.data.offerings.filter { it.optString("category_id") == c.optString("id") }
                            LuxCard {
                                Muted("%02d".format(c.optInt("code")) + c.optString("linked_to").let { if (it.isBlank() || it == "null") "" else " · linked to $it" })
                                Text(c.optString("name"), style = MaterialTheme.typography.titleLarge)
                                if (items.isEmpty()) Muted("Empty for now")
                                items.forEach { o -> Row { Text(o.optString("name"), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f)); Muted(o.optString("status"), 1) } }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun Modifier.horizontalScrollSafe(): Modifier = this.then(Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()))

fun LazyListScope.club(vm: Lounge) {
    listOf("Think", "Make", "Care").forEach { g ->
        item(key = "g$g") { Text(g, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 4.dp)) }
        itemsIndexed(vm.data.members.filter { it.optString("grp") == g }, "m$g") { _, m ->
            val tools = vm.data.memberTools.filter { it.optString("member_id") == m.optString("id") }.mapNotNull { mt -> vm.data.tools.firstOrNull { it.optString("id") == mt.optString("tool_id") } }
            val helps = vm.data.memberHouses.filter { it.optString("member_id") == m.optString("id") }.joinToString(", ") { vm.houseName(it.optString("house_id")) }
            LuxCard {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(m.optString("name"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(m.optString("model")) }
                Text(m.optString("job"), style = MaterialTheme.typography.bodyMedium); Muted("Helps: $helps")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    tools.forEach { tl -> ToolChip(tl) }
                }
            }
        }
    }
}

fun LazyListScope.rules(vm: Lounge) {
    item(key = "ruleform") {
        Appear(0) {
            var title by remember { mutableStateOf("") }; var body by remember { mutableStateOf("") }
            LuxCard {
                Text("Set a rule for all of Good Space", style = MaterialTheme.typography.titleLarge)
                Muted("Every device and every Coco worker follows it at once. The other founder is told.")
                OutlinedTextField(title, { title = it }, label = { Text("Rule in a few words") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(body, { body = it }, label = { Text("Details") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                Button({ vm.addRule(title.trim(), body.trim()); title = ""; body = "" }, enabled = title.isNotBlank() && body.isNotBlank()) { Text("Save rule for everyone") }
            }
        }
    }
    itemsIndexed(vm.data.rules, "rule") { _, r ->
        LuxCard { Row { Text(r.optString("title"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); Muted(ago(r.optString("updated_at"))) }; Text(r.optString("body").take(700), style = MaterialTheme.typography.bodyMedium) }
    }
}

fun LazyListScope.devices(vm: Lounge) {
    item(key = "dn") { Muted("Only these four devices can open Good Space. A device that is switched off stops working at once.") }
    itemsIndexed(vm.data.devices, "d") { _, d ->
        val id = d.optString("id"); val mine = id == vm.cloud.deviceId
        LuxCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(d.optString("name"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                LiveDot(online(d)); Spacer(Modifier.width(6.dp)); Muted(if (online(d)) "online" else "offline")
            }
            Muted("${if (d.optString("kind") == "pc") "PC" else "Phone"} · ${if (d.optString("key_hash").let { it.isNotBlank() && it != "null" }) "paired ${ago(d.optString("paired_at"))}" else "not paired yet"} · seen ${ago(d.optString("last_seen"))}")
            if (mine) Text("This device", color = LocalLux.current.gold, style = MaterialTheme.typography.labelLarge)
            if (!d.optBoolean("active", true)) Text("Switched off", color = LocalLux.current.bad, style = MaterialTheme.typography.labelLarge)
            else if (!mine) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton({ vm.makePairingCode(id) }) { Text("Make pairing code") }
                TextButton({ vm.switchOff(id) }) { Text("Switch off") }
            }
        }
    }
    item(key = "out") { TextButton({ vm.signOut() }) { Text("Sign out of this phone") } }
}

@Composable
fun Dialogs(vm: Lounge) {
    when (val d = vm.dialog) {
        is Lounge.Dialog.Merged -> AlertDialog(onDismissRequest = { vm.dialog = null },
            title = { Text("Already being worked on") },
            text = { Text("Coco found the same work already ${d.status}${d.device?.let { " on " + vm.deviceName(it) } ?: ""}, given by ${d.by}:\n\n${d.title}\n\nYour points were added to it, so nothing runs twice.") },
            confirmButton = { TextButton({ vm.dialog = null }) { Text("Good") } },
            dismissButton = { TextButton({ vm.stopTask(d.taskId, d.title); vm.dialog = null }) { Text("Stop that task") } })
        is Lounge.Dialog.PairCode -> AlertDialog(onDismissRequest = { vm.dialog = null },
            title = { Text("Pairing code for ${d.device}") },
            text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(d.code, style = MaterialTheme.typography.displaySmall, color = LocalLux.current.gold); Muted("Valid for 10 minutes. Type it on that device after signing in. It works once.") } },
            confirmButton = { TextButton({ vm.dialog = null }) { Text("Done") } })
        is Lounge.Dialog.AddPoints -> {
            var text by remember { mutableStateOf("") }
            AlertDialog(onDismissRequest = { vm.dialog = null }, title = { Text(d.title) },
                text = { OutlinedTextField(text, { text = it }, label = { Text("Your points") }, minLines = 3, modifier = Modifier.fillMaxWidth()) },
                confirmButton = { TextButton({ if (text.isNotBlank()) vm.addPoints(d.taskId, text.trim()); vm.dialog = null }) { Text("Add") } },
                dismissButton = { TextButton({ vm.dialog = null }) { Text("Cancel") } })
        }
        null -> {}
    }
}

@Composable
fun ToolChip(tl: JSONObject) {
    val lux = LocalLux.current
    val (bg, fg) = when (tl.optString("status")) { "connected", "installed" -> lux.goodC to lux.good; "to_install" -> lux.warnC to lux.warn; else -> MaterialTheme.colorScheme.surfaceContainerHigh to MaterialTheme.colorScheme.onSurface }
    Surface(color = bg, contentColor = fg, shape = RoundedCornerShape(8.dp)) { Text(tl.optString("name"), Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall) }
}

/** Settings: the same sections on every Lounge (account, device, notifications, appearance, motion, about). */
fun LazyListScope.settings(vm: Lounge) {
    item(key = "s-account") { Appear(0) { LuxCard {
        Eyebrow("Account"); Text("${vm.name} · ${vm.callMe}", style = MaterialTheme.typography.titleLarge); Muted(vm.cloud.email.orEmpty())
        OutlinedButton({ vm.signOut() }) { Text("Sign out") }
    } } }
    item(key = "s-device") { Appear(1) { LuxCard {
        val me = vm.data.devices.firstOrNull { it.optString("id") == vm.cloud.deviceId }
        Eyebrow("This device"); Text(me?.optString("name") ?: "This phone", style = MaterialTheme.typography.titleLarge)
        Muted("Paired ${ago(me?.optString("paired_at"))} · one of the four Good Space devices. Lost it? Switch it off from another device.")
        OutlinedButton({ vm.refreshNow() }) { Text("Refresh now") }
    } } }
    item(key = "s-notify") { Appear(2) { LuxCard {
        Eyebrow("Notifications")
        key(vm.notifyTick) {
            listOf("approvals" to "Approvals waiting for YES", "done" to "Tasks finished", "merged" to "Coco merged a task", "tasks" to "Tasks from the other founder", "rules" to "New rules").forEach { (k, label) ->
                Row(verticalAlignment = Alignment.CenterVertically) { Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f)); Switch(vm.notifyOn(k), { vm.setNotify(k, it) }) }
            }
        }
    } } }
    item(key = "s-look") { Appear(3) { LuxCard {
        Eyebrow("Appearance")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEachIndexed { i, (v, l) -> SegmentedButton(vm.theme == v, { vm.setTheme(v) }, SegmentedButtonDefaults.itemShape(i, 3)) { Text(l) } }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Calm motion", style = MaterialTheme.typography.bodyLarge); Muted("Fewer animations, everything else the same") }
            Switch(vm.calm, { vm.setCalm(it) })
        }
    } } }
    item(key = "s-about") { Appear(4) { LuxCard {
        Eyebrow("About"); Text("Coco Lounge 1.0 · Android", style = MaterialTheme.typography.titleLarge)
        Muted("Good Space, managed by Coco. Follows the Lounge Standard: the same screens, look and rules on all four devices. Private: founder login plus this device's key; keys and personal documents never pass through the app.")
    } } }
}