@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject

// ---------------------------------------------------------------- shared pieces of the redesigned pages

/** Material Symbols names from the contract, drawn with the matching material-icons-extended icon. */
fun sym(name: String): ImageVector = when (name) {
    "home" -> Icons.Rounded.Home; "space_dashboard" -> Icons.Rounded.SpaceDashboard; "apartment" -> Icons.Rounded.Apartment
    "schema" -> Icons.Rounded.Schema; "groups" -> Icons.Rounded.Groups; "diversity_3" -> Icons.Rounded.Diversity3
    "task_alt" -> Icons.Rounded.TaskAlt; "view_kanban" -> Icons.Rounded.ViewKanban; "sticky_note_2" -> Icons.Rounded.StickyNote2
    "verified" -> Icons.Rounded.Verified; "timeline" -> Icons.Rounded.Timeline; "auto_mode" -> Icons.Rounded.AutoMode
    "account_tree" -> Icons.Rounded.AccountTree; "account_balance" -> Icons.Rounded.AccountBalance; "psychology" -> Icons.Rounded.Psychology; "smart_toy" -> Icons.Rounded.SmartToy
    "insights" -> Icons.Rounded.Insights; "monitoring" -> Icons.Rounded.QueryStats; "bolt" -> Icons.Rounded.Bolt; "hub" -> Icons.Rounded.Hub
    "dashboard" -> Icons.Rounded.Dashboard; "security" -> Icons.Rounded.Security; "cloud" -> Icons.Rounded.Cloud; "devices" -> Icons.Rounded.Devices
    "gavel" -> Icons.Rounded.Gavel; "settings" -> Icons.Rounded.Settings; "tune" -> Icons.Rounded.Tune; "forum" -> Icons.Rounded.Forum
    "settings_remote" -> Icons.Rounded.SettingsRemote; "smart_display" -> Icons.Rounded.SmartDisplay; "terminal" -> Icons.Rounded.Terminal
    "menu_book" -> Icons.Rounded.AutoStories; "draw" -> Icons.Rounded.Draw; "school" -> Icons.Rounded.School
    "sports_esports" -> Icons.Rounded.SportsEsports; "storefront" -> Icons.Rounded.Storefront; "palette" -> Icons.Rounded.Palette
    else -> Icons.Rounded.Circle
}

/** Until Coco Cloud has answered once, nothing on a screen is current: say so rather than show zeros. */
@Composable
fun NotReadBanner(vm: Lounge) {
    if (vm.dataAt > 0L) return
    Surface(color = LocalCocoRoles.current.warningContainer, contentColor = LocalCocoRoles.current.onWarningContainer, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Row(Modifier.padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Rounded.CloudOff, null, Modifier.size(18.dp))
            Text("Not connected to Coco Cloud yet, so nothing on this screen is current. Missing numbers are not shown as zero.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** An empty-list sentence that is only true once the company has been read; before that it says so instead. */
fun Lounge.orNotRead(text: String) = if (dataAt == 0L) "Not read from Coco Cloud yet." else text

/** One list line: what, a muted second line, an optional chip, optionally tappable. */
@Composable
fun Line(head: String, sub: String? = null, chip: String? = null, chipText: String? = null, onClick: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.weight(1f)) {
            Text(head, style = MaterialTheme.typography.titleSmall, maxLines = 2)
            sub?.takeIf { it.isNotBlank() }?.let { Muted(it, 3) }
        }
        chip?.takeIf { it.isNotBlank() }?.let { StatusChip(it, chipText) }
        if (onClick != null) Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun SetupCard(what: String, table: String) = Card {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(Icons.Rounded.CloudOff, null, tint = MaterialTheme.colorScheme.onSurfaceVariant); Text("Not set up in Coco Cloud yet", style = MaterialTheme.typography.titleMedium)
    }
    Muted("$what ($table) is not available from Coco Cloud yet, so nothing is shown here. Nothing is estimated or filled in.")
}

/** A table read with its honest states: still reading, not set up, could not be read, or the rows. */
fun LazyListScope.table(vm: Lounge, key: String, what: String, tag: String = key, body: LazyListScope.(List<JSONObject>) -> Unit) {
    val r = vm.rows(key)
    when {
        !r.loaded -> item(key = "$tag-wait") { Muted("Reading $what from Coco Cloud…") }
        r.missing -> item(key = "$tag-missing") { SetupCard(what, key) }
        r.error != null -> item(key = "$tag-err") { Card { Text("$what could not be read right now", style = MaterialTheme.typography.titleMedium); Muted(r.error) } }
        else -> body(r.rows)
    }
}

/** A titled card of lines, capped so a phone never draws hundreds at once (and says so). */
fun LazyListScope.lines(key: String, title: String?, rows: List<JSONObject>, empty: String, cap: Int = 40, line: @Composable (JSONObject) -> Unit) {
    item(key = key) {
        Card {
            title?.let { Eyebrow(it) }
            if (rows.isEmpty()) Muted(empty)
            rows.take(cap).forEach { line(it) }
            if (rows.size > cap) Muted("Showing $cap of ${rows.size}.")
        }
    }
}

@Composable
fun Kpi(value: String, label: String, sub: String?, modifier: Modifier = Modifier, warn: Boolean = false, onClick: (() -> Unit)? = null) {
    PanelSurface(modifier.clip(RoundedCornerShape(16.dp)).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            Text(value, style = if (value.length > 9) MaterialTheme.typography.titleMedium else MaterialTheme.typography.headlineSmall, color = if (warn) LocalCocoRoles.current.warning else MaterialTheme.colorScheme.onSurface, maxLines = 2)
            sub?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2) }
        }
    }
}

private fun num(v: Any?): String = (v as? Number)?.toDouble()?.let(Facts::number) ?: v?.toString()?.toDoubleOrNull()?.let(Facts::number) ?: "—"
private fun money(v: Double) = "$" + "%.2f".format(java.util.Locale.US, v)
private fun JSONObject.d(k: String) = optString(k).toDoubleOrNull() ?: 0.0

/** "as of" for a stamp: a bare day stays a day, a timestamp becomes "3 h ago". */
fun asOf(s: String?): String = when { s.isNullOrBlank() -> "unknown"; s.length <= 10 -> s; else -> ago(s) }

/** The revenue headline for a scope, or the honest reason there is none (still reading, not served by Coco Cloud). */
fun revenueOf(met: Lounge.Rows, rows: List<JSONObject>): Facts.Headline = when {
    !met.loaded -> Facts.Headline("reading", "…", null, emptyList())
    met.error != null -> Facts.Headline(Facts.UNAVAILABLE, "Unavailable", null, emptyList())
    else -> Facts.revenue(rows)
}
fun revenueNote(met: Lounge.Rows, h: Facts.Headline): String = when {
    !met.loaded -> "Reading business metrics…"
    met.error != null -> if (met.missing) "Not connected: business metrics (org_metrics) are not served by Coco Cloud yet. Nothing is estimated or shown as zero."
        else "Business metrics could not be read right now: ${met.error}"
    h.state == Facts.UNAVAILABLE -> "No revenue is recorded in Coco for this. Nothing is estimated or shown as zero."
    h.state == Facts.NONE_IN_PERIOD -> "Revenue was recorded before, but none in the last ${Facts.DAYS} days · latest ${asOf(h.latest)}"
    else -> "Last ${Facts.DAYS} days · ${h.state} · source ${h.sources.joinToString().ifBlank { "unknown" }} · as of ${asOf(h.latest)}"
}

/** One measure: its name, the number (or why there is none), and where it came from. */
@Composable
fun Measure(label: String, h: Facts.Headline) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label.replace('_', ' ').replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.titleSmall)
            if (h.state !in setOf(Facts.UNAVAILABLE, Facts.NONE_IN_PERIOD, "reading")) Muted("${h.state} · ${h.sources.joinToString().ifBlank { "unknown source" }} · ${asOf(h.latest)}", 2)
        }
        Text(h.text, style = MaterialTheme.typography.titleSmall, color = if (h.state in setOf(Facts.UNAVAILABLE, Facts.NONE_IN_PERIOD)) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
    }
}
private val OPEN_TASK = setOf("queued", "running", "working", "waiting_pc", "needs_yes", "need_approval", "blocked", "verifying")

/** Every page id the contract names, drawn on Android (NavContract.ANDROID_PAGES must list the same ids). */
fun LazyListScope.page(vm: Lounge, nav: NavContract, id: String, go: (String) -> Unit, openHouse: (String) -> Unit, teamHouse: String, pickTeamHouse: (String) -> Unit, onMember: (String) -> Unit) {
    when (id) {
        "home" -> home(vm, nav, go, openHouse, onMember)
        "houses" -> allHouses(vm, nav, openHouse)
        "company" -> organization(vm)
        "structure" -> structure(vm)
        "teams" -> teams(vm, teamHouse, pickTeamHouse)
        "club" -> club(vm)
        "board" -> board(vm)
        "notes" -> notes(vm)
        "approvals" -> approvals(vm)
        "runs" -> runs(vm)
        "automation" -> automation(vm)
        "workflows" -> workflows(vm)
        "hierarchy" -> hierarchy(vm)
        "brain" -> brain(vm)
        "agents" -> agents(vm)
        "insights" -> insights(vm, nav)
        "ai" -> aiUsage(vm)
        "connections" -> connections(vm)
        "control" -> controlCenter(vm, go)
        "system" -> system(vm)
        "cloud" -> cloudWorkers(vm)
        "devices" -> devices(vm)
        "remote" -> remote(vm)
        "rules" -> rules(vm)
        "settings" -> settings(vm, go)
        "themes" -> appearance(vm)
        else -> item(key = "nope") { Muted("This page is not on Android yet.") }
    }
}

// ---------------------------------------------------------------- HOME: revenue first, the Houses, live operations
fun LazyListScope.home(vm: Lounge, nav: NavContract, go: (String) -> Unit, openHouse: (String) -> Unit, onMember: (String) -> Unit) {
    val d = vm.data
    val waiting = d.approvals.count { it.s("state") == "waiting" }
    item(key = "hero") {
        Appear(0) {
            Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.primaryContainer, contentColor = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    LivingMark(Marks.coco, 52.dp)
                    Column(Modifier.weight(1f)) {
                        val hour = remember(rememberTicker(60_000L)) { java.time.LocalTime.now().hour }
                        Text(greeting(hour, vm.callMe), style = MaterialTheme.typography.headlineSmall)
                        Text(if (vm.dataAt == 0L) "Coco Cloud has not answered yet, so nothing is shown rather than guessed." else if (d.paused) "Coco is paused. Nothing new starts until you resume."
                            else if (waiting > 0) "$waiting things need your YES." else "Everything is moving. Nothing needs you.", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
    // Revenue first, with the honesty rule: missing is "Unavailable", never 0
    item(key = "kpis") {
        val met = vm.rows("org_metrics"); val yt = vm.rows("yt").rows.firstOrNull()
        val rev = revenueOf(met, met.rows)
        val revSub = when {
            !met.loaded -> "reading…"
            met.error != null -> "not connected"
            rev.state == Facts.UNAVAILABLE -> "nothing recorded"
            rev.state == Facts.NONE_IN_PERIOD -> "none in the last ${Facts.DAYS} days"
            else -> "${Facts.DAYS} days · ${rev.state} · ${asOf(rev.latest)}"
        }
        val views = yt?.optJSONObject("channel")?.optString("views")?.toDoubleOrNull()
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
            Kpi(rev.text, "Revenue", revSub, Modifier.weight(1f), onClick = { go("insights") })
            Kpi(if (views == null) "Unavailable" else Facts.number(views), "YouTube views", if (vm.rows("yt").error != null) "unavailable right now" else yt?.s("label")?.ifBlank { null } ?: "reading…", Modifier.weight(1f), onClick = { go("insights") })
            val known = vm.dataAt > 0L
            Kpi(if (known) "$waiting" else "Unavailable", "Waiting for YES", if (known) "approvals" else "not read yet", Modifier.weight(1f), warn = waiting > 0) { go("approvals") }
            Kpi(if (known) "${d.tasks.count { it.s("status") in OPEN_TASK }}" else "Unavailable", "Open tasks", if (known) "${d.tasks.count { it.s("status") in setOf("running", "working") }} running" else "not read yet", Modifier.weight(1f)) { go("board") }
        }
    }
    item(key = "ops") {
        Card {
            Eyebrow("Live operations")
            val jobs = vm.rows("jobs")
            if (!jobs.loaded) Muted("Reading the job queue…")
            else if (jobs.error != null) Line("Cloud job queue", if (jobs.missing) "Not set up in Coco Cloud yet" else "Could not be read right now: ${jobs.error}", onClick = { go("cloud") })
            else Facts.countBy(jobs.rows).let { c ->
                val failed = Facts.recentFailed(jobs.rows).size; val blocked = c["blocked"] ?: 0
                Line("Cloud jobs", "${c["running"] ?: 0} running · ${c["queued"] ?: 0} queued · $blocked blocked · $failed failed in 3 days",
                    if (failed > 0) "failed" else if (blocked > 0) "blocked" else "running", if (failed + blocked > 0) null else "Healthy") { go("cloud") }
            }
            if (vm.dataAt == 0L) { Line("Tasks, approvals and the cloud worker", "Not read from Coco Cloud yet"); return@Card }
            d.devices.firstOrNull { it.s("id").contains("cloud-worker") }.let { w ->
                Line("Cloud worker", if (w == null) "No cloud worker device is paired" else "last seen ${ago(w.s("last_seen"))}",
                    if (w == null) null else if (online(w)) "live" else "off", if (w == null) null else if (online(w)) "Online" else "Offline") { go("cloud") }
            }
            val pending = d.tasks.filter { it.s("status") in setOf("queued", "waiting_pc", "needs_yes", "blocked") }
            Line("Pending tasks", pending.take(2).joinToString(" · ") { it.s("title") }.ifBlank { "None" }, if (pending.isEmpty()) null else "queued", "${pending.size}") { go("board") }
            Line("Approvals waiting", d.approvals.filter { it.s("state") == "waiting" }.take(2).joinToString(" · ") { "${it.s("code")} ${it.s("what").take(40)}" }.ifBlank { "All clear" },
                if (waiting > 0) "waiting" else null, "$waiting") { go("approvals") }
            vm.rows("runs").rows.firstOrNull()?.let { r -> Line("Latest run: ${r.s("title").ifBlank { r.s("kind") }}", ago(r.s("opened_at")), r.s("status")) { go("runs") } }
        }
    }
    item(key = "housesh") { Section("Houses") }
    item(key = "houses") { HouseGrid(vm, nav, openHouse) }
    item(key = "hq") { Appear(1) { CocoHQ(vm, onMember) } }
    val myPc = d.devices.filter { it.s("kind") == "pc" && it.s("id") != vm.cloud.deviceId && it.optBoolean("active", true) }
        .sortedWith(compareBy({ !online(it) }, { !it.s("id").startsWith(vm.cloud.deviceId?.substringBefore('-') ?: "~") })).firstOrNull()
    if (myPc != null) item(key = "quick") { CommandBar(vm, myPc, "Tell ${myPc.s("name")}") }
    val upcoming = d.events.filter { it.s("status") in setOf("planned", "waiting_yes", "late") }.sortedBy { it.s("due_at") }
    item(key = "nexth") { Section("Next up") }
    if (upcoming.isEmpty()) item(key = "nexte") { Muted("Nothing planned yet.") }
    items(upcoming.take(5), key = { "ev-" + it.s("id") }) { e -> EventRow(vm, e) }
    val talk = TalkRules.talk(d.agentMessages, d.activity, d.members)
    item(key = "talkh") { Section("Team talk") }
    if (talk.isEmpty()) item(key = "talke") { Muted("Quiet right now. The team's messages to each other show here, live, as they work.") }
    items(talk.take(14), key = { "talk-" + it.atIso + "-" + it.from }) { t -> TalkRow(vm, t) }
}

/** The seven Houses with their contract identity (colour, icon, label) and live state from Coco Cloud. */
@Composable
fun HouseGrid(vm: Lounge, nav: NavContract, openHouse: (String) -> Unit) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
        nav.houses.forEach { h ->
            val live = vm.data.houses.firstOrNull { it.s("id") == h.id }
            val tasks = vm.data.tasks.count { it.s("house_id") == h.id && it.s("status") in OPEN_TASK }
            val units = Facts.forHouse(h.id, vm.rows("org_units").rows, listOf("id")).size
            PanelSurface(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).clickable { openHouse(h.id) }) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(40.dp).background(Color(h.color), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) { Icon(sym(h.icon), null, tint = Color.White) }
                    Text(h.label, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                    Muted(listOfNotNull(live?.s("state")?.ifBlank { null }, if (vm.dataAt > 0L) "$tasks open" else "not read yet", if (units > 0) "$units units" else null).joinToString(" · "), 1)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- HOUSES section
fun LazyListScope.allHouses(vm: Lounge, nav: NavContract, openHouse: (String) -> Unit) {
    item(key = "ahnote") { Muted("Seven Houses, one company. Tap a House for its workspace.") }
    item(key = "ahgrid") { HouseGrid(vm, nav, openHouse) }
    lines("ahlive", "What each House is doing", nav.houses.mapNotNull { h -> vm.data.houses.firstOrNull { it.s("id") == h.id } }, vm.orNotRead("Coco Cloud has no live House status yet.")) { live ->
        Line(nav.house(live.s("id"))?.label ?: live.s("name"), live.s("doing").ifBlank { live.s("role") }, live.s("state")) { openHouse(live.s("id")) }
    }
}

fun LazyListScope.organization(vm: Lounge) {
    item(key = "orgnote") { Muted("The company as Coco Cloud holds it: who leads each part, what it holds, and the latest decisions.") }
    table(vm, "org_units", "The company structure") { units ->
        val agents = vm.rows("org_agents").rows
        item(key = "orgstats") {
            val c = Facts.countBy(units, "kind")
            Card { Eyebrow("Company structure"); Muted("${units.size} units · " + c.entries.sortedByDescending { it.value }.joinToString(" · ") { "${it.value} ${it.key}" }) }
        }
        lines("orgheads", "Who leads", units.filter { it.s("kind") == "house" || it.s("id") in setOf("coco", "core") }.sortedBy { it.optInt("sort") }, "No Houses in the organisation yet.") { u ->
            val head = agents.firstOrNull { it.s("unit_id") == u.s("id") && it.s("role") == "head" }
            val under = if (u.s("kind") == "house") units.count { Facts.inHouse(u.s("id"), it.s("id")) } - 1 else null
            Line(u.s("display_name").ifBlank { u.s("id") }, listOfNotNull(when { head == null -> "No head recorded"; head.s("status") == "placeholder" -> "Head not assigned"
                    else -> "Head ${head.s("registry_agent").ifBlank { head.s("name") }}${if (head.s("status") == "proposed") " (proposed)" else ""}" }, under?.let { "$it units under it" }).joinToString(" · "),
                if (u.s("state") == "active") "live" else "planned", if (u.s("state") == "active") "Active" else "Planned")
        }
    }
    lines("decisions", "Latest decisions", vm.data.decisions.take(12), vm.orNotRead("No decisions recorded yet.")) { Line(it.s("text"), "${it.s("decided_on")} · ${it.s("by_name")}") }
}

fun LazyListScope.structure(vm: Lounge) {
    item(key = "stnote") { Muted("The organisation tree as Coco Cloud holds it. Adding or moving teams is done on the desktop Lounge.") }
    table(vm, "org_units", "The company structure") { units ->
        val products = vm.rows("org_products").rows
        units.filter { it.s("kind") == "house" || it.s("id") in setOf("coco", "core") }.sortedBy { it.optInt("sort") }.forEach { top ->
            val id = top.s("id")
            val under = units.filter { Facts.inHouse(id, it.s("id")) && it.s("id") != id }
            lines("st-$id", top.s("display_name").ifBlank { id }, under.filter { it.s("kind") in setOf("team", "subteam", "group") }.sortedBy { it.s("id") },
                if (id == "coco") "The company root." else "No teams under it yet.") { u ->
                val depth = u.s("id").count { it == '.' }
                val cats = units.count { it.s("parent_id") == u.s("id") && it.s("kind") == "category" }
                Box(Modifier.padding(start = (12 * (depth - 1).coerceAtLeast(0)).dp)) {
                    Line(u.s("display_name").ifBlank { u.s("id") }, listOfNotNull(u.s("kind"), cats.takeIf { it > 0 }?.let { "$it categories" },
                        products.count { p -> Facts.inHouse(u.s("id"), p.s("unit_id")) }.takeIf { it > 0 }?.let { "$it channels/products" }).joinToString(" · "),
                        if (u.s("state") == "active") "live" else "planned", if (u.s("state") == "active") "Active" else "Planned")
                }
            }
        }
    }
}

fun LazyListScope.club(vm: Lounge) {
    val d = vm.data
    listOf("Think", "Make", "Care").forEach { g ->
        val ms = d.members.filter { it.s("grp") == g }
        if (ms.isNotEmpty()) lines("club-$g", g, ms, "") { m ->
            val tools = d.memberTools.filter { it.s("member_id") == m.s("id") }.mapNotNull { t -> d.tools.firstOrNull { it.s("id") == t.s("tool_id") }?.s("name") }
            val hs = d.memberHouses.filter { it.s("member_id") == m.s("id") }.map { x -> vm.houseName(x.s("house_id")) }
            Line(m.s("name"), listOfNotNull(m.s("job"), hs.takeIf { it.isNotEmpty() }?.let { "Helps: " + it.joinToString() }, tools.takeIf { it.isNotEmpty() }?.joinToString()).joinToString(" · "), null)
        }
    }
    if (d.members.none { it.s("grp") in setOf("Think", "Make", "Care") }) lines("club-all", "People", d.members, vm.orNotRead("No people recorded yet.")) { m -> Line(m.s("name"), m.s("job")) }
    lines("club-tools", "Tools", d.tools, vm.orNotRead("No tools recorded yet.")) { t -> Line(t.s("name"), t.s("kind").ifBlank { t.s("what") }, t.s("status").let { if (it == "installed") "connected" else it }) }
}

// ---------------------------------------------------------------- WORK section
fun LazyListScope.notes(vm: Lounge) {
    item(key = "noteform") {
        var text by remember { mutableStateOf("") }
        Card {
            Text("Drop a thought or a link", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(text, { text = it }, label = { Text("An idea, a plan, or a YouTube / Instagram / Pinterest link") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            MuButton({ vm.addNote(text.trim()); text = "" }, enabled = text.isNotBlank()) { Icon(Icons.Rounded.Add, null); Spacer(Modifier.width(6.dp)); Text("Keep it") }
            Muted("Links are spotted by themselves. Coco studies every new card and writes what it could become for Good Space.")
        }
    }
    table(vm, "notes", "Notes") { all ->
        val rows = all.filter { it.s("status") != "archived" }.sortedWith(compareByDescending<JSONObject> { it.optBoolean("pinned") }.thenByDescending { it.s("created_at") })
        if (rows.isEmpty()) item(key = "notes-empty") { Muted("Nothing kept yet. Write the first one above.") }
        items(rows.take(80), key = { "note-" + it.s("id") }) { n ->
            val ctx = LocalContext.current
            Card {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(when (n.s("kind")) { "link" -> Icons.Rounded.Link; "idea" -> Icons.Rounded.Lightbulb; "plan" -> Icons.Rounded.Map; else -> Icons.Rounded.StickyNote2 }, null, tint = LocalCocoRoles.current.link)
                    StatusChip(n.s("status")); if (n.optBoolean("pinned")) StatusChip("pinned", "Pinned"); Spacer(Modifier.weight(1f)); Muted(ago(n.s("created_at")))
                }
                n.s("title").takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.titleMedium) }
                Text(n.s("text"), style = MaterialTheme.typography.bodyMedium)
                n.s("source_url").takeIf { it.startsWith("http") }?.let { u -> TextButton({ ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) }) { Text(u, maxLines = 1) } }
                n.s("analysis").takeIf { it.isNotBlank() }?.let { Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp)) { Text(it, Modifier.padding(10.dp), style = MaterialTheme.typography.bodySmall) } }
            }
        }
        if (rows.isNotEmpty()) item(key = "notes-ro") { Muted("Pin, edit, archive and Make it a plan are on the desktop Lounge for now.") }
    }
}

fun LazyListScope.runs(vm: Lounge) {
    table(vm, "runs", "Runs") { runs ->
        val events = vm.rows("run_events").rows
        item(key = "runsum") { Card { Text("${runs.size} operation${if (runs.size == 1) "" else "s"}", style = MaterialTheme.typography.titleMedium); Muted("Every run with its steps, newest first. Tap one to see its trace.") } }
        if (runs.isEmpty()) item(key = "runs-empty") { Muted("No runs yet.") }
        items(runs, key = { "run-" + it.s("run_id").ifBlank { it.s("id") } }) { r ->
            var open by remember { mutableStateOf(false) }
            val id = r.s("run_id").ifBlank { r.s("id") }
            Card(Modifier.clickable { open = !open }) {
                Line(r.s("title").ifBlank { r.s("kind") }, listOfNotNull(r.s("kind"), id, ago(r.s("opened_at")), r.optLong("tokens").takeIf { it > 0 }?.let { "${Facts.number(it.toDouble())} tokens" }).joinToString(" · "), r.s("status"))
                r.s("result").takeIf { it.isNotBlank() }?.let { Muted("Result: $it", 3) }
                if (open) {
                    val mine = events.filter { it.s("run_id") == id }
                    if (mine.isEmpty()) Muted("No events recorded for this run.")
                    mine.take(30).forEach { e -> Muted("${e.s("type")} ${e.s("text")} · ${ago(e.s("at"))}${e.s("agent").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}", 2) }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- AUTOMATION section
fun LazyListScope.automation(vm: Lounge) {
    item(key = "autnote") { Card { Eyebrow("Read-only on the phone"); Muted("Templates and prompt instructions as Coco Cloud holds them. Editing, testing and publishing them is on the desktop Lounge for now.") } }
    table(vm, "templates", "Automation templates") { ts ->
        lines("aut-t", "Templates (${ts.size})", ts, "No templates yet.") { t ->
            Line(t.s("name"), listOfNotNull(t.s("kind"), t.s("platform_id").ifBlank { null }, "v${t.s("current_version")}", "${t.optInt("assignments")} in use",
                t.s("owner_unit_id").ifBlank { t.s("owner_product_id") }.ifBlank { null }, "updated ${ago(t.s("updated_at"))}").joinToString(" · "),
                when (t.s("status")) { "active" -> "live"; "paused" -> "waiting"; "archived" -> "off"; else -> "planned" }, t.s("status").replaceFirstChar { it.uppercase() })
        }
    }
    table(vm, "prompts", "Prompt instructions") { ps ->
        lines("aut-p", "Prompt instructions (${ps.size})", ps, "No prompt instructions yet.") { p ->
            Line(p.s("name"), listOfNotNull(p.s("kind"), p.s("description").take(80).ifBlank { null }, "active v${p.s("active_version").ifBlank { "–" }}", "updated ${ago(p.s("updated_at"))}").joinToString(" · "),
                if (p.s("status") == "active") "live" else "planned", p.s("status").replaceFirstChar { it.uppercase() })
        }
    }
}

fun LazyListScope.workflows(vm: Lounge) {
    val pol = vm.rows("policies").rows.filter { it.s("scope") == "workflow" && it.s("key") == "enabled" }
    lines("wf", "Workflows (${vm.data.pipelines.size})", vm.data.pipelines, vm.orNotRead("No workflows recorded yet.")) { p ->
        val steps = runCatching { org.json.JSONArray(p.s("steps")) }.getOrNull()
        val chain = steps?.let { (0 until it.length()).joinToString(" → ") { i -> it.optJSONObject(i)?.let { st -> st.s("who").ifBlank { st.s("member").ifBlank { st.s("id") } } } ?: it.optString(i) } }
        val off = pol.firstOrNull { it.s("scope_id") == p.s("id") }?.optBoolean("value", true) == false
        Line(p.s("name").ifBlank { p.s("id") }, listOfNotNull(vm.houseName(p.s("house_id")), chain).joinToString(" · "),
            if (!p.optBoolean("active", true) || off) "off" else "live", if (!p.optBoolean("active", true) || off) "Off" else "On")
    }
    item(key = "wfnote") { Muted("Switching a workflow on or off is on the desktop Lounge (it asks for a YES where needed).") }
}

// ---------------------------------------------------------------- BRAINS & AGENTS
fun LazyListScope.brain(vm: Lounge) {
    item(key = "brh") { Section("Growth brains") }
    table(vm, "brain_records_latest", "The growth brains") { recs ->
        val goals = recs.filter { it.s("rec") == "goal" }
        lines("br-goals", "Goals (${goals.size})", goals, "No goals recorded yet.") { g ->
            val dd = g.optJSONObject("data")
            Line(dd?.s("title")?.ifBlank { null } ?: g.s("id"), listOfNotNull(g.s("brain_id"), dd?.let { x -> x.s("target").takeIf { it.isNotBlank() }?.let { "target $it ${x.s("unit")}" } }, ago(g.s("at"))).joinToString(" · "),
                if (g.s("status") == "confirmed") "approved" else g.s("status"))
        }
        val esc = recs.filter { it.s("rec") == "escalation" && it.s("status") == "open" }
        lines("br-esc", "Waiting for a founder (${esc.size})", esc, "Nothing.") { e -> Line(e.optJSONObject("data")?.optJSONObject("action")?.s("title")?.ifBlank { null } ?: e.s("id"), "${e.s("brain_id")} · since ${ago(e.s("at"))}", "needs_yes") }
    }
    item(key = "bmh") { Section("Memory") }
    table(vm, "brain_items", "The company memory") { items ->
        lines("br-mem", "${items.size} things the company knows", items, "The Brain is empty.") { i ->
            Line(i.s("title"), listOfNotNull(i.s("kind"), i.s("team_id").ifBlank { "company" }, i.s("visibility"), i.s("source").ifBlank { i.s("created_by") }.ifBlank { null }, ago(i.s("created_at"))).joinToString(" · "))
        }
    }
}

fun LazyListScope.hierarchy(vm: Lounge) {
    table(vm, "org_brains", "The Brain hierarchy") { rows ->
        val units = vm.rows("org_units").rows.associateBy { it.s("id") }; val products = vm.rows("org_products").rows.associateBy { it.s("id") }
        fun name(b: JSONObject) = units[b.s("unit_id")]?.s("display_name")?.ifBlank { null } ?: products[b.s("product_id")]?.s("name")?.ifBlank { null } ?: b.s("id")
        val kids = rows.groupBy { it.s("parent_brain_id") }
        val ordered = mutableListOf<Pair<JSONObject, Int>>(); val seen = mutableSetOf<String>()
        fun walk(b: JSONObject, depth: Int) { if (!seen.add(b.s("id"))) return; ordered += b to depth; kids[b.s("id")].orEmpty().sortedBy(::name).forEach { walk(it, depth + 1) } }
        rows.filter { it.s("parent_brain_id").isBlank() }.sortedBy { if (it.s("level") == "global") 0 else 1 }.forEach { walk(it, 0) }
        rows.filter { it.s("id") !in seen }.forEach { walk(it, 0) }   // a Brain whose parent is missing still shows, at the top
        item(key = "hsum") { Card { Text("${rows.size} Brains", style = MaterialTheme.typography.titleMedium)
            Muted("Each Brain sees its own level and everything below it; siblings and other Houses are isolated. This view reads state only and starts nothing.") } }
        if (rows.isEmpty()) item(key = "hempty") { Muted("No Brain is registered yet.") }
        items(ordered, key = { "hb-" + it.first.s("id") }) { (b, depth) ->
            Box(Modifier.padding(start = (14 * depth.coerceAtMost(6)).dp)) {
                Line(name(b), listOfNotNull(b.s("level"), b.s("health").ifBlank { null }?.let { "health $it" }, kids[b.s("id")]?.size?.let { "$it below" },
                        b.s("last_activity_at").ifBlank { null }?.let { "active ${ago(it)}" }).joinToString(" · "),
                    when (b.s("state")) { "active" -> "live"; "paused" -> "waiting"; else -> b.s("state") }, b.s("state").replaceFirstChar { it.uppercase() })
            }
        }
    }
}

fun LazyListScope.agents(vm: Lounge) {
    table(vm, "org_agents", "Agents") { ags ->
        val units = vm.rows("org_units").rows.associateBy { it.s("id") }
        item(key = "agsum") { Card { Text("${ags.size} agents", style = MaterialTheme.typography.titleMedium); Muted("${ags.count { it.s("status") == "placeholder" }} heads still to assign · changing models and budgets is on the desktop Lounge") } }
        ags.groupBy { it.s("unit_id").substringBefore('.') }.toSortedMap().forEach { (top, list) ->
            lines("ag-$top", units[top]?.s("display_name")?.ifBlank { null } ?: top, list.sortedBy { it.s("unit_id") }, "") { a ->
                Line(a.s("name").ifBlank { a.s("registry_agent") }, listOfNotNull(units[a.s("unit_id")]?.s("short_name")?.ifBlank { null } ?: a.s("unit_id"), a.s("role"), a.s("registry_agent").ifBlank { null }).joinToString(" · "),
                    when (a.s("status")) { "placeholder" -> "waiting"; "proposed" -> "planned"; else -> "approved" },
                    when (a.s("status")) { "placeholder" -> "Placeholder"; "proposed" -> "Proposed"; else -> "Confirmed" })
            }
        }
    }
}

// ---------------------------------------------------------------- INSIGHTS
fun LazyListScope.insights(vm: Lounge, nav: NavContract) {
    val met = vm.rows("org_metrics"); val products = vm.rows("org_products").rows
    item(key = "revco") {
        val h = revenueOf(met, met.rows)
        Card { Eyebrow("Company revenue · last ${Facts.DAYS} days"); Text(h.text, style = MaterialTheme.typography.headlineSmall); Muted(revenueNote(met, h)) }
    }
    item(key = "yt") {
        val r = vm.rows("yt"); val y = r.rows.firstOrNull()
        Card {
            Eyebrow("YouTube · The Flow")
            if (!r.loaded) Muted("Reading…")
            else if (y == null) Muted("YouTube analytics are unavailable right now${r.error?.let { ": $it" } ?: ""}.")
            else {
                val ch = y.optJSONObject("channel")
                val views = ch?.optString("views")?.toDoubleOrNull(); val subs = ch?.optString("subscribers")?.toDoubleOrNull()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(if (views == null && subs == null) "Not collected yet" else "${views?.let(Facts::number) ?: "Unavailable"} views · ${subs?.let(Facts::number) ?: "Unavailable"} subscribers", style = MaterialTheme.typography.titleMedium)
                        Muted("Lifetime totals · source yt_stats in Coco Cloud · ${y.s("collected_at").ifBlank { "never collected" }.take(16).replace('T', ' ')}")
                    }
                    StatusChip(if (y.optBoolean("stale", true)) "late" else "live", y.s("label").ifBlank { if (y.optBoolean("stale", true)) "Stale" else "Fresh" })
                }
            }
        }
    }
    item(key = "insh") { Section("Performance by House") }
    nav.houses.forEach { h ->
        item(key = "ins-${h.id}") {
            val mine = Facts.metricsOf(h.id, met.rows, products)
            Card {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(32.dp).background(Color(h.color), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Icon(sym(h.icon), null, tint = Color.White, modifier = Modifier.size(18.dp)) }
                    Text(h.label, style = MaterialTheme.typography.titleMedium)
                }
                if (!met.loaded) Muted("Reading…")
                else if (met.error != null) Muted(if (met.missing) "Unavailable: business metrics are not served by Coco Cloud yet." else "Unavailable right now: ${met.error}")
                else (h.metrics.filter { it != "revenue" }.map { it to Facts.headline(mine, setOf(it.lowercase())) } + ("revenue" to Facts.revenue(mine))).forEach { (m, hd) -> Measure(m, hd) }
            }
        }
    }
    item(key = "insnote") { Muted("Each House shows only the measures that apply to it, over the last ${Facts.DAYS} days. Currencies are never added together and estimates are never shown as actuals.") }
}

fun LazyListScope.aiUsage(vm: Lounge) {
    table(vm, "ai_calls", "AI usage") { calls ->
        item(key = "aisum") {
            val tokens = calls.sumOf { it.d("total_tokens") }; val cost = calls.sumOf { it.d("cost") }
            Card {
                Text("${calls.size} Claude calls · ${Facts.number(tokens)} tokens · ${money(cost)}", style = MaterialTheme.typography.titleMedium)
                Muted("The latest ${calls.size} calls Coco Cloud recorded. ${calls.count { it.s("status") == "blocked" }} refused or blocked · ${calls.count { it.opt("verified") == false }} unverified.")
            }
        }
        listOf("model" to "By model", "agent_id" to "By agent", "team_id" to "By team").forEach { (k, title) ->
            val roll = calls.groupBy { it.s(k).ifBlank { "none" } }.map { (key, cs) -> Triple(key, cs.size, cs.sumOf { it.d("total_tokens") } to cs.sumOf { it.d("cost") }) }.sortedByDescending { it.third.first }
            item(key = "ai-$k") { Card { Eyebrow(title); if (roll.isEmpty()) Muted("No Claude spend yet."); roll.take(8).forEach { (key, n, tc) -> Line(key, "$n calls · ${Facts.number(tc.first)} tokens · ${money(tc.second)}") } } }
        }
        lines("ai-calls", "Latest calls", calls, "No Claude calls yet.", cap = 30) { c ->
            Line(c.s("purpose").ifBlank { "no purpose" }, listOfNotNull(c.s("agent_id").ifBlank { null }, c.s("model").ifBlank { null }, "${num(c.opt("total_tokens"))} tokens", money(c.d("cost")), ago(c.s("at"))).joinToString(" · "), c.s("status"))
        }
    }
}

// ---------------------------------------------------------------- CONNECTIONS
fun LazyListScope.connections(vm: Lounge) {
    val d = vm.data
    item(key = "cnote") { Muted("Can the cloud use this account with every PC switched off? Credentials are never shown on any device; only where they live.") }
    table(vm, "integration_accounts", "Connected accounts") { accounts ->
        val links = vm.rows("integration_links").rows
        val providers = (d.integrations.map { it.s("id") } + accounts.map { it.s("provider") }).filter { it.isNotBlank() }.distinct()
        if (providers.isEmpty()) item(key = "c-empty") { Muted("No connections listed yet.") }
        providers.forEach { pid ->
            val integ = d.integrations.firstOrNull { it.s("id") == pid }
            val mine = accounts.filter { it.s("provider") == pid }
            item(key = "conn-$pid") {
                val ctx = LocalContext.current
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        NetLogo(LOGO_DOMAINS[pid], 28.dp); Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) { Text(integ?.s("platform")?.ifBlank { null } ?: pid, style = MaterialTheme.typography.titleMedium); integ?.let { Muted(it.s("error").ifBlank { it.s("next_action") }, 2) } }
                        integ?.let { StatusChip(it.s("state")) }
                    }
                    if (mine.isEmpty()) Muted("No account added for this platform.")
                    mine.forEach { c ->
                        val ref = c.s("secret_ref")
                        // a vault reference is a name; a path is a file on one PC that no cloud run can open (same test as the web)
                        val held = when { ref.isBlank() -> "No credential stored"; Regex("[\\\\/~.]").containsMatchIn(ref) -> "Credential only on one PC — the cloud cannot use it"; else -> "Credential held in the cloud vault" }
                        val l = links.firstOrNull { it.s("connection_id") == c.s("connection_id") }
                        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Line(c.s("external_name").ifBlank { c.s("account_label").ifBlank { c.s("connection_id") } },
                                listOf(held, l?.let { listOf("team_id", "subteam_id", "category_id", "channel_id").mapNotNull { k -> it.s(k).ifBlank { null } }.joinToString(" › ") }?.ifBlank { null } ?: "Not assigned yet",
                                    if (c.s("last_verified_at").isBlank()) "never checked against the platform" else "checked ${ago(c.s("last_verified_at"))}").joinToString(" · "), c.s("state"))
                            if (pid in setOf("youtube", "gumroad")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                MuTonal({ vm.oauthBegin(pid, c.s("connection_id")) { u -> ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u))) } }) { Text(if (held.startsWith("Credential held")) "Reconnect" else "Connect") }
                                TextButton({ vm.oauthVerify(c.s("connection_id")) }) { Text("Verify") }
                            }
                        }
                    }
                    if (mine.isNotEmpty() && pid !in setOf("youtube", "gumroad")) Muted("Coco cannot connect or check ${integ?.s("platform") ?: pid} from the cloud yet.")
                    // the hub's per-account authorization facts (0041); never a credential
                    d.accounts.filter { it.s("provider") == pid }.forEach { a -> Muted("${a.s("external_name")}: ${accountFacts(a)}", 3) }
                }
            }
        }
        item(key = "c-more") { Muted("Assign, disconnect and adding a new account are on the desktop Lounge for now.") }
    }
    item(key = "provh") { Section("Cloud providers") }
    item(key = "prov") {
        var armed by remember { mutableStateOf("") }   // approve / roll back need a second tap
        Card {
            if (vm.dataAt == 0L) Muted("Not read from Coco Cloud yet.") else if (d.cloudProviders.isEmpty()) Muted("No cloud providers are registered yet.")
            d.cloudProviders.forEach { p -> Line(p.s("label"), "${p.s("capability")} · ${p.s("role")}", p.s("state")) }
            d.switches.forEach { s ->
                val id = s.s("id"); val st = s.s("state")
                Column(Modifier.padding(top = 8.dp)) {
                    Text("${s.s("capability")}: ${s.s("from_provider").ifBlank { "none" }} → ${s.s("to_provider")}", style = MaterialTheme.typography.titleSmall)
                    Muted("${st.replace('_', ' ')} · backup ${if (s.optBoolean("backup_verified")) "verified" else "NOT verified"}", 2)
                    Row {
                        if (st == "validated" && s.optBoolean("backup_verified"))
                            TextButton({ if (armed == "approve:$id") { armed = ""; vm.providerSwitch("approve", id) } else armed = "approve:$id" }) { Text(if (armed == "approve:$id") "Tap again to approve" else "Approve cut-over") }
                        if (st in listOf("planned", "exported", "imported", "validated", "approved", "cut_over"))
                            TextButton({ if (armed == "rollback:$id") { armed = ""; vm.providerSwitch("rollback", id) } else armed = "rollback:$id" }) { Text(if (armed == "rollback:$id") "Tap again to roll back" else "Roll back") }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- SYSTEM
/** The company emergency stop: true, false, or null while the policies have not been read. */
private fun companyStopped(vm: Lounge): Boolean? {
    val p = vm.rows("policies"); if (!p.loaded || p.error != null) return null
    return p.rows.firstOrNull { it.s("scope") == "company" && it.s("scope_id") == "*" && it.s("key") == "paused" }?.optBoolean("value") == true
}

fun LazyListScope.controlCenter(vm: Lounge, go: (String) -> Unit) {
    val d = vm.data
    item(key = "cc-state") {
        val stopped = companyStopped(vm)
        Card(alert = stopped == true || d.paused) {
            Text(when (stopped) { true -> "Company work is STOPPED"; false -> "Company work is running"; null -> "Emergency stop: state unknown" }, style = MaterialTheme.typography.titleLarge)
            Muted(when (stopped) { true -> "No task starts and no Claude call is allowed without your YES."; false -> "Nothing is held back by the emergency stop."
                null -> "The policies have not been read from Coco Cloud, so whether work is stopped is not known here." })
            TextButton({ go("system") }) { Text("Emergency stop and policies") }
        }
    }
    item(key = "pause") {
        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text(if (vm.dataAt == 0L) "Pause state not read yet" else "Coco is ${if (d.paused) "paused" else "working"}", style = MaterialTheme.typography.titleMedium); Muted("Pause switch for every device and the cloud") }
                // never offered before the real state is known, so a tap cannot flip a switch nobody has read
                Switch(!d.paused, { vm.setPaused(!it) }, enabled = vm.dataAt > 0L)
            }
        }
    }
    item(key = "cc-ops") {
        val jobs = Facts.countBy(vm.rows("jobs").rows); val calls = vm.rows("ai_calls").rows
        Card {
            Eyebrow("Right now")
            val known = vm.dataAt > 0L
            Line("Approvals", if (known) "${d.approvals.count { it.s("state") == "waiting" }} waiting for your YES" else "not read yet") { go("approvals") }
            Line("Tasks", if (known) "${d.tasks.count { it.s("status") in setOf("running", "working") }} running · ${d.tasks.count { it.s("status") in OPEN_TASK }} open" else "not read yet", null) { go("board") }
            Line("Cloud jobs", if (vm.rows("jobs").error != null) "unavailable" else "${jobs["running"] ?: 0} running · ${jobs["failed"] ?: 0} failed · ${jobs["blocked"] ?: 0} blocked", null) { go("cloud") }
            Line("Claude calls", if (vm.rows("ai_calls").error != null) "unavailable" else "${calls.size} recorded · ${Facts.number(calls.sumOf { it.d("total_tokens") })} tokens", null) { go("ai") }
            Line("Devices", if (known) "${d.devices.count(::online)}/${d.devices.size} online" else "not read yet", null) { go("devices") }
        }
    }
    table(vm, "runs", "Runs", tag = "cc-runs") { rs -> lines("cc-runs-l", "Latest operations", rs.take(6), "No runs yet.") { r -> Line(r.s("title").ifBlank { r.s("kind") }, ago(r.s("opened_at")), r.s("status")) { go("runs") } } }
    table(vm, "releases", "Releases", tag = "cc-rel") { rs ->
        lines("cc-rel-l", "Release", rs.take(1), "No cloud release row yet.") { r -> Line(r.s("name").ifBlank { r.s("release_id").ifBlank { r.s("version") } }, "${r.s("status")} · ${ago(r.s("created_at"))} · this phone ${vm.appVersion}") }
    }
}

fun LazyListScope.system(vm: Lounge) {
    item(key = "stop") {
        val stopped = companyStopped(vm)
        var ask by remember { mutableStateOf<Boolean?>(null) }
        Card(alert = stopped == true) {
            Eyebrow("Emergency stop")
            Text(when (stopped) { true -> "Company work is STOPPED"; false -> "Company work is running"; null -> "State unknown" }, style = MaterialTheme.typography.titleLarge)
            Muted("Stopping is instant. Starting again needs a YES, so nothing restarts by a mis-tap.")
            if (stopped == null) Muted(vm.rows("policies").error?.let { "Policies could not be read ($it), so the stop is not offered here until they are." } ?: "Reading the policies…")
            else if (stopped) MuTonal({ ask = false }) { Text("Let the company work") }
            else MuButton({ ask = true }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text("STOP everything") }
        }
        ask?.let { stop -> AlertDialog(onDismissRequest = { ask = null }, title = { Text(if (stop) "Stop all company work?" else "Let the company work again?") },
            text = { Text(if (stop) "No task starts and no Claude call runs until a founder lets it work again." else "This asks for a YES before anything restarts.") },
            confirmButton = { MuButton({ vm.control("company", "*", "paused", stop, "from Coco Lounge Android"); ask = null }) { Text(if (stop) "STOP" else "Ask to resume") } },
            dismissButton = { TextButton({ ask = null }) { Text("Cancel") } }) }
    }
    table(vm, "policies", "Policies") { pol ->
        lines("pol", "Policies (${pol.size})", pol.sortedWith(compareBy({ it.s("scope") }, { it.s("scope_id") }, { it.s("key") })), "No policies set; every default applies.") { p ->
            Line("${p.s("scope")} ${p.s("scope_id")} · ${p.s("key").replace('_', ' ')}", "= ${p.opt("value")}${p.s("updated_by").takeIf { it.isNotBlank() }?.let { " · by $it" } ?: ""}")
        }
        item(key = "polnote") { Muted("Claude, model and budget controls per team and agent are changed on the desktop Lounge for now.") }
    }
    table(vm, "control_ops", "Control changes") { ops ->
        lines("audit", "Every control change", ops, "No control changes yet.", cap = 25) { o ->
            Line("${o.s("scope")} ${o.s("scope_id")} · ${o.s("key")}", "${o.opt("old_value") ?: "unset"} → ${o.opt("new_value")} · ${o.s("requested_by")} · ${ago(o.s("at"))}${o.s("approval_code").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
                when (o.s("state")) { "applied" -> "done"; "needs_approval" -> "waiting"; "rejected" -> "rejected"; else -> "failed" })
        }
    }
}

fun LazyListScope.cloudWorkers(vm: Lounge) {
    item(key = "worker") {
        val w = vm.data.devices.firstOrNull { it.s("id").contains("cloud-worker") }
        Card {
            Eyebrow("Cloud worker")
            if (vm.dataAt == 0L) Muted("Devices have not been read from Coco Cloud yet.")
            else if (w == null) Muted("No cloud worker device is paired.")
            else Line(w.s("name").ifBlank { w.s("id") }, "last heartbeat ${ago(w.s("last_seen"))}${w.s("app_version").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
                if (online(w)) "live" else "off", if (online(w)) "Online" else "Offline")
        }
    }
    table(vm, "jobs", "The cloud job queue") { jobs ->
        item(key = "q") {
            val c = Facts.countBy(jobs)
            Card {
                Eyebrow("Queue health · latest ${jobs.size} jobs")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { c.entries.sortedByDescending { it.value }.forEach { (s, n) -> StatusChip(s, "$n ${s.replace('_', ' ')}") } }
                if (jobs.isEmpty()) Muted("No jobs in the queue.")
            }
        }
        lines("q-bad", "Failed in the last 3 days, or blocked", Facts.recentFailed(jobs) + jobs.filter { it.s("status") == "blocked" }, "Nothing failed in the last 3 days and nothing is blocked.", cap = 15) { j ->
            Line(j.s("type"), "${j.s("team_id")} · attempt ${j.s("attempt")}/${j.s("max_attempts")} · ${ago(j.s("created_at"))}", j.s("status"))
        }
    }
    lines("workers", "Workers and devices", vm.data.devices.sortedBy { if (it.s("kind") in setOf("pc", "phone")) 1 else 0 },
        if (vm.dataAt == 0L) "Devices have not been read from Coco Cloud yet." else "No devices have reported.") { dv ->
        Line(dv.s("name").ifBlank { dv.s("id") }, "${dv.s("kind")} · last heartbeat ${ago(dv.s("last_seen"))}${dv.s("app_version").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
            if (online(dv)) "live" else "off", if (online(dv)) "Online" else "Offline")
    }
}

// ---------------------------------------------------------------- MORE
fun LazyListScope.moreMenu(vm: Lounge, nav: NavContract, openSection: (String) -> Unit, openGlobal: (String) -> Unit) {
    val entries = nav.sections.filter { it.id !in nav.phoneBottom }.map { Triple(it.id, it.label, it.icon) to it.pages.joinToString(" · ") { p -> p.label } } +
        nav.global.map { Triple("global:" + it.id, it.label, it.icon) to (if (it.id == "chat") "Talk to COCO, a team or an agent" else "Control a PC or the other phone") } +
        listOf(Triple("island", "Coco Island", "") to "The live island on this phone")
    items(entries, key = { "more-" + it.first.first }) { (e, sub) ->
        PanelSurface(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { if (e.first.startsWith("global:")) openGlobal(e.first.removePrefix("global:")) else openSection(e.first) }) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(if (e.first == "island") Icons.Rounded.AutoAwesome else sym(e.third), null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) { Text(e.second, style = MaterialTheme.typography.titleMedium); Muted(sub, 1) }
                Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
