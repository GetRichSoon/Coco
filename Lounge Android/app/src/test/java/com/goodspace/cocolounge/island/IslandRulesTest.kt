package com.goodspace.cocolounge.island

import com.goodspace.cocolounge.island.model.AlertKind
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.model.CalendarRules
import com.goodspace.cocolounge.island.model.CallState
import com.goodspace.cocolounge.island.model.CallWords
import com.goodspace.cocolounge.island.model.ChargeLive
import com.goodspace.cocolounge.island.model.Clock
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.model.Face
import com.goodspace.cocolounge.island.model.FaceRules
import com.goodspace.cocolounge.island.model.IslandShapes
import com.goodspace.cocolounge.island.model.IslandUi
import com.goodspace.cocolounge.island.model.LiveKinds
import com.goodspace.cocolounge.island.model.MediaLive
import com.goodspace.cocolounge.island.model.NavLive
import com.goodspace.cocolounge.island.model.NavText
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.model.StopwatchLive
import com.goodspace.cocolounge.island.model.TimerLive
import com.goodspace.cocolounge.island.model.TorchLive
import com.goodspace.cocolounge.island.util.IconBlacklist
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Every island decision that does not need a phone: which face shows, sizes, maps text, meetings, call words, clocks. */
class IslandRulesTest {
    private fun media(title: String = "Song") = MediaLive("Music", title, "Artist", null, true, 0, 180_000, 0, null, null)
    private fun call(state: CallState) = NoteLive("call", "Phone", "Big Boss", "Mobile", null, null, emptyList(), isCall = true, callState = state)
    private fun note(id: String = "note:1") = NoteLive(id, "WhatsApp", "Big Boss", "Hi", null, null, emptyList(), isCall = false)

    // ---- faces --------------------------------------------------------------------------------------------

    @Test fun nothingLiveMeansHidden() {
        assertEquals(Face.Hidden, FaceRules.faceOf(emptyList(), IslandUi(), splitFits = true))
    }

    @Test fun callBeatsEverythingInTheSmallPill() {
        val f = FaceRules.faceOf(listOf(media(), call(CallState.Ongoing), TimerLive(60_000, 0, true, 60_000)), IslandUi(), splitFits = true)
        assertTrue(f is Face.Compact)
        assertEquals("call", (f as Face.Compact).primary.id)
        assertEquals("timer", f.secondary?.id)
    }

    @Test fun noSideBubbleWhenTheStatusBarHasNoRoom() {
        val f = FaceRules.faceOf(listOf(media(), TimerLive(60_000, 0, true, 60_000)), IslandUi(), splitFits = false) as Face.Compact
        assertNull(f.secondary)
    }

    @Test fun bannerShowsTheNoteThatArrived() {
        val f = FaceRules.faceOf(listOf(media(), note()), IslandUi(peekId = "note:1"), splitFits = true)
        assertTrue(f is Face.Peek)
        assertEquals("note:1", (f as Face.Peek).item.id)
        assertFalse(f.reply)
    }

    @Test fun replyBoxOnlyForTheBannerBeingAnswered() {
        val f = FaceRules.faceOf(listOf(note()), IslandUi(peekId = "note:1", replyId = "note:1"), splitFits = true) as Face.Peek
        assertTrue(f.reply)
    }

    @Test fun openCardFollowsTheSelectionAndListsTheOthers() {
        val f = FaceRules.faceOf(listOf(media(), StopwatchLive(0, true, 0)), IslandUi(expanded = true, selectedId = "media"), splitFits = true) as Face.Expanded
        assertEquals("media", f.item.id)
        assertEquals(listOf("stopwatch"), f.others.map { it.id })
    }

    @Test fun openCardFallsBackToTheTopActivity() {
        val f = FaceRules.faceOf(listOf(media(), call(CallState.Incoming)), IslandUi(expanded = true, selectedId = "gone"), splitFits = true) as Face.Expanded
        assertEquals("call", f.item.id)
    }

    @Test fun priorities() {
        // call > system moment > Coco YES > recorder > maps > meeting > stopwatch > timer > torch > live update > media > charge
        val order = listOf(
            call(CallState.Incoming),
            AlertLive(AlertKind.Silent, "Silent", "On"),
            NoteLive("coco:1", "Coco", "Needs your YES", "", null, null, emptyList(), false, live = true, progress = -3),
            NoteLive("live:rec", "Recorder", "Recording", "", null, null, emptyList(), false, live = true, since = 5, recording = true),
            NavLive("nav", "Maps", "250 m", "Turn left", "", null, null, null, "maps"),
            EventLive(1, "Review", 0, 1, "", null),
            StopwatchLive(0, true, 0),
            TimerLive(1, 1, true, 1),
            TorchLive(),
            NoteLive("live:dl", "Chrome", "Download", "", null, null, emptyList(), false, live = true, progress = 40),
            media(),
            ChargeLive(50, true),
        )
        assertEquals(order.map { it.id }, order.shuffled(java.util.Random(7)).sortedByDescending { it.priority }.map { it.id })
    }

    // ---- sizes -------------------------------------------------------------------------------------------

    @Test fun smallPillNeverWiderThanTheRoomBetweenClockAndBattery() {
        val keep = IslandShapes.maxCompact
        IslandShapes.maxCompact = 120.androidx_dp()
        try {
            listOf(media(), NavLive("nav", "Maps", "250 m", "x", "", null, null, null, "m"), EventLive(1, "t", 0, 1, "", null), StopwatchLive(0, true, 0)).forEach {
                val s = IslandShapes.of(Face.Compact(it, null))
                assertTrue("${it.id} is ${s.width}", s.width.value <= 120f)
            }
        } finally { IslandShapes.maxCompact = keep }
    }

    @Test fun everyFaceHasASizeAndTheOpenCardIsBiggerThanThePill() {
        listOf(media(), call(CallState.Ongoing), TimerLive(1, 1, true, 1), StopwatchLive(0, true, 0), NavLive("nav", "Maps", "1 km", "x", "", null, null, null, "m"),
            TorchLive(), EventLive(1, "t", 0, 1, "", null), ChargeLive(1, true), AlertLive(AlertKind.Ring, "Ring", "On")).forEach { l ->
            val small = IslandShapes.of(Face.Compact(l, null))
            val big = IslandShapes.of(Face.Expanded(l, emptyList(), false))
            assertTrue(l.id, big.height.value > small.height.value)
            assertTrue(l.id, IslandShapes.of(Face.Expanded(l, emptyList(), true)).height.value > big.height.value)
        }
    }

    // ---- maps --------------------------------------------------------------------------------------------

    @Test fun mapsDistanceFirstInTitle() {
        assertEquals(NavText.Nav("250 m", "Turn left onto MG Road"), NavText.parse("250 m · Turn left onto MG Road", ""))
        assertEquals(NavText.Nav("1.2 km", "Keep right"), NavText.parse("1.2 km", "Keep right"))
        assertEquals(NavText.Nav("0,5 km", "Exit"), NavText.parse("0,5 km - Exit", ""))
        assertEquals(NavText.Nav("300 ft", "Turn right"), NavText.parse("300 ft", "Turn right"))
    }

    @Test fun mapsDistanceInText() {
        assertEquals(NavText.Nav("400 m", "Turn right onto Ring Road"), NavText.parse("Turn right onto Ring Road", "400 m"))
    }

    @Test fun mapsInHindi() {
        assertEquals("250 मीटर", NavText.parse("250 मीटर · बाएं मुड़ें", "").distance)
    }

    @Test fun mapsWithoutDistanceKeepsTheInstruction() {
        assertEquals(NavText.Nav("", "Head north"), NavText.parse("Head north", "toward Station Road"))
        assertEquals(NavText.Nav("", "Rerouting"), NavText.parse("", "Rerouting"))
    }

    @Test fun aNumberInsideAStreetNameIsNotADistance() {
        assertEquals("", NavText.parse("Turn left onto 5th Main", "").distance)
        assertEquals("", NavText.parse("100 Feet Road", "").distance)
    }

    // ---- meetings ----------------------------------------------------------------------------------------

    private val now = 1_000_000_000_000L
    private fun ev(id: Long, inMin: Long, lenMin: Long = 30, allDay: Boolean = false, title: String = "Review") =
        CalendarRules.Ev(id, title, now + inMin * 60_000, now + (inMin + lenMin) * 60_000, "", "", allDay)

    @Test fun meetingShowsTenMinutesBeforeUntilFiveAfter() {
        assertNull(CalendarRules.pick(listOf(ev(1, 11)), now, emptySet()))
        assertEquals(1L, CalendarRules.pick(listOf(ev(1, 10)), now, emptySet())?.id)
        assertEquals(1L, CalendarRules.pick(listOf(ev(1, -5)), now, emptySet())?.id)
        assertNull(CalendarRules.pick(listOf(ev(1, -6)), now, emptySet()))
    }

    @Test fun meetingSkipsAllDayDismissedAndUntitled() {
        assertNull(CalendarRules.pick(listOf(ev(1, 3, allDay = true)), now, emptySet()))
        assertNull(CalendarRules.pick(listOf(ev(1, 3)), now, setOf(1L)))
        assertNull(CalendarRules.pick(listOf(ev(1, 3, title = " ")), now, emptySet()))
    }

    @Test fun earliestMeetingWins() {
        assertEquals(2L, CalendarRules.pick(listOf(ev(1, 8), ev(2, 2), ev(3, 9)), now, emptySet())?.id)
    }

    @Test fun finishedShortMeetingIsGone() {
        assertNull(CalendarRules.pick(listOf(ev(1, -4, lenMin = 3)), now, emptySet()))
    }

    @Test fun joinLinks() {
        assertEquals("https://meet.google.com/abc-defg-hij", CalendarRules.joinUrl("", "Join: https://meet.google.com/abc-defg-hij."))
        assertEquals("https://us02web.zoom.us/j/123456?pwd=x", CalendarRules.joinUrl("https://us02web.zoom.us/j/123456?pwd=x", ""))
        assertNotNull(CalendarRules.joinUrl("https://teams.microsoft.com/l/meetup-join/19%3ameeting_x"))
        assertNull(CalendarRules.joinUrl("Office, 2nd floor", "Bring the slides"))
        assertNull(CalendarRules.joinUrl("https://example.com/meet.google.com"))
    }

    @Test fun meetingLabels() {
        assertEquals("in 8 min", CalendarRules.label(now + 8 * 60_000, now))
        assertEquals("in 1 min", CalendarRules.label(now + 61_000, now))
        assertEquals("now", CalendarRules.label(now + 30_000, now))
        assertEquals("3 min ago", CalendarRules.label(now - 3 * 60_000 - 5_000, now))
    }

    // ---- calls ---------------------------------------------------------------------------------------------

    @Test fun callButtonsInEnglishAndHindi() {
        assertEquals(true, CallWords.classify("Answer"))
        assertEquals(true, CallWords.classify("ACCEPT"))
        assertEquals(true, CallWords.classify("जवाब दें"))
        assertEquals(false, CallWords.classify("Decline"))
        assertEquals(false, CallWords.classify("Hang up"))
        assertEquals(false, CallWords.classify("End call"))
        assertEquals(false, CallWords.classify("अस्वीकार करें"))
        assertNull(CallWords.classify("Speaker"))
        assertNull(CallWords.classify("Mute"))
        assertNull(CallWords.classify("Send message"))
    }

    // ---- clocks ------------------------------------------------------------------------------------------

    @Test fun clockFormats() {
        assertEquals("0:00", Clock.fmt(0))
        assertEquals("0:00", Clock.fmt(-500))
        assertEquals("4:05", Clock.fmt(245_400))
        assertEquals("1:02:03", Clock.fmt(3_723_000))
        assertEquals("4:05.4", Clock.fmtTenths(245_400))
    }

    @Test fun stopwatchCountsOnlyWhileRunning() {
        val s = StopwatchLive(startedAt = 10_000, running = true, bankedMs = 5_000)
        assertEquals(8_000, s.elapsed(13_000))
        assertEquals(5_000, s.copy(running = false).elapsed(99_000))
        assertEquals(5_000, s.elapsed(9_000))   // a clock that went backwards never gives negative time
    }

    @Test fun recordersGetTheRedDot() {
        assertTrue(LiveKinds.isRecording("com.android.systemui", "Screen recording", "screen_record"))
        assertTrue(LiveKinds.isRecording("com.coloros.soundrecorder", "Recording", null))
        assertFalse(LiveKinds.isRecording("com.strava", "Running", "workout"))
    }

    // ---- status bar icons --------------------------------------------------------------------------------

    @Test fun cleanStatusBarNeverHidesClockOrBattery() {
        val out = IconBlacklist.parse(IconBlacklist.merge("rotate,custom", IconBlacklist.slotsFor(IconBlacklist.CLEAN) + "clock" + "battery"))
        assertFalse("clock" in out)
        assertFalse("battery" in out)
        assertTrue("wifi" in out && "mobile" in out && "custom" in out)
    }

    @Test fun restoreRemovesOnlyOurSlots() {
        assertEquals("custom", IconBlacklist.restore("wifi,custom,alarm_clock"))
        assertEquals("", IconBlacklist.restore(null))
    }
}

private fun Int.androidx_dp() = androidx.compose.ui.unit.Dp(this.toFloat())
