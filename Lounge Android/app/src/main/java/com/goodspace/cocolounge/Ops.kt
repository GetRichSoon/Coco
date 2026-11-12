package com.goodspace.cocolounge

import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant

/*
 * The rules the operating screens share: tasks, run requests, jobs, workers, what needs attention, Houses, revenue, YouTube, connections.
 * Pure Kotlin over the org.json rows exactly as Nova serves the ORIGINAL tables (tasks, run_requests, jobs, houses, structure, offerings,
 * integrations, yt_stats ...), so the JVM tests hold them. They follow the web twin's Lounge/ui-kit.js (same statuses, moves, guards and
 * wording) and the findings of reports/ops-connectors-worker.md about how a task really becomes work. Nothing here reads the org_* registry.
 */

// ---------------------------------------------------------------- tasks
object TaskRules {
    /** Only a worker's claim makes a task run. "verifying" is finished work waiting for a founder's check, not running. */
    val RUNNING = setOf("running", "working")
    /** Still to do or being done. failed is its own list because it needs a founder; done and stopped are finished. */
    val OPEN = setOf("planned", "queued", "running", "working", "verifying", "need_approval", "needs_yes", "waiting_pc", "blocked", "paused")
    val FINISHED = setOf("done", "stopped", "cancelled")
    /** Statuses that ask a founder for something. */
    val NEEDS_ME = setOf("blocked", "needs_yes", "need_approval")

    enum class Filter(val label: String) { Open("Open"), Running("Running"), Failed("Failed"), Done("Done"), Stopped("Stopped") }
    /** The moves of the state machine, main one first: planned > queued > running > done|failed; queued|running > paused > queued; any open > stopped; failed > queued.
     *  Start and Retry ask the cloud for a run (coco_request_run); the task is only ever "running" once a worker says so. */
    enum class Act(val label: String, val said: String) {
        Start("Start", "Asked the cloud to run it"), Resume("Resume", "Resumed: back in the queue"), Retry("Retry", "Retrying: asked the cloud to run it again"),
        Pause("Pause", "Paused"), Cancel("Cancel", "Cancelled")
    }
    /** The statuses a task must still be in for a move to apply: a worker may have moved it since the screen was read. */
    fun from(a: Act): Set<String> = when (a) {
        Act.Start -> setOf("planned", "queued"); Act.Resume -> setOf("paused"); Act.Retry -> setOf("failed")
        Act.Pause -> setOf("queued", "running", "working", "waiting_pc"); Act.Cancel -> OPEN + "failed"
    }
    /** Assigning is allowed while the task is open or failed. */
    val ASSIGNABLE: Set<String> get() = OPEN + "failed"

    /** submit_task folds a twin into the task that already exists (merged_into); that row is not work of its own. */
    fun real(t: JSONObject) = t.s("merged_into").isBlank()

    fun group(status: String): Filter = when { status == "done" -> Filter.Done; status == "failed" -> Filter.Failed; status in FINISHED -> Filter.Stopped; else -> Filter.Open }
    fun inFilter(t: JSONObject, f: Filter) = real(t) && (if (f == Filter.Running) t.s("status") in RUNNING else group(t.s("status")) == f)
    fun count(tasks: List<JSONObject>, f: Filter) = tasks.count { inFilter(it, f) }

    /** One list: the filter, a House (null = all, "none" = no House) and a search text in the title, details, House, assignee or status. Priority first, then newest. */
    fun list(tasks: List<JSONObject>, f: Filter, house: String? = null, query: String = "", extra: (JSONObject) -> String = { "" }): List<JSONObject> {
        val q = query.trim().lowercase()
        return tasks.filter { t ->
            inFilter(t, f) && (house == null || (if (house == "none") t.s("house_id").isBlank() else t.s("house_id") == house)) &&
                (q.isEmpty() || "${t.s("title")} ${t.s("details")} ${extra(t)} ${t.s("status")}".lowercase().contains(q))
        }.sortedWith(compareBy<JSONObject> { it.optInt("priority", 2) }.thenByDescending { it.s("created_at") })
    }

    /** The moves a status offers. A queued task whose cloud run is already asked for has nothing left to start. */
    fun actions(status: String, liveRequest: Boolean = false): List<Act> =
        listOf(Act.Start, Act.Resume, Act.Retry, Act.Pause, Act.Cancel).filter { a -> status in from(a) && !(a == Act.Start && status == "queued" && liveRequest) }

    /** Words for the statuses whose plain name misleads (null = the chip's own word). */
    fun statusText(status: String): String? = when (status) { "verifying" -> "Needs a check"; "waiting_pc" -> "Waits for a PC"; "need_approval", "needs_yes" -> "Needs YES"; else -> null }

    // ---- how a task becomes cloud work today: a run request for its team's <team>-pick workflow (the cloud cycle finds the task by the note)
    /** House -> the registry team whose workflow does its work. */
    val HOUSE_TEAM = mapOf("gigi" to "youtube", "lulu" to "software", "poppy" to "ebooks", "fifi" to "courses", "zaza" to "games", "mochi" to "comics", "tilly" to "commerce")
    private val TEAM_LINE = Regex("^\\s*Team:\\s*([a-z0-9][a-z0-9._-]*)\\s*$", RegexOption.IGNORE_CASE)
    /** The team a task is for: its first details line "Team: youtube", else the team behind its House. */
    fun teamOf(t: JSONObject): String? = t.s("details").lineSequence().firstOrNull()?.let { TEAM_LINE.find(it)?.groupValues?.get(1)?.lowercase() } ?: HOUSE_TEAM[t.s("house_id")]
    fun workflowOf(t: JSONObject): String? = teamOf(t)?.let { "$it-pick" }
    /** The note the cloud cycle reads: exactly "coco-task:" and the id first. */
    fun runNote(t: JSONObject) = "coco-task:${t.s("id")} · ${t.s("title").take(160)}"
    /** The details a new task is filed with: a first line naming its team, so the intake can tell which workflow. */
    fun withTeam(details: String, house: String?): String {
        val team = HOUSE_TEAM[house.orEmpty()] ?: return details
        return if (TEAM_LINE.containsMatchIn(details.lineSequence().firstOrNull().orEmpty())) details else "Team: $team" + if (details.isBlank()) "" else "\n$details"
    }

    /** What a move writes. `onlyIf` empty = no guard; `note` is filed with the task (a retry keeps the error it cleared). */
    class Change(val patch: JSONObject, val onlyIf: Set<String>, val note: String? = null)
    fun change(act: Act, t: JSONObject, now: Instant, requestId: Long? = null): Change {
        val p = JSONObject().put("updated_at", now.toString()); val free = JSONObject.NULL
        // claim_task only takes queued tasks with no claimed_by_device, so work goes back to the queue unclaimed
        fun requeue() = p.put("status", "queued").put("claimed_by_device", free).put("claimed_at", free).put("heartbeat_at", free).put("stale", false)
        // a task asked for a cloud run says so: it is waiting for the next run, never "running"
        fun asked() { if (requestId != null) p.put("result", "Waiting for the next cloud run (request #$requestId)") }
        return when (act) {
            Act.Start -> { asked(); Change(p.put("status", "queued"), from(act)) }
            Act.Pause -> Change(p.put("status", "paused"), from(act))
            Act.Resume -> Change(requeue(), from(act))
            Act.Retry -> { val n = t.optInt("retry_count") + 1; asked()
                Change(requeue().put("retry_count", n).put("error", free), from(act), "Retry $n." + t.s("error").takeIf { it.isNotBlank() }?.let { " Previous error: ${it.take(300)}" }.orEmpty()) }
            Act.Cancel -> Change(p.put("status", "stopped"), from(act))
        }
    }
    fun assign(member: String?, house: String?, pipeline: String?, now: Instant): Change {
        val p = JSONObject().put("updated_at", now.toString()).put("member_id", member ?: JSONObject.NULL).put("house_id", house ?: JSONObject.NULL).put("pipeline_id", pipeline ?: JSONObject.NULL)
        if (pipeline == null) p.put("step", JSONObject.NULL)
        return Change(p, ASSIGNABLE)
    }
    fun priority(p: Int, now: Instant) = Change(JSONObject().put("priority", p).put("updated_at", now.toString()), emptySet())

    fun stepsList(pipeline: JSONObject?): JSONArray? = pipeline?.let { p -> p.optJSONArray("steps") ?: runCatching { JSONArray(p.optString("steps")) }.getOrNull() }
    fun steps(pipeline: JSONObject?): Int = stepsList(pipeline)?.length() ?: 0
    fun stepOf(pipeline: JSONObject?, i: Int): JSONObject? = stepsList(pipeline)?.optJSONObject(i)

    /** "step 3 of 6" only when a worker has recorded a step; otherwise "not started". Never an invented percentage. null = the task has no pipeline. */
    class Prog(val pipeline: String, val step: Int?, val of: Int?, val label: String, val ratio: Float?)
    fun progress(t: JSONObject, pipelines: List<JSONObject>): Prog? {
        if (t.s("pipeline_id").isBlank()) return null
        val p = pipelines.firstOrNull { it.s("id") == t.s("pipeline_id") }; val of = p?.let { steps(it) }?.takeIf { it > 0 }
        val step = t.s("step").toDoubleOrNull()?.toInt()
        return Prog(p?.s("name")?.ifBlank { null } ?: t.s("pipeline_id"), step, of, when { step == null -> "not started"; of != null -> "step $step of $of"; else -> "step $step" },
            if (step != null && of != null) minOf(1f, step.toFloat() / of) else null)
    }

    /** Why a queued task is not moving, in words; null when it is not waiting at all. Cloud work moves only at a cloud run (about twice a day). */
    fun wait(t: JSONObject, w: Workers.Status, reqs: List<JSONObject> = emptyList()): String? {
        if (t.s("status") !in setOf("queued", "waiting_pc")) return null
        RunRequests.of(t.s("id"), reqs).firstOrNull { RunRequests.live(it) }?.let { return "Waiting for the next cloud run (request #${it.s("id")}). Cloud runs happen about twice a day." }
        return when (t.s("needs").ifBlank { "any" }) {
            "pc" -> if (w.pcOnline) "Queued: an online PC can claim it" else "Waiting for a PC: no PC is online"
            else -> "Queued, but no cloud run has been asked for yet. Press Start to ask for one."
        }
    }

    /** Lower numbers run first (the queue orders by priority ascending). */
    fun priorityLabel(p: Int) = when (p) { 1 -> "High"; 2 -> "Normal"; 3 -> "Low"; else -> "P$p" }
    val PRIORITIES = listOf(1, 2, 3)
}

// ---------------------------------------------------------------- cloud run requests (run_requests): the real queue of AI team work
object RunRequests {
    val LIVE = setOf("pending", "claimed")
    val BAD = setOf("failed", "refused")
    fun live(r: JSONObject) = r.s("state") in LIVE
    fun bad(r: JSONObject) = r.s("state") in BAD
    /** The requests a task asked for (its id is the start of the note), newest first. */
    fun of(taskId: String, reqs: List<JSONObject>) = reqs.filter { it.s("note").startsWith("coco-task:$taskId") }.sortedByDescending { it.optLong("id") }
    fun taskIdOf(r: JSONObject): String? = Regex("^coco-task:([0-9a-fA-F-]{36})").find(r.s("note"))?.groupValues?.get(1)
    /** What happened, in words: the state and, when it failed, the reason. */
    fun line(r: JSONObject): String = "Request #${r.s("id")} · ${r.s("workflow_id")} · ${r.s("state")}" + r.s("reason").takeIf { it.isNotBlank() }?.let { " · $it" }.orEmpty()
}

// ---------------------------------------------------------------- jobs
object JobRules {
    val OPEN = setOf("queued", "running", "blocked")
    val RETRYABLE = setOf("failed", "blocked", "cancelled")
    /** The five payload-only jobs that need no AI and publish nothing (the task enqueue door accepts only these). */
    val ZERO_AI = listOf("filter-rank" to "Rank a list", "package-research" to "Package research", "search-memory" to "Search the memory", "validate-output" to "Validate an output", "title-analytics" to "Title analytics")
    enum class Filter(val label: String, val of: Set<String>?) { Open("Open", OPEN), Failed("Failed", setOf("failed")), Done("Done", setOf("done")), All("All", null) }

    fun canCancel(status: String) = status in OPEN
    fun canRetry(status: String) = status in RETRYABLE
    fun list(jobs: List<JSONObject>, f: Filter) = jobs.filter { f.of == null || it.s("status") in f.of }
    fun running(jobs: List<JSONObject>) = jobs.filter { it.s("status") == "running" }
    /** A task's jobs: the enqueue door files them under "coco-task:<task id>:<type>". */
    fun ofTask(taskId: String, jobs: List<JSONObject>) = jobs.filter { it.s("idempotency_key").startsWith("coco-task:$taskId:") }

    /** jobs.error is {kind, message, at}; an empty object means no error. */
    fun problem(j: JSONObject): String {
        j.optJSONObject("error")?.let { e -> return e.s("message").ifBlank { e.s("kind") } }
        return j.s("error").takeIf { it != "{}" }.orEmpty()
    }
}

// ---------------------------------------------------------------- workers
object Workers {
    /** The cloud worker runs on GitHub's schedule (a few hours apart on paper, a day at worst) and reports in after a run, so a run within twelve hours is a healthy one.
     *  A PC beats every few seconds, so 150 s. */
    const val CLOUD_FRESH_MS = 12 * 60 * 60 * 1000L
    const val PC_FRESH_MS = 150 * 1000L
    class Cloud(val id: String, val name: String, val lastSeen: String, val online: Boolean)
    class Status(val cloud: Cloud?, val pcOnline: Boolean)

    private fun fresh(d: JSONObject?, ms: Long, now: Instant) = Facts.instant(d?.s("last_seen"))?.let { Duration.between(it, now).toMillis() <= ms } ?: false
    private fun isCloud(d: JSONObject) = d.s("id").contains("cloud-worker") || d.s("kind") == "cloud"

    fun cloud(devices: List<JSONObject>) = devices.filter { isCloud(it) }
    fun online(d: JSONObject, now: Instant = Instant.now()) = fresh(d, CLOUD_FRESH_MS, now)
    fun status(devices: List<JSONObject>, now: Instant = Instant.now()): Status {
        val list = devices.filter { it.optBoolean("active", true) }; val cw = list.firstOrNull { isCloud(it) }
        return Status(cw?.let { Cloud(it.s("id"), it.s("name"), it.s("last_seen"), fresh(it, CLOUD_FRESH_MS, now)) }, list.any { it !== cw && it.s("kind") == "pc" && fresh(it, PC_FRESH_MS, now) })
    }
    /** When the newest job finished: the second sign of life, next to the device's own last_seen. */
    fun latestJob(jobs: List<JSONObject>): String? = jobs.mapNotNull { it.s("completed_at").ifBlank { null } }.maxOrNull()

    /** One honest sentence about who runs the queue: when the cloud worker last ran, never a bare "offline". */
    fun line(devices: List<JSONObject>, read: Boolean, now: Instant = Instant.now(), jobs: List<JSONObject> = emptyList()): String {
        val w = status(devices, now)
        val job = latestJob(jobs)?.let { " · latest job finished ${ago(it)}" }.orEmpty()
        return when {
            !read -> "Workers have not been read from Coco Cloud yet."
            w.cloud == null -> "No cloud worker is paired. Queued tasks wait until an online PC or a worker claims them."
            w.cloud.online -> "Cloud worker: last run ${ago(w.cloud.lastSeen)}$job. It runs on a schedule, so queued work waits for its next run."
            else -> "Cloud worker: last run ${ago(w.cloud.lastSeen)}$job. It has not reported for a while; it runs on a schedule, so queued work waits for its next run."
        }
    }
}

// ---------------------------------------------------------------- what needs the founder
data class Attn(val kind: String, val id: String, val title: String, val sub: String, val tone: String, val chip: String, val chipText: String, val action: String)

object Attention {
    private val RANK = mapOf("bad" to 0, "warn" to 1, "info" to 2)
    /** Waiting for a founder's YES. (On hold is its own list; the detail can still decide it.) */
    fun pending(approvals: List<JSONObject>) = approvals.filter { it.s("state") == "waiting" }
    private const val RECENT_DAYS = 7L

    /** Home's "Needs attention": what it is, how bad (bad first), and the action it offers. Same list as the web's UK.attention, plus what the findings say a founder
     *  must see: a connection that says "connected" while carrying an error (the Gumroad token that leaked), a cloud run that failed, an AI policy that blocks a team's work. */
    fun rows(tasks: List<JSONObject>, approvals: List<JSONObject>, jobs: List<JSONObject>, integrations: List<JSONObject>, accounts: List<JSONObject>,
             devices: List<JSONObject>, now: Instant = Instant.now(), runRequests: List<JSONObject> = emptyList(), policies: List<JSONObject> = emptyList()): List<Attn> {
        val out = mutableListOf<Attn>()
        pending(approvals).forEach { a ->
            out += Attn("approval", a.s("id"), "${a.s("code")}: ${a.s("what")}", listOf(a.s("team"), a.s("raised_on")).filter { it.isNotBlank() }.joinToString(" · "), "warn", "waiting", "Needs YES", "Review")
        }
        tasks.filter { TaskRules.real(it) }.forEach { t ->
            val why = t.s("error").takeIf { it.isNotBlank() }?.let { ": ${it.take(140)}" }.orEmpty()
            when (t.s("status")) {
                "failed" -> out += Attn("task", t.s("id"), t.s("title"), "Task failed$why", "bad", "failed", "Failed", "Retry or cancel")
                "blocked" -> out += Attn("task", t.s("id"), t.s("title"), "Task blocked$why", "warn", "blocked", "Blocked", "Cancel")
                "needs_yes", "need_approval" -> out += Attn("task", t.s("id"), t.s("title"), "Task is waiting for a YES", "warn", "needs_yes", "Needs YES", "Open")
            }
        }
        // a cloud run a founder asked for that failed: the newest such failure of each workflow in the last week, with the cloud's own reason
        runRequests.filter { RunRequests.bad(it) && Facts.instant(it.s("finished_at").ifBlank { it.s("created_at") })?.isAfter(now.minus(Duration.ofDays(RECENT_DAYS))) == true }
            .sortedByDescending { it.optLong("id") }.distinctBy { it.s("workflow_id") }.forEach { r ->
                out += Attn("runreq", RunRequests.taskIdOf(r) ?: "req-${r.s("id")}", "Cloud run failed: ${r.s("workflow_id")}", r.s("reason").ifBlank { "No reason recorded" }.take(160), "bad", "failed", "Failed", "Open")
            }
        jobs.forEach { j ->
            val sub = listOf(j.s("team_id"), JobRules.problem(j)).filter { it.isNotBlank() }.joinToString(" · ").take(160)
            when (j.s("status")) {
                "failed" -> out += Attn("job", j.s("id"), "Job ${j.s("type")} failed", sub, "bad", "failed", "Failed", "Retry")
                "blocked" -> out += Attn("job", j.s("id"), "Job ${j.s("type")} is blocked", sub, "warn", "blocked", "Blocked", "Cancel or retry")
            }
        }
        accounts.filter { it.s("state") == "error" }.forEach { a ->
            out += Attn("account", a.s("connection_id"), "${a.s("provider")}: ${a.s("external_name").ifBlank { a.s("connection_id") }} needs reconnecting", "The connection reports an error", "bad", "error", "Error", "Reconnect")
        }
        integrations.filter { it.s("state") == "error" || it.s("error").isNotBlank() }.forEach { i ->
            out += Attn("integration", i.s("id"), "${i.s("platform").ifBlank { i.s("id") }} connection problem", i.s("error").ifBlank { i.s("next_action") }.ifBlank { "The connection reports an error" }.take(160),
                "bad", "error", "Error", if (ConnRules.oauthProvider(i.s("id")) != null) "Reconnect" else "Open")
        }
        // Claude denied or blocked for an agent or team: its AI work is refused at the gate until a founder changes the policy
        policies.filter { it.s("key") == "claude" && it.s("value") in setOf("denied", "blocked") }.sortedBy { it.s("scope_id") }.forEach { p ->
            out += Attn("policy", "${p.s("scope")}/${p.s("scope_id")}", "Claude is ${p.s("value")} for ${p.s("scope")} ${p.s("scope_id")}", "Its AI work is refused until a founder changes this policy.", "warn", "blocked", "Blocked", "Open")
        }
        val w = Workers.status(devices, now)
        if (devices.isNotEmpty()) {
            if (w.cloud == null) out += Attn("worker", "worker", "No cloud worker is paired", "Queued work has nothing to run it in the cloud.", "info", "off", "None", "Open")
            else if (!w.cloud.online) out += Attn("worker", "worker", "Cloud worker: last run ${ago(w.cloud.lastSeen)}", "It runs on a schedule and reports in after a run, so queued work waits for its next run.", "info", "waiting", "Idle", "Open")
        }
        return out.sortedBy { RANK[it.tone] ?: 3 }   // stable: within a tone the order above holds
    }

    data class Tiles(val open: Int, val failed: Int, val running: Int, val waiting: Int, val alerts: Int)
    /** Open tasks (a red badge for failed), Running now (running tasks + running jobs), Waiting for YES, Alerts (every problem that is not a request for a YES). */
    fun tiles(tasks: List<JSONObject>, approvals: List<JSONObject>, jobs: List<JSONObject>, rows: List<Attn>) = Tiles(
        open = TaskRules.count(tasks, TaskRules.Filter.Open), failed = TaskRules.count(tasks, TaskRules.Filter.Failed),
        running = tasks.count { TaskRules.inFilter(it, TaskRules.Filter.Running) } + JobRules.running(jobs).size,
        waiting = pending(approvals).size, alerts = rows.count { it.kind != "approval" && it.tone != "info" })
}

// ---------------------------------------------------------------- Houses: which original rows belong to which House
object HouseMap {
    /** A team id, runtime team name ("youtube", "ebooks", "software"), platform or domain belongs to the House whose id, domain or platform list names it:
     *  the first segment before "/" or "." decides, exactly the web's UK.houseOfTeam, so the navigation contract is the only table. */
    fun houseOfTeam(houses: List<HouseDef>, id: String?): String? {
        val t = id.orEmpty().lowercase().split('/', '.').first().trim()
        if (t.isBlank()) return null
        return (houses.firstOrNull { it.id == t } ?: houses.firstOrNull { it.domain.lowercase() == t } ?: houses.firstOrNull { t in it.platforms })?.id
    }
    /** Free text such as "Social Media" or "YouTube" (approvals.team): the first word that names a House, its domain or one of its platforms. */
    fun houseOfText(houses: List<HouseDef>, text: String?): String? =
        text.orEmpty().lowercase().split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() }.firstNotNullOfOrNull { houseOfTeam(houses, it) }
    fun inTeams(houses: List<HouseDef>, house: String, teamId: String?) = houseOfTeam(houses, teamId) == house

    /** The top of a structure row's chain: the team id, even when the team itself is only named by its children (the registry's "ebooks"). */
    fun rootOf(row: JSONObject, byId: Map<String, JSONObject>): String {
        var cur = row; var hops = 0
        while (hops++ < 12) {
            val p = cur.s("parent_id")
            if (p.isBlank()) return cur.s("id")
            cur = byId[p] ?: return p
        }
        return cur.s("id")
    }
    /** A structure row's House: a team can name it itself (config.house); otherwise the row or the nearest parent whose id names one. */
    fun houseOfStructure(houses: List<HouseDef>, row: JSONObject, byId: Map<String, JSONObject>): String? {
        var x: JSONObject? = row; var hops = 0
        while (x != null && hops++ < 10) {
            (x.optJSONObject("config")?.s("house")?.ifBlank { null } ?: houseOfTeam(houses, x.s("id")))?.let { return it }
            val p = x.s("parent_id"); x = byId[p]
            if (x == null && p.isNotBlank()) return houseOfTeam(houses, p)
        }
        return null
    }
    fun structureOf(houses: List<HouseDef>, house: String, structure: List<JSONObject>): List<JSONObject> { val by = structure.associateBy { it.s("id") }; return structure.filter { houseOfStructure(houses, it, by) == house } }
    fun unplaced(houses: List<HouseDef>, structure: List<JSONObject>): List<JSONObject> { val by = structure.associateBy { it.s("id") }; return structure.filter { houseOfStructure(houses, it, by) == null } }

    /** Members linked to a House by member_houses. */
    fun membersOf(house: String, members: List<JSONObject>, links: List<JSONObject>): List<JSONObject> { val ids = links.filter { it.s("house_id") == house }.map { it.s("member_id") }.toSet(); return members.filter { it.s("id") in ids } }
    /** The accounts of the platforms a House expects (the web's rule): a YouTube account is listed under the House that expects YouTube. */
    fun accountsOf(h: HouseDef, accounts: List<JSONObject>) = accounts.filter { it.s("provider").lowercase() in h.platforms }
    /** The next free category code of a House (codes are unique per House). */
    fun nextCode(house: String, categories: List<JSONObject>) = (categories.filter { it.s("house_id") == house }.maxOfOrNull { it.optInt("code") } ?: 0) + 1

    /** One line of the structure tree: a row, or (row = null) the header of a team that exists only as the parent of other rows. */
    data class Node(val depth: Int, val row: JSONObject?, val label: String)
    private val KIND_ORDER = listOf("team", "subteam", "category", "channel", "agent")
    private fun ordered(l: List<JSONObject>) = l.sortedWith(compareBy<JSONObject>({ KIND_ORDER.indexOf(it.s("kind")).let { i -> if (i < 0) 9 else i } }, { it.s("name").lowercase() }))

    /** The structure rows as an indented tree: parents before children, subteams before categories before channels before agents. */
    fun tree(rows: List<JSONObject>): List<Node> {
        val ids = rows.map { it.s("id") }.toSet(); val kids = rows.groupBy { it.s("parent_id") }; val out = mutableListOf<Node>()
        fun walk(r: JSONObject, depth: Int, seen: Set<String>) {
            out += Node(depth, r, r.s("name").ifBlank { pretty(r.s("id")) })
            if (r.s("id") !in seen) ordered(kids[r.s("id")].orEmpty()).forEach { walk(it, depth + 1, seen + r.s("id")) }
        }
        rows.filter { it.s("parent_id").isBlank() || it.s("parent_id") !in ids }.groupBy { it.s("parent_id") }.toSortedMap().forEach { (parent, list) ->
            if (parent.isBlank()) ordered(list).forEach { walk(it, 0, emptySet()) }
            else { out += Node(0, null, pretty(parent)); ordered(list).forEach { walk(it, 1, emptySet()) } }
        }
        return out
    }

    /** "ai-tools-shorts" -> "Ai Tools Shorts" for a team that exists only as the parent of other rows. */
    fun pretty(id: String) = id.substringAfterLast('/').replace('-', ' ').replace('_', ' ').split(' ').filter { it.isNotBlank() }.joinToString(" ") { it.replaceFirstChar(Char::uppercase) }
    /** A structure id from a name: lower case letters and digits joined by dashes (the RPC accepts a-z 0-9 . _ / -). */
    fun slug(name: String) = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').take(60)
}

// ---------------------------------------------------------------- revenue
data class RevSource(val id: String, val provider: String, val name: String, val state: String, val text: String, val sub: String, val connect: Boolean, val sync: Boolean)

object Revenue {
    /** The providers that sell something and have a cloud sync (Gumroad first). A revenue_sync row adds any other source that reports. */
    val PROVIDERS = setOf("gumroad")
    /** Gumroad reports every amount in USD (its price is USD cents), so a verified zero is "USD 0", never rupees. The rows carry their own currency when they exist. */
    private val CURRENCY = mapOf("gumroad" to "USD")
    private val SALE_KINDS = setOf("sale", "purchase", "order", "payment", "charge", "revenue", "subscription", "renewal", "download")
    private val REFUND_KINDS = setOf("refund", "chargeback")
    private val FAILED = Regex("err|fail", RegexOption.IGNORE_CASE)
    const val DAYS = 28L
    fun zero(provider: String) = (CURRENCY[provider] ?: "INR") + " 0"

    /** One record's money: a sale counts, a refund (a row with kind refund and a POSITIVE amount) counts against; fees, payouts and adjustments are not sales.
     *  A record without a number is skipped, never a 0. */
    fun amount(e: JSONObject): Double? {
        val v = e.s("amount").toDoubleOrNull() ?: return null
        val kind = e.s("kind").lowercase().ifBlank { "sale" }
        return when { kind in REFUND_KINDS -> -kotlin.math.abs(v); kind in SALE_KINDS -> v; else -> null }
    }
    fun isSale(e: JSONObject) = amount(e)?.let { e.s("kind").lowercase().ifBlank { "sale" } !in REFUND_KINDS } ?: false
    /** Net money per currency (sales minus refunds). Currencies are never added together. */
    fun totals(events: List<JSONObject>): Map<String, Double> = events.mapNotNull { e -> amount(e)?.let { e.s("currency").uppercase() to it } }
        .groupBy({ it.first }, { it.second }).mapValues { it.value.sum() }.toSortedMap()
    fun money(t: Map<String, Double>) = t.entries.joinToString(" · ") { (if (it.key.isBlank()) "" else it.key + " ") + Facts.number(it.value) }

    /** One line per revenue source. A verified zero (connected, the last sync ok, no sales) is "USD 0"; otherwise the reason there is no number. */
    fun sources(accounts: List<JSONObject>, sync: List<JSONObject>, events: List<JSONObject>, served: Boolean, only: Set<String>? = null, now: Instant = Instant.now()): List<RevSource> {
        val ids = (accounts.filter { it.s("provider") in PROVIDERS }.map { it.s("connection_id") } + sync.map { it.s("connection_id") }).filter { it.isNotBlank() && (only == null || it in only) }.distinct()
        return ids.map { id ->
            val a = accounts.firstOrNull { it.s("connection_id") == id }; val s = sync.firstOrNull { it.s("connection_id") == id }
            val provider = a?.s("provider") ?: s?.s("provider").orEmpty()
            val name = a?.s("external_name")?.ifBlank { null } ?: id
            val mine = events.filter { it.s("connection_id") == id || (it.s("connection_id").isBlank() && it.s("source") == provider) }
            val ok = s?.s("last_ok_at").orEmpty()
            val synced = s != null && (ok.isNotBlank() || s.s("state").equals("ok", true))
            val failed = s != null && (FAILED.containsMatchIn(s.s("state")) || (s.s("error").isNotBlank() && s.s("last_synced_at") > ok))
            when {
                a?.s("state") != "connected" -> RevSource(id, provider, name, "not_connected", "Not connected", "Connect $name to read its sales. Nothing is estimated.", connect = true, sync = false)
                !served -> RevSource(id, provider, name, "unavailable", "Not available yet", "Revenue records are not served by Coco Cloud yet, so no total is shown.", connect = false, sync = true)
                !synced -> RevSource(id, provider, name, "never_synced", "Not synced yet", "Connected, but no sync has finished yet. Press Sync now." + (s?.s("error")?.takeIf { it.isNotBlank() }?.let { " Last error: ${it.take(100)}" } ?: ""), connect = false, sync = true)
                failed -> RevSource(id, provider, name, "failed", "Last sync failed", "${s!!.s("error").ifBlank { "No reason recorded" }.take(110)} · last good sync ${asOf(ok.ifBlank { s.s("last_synced_at") })}", connect = false, sync = true)
                else -> {
                    val sales = mine.count { isSale(it) }; val at = asOf(ok.ifBlank { s!!.s("last_synced_at") })
                    val recent = mine.filter { Facts.instant(it.s("occurred_at"))?.isAfter(now.minus(Duration.ofDays(DAYS))) == true }
                    RevSource(id, provider, name, "synced", money(totals(mine)).ifBlank { zero(provider) },
                        if (mine.isEmpty()) "Connected and verified: no sales yet · last successful sync $at"
                        else "$sales sale${if (sales == 1) "" else "s"} · last successful sync $at · last $DAYS days ${money(totals(recent)).ifBlank { zero(provider) }}", connect = false, sync = true)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- YouTube
data class YtChannel(val id: String, val name: String, val views: Double?, val subscribers: Double?, val videos: Double?, val at: String)
data class YtTotals(val views: Double?, val subscribers: Double?, val at: String?)

object Yt {
    private fun num(m: JSONObject?, k: String) = m?.optString(k)?.toDoubleOrNull()
    /** The newest channel totals per connection from yt_stats (kind channel, the Data API row: lifetime views, subscribers, videos). */
    fun channels(rows: List<JSONObject>, accounts: List<JSONObject>): List<YtChannel> = rows
        .filter { it.s("kind") == "channel" && it.optJSONObject("metrics")?.let { m -> m.has("views") || m.has("subscribers") } == true }
        .sortedByDescending { it.s("at") }.distinctBy { it.s("connection_id") }
        .map { r -> val m = r.optJSONObject("metrics"); val id = r.s("connection_id")
            YtChannel(id, accounts.firstOrNull { it.s("connection_id") == id }?.s("external_name")?.ifBlank { null } ?: id, num(m, "views"), num(m, "subscribers"), num(m, "videos"), r.s("at")) }
        .sortedByDescending { it.views ?: -1.0 }
    fun totals(ch: List<YtChannel>) = YtTotals(ch.mapNotNull { it.views }.takeIf { it.isNotEmpty() }?.sum(), ch.mapNotNull { it.subscribers }.takeIf { it.isNotEmpty() }?.sum(), ch.maxOfOrNull { it.at })
}

// ---------------------------------------------------------------- connections
/** A service listed even though it has no integrations row. PickTheory is a YouTube channel that does not exist yet (connection yt-app-web): it connects with Google
 *  sign-in once the channel exists, never with a key. */
data class Catalog(val provider: String, val name: String, val how: String, val oauth: String?, val connection: String?)

object ConnRules {
    /** Platforms with a cloud sign-in flow (POST /api/oauth/begin). */
    val OAUTH = listOf("youtube", "gumroad")
    /** The one provider a key can really be pasted for (Gumroad takes a token). No other provider has a key door, so none gets a key form. */
    val KEY_PROVIDERS = setOf("gumroad")
    /** youtube / gumroad for the provider row and its variants ("gumroad-poppy"); null for a platform with no sign-in flow. */
    fun oauthProvider(id: String): String? = OAUTH.firstOrNull { id == it || id.startsWith("$it-") || id.startsWith("${it}_") }
    private val ON_A_PC = Regex("[\\\\/~.]")
    /** A vault name is a credential the cloud can read; a path is a file on one PC that no cloud run can open. */
    fun cloudHeld(ref: String) = ref.isNotBlank() && !ON_A_PC.containsMatchIn(ref)
    fun credential(ref: String) = when { ref.isBlank() -> "No credential stored"; !cloudHeld(ref) -> "Credential only on one PC, so the cloud cannot use it"; else -> "Credential held in the cloud vault" }
    val CATALOGUE = listOf(Catalog("picktheory", "PickTheory",
        "PickTheory is a YouTube channel that does not exist yet. Create the channel first, then Connect.\n1. On YouTube, signed in as the Google account of the other Coco channels, create a new brand channel for App / Web / Product with the name you choose.\n" +
            "2. Press Connect, pick the new brand channel (not the account) on Google's page and approve everything it asks.\n3. Press Verify. Then assign the channel to a team, or nothing publishes with it.", "youtube", "yt-app-web"))
    fun validId(id: String) = Regex("^[a-z0-9][a-z0-9._-]{1,60}$").matches(id)
}

// ---------------------------------------------------------------- approvals
object ApprovalText {
    /** The action an approval asks for, one readable line per field. */
    fun actionLines(action: JSONObject?, prefix: String = ""): List<String> {
        if (action == null) return emptyList()
        return action.keys().asSequence().sorted().flatMap { k ->
            val v = action.opt(k)
            when (v) {
                is JSONObject -> actionLines(v, "$prefix$k.").asSequence()
                is JSONArray -> sequenceOf("$prefix$k: " + (0 until v.length()).joinToString(", ") { i -> v.opt(i).toString() }.take(160))
                else -> sequenceOf("$prefix$k: ${v.toString().take(160)}")
            }
        }.toList()
    }
}
