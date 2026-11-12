@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.Duration
import java.time.Instant

/*
 * A House workspace shows the REAL rows of that House from the original tables: houses (state, doing, next), structure (teams, subteams,
 * categories, channels, agents), categories, offerings, members + member_houses, pipelines, brain_items, integrations + accounts, approvals,
 * tasks, jobs, outputs, yt_stats and revenue_*. Which row belongs to which House is HouseMap's job, and it is the navigation contract's
 * (a team name, a platform or a domain names its House), the same rule as the web twin.
 */

/** One House: its identity from the contract, the twenty workspace tabs, and only that House's rows in each. */
@Composable
fun HouseWorkspace(vm: Lounge, ui: UiNav, h: HouseDef, tab: String, pick: (String) -> Unit) {
    val tabs = ui.nav.houseTabs
    val i = tabs.indexOfFirst { it.first == tab }.coerceAtLeast(0)
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(16.dp, 4.dp, 16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(48.dp).background(Color(h.color), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Icon(sym(h.icon), null, tint = Color.White) }
            Column(Modifier.weight(1f)) {
                Text("${h.domain} House", style = MaterialTheme.typography.titleMedium)
                Muted(h.platforms.joinToString(", "), 1)
            }
            vm.data.houses.firstOrNull { it.s("id") == h.id }?.let { StatusChip(it.s("state")) }
        }
        CocoPanel {
            val link = LocalCocoRoles.current.link; val cs = MaterialTheme.colorScheme
            ScrollableTabRow(i, edgePadding = 16.dp, containerColor = cs.surface, contentColor = link,
                indicator = { positions -> TabRowDefaults.SecondaryIndicator(Modifier.tabIndicatorOffset(positions[i]), color = link) }) {
                tabs.forEachIndexed { n, (id, label) -> androidx.compose.material3.Tab(n == i, { pick(id) }, text = { Text(label, maxLines = 1) },
                    selectedContentColor = link, unselectedContentColor = cs.onSurfaceVariant) }
            }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            houseTab(vm, ui, h, tabs[i].first, pick)
        }
    }
}

/** The structure rows as an indented list: team, subteams, categories, channels, agents. */
@Composable
fun StructureLines(rows: List<JSONObject>) {
    HouseMap.tree(rows).forEach { n ->
        Box(Modifier.padding(start = (14 * n.depth.coerceAtMost(5)).dp)) {
            val r = n.row
            if (r == null) Line(n.label, "team", null)
            else Line(n.label, listOfNotNull(r.s("kind"), r.s("head_agent_id").ifBlank { null }?.let { "head ${it.substringAfterLast('.')}" }).joinToString(" · "), r.s("state"), r.s("state").replaceFirstChar { it.uppercase() })
        }
    }
}

@Composable
private fun AddButton(text: String, onClick: () -> Unit) = MuTonal(onClick) { Icon(Icons.Rounded.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(text) }

private fun within(iso: String?, days: Long, now: Instant = Instant.now()) = Facts.instant(iso)?.isAfter(now.minus(Duration.ofDays(days))) == true

fun LazyListScope.houseTab(vm: Lounge, ui: UiNav, h: HouseDef, tab: String, pick: (String) -> Unit) {
    val d = vm.data; val id = h.id; val k = "h-$id-$tab"; val known = vm.dataAt > 0L; val hs = ui.houses
    val st = vm.rows("structure"); val srows = HouseMap.structureOf(hs, id, st.rows)
    val cats = d.categories.filter { it.s("house_id") == id }.sortedBy { it.optInt("code") }
    val offs = d.offerings.filter { it.s("house_id") == id }
    val tasks = d.tasks.filter { TaskRules.real(it) && it.s("house_id") == id }
    val members = HouseMap.membersOf(id, d.members, d.memberHouses)
    val pipes = d.pipelines.filter { it.s("house_id") == id }
    val accounts = vm.rows("integration_accounts").rows
    val myAccounts = HouseMap.accountsOf(h, accounts)
    val myIntegrations = d.integrations.filter { it.s("house_id") == id }
    val myApprovals = d.approvals.filter { HouseMap.houseOfText(hs, it.s("team")) == id }
    val waiting = myApprovals.filter { it.s("state") == "waiting" }
    val jobs = vm.rows("jobs").rows.filter { HouseMap.inTeams(hs, id, it.s("team_id")) }
    val brainRows = vm.rows("brain_items")
    val brain = brainRows.rows.filter { HouseMap.inTeams(hs, id, it.s("team_id")) }
    val tree = HouseMap.tree(srows)
    val problems = myIntegrations.count { it.s("state") == "error" } + myAccounts.count { it.s("state") == "error" }
    when (tab) {
        "overview" -> {
            item(key = k) {
                val live = d.houses.firstOrNull { it.s("id") == id }
                Card {
                    Eyebrow("Overview")
                    if (!known) Muted("Not read from Coco Cloud yet.")
                    else if (live == null) Muted("${h.name} is not in Coco Cloud's House list yet.")
                    else {
                        Text(live.s("role").ifBlank { h.domain }, style = MaterialTheme.typography.bodyLarge)
                        Fact("State", live.s("state").replaceFirstChar { it.uppercase() }); Fact("Rhythm", live.s("cadence")); Fact("Publishing rule", live.s("publish_rule")); Fact("Doing now", live.s("doing"))
                        Fact("Next", live.s("next")); Fact("Blocked", live.s("blocked")); Fact("Recently", live.s("recent"))
                    }
                }
            }
            item(key = "$k-counts") {
                val sOk = st.loaded && st.error == null
                fun n(v: Int, structure: Boolean = false) = if (!known || (structure && !sOk)) "–" else "$v"
                val openTasks = tasks.count { TaskRules.group(it.s("status")) == TaskRules.Filter.Open }; val failed = tasks.count { it.s("status") == "failed" }
                Card {
                    Eyebrow("In ${h.label}")
                    Line("${n(tree.count { it.depth == 0 }, true)} teams · ${n(srows.count { it.s("kind") == "subteam" }, true)} subteams", "Teams and subteams", onClick = { pick("teams") })
                    Line("${n(cats.size + srows.count { it.s("kind") == "category" }, true)} categories", "Categories", onClick = { pick("categories") })
                    Line("${n(offs.size + srows.count { it.s("kind") == "channel" }, true)} channels and products", "Channels and products", onClick = { pick("channels") })
                    Line("${n(members.size + srows.count { it.s("kind") == "agent" }, true)} agents and members", "Agents", onClick = { pick("agents") })
                    Line(if (brainRows.loaded && brainRows.error == null) "${brain.size} Brain records" else "– Brain records", "Brains", onClick = { pick("brains") })
                    Line("${n(pipes.size)} workflows", "Automation", onClick = { pick("automation") })
                    Line("${n(openTasks)} open tasks" + if (failed > 0) " · $failed failed" else "", "Production", onClick = { pick("production") })
                    Line("${n(waiting.size)} waiting for your YES", "Approvals", onClick = { pick("approvals") })
                    Line("${n(problems)} connection problems · ${n(myIntegrations.size)} platforms", "Connections", onClick = { pick("connections") })
                }
            }
            item(key = "$k-new") { MuButton({ ui.newTask(id) }) { Icon(Icons.Rounded.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("New task in ${h.label}") } }
        }
        "organization" -> {
            item(key = k) {
                var add by remember { mutableStateOf(false) }
                Card {
                    Eyebrow("Organization (${srows.size})")
                    if (!(st.loaded && st.error == null)) Muted(if (!st.loaded) "Reading the structure…" else "The structure could not be read right now: ${st.error}")
                    else if (srows.isEmpty()) Muted("No team, category or agent is registered under ${h.label}. The categories and channels it already has are under their own tabs.")
                    else StructureLines(srows)
                    AddButton("Add a team, subteam or category") { add = true }
                }
                if (add) StructureAddDialog(vm, ui, id) { add = false }
            }
        }
        "teams" -> {
            item(key = k) {
                var add by remember { mutableStateOf(false) }
                val teamRows = srows.filter { it.s("kind") in setOf("team", "subteam") }
                Card {
                    Eyebrow("Teams and subteams")
                    if (!(st.loaded && st.error == null)) Muted(if (!st.loaded) "Reading the structure…" else "The structure could not be read right now: ${st.error}")
                    else if (teamRows.isEmpty()) Muted("No team or subteam is registered under ${h.label}.")
                    HouseMap.tree(teamRows).forEach { n ->
                        Box(Modifier.padding(start = (14 * n.depth.coerceAtMost(3)).dp)) {
                            val r = n.row
                            if (r == null) Line(n.label, "team")
                            else {
                                val inside = srows.filter { it.s("parent_id") == r.s("id") }
                                Line(n.label, listOfNotNull(r.s("kind"), r.s("head_agent_id").ifBlank { null }?.let { "head ${it.substringAfterLast('.')}" } ?: "no head named",
                                    inside.count { it.s("kind") == "category" }.takeIf { it > 0 }?.let { "$it categories" }, inside.count { it.s("kind") == "agent" }.takeIf { it > 0 }?.let { "$it agents" }).joinToString(" · "),
                                    r.s("state"), r.s("state").replaceFirstChar { it.uppercase() })
                            }
                        }
                    }
                    AddButton("Add a team or subteam") { add = true }
                }
                if (add) StructureAddDialog(vm, ui, id) { add = false }
            }
        }
        "categories" -> {
            item(key = k) {
                var add by remember { mutableStateOf(false) }
                Card {
                    Eyebrow("Categories (${cats.size + srows.count { it.s("kind") == "category" }})")
                    if (!known) Muted("Not read from Coco Cloud yet.")
                    else if (cats.isEmpty() && srows.none { it.s("kind") == "category" }) Muted("No category is set up for ${h.label} yet.")
                    cats.forEach { c -> Line("%02d · %s".format(c.optInt("code"), c.s("name")), listOfNotNull(c.s("linked_to").takeIf { it.isNotBlank() }?.let { "linked to $it" }, offs.count { o -> o.s("category_id") == c.s("id") }.let { n -> "$n item${if (n == 1) "" else "s"}" }).joinToString(" · ")) }
                    srows.filter { it.s("kind") == "category" }.sortedBy { it.s("id") }.forEach { c -> Line(c.s("name"), "structure · under ${HouseMap.pretty(c.s("parent_id"))} · ${c.s("state")}") }
                    AddButton("Add a category") { add = true }
                }
                if (add) TextDialog("New category in ${h.label}", "Category name", "Add category", onClose = { add = false }) { vm.addCategory(id, it) }
            }
        }
        "channels" -> {
            item(key = "$k-add") {
                var add by remember { mutableStateOf(false) }
                Card { Eyebrow("Channels and products (${offs.size + srows.count { it.s("kind") == "channel" }})"); if (known && offs.isEmpty()) Muted("No channel or product is registered for ${h.label} yet."); AddButton("Add a channel or product") { add = true } }
                if (add) AddOfferingDialog(vm, id, cats) { add = false }
            }
            items(offs.sortedBy { it.s("name").lowercase() }, key = { "$k-o-" + it.s("id") }) { o ->
                var pickCat by remember { mutableStateOf(false) }
                OfferingCard(o) {
                    TextButton({ pickCat = true }) { Text("Category: " + (cats.firstOrNull { it.s("id") == o.s("category_id") }?.s("name") ?: "none") + " · change") }
                }
                if (pickCat) CategoryPickDialog(vm, o, cats) { pickCat = false }
            }
            val chans = srows.filter { it.s("kind") == "channel" }
            if (chans.isNotEmpty()) item(key = "$k-sc") { Card { Eyebrow("Structure channels (${chans.size})"); StructureLines(chans) } }
        }
        "brains" -> {
            item(key = k) {
                Card {
                    Eyebrow("Brain records (${brain.size})")
                    when {
                        !brainRows.loaded -> Muted("Reading the Brain…")
                        brainRows.error != null -> Muted("The Brain could not be read right now: ${brainRows.error}")
                        brain.isEmpty() -> Muted("No Brain record is filed for ${h.label} yet.")
                    }
                    brain.take(40).forEach { x -> Line(x.s("title"), listOfNotNull(x.s("kind"), x.s("team_id").ifBlank { null }, x.s("source").ifBlank { null }, ago(x.s("created_at"))).joinToString(" · ")) }
                    brainRows.rows.count { it.s("team_id").isBlank() }.takeIf { it > 0 && brainRows.error == null }?.let { Muted("$it company-wide record${if (it == 1) "" else "s"} apply to every House.") }
                    TextButton({ ui.go("brain") }) { Text("All Brain records") }
                }
            }
        }
        "agents" -> {
            item(key = k) {
                var add by remember { mutableStateOf(false) }
                val free = d.members.filter { m -> members.none { it.s("id") == m.s("id") } }
                Card {
                    Eyebrow("Agents and members (${members.size + srows.count { it.s("kind") == "agent" }})")
                    if (!known) Muted("Not read from Coco Cloud yet.") else if (members.isEmpty() && srows.none { it.s("kind") == "agent" }) Muted("Nobody works for ${h.label} yet.")
                    members.forEach { m -> Line(m.s("name"), listOfNotNull(m.s("grp"), m.s("job"), m.s("model").ifBlank { null }, m.s("doing").ifBlank { null }?.let { "Now: $it" }).joinToString(" · ")) }
                    srows.filter { it.s("kind") == "agent" }.sortedBy { it.s("id") }.forEach { a -> Line(a.s("name"), "agent · ${HouseMap.pretty(a.s("parent_id"))}", a.s("state"), a.s("state").replaceFirstChar { it.uppercase() }) }
                    if (free.isNotEmpty()) AddButton("Assign a member to ${h.label}") { add = true }
                }
                if (add) AddMemberDialog(vm, h, free) { add = false }
            }
        }
        "automation" -> {
            item(key = k) {
                Card {
                    Eyebrow("Automation (${pipes.size})")
                    if (!known) Muted("Not read from Coco Cloud yet.") else if (pipes.isEmpty()) Muted("No pipeline is registered for ${h.label}.")
                    pipes.forEach { p ->
                        Line(p.s("name").ifBlank { p.s("id") }, "${TaskRules.steps(p)} steps · ${p.s("trigger")}", if (p.optBoolean("active", true)) "live" else "off", if (p.optBoolean("active", true)) "Active" else "Off")
                        (0 until TaskRules.steps(p)).forEach { i -> TaskRules.stepOf(p, i)?.let { s ->
                            Muted("${i + 1}. ${s.s("do").ifBlank { s.s("name") }} · ${listOfNotNull(s.s("where").ifBlank { null }, d.members.firstOrNull { m -> m.s("id") == s.s("member") }?.s("name") ?: s.s("member").ifBlank { null }).joinToString(" · ")}", 2) } }
                    }
                }
            }
        }
        "templates" -> table(vm, "templates", "Templates", tag = k) { ts ->
            val mine = ts.filter { t -> t.s("owner_unit_id").let { HouseMap.houseOfTeam(hs, it) == id } || offs.any { it.s("id") == t.s("owner_product_id") } }
            lines(k, "Templates", mine, "No template is owned by ${h.label}. Library templates are in Automation.") { t -> Line(t.s("name"), "${t.s("kind")} · v${t.s("current_version")} · ${t.optInt("assignments")} assignments", t.s("status").let { if (it == "active") "live" else "planned" }, t.s("status")) }
        }
        "prompts" -> table(vm, "prompts", "Prompt instructions", tag = k) { ps ->
            val ids = vm.rows("templates").rows.filter { t -> t.s("owner_unit_id").let { HouseMap.houseOfTeam(hs, it) == id } || offs.any { it.s("id") == t.s("owner_product_id") } }.map { it.s("id") }.toSet()
            lines(k, "Prompt instructions", ps.filter { it.s("template_id") in ids }, "No prompt belongs to ${h.label}'s templates yet.") { p -> Line(p.s("name"), "${p.s("kind")} · version ${p.s("active_version").ifBlank { "none active" }} of ${p.s("current_version")}", if (p.s("status") == "active") "live" else "planned", p.s("status")) }
        }
        "connections" -> {
            item(key = k) {
                Card {
                    Eyebrow("Platforms (${myIntegrations.size})")
                    if (!known) Muted("Not read from Coco Cloud yet.") else if (myIntegrations.isEmpty()) Muted("No integration is registered for ${h.label}.")
                    myIntegrations.forEach { i -> Line(i.s("platform").ifBlank { i.s("id") }, listOfNotNull(i.s("account").ifBlank { null }, if (i.s("last_ok_at").isNotBlank()) "last verified ${ago(i.s("last_ok_at"))}" else if (i.s("last_check_at").isNotBlank()) "checked ${ago(i.s("last_check_at"))}" else "never checked",
                        i.s("error").takeIf { it.isNotBlank() }?.let { "Problem: ${it.take(100)}" }, i.s("next_action").takeIf { it.isNotBlank() }?.let { "Next: ${it.take(100)}" }).joinToString(" · "), i.s("state")) { ui.conn("i:" + i.s("id")) } }
                }
            }
            item(key = "$k-acc") {
                Card {
                    Eyebrow("Accounts on ${h.platforms.joinToString(", ")} (${myAccounts.size})")
                    if (known && myAccounts.isEmpty()) Muted("No account is registered on these platforms.")
                    myAccounts.take(20).forEach { a -> Line(a.s("external_name").ifBlank { a.s("connection_id") }, "${a.s("provider")} · ${if (a.s("last_verified_at").isBlank()) "never verified" else "verified ${ago(a.s("last_verified_at"))}"}", a.s("state")) { ui.conn("a:" + a.s("connection_id")) } }
                    if (myAccounts.size > 20) Muted("${myAccounts.size - 20} more in Connections.")
                    TextButton({ ui.go("connections") }) { Text("Open all connections") }
                }
            }
        }
        "references" -> {
            item(key = k) {
                val refs = brain.filter { it.s("kind") == "reference" }
                Card {
                    Eyebrow("Reference assets (${refs.size})")
                    if (!brainRows.loaded) Muted("Reading…") else if (brainRows.error != null) Muted("Could not be read right now: ${brainRows.error}")
                    else if (refs.isEmpty()) Muted("No reference is filed for ${h.label}. References are Brain records of kind reference; template references are in Automation.")
                    refs.forEach { x -> Line(x.s("title"), ago(x.s("created_at"))) }
                    TextButton({ ui.go("automation") }) { Text("Automation references") }
                }
            }
        }
        "production" -> {
            val by = { s: String -> jobs.count { it.s("status") == s } }
            val open = tasks.filter { TaskRules.group(it.s("status")) == TaskRules.Filter.Open }
            item(key = "$k-new") { MuButton({ ui.newTask(id) }) { Icon(Icons.Rounded.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("New task in ${h.label}") } }
            item(key = k) {
                Card {
                    Eyebrow("Production")
                    if (!known) Muted("Not read from Coco Cloud yet.")
                    else Muted("${by("running")} jobs running · ${by("queued")} queued · ${by("failed") + by("blocked")} failed or blocked · ${open.size} open tasks", 3)
                }
            }
            if (known && open.isEmpty()) item(key = "$k-none") { Muted("No open task in ${h.label}.") }
            items(open.sortedBy { it.optInt("priority", 2) }.take(8), key = { "$k-t-" + it.s("id") }) { t -> TaskRow(vm, ui, t) }
            item(key = "$k-all") { TextButton({ vm.tasksTab = "tasks"; vm.taskHouse = id; vm.taskFilter = TaskRules.Filter.Open; ui.go("tasks") }) { Text("Open all ${h.label} tasks") } }
            val pj = jobs.filter { it.s("status") != "done" }
            if (pj.isNotEmpty()) { item(key = "$k-jh") { Section("Cloud jobs (${pj.size})") }; items(pj.take(10), key = { "$k-j-" + it.s("id") }) { j -> JobRow(ui, j) } }
        }
        "outputs" -> table(vm, "outputs", "Outputs", tag = k) { o ->
            lines(k, "Outputs", o.filter { HouseMap.inTeams(hs, id, it.s("team_id")) }, "No output has been logged for ${h.label}.", cap = 50) { x ->
                Line(x.s("title").ifBlank { x.s("id") }, listOf(x.s("kind"), ago(x.s("at"))).filter { it.isNotBlank() }.joinToString(" · "), x.s("status"))
            }
        }
        "scheduler" -> {
            lines(k, "Pipelines and their triggers", pipes, vm.orNotRead("No pipeline with a trigger is registered for ${h.label}.")) { p -> Line(p.s("name").ifBlank { p.s("id") }, p.s("trigger"), if (p.optBoolean("active", true)) "live" else "off", if (p.optBoolean("active", true)) "Scheduled" else "Off") }
            lines("$k-ev", "Scheduled items", d.events.filter { it.s("house_id") == id }.sortedBy { it.s("due_at") }, vm.orNotRead("Nothing else is scheduled for ${h.label}.")) { e -> Line(e.s("title"), inTime(e.s("due_at")), e.s("status")) }
        }
        "approvals" -> {
            item(key = k) { Section("Approvals (${waiting.size} waiting)") }
            if (myApprovals.isEmpty()) item(key = "$k-none") { Muted(vm.orNotRead("No approval names ${h.label}. Approvals are matched by the House, platform or domain in their team text.")) }
            items(myApprovals.take(40), key = { "$k-${it.s("id")}" }) { a -> ApprovalCard(ui, a) }
        }
        "analytics" -> {
            if (h.platforms.contains("youtube")) youtubeSection(vm)
            item(key = k) {
                val doneT = tasks.count { it.s("status") == "done" && within(it.s("updated_at"), Revenue.DAYS) }
                val pubO = vm.rows("outputs").rows.count { HouseMap.inTeams(hs, id, it.s("team_id")) && it.s("status") == "published" && within(it.s("at"), Revenue.DAYS) }
                val jobsDone = jobs.count { it.s("status") == "done" && within(it.s("completed_at").ifBlank { it.s("updated_at") }, Revenue.DAYS) }
                val jobsFailed = jobs.count { it.s("status") == "failed" && within(it.s("updated_at"), Revenue.DAYS) }
                Card {
                    Eyebrow("Activity · last ${Revenue.DAYS} days")
                    if (!known) Muted("Not read from Coco Cloud yet.") else Muted("$doneT tasks done · $pubO outputs published · $jobsDone jobs done · $jobsFailed jobs failed", 3)
                    offs.groupBy { it.s("status") }.entries.sortedByDescending { it.value.size }.take(8).let { g ->
                        if (g.isNotEmpty()) { Eyebrow("Channels and products by status"); g.forEach { (s, l) -> Line(s.ifBlank { "no status" }, "${l.size}") } }
                    }
                    if (!h.platforms.contains("youtube")) Muted("No ${h.domain.lowercase()} analytics source is connected yet, so only Coco's own work is counted here. Nothing is estimated.", 3)
                }
            }
        }
        "revenue" -> {
            val only = myAccounts.map { it.s("connection_id") }.toSet()
            revenueSection(vm, ui, only, "No revenue source is connected to ${h.label}. Connect its seller account under Connections.")
        }
        "activity" -> lines(k, "Activity history", tasks.sortedByDescending { it.s("updated_at").ifBlank { it.s("created_at") } }, vm.orNotRead("No task activity for ${h.label}."), cap = 30) { t ->
            Line(t.s("title"), "${t.s("status")} · ${ago(t.s("updated_at").ifBlank { t.s("created_at") })} · by ${t.s("created_by")}", t.s("status")) { ui.task(t.s("id")) }
        }
        "settings" -> {
            item(key = k) {
                val live = d.houses.firstOrNull { it.s("id") == id }
                Card {
                    Eyebrow("Settings")
                    Fact("Identity", "${h.label} · id ${h.id} · ${h.domain}"); Fact("State", live?.s("state")?.replaceFirstChar { it.uppercase() }); Fact("Role", live?.s("role"))
                    Fact("Publishing rule", live?.s("publish_rule")?.ifBlank { "None recorded" } ?: "None recorded"); Fact("Rhythm", live?.s("cadence")?.ifBlank { "None recorded" } ?: "None recorded")
                    Fact("Expected platforms", h.platforms.joinToString(", ")); Fact("Tracks", h.metrics.joinToString(", "))
                }
            }
            table(vm, "policies", "Policies", tag = "$k-p") { p ->
                lines("$k-p", "Policies for ${h.label}", p.filter { it.s("scope_id") == id || HouseMap.inTeams(hs, id, it.s("scope_id")) }, "No House-level policy; the company defaults apply.") { x -> Line("${x.s("scope")} · ${x.s("key")}", "= ${x.opt("value")}") }
            }
        }
        else -> item(key = k) { Muted("Not on Android yet.") }
    }
}

// ---------------------------------------------------------------- the small forms
@Composable
fun TextDialog(title: String, label: String, confirm: String, onClose: () -> Unit = {}, done: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onClose, title = { Text(title) }, text = { OutlinedTextField(text, { text = it }, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth()) },
        confirmButton = { MuButton({ done(text.trim()); onClose() }, enabled = text.isNotBlank()) { Text(confirm) } }, dismissButton = { TextButton(onClose) { Text("Cancel") } })
}

@Composable
fun AddOfferingDialog(vm: Lounge, house: String, cats: List<JSONObject>, onClose: () -> Unit) {
    var name by remember { mutableStateOf("") }; var kind by remember { mutableStateOf("channel") }
    var platform by remember { mutableStateOf<String?>(null) }; var cat by remember { mutableStateOf<String?>(null) }
    AlertDialog(onDismissRequest = onClose, title = { Text("Add a channel or product") },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Eyebrow("Kind")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("channel", "product", "extension", "app", "game", "download").forEach { k -> FilterChip(kind == k, { kind = k }, { Text(k) }) } }
                Eyebrow("Platform")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(platform == null, { platform = null }, { Text("None") })
                    vm.data.platforms.forEach { p -> FilterChip(platform == p.s("id"), { platform = p.s("id") }, { Text(p.s("name")) }) }
                }
                if (cats.isNotEmpty()) {
                    Eyebrow("Category")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(cat == null, { cat = null }, { Text("None") })
                        cats.forEach { c -> FilterChip(cat == c.s("id"), { cat = c.s("id") }, { Text(c.s("name")) }) }
                    }
                }
                Muted("It is saved as planned. Nothing is published or connected by adding it.")
            }
        },
        confirmButton = { MuButton({ vm.addOffering(house, name.trim(), kind, platform, cat); onClose() }, enabled = name.isNotBlank()) { Text("Add") } }, dismissButton = { TextButton(onClose) { Text("Cancel") } })
}

@Composable
fun CategoryPickDialog(vm: Lounge, o: JSONObject, cats: List<JSONObject>, onClose: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, title = { Text("Category of ${o.s("name")}") },
        text = {
            FlowRow(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(o.s("category_id").isBlank(), { vm.setOfferingCategory(o.s("id"), null); onClose() }, { Text("None") })
                cats.forEach { c -> FilterChip(o.s("category_id") == c.s("id"), { vm.setOfferingCategory(o.s("id"), c.s("id")); onClose() }, { Text(c.s("name")) }) }
            }
        },
        confirmButton = { TextButton(onClose) { Text("Close") } })
}

@Composable
fun AddMemberDialog(vm: Lounge, h: HouseDef, free: List<JSONObject>, onClose: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, title = { Text("Assign a member to ${h.label}") },
        text = {
            Column(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                free.forEach { m -> Line(m.s("name"), listOfNotNull(m.s("grp"), m.s("job")).joinToString(" · ")) { vm.addMemberToHouse(m.s("id"), h.id); onClose() } }
            }
        },
        confirmButton = { TextButton(onClose) { Text("Close") } })
}

/** A team nobody has placed yet (no House in its name): the founder says which House it belongs to (config.house, merged into its config). */
@Composable
fun PlaceTeamButton(vm: Lounge, ui: UiNav, row: JSONObject) {
    var open by remember { mutableStateOf(false) }
    TextButton({ open = true }) { Text("Place ${row.s("name").ifBlank { row.s("id") }} in a House") }
    if (open) AlertDialog(onDismissRequest = { open = false }, title = { Text("Which House is ${row.s("name").ifBlank { row.s("id") }} in?") },
        text = { FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { ui.houses.forEach { h -> FilterChip(false, { vm.structurePlace(row, h.id); open = false }, { Text(h.label) }) } } },
        confirmButton = { TextButton({ open = false }) { Text("Close") } })
}

/** coco_structure('create'): a team (placed in the chosen House by config.house), a subteam inside a team, or a category inside a subteam. */
@Composable
fun StructureAddDialog(vm: Lounge, ui: UiNav, house: String?, onClose: () -> Unit) {
    var h by remember { mutableStateOf(house) }; var kind by remember { mutableStateOf("subteam") }
    var name by remember { mutableStateOf("") }; var desc by remember { mutableStateOf("") }; var parent by remember { mutableStateOf<String?>(null) }
    val rows = vm.rows("structure").rows; val by = rows.associateBy { it.s("id") }
    val mine = h?.let { HouseMap.structureOf(ui.houses, it, rows) }.orEmpty()
    val parents: List<Pair<String, String>> = when (kind) {
        "subteam" -> mine.map { HouseMap.rootOf(it, by) }.distinct().map { it to (by[it]?.s("name")?.ifBlank { null } ?: HouseMap.pretty(it)) }
        "category" -> mine.filter { it.s("kind") == "subteam" }.map { it.s("id") to it.s("name") }
        else -> emptyList()
    }
    val id = if (kind == "team") HouseMap.slug(name) else parent?.let { "$it/${HouseMap.slug(name)}" }.orEmpty()
    val taken = id in by
    val valid = name.isNotBlank() && h != null && (kind == "team" || parent != null) && Regex("^[a-z0-9][a-z0-9._/-]{1,80}$").matches(id) && !taken
    AlertDialog(onDismissRequest = onClose, title = { Text("Add to the structure") },
        text = {
            Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow("House")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { ui.houses.forEach { x -> FilterChip(h == x.id, { h = x.id; parent = null }, { Text(x.label) }) } }
                Eyebrow("What")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("team" to "Team", "subteam" to "Subteam", "category" to "Category").forEach { (v, l) -> FilterChip(kind == v, { kind = v; parent = null }, { Text(l) }) } }
                if (kind != "team") {
                    Eyebrow(if (kind == "subteam") "Inside team" else "Inside subteam")
                    if (parents.isEmpty()) Muted(if (h == null) "Pick a House first." else "${ui.house(h)} has no ${if (kind == "subteam") "team" else "subteam"} to put it in yet.")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { parents.forEach { (pid, label) -> FilterChip(parent == pid, { parent = pid }, { Text(label) }) } }
                }
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(desc, { desc = it }, label = { Text("What it is for (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                if (taken) Muted("There is already a $kind with this id: $id")
                else if (id.isNotBlank()) Muted("Id: $id")
                Muted("It starts paused. Nothing runs in it until you start it.")
            }
        },
        confirmButton = { MuButton({ vm.structureCreate(kind, id, if (kind == "team") null else parent, name.trim(), desc, if (kind == "team") JSONObject().put("house", h) else null); onClose() }, enabled = valid) { Text("Add") } },
        dismissButton = { TextButton(onClose) { Text("Cancel") } })
}
