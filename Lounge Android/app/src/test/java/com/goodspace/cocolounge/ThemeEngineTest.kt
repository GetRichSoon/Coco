package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/** The obvious cases, written by hand. The reference vectors (theme-vectors.json) are run by ThemeVectorsTest. */
class ThemeEngineTest {
    private val e = ThemeFiles.engine
    private fun at(iso: String) = ThemeEngine.parseDate(iso)!!
    private val noon = at("2026-11-11T12:00:00Z")

    private fun rotating(freq: String, order: String = "sequential", theme: String = "signature", extra: JSONObject = JSONObject()): ThemePrefs {
        val patch = JSONObject().put("enabled", true).put("frequency", freq).put("order", order).put("tz", "UTC").put("seed", "seed1")
        extra.keys().forEach { patch.put(it, extra.get(it)) }
        return e.setRotation(e.applyManual(e.defaultPrefs(), theme, noon - 20 * ThemeEngine.DAY, "dev").copy(updatedAt = null), patch, noon - 20 * ThemeEngine.DAY, "dev")
    }

    @Test fun fnvMatchesTheKnownValues() {
        assertEquals(2166136261L, ThemeEngine.fnv1a32("")); assertEquals(3826002220L, ThemeEngine.fnv1a32("a")); assertEquals(3543363513L, ThemeEngine.fnv1a32("coco"))
    }

    @Test fun datesParseLikeJs() {
        assertEquals(1794398400000L, noon)
        assertEquals(noon, ThemeEngine.parseDate("2026-11-11T12:00:00.000Z")); assertEquals(noon, ThemeEngine.parseDate("2026-11-11T17:30:00+05:30"))
        assertEquals(noon, ThemeEngine.parseDate("2026-11-11 12:00:00+00")); assertEquals(noon - 12 * ThemeEngine.HOUR, ThemeEngine.parseDate("2026-11-11"))
        assertEquals(noon + 123, ThemeEngine.parseDate("2026-11-11T12:00:00.123456Z"))
        assertNull(ThemeEngine.parseDate("nope")); assertNull(ThemeEngine.parseDate("2026-02-31T00:00:00Z")); assertNull(ThemeEngine.parseDate("2026-11-11T25:00:00Z"))
        assertEquals("2026-11-11T12:00:00.000Z", ThemeEngine.iso(noon)); assertNull(ThemeEngine.iso(null))
    }

    @Test fun sequentialFollowsTheOrderThenWraps() {
        val ids = e.ids
        ids.forEachIndexed { i, id -> assertEquals(ids[(i + 1) % ids.size], e.pickNext(rotating("daily", theme = id))) }
        assertEquals("signature", e.pickNext(rotating("daily", theme = "orchid")))
    }

    @Test fun randomNeverPicksTheThemeInUseNorTheOneBefore() {
        for (theme in e.ids) for (prev in listOf<String?>(null) + e.ids.filter { it != theme }) {
            val p = rotating("daily", "random", theme).copy(previousThemeId = prev)
            for (seq in 0L..60L) {
                val viaSeed = e.pickNext(p.copy(seq = seq))
                assertNotEquals(theme, viaSeed); if (prev != null) assertNotEquals(prev, viaSeed)
                for (r in listOf(0.0, 0.2, 0.5, 0.999)) { val x = e.pickNext(p, r); assertNotEquals(theme, x); if (prev != null) assertNotEquals(prev, x) }
            }
        }
    }

    @Test fun randomForAScheduleIsTheSameOnEveryDevice() {
        val p = rotating("daily", "random")
        assertEquals(e.pickNext(p), e.pickNext(p.copy()))
        assertTrue((0L..30L).map { e.pickNext(p.copy(seq = it)) }.toSet().size > 1)   // and it does move with the sequence number
    }

    @Test fun intervalsAndWallClockSchedulesAreDueWhenTheirTimeComes() {
        val five = rotating("5h").copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = rotating("5h").rotation.copy(anchorAt = ThemeEngine.iso(noon)))
        assertEquals(noon + 5 * ThemeEngine.HOUR, e.nextDueAt(five, noon))
        assertFalse(e.isDue(five, noon + 5 * ThemeEngine.HOUR - 1)); assertTrue(e.isDue(five, noon + 5 * ThemeEngine.HOUR))
        val daily = rotating("daily", extra = JSONObject().put("time", "09:00")).let { it.copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = it.rotation.copy(anchorAt = ThemeEngine.iso(noon))) }
        assertEquals(at("2026-11-12T09:00:00Z"), e.nextDueAt(daily, noon))
        val weekly = rotating("weekly", extra = JSONObject().put("time", "09:00").put("weekday", 5)).let { it.copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = it.rotation.copy(anchorAt = ThemeEngine.iso(noon))) }
        assertEquals(at("2026-11-13T09:00:00Z"), e.nextDueAt(weekly, noon))   // 2026-11-13 is a Friday
        val monthly = rotating("monthly", extra = JSONObject().put("time", "09:00").put("dayOfMonth", 31)).let { it.copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = it.rotation.copy(anchorAt = ThemeEngine.iso(noon))) }
        assertEquals(at("2026-11-30T09:00:00Z"), e.nextDueAt(monthly, noon))   // November has 30 days: day 31 means its last day
    }

    @Test fun savingANewScheduleNeverFiresItImmediately() {
        val off = e.defaultPrefs().copy(lastSwitchedAt = ThemeEngine.iso(noon - 30 * ThemeEngine.DAY))   // last switched a month ago
        val on = e.setRotation(off, JSONObject().put("enabled", true).put("frequency", "5h"), noon, "dev")
        assertFalse(e.isDue(on, noon)); assertFalse(e.evaluate(on, noon, launch = false, rand = 0.1, by = "dev").changed)
        assertEquals(noon + 5 * ThemeEngine.HOUR, e.nextDueAt(on, noon))
        assertTrue(on.rotation.seed.matches(Regex("[0-9a-f]{8}")))
        assertEquals("settings", on.reason); assertEquals(ThemeEngine.iso(noon), on.rotation.anchorAt)
    }

    @Test fun everyLaunchSwitchesOnlyOnALaunch() {
        val p = rotating("launch")
        assertSame(p, e.evaluate(p, noon, launch = false, rand = 0.3, by = "dev").prefs)
        val r = e.evaluate(p, noon, launch = true, rand = 0.3, by = "dev")
        assertTrue(r.changed); assertEquals("launch", r.reason); assertEquals("cobalt", r.prefs.themeId); assertEquals("signature", r.prefs.previousThemeId)
        assertEquals(1L, r.prefs.seq); assertEquals(ThemeEngine.iso(noon), r.prefs.rotation.anchorAt)
    }

    @Test fun aScheduleThatFellDueWhileClosedTakesExactlyOneStep() {
        val p = rotating("daily", extra = JSONObject().put("time", "09:00"))   // anchored 20 days ago: twenty boundaries were missed
        assertTrue(e.isDue(p, noon))
        val r = e.evaluate(p, noon, launch = true, rand = 0.9, by = "dev")
        assertEquals("schedule", r.reason); assertEquals("cobalt", r.prefs.themeId); assertEquals(1L, r.prefs.seq)
        assertFalse(e.isDue(r.prefs, noon)); assertFalse(e.evaluate(r.prefs, noon + 1000, launch = false, rand = 0.9, by = "dev").changed)
    }

    @Test fun aFocusedExistingSessionIsNotALaunch() {
        // not due: a resume (launch = false) changes nothing, even though a launch would have
        val p = rotating("daily", extra = JSONObject().put("time", "09:00")).let { it.copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = it.rotation.copy(anchorAt = ThemeEngine.iso(noon))) }
        assertFalse(e.evaluate(p, noon + ThemeEngine.HOUR, launch = false, rand = 0.5, by = "dev").changed)
        assertFalse(e.evaluate(p, noon + ThemeEngine.HOUR, launch = true, rand = 0.5, by = "dev").changed)   // a launch does not force a daily schedule either
    }

    @Test fun aLockedThemeAManualOnlyScheduleAndAnOffRotationNeverChange() {
        val due = rotating("5h")
        assertTrue(e.evaluate(due, noon, true, 0.1, "dev").changed)
        assertFalse(e.evaluate(e.setLocked(due, true, noon, "dev"), noon + 30 * ThemeEngine.DAY, true, 0.1, "dev").changed)
        assertFalse(e.evaluate(rotating("manual"), noon, true, 0.1, "dev").changed)
        assertFalse(e.evaluate(due.copy(rotation = due.rotation.copy(enabled = false)), noon, true, 0.1, "dev").changed)
        assertNull(e.nextDueAt(e.setLocked(due, true, noon, "dev"), noon)); assertEquals("none", e.preview(e.setLocked(due, true, noon, "dev")).kind)
    }

    @Test fun pickingByHandAppliesNowAndRestartsTheClock() {
        val p = rotating("5h")
        val n = e.applyManual(p, "violet", noon, "phone")
        assertEquals("violet", n.themeId); assertEquals("signature", n.previousThemeId); assertEquals("manual", n.reason); assertEquals("phone", n.updatedBy)
        assertEquals(ThemeEngine.iso(noon), n.rotation.anchorAt); assertEquals(noon + 5 * ThemeEngine.HOUR, e.nextDueAt(n, noon))
        assertSame(p, e.applyManual(p, "nope", noon, "phone"))
    }

    @Test fun nextNowStepsOnceAndUnlockingRestartsTheClock() {
        assertEquals("cobalt", e.advance(rotating("daily"), noon, 0.4, "dev").themeId)
        val locked = e.setLocked(rotating("daily"), true, noon, "dev")
        assertEquals("locked", locked.reason)
        val un = e.setLocked(locked, false, noon + ThemeEngine.HOUR, "dev")
        assertEquals("unlocked", un.reason); assertEquals(ThemeEngine.iso(noon + ThemeEngine.HOUR), un.rotation.anchorAt)
    }

    @Test fun resetIsTheDefaultDocument() {
        val r = e.reset(noon, "dev")
        assertEquals("signature", r.themeId); assertEquals("system", r.appearance); assertFalse(r.locked); assertFalse(r.rotation.enabled); assertEquals("reset", r.reason)
        assertEquals(ThemeEngine.iso(noon), r.updatedAt); assertNull(e.reset(noon, "").updatedBy)
    }

    @Test fun theLaterEditWins() {
        val a = e.defaultPrefs().copy(themeId = "cobalt", updatedAt = ThemeEngine.iso(noon)); val b = e.defaultPrefs().copy(themeId = "violet", updatedAt = ThemeEngine.iso(noon + 1))
        assertSame(b, e.newer(a, b)); assertSame(b, e.newer(b, a)); assertSame(a, e.newer(a, null))
        assertEquals("cobalt", e.newer(a, a.copy(themeId = "orchid"))!!.themeId)   // a tie keeps the first
    }

    @Test fun anyDocumentComesOutValidAndStaysTheSame() {
        val weird = e.normalize(JSONObject("""{"themeId":"nope","appearance":"purple","seq":-5,"locked":"yes","rotation":{"enabled":1,"frequency":"hourly","order":"shuffle","time":"25:99","weekday":9,"dayOfMonth":0}}"""))
        assertEquals("signature", weird.themeId); assertEquals("system", weird.appearance); assertTrue(weird.locked); assertEquals(6, weird.rotation.weekday); assertEquals(1, weird.rotation.dayOfMonth)
        assertEquals(weird, e.normalize(weird.toJson()))
        val real = e.advance(rotating("5h", "random"), noon, 0.7, "dev")
        assertEquals(real, e.normalize(real.toJson())); assertEquals(real, e.normalize(JSONObject(real.toJson().toString())))
        assertEquals(e.defaultPrefs(), e.normalize(null)); assertEquals(e.defaultPrefs(), e.normalize("garbage"))
    }

    @Test fun theDocumentHasExactlyTheAgreedFields() {
        val j = e.defaultPrefs().toJson()
        assertEquals(setOf("v", "appearance", "themeId", "previousThemeId", "lastSwitchedAt", "seq", "locked", "reason", "rotation", "updatedAt", "updatedBy"), j.keys().asSequence().toSet())
        assertEquals(setOf("enabled", "frequency", "order", "time", "weekday", "dayOfMonth", "tz", "seed", "anchorAt"), j.getJSONObject("rotation").keys().asSequence().toSet())
        assertEquals(1, j.getInt("v")); assertTrue(j.isNull("previousThemeId") && j.isNull("updatedAt"))
    }

    @Test fun theWallClockFollowsTheTimeZoneAndDaylightSaving() {
        // daily 09:00 in New York is 14:00Z in winter (EST) and 13:00Z in summer (EDT); noon UTC is 07:00 / 08:00 there, so today's 09:00 is still ahead
        val p = rotating("daily", extra = JSONObject().put("time", "09:00").put("tz", "America/New_York"))
        assertEquals(at("2026-11-11T14:00:00Z"), e.nextDueAt(p.copy(lastSwitchedAt = ThemeEngine.iso(noon), rotation = p.rotation.copy(anchorAt = ThemeEngine.iso(noon))), noon))
        val summer = at("2026-07-01T12:00:00Z")
        assertEquals(at("2026-07-01T13:00:00Z"), e.nextDueAt(p.copy(lastSwitchedAt = ThemeEngine.iso(summer), rotation = p.rotation.copy(anchorAt = ThemeEngine.iso(summer))), summer))
    }
}
