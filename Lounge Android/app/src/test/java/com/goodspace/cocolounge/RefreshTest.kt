package com.goodspace.cocolounge

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * How a change on another device reaches this phone. A pulse row's only payload is the name of the
 * table that changed, so most changes do not need the whole company read back - reload() is
 * twenty-two queries, and before this every pulse of any topic took all of them, on screen or not.
 * Measured 2026-10-31: `devices` alone was 56% of pulses and `houses` another 26%.
 *
 * The saving is not the risky part. controls, policies, events and pipelines have no slice of their
 * own, so their changes reach this phone only by falling through to the full read. Route by topic
 * without that net and a company stop would stop arriving. These checks exist to keep the net.
 */
class RefreshTest {
    private val fresh = 0L                      // a full read just happened
    private val stale = Lounge.FULL_EVERY + 1   // the floor is up

    // ---------------------------------------------------------------- a hot topic costs one read
    @Test fun aKnownTopicDoesNotReadTheWholeCompany() {
        assertFalse(Lounge.needsFullRead(listOf("devices"), foreground = true, sinceFull = fresh))
        assertFalse(Lounge.needsFullRead(listOf("houses"), foreground = true, sinceFull = fresh))
        assertFalse(Lounge.needsFullRead(listOf("devices", "houses"), foreground = true, sinceFull = fresh))
    }

    @Test fun everySliceTopicIsRoutable() {
        // if a topic is in SLICES, slice() must have a branch for it - these are the measured ones
        for (t in listOf("devices", "houses", "tasks", "approvals", "decisions", "rules", "activity", "commands"))
            assertTrue("$t should be a slice", t in Lounge.SLICES)
    }

    // ---------------------------------------------------------------- THE SAFETY NET
    @Test fun anUnknownTopicAlwaysTakesTheFullRead() {
        for (t in listOf("controls", "policies", "events", "pipelines", "chat", "integrations", "members"))
            assertTrue("$t has no slice, so it must force the full read", Lounge.needsFullRead(listOf(t), foreground = true, sinceFull = fresh))
    }

    /** The one that must never regress: a company stop made on a PC has to reach a phone that is in
     *  someone's pocket, so being in the background is no excuse for skipping the full read. */
    @Test fun anUnknownTopicTakesTheFullReadEvenInTheBackground() {
        assertTrue(Lounge.needsFullRead(listOf("controls"), foreground = false, sinceFull = fresh))
        assertTrue(Lounge.needsFullRead(listOf("policies"), foreground = false, sinceFull = fresh))
    }

    @Test fun oneUnknownTopicInTheBurstIsEnough() {
        assertTrue(Lounge.needsFullRead(listOf("devices", "controls"), foreground = true, sinceFull = fresh))
        assertTrue(Lounge.needsFullRead(listOf("devices", "controls"), foreground = false, sinceFull = fresh))
    }

    @Test fun aPulseWeCannotReadIsSomethingChangedNotNothingChanged() {
        // Cloud.listen reports "*" when it cannot find a topic in the payload
        assertTrue(Lounge.needsFullRead(listOf("*"), foreground = true, sinceFull = fresh))
        assertTrue(Lounge.needsFullRead(listOf("*"), foreground = false, sinceFull = fresh))
        assertTrue("an empty burst is not a reason to do nothing", Lounge.needsFullRead(emptyList(), foreground = true, sinceFull = fresh))
    }

    // ---------------------------------------------------------------- the floor, and its one limit
    @Test fun theFloorStillCatchesTheUnslicedTablesWhileSomeoneIsLooking() {
        assertTrue(Lounge.needsFullRead(listOf("devices"), foreground = true, sinceFull = stale))
    }

    /** The floor bounds how stale the SCREEN is, so with the app behind something it does not apply:
     *  onResume() does a full read the moment it comes back. This is the whole egress fix. */
    @Test fun theFloorDoesNotTickWhileNobodyIsLooking() {
        assertFalse(Lounge.needsFullRead(listOf("devices"), foreground = false, sinceFull = stale))
        assertFalse(Lounge.needsFullRead(listOf("activity"), foreground = false, sinceFull = stale * 100))
    }

    /** Notifications must survive the fix: approvals, tasks and activity each keep a slice, so a
     *  backgrounded phone still reads them on their own pulse and Alerts still runs. */
    @Test fun theTablesNotificationsAreBuiltFromAreAllSlices() {
        for (t in listOf("approvals", "tasks", "activity")) {
            assertTrue("$t must be a slice or notifications would wait for the 15 min worker", t in Lounge.SLICES)
            assertFalse(Lounge.needsFullRead(listOf(t), foreground = false, sinceFull = fresh))
        }
    }

    @Test fun theFloorMatchesTheWebLounge() {
        assertTrue("the net is one minute, same as the web Lounge", Lounge.FULL_EVERY == 60_000L)
    }
}
