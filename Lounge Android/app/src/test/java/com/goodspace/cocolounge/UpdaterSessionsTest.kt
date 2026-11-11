package com.goodspace.cocolounge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The phone-update session leak ("Too many active sessions for UID", 2026-11-04): the rules that stop it. */
class UpdaterSessionsTest {
    private val now = 1_800_000_000_000L
    private fun s(id: Int, active: Boolean = false) = InstallSessions.S(id, active)

    @Test fun staleSessionsAreFreedButActiveOnesNever() {
        assertEquals(listOf(1, 3), InstallSessions.stale(listOf(s(1), s(2, true), s(3))))
        assertEquals(emptyList<Int>(), InstallSessions.stale(emptyList()))
    }

    @Test fun nothingNewWhileOneIsReallyInProgress() {
        assertFalse(InstallSessions.mayStart(listOf(s(2, true)), 21, 0, 0, now, false))
        assertFalse("not even when a person taps: the system already has one on screen", InstallSessions.mayStart(listOf(s(2, true)), 21, 0, 0, now, true))
    }

    @Test fun firstAttemptAtAnewBuildGoesThrough() {
        assertTrue(InstallSessions.mayStart(emptyList(), 21, 0, 0, now, false))
        assertTrue("a different build is a fresh attempt", InstallSessions.mayStart(emptyList(), 22, 21, now - 1000, now, false))
    }

    @Test fun theSameBuildIsNotRetriedEveryFifteenMinutes() {
        assertFalse(InstallSessions.mayStart(emptyList(), 21, 21, now - 15 * 60_000, now, false))
        assertTrue(InstallSessions.mayStart(emptyList(), 21, 21, now - 31 * 60_000, now, false))
    }

    @Test fun aPersonTappingIsAlwaysAllowed() {
        assertTrue(InstallSessions.mayStart(emptyList(), 21, 21, now - 1000, now, true))
    }

    @Test fun fortyEightHoursOfChecksNeverPileUpSessions() {
        // 15 minute checks for two days, every attempt leaks (never confirmed): at most one new session per 30 minutes and every stale one freed
        var open = mutableListOf<InstallSessions.S>(); var next = 1; var tried = 0L; var triedAt = 0L; var peak = 0
        var t = now
        repeat(192) {
            InstallSessions.stale(open).forEach { id -> open.removeAll { it.id == id } }
            if (InstallSessions.mayStart(open, 21, tried, triedAt, t, false)) { tried = 21; triedAt = t; open.add(s(next++, false)) }
            peak = maxOf(peak, open.size); t += 15 * 60_000
        }
        assertTrue("never more than the one session being made, was $peak", peak <= 1)
    }
}
