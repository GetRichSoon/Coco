package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** YES-3 follow-up: commands never vanish while their device rests. The same cases as Lounge/delivery.test.js and Lounge Desktop/heal.test.js. */
class DeliveryTest {
    private val now = Instant.parse("2026-10-26T12:00:00Z").toEpochMilli()
    private fun ago(min: Long) = now - min * 60_000
    private fun iso(ms: Long) = Instant.ofEpochMilli(ms).toString()
    /** A phone or PC that last beat `beatMin` minutes ago while resting (quiet), or on screen. */
    private fun dev(beatMin: Long, quiet: Boolean) = JSONObject().put("last_seen", iso(ago(beatMin))).put("info", JSONObject().put("presence", Heal.presenceInfo(quiet, ago(beatMin))))

    @Test fun deviceStatusTellsRestingFromOffline() {
        assertEquals("online", Heal.presence(dev(1, false), now).state)
        assertEquals("offline", Heal.presence(dev(3, false), now).state)          // on screen and silent for 3 min: gone, as before
        assertEquals("resting", Heal.presence(dev(25, true), now).state)          // quiet, 25 min: still keeping its promise
        assertEquals("offline", Heal.presence(dev(60, true), now).state)          // promised 11:35, missed it
        assertEquals("online", Heal.presence(JSONObject().put("last_seen", iso(ago(1))), now).state)   // an older app without presence
        assertEquals("offline", Heal.presence(null, now).state)
    }

    @Test fun aRestingDevicesCommandWaitsAndOnlyAnOfflineOneExpiresWithItsReason() {
        fun sweep(ageMin: Long, d: JSONObject) = Heal.sweepVerdict("queued", "lock", JSONObject(), "", ago(ageMin), now, d.optString("last_seen"), d.optJSONObject("info")?.optJSONObject("presence"))
        assertNull("40 min queued for a RESTING PC: it waits", sweep(40, dev(25, true)))
        assertNull("offline 25 min (missed its promise by less than 30): it waits", sweep(80, dev(60, true)))
        assertTrue(sweep(120, dev(90, true))!!.result!!.startsWith("stale: target device offline (last seen 2026-10-26 10:30 UTC)"))
    }

    @Test fun theRunnerRunsWhatWaitedForItsRestAndExplainsWhatItWillNotRun() {
        val longAgo = now - 3_600_000L
        assertTrue("a lock that waited 25 min because the phone rested still runs", Heal.runVerdict("lock", ago(25), now, longAgo).run)
        val song = Heal.runVerdict("play_youtube", ago(25), now, longAgo)
        assertFalse(song.run); assertTrue(song.result!!.startsWith("expired: arrived 25 min after it was sent; spoken requests are never run late"))
        val asleep = Heal.runVerdict("lock", ago(25), now, now - 60_000)
        assertFalse(asleep.run); assertTrue(asleep.result!!.startsWith("expired: this device was off or asleep when it was sent (25 min ago)"))
        assertTrue("an update never expires", Heal.runVerdict("update", ago(9000), now, now).run)
        assertTrue(Heal.runVerdict("say", ago(1), now, now).run)
    }

    @Test fun theSenderSeesEveryState() {
        fun st(status: String, result: String = "", target: JSONObject? = null) = Heal.commandState(JSONObject().put("status", status).put("result", result), target, now)
        assertEquals("waiting", st("queued", target = dev(5, true)).state); assertTrue(st("queued", target = dev(5, true)).by!! > now)
        assertEquals("queued", st("queued", target = dev(0, false)).state)
        assertEquals("acked", st("running").state)
        assertEquals("done", st("done").state)
        assertEquals("failed", st("failed", "No app called x").state)
        assertEquals("expired", st("failed", "stale: target device offline").state)
        assertEquals("expired", st("failed", "expired: arrived 25 min after it was sent").state)
        assertEquals("cancelled", st("failed", "cancelled: by Boss before it ran").state)
    }

    @Test fun aRetriedSendIsOneCommand() {
        assertTrue(Heal.isDuplicate(Cloud.CloudError("duplicate key value violates unique constraint \"commands_pkey\"", 409)))
        assertFalse(Heal.isDuplicate(Cloud.CloudError("new row violates row-level security policy", 403)))
        assertTrue(Regex("^[0-9a-f-]{36}$").matches(Heal.newCommandId())); assertTrue(Heal.newCommandId() != Heal.newCommandId())
    }

    @Test fun mailIsActedOnOncePerCommand() {
        assertTrue("first answer, a command a minute old: read", Quiet.mailIsNew(now - 60_000, null, now))
        assertFalse("first answer, a command from hours ago: the start-up read covered it", Quiet.mailIsNew(now - 3 * 3_600_000L, null, now))
        assertTrue(Quiet.mailIsNew(now, now - 1, now)); assertFalse(Quiet.mailIsNew(now, now, now)); assertFalse(Quiet.mailIsNew(null, null, now))
    }

    /** Budget guard: a day behind something, the database asleep, two commands: the listener reads once per slot and once per command. */
    @Test fun aRestingPhoneReadsAtMostOncePerSlotPlusOncePerCommand() {
        val start = 20 * Quiet.SLOT_MS + 5_000; var lastSlot = Quiet.slotOf(start); var reads = 0; var mailSeen: Long? = null
        val commandsAt = setOf(start + 1111 * 30_000L, start + 2222 * 30_000L)
        var t = start
        while (t < start + 24 * 3_600_000L) {
            val mailAt = commandsAt.filter { it <= t }.maxOrNull()
            val mail = Quiet.mailIsNew(mailAt, mailSeen, t); mailAt?.let { mailSeen = it }
            if (Quiet.mayRead(false, false, lastSlot, t, mail)) { reads++; if (!mail) lastSlot = Quiet.slotOf(t) }
            t += 30_000
        }
        assertEquals("47 new slots in the 24 h after the start-up read (48 a day) and 2 commands", 49, reads)
    }

    @Test fun aSystemSleepIsAGap() {
        val before = Quiet.aliveSince
        Quiet.noteAlive(before + 30_000); assertEquals(before, Quiet.aliveSince)
        Quiet.noteAlive(before + 30_000 + 40 * 60_000L); assertEquals(before + 30_000 + 40 * 60_000L, Quiet.aliveSince)
    }
}
