package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Auto-heal rules (Nono, 2026-10-26): same cases as Lounge Desktop/heal.test.js. */
class HealTest {
    private val now = 1_800_000_000_000L
    private fun ago(min: Long) = now - min * 60_000

    @Test fun classes() {
        assertEquals("ok", Heal.classify("Opened chrome"))
        assertEquals("not_understood", Heal.classify("Not understood: \"hi\""))
        assertEquals("app_missing", Heal.classify("whatsapp is not installed"))
        assertEquals("app_missing", Heal.classify("This app is not on the allowed list"))
        assertEquals("refused", Heal.classify("A phone can't do \"lock\" from Coco; use the phone's own buttons"))
        assertEquals("transient", Heal.classify("failed: Unable to resolve host www.youtube.com"))
        assertEquals("failed_other", Heal.classify("failed: boom"))
        assertEquals("failed_other", Heal.classify(""))
    }

    @Test fun oneRetryOnlyWhenSafe() {
        assertTrue(Heal.canRetry("status", JSONObject(), "transient"))
        assertFalse(Heal.canRetry("status", JSONObject().put("_retried", 1), "transient"))
        assertFalse(Heal.canRetry("volume", JSONObject(), "transient"))
        assertFalse(Heal.canRetry("status", JSONObject(), "app_missing"))
    }

    @Test fun ageLimits() { assertEquals(600L, Heal.ageLimitSec("ring")); assertEquals(120L, Heal.ageLimitSec("play_youtube")); assertEquals(120L, Heal.ageLimitSec("say")); assertEquals(7200L, Heal.ageLimitSec("status")) }

    /** Boss, 2026-10-26: heal must never replay a spoken wish. */
    @Test fun neverReplaysVoice() {
        for (a in listOf("say", "play_youtube", "media", "volume")) {
            assertFalse(a, Heal.canRetry(a, JSONObject(), "transient")); assertFalse(a in Heal.retrySafe)
            assertEquals("failed", Heal.sweepVerdict("running", a, JSONObject(), "", ago(1), now, null)?.status ?: "failed")
            assertEquals("failed", Heal.sweepVerdict("running", a, JSONObject(), "", ago(5), now, null)!!.status)
        }
    }

    @Test fun sweep() {
        fun v(status: String, action: String, ageMin: Long, result: String = "", args: JSONObject = JSONObject()) = Heal.sweepVerdict(status, action, args, result, ago(ageMin), now, "2026-10-23T09:57:23.5+00:00")
        assertNull(v("queued", "status", 5))
        assertTrue(v("queued", "lock", 40)!!.result!!.startsWith("stale: target device offline (last seen 2026-10-23 09:57 UTC)"))
        assertTrue(v("failed", "x", 1500, "Too old")!!.result!!.startsWith("stale: Too old"))
        assertNull(v("failed", "x", 1500, "stale: Too old"))
        assertNull(v("failed", "x", 60, "boom"))
        assertEquals("queued", v("running", "status", 5)!!.status)
        assertTrue(v("running", "status", 5)!!.args!!.has("_retried"))
        assertEquals("failed", v("running", "ring", 5, args = JSONObject().put("_retried", 1))!!.status)
        assertEquals("failed", v("running", "volume", 5)!!.status)
        assertNotNull(Heal.runKey(JSONObject().put("id", "a").put("args", JSONObject().put("_retried", 1))).takeIf { it == "ar" })
    }
}
