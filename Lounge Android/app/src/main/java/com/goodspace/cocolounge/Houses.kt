package com.goodspace.cocolounge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.json.JSONObject

/** One House: its identity from the contract, the twenty workspace tabs, and only that House's rows in each. */
@Composable
fun HouseWorkspace(vm: Lounge, nav: NavContract, h: HouseDef, tab: String, pick: (String) -> Unit) {
    val i = nav.houseTabs.indexOfFirst { it.first == tab }.coerceAtLeast(0)
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
                nav.houseTabs.forEachIndexed { n, (id, label) -> androidx.compose.material3.Tab(n == i, { pick(id) }, text = { Text(label, maxLines = 1) },
                    selectedContentColor = link, unselectedContentColor = cs.onSurfaceVariant) }
            }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            houseTab(vm, h, nav.houseTabs[i].first)
        }
    }
}

fun LazyListScope.houseTab(vm: Lounge, h: HouseDef, tab: String) {
    val d = vm.data; val id = h.id
    val units = vm.rows("org_units").rows.let { Facts.forHouse(id, it, listOf("id", "house_id")) }
    val products = Facts.forHouse(id, vm.rows("org_products").rows)
    val templates = Facts.forHouse(id, vm.rows("templates").rows, listOf("owner_unit_id")) +
        vm.rows("templates").rows.filter { t -> products.any { it.s("id") == t.s("owner_product_id") } }
    val tasks = d.tasks.filter { it.s("house_id") == id }
    val metrics = Facts.metricsOf(id, vm.rows("org_metrics").rows, vm.rows("org_products").rows)
    @Composable fun unit(u: JSONObject) = Line(u.s("display_name").ifBlank { u.s("id") }, "${u.s("kind")} · ${u.s("id")}", if (u.s("state") == "active") "live" else "planned", if (u.s("state") == "active") "Active" else "Planned")
    val k = "h-$id-$tab"
    when (tab) {
        "overview" -> item(key = k) {
            val live = d.houses.firstOrNull { it.s("id") == id }
            Card {
                Eyebrow("Live status")
                if (vm.dataAt == 0L) Muted("Not read from Coco Cloud yet.")
                else if (live == null) Muted("${h.name} is not in Coco Cloud's House list yet.")
                else { Text(live.s("doing").ifBlank { live.s("role") }, style = MaterialTheme.typography.bodyLarge)
                    listOf("next" to "Next", "blocked" to "Blocked", "publish_rule" to "Rule").forEach { (f, l) -> live.s(f).takeIf { it.isNotBlank() }?.let { Muted("$l: $it", 3) } } }
                // each count only when its source was read; otherwise it is unknown, not 0
                fun n(key: String, count: () -> Int) = vm.rows(key).let { r -> if (r.loaded && r.error == null) "${count()}" else "–" }
                Muted("${n("org_units") { units.size }} units · ${n("org_products") { products.size }} channels and products · ${n("org_agents") { Facts.forHouse(id, vm.rows("org_agents").rows).size }} agents · " +
                    if (vm.dataAt > 0L) "${tasks.count { it.s("status") !in setOf("done", "stopped", "merged", "cancelled") }} open tasks · ${d.approvals.count { it.s("state") == "waiting" && Facts.inHouse(id, it.s("team")) }} waiting for YES" else "tasks and approvals not read yet")
                Muted("Tracks: ${h.metrics.joinToString(", ")}")
            }
        }
        "organization" -> table(vm, "org_units", "The ${h.name} structure", tag = k) { lines(k, "Units (${units.size})", units.sortedBy { it.s("id") }, "No units recorded for ${h.name}.") { unit(it) } }
        "teams" -> table(vm, "org_units", "Teams", tag = k) { lines(k, "Teams and subteams", units.filter { it.s("kind") in setOf("team", "subteam", "group") }, "No teams or subteams recorded for ${h.name}.") { unit(it) } }
        "categories" -> {
            table(vm, "org_units", "Categories", tag = k) { lines(k, "Categories", units.filter { it.s("kind") == "category" }, "No categories in the organisation tree.") { unit(it) } }
            lines("$k-legacy", "Live categories", d.categories.filter { it.s("house_id") == id }, vm.orNotRead("No live categories.")) { c -> Line("%02d · %s".format(c.optInt("code"), c.s("name"))) }
        }
        "channels" -> {
            table(vm, "org_products", "Channels and products", tag = k) { lines(k, "In the organisation (${products.size})", products, "No channels or products recorded.") { p -> Line(p.s("name"), "${p.s("kind")} · ${p.s("platform_id")} · ${p.s("unit_id")}", p.s("status")) } }
            d.offerings.filter { it.s("house_id") == id }.let { offs -> if (offs.isNotEmpty()) { item(key = "$k-oh") { Eyebrow("Live channels and products") }; offs.forEach { o -> item(key = "$k-o-${o.s("id")}") { OfferingCard(o) } } } }
        }
        "brains" -> {
            table(vm, "org_brains", "Brains", tag = k) { b -> lines(k, "Brains", Facts.forHouse(id, b), "No brains configured for ${h.name}.") { x -> Line(x.s("id"), "${x.s("level")} · ${x.s("unit_id")}", x.s("state").let { if (it == "configured") "approved" else it }) } }
            table(vm, "brain_items", "Memory", tag = "$k-m") { b -> lines("$k-m", "What ${h.name} knows", Facts.forHouse(id, b, listOf("team_id", "unit_id")), "No memory items for ${h.name}.") { x -> Line(x.s("title"), "${x.s("kind")} · ${ago(x.s("created_at"))}") } }
        }
        "agents" -> table(vm, "org_agents", "Agents", tag = k) { a -> lines(k, "Agents", Facts.forHouse(id, a), "No agents recorded for ${h.name}.") { x ->
            Line(x.s("name").ifBlank { x.s("registry_agent") }, "${x.s("role")} · ${x.s("unit_id")}", when (x.s("status")) { "placeholder" -> "waiting"; "proposed" -> "planned"; else -> "approved" }, x.s("status").replaceFirstChar { it.uppercase() }) } }
        "automation" -> {
            lines(k, "Workflows", d.pipelines.filter { it.s("house_id") == id }, vm.orNotRead("No workflows for ${h.name}.")) { p -> Line(p.s("name"), null, if (p.optBoolean("active", true)) "live" else "off", if (p.optBoolean("active", true)) "On" else "Off") }
            item(key = "$k-n") { Muted("Automation is edited on the desktop Lounge for now.") }
        }
        "templates" -> table(vm, "templates", "Templates", tag = k) { lines(k, "Templates", templates.distinctBy { it.s("id") }, "No templates owned by ${h.name}.") { t -> Line(t.s("name"), "${t.s("kind")} · v${t.s("current_version")}", t.s("status").let { if (it == "active") "live" else "planned" }, t.s("status")) } }
        "prompts" -> table(vm, "prompts", "Prompt instructions", tag = k) { ps ->
            val ids = templates.map { it.s("id") }.toSet()
            lines(k, "Prompt instructions", ps.filter { it.s("template_id") in ids }, "No prompt instructions on ${h.name}'s templates.") { p -> Line(p.s("name"), "${p.s("kind")} · active v${p.s("active_version")}", if (p.s("status") == "active") "live" else "planned", p.s("status")) }
        }
        "connections" -> table(vm, "integration_links", "Connections", tag = k) { links ->
            val mine = Facts.forHouse(id, links, listOf("team_id", "subteam_id", "category_id", "channel_id", "unit_id"))
            val acc = vm.rows("integration_accounts").rows
            lines(k, "Accounts assigned to ${h.name}", mine, "No account is assigned to ${h.name} yet.") { l ->
                val a = acc.firstOrNull { it.s("connection_id") == l.s("connection_id") }
                Line(a?.s("external_name")?.ifBlank { null } ?: l.s("connection_id"), "${a?.s("provider") ?: ""} · ${listOf("team_id", "subteam_id", "category_id", "channel_id").mapNotNull { l.s(it).ifBlank { null } }.joinToString(" › ")}", a?.s("state"))
            }
        }
        "references" -> table(vm, "org_refs", "Reference assets", tag = k) { r -> lines(k, "Reference assets", Facts.forHouse(id, r), "No reference assets recorded for ${h.name}.") { x -> Line(x.s("title").ifBlank { x.s("name").ifBlank { x.s("id") } }, listOf(x.s("kind"), x.s("url")).filter { it.isNotBlank() }.joinToString(" · ")) } }
        "production" -> {
            lines(k, "Open tasks", tasks.filter { it.s("status") !in setOf("done", "stopped", "merged", "cancelled") }, vm.orNotRead("Nothing in production for ${h.name}.")) { t -> Line(t.s("title"), "${t.s("created_by")} · ${ago(t.s("created_at"))}", t.s("status")) }
            table(vm, "jobs", "Cloud jobs", tag = "$k-j") { j -> lines("$k-j", "Cloud jobs", Facts.forHouse(id, j, listOf("team_id")), "No cloud jobs for ${h.name}.", cap = 20) { x -> Line(x.s("type"), ago(x.s("created_at")), x.s("status")) } }
        }
        "outputs" -> table(vm, "outputs", "Outputs", tag = k) { o -> lines(k, "Outputs", Facts.forHouse(id, o, listOf("unit_id", "team_id", "house_id")), "No outputs recorded for ${h.name}.", cap = 30) { x ->
            Line(x.s("title").ifBlank { x.s("kind").ifBlank { x.s("id") } }, listOf(x.s("kind"), ago(x.s("at"))).filter { it.isNotBlank() }.joinToString(" · "), x.s("status")) } }
        "scheduler" -> lines(k, "Scheduled", d.events.filter { it.s("house_id") == id }.sortedBy { it.s("due_at") }, vm.orNotRead("Nothing scheduled for ${h.name}.")) { e -> Line(e.s("title"), inTime(e.s("due_at")), e.s("status")) }
        "approvals" -> d.approvals.filter { Facts.inHouse(id, it.s("team")) }.let { aps ->
            if (aps.isEmpty()) item(key = k) { Muted(vm.orNotRead("No approvals raised for ${h.name}.")) }
            aps.forEach { a -> item(key = "$k-${a.s("id")}") { ApprovalCard(vm, a) } }
        }
        "analytics" -> {
            table(vm, "org_metrics", "Business metrics", tag = k) { lines(k, "Metrics", metrics.filter { !Facts.isRevenue(it) }, "No ${h.metrics.joinToString("/")} numbers recorded for ${h.name}. Nothing is estimated.") { m -> Line(m.s("metric"), "${m.s("value").ifBlank { "no value" }} ${m.s("unit")} · ${m.s("period")} · ${m.s("source")} · ${asOf(Facts.stamp(m))}") } }
            if (id == "gigi") item(key = "$k-yt") { vm.rows("yt").rows.firstOrNull()?.let { y -> Card { Eyebrow("YouTube · The Flow"); Muted(y.optJSONObject("channel")?.let { "${it.opt("views")} views · ${it.opt("subscribers")} subscribers" } ?: "Not collected yet"); Muted(y.s("label")) } } }
        }
        "revenue" -> item(key = k) {
            val met = vm.rows("org_metrics"); val r = revenueOf(met, metrics)
            Card { Eyebrow("${h.name} revenue · last ${Facts.DAYS} days"); Text(r.text, style = MaterialTheme.typography.headlineSmall); Muted(revenueNote(met, r)) }
        }
        "activity" -> lines(k, "Activity history", tasks.sortedByDescending { it.s("updated_at").ifBlank { it.s("created_at") } }, vm.orNotRead("No activity recorded for ${h.name}."), cap = 30) { t ->
            Line(t.s("title"), "${t.s("status")} · ${ago(t.s("updated_at").ifBlank { t.s("created_at") })} · by ${t.s("created_by")}") }
        "settings" -> {
            table(vm, "policies", "Policies", tag = k) { p -> lines(k, "Policies for ${h.name}", p.filter { Facts.inHouse(id, it.s("scope_id")) }, "No House-level policies; the company defaults apply.") { x -> Line("${x.s("scope")} · ${x.s("key")}", "= ${x.opt("value")}") } }
            item(key = "$k-n") { Muted("House settings are changed on the desktop Lounge for now.") }
        }
        else -> item(key = k) { Muted("Not on Android yet.") }
    }
}
