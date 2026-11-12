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

/** Every page id the contract names, drawn on Android (NavContract.ANDROID_PAGES must list the same ids). */
fun LazyListScope.page(vm: Lounge, ui: UiNav, id: String, teamHouse: String, pickTeamHouse: (String) -> Unit, onMember: (String) -> Unit) {
    when (id) {
        "home" -> home(vm, ui)
        "houses" -> allHouses(vm, ui)
        "company" -> organization(vm, ui)
        "structure" -> structure(vm, ui)
        "teams" -> teams(vm, teamHouse, pickTeamHouse)
        "club" -> club(vm)
        "tasks" -> tasksPage(vm, ui)
        "board" -> taskBoard(vm, ui)
        "notes" -> notes(vm)
        "approvals" -> approvals(vm, ui)
        "runs" -> runs(vm)
        "automation" -> automation(vm)
        "workflows" -> workflows(vm)
        "hierarchy" -> hierarchy(vm, ui)
        "brain" -> brain(vm)
        "agents" -> agents(vm, onMember)
        "insights" -> insights(vm, ui)
        "ai" -> aiUsage(vm)
        "connections" -> connections(vm, ui)
        "control" -> controlCenter(vm, ui.go)
        "system" -> system(vm)
        "cloud" -> cloudWorkers(vm, ui)
        "devices" -> devices(vm)
        "remote" -> remote(vm)
        "rules" -> rules(vm)
        "settings" -> settings(vm, ui.go)
        "themes" -> appearance(vm)
        else -> item(key = "nope") { Muted("This page is not on Android yet.") }
    }
}

/** The seven Houses with their contract identity (colour, icon, label) and what Coco Cloud says about each. */
@Composable
fun HouseGrid(vm: Lounge, ui: UiNav) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
        ui.nav.houses.forEach { h ->
            val live = vm.data.houses.firstOrNull { it.s("id") == h.id }
            val open = vm.data.tasks.count { TaskRules.real(it) && it.s("house_id") == h.id && it.s("status") in TaskRules.OPEN }
            val products = vm.data.offerings.count { it.s("house_id") == h.id }
            PanelSurface(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).clickable { ui.openHouse(h.id) }) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(40.dp).background(Color(h.color), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) { Icon(sym(h.icon), null, tint = Color.White) }
                    Text(h.label, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                    Muted(listOfNotNull(live?.s("state")?.ifBlank { null }, if (vm.dataAt > 0L) "$open open" else "not read yet", if (products > 0) "$products products" else null).joinToString(" · "), 1)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- HOUSES section
fun LazyListScope.allHouses(vm: Lounge, ui: UiNav) {
    item(key = "ahnote") { Muted("Seven Houses, one company. Tap a House for its workspace.") }
    item(key = "ahgrid") { HouseGrid(vm, ui) }
    lines("ahlive", "What each House is doing", ui.nav.houses.mapNotNull { h -> vm.data.houses.firstOrNull { it.s("id") == h.id } }, vm.orNotRead("Coco Cloud has no live House status yet.")) { live ->
        Line(ui.nav.house(live.s("id"))?.label ?: live.s("name"), live.s("doing").ifBlank { live.s("role") }, live.s("state")) { ui.openHouse(live.s("id")) }
    }
}

fun LazyListScope.organization(vm: Lounge, ui: UiNav) {
    val d = vm.data; val st = vm.rows("structure")
    item(key = "orgnote") { Muted("The company as Coco Cloud holds it: the Houses, what is in them, and the latest decisions.") }
    item(key = "orgstats") {
        Card {
            Eyebrow("Company at a glance")
            if (vm.dataAt == 0L) Muted("Not read from Coco Cloud yet.")
            else {
                Text("${d.houses.size} Houses · ${d.members.size} agents · ${d.pipelines.size} workflows", style = MaterialTheme.typography.titleMedium)
                Muted(listOfNotNull("${d.categories.size} categories", "${d.offerings.size} channels and products",
                    if (st.loaded && st.error == null) "${st.rows.count { it.s("kind") == "team" }} teams · ${st.rows.count { it.s("kind") == "subteam" }} subteams" else null).joinToString(" · "))
            }
        }
    }
    lines("orgheads", "The Houses", ui.nav.houses.mapNotNull { h -> d.houses.firstOrNull { it.s("id") == h.id } }, vm.orNotRead("No Houses recorded yet.")) { live ->
        Line(ui.nav.house(live.s("id"))?.label ?: live.s("name"), live.s("doing").ifBlank { live.s("role") }, live.s("state")) { ui.openHouse(live.s("id")) }
    }
    lines("decisions", "Latest decisions", d.decisions.take(12), vm.orNotRead("No decisions recorded yet.")) { Line(it.s("text"), "${it.s("decided_on")} · ${it.s("by_name")}") }
}

fun LazyListScope.structure(vm: Lounge, ui: UiNav) {
    item(key = "stnote") {
        var add by remember { mutableStateOf(false) }
        Card {
            Muted("The teams, subteams and categories founders built, each placed in its House. A new piece starts paused until you start it.")
            MuTonal({ add = true }) { Icon(Icons.Rounded.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Add a team, subteam or category") }
        }
        if (add) StructureAddDialog(vm, ui, null) { add = false }
    }
    table(vm, "structure", "The company structure") { rows ->
        ui.nav.houses.forEach { h ->
            val mine = HouseMap.structureOf(ui.houses, h.id, rows)
            item(key = "st-${h.id}") {
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.size(28.dp).background(Color(h.color), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) { Icon(sym(h.icon), null, Modifier.size(16.dp), tint = Color.White) }
                        Text(h.label, style = MaterialTheme.typography.titleMedium)
                    }
                    if (mine.isEmpty()) Muted("No teams built here yet.") else StructureLines(mine)
                }
            }
        }
        val loose = HouseMap.unplaced(ui.houses, rows)
        if (loose.isNotEmpty()) item(key = "st-loose") { Card { Eyebrow("Not placed in a House"); StructureLines(loose); loose.filter { it.s("kind") == "team" }.forEach { PlaceTeamButton(vm, ui, it) } } }
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
private fun scopeOf(i: JSONObject): String = i.s("team_id").ifBlank { "company" }

fun LazyListScope.brain(vm: Lounge) {
    item(key = "bmh") { Section("What the company knows") }
    table(vm, "brain_items", "The company memory") { items ->
        item(key = "bsum") {
            Card {
                Text("${items.size} records", style = MaterialTheme.typography.titleMedium)
                Muted(items.groupBy(::scopeOf).entries.sortedByDescending { it.value.size }.joinToString(" · ") { "${it.value.size} ${it.key}" }, 3)
            }
        }
        lines("br-mem", "Latest", items, "The Brain is empty.", cap = 40) { i ->
            Line(i.s("title"), listOfNotNull(i.s("kind"), scopeOf(i), i.s("visibility").ifBlank { null }, i.s("source").ifBlank { i.s("created_by") }.ifBlank { null }, ago(i.s("created_at"))).joinToString(" · "))
        }
    }
}

fun LazyListScope.hierarchy(vm: Lounge, ui: UiNav) {
    item(key = "hnote") { Muted("Where each record lives: in the company Brain or in one team Brain. A team sees its own records and the company records.") }
    table(vm, "brain_items", "The Brain hierarchy") { items ->
        val by = items.groupBy(::scopeOf)
        item(key = "hier") {
            Card {
                Eyebrow("Brains (${by.size})")
                by.entries.sortedByDescending { it.value.size }.forEach { (scope, list) ->
                    val house = HouseMap.houseOfTeam(ui.houses, scope)
                    Line(if (scope == "company") "Company" else HouseMap.pretty(scope), listOfNotNull("${list.size} records", house?.let { ui.house(it) }, "latest ${ago(list.maxOf { it.s("created_at") })}").joinToString(" · "),
                        onClick = house?.let { h -> { ui.openHouse(h) } })
                }
            }
        }
    }
}

fun LazyListScope.agents(vm: Lounge, onMember: (String) -> Unit) {
    val d = vm.data
    listOf("Think", "Make", "Care").forEach { g ->
        val ms = d.members.filter { it.s("grp") == g }
        if (ms.isNotEmpty()) lines("ag-$g", g, ms, "") { m ->
            val hs = d.memberHouses.filter { it.s("member_id") == m.s("id") }.map { vm.houseName(it.s("house_id")) }
            Line(m.s("name"), listOfNotNull(m.s("job"), hs.takeIf { it.isNotEmpty() }?.let { "Helps: " + it.joinToString() }, m.s("doing").ifBlank { null }?.let { "Now: $it" }).joinToString(" · ")) { onMember(m.s("id")) }
        }
    }
    if (d.members.isEmpty()) item(key = "ag-none") { Muted(vm.orNotRead("No agents recorded yet.")) }
    table(vm, "structure", "Team agents", tag = "ag-struct") { rows ->
        val by = rows.associateBy { it.s("id") }
        val ag = rows.filter { it.s("kind") == "agent" }.sortedBy { it.s("id") }
        lines("ag-teams", "Agents inside teams (${ag.size})", ag, "No team agents have been built yet.", cap = 30) { a -> Line(a.s("name"), "${HouseMap.pretty(HouseMap.rootOf(a, by))} · ${a.s("state")}") }
    }
}

// ---------------------------------------------------------------- INSIGHTS
fun LazyListScope.insights(vm: Lounge, ui: UiNav) {
    item(key = "revh") { Section("Revenue") }
    revenueSection(vm, ui, null, "No revenue source is set up yet. Connect a seller account (Gumroad) under Connections.")
    item(key = "ythd") { Section("YouTube") }
    youtubeSection(vm)
    item(key = "insnote") { Muted("Every number is a recorded fact with a source and a time. A source that is not connected says so; it is never shown as 0.") }
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
            Line("Tasks", if (known) "${d.tasks.count { it.s("status") in setOf("running", "working") }} running · ${TaskRules.count(d.tasks, TaskRules.Filter.Open)} open" else "not read yet", null) { go("tasks") }
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

fun LazyListScope.cloudWorkers(vm: Lounge, ui: UiNav) {
    item(key = "worker") {
        val ws = Workers.cloud(vm.data.devices)
        Card {
            Eyebrow("Cloud worker")
            Muted(Workers.line(vm.data.devices, vm.dataAt > 0L, jobs = vm.rows("jobs").rows), 5)
            ws.forEach { w ->
                Line(w.s("name").ifBlank { w.s("id") }, "last run ${ago(w.s("last_seen"))}${w.s("app_version").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
                    if (Workers.online(w)) "live" else "waiting", if (Workers.online(w)) "Ran recently" else "Idle")
            }
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
        item(key = "jf") { ChipRow { JobRules.Filter.entries.forEach { f -> FilterChip(vm.jobFilter == f, { vm.jobFilter = f }, { Text("${f.label} ${JobRules.list(jobs, f).size}") }) } } }
        val list = JobRules.list(jobs, vm.jobFilter)
        if (list.isEmpty()) item(key = "jnone") { Muted("No ${vm.jobFilter.label.lowercase()} jobs.") }
        items(list.take(40), key = { "job-" + it.s("id") }) { j -> JobRow(ui, j) }
        if (list.size > 40) item(key = "jmore") { Muted("Showing the latest 40 of ${list.size}.") }
    }
    lines("workers", "Devices", vm.data.devices.sortedBy { if (it.s("kind") in setOf("pc", "phone")) 1 else 0 },
        if (vm.dataAt == 0L) "Devices have not been read from Coco Cloud yet." else "No devices have reported.") { dv ->
        val cloudDev = dv.s("id").contains("cloud-worker"); val on = if (cloudDev) Workers.online(dv) else online(dv)
        Line(dv.s("name").ifBlank { dv.s("id") }, "${dv.s("kind")} · ${if (cloudDev) "last run" else "last heartbeat"} ${ago(dv.s("last_seen"))}${dv.s("app_version").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
            if (on) "live" else if (cloudDev) "waiting" else "off", if (cloudDev) (if (on) "Ran recently" else "Idle") else if (on) "Online" else "Offline")
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
