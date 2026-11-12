package com.goodspace.cocolounge

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.Instant

/*
 * The operating rules, held on synthetic rows that have the shape of the production tables (same columns, same status vocabulary,
 * same proportions). No real task title, name or id is in here. The Houses are the real navigation contract the app ships with.
 */
private fun o(vararg kv: Pair<String, Any?>) = JSONObject().apply { kv.forEach { (k, v) -> put(k, v ?: JSONObject.NULL) } }
private val NOW = Instant.parse("2026-11-12T10:00:00Z")
private val HOUSES = NavContract.parse(File("../../Lounge/contract/nav-contract.json").readText()).houses
private fun ids(l: List<JSONObject>, k: String = "id") = l.map { it.s(k) }
private const val TASK_ID = "0a1b2c3d-1111-2222-3333-444455556666"

class TaskRulesTest {
    private fun t(id: String, status: String, vararg more: Pair<String, Any?>) =
        o("id" to id, "title" to "Task $id", "status" to status, "priority" to 2, "created_at" to "2026-11-0${id.take(1)}T08:00:00Z", *more)

    private val all = listOf(t("1", "queued"), t("2", "failed", "error" to "gateway refused"), t("3", "running"), t("4", "paused"), t("5", "planned"),
        t("6", "stopped"), t("7", "done", "result" to "ok"), t("8", "queued", "merged_into" to "1"), t("9", "cancelled"), t("1b", "queued", "house_id" to "gigi", "details" to "make a short"))

    @Test fun theFiveFiltersFollowTheStatusVocabulary() {
        listOf("queued", "planned", "paused", "running", "verifying", "blocked", "waiting_pc", "needs_yes", "need_approval", "working").forEach { assertEquals(it, TaskRules.Filter.Open, TaskRules.group(it)) }
        assertEquals(TaskRules.Filter.Failed, TaskRules.group("failed")); assertEquals(TaskRules.Filter.Done, TaskRules.group("done"))
        assertEquals(TaskRules.Filter.Stopped, TaskRules.group("stopped")); assertEquals(TaskRules.Filter.Stopped, TaskRules.group("cancelled"))
        // open 1,3,4,5 and 1b (the merged twin 8 is not work of its own); running is the claimed one, which is also open
        assertEquals(5, TaskRules.count(all, TaskRules.Filter.Open)); assertEquals(1, TaskRules.count(all, TaskRules.Filter.Running)); assertEquals(1, TaskRules.count(all, TaskRules.Filter.Failed))
        assertEquals(1, TaskRules.count(all, TaskRules.Filter.Done)); assertEquals(2, TaskRules.count(all, TaskRules.Filter.Stopped))
    }

    @Test fun onlyRunningOrWorkingIsRunningAndVerifyingIsAFinishedThingToCheck() {
        assertEquals(setOf("running", "working"), TaskRules.RUNNING)
        assertEquals(0, TaskRules.count(listOf(t("1", "verifying")), TaskRules.Filter.Running)); assertEquals(1, TaskRules.count(listOf(t("1", "working")), TaskRules.Filter.Running))
        assertEquals("Needs a check", TaskRules.statusText("verifying")); assertEquals("Needs YES", TaskRules.statusText("needs_yes")); assertEquals("Needs YES", TaskRules.statusText("need_approval"))
        assertEquals("Waits for a PC", TaskRules.statusText("waiting_pc")); assertNull(TaskRules.statusText("queued")); assertNull(TaskRules.statusText("failed"))
        assertEquals(setOf("blocked", "needs_yes", "need_approval"), TaskRules.NEEDS_ME)
    }

    @Test fun listIsByPriorityThenNewestAndSearchesTheWholeText() {
        assertEquals(listOf("5", "4", "3", "1", "1b"), ids(TaskRules.list(all, TaskRules.Filter.Open)))
        val urgent = all.map { JSONObject(it.toString()) }.also { it.first { x -> x.s("id") == "1" }.put("priority", 1); it.first { x -> x.s("id") == "4" }.put("priority", 3) }
        assertEquals(listOf("1", "5", "3", "1b", "4"), ids(TaskRules.list(urgent, TaskRules.Filter.Open)))
        assertEquals(listOf("1b"), ids(TaskRules.list(all, TaskRules.Filter.Open, query = "short GIGI") { it.s("house_id") }))   // house name and details are searched together
        assertEquals(listOf("1b"), ids(TaskRules.list(all, TaskRules.Filter.Open, house = "gigi")))
        assertEquals(listOf("5", "4", "3", "1"), ids(TaskRules.list(all, TaskRules.Filter.Open, house = "none")))               // "No House"
        assertEquals(listOf("3"), ids(TaskRules.list(all, TaskRules.Filter.Running))); assertEquals(listOf("2"), ids(TaskRules.list(all, TaskRules.Filter.Failed, query = "FAILED")))
        assertTrue(TaskRules.list(all, TaskRules.Filter.Open, query = "nothing like this").isEmpty())
    }

    @Test fun theStateMachineOffersOnlyLegalMovesMainOneFirst() {
        assertEquals(listOf(TaskRules.Act.Start, TaskRules.Act.Cancel), TaskRules.actions("planned"))
        // a queued task with no cloud run asked for can be started; once a run is asked for there is nothing left to start
        assertEquals(listOf(TaskRules.Act.Start, TaskRules.Act.Pause, TaskRules.Act.Cancel), TaskRules.actions("queued"))
        assertEquals(listOf(TaskRules.Act.Pause, TaskRules.Act.Cancel), TaskRules.actions("queued", liveRequest = true))
        assertEquals(listOf(TaskRules.Act.Pause, TaskRules.Act.Cancel), TaskRules.actions("running")); assertEquals(listOf(TaskRules.Act.Pause, TaskRules.Act.Cancel), TaskRules.actions("waiting_pc"))
        assertEquals(listOf(TaskRules.Act.Resume, TaskRules.Act.Cancel), TaskRules.actions("paused"))
        assertEquals(listOf(TaskRules.Act.Retry, TaskRules.Act.Cancel), TaskRules.actions("failed"))
        assertEquals(listOf(TaskRules.Act.Cancel), TaskRules.actions("blocked")); assertEquals(listOf(TaskRules.Act.Cancel), TaskRules.actions("verifying"))
        listOf("done", "stopped", "cancelled").forEach { assertTrue("$it is finished", TaskRules.actions(it).isEmpty()) }
    }

    @Test fun everyMoveWritesItsColumnsAndOnlyWhileTheStatusStillFits() {
        val c = { act: TaskRules.Act, task: JSONObject -> TaskRules.change(act, task, NOW) }
        val start = c(TaskRules.Act.Start, t("5", "planned"))
        assertEquals("queued", start.patch.getString("status")); assertEquals(setOf("planned", "queued"), start.onlyIf); assertFalse(start.patch.has("result"))
        val pause = c(TaskRules.Act.Pause, t("1", "queued"))
        assertEquals("paused", pause.patch.getString("status")); assertTrue(listOf("queued", "running", "working", "waiting_pc").all { it in pause.onlyIf } && "paused" !in pause.onlyIf)
        // resume and retry give the task back unclaimed: claim_task only takes queued rows with no claimed_by_device
        val resume = c(TaskRules.Act.Resume, t("4", "paused", "claimed_by_device" to "cloud-worker-1"))
        assertEquals("queued", resume.patch.getString("status")); assertTrue(listOf("claimed_by_device", "claimed_at", "heartbeat_at").all { resume.patch.isNull(it) }); assertFalse(resume.patch.getBoolean("stale"))
        assertEquals(setOf("paused"), resume.onlyIf)
        val retry = c(TaskRules.Act.Retry, t("2", "failed", "retry_count" to 2, "error" to "boom"))
        assertEquals("queued", retry.patch.getString("status")); assertEquals(3, retry.patch.getInt("retry_count")); assertTrue(retry.patch.isNull("error") && retry.patch.isNull("claimed_by_device"))
        assertEquals(setOf("failed"), retry.onlyIf); assertEquals("Retry 3. Previous error: boom", retry.note)
        assertNull(c(TaskRules.Act.Retry, t("2", "failed")).note?.takeIf { "Previous" in it })
        val cancel = c(TaskRules.Act.Cancel, t("1", "queued"))
        assertEquals("stopped", cancel.patch.getString("status"))
        assertTrue(listOf("planned", "queued", "running", "paused", "blocked", "failed").all { it in cancel.onlyIf }); assertTrue(listOf("done", "stopped", "cancelled").none { it in cancel.onlyIf })
        assertEquals(NOW.toString(), start.patch.getString("updated_at"))
    }

    @Test fun startAndRetryRecordTheCloudRunRequestAsWaitingNeverRunning() {
        val s = TaskRules.change(TaskRules.Act.Start, t("5", "planned"), NOW, 12)
        assertEquals("queued", s.patch.getString("status")); assertEquals("Waiting for the next cloud run (request #12)", s.patch.getString("result"))
        val r = TaskRules.change(TaskRules.Act.Retry, t("2", "failed", "retry_count" to 0), NOW, 13)
        assertEquals("queued", r.patch.getString("status")); assertEquals("Waiting for the next cloud run (request #13)", r.patch.getString("result")); assertEquals(1, r.patch.getInt("retry_count"))
        assertFalse(TaskRules.Act.Start.said.contains("running", true))
    }

    @Test fun aTaskNamesItsTeamForTheCloudAndAsksForItsWorkflow() {
        // House -> team, as the cloud intake reads it
        assertEquals(mapOf("gigi" to "youtube", "lulu" to "software", "poppy" to "ebooks", "fifi" to "courses", "zaza" to "games", "mochi" to "comics", "tilly" to "commerce"), TaskRules.HOUSE_TEAM)
        assertEquals("youtube", TaskRules.teamOf(o("details" to "Team: youtube\nmake it", "house_id" to "lulu")))   // the first details line wins
        assertEquals("ebooks", TaskRules.teamOf(o("details" to "write a book", "house_id" to "poppy"))); assertNull(TaskRules.teamOf(o("details" to "no house")))
        assertEquals("ebooks-pick", TaskRules.workflowOf(o("house_id" to "poppy"))); assertNull(TaskRules.workflowOf(o("house_id" to null)))
        assertEquals("coco-task:$TASK_ID · ${"x".repeat(160)}", TaskRules.runNote(o("id" to TASK_ID, "title" to "x".repeat(300))))
        assertEquals("Team: youtube\nmake a short", TaskRules.withTeam("make a short", "gigi")); assertEquals("Team: youtube", TaskRules.withTeam("", "gigi"))
        assertEquals("Team: youtube\nmore", TaskRules.withTeam("Team: youtube\nmore", "gigi")); assertEquals("just words", TaskRules.withTeam("just words", null))
    }

    @Test fun assignAndPriorityAreGuardedOrFree() {
        val a = TaskRules.assign("lola", "gigi", null, NOW)
        assertEquals("lola", a.patch.getString("member_id")); assertEquals("gigi", a.patch.getString("house_id")); assertTrue(a.patch.isNull("pipeline_id") && a.patch.isNull("step"))   // clearing the pipeline clears the step
        assertTrue("queued" in a.onlyIf && "failed" in a.onlyIf && "done" !in a.onlyIf)
        val b = TaskRules.assign(null, null, "gigi-daily-short", NOW)
        assertTrue(b.patch.isNull("member_id") && b.patch.isNull("house_id")); assertEquals("gigi-daily-short", b.patch.getString("pipeline_id")); assertFalse(b.patch.has("step"))
        val p = TaskRules.priority(1, NOW)
        assertEquals(1, p.patch.getInt("priority")); assertTrue(p.onlyIf.isEmpty())
        assertEquals("High", TaskRules.priorityLabel(1)); assertEquals("Normal", TaskRules.priorityLabel(2)); assertEquals("Low", TaskRules.priorityLabel(3)); assertEquals("P7", TaskRules.priorityLabel(7))
    }

    @Test fun progressIsAStepRecordedByAWorkerNeverInvented() {
        val p = o("id" to "p1", "name" to "Daily Short", "steps" to JSONArray().put(o("do" to "pick", "member" to "lola")).put(o("do" to "write", "member" to "margot")).put(o("do" to "check")))
        assertEquals(3, TaskRules.steps(p)); assertEquals("write", TaskRules.stepOf(p, 1)?.getString("do"))
        val two = TaskRules.progress(t("1", "running", "pipeline_id" to "p1", "step" to 2), listOf(p))!!
        assertEquals("Daily Short", two.pipeline); assertEquals("step 2 of 3", two.label); assertEquals(2f / 3f, two.ratio!!, 0.001f)
        assertEquals(1f, TaskRules.progress(t("1", "running", "pipeline_id" to "p1", "step" to 9), listOf(p))!!.ratio!!, 0f)
        val none = TaskRules.progress(t("1", "running", "pipeline_id" to "p1"), listOf(p))!!
        assertEquals("not started", none.label); assertNull(none.ratio)
        assertNull(TaskRules.progress(t("1", "running", "step" to 1), listOf(p)))                       // no pipeline, no progress
        assertEquals("step 1", TaskRules.progress(t("1", "running", "pipeline_id" to "gone", "step" to 1), listOf(p))!!.label)   // a pipeline row that is missing
        assertEquals(2, TaskRules.steps(o("steps" to "[{\"do\":\"a\"},{\"do\":\"b\"}]")))              // a pipeline served as text
    }

    @Test fun aQueuedTaskSaysWhatItIsWaitingFor() {
        val pcUp = Workers.status(listOf(o("id" to "mangesh-pc", "kind" to "pc", "last_seen" to "2026-11-12T09:59:30Z")), NOW); val pcDown = Workers.status(emptyList(), NOW)
        val live = o("id" to 12, "note" to "coco-task:$TASK_ID · x", "state" to "pending", "workflow_id" to "youtube-pick")
        val done = o("id" to 9, "note" to "coco-task:$TASK_ID · x", "state" to "failed", "workflow_id" to "youtube-pick", "reason" to "AI credit")
        val q = o("id" to TASK_ID, "status" to "queued", "needs" to "cloud")
        assertEquals("Waiting for the next cloud run (request #12). Cloud runs happen about twice a day.", TaskRules.wait(q, pcDown, listOf(done, live)))
        assertEquals("Queued, but no cloud run has been asked for yet. Press Start to ask for one.", TaskRules.wait(q, pcDown, listOf(done)))     // a failed request is not a waiting one
        assertEquals("Queued, but no cloud run has been asked for yet. Press Start to ask for one.", TaskRules.wait(q, pcDown))
        assertEquals("Queued: an online PC can claim it", TaskRules.wait(o("id" to "x", "status" to "queued", "needs" to "pc"), pcUp)); assertEquals("Waiting for a PC: no PC is online", TaskRules.wait(o("id" to "x", "status" to "queued", "needs" to "pc"), pcDown))
        assertNull(TaskRules.wait(o("id" to TASK_ID, "status" to "running"), pcUp)); assertNull(TaskRules.wait(o("id" to TASK_ID, "status" to "done"), pcUp)); assertNull(TaskRules.wait(o("id" to TASK_ID, "status" to "paused"), pcUp))
    }

    @Test fun runRequestsAreFoundByTheNoteAndSayWhatHappened() {
        val a = o("id" to 8, "note" to "coco-task:$TASK_ID · Daily", "state" to "failed", "workflow_id" to "youtube-pick", "reason" to "the agent monthly limit")
        val b = o("id" to 9, "note" to "coco-task:$TASK_ID · Daily", "state" to "pending", "workflow_id" to "youtube-pick")
        val other = o("id" to 10, "note" to "coco-task:ffffffff-1111-2222-3333-444455556666 · Other", "state" to "pending"); val loop = o("id" to 2, "note" to "Phase 3 proof", "state" to "failed")
        assertEquals(listOf("9", "8"), ids(RunRequests.of(TASK_ID, listOf(a, other, b, loop))))
        assertTrue(RunRequests.live(b) && !RunRequests.live(a)); assertTrue(RunRequests.bad(a) && RunRequests.bad(loop) && !RunRequests.bad(b)); assertTrue(RunRequests.live(o("state" to "claimed")))
        assertEquals(TASK_ID, RunRequests.taskIdOf(a)); assertNull(RunRequests.taskIdOf(loop))
        assertEquals("Request #8 · youtube-pick · failed · the agent monthly limit", RunRequests.line(a))
    }
}

class JobAndAttentionTest {
    private val jobs = listOf(
        o("id" to "j1", "type" to "teleport", "team_id" to "core", "status" to "blocked", "error" to o("kind" to "unsupported", "message" to "no handler for job type teleport")),
        o("id" to "j2", "type" to "store-artifact", "team_id" to "youtube", "status" to "failed", "error" to o("kind" to "boom")),
        o("id" to "j3", "type" to "store-artifact", "team_id" to "ebooks", "status" to "failed"),
        o("id" to "j4", "type" to "filter-rank", "team_id" to "social", "status" to "running", "attempt" to 1, "max_attempts" to 3),
        o("id" to "j5", "type" to "filter-rank", "team_id" to "social", "status" to "done", "error" to JSONObject(), "completed_at" to "2026-11-02T10:00:00Z", "idempotency_key" to "coco-task:$TASK_ID:filter-rank"))

    @Test fun jobsCancelAndRetryByStatus() {
        listOf("queued", "running", "blocked").forEach { assertTrue(JobRules.canCancel(it)) }
        listOf("done", "failed", "cancelled").forEach { assertFalse(JobRules.canCancel(it)) }
        listOf("failed", "blocked", "cancelled").forEach { assertTrue(JobRules.canRetry(it)) }
        assertFalse(JobRules.canRetry("done")); assertFalse(JobRules.canRetry("running"))
        assertEquals(listOf("j1", "j4"), ids(JobRules.list(jobs, JobRules.Filter.Open))); assertEquals(listOf("j2", "j3"), ids(JobRules.list(jobs, JobRules.Filter.Failed)))
        assertEquals(listOf("j5"), ids(JobRules.list(jobs, JobRules.Filter.Done))); assertEquals(5, JobRules.list(jobs, JobRules.Filter.All).size)
        assertEquals(listOf("j4"), ids(JobRules.running(jobs)))
    }

    @Test fun aJobProblemIsItsMessageThenItsKind() {
        assertEquals("no handler for job type teleport", JobRules.problem(jobs[0])); assertEquals("boom", JobRules.problem(jobs[1])); assertEquals("", JobRules.problem(jobs[2])); assertEquals("", JobRules.problem(jobs[4]))
    }

    @Test fun aTasksJobsAreFoundByTheirKeyAndOnlyFiveTypesNeedNoAi() {
        assertEquals(listOf("j5"), ids(JobRules.ofTask(TASK_ID, jobs))); assertTrue(JobRules.ofTask("ffffffff-1111-2222-3333-444455556666", jobs).isEmpty())
        assertEquals(listOf("filter-rank", "package-research", "search-memory", "validate-output", "title-analytics"), JobRules.ZERO_AI.map { it.first })
        assertEquals("2026-11-02T10:00:00Z", Workers.latestJob(jobs)); assertNull(Workers.latestJob(listOf(o("completed_at" to null))))
    }

    @Test fun theCloudWorkerIsJudgedByItsSchedule() {
        // a run within twelve hours is a healthy one; a PC must have beaten within 150 seconds
        assertTrue(Workers.online(o("last_seen" to "2026-11-12T09:55:00Z"), NOW)); assertTrue(Workers.online(o("last_seen" to "2026-11-11T22:30:00Z"), NOW))
        assertFalse(Workers.online(o("last_seen" to "2026-11-11T21:00:00Z"), NOW)); assertFalse(Workers.online(o("last_seen" to null), NOW)); assertFalse(Workers.online(o("last_seen" to "2026-11-02 12:59:00+00"), NOW))
        val s = Workers.status(listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-12T03:00:00Z"), o("id" to "mangesh-pc", "kind" to "pc", "last_seen" to "2026-11-12T09:56:00Z"),
            o("id" to "old-worker-2", "kind" to "cloud", "active" to false, "last_seen" to "2026-11-12T09:59:00Z")), NOW)
        assertTrue(s.cloud!!.online && s.cloud.id == "cloud-worker-1"); assertFalse(s.pcOnline)                       // the PC beat 4 minutes ago: not online for a PC
        assertTrue(Workers.status(listOf(o("id" to "mangesh-pc", "kind" to "pc", "last_seen" to "2026-11-12T09:59:00Z")), NOW).pcOnline)
        // words: when it last ran, never a bare "offline"
        assertTrue(Workers.line(emptyList(), false, NOW).contains("not been read")); assertTrue(Workers.line(listOf(o("id" to "mangesh-pc")), true, NOW).contains("No cloud worker is paired"))
        val ran = Workers.line(listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-12T03:00:00Z")), true, NOW, jobs)
        assertTrue(ran.startsWith("Cloud worker: last run") && ran.contains("latest job finished") && !ran.contains("offline", true) && !ran.contains("not reported"))
        val late = Workers.line(listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-02T12:59:00Z")), true, NOW)
        assertTrue(late.startsWith("Cloud worker: last run") && late.contains("not reported for a while") && !late.contains("offline", true))
    }

    @Test fun needsAttentionLooksWorstFirstAndCountsTheTiles() {
        val tasks = listOf(o("id" to "t1", "title" to "Queued thing", "status" to "queued"), o("id" to "t2", "title" to "Failed thing", "status" to "failed", "error" to "gateway refused: x"),
            o("id" to "t3", "title" to "Running thing", "status" to "running"), o("id" to "t4", "title" to "Twin", "status" to "failed", "merged_into" to "t1"), o("id" to "t5", "title" to "Blocked thing", "status" to "blocked"))
        val approvals = listOf(o("id" to "a1", "code" to "A-1", "what" to "Publish the thing", "state" to "waiting", "team" to "YouTube"), o("id" to "a2", "code" to "A-2", "state" to "approved"), o("id" to "a3", "code" to "A-3", "state" to "on-hold"))
        val integrations = listOf(o("id" to "gumroad-poppy", "platform" to "Gumroad", "state" to "connected", "error" to "token leaked"), o("id" to "youtube", "platform" to "YouTube", "state" to "connected", "error" to ""),
            o("id" to "stt_supabase", "platform" to "STT", "state" to "error", "error" to "egress"))
        val accounts = listOf(o("connection_id" to "yt-x", "provider" to "youtube", "external_name" to "Channel X", "state" to "error"), o("connection_id" to "yt-y", "provider" to "youtube", "state" to "connected"))
        val devices = listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-02T12:59:00Z"), o("id" to "mangesh-phone", "last_seen" to "2026-11-12T09:59:00Z"))
        val runs = listOf(o("id" to 8, "workflow_id" to "youtube-pick", "state" to "failed", "note" to "coco-task:$TASK_ID · Daily", "reason" to "gateway refused: the agent monthly limit", "created_at" to "2026-11-12T05:39:00Z", "finished_at" to "2026-11-12T05:39:30Z"),
            o("id" to 7, "workflow_id" to "ebooks-pick", "state" to "failed", "note" to "coco-task:$TASK_ID · Old", "reason" to "AI credit", "created_at" to "2026-11-03T06:28:00Z", "finished_at" to "2026-11-03T06:28:00Z"),       // older than a week: not an alert
            o("id" to 9, "workflow_id" to "youtube-pick", "state" to "pending", "note" to "coco-task:$TASK_ID · Daily"))
        val policies = listOf(o("scope" to "agent", "scope_id" to "youtube.marquee", "key" to "claude", "value" to "denied"), o("scope" to "agent", "scope_id" to "ebooks.ebooks-head", "key" to "claude", "value" to "blocked"),
            o("scope" to "agent", "scope_id" to "core.nova", "key" to "claude", "value" to "on_demand"), o("scope" to "agent", "scope_id" to "youtube.marquee", "key" to "daily_tokens", "value" to 15000))
        val rows = Attention.rows(tasks, approvals, jobs, integrations, accounts, devices, NOW, runs, policies)
        // bad first (the failed task, the failed cloud run, failed jobs, the connections), then warn (the YES, the blocked task and job, the AI policies), then what is only noted (the worker)
        assertEquals(listOf("task:t2", "runreq:$TASK_ID", "job:j2", "job:j3", "account:yt-x", "integration:gumroad-poppy", "integration:stt_supabase",
            "approval:a1", "task:t5", "job:j1", "policy:agent/ebooks.ebooks-head", "policy:agent/youtube.marquee", "worker:worker"), rows.map { it.kind + ":" + it.id })
        assertEquals(List(7) { "bad" } + List(5) { "warn" } + "info", rows.map { it.tone })
        assertEquals("Reconnect", rows.first { it.id == "gumroad-poppy" }.action); assertEquals("Open", rows.first { it.id == "stt_supabase" }.action)
        assertEquals("Task failed: gateway refused: x", rows.first { it.id == "t2" }.sub); assertEquals("Cloud run failed: youtube-pick", rows.first { it.kind == "runreq" }.title)
        assertEquals("Claude is denied for agent youtube.marquee", rows.first { it.id == "agent/youtube.marquee" }.title)
        assertTrue(rows.last().title.startsWith("Cloud worker: last run") && !rows.last().title.contains("offline", true))
        // open: queued + running + blocked (failed and the merged twin are not); running: the task + the running job; YES: only "waiting"; alerts: every row that is not a request and not just noted
        assertEquals(Attention.Tiles(open = 3, failed = 1, running = 2, waiting = 1, alerts = 11), Attention.tiles(tasks, approvals, jobs, rows))
    }

    @Test fun aTaskWaitingForAYesNeedsAttention() {
        val rows = Attention.rows(listOf(o("id" to "t", "title" to "Needs me", "status" to "needs_yes"), o("id" to "u", "title" to "Check me", "status" to "verifying")), emptyList(), emptyList(), emptyList(), emptyList(), emptyList(), NOW)
        assertEquals(listOf("task:t"), rows.map { it.kind + ":" + it.id }); assertEquals("warn", rows.single().tone)   // "verifying" is finished work to check, not a problem
    }

    @Test fun aWorkerThatHasNotRunForAWhileIsOnlyNoted() {
        val stale = Attention.rows(listOf(o("id" to "t", "status" to "queued")), emptyList(), emptyList(), emptyList(), emptyList(), listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-02T12:59:00Z")), NOW)
        assertEquals(listOf("info"), stale.map { it.tone }); assertEquals(0, Attention.tiles(emptyList(), emptyList(), emptyList(), stale).alerts)
        val none = Attention.rows(emptyList(), emptyList(), emptyList(), emptyList(), emptyList(), listOf(o("id" to "mangesh-pc", "last_seen" to "2026-11-12T09:59:00Z")), NOW)
        assertEquals("info", none.single().tone); assertEquals(0, Attention.tiles(emptyList(), emptyList(), emptyList(), none).alerts)   // no worker and no work: noted, not an alert
        assertTrue(Attention.rows(emptyList(), emptyList(), emptyList(), emptyList(), emptyList(), emptyList(), NOW).isEmpty())          // before devices are read nothing is claimed
    }

    @Test fun nothingNeedsAttentionWhenAllIsWell() {
        val rows = Attention.rows(listOf(o("id" to "t", "status" to "done")), emptyList(), emptyList(), listOf(o("id" to "github", "state" to "connected", "error" to "")), emptyList(), listOf(o("id" to "cloud-worker-1", "last_seen" to "2026-11-12T08:00:00Z")), NOW)
        assertTrue(rows.isEmpty())
    }
}

class HouseMapTest {
    // the shape of production's structure table: a chat-built team, the registry's ebooks team named only by its children, a test team, and a team that says its House
    private val structure = listOf(
        o("id" to "ai-tools-shorts", "kind" to "team", "parent_id" to null, "name" to "AI Tools Shorts", "head_agent_id" to "ai-tools-shorts.head", "state" to "paused"),
        o("id" to "ai-tools-shorts/research", "kind" to "subteam", "parent_id" to "ai-tools-shorts", "name" to "Research", "state" to "paused"),
        o("id" to "ai-tools-shorts.head", "kind" to "agent", "parent_id" to "ai-tools-shorts", "name" to "Head", "state" to "paused"),
        o("id" to "ebooks/practical-skills", "kind" to "subteam", "parent_id" to "ebooks", "name" to "Practical Skills", "head_agent_id" to "ebooks.ebooks-head", "state" to "paused"),
        o("id" to "ebooks/practical-skills/everyday-tech", "kind" to "category", "parent_id" to "ebooks/practical-skills", "name" to "Everyday Tech", "state" to "paused"),
        o("id" to "e2e-lab", "kind" to "team", "parent_id" to null, "name" to "E2E Lab", "state" to "archived"),
        o("id" to "e2e-lab/ai-video-tools", "kind" to "category", "parent_id" to "e2e-lab", "name" to "AI Video Tools", "state" to "paused"),
        o("id" to "ai-video-tools", "kind" to "channel", "parent_id" to "e2e-lab/ai-video-tools", "name" to "AI Video Tools", "state" to "paused"),
        o("id" to "desk-team", "kind" to "team", "parent_id" to null, "name" to "Desk", "config" to o("house" to "lulu"), "state" to "paused"),
        o("id" to "desk-team/support", "kind" to "subteam", "parent_id" to "desk-team", "name" to "Support", "state" to "paused"))

    @Test fun theNavigationContractIsTheOnlyTableOfTeamsAndPlatforms() {
        assertEquals(7, HOUSES.size)
        mapOf("youtube" to "gigi", "social" to "gigi", "instagram" to "gigi", "software" to "lulu", "web" to "lulu", "ebooks" to "poppy", "gumroad" to "poppy", "comics" to "mochi", "courses" to "fifi", "games" to "zaza", "commerce" to "tilly",
            "gigi" to "gigi", "ebooks/practical-skills" to "poppy", "ebooks.ebooks-head" to "poppy", "Social" to "gigi").forEach { (team, house) -> assertEquals(team, house, HouseMap.houseOfTeam(HOUSES, team)) }
        listOf("career", "marketing", "sales", "core", "ai-tools-shorts.head", "", null).forEach { assertNull(it, HouseMap.houseOfTeam(HOUSES, it)) }
        assertTrue(HouseMap.inTeams(HOUSES, "gigi", "youtube")); assertFalse(HouseMap.inTeams(HOUSES, "gigi", "ebooks")); assertFalse(HouseMap.inTeams(HOUSES, "gigi", ""))
        assertEquals("gigi", HouseMap.houseOfText(HOUSES, "Social Media")); assertEquals("gigi", HouseMap.houseOfText(HOUSES, "YouTube")); assertEquals("poppy", HouseMap.houseOfText(HOUSES, "the Ebooks team"))
        listOf("Ops", "Build", "Shreya setup", "design-guild", "", null).forEach { assertNull(it, HouseMap.houseOfText(HOUSES, it)) }
    }

    @Test fun structureRowsLandInTheirHouseOrStayUnplaced() {
        assertEquals(setOf("ebooks/practical-skills", "ebooks/practical-skills/everyday-tech"), ids(HouseMap.structureOf(HOUSES, "poppy", structure)).toSet())
        // a team can say its House itself (config.house), and what sits under it follows
        assertEquals(setOf("desk-team", "desk-team/support"), ids(HouseMap.structureOf(HOUSES, "lulu", structure)).toSet())
        // a chat-built team whose name says no House, and the archived test team with its category and channel, are not placed
        assertEquals(setOf("ai-tools-shorts", "ai-tools-shorts/research", "ai-tools-shorts.head", "e2e-lab", "e2e-lab/ai-video-tools", "ai-video-tools"), ids(HouseMap.unplaced(HOUSES, structure)).toSet())
        assertTrue(HouseMap.structureOf(HOUSES, "tilly", structure).isEmpty())
        // placing a team (config.house) moves it with its children
        val placed = structure.map { JSONObject(it.toString()) }.also { l -> l.first { it.s("id") == "ai-tools-shorts" }.put("config", o("house" to "gigi")) }
        assertEquals(setOf("ai-tools-shorts", "ai-tools-shorts/research", "ai-tools-shorts.head"), ids(HouseMap.structureOf(HOUSES, "gigi", placed)).toSet())
    }

    @Test fun theTreeIndentsAndNamesATeamThatOnlyItsChildrenName() {
        val tree = HouseMap.tree(HouseMap.structureOf(HOUSES, "poppy", structure))
        assertEquals(listOf(0, 1, 2), tree.map { it.depth }); assertNull(tree[0].row); assertEquals("Ebooks", tree[0].label)
        assertEquals("Practical Skills", tree[1].label); assertEquals("Everyday Tech", tree[2].label)
        val shorts = HouseMap.tree(structure.filter { it.s("id").startsWith("ai-tools-shorts") })
        assertEquals(listOf("AI Tools Shorts", "Research", "Head"), shorts.map { it.label })   // subteams before agents
        assertEquals(listOf(0, 1, 1), shorts.map { it.depth })
    }

    @Test fun membersAccountsCategoriesAndIds() {
        val members = listOf(o("id" to "lola"), o("id" to "remy"), o("id" to "elise"))
        val links = listOf(o("member_id" to "lola", "house_id" to "gigi"), o("member_id" to "elise", "house_id" to "gigi"), o("member_id" to "remy", "house_id" to "lulu"))
        assertEquals(listOf("lola", "elise"), ids(HouseMap.membersOf("gigi", members, links)))
        val accounts = listOf(o("connection_id" to "yt-a", "provider" to "youtube"), o("connection_id" to "poppy", "provider" to "gumroad"), o("connection_id" to "x", "provider" to "github"))
        assertEquals(listOf("yt-a"), ids(HouseMap.accountsOf(HOUSES.first { it.id == "gigi" }, accounts), "connection_id"))        // the platforms a House expects
        assertEquals(listOf("poppy"), ids(HouseMap.accountsOf(HOUSES.first { it.id == "poppy" }, accounts), "connection_id"))
        assertEquals(15, HouseMap.nextCode("gigi", listOf(o("house_id" to "gigi", "code" to 14), o("house_id" to "gigi", "code" to 3), o("house_id" to "lulu", "code" to 40))))
        assertEquals(1, HouseMap.nextCode("poppy", emptyList()))
        assertEquals("my-new-team", HouseMap.slug("  My New Team! ")); assertEquals("Ai Tools Shorts", HouseMap.pretty("ai-tools-shorts")); assertEquals("Everyday Tech", HouseMap.pretty("ebooks/practical-skills/everyday-tech"))
    }
}

class RevenueAndYoutubeTest {
    private val gumroad = o("connection_id" to "shop", "provider" to "gumroad", "external_name" to "The Shop", "state" to "connected")
    private val other = o("connection_id" to "second", "provider" to "gumroad", "external_name" to "Second Shop", "state" to "not_connected")
    private val youtubeAccount = o("connection_id" to "yt-main", "provider" to "youtube", "external_name" to "Main Channel", "state" to "connected")
    private val okSync = o("connection_id" to "shop", "provider" to "gumroad", "last_synced_at" to "2026-11-12T08:00:00Z", "last_ok_at" to "2026-11-12T08:00:00Z", "state" to "ok", "error" to null, "records" to 0)
    private fun sale(amount: Any?, cur: String, kind: String = "sale", at: String = "2026-11-10T08:00:00Z") = o("connection_id" to "shop", "source" to "gumroad", "amount" to amount, "currency" to cur, "kind" to kind, "occurred_at" to at)

    @Test fun aSourceThatIsNotConnectedSaysSoAndOffersConnect() {
        val s = Revenue.sources(listOf(gumroad, other), emptyList(), emptyList(), served = true, now = NOW)
        val second = s.first { it.id == "second" }
        assertEquals("not_connected", second.state); assertEquals("Not connected", second.text); assertTrue(second.connect && !second.sync)
    }

    @Test fun tablesNotServedYetIsNotAZero() {
        val s = Revenue.sources(listOf(gumroad), emptyList(), emptyList(), served = false, now = NOW).single()
        assertEquals("unavailable", s.state); assertEquals("Not available yet", s.text); assertFalse(s.text.contains("0"))
    }

    @Test fun connectedButNeverSyncedIsNotZeroEither() {
        val s = Revenue.sources(listOf(gumroad), emptyList(), emptyList(), served = true, now = NOW).single()
        assertEquals("never_synced", s.state); assertEquals("Not synced yet", s.text); assertTrue(s.sync)
        assertEquals("never_synced", Revenue.sources(listOf(gumroad), listOf(o("connection_id" to "shop", "provider" to "gumroad", "last_ok_at" to null, "state" to "error", "error" to "denied")), emptyList(), true, now = NOW).single().state)
    }

    @Test fun aVerifiedZeroIsUsdForGumroadNeverRupees() {
        val s = Revenue.sources(listOf(gumroad), listOf(okSync), emptyList(), served = true, now = NOW).single()
        assertEquals("synced", s.state); assertEquals("USD 0", s.text); assertTrue(s.sub.contains("no sales yet"))
        // the sync's state ok with records 0 is the verified zero even before a last_ok_at stamp
        assertEquals("USD 0", Revenue.sources(listOf(gumroad), listOf(o("connection_id" to "shop", "provider" to "gumroad", "state" to "ok", "records" to 0)), emptyList(), true, now = NOW).single().text)
        assertEquals("USD 0", Revenue.zero("gumroad")); assertEquals("INR 0", Revenue.zero("some-store"))
    }

    @Test fun totalsAreNetPerCurrencyFeesAreNotSalesAndRefundsAreSubtracted() {
        val ev = listOf(sale("10", "usd"), sale(2.5, "USD"), sale("500", "INR"), sale("3", "USD", kind = "refund"), sale("", "USD"), sale(null, "USD"), sale("40", "USD", at = "2026-09-01T00:00:00Z"), sale("99", "USD", kind = "fee"))
        val s = Revenue.sources(listOf(gumroad), listOf(okSync), ev, served = true, now = NOW).single()
        assertEquals("INR 500 · USD 49.50", s.text)                      // 10 + 2.5 - 3 + 40 (a refund is a POSITIVE row that counts against); the records without a number are skipped and the fee is not a sale
        assertTrue(s.sub.startsWith("4 sales") && s.sub.contains("last 28 days INR 500 · USD 9.50"))
        assertEquals(mapOf("USD" to -5.0), Revenue.totals(listOf(sale("5", "USD", kind = "chargeback"))))
        assertNull(Revenue.amount(sale("5", "USD", kind = "payout")))
    }

    @Test fun aFailedSyncShowsItsReasonAndTheLastGoodOne() {
        val bad = o("connection_id" to "shop", "provider" to "gumroad", "last_synced_at" to "2026-11-12T09:00:00Z", "last_ok_at" to "2026-11-10T08:00:00Z", "state" to "error", "error" to "Gumroad said 401")
        val s = Revenue.sources(listOf(gumroad), listOf(bad), listOf(sale("10", "USD")), served = true, now = NOW).single()
        assertEquals("failed", s.state); assertEquals("Last sync failed", s.text); assertTrue(s.sub.contains("Gumroad said 401") && s.sub.contains("last good sync"))
    }

    @Test fun aHouseSeesOnlyItsOwnSources() {
        assertEquals(listOf("shop"), ids(Revenue.sources(listOf(gumroad, other), listOf(okSync), emptyList(), true, only = setOf("shop"), now = NOW).map { o("id" to it.id) }))
        assertTrue(Revenue.sources(listOf(gumroad), listOf(okSync), emptyList(), true, only = emptySet(), now = NOW).isEmpty())
        assertTrue(Revenue.sources(listOf(youtubeAccount), emptyList(), emptyList(), true, now = NOW).isEmpty())   // only sellers are revenue sources
    }

    @Test fun youtubeIsTheNewestChannelRowPerConnectionAndTotalsAddUp() {
        val rows = listOf(
            o("connection_id" to "yt-main", "kind" to "channel", "at" to "2026-11-11T11:50:00Z", "metrics" to o("views" to 8000, "subscribers" to 120, "videos" to 30)),
            o("connection_id" to "yt-main", "kind" to "channel", "at" to "2026-11-05T11:50:00Z", "metrics" to o("views" to 7000, "subscribers" to 100, "videos" to 28)),
            o("connection_id" to "yt-second", "kind" to "channel", "at" to "2026-10-29T13:00:00Z", "metrics" to o("views" to "32", "videos" to 0, "subscribers" to 1)),
            o("connection_id" to "yt-main", "kind" to "video", "at" to "2026-11-11T11:51:00Z", "metrics" to o("views" to 5)),
            o("connection_id" to "yt-days", "kind" to "channel", "at" to "2026-11-11T11:50:00Z", "metrics" to o("days" to JSONArray())))
        val ch = Yt.channels(rows, listOf(youtubeAccount))
        assertEquals(listOf("yt-main", "yt-second"), ch.map { it.id }); assertEquals("Main Channel", ch[0].name); assertEquals("yt-second", ch[1].name)
        assertEquals(8000.0, ch[0].views!!, 0.0); assertEquals(32.0, ch[1].views!!, 0.0)
        val t = Yt.totals(ch)
        assertEquals(8032.0, t.views!!, 0.0); assertEquals(121.0, t.subscribers!!, 0.0); assertEquals("2026-11-11T11:50:00Z", t.at)
        assertNull(Yt.totals(emptyList()).views)
    }
}

class ConnectionAndApprovalTextTest {
    @Test fun oauthProvidersAndCredentials() {
        assertEquals("gumroad", ConnRules.oauthProvider("gumroad-poppy")); assertEquals("gumroad", ConnRules.oauthProvider("gumroad")); assertEquals("youtube", ConnRules.oauthProvider("youtube"))
        assertNull(ConnRules.oauthProvider("github")); assertNull(ConnRules.oauthProvider("gumroadx")); assertNull(ConnRules.oauthProvider("chrome_store"))
        assertTrue(ConnRules.cloudHeld("gumroad_access_token_poppy")); assertFalse(ConnRules.cloudHeld("C:\\keys\\yt.env")); assertFalse(ConnRules.cloudHeld("~/.secrets/yt.env")); assertFalse(ConnRules.cloudHeld(""))
        assertEquals("No credential stored", ConnRules.credential("")); assertTrue(ConnRules.credential("/home/x/yt.env").contains("only on one PC")); assertTrue(ConnRules.credential("vault_name").contains("vault"))
        assertTrue(ConnRules.validId("picktheory")); assertTrue(ConnRules.validId("yt-the-flow")); assertFalse(ConnRules.validId("A b")); assertFalse(ConnRules.validId("x"))
    }

    @Test fun pickTheoryIsAYoutubeChannelToCreateFirstThenConnectNeverAKey() {
        val p = ConnRules.CATALOGUE.single()
        assertEquals("picktheory", p.provider); assertEquals("youtube" to "yt-app-web", p.oauth to p.connection)
        assertTrue(p.how.contains("Create the channel first, then Connect")); assertFalse(p.how.contains("key", true))
        assertEquals(setOf("gumroad"), ConnRules.KEY_PROVIDERS)                       // the one provider a token can really be pasted for
        assertFalse("picktheory" in ConnRules.KEY_PROVIDERS || "youtube" in ConnRules.KEY_PROVIDERS)
    }

    @Test fun anApprovalActionReadsOneFieldPerLine() {
        val a = o("kind" to "publish", "target" to o("channel" to "the-flow", "visibility" to "public"), "files" to JSONArray().put("a.mp4").put("b.png"), "note" to null)
        assertEquals(listOf("files: a.mp4, b.png", "kind: publish", "note: null", "target.channel: the-flow", "target.visibility: public"), ApprovalText.actionLines(a))
        assertTrue(ApprovalText.actionLines(null).isEmpty())
    }
}
