package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Coco HQ decides who works, who rests and what Coco says, from the real Coco Cloud rows. */
class HqTest {
    private fun member(id: String, doing: String? = null, job: String = "Builds things") =
        JSONObject().put("id", id).put("name", id.replaceFirstChar { it.uppercase() }).put("job", job).put("doing", doing ?: JSONObject.NULL)

    private fun task(member: String, status: String, title: String = "Task $status") =
        JSONObject().put("member_id", member).put("status", status).put("title", title)

    @Test fun waitingForYesBeatsRunningBeatsDoingBeatsQueued() {
        val m = listOf(member("lola", doing = "Scouting topics"))
        assertEquals(CrewState.Working, HqRules.crew(m, emptyList()).single().state)
        assertEquals("Scouting topics", HqRules.crew(m, emptyList()).single().line)
        assertEquals(CrewState.Working, HqRules.crew(m, listOf(task("lola", "running", "Build v2"))).single().state)
        assertEquals("Build v2", HqRules.crew(m, listOf(task("lola", "running", "Build v2"))).single().line)
        assertEquals(CrewState.NeedsYes, HqRules.crew(m, listOf(task("lola", "running"), task("lola", "needs_yes", "Publish?"))).single().state)
        assertEquals(CrewState.Queued, HqRules.crew(listOf(member("remy")), listOf(task("remy", "queued"))).single().state)
    }

    @Test fun nullDoingAndNoTasksMeansResting() {
        val c = HqRules.crew(listOf(member("lili", doing = null, job = "Checks the market")), listOf(task("someone_else", "running"))).single()
        assertEquals(CrewState.Resting, c.state)
        assertEquals("Checks the market", c.line)
    }

    @Test fun finishedTasksDoNotMakeAnyoneBusy() {
        assertEquals(CrewState.Resting, HqRules.crew(listOf(member("remy")), listOf(task("remy", "done"), task("remy", "stopped"))).single().state)
    }

    @Test fun cocoSpeaksPlainly() {
        val work = HqRules.crew(listOf(member("lola", "x"), member("remy", "y"), member("vivi")), emptyList())
        assertEquals("Lola and Remy are at work. I am coordinating.", HqRules.cocoLine(work, 0, 0, false, "Boss"))
        assertEquals("Boss, 2 things need your YES. The rest keeps moving.", HqRules.cocoLine(work, 0, 2, false, "Boss"))
        assertEquals("Big Boss, 1 thing needs your YES. The rest keeps moving.", HqRules.cocoLine(work, 0, 1, false, "Big Boss"))
        assertTrue(HqRules.cocoLine(work, 0, 0, true, "Boss").startsWith("I am paused"))
        val rest = HqRules.crew(listOf(member("vivi")), emptyList())
        assertEquals("7 tasks are queued. I will hand them out.", HqRules.cocoLine(rest, 7, 0, false, "Boss"))
        assertEquals("All quiet. Ready when you are, Boss.", HqRules.cocoLine(rest, 0, 0, false, ""))
        assertEquals("Lola is at work. I am keeping the queue moving.", HqRules.cocoLine(HqRules.crew(listOf(member("lola", "x")), emptyList()), 3, 0, false, "Boss"))
    }

    @Test fun greetingFollowsTheClock() {
        assertEquals("Good morning, Boss", greeting(8, "Boss"))
        assertEquals("Good afternoon, Big Boss", greeting(13, "Big Boss"))
        assertEquals("Good evening, Boss", greeting(19, ""))
        assertEquals("Still up, Boss?", greeting(2, "Boss"))
    }
}
