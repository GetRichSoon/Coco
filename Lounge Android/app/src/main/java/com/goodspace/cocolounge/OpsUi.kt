@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.goodspace.cocolounge

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONObject

/*
 * The operating screens: Home, Tasks (list, board, detail, create, assign), Jobs, Approval detail, Connections (list, detail, key), Revenue and
 * YouTube. All of it reads the ORIGINAL tables through the ViewModel and writes through the same moves the web twin uses (TaskRules follows
 * ui-kit.js). A call that Nova cannot answer yet says "Not available yet: <reason>" (Lounge.said); nothing here pretends a write worked.
 */

/** What a screen can ask the shell to do: open a detail, the New task form, a section page, a House or a global screen. */
class UiNav(val nav: NavContract, val go: (String) -> Unit, val openHouse: (String) -> Unit, val openGlobal: (String) -> Unit, val detail: (String) -> Unit, val newTask: (String?) -> Unit) {
    val houses get() = nav.houses
    /** A House's name for people; no House means the company itself. */
    fun house(id: String?): String = id?.takeIf { it.isNotBlank() && it != "null" }?.let { nav.house(it)?.label ?: it } ?: "Company"
    fun task(id: String) = detail("task:$id"); fun approval(id: String) = detail("approval:$id"); fun job(id: String) = detail("job:$id"); fun conn(key: String) = detail("conn:$key")
    fun open(a: Attn) = when (a.kind) {
        "approval" -> approval(a.id); "task" -> task(a.id); "job" -> job(a.id); "integration" -> conn("i:" + a.id); "account" -> conn("a:" + a.id)
        "runreq" -> if (a.id.startsWith("req-")) go("runs") else task(a.id)   // a failed cloud run opens the task it was asked for
        "policy" -> go("system"); else -> go("cloud")
    }
}
class NewTaskSeed(val house: String?)

// ---------------------------------------------------------------- small pieces
@Composable
fun Fact(label: String, value: String?) {
    if (value.isNullOrBlank()) return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(label, Modifier.width(96.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
    }
}

/** A card that opens something. */
@Composable
fun TapCard(onClick: () -> Unit, content: @Composable ColumnScope.() -> Unit) = Card(Modifier.clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick), content = content)

@Composable
fun ChipRow(content: @Composable RowScope.() -> Unit) = Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, content = content)

@Composable
fun Tile(value: String, label: String, sub: String?, modifier: Modifier = Modifier, badge: Int = 0, onClick: (() -> Unit)? = null) {
    PanelSurface(modifier.clip(RoundedCornerShape(16.dp)).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)) {
        Column(Modifier.padding(12.dp, 10.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                if (badge > 0) Surface(color = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError, shape = RoundedCornerShape(50)) {
                    Text("$badge failed", Modifier.padding(horizontal = 7.dp, vertical = 1.dp), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 1)
                }
            }
            Text(value, style = MaterialTheme.typography.headlineMedium)
            sub?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1) }
        }
    }
}

@Composable
fun QuickAction(icon: ImageVector, label: String, modifier: Modifier = Modifier, primary: Boolean = false, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Surface(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(16.dp), color = if (primary) cs.primary else cs.secondaryContainer, contentColor = if (primary) cs.onPrimary else cs.onSecondaryContainer) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Icon(icon, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(label, style = MaterialTheme.typography.labelLarge, maxLines = 1)
        }
    }
}

@Composable
fun AttnRow(a: Attn, onClick: () -> Unit) = TapCard(onClick) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(when (a.kind) { "approval" -> sym("verified"); "task", "runreq" -> sym("task_alt"); "job" -> sym("bolt"); "worker" -> Icons.Rounded.CloudOff; "policy" -> sym("security"); else -> sym("hub") }, null, tint = LocalCocoRoles.current.link)
        Column(Modifier.weight(1f)) { Text(a.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis); Muted(a.sub, 2) }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            StatusChip(a.chip, a.chipText)
            Text(a.action, style = MaterialTheme.typography.labelMedium, color = LocalCocoRoles.current.link)
        }
    }
}

/** The honest one-liner about who can run the queue, as a card: a warning when nobody can. */
@Composable
fun WorkerCard(vm: Lounge, ui: UiNav) {
    val known = vm.dataAt > 0L; val w = Workers.status(vm.data.devices); val ok = w.cloud?.online == true
    TapCard({ ui.go("cloud") }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(10.dp).background(if (ok) LocalCocoRoles.current.success else MaterialTheme.colorScheme.outline, CircleShape))
            Text(Workers.line(vm.data.devices, known, jobs = vm.rows("jobs").rows), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
    }
}

private fun open(ctx: android.content.Context, url: String) { if (url.startsWith("http")) runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }

// ---------------------------------------------------------------- HOME: four tiles, what needs me, what is running, three quick actions
fun LazyListScope.home(vm: Lounge, ui: UiNav) {
    val d = vm.data; val known = vm.dataAt > 0L
    val jobs = vm.rows("jobs"); val accounts = vm.rows("integration_accounts").rows
    val rows = Attention.rows(d.tasks, d.approvals, jobs.rows, d.integrations, accounts, d.devices, java.time.Instant.now(), vm.rows("run_requests").rows, vm.rows("policies").rows)
    val t = Attention.tiles(d.tasks, d.approvals, jobs.rows, rows)
    val w = Workers.status(d.devices)
    item(key = "hero") {
        val hour = remember(rememberTicker(60_000L)) { java.time.LocalTime.now().hour }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LivingMark(Marks.coco, 44.dp)
            Column(Modifier.weight(1f)) {
                Text(greeting(hour, vm.callMe), style = MaterialTheme.typography.headlineSmall, maxLines = 1)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(8.dp).background(if (vm.live) LocalCocoRoles.current.success else MaterialTheme.colorScheme.outline, CircleShape))
                    Muted(when { !known -> "Waiting for Coco Cloud"; d.paused -> "Coco is paused. Nothing new starts until you resume."
                        else -> (if (vm.live) "Live" else "Reconnecting") + w.cloud?.let { " · cloud worker last ran ${ago(it.lastSeen)}" }.orEmpty() }, 1)
                }
            }
        }
    }
    item(key = "tiles") {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
            val toTasks = { f: TaskRules.Filter -> vm.tasksTab = "tasks"; vm.taskFilter = f; vm.taskHouse = null; vm.taskQuery = ""; ui.go("tasks") }
            Tile(if (known) "${t.open}" else "–", "Open tasks", if (known) "planned, queued, paused, running" else "not read yet", Modifier.weight(1f), badge = t.failed) { toTasks(TaskRules.Filter.Open) }
            Tile(if (known) "${t.running}" else "–", "Running now", if (known) "tasks and cloud jobs" else "not read yet", Modifier.weight(1f)) {
                if (d.tasks.any { TaskRules.inFilter(it, TaskRules.Filter.Running) }) toTasks(TaskRules.Filter.Running) else { vm.tasksTab = "jobs"; ui.go("tasks") }
            }
            Tile(if (known) "${t.waiting}" else "–", "Waiting for YES", "approvals", Modifier.weight(1f)) { ui.go("approvals") }
            val first = rows.firstOrNull { it.kind != "approval" && it.tone != "info" }
            Tile(if (known) "${t.alerts}" else "–", "Alerts", if (known) "failed work, errors, offline" else "not read yet", Modifier.weight(1f), onClick = first?.let { f -> { ui.open(f) } })
        }
    }
    item(key = "quick") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickAction(Icons.Rounded.Add, "New task", Modifier.weight(1.2f), primary = true) { ui.newTask(null) }
            QuickAction(sym("forum"), "Ask COCO", Modifier.weight(1.2f)) { ui.openGlobal("chat") }
            QuickAction(sym("settings_remote"), "Remote", Modifier.weight(1f)) { ui.openGlobal("remote") }
        }
    }
    val shown = rows.take(8)
    item(key = "attn-h") { Section("Needs attention" + if (known) " (${rows.count { it.tone != "info" }})" else "") }
    if (!known) item(key = "attn-wait") { Muted("Not read from Coco Cloud yet.") }
    else if (rows.isEmpty()) item(key = "attn-none") { Card { Text("Nothing needs you right now.", style = MaterialTheme.typography.titleSmall) } }
    else items(shown, key = { "attn-" + it.kind + "-" + it.id }) { a -> AttnRow(a) { ui.open(a) } }
    if (rows.size > shown.size) item(key = "attn-more") { TextButton({ vm.tasksTab = "tasks"; vm.taskFilter = TaskRules.Filter.Failed; ui.go("tasks") }) { Text("${rows.size - shown.size} more in Tasks") } }

    item(key = "work-h") { Section("Active work") }
    val running = d.tasks.filter { TaskRules.inFilter(it, TaskRules.Filter.Running) }
    val jobsRunning = JobRules.running(jobs.rows)
    if (!known) item(key = "work-wait") { Muted("Not read from Coco Cloud yet.") }
    else if (running.isEmpty() && jobsRunning.isEmpty()) item(key = "work-none") {
        Card { Text("Nothing is running right now.", style = MaterialTheme.typography.titleSmall); Muted("Cloud runs happen about twice a day, so work you start waits for the next run.", 2) }
    }
    items(running, key = { "run-" + it.s("id") }) { r ->
        val prog = TaskRules.progress(r, d.pipelines)
        TapCard({ ui.task(r.s("id")) }) {
            Text(r.s("title"), style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Muted(listOfNotNull(vm.memberName(r.s("member_id")).ifBlank { "Unassigned" }, ui.house(r.s("house_id")), prog?.let { "${it.pipeline} · ${it.label}" }, r.s("claimed_by_device").takeIf { it.isNotBlank() }?.let { "on ${vm.deviceName(it)}" },
                r.s("heartbeat_at").takeIf { it.isNotBlank() }?.let { "alive ${ago(it)}" }).joinToString(" · "), 3)
            prog?.ratio?.let { LinearProgressIndicator({ it }, Modifier.fillMaxWidth()) }
        }
    }
    items(jobsRunning, key = { "jrun-" + it.s("id") }) { j ->
        TapCard({ ui.job(j.s("id")) }) {
            Text("Job: ${j.s("type")}", style = MaterialTheme.typography.titleSmall)
            Muted(listOfNotNull(j.s("team_id").ifBlank { null }, "attempt ${j.s("attempt")} of ${j.s("max_attempts")}", j.s("lease_owner").takeIf { it.isNotBlank() }?.let { "worker $it" }, j.s("started_at").takeIf { it.isNotBlank() }?.let { "started ${ago(it)}" }).joinToString(" · "), 2)
        }
    }
}

// ---------------------------------------------------------------- TASKS: the real list, the board, the detail, every move, and the jobs behind them
fun LazyListScope.tasksPage(vm: Lounge, ui: UiNav) {
    val d = vm.data; val known = vm.dataAt > 0L; val jobs = vm.rows("jobs")
    item(key = "t-top") {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChipRow {
                    FilterChip(vm.tasksTab == "tasks", { vm.tasksTab = "tasks" }, { Text("Tasks") })
                    FilterChip(vm.tasksTab == "jobs", { vm.tasksTab = "jobs" }, { Text("Jobs" + if (jobs.loaded && jobs.error == null) " (${jobs.rows.count { it.s("status") in setOf("queued", "running", "blocked", "failed") }})" else "") })
                }
                Spacer(Modifier.weight(1f))
                MuButton({ ui.newTask(vm.taskHouse?.takeIf { it != "none" }) }) { Icon(Icons.Rounded.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(4.dp)); Text("New") }
            }
            WorkerCard(vm, ui)
        }
    }
    if (vm.tasksTab == "jobs") {
        item(key = "j-filters") { ChipRow { JobRules.Filter.entries.forEach { f -> FilterChip(vm.jobFilter == f, { vm.jobFilter = f }, { Text(f.label + if (jobs.loaded && jobs.error == null) " ${JobRules.list(jobs.rows, f).size}" else "") }) } } }
        when {
            !jobs.loaded -> item(key = "j-wait") { Muted("Reading the job queue…") }
            jobs.error != null -> item(key = "j-err") { Card { Text(if (jobs.missing) "The job queue is not set up in Coco Cloud yet" else "The job queue could not be read right now", style = MaterialTheme.typography.titleSmall); Muted(jobs.error) } }
            else -> {
                val list = JobRules.list(jobs.rows, vm.jobFilter)
                if (list.isEmpty()) item(key = "j-none") { Card { Muted(if (vm.jobFilter == JobRules.Filter.Open) "No job is open." else "No job matches.") } }
                items(list.take(80), key = { "job-" + it.s("id") }) { j -> JobRow(ui, j) }
                if (list.size > 80) item(key = "j-more") { Muted("Showing the latest 80 of ${list.size}.") }
                item(key = "j-note") { Muted("Cancel works on queued, running and blocked jobs. Retry puts a failed, cancelled or blocked job back in the queue. Both are decided by the cloud, not by this screen.") }
            }
        }
        return
    }
    item(key = "t-filters") {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ChipRow { TaskRules.Filter.entries.forEach { f -> FilterChip(vm.taskFilter == f, { vm.taskFilter = f }, { Text(f.label + if (known) " ${TaskRules.count(d.tasks, f)}" else "") }) } }
            OutlinedTextField(vm.taskQuery, { vm.taskQuery = it }, placeholder = { Text("Search tasks") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Rounded.Search, null) }, trailingIcon = { if (vm.taskQuery.isNotEmpty()) IconButton({ vm.taskQuery = "" }) { Icon(Icons.Rounded.Close, "Clear the search") } })
            ChipRow {
                FilterChip(vm.taskHouse == null, { vm.taskHouse = null }, { Text("All Houses") })
                FilterChip(vm.taskHouse == "none", { vm.taskHouse = if (vm.taskHouse == "none") null else "none" }, { Text("No House") })
                ui.houses.forEach { h -> FilterChip(vm.taskHouse == h.id, { vm.taskHouse = if (vm.taskHouse == h.id) null else h.id }, { Text(h.label) }) }
            }
        }
    }
    val list = TaskRules.list(d.tasks, vm.taskFilter, vm.taskHouse, vm.taskQuery) { t -> ui.house(t.s("house_id")) + " " + vm.memberName(t.s("member_id")) }
    if (!known) item(key = "t-wait") { Muted("Reading tasks from Coco Cloud…") }
    else if (list.isEmpty()) item(key = "t-none") { Card { Muted(if (d.tasks.isEmpty()) "There are no tasks yet. Press New to create the first one." else "No task matches this filter.") } }
    else items(list.take(120), key = { "task-" + it.s("id") }) { t -> TaskRow(vm, ui, t) }
    if (list.size > 120) item(key = "t-more") { Muted("Showing 120 of ${list.size}. Narrow it with the search or the House.") }
}

/** The old Board route: the same tasks in columns by status; each card opens its detail. */
fun LazyListScope.taskBoard(vm: Lounge, ui: UiNav) {
    val d = vm.data
    val cols = listOf("planned" to "Planned", "queued" to "Queued", "running" to "Running", "paused" to "Paused", "failed" to "Failed", "done" to "Done", "stopped" to "Stopped")
    fun inCol(t: JSONObject, k: String) = TaskRules.real(t) && when (k) { "running" -> t.s("status") in TaskRules.RUNNING; "stopped" -> t.s("status") in setOf("stopped", "cancelled"); else -> t.s("status") == k }
    item(key = "b-note") { Muted("The same tasks in columns by status. Open a card to start, pause, retry, cancel, assign or add a note.") }
    cols.forEach { (k, label) ->
        val l = d.tasks.filter { inCol(it, k) }
        item(key = "col-$k") {
            Card {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { Text(label, style = MaterialTheme.typography.titleSmall); StatusChip(if (k == "stopped" || k == "paused") "other" else k, "${l.size}") }
                if (vm.dataAt == 0L) Muted("Not read from Coco Cloud yet.") else if (l.isEmpty()) Muted("Empty")
                l.take(12).forEach { t -> Line(t.s("title"), listOfNotNull(t.s("house_id").takeIf { it.isNotBlank() }?.let { ui.house(it) }, vm.memberName(t.s("member_id")).takeIf { it.isNotBlank() }).joinToString(" · ").ifBlank { "No House" }) { ui.task(t.s("id")) } }
                if (l.size > 12) TextButton({ vm.tasksTab = "tasks"; vm.taskFilter = when (k) { "done" -> TaskRules.Filter.Done; "failed" -> TaskRules.Filter.Failed; "stopped" -> TaskRules.Filter.Stopped; "running" -> TaskRules.Filter.Running; else -> TaskRules.Filter.Open }; ui.go("tasks") }) { Text("${l.size - 12} more") }
            }
        }
    }
}

@Composable
fun TaskRow(vm: Lounge, ui: UiNav, t: JSONObject) {
    val status = t.s("status"); val prog = TaskRules.progress(t, vm.data.pipelines); val prio = t.optInt("priority", 2)
    val wait = TaskRules.wait(t, Workers.status(vm.data.devices), vm.rows("run_requests").rows)
    TapCard({ ui.task(t.s("id")) }) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(t.s("title"), style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Muted(listOfNotNull(t.s("house_id").takeIf { it.isNotBlank() }?.let { ui.house(it) }, vm.memberName(t.s("member_id")).ifBlank { "Unassigned" }, prog?.let { "${it.pipeline} · ${it.label}" }, ago(t.s("created_at"))).joinToString(" · "), 2)
                prog?.ratio?.let { LinearProgressIndicator({ it }, Modifier.fillMaxWidth().padding(top = 4.dp)) }
                wait?.let { Muted(it, 2) }
                t.s("error").takeIf { it.isNotBlank() }?.let { Text(it.take(140), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                StatusChip(status, TaskRules.statusText(status)); if (prio != 2) StatusChip(if (prio == 1) "late" else "other", TaskRules.priorityLabel(prio))
            }
        }
    }
}

@Composable
fun TaskDetail(vm: Lounge, ui: UiNav, id: String) {
    val ctx = LocalContext.current
    val d = vm.data; val t = d.tasks.firstOrNull { it.s("id") == id }
    var confirmCancel by remember { mutableStateOf(false) }
    var assign by remember { mutableStateOf(false) }
    var enqueue by remember { mutableStateOf(false) }
    var confirmRun by remember { mutableStateOf<TaskRules.Act?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (t == null) { item(key = "gone") { Card { Text("This task is not in the list.", style = MaterialTheme.typography.titleSmall); Muted("It may have been removed, or it is still loading.") } }; return@LazyColumn }
        val status = t.s("status"); val prio = t.optInt("priority", 2)
        val pipe = d.pipelines.firstOrNull { it.s("id") == t.s("pipeline_id") }; val prog = TaskRules.progress(t, d.pipelines)
        val reqs = vm.rows("run_requests"); val mineReq = RunRequests.of(id, reqs.rows); val live = mineReq.any { RunRequests.live(it) }
        val wait = TaskRules.wait(t, Workers.status(d.devices), reqs.rows)
        item(key = "head") {
            Card {
                Text(t.s("title"), style = MaterialTheme.typography.titleLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatusChip(status, TaskRules.statusText(status)); if (prio != 2) StatusChip(if (prio == 1) "late" else "other", TaskRules.priorityLabel(prio) + " priority")
                }
                Muted(listOfNotNull(t.s("house_id").takeIf { it.isNotBlank() }?.let { ui.house(it) } ?: "No House", t.s("category").takeIf { it.isNotBlank() }?.let { "category $it" },
                    t.s("platform_id").takeIf { it.isNotBlank() }?.let { "platform $it" }, "needs ${t.s("needs").ifBlank { "any" }}",
                    "created ${ago(t.s("created_at"))} by ${t.s("created_by").ifBlank { "unknown" }}" + t.s("created_device").takeIf { it.isNotBlank() }?.let { " on ${vm.deviceName(it)}" }.orEmpty(), "updated ${ago(t.s("updated_at"))}").joinToString(" · "))
                wait?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = LocalCocoRoles.current.link) }
                if (status in TaskRules.RUNNING) Muted("Running on ${vm.deviceName(t.s("claimed_by_device"))} since ${ago(t.s("claimed_at"))}; last heartbeat ${ago(t.s("heartbeat_at"))}.")
                if (status == "verifying") Muted("Finished. A founder must check it.")
                if (status in TaskRules.NEEDS_ME) Muted("This task needs a founder.")
            }
        }
        item(key = "worker") { WorkerCard(vm, ui) }
        item(key = "actions") {
            Card {
                val acts = TaskRules.actions(status, live)
                if (acts.isEmpty() && (status in TaskRules.FINISHED)) Muted("This task is finished. There is nothing left to run.")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    acts.forEach { a ->
                        when (a) {
                            TaskRules.Act.Cancel -> TextButton({ confirmCancel = true }) { Text("Cancel task") }
                            TaskRules.Act.Pause -> MuTonal({ vm.taskAct(t, a) }) { Text("Pause") }
                            TaskRules.Act.Start, TaskRules.Act.Retry -> MuButton({ confirmRun = a }) { Text(a.label) }
                            else -> MuButton({ vm.taskAct(t, a) }) { Text(a.label) }
                        }
                    }
                    MuTonal({ vm.dialog = Lounge.Dialog.AddPoints(id, t.s("title")) }) { Text("Add note") }
                    if (status in TaskRules.ASSIGNABLE) MuTonal({ assign = true }) { Text("Assign") }
                }
                if (status in TaskRules.ASSIGNABLE) {
                    Muted("Priority (High runs first)")
                    ChipRow { TaskRules.PRIORITIES.forEach { p -> FilterChip(prio == p, { if (prio != p) vm.taskPriority(t, p) }, { Text(TaskRules.priorityLabel(p)) }) } }
                }
            }
        }
        t.s("error").takeIf { it.isNotBlank() }?.let { e -> item(key = "error") { Card(alert = true) { Text("Error", style = MaterialTheme.typography.labelLarge); Text(e, style = MaterialTheme.typography.bodyMedium)
            if (t.optInt("retry_count") > 0) Muted("Retried ${t.optInt("retry_count")} time${if (t.optInt("retry_count") == 1) "" else "s"}") } } }
        // how the cloud is asked to do it: a run request for the team's <team>-pick workflow. Cloud runs happen about twice a day, so nothing starts at once.
        item(key = "cloudrun") {
            Card {
                Eyebrow("Cloud run")
                Muted("Team: ${TaskRules.teamOf(t) ?: "none (assign a House)"}" + (TaskRules.workflowOf(t)?.let { " · workflow $it" } ?: ""), 2)
                when {
                    !reqs.loaded -> Muted("Reading…")
                    reqs.error != null -> Muted(if (reqs.missing) "Cloud run requests are not set up in Coco Cloud yet." else "Cloud runs could not be read right now: ${reqs.error}")
                    mineReq.isEmpty() -> Muted("No cloud run has been asked for this task. Press Start to ask for one. Cloud runs happen about twice a day, so nothing starts at once.")
                    else -> mineReq.forEach { r -> Line("Request #${r.s("id")} · ${r.s("workflow_id")}", listOfNotNull(r.s("reason").ifBlank { null }, "asked ${ago(r.s("created_at"))}").joinToString(" · "), if (RunRequests.bad(r)) "failed" else if (r.s("state") == "done") "done" else "waiting",
                        when (r.s("state")) { "pending" -> "Waiting for the next run"; "claimed" -> "Claimed"; else -> r.s("state").replaceFirstChar { it.uppercase() } }) }
                }
            }
        }
        item(key = "facts") {
            Card {
                Eyebrow("Details")
                Text(t.s("details").ifBlank { "No details were written." }, style = MaterialTheme.typography.bodyMedium, color = if (t.s("details").isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                Fact("Assignee", vm.memberName(t.s("member_id")).ifBlank { "Unassigned" })
                Fact("Pipeline", prog?.let { "${it.pipeline} · ${it.label}" + (TaskRules.stepOf(pipe, ((it.step ?: 1) - 1).coerceAtLeast(0))?.s("do")?.takeIf { _ -> it.step != null }?.let { s -> ": $s" } ?: "") } ?: "None")
                prog?.ratio?.let { LinearProgressIndicator({ it }, Modifier.fillMaxWidth()) }
                Fact("Platform", d.platforms.firstOrNull { it.s("id") == t.s("platform_id") }?.s("name"))
                Fact("Claimed by", t.s("claimed_by_device").takeIf { it.isNotBlank() }?.let { "${vm.deviceName(it)} ${ago(t.s("claimed_at"))}" + t.s("heartbeat_at").takeIf { h -> h.isNotBlank() }?.let { h -> " · alive ${ago(h)}" }.orEmpty() })
                Fact("Result", t.s("result")); Fact("Evidence", t.s("evidence")); Fact("Task id", t.s("id").take(8))
            }
        }
        item(key = "notes") {
            val notes = d.notes.filter { it.s("task_id") == id }.sortedBy { it.s("at") }
            Card {
                Eyebrow("Notes (${notes.size})")
                if (notes.isEmpty()) Muted("No notes yet.")
                notes.forEach { n -> Column { Text(n.s("note"), style = MaterialTheme.typography.bodyMedium); Muted("${n.s("by_email")} · ${ago(n.s("at"))}", 1) } }
            }
        }
        // outputs and related jobs reach a task through its runs (runs.task_id)
        val runs = vm.rows("runs"); val myRuns = runs.rows.filter { it.s("task_id") == id }; val runIds = myRuns.map { it.s("run_id") }.toSet()
        item(key = "outputs") {
            val o = vm.rows("outputs"); val outs = o.rows.filter { it.s("run_id") in runIds }
            Card {
                Eyebrow("Outputs (${outs.size})")
                when {
                    !o.loaded || !runs.loaded -> Muted("Reading…")
                    o.error != null -> Muted("Could not be read right now: ${o.error}")
                    outs.isEmpty() -> Muted(if (myRuns.isNotEmpty()) "This task has run, but no output was recorded for it." else "No run is linked to this task yet, so there is no output.")
                    else -> outs.forEach { x -> Line(x.s("title").ifBlank { x.s("id") }, listOf(x.s("kind"), ago(x.s("at"))).filter { it.isNotBlank() }.joinToString(" · "), x.s("status"), onClick = x.s("url").takeIf { it.startsWith("http") }?.let { u -> { open(ctx, u) } }) }
                }
            }
        }
        item(key = "related") {
            val j = vm.rows("jobs"); val js = (j.rows.filter { it.s("run_id") in runIds && it.s("run_id").isNotBlank() } + JobRules.ofTask(id, j.rows)).distinctBy { it.s("id") }
            Card {
                Eyebrow("Related jobs (${js.size})")
                when {
                    !runs.loaded || !j.loaded -> Muted("Reading…")
                    runs.error != null -> Muted("Runs could not be read right now: ${runs.error}")
                    else -> {
                        if (js.isEmpty() && myRuns.isEmpty()) Muted("No job or run is linked to this task.")
                        js.forEach { x -> Line("${x.s("type")} · attempt ${x.s("attempt")} of ${x.s("max_attempts")}", x.s("run_id").ifBlank { x.s("idempotency_key") }, x.s("status")) { ui.job(x.s("id")) } }
                        myRuns.forEach { r -> Line("Run ${r.s("run_id")}", listOfNotNull(r.s("title").ifBlank { null }, ago(r.s("opened_at"))).joinToString(" · "), r.s("status")) { ui.go("runs") } }
                    }
                }
                // five zero-AI cloud jobs (no model call, nothing published): a task can start one directly. Hidden when the database has no such door yet.
                if (!vm.enqueueMissing && status in TaskRules.ASSIGNABLE) TextButton({ enqueue = true }) { Text("Run as a cloud job (no AI)") }
            }
        }
    }
    if (confirmCancel && t != null) AlertDialog(onDismissRequest = { confirmCancel = false }, title = { Text("Cancel this task?") },
        text = { Text("It is marked stopped and no worker will pick it up. A step a worker already started may still finish.") },
        confirmButton = { MuButton({ vm.taskAct(t, TaskRules.Act.Cancel); confirmCancel = false }) { Text("Cancel task") } },
        dismissButton = { TextButton({ confirmCancel = false }) { Text("Keep it") } })
    if (assign && t != null) AssignDialog(vm, ui, t) { assign = false }
    confirmRun?.let { act -> if (t != null) AlertDialog(onDismissRequest = { confirmRun = null }, title = { Text(if (act == TaskRules.Act.Retry) "Ask the cloud to run it again?" else "Ask the cloud to run this task?") },
        text = { Text("This asks the cloud for a run of team ${TaskRules.teamOf(t) ?: "(none)"}. It runs at the next cloud run (about twice a day), not at once, and only one run per team can wait at a time.") },
        confirmButton = { MuButton({ vm.taskAct(t, act); confirmRun = null }, enabled = TaskRules.teamOf(t) != null) { Text(act.label) } }, dismissButton = { TextButton({ confirmRun = null }) { Text("Not now") } }) }
    if (enqueue && t != null) AlertDialog(onDismissRequest = { enqueue = false }, title = { Text("Run as a cloud job") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Muted("These cloud jobs use no AI and publish nothing. One runs on the next worker run.")
                JobRules.ZERO_AI.forEach { (type, label) -> Line(label, type) { vm.taskEnqueue(t, type); enqueue = false } }
            }
        },
        confirmButton = { TextButton({ enqueue = false }) { Text("Close") } })
}

@Composable
fun AssignDialog(vm: Lounge, ui: UiNav, t: JSONObject, onClose: () -> Unit) {
    var member by remember { mutableStateOf(t.s("member_id").ifBlank { null }) }
    var house by remember { mutableStateOf(t.s("house_id").ifBlank { null }) }
    var pipe by remember { mutableStateOf(t.s("pipeline_id").ifBlank { null }) }
    AlertDialog(onDismissRequest = onClose, title = { Text("Assign task") },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow("Assignee")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(member == null, { member = null }, { Text("Nobody") })
                    vm.data.members.forEach { m -> FilterChip(member == m.s("id"), { member = m.s("id") }, { Text(m.s("name")) }) }
                }
                Eyebrow("House")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(house == null, { house = null }, { Text("No House") })
                    ui.houses.forEach { h -> FilterChip(house == h.id, { house = h.id }, { Text(h.label) }) }
                }
                Eyebrow("Pipeline")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(pipe == null, { pipe = null }, { Text("None") })
                    vm.data.pipelines.forEach { p -> FilterChip(pipe == p.s("id"), { pipe = p.s("id") }, { Text("${p.s("name").ifBlank { p.s("id") }} (${ui.house(p.s("house_id"))})") }) }
                }
            }
        },
        confirmButton = { MuButton({ vm.taskAssign(t, member, house, pipe); onClose() }) { Text("Save assignment") } },
        dismissButton = { TextButton(onClose) { Text("Cancel") } })
}

@Composable
fun NewTaskDialog(vm: Lounge, ui: UiNav, seed: NewTaskSeed, onClose: () -> Unit) {
    var title by remember { mutableStateOf("") }; var details by remember { mutableStateOf("") }
    var house by remember { mutableStateOf(seed.house) }; var needs by remember { mutableStateOf("cloud") }
    var priority by remember { mutableStateOf(2) }; var member by remember { mutableStateOf<String?>(null) }
    var category by remember { mutableStateOf<String?>(null) }; var start by remember { mutableStateOf(false) }
    AlertDialog(onDismissRequest = onClose, title = { Text("New task") },
        text = {
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("What should be done?") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(details, { details = it }, label = { Text("Details (optional)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                Eyebrow("House")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(house == null, { house = null; category = null }, { Text("No House") })
                    ui.houses.forEach { h -> FilterChip(house == h.id, { house = h.id; category = null }, { Text(h.label) }) }
                }
                Muted(TaskRules.HOUSE_TEAM[house.orEmpty()]?.let { "The cloud team for this House: $it" } ?: "Choose a House so the cloud knows which team does it.", 2)
                val cats = vm.data.categories.filter { it.s("house_id") == house }
                if (cats.isNotEmpty()) {
                    Eyebrow("Category")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { cats.forEach { c -> FilterChip(category == c.s("name"), { category = if (category == c.s("name")) null else c.s("name") }, { Text(c.s("name")) }) } }
                }
                Eyebrow("Assign to")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(member == null, { member = null }, { Text("Nobody yet") })
                    vm.data.members.forEach { m -> FilterChip(member == m.s("id"), { member = m.s("id") }, { Text(m.s("name")) }) }
                }
                Eyebrow("Priority")
                ChipRow { TaskRules.PRIORITIES.forEach { p -> FilterChip(priority == p, { priority = p }, { Text(TaskRules.priorityLabel(p)) }) } }
                Eyebrow("Where can it run?")
                ChipRow { listOf("cloud" to "Cloud", "pc" to "A PC").forEach { (v, l) -> FilterChip(needs == v, { needs = v }, { Text(l) }) } }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Ask the cloud to run it now", style = MaterialTheme.typography.bodyLarge)
                        Muted(if (start) "A cloud run is asked for now. Cloud runs happen about twice a day, so it waits for the next one." else "The task waits, queued. Open it and press Start when it should run.", 3)
                    }
                    Switch(start, { start = it })
                }
            }
        },
        confirmButton = { MuButton({ vm.createTask(Lounge.NewTask(title.trim(), details.trim(), house, needs, priority, member, category, null, start)) { ui.task(it) }; onClose() }, enabled = title.isNotBlank()) { Text("Create task") } },
        dismissButton = { TextButton(onClose) { Text("Cancel") } })
}

// ---------------------------------------------------------------- JOBS (the durable queue; control goes through the coco_job_* RPCs)
@Composable
fun JobRow(ui: UiNav, j: JSONObject) {
    val house = HouseMap.houseOfTeam(ui.houses, j.s("team_id"))
    TapCard({ ui.job(j.s("id")) }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text(j.s("type"), style = MaterialTheme.typography.titleSmall)
                Muted(listOfNotNull(j.s("team_id").ifBlank { null }, house?.let { ui.house(it) }, "attempt ${j.s("attempt")} of ${j.s("max_attempts")}", ago(j.s("updated_at").ifBlank { j.s("created_at") }), j.s("lease_owner").takeIf { it.isNotBlank() }?.let { "worker $it" }).joinToString(" · "), 2)
                JobRules.problem(j).takeIf { it.isNotBlank() && j.s("status") != "done" }?.let { Text(it.take(160), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            }
            StatusChip(j.s("status"))
        }
    }
}

@Composable
fun JobDetail(vm: Lounge, ui: UiNav, id: String) {
    val j = vm.rows("jobs").rows.firstOrNull { it.s("id") == id }
    var confirm by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (j == null) { item(key = "gone") { Card { Text("This job is not in the latest list from Coco Cloud.", style = MaterialTheme.typography.titleSmall) } }; return@LazyColumn }
        val status = j.s("status")
        item(key = "head") {
            Card {
                Text(j.s("type"), style = MaterialTheme.typography.titleLarge)
                StatusChip(status)
                Muted(when (status) { "queued" -> "Queued. A cloud worker picks it up. ${Workers.line(vm.data.devices, vm.dataAt > 0L)}"; "running" -> "Running, leased by ${j.s("lease_owner").ifBlank { "a worker" }} until ${inTime(j.s("lease_until"))}."
                    "blocked" -> "Blocked: no worker knows how to run this kind of job."; "failed" -> "Failed ${ago(j.s("failed_at").ifBlank { j.s("updated_at") })}."; "cancelled" -> "Cancelled ${ago(j.s("failed_at").ifBlank { j.s("updated_at") })}."
                    else -> "Finished ${ago(j.s("completed_at").ifBlank { j.s("updated_at") })}." })
            }
        }
        JobRules.problem(j).takeIf { it.isNotBlank() }?.let { e -> item(key = "error") { Card(alert = status != "done") { Text("Why", style = MaterialTheme.typography.labelLarge); Text(e, style = MaterialTheme.typography.bodyMedium) } } }
        item(key = "actions") {
            Card {
                if (!JobRules.canCancel(status) && !JobRules.canRetry(status)) Muted("This job is finished. There is nothing to run.")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (JobRules.canRetry(status)) MuButton({ vm.jobRetry(j.s("id")) }) { Text("Retry") }
                    if (JobRules.canCancel(status)) TextButton({ confirm = true }) { Text("Cancel job") }
                    j.s("run_id").takeIf { it.isNotBlank() }?.let { TextButton({ ui.go("runs") }) { Text("Open runs") } }
                }
            }
        }
        item(key = "facts") {
            Card {
                Eyebrow("Details")
                Fact("Team", j.s("team_id").ifBlank { "company" }.let { t -> HouseMap.houseOfTeam(ui.houses, t)?.let { "$t · ${ui.house(it)}" } ?: t })
                Fact("Sub-team", j.s("subteam_id")); Fact("Category", j.s("category_id")); Fact("Channel", j.s("channel_id")); Fact("Agent", j.s("agent_id")); Fact("Workflow", j.s("workflow_id"))
                Fact("Attempt", "${j.s("attempt")} of ${j.s("max_attempts")}"); Fact("Priority", j.s("priority"))
                Fact("Created", ago(j.s("created_at"))); Fact("Started", j.s("started_at").takeIf { it.isNotBlank() }?.let { ago(it) }); Fact("Run after", j.s("run_after").takeIf { status == "queued" && it.isNotBlank() }?.let { inTime(it) })
                Fact("Run", j.s("run_id")); Fact("Job id", j.s("id"))
            }
        }
    }
    if (confirm && j != null) AlertDialog(onDismissRequest = { confirm = false }, title = { Text("Cancel this job?") }, text = { Text("A cancelled job is not picked up again. Retry puts it back in the queue.") },
        confirmButton = { MuButton({ vm.jobCancel(j.s("id")); confirm = false }) { Text("Cancel job") } }, dismissButton = { TextButton({ confirm = false }) { Text("Keep it") } })
}

// ---------------------------------------------------------------- APPROVALS
fun LazyListScope.approvals(vm: Lounge, ui: UiNav) {
    item(key = "anote") { Muted("One approval, every device: any founder device can decide it, and the others show the decision. Nothing goes public, costs money or gets deleted without it. Open one to see exactly what it will do.") }
    val ap = vm.data.approvals
    val w = ap.filter { it.s("state") == "waiting" }; val hold = ap.filter { it.s("state") == "on-hold" }; val r = ap.filter { it.s("state") !in setOf("waiting", "on-hold") }
    item(key = "wh") { Section("Waiting for YES (${w.size})") }
    if (w.isEmpty()) item(key = "wnone") { Card { Text(vm.orNotRead("All clear: nothing waits for your YES."), style = MaterialTheme.typography.titleSmall) } }
    items(w, key = { "aw-" + it.s("id") }) { a -> ApprovalCard(ui, a) }
    if (hold.isNotEmpty()) { item(key = "hh") { Section("On hold (${hold.size})") }; items(hold, key = { "ah-" + it.s("id") }) { a -> ApprovalCard(ui, a) } }
    item(key = "rh") { Section("Decided") }
    if (r.isEmpty()) item(key = "rnone") { Muted(vm.orNotRead("Nothing decided yet.")) }
    items(r.take(40), key = { "ar-" + it.s("id") }) { a -> ApprovalCard(ui, a) }
    if (r.size > 40) item(key = "rmore") { Muted("Showing the latest 40 of ${r.size}.") }
}

@Composable
fun ApprovalCard(ui: UiNav, a: JSONObject) {
    TapCard({ ui.approval(a.s("id")) }) {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("${a.s("code")}${a.s("team").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f)); StatusChip(a.s("state")) }
        Text(a.s("what"), style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
        Muted(listOfNotNull(a.s("raised_on").takeIf { it.isNotBlank() }, a.s("decided_by").takeIf { it.isNotBlank() }?.let { (if (a.s("state") == "rejected") "No" else "YES") + " by $it" + a.s("decided_at").takeIf { d -> d.isNotBlank() }?.let { d -> " " + ago(d) }.orEmpty() }).joinToString(" · "), 1)
        if (a.s("state") in setOf("waiting", "on-hold")) Text("Review and decide", style = MaterialTheme.typography.labelMedium, color = LocalCocoRoles.current.link)
    }
}

@Composable
fun ApprovalDetail(vm: Lounge, ui: UiNav, id: String) {
    val a = vm.data.approvals.firstOrNull { it.s("id") == id }
    var ask by remember { mutableStateOf<Boolean?>(null) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (a == null) { item(key = "gone") { Card { Text("This approval is not in the list.", style = MaterialTheme.typography.titleSmall); Muted("It may still be loading.") } }; return@LazyColumn }
        val state = a.s("state"); val pending = state in setOf("waiting", "on-hold"); val hh = HouseMap.houseOfText(ui.houses, a.s("team"))
        item(key = "head") {
            Card {
                Row(verticalAlignment = Alignment.CenterVertically) { Text(a.s("code"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(state) }
                Text(a.s("what"), style = MaterialTheme.typography.bodyLarge)
                Muted(listOfNotNull(a.s("team").takeIf { it.isNotBlank() }?.let { "team $it" }, hh?.let { ui.house(it) }, a.s("raised_on").takeIf { it.isNotBlank() }?.let { "raised $it" }).joinToString(" · "))
            }
        }
        item(key = "decide") {
            Card(highlight = pending) {
                if (pending) {
                    Text("Your decision", style = MaterialTheme.typography.titleSmall)
                    Muted("Nothing is carried out until you say YES. One decision, final on all your devices: whoever decides first wins, and the others are told.")
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { MuButton({ ask = true }) { Text("Approve") }; MuOutlined({ ask = false }) { Text("Reject") } }
                } else Muted(listOfNotNull((if (state == "rejected") "Rejected" else "Approved") + a.s("decided_by").takeIf { it.isNotBlank() }?.let { " by $it" }, a.s("decided_at").takeIf { it.isNotBlank() }?.let { ago(it) }).joinToString(" · "))
            }
        }
        item(key = "action") {
            val lines = ApprovalText.actionLines(a.optJSONObject("action"))
            Card {
                Eyebrow("What will happen")
                if (lines.isEmpty()) Muted("No machine action is attached: approving records your decision only.")
                lines.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
                Fact("Files", a.s("files")); Fact("Release", a.s("release_id"))
                a.s("run_id").takeIf { it.isNotBlank() }?.let { r -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) { Text("Run", Modifier.width(96.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant); TextButton({ ui.go("runs") }) { Text(r) } } }
            }
        }
        item(key = "facts") {
            Card {
                Eyebrow("Request")
                Fact("Requested by", a.s("requested_by")); Fact("Requested", a.s("requested_at").takeIf { it.isNotBlank() }?.let { ago(it) }); Fact("Raised on", a.s("raised_on")); Fact("Approval id", a.s("id"))
                if (a.s("decided_by").isNotBlank() || a.s("result").isNotBlank() || a.s("executed_at").isNotBlank()) {
                    Fact("Decided by", a.s("decided_by")); Fact("Decided", a.s("decided_at").takeIf { it.isNotBlank() }?.let { ago(it) }); Fact("On device", a.s("device_id").takeIf { it.isNotBlank() }?.let { vm.deviceName(it) })
                    Fact("Result", a.s("result")); Fact("Carried out", a.s("executed_at").takeIf { it.isNotBlank() }?.let { "${ago(it)} by run ${a.s("executed_by_run")}" })
                }
            }
        }
    }
    ask?.let { yes -> if (a != null) AlertDialog(onDismissRequest = { ask = null }, title = { Text(if (yes) "Approve ${a.s("code")}?" else "Reject ${a.s("code")}?") },
        text = { Text(if (yes) "This records your YES. Whatever it asks for may now be carried out." else "This records your No. Nothing it asks for will be carried out.") },
        confirmButton = { MuButton({ vm.decide(a, yes); ask = null }) { Text(if (yes) "Approve" else "Reject") } }, dismissButton = { TextButton({ ask = null }) { Text("Cancel") } }) }
}

// ---------------------------------------------------------------- CONNECTIONS
private val STATE_RANK = mapOf("error" to 0, "partial" to 1, "connected" to 2, "paused" to 3, "not_connected" to 4)

fun LazyListScope.connections(vm: Lounge, ui: UiNav) {
    val d = vm.data; val acc = vm.rows("integration_accounts")
    item(key = "cnote") { Muted("Every platform Coco works with. Tap one to connect it, check it or fix it. A credential is never shown on a device, only where it lives.") }
    if (vm.dataAt == 0L) { item(key = "cwait") { Muted("Not read from Coco Cloud yet.") }; return }
    if (d.integrations.isEmpty()) item(key = "cnone") { Muted("No connections are listed in Coco Cloud.") }
    items(d.integrations.sortedWith(compareBy<JSONObject>({ if (it.s("error").isNotBlank() && it.s("state") != "error") 0 else STATE_RANK[it.s("state")] ?: 5 }, { it.s("platform").lowercase() })), key = { "conn-" + it.s("id") }) { i ->
        val id = i.s("id"); val mine = acc.rows.filter { it.s("provider") == id }
        TapCard({ ui.conn("i:$id") }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NetLogo(LOGO_DOMAINS[id], 28.dp)
                Column(Modifier.weight(1f)) { Text(i.s("platform").ifBlank { id }, style = MaterialTheme.typography.titleSmall, maxLines = 1); Muted(i.s("error").ifBlank { i.s("next_action") }, 2) }
                StatusChip(i.s("state"))
            }
            if (mine.isNotEmpty()) Muted("${mine.count { it.s("state") == "connected" }} of ${mine.size} accounts connected", 1)
        }
    }
    item(key = "cmore-h") { Section("Connect a channel or service") }
    items(ConnRules.CATALOGUE, key = { "cmore-" + it.provider }) { c ->
        val a = acc.rows.firstOrNull { it.s("connection_id") == c.connection }
        TapCard({ ui.conn(if (a != null) "a:${c.connection}" else "new:${c.provider}") }) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NetLogo(LOGO_DOMAINS[c.oauth.orEmpty()], 28.dp)
                Column(Modifier.weight(1f)) { Text(c.name, style = MaterialTheme.typography.titleSmall); Muted(if (a?.s("state") == "connected") "Connected with Google" else "Not connected yet · connect with Google sign-in", 2) }
                StatusChip(a?.s("state") ?: "not_connected")
            }
        }
    }
}

@Composable
fun ConnectionDetail(vm: Lounge, ui: UiNav, key: String) {
    val ctx = LocalContext.current
    val kind = key.substringBefore(':'); val ref = key.substringAfter(':')
    val d = vm.data; val accounts = vm.rows("integration_accounts").rows; val links = vm.rows("integration_links").rows
    val cat = ConnRules.CATALOGUE.firstOrNull { (kind == "new" && it.provider == ref) || (kind == "a" && it.connection == ref) }
    val acct = accounts.firstOrNull { it.s("connection_id") == ref && (kind == "a" || kind == "new") }
    val integ = when (kind) { "a" -> d.integrations.firstOrNull { it.s("id") == acct?.s("provider") }; else -> d.integrations.firstOrNull { it.s("id") == ref } }
    val provider = integ?.s("id") ?: acct?.s("provider") ?: cat?.oauth ?: cat?.provider.orEmpty()
    val oauth = ConnRules.oauthProvider(provider)
    val mine = if (kind == "i") accounts.filter { if (oauth != null) ConnRules.oauthProvider(it.s("provider")) == oauth else it.s("provider") == provider } else emptyList()
    val connId = acct?.s("connection_id") ?: mine.singleOrNull()?.s("connection_id") ?: cat?.connection ?: cat?.provider ?: provider
    val state = acct?.s("state") ?: integ?.s("state") ?: "not_connected"
    val name = acct?.s("external_name")?.ifBlank { null } ?: integ?.s("platform")?.ifBlank { null } ?: cat?.name ?: ref
    var keyOpen by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (integ == null && acct == null && cat == null) { item(key = "gone") { Card { Text("This connection is not in Coco Cloud any more.", style = MaterialTheme.typography.titleSmall) } }; return@LazyColumn }
        item(key = "head") {
            Card {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    NetLogo(LOGO_DOMAINS[provider], 32.dp); Text(name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f)); StatusChip(state)
                }
                Muted(when (state) { "connected" -> "Connected."; "partial" -> "Partly connected."; "paused" -> "Paused on purpose."; "error" -> "Something is wrong with this connection."; else -> "Not connected." })
            }
        }
        val err = integ?.s("error").orEmpty().ifBlank { if (state == "error") "The last check of this account failed." else "" }
        if (err.isNotBlank()) item(key = "error") { Card(alert = true) { Text("What is wrong", style = MaterialTheme.typography.labelLarge); Text(err, style = MaterialTheme.typography.bodyMedium) } }
        item(key = "next") {
            Card {
                Eyebrow("What to do next")
                val next = cat?.how.orEmpty().ifBlank { integ?.s("next_action").orEmpty() }
                Text(next.ifBlank { if (oauth != null && state != "connected") "Press Connect, sign in on the platform's page and allow everything it asks, then press Verify." else if (state == "connected") "Nothing. Press Check now to test it again." else "This platform is set up on a PC. Press Check now to ask the cloud what it can see." }, style = MaterialTheme.typography.bodyMedium)
            }
        }
        item(key = "actions") {
            Card {
                Eyebrow("Actions")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (oauth != null) {
                        val target = acct?.s("connection_id") ?: mine.singleOrNull()?.s("connection_id") ?: cat?.connection
                        if (target != null) {
                            val held = ConnRules.cloudHeld(accounts.firstOrNull { it.s("connection_id") == target }?.s("secret_ref").orEmpty())
                            MuButton({ vm.oauthBegin(oauth, target) { u -> open(ctx, u) } }) { Text(if (held) "Reconnect" else "Connect") }
                            if (accounts.any { it.s("connection_id") == target }) MuTonal({ vm.oauthVerify(target) }) { Text("Verify") }
                            if (provider in ConnRules.KEY_PROVIDERS || oauth in ConnRules.KEY_PROVIDERS) TextButton({ keyOpen = true }) { Icon(Icons.Rounded.Key, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Paste a token") }
                        } else if (mine.isEmpty()) Muted("No account is recorded for this platform yet.")
                    } else {
                        if (acct != null || integ != null) MuButton({ vm.connectCheck(connId) }) { Text("Check now") }
                    }
                }
            }
        }
        item(key = "facts") {
            val assigned = links.filter { it.s("connection_id") == acct?.s("connection_id") }.joinToString("; ") { l -> listOf("team_id", "subteam_id", "category_id", "channel_id").mapNotNull { k -> l.s(k).ifBlank { null } }.joinToString(" › ") }
            Card {
                Eyebrow("Details")
                Fact("Account", acct?.s("external_name")?.ifBlank { null } ?: integ?.s("account")); Fact("Handle", acct?.s("external_handle"))
                Fact("House", integ?.s("house_id")?.takeIf { it.isNotBlank() }?.let { ui.house(it) })
                Fact("How it connects", integ?.s("auth_method"))
                if (acct != null) Fact("Credential", ConnRules.credential(acct.s("secret_ref")))
                Fact("Last checked", (acct?.s("last_verified_at")?.ifBlank { null } ?: integ?.s("last_check_at")?.ifBlank { null })?.let { asOf(it) } ?: "Never")
                Fact("Last worked", integ?.s("last_ok_at")?.takeIf { it.isNotBlank() }?.let { asOf(it) })
                Fact("Assigned to", assigned.ifBlank { if (acct != null) "Not assigned yet" else "" })
                Fact("Permissions", acct?.optJSONArray("permissions")?.length()?.takeIf { it > 0 }?.let { "$it granted" })
            }
        }
        if (kind == "i" && mine.isNotEmpty()) {
            item(key = "accounts-h") { Section("Accounts (${mine.size})") }
            items(mine, key = { "acc-" + it.s("connection_id") }) { a ->
                TapCard({ ui.conn("a:" + a.s("connection_id")) }) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Column(Modifier.weight(1f)) { Text(a.s("external_name").ifBlank { a.s("connection_id") }, style = MaterialTheme.typography.titleSmall); Muted("${ConnRules.credential(a.s("secret_ref"))} · ${if (a.s("last_verified_at").isBlank()) "never checked" else "checked ${ago(a.s("last_verified_at"))}"}", 2) }
                        StatusChip(a.s("state"))
                    }
                }
            }
        }
    }
    if (keyOpen) KeyDialog(name, onClose = { keyOpen = false }) { secret -> vm.connectKey(oauth ?: provider, connId, secret) }
}

/** The key is typed here, sent once to the cloud vault and dropped. It is not kept in app state and never shown again. */
@Composable
fun KeyDialog(name: String, onClose: () -> Unit, save: (String) -> Unit) {
    var secret by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onClose, title = { Text("Key for $name") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(secret, { secret = it }, label = { Text("Key") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
                Muted("It goes to the cloud vault and is never shown again, not even to you.")
            }
        },
        confirmButton = { MuButton({ save(secret.trim()); secret = ""; onClose() }, enabled = secret.isNotBlank()) { Text("Save key") } },
        dismissButton = { TextButton({ secret = ""; onClose() }) { Text("Cancel") } })
}

// ---------------------------------------------------------------- REVENUE and YOUTUBE
@Composable
fun RevenueRow(vm: Lounge, ui: UiNav, s: RevSource) {
    val ctx = LocalContext.current
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Eyebrow(s.provider.ifBlank { "source" }); Text(s.name, style = MaterialTheme.typography.titleMedium) }
            when (s.state) { "synced" -> StatusChip("connected", "Synced"); "not_connected" -> StatusChip("not_connected"); "failed" -> StatusChip("failed", "Sync failed"); else -> StatusChip("waiting", if (s.state == "never_synced") "Not synced" else "Unavailable") }
        }
        Text(s.text, style = MaterialTheme.typography.headlineSmall, color = if (s.state == "synced") MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        Muted(s.sub, 4)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (s.connect) MuButton({ val p = ConnRules.oauthProvider(s.provider); if (p != null) vm.oauthBegin(p, s.id) { u -> open(ctx, u) } else ui.conn("a:" + s.id) }) { Text("Connect") }
            if (s.sync) MuTonal({ vm.revenueSync(s.id) }) { Text("Sync now") }
        }
    }
}

/** Revenue per source: a real total (INR 0 only after a successful sync with no sales), or the honest reason there is none. */
fun LazyListScope.revenueSection(vm: Lounge, ui: UiNav, only: Set<String>?, none: String) {
    val ev = vm.rows("revenue_events"); val sy = vm.rows("revenue_sync"); val acc = vm.rows("integration_accounts")
    if (!acc.loaded) { item(key = "rev-wait") { Muted("Reading connections…") }; return }
    val served = ev.loaded && ev.error == null && sy.loaded && sy.error == null
    val list = Revenue.sources(acc.rows, if (sy.error == null) sy.rows else emptyList(), if (ev.error == null) ev.rows else emptyList(), served, only)
    if (list.isEmpty()) item(key = "rev-none") { Card { Muted(none) } }
    items(list, key = { "rev-" + it.id }) { s -> RevenueRow(vm, ui, s) }
    if (!served) item(key = "rev-why") { Muted(if (ev.missing || sy.missing) "Revenue sync is not set up yet: Nova does not serve the revenue tables (revenue_events, revenue_sync), so no sale can be shown. Nothing is estimated and no zero is shown." else "Revenue could not be read right now: ${ev.error ?: sy.error ?: "no answer"}", 4) }
    if (served && ev.rows.size >= 1000) item(key = "rev-cap") { Muted("Totals count the latest 1,000 records.") }
}

/** YouTube lifetime views and subscribers per channel from yt_stats, with when they were last collected. */
fun LazyListScope.youtubeSection(vm: Lounge) {
    val r = vm.rows("yt_stats")
    item(key = "yt") {
        Card {
            Eyebrow("YouTube")
            when {
                !r.loaded -> Muted("Reading…")
                r.error != null -> Muted("Could not be read right now: ${r.error}")
                else -> {
                    val ch = Yt.channels(r.rows, vm.rows("integration_accounts").rows); val t = Yt.totals(ch)
                    if (ch.isEmpty()) Muted("No channel numbers have been collected yet.")
                    else {
                        Text("${t.views?.let(Facts::number) ?: "–"} views · ${t.subscribers?.let(Facts::number) ?: "–"} subscribers", style = MaterialTheme.typography.titleMedium)
                        Muted("Lifetime totals over ${ch.size} channel${if (ch.size == 1) "" else "s"} · last collected ${asOf(t.at)}", 2)
                        ch.forEach { c -> Line(c.name, "${c.views?.let(Facts::number) ?: "–"} views · ${c.subscribers?.let(Facts::number) ?: "–"} subscribers · ${asOf(c.at)}") }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- the detail dispatcher
@Composable
fun DetailScreen(vm: Lounge, ui: UiNav, key: String) {
    val id = key.substringAfter(':')
    when (key.substringBefore(':')) {
        "task" -> TaskDetail(vm, ui, id); "approval" -> ApprovalDetail(vm, ui, id); "job" -> JobDetail(vm, ui, id); "conn" -> ConnectionDetail(vm, ui, id)
        else -> Box(Modifier.padding(16.dp)) { Muted("Nothing to show here.") }
    }
}
fun detailTitle(key: String) = when (key.substringBefore(':')) { "task" -> "Task"; "approval" -> "Approval"; "job" -> "Job"; "conn" -> "Connection"; else -> "Detail" }
