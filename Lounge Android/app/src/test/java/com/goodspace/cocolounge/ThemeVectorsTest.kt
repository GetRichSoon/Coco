package com.goodspace.cocolounge

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Every case of Lounge/contract/theme-vectors.json, which is generated from the JS engine (theme-engine.js) by contract/build-vectors.mjs,
 * run against the Kotlin port. A document is compared field by field; numbers as numbers.
 */
class ThemeVectorsTest {
    private val e = ThemeFiles.engine

    /** Structural JSON equality: objects by key, arrays by position, numbers by value, JSON null = null. */
    private fun same(path: String, want: Any?, got: Any?) {
        fun nul(x: Any?) = x == null || x === JSONObject.NULL
        when {
            nul(want) || nul(got) -> assertTrue("$path: want $want, got $got", nul(want) && nul(got))
            want is JSONObject && got is JSONObject -> {
                assertEquals("$path keys", want.keys().asSequence().toSet(), got.keys().asSequence().toSet())
                want.keys().forEach { same("$path.$it", want.get(it), got.get(it)) }
            }
            want is JSONArray && got is JSONArray -> {
                assertEquals("$path length", want.length(), got.length()); for (i in 0 until want.length()) same("$path[$i]", want.get(i), got.get(i))
            }
            want is Number && got is Number -> assertEquals("$path", want.toDouble(), got.toDouble(), 0.0)
            else -> assertEquals(path, want, got)
        }
    }

    /** The value, or null for a missing key AND for JSON null (the member opt() would hand back JSONObject.NULL). */
    private fun JSONObject.value(name: String): Any? = if (has(name) && !isNull(name)) get(name) else null
    private fun JSONObject.by() = value("by") as String?
    private fun JSONObject.doc() = e.normalize(getJSONObject("prefs"))

    private fun run(v: JSONObject) {
        val name = v.getString("name")
        when (val op = v.getString("op")) {
            "fnv1a32" -> assertEquals(name, v.getLong("expect"), ThemeEngine.fnv1a32(v.getString("input")))
            "normalize" -> same(name, v.getJSONObject("expect"), e.normalize(v.get("input")).toJson())
            "pickNext" -> assertEquals(name, v.getString("expect"), e.pickNext(v.doc(), (v.value("rand") as Number?)?.toDouble()))
            "nextDueAt" -> {
                val got = e.nextDueAt(v.doc(), v.getLong("now"))
                if (v.isNull("expect")) assertNull(name, got) else assertEquals(name, v.getLong("expect"), got)
            }
            "evaluate" -> {
                val r = e.evaluate(v.doc(), v.getLong("now"), v.getBoolean("launch"), (v.value("rand") as Number?)?.toDouble(), v.by())
                val want = v.getJSONObject("expect")
                same("$name prefs", want.getJSONObject("prefs"), r.prefs.toJson())
                assertEquals("$name changed", want.getBoolean("changed"), r.changed)
                assertEquals("$name reason", want.value("reason"), r.reason)
            }
            "applyManual" -> same(name, v.getJSONObject("expect"), e.applyManual(v.doc(), v.getJSONObject("args").getString("themeId"), v.getLong("now"), v.by()).toJson())
            "advance" -> same(name, v.getJSONObject("expect"), e.advance(v.doc(), v.getLong("now"), (v.getJSONObject("args").value("rand") as Number?)?.toDouble(), v.by()).toJson())
            "setLocked" -> same(name, v.getJSONObject("expect"), e.setLocked(v.doc(), v.getJSONObject("args").getBoolean("locked"), v.getLong("now"), v.by()).toJson())
            "setRotation" -> same(name, v.getJSONObject("expect"), e.setRotation(v.doc(), v.getJSONObject("args").getJSONObject("patch"), v.getLong("now"), v.by()).toJson())
            "reset" -> same(name, v.getJSONObject("expect"), e.reset(v.getLong("now"), v.by()).toJson())
            else -> throw AssertionError("$name: the Kotlin engine does not know the vector operation '$op'")
        }
    }

    @Test fun everyVectorGivesTheSameAnswerAsTheJsEngine() {
        val file = ThemeFiles.file("theme-vectors.json")
        assertTrue("theme-vectors.json is missing from Lounge/contract", file.exists())
        val root = JSONObject(file.readText())
        val vectors = root.getJSONArray("vectors")
        assertEquals("the file says how many vectors it holds", root.getInt("count"), vectors.length())
        assertTrue(vectors.length() >= 100)
        val failures = mutableListOf<String>(); val ran = mutableMapOf<String, Int>()
        for (i in 0 until vectors.length()) {
            val v = vectors.getJSONObject(i)
            try { run(v); ran.merge(v.getString("op"), 1, Int::plus) } catch (t: Throwable) { failures += "#$i ${v.optString("name")}: ${t.message ?: t}" }
        }
        assertTrue("${failures.size} of ${vectors.length()} vectors failed:\n" + failures.joinToString("\n"), failures.isEmpty())
        assertEquals(vectors.length(), ran.values.sum())
        println("theme vectors passed: $ran")
    }
}
