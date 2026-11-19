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

    @Test fun theReadWindowCloses() {
        Quiet.readUntil = 1_000 + Quiet.WINDOW_MS
        assertTrue(Quiet.mayReadNow(1_000)); assertFalse(Quiet.mayReadNow(1_000 + Quiet.WINDOW_MS))
        Quiet.readUntil = Long.MAX_VALUE
    }
}
