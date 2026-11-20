package com.goodspace.cocolounge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Neon Free plan (YES-3): the same rule as Lounge/quiet.test.js, for the phone. */
class QuietTest {
    private val slot = Quiet.SLOT_MS
    private val t = 10 * slot + 1_000

    @Test fun onScreenAlwaysReads() {
        assertTrue(Quiet.mayRead(foreground = true, warm = false, lastSlot = Quiet.slotOf(t), now = t))
    }

    @Test fun behindSomethingReadsOnlyWhileAwakeOrInANewSlot() {
        assertFalse("same slot, database asleep: no read", Quiet.mayRead(false, false, Quiet.slotOf(t), t + 60_000))
        assertTrue("awake anyway: reading costs nothing", Quiet.mayRead(false, true, Quiet.slotOf(t), t + 60_000))
        assertTrue("a new shared slot: read once", Quiet.mayRead(false, false, Quiet.slotOf(t), 11 * slot))
    }

    @Test fun devicesShareSlotBoundaries() {
        assertEquals(Quiet.slotOf(10 * slot + 1), Quiet.slotOf(11 * slot - 1))
        assertNotEquals(Quiet.slotOf(11 * slot - 1), Quiet.slotOf(11 * slot))
    }

    @Test fun theWorkManagerCheckStaysOutOfTheWay() {
        val now = 100 * slot
        assertFalse("this process's listener read 10 min ago", Quiet.watchMayRead(false, now - 10 * 60_000, 0, now))
        assertTrue("no listener, never read: read", Quiet.watchMayRead(false, 0, 0, now))
        assertFalse("no listener, read 20 min ago: wait", Quiet.watchMayRead(false, 0, now - 20 * 60_000, now))
        assertTrue("awake anyway: read", Quiet.watchMayRead(true, now - 60_000, now - 60_000, now))
    }

    /** Cloud.awakeNow's decisions without the network: how many pings a day of background checks a minute apart makes. */
    private fun pingsInADay(answer: (Int) -> Int?, shaped: Boolean = true): Int {
        Quiet.awakeFails = 0; Quiet.awakeAskedAt = 0
        var offUntil = 0L; var pings = 0; val start = 20 * slot
        var t = start
        while (t < start + 24 * 3_600_000L) {
            if (Quiet.awakeDue(t, offUntil)) {
                Quiet.awakeAskedAt = t; val code = answer(pings++)
                when (if (code == null) null else Quiet.awakeSupported(code, shaped)) {
                    true -> Quiet.awakeFails = 0
                    false -> { Quiet.awakeFails = 0; offUntil = t + Quiet.AWAKE_OFF_MS }
                    null -> Quiet.awakeFails++
                }
            }
            t += Quiet.AWAKE_EVERY_MS
        }
        Quiet.awakeFails = 0; Quiet.awakeAskedAt = 0
        return pings
    }

    @Test fun oldNovaWithoutApiAwakeAtMostOnePingPerSixHours() {
        assertEquals("production c2d52a0 answers 401", 4, pingsInADay({ 401 }))
        assertEquals("a 404", 4, pingsInADay({ 404 }))
        assertEquals("a 200 of another shape", 4, pingsInADay({ 200 }, shaped = false))
        assertEquals("a Nova with the wake board: one a minute", 1440, pingsInADay({ 200 }))
    }

    @Test fun failedPingsBackOffToFiveMinutes() {
        // 10 failures a minute apart (minutes 0 to 9), then one every 5 minutes from minute 14: 286 more
        assertEquals(10 + 286, pingsInADay({ null }))
        assertEquals("a 5xx is a failure, not an older Nova", 10 + 286, pingsInADay({ 503 }))
        assertEquals("an answer resets the count", 1440, pingsInADay({ n -> if (n % 5 == 4) 503 else 200 }))
        assertTrue((0..100).all { val j = Quiet.jittered(Quiet.AWAKE_EVERY_MS, it / 100.0); j in 54_000..66_000 })
    }

    @Test fun theReadWindowCloses() {
        Quiet.readUntil = 1_000 + Quiet.WINDOW_MS
        assertTrue(Quiet.mayReadNow(1_000)); assertFalse(Quiet.mayReadNow(1_000 + Quiet.WINDOW_MS))
        Quiet.readUntil = Long.MAX_VALUE
    }
}
