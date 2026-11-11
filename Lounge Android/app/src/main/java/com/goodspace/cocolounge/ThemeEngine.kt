package com.goodspace.cocolounge

import org.json.JSONObject
import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The theme engine, ported line for line from Lounge/theme-engine.js (`create(contract)`), so the phone, the desktop app and the PWA reach
 * the same answer from the same document. Pure: no Android imports, no clock and no randomness of its own (callers pass `now` and `rand`),
 * which is what lets the JVM tests run every case of Lounge/contract/theme-vectors.json against it.
 *
 * What it decides: which theme is next, when a schedule is due, and what every user action does to the one small preferences document
 * that is identical on every device and in the cloud.
 */
data class ThemeRotation(
    val enabled: Boolean, val frequency: String, val order: String, val time: String, val weekday: Int, val dayOfMonth: Int,
    val tz: String, val seed: String, val anchorAt: String?,
) {
    fun toJson(): JSONObject = JSONObject().put("enabled", enabled).put("frequency", frequency).put("order", order).put("time", time)
        .put("weekday", weekday).put("dayOfMonth", dayOfMonth).put("tz", tz).put("seed", seed).put("anchorAt", anchorAt ?: JSONObject.NULL)
}

data class ThemePrefs(
    val appearance: String, val themeId: String, val previousThemeId: String?, val lastSwitchedAt: String?, val seq: Long, val locked: Boolean,
    val reason: String, val rotation: ThemeRotation, val updatedAt: String?, val updatedBy: String?,
) {
    fun toJson(): JSONObject = JSONObject().put("v", 1).put("appearance", appearance).put("themeId", themeId).put("previousThemeId", previousThemeId ?: JSONObject.NULL)
        .put("lastSwitchedAt", lastSwitchedAt ?: JSONObject.NULL).put("seq", seq).put("locked", locked).put("reason", reason).put("rotation", rotation.toJson())
        .put("updatedAt", updatedAt ?: JSONObject.NULL).put("updatedBy", updatedBy ?: JSONObject.NULL)
}

/** What the settings screen may promise about the next switch: none, an exact theme, or "one of these" (random on every launch). */
data class NextTheme(val kind: String, val themeId: String?, val candidates: List<String> = emptyList())
data class ThemeEval(val prefs: ThemePrefs, val changed: Boolean, val reason: String?)

class ThemeEngine(val contract: ThemeContract) {
    val ids: List<String> = contract.ids
    private val freq = contract.frequencies.associateBy { it.id }

    companion object {
        const val HOUR = 3_600_000L
        const val DAY = 86_400_000L
        private val ISO_OUT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).withZone(ZoneOffset.UTC)   // JS toISOString()
        private val TIME = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")
        private val ISO_IN = Regex("""^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$""", RegexOption.IGNORE_CASE)

        fun iso(ms: Long?): String? = ms?.let { ISO_OUT.format(Instant.ofEpochMilli(it)) }
        fun isTime(s: String) = TIME.matches(s)

        /** 32-bit FNV-1a over the low byte of each UTF-16 unit; integer maths only, so every device gets the same number. */
        fun fnv1a32(s: String): Long {
            var h = 0x811c9dc5L.toInt()
            for (ch in s) { h = h xor (ch.code and 0xff); h *= 0x01000193 }
            return h.toLong() and 0xFFFFFFFFL
        }

        /**
         * JS Date.parse for the ISO family every Coco client writes (and what Postgres sends back): date only is UTC, a date-time without an
         * offset is local time, "Z" / "+05:30" / "+0530" / "+00" are exact. Anything else is null, like NaN.
         */
        fun parseDate(s: String): Long? {
            val m = ISO_IN.matchEntire(s.trim()) ?: return null
            return try {
                val g = m.groupValues
                val year = g[1].toInt(); val date = LocalDate.of(year, g[2].toInt(), g[3].toInt())
                if (g[4].isEmpty()) return date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
                val nanos = g[7].padEnd(9, '0').take(9).toInt().let { it / 1_000_000 * 1_000_000 }   // JS keeps milliseconds
                val ldt = LocalDateTime.of(date, LocalTime.of(g[4].toInt(), g[5].toInt(), g[6].ifEmpty { "0" }.toInt(), nanos))
                val off = g[8]
                val zone: ZoneId = when {
                    off.isEmpty() -> ZoneId.systemDefault()
                    off.equals("Z", true) -> ZoneOffset.UTC
                    else -> { val d = off.drop(1).replace(":", ""); ZoneOffset.ofHoursMinutes((if (off[0] == '-') -1 else 1) * d.take(2).toInt(), (if (off[0] == '-') -1 else 1) * d.drop(2).ifEmpty { "0" }.toInt()) }
                }
                ldt.atZone(zone).toInstant().toEpochMilli()
            } catch (e: DateTimeException) { null }
        }

        /** JS ms(v): null for nothing / empty / unparsable, a number as is, a string through Date.parse. */
        fun msOf(v: Any?): Long? = when {
            v == null || v === JSONObject.NULL -> null
            v is Number -> v.toDouble().takeIf { it.isFinite() }?.toLong()
            v is String -> if (v.isEmpty()) null else parseDate(v)
            else -> null
        }

        /** JS Number(v) for what a JSON document can hold: NaN when it is not a number, null counts as 0, a missing key as NaN. */
        fun jsNumber(v: Any?): Double = when {
            v == null -> Double.NaN
            v === JSONObject.NULL -> 0.0
            v is Boolean -> if (v) 1.0 else 0.0
            v is Number -> v.toDouble()
            v is String -> v.trim().let { s -> if (s.isEmpty()) 0.0 else s.toDoubleOrNull() ?: Double.NaN }
            else -> Double.NaN
        }
        fun numOr(v: Any?, d: Double): Double = jsNumber(v).let { if (it.isFinite()) it else d }

        fun truthy(v: Any?): Boolean = when {
            v == null || v === JSONObject.NULL -> false
            v is Boolean -> v
            v is Number -> v.toDouble().let { it != 0.0 && !it.isNaN() }
            v is String -> v.isNotEmpty()
            else -> true
        }
        private fun jsString(v: Any?): String = when (v) {
            is String -> v
            is Number -> v.toDouble().let { if (it == Math.floor(it) && Math.abs(it) < 1e15) it.toLong().toString() else it.toString() }
            is Boolean -> v.toString()
            else -> "[object Object]"
        }

        private fun zone(tz: String): ZoneId = if (tz.isEmpty()) ZoneId.systemDefault() else try { ZoneId.of(tz) } catch (e: DateTimeException) { ZoneId.systemDefault() }
        fun zoneOf(tz: String): ZoneId = zone(tz)
        private fun pickBy(by: String?, fallback: String?) = if (by.isNullOrEmpty()) fallback else by
    }

    /** The wall clock of `tz` at the instant t (wd: 0 = Sunday). */
    data class Parts(val y: Int, val m: Int, val d: Int, val hh: Int, val mm: Int, val ss: Int, val wd: Int)
    fun partsInZone(t: Long, tz: String): Parts =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(t), zone(tz)).let { Parts(it.year, it.monthValue, it.dayOfMonth, it.hour, it.minute, it.second, it.dayOfWeek.value % 7) }

    /**
     * The instant at which the wall clock of `tz` reads y-m-d hh:mm (month 1-12; a day or month that overflows is normalised, like Date.UTC).
     * Daylight saving as java.time decides it: a wall time that happens twice means the earlier instant, one that does not exist moves later
     * by the length of the gap. The JS engine was rewritten to agree with this to the millisecond.
     */
    fun zonedToUtc(y: Int, m: Int, d: Int, hh: Int, mm: Int, tz: String): Long {
        val yy = y + Math.floorDiv(m - 1, 12); val mo = Math.floorMod(m - 1, 12) + 1
        val date = LocalDate.of(yy, mo, 1).plusDays((d - 1).toLong())
        return LocalDateTime.of(date, LocalTime.of(hh, mm)).atZone(zone(tz)).toInstant().toEpochMilli()
    }
    private fun daysInMonth(y: Int, m: Int) = YearMonth.of(y, m).lengthOfMonth()
    private fun hm(time: String): Pair<Int, Int> = time.split(':').let { it[0].toInt() to it[1].toInt() }

    // ---------------------------------------------------------------- the document
    fun defaultPrefs(): ThemePrefs {
        val d = contract.defaults; val r = d.rotation
        return ThemePrefs(d.appearance.ifEmpty { "system" }, d.themeId.ifEmpty { ids.first() }, null, null, 0, d.locked, "default",
            ThemeRotation(r.enabled, r.frequency.ifEmpty { "daily" }, r.order.ifEmpty { "sequential" }, r.time.ifEmpty { "09:00" }, r.weekday, r.dayOfMonth, "", "", null), null, null)
    }

    /** Whatever arrives (an older file, a cloud row, a hand edit) comes out as a valid document. */
    fun normalize(raw: Any?): ThemePrefs {
        val d = defaultPrefs()
        val r = raw as? JSONObject ?: JSONObject()
        val rr = r.opt("rotation") as? JSONObject ?: JSONObject()
        val themeId = (r.opt("themeId") as? String)?.takeIf { it in ids } ?: d.themeId
        val reasonRaw = r.opt("reason")
        val freqRaw = rr.opt("frequency") as? String
        return ThemePrefs(
            appearance = (r.opt("appearance") as? String)?.takeIf { it == "system" || it == "light" || it == "dark" } ?: d.appearance,
            themeId = themeId,
            previousThemeId = (r.opt("previousThemeId") as? String)?.takeIf { it in ids && it != themeId },
            lastSwitchedAt = iso(msOf(r.opt("lastSwitchedAt"))),
            seq = Math.max(0.0, Math.floor(numOr(r.opt("seq"), 0.0))).coerceAtMost(9.0e15).toLong(),
            locked = truthy(r.opt("locked")),
            reason = (if (truthy(reasonRaw)) jsString(reasonRaw) else "default").take(24),
            rotation = ThemeRotation(
                enabled = truthy(rr.opt("enabled")),
                frequency = if (freqRaw != null && freqRaw in freq) freqRaw else d.rotation.frequency,
                order = (rr.opt("order") as? String)?.takeIf { it == "sequential" || it == "random" } ?: d.rotation.order,
                time = (rr.opt("time") as? String)?.takeIf { isTime(it) } ?: d.rotation.time,
                weekday = Math.floor(numOr(rr.opt("weekday"), d.rotation.weekday.toDouble())).coerceIn(0.0, 6.0).toInt(),
                dayOfMonth = Math.floor(numOr(rr.opt("dayOfMonth"), d.rotation.dayOfMonth.toDouble())).coerceIn(1.0, 31.0).toInt(),
                tz = (rr.opt("tz") as? String)?.take(64) ?: "",
                seed = (rr.opt("seed") as? String)?.take(32) ?: "",
                anchorAt = iso(msOf(rr.opt("anchorAt"))),
            ),
            updatedAt = iso(msOf(r.opt("updatedAt"))),
            updatedBy = (r.opt("updatedBy") as? String)?.take(64),
        )
    }

    // ---------------------------------------------------------------- the schedule
    fun rotating(p: ThemePrefs): Boolean = p.rotation.enabled && !p.locked && (freq[p.rotation.frequency]?.kind ?: "manual") != "manual"
    /** The rotation clock: the later of the last switch and the last time the schedule itself was edited (so saving a new schedule never fires it). */
    fun anchorOf(p: ThemePrefs): Long = Math.max(msOf(p.lastSwitchedAt) ?: 0L, msOf(p.rotation.anchorAt) ?: 0L)

    /** The most recent scheduled instant at or before `now` (daily, weekly, monthly). */
    fun lastBoundary(now: Long, p: ThemePrefs): Long? {
        val kind = freq[p.rotation.frequency]?.kind ?: return null
        val tz = p.rotation.tz; val (hh, mm) = hm(p.rotation.time); val l = partsInZone(now, tz)
        when (kind) {
            "daily" -> { var b = zonedToUtc(l.y, l.m, l.d, hh, mm, tz); if (b > now) b = zonedToUtc(l.y, l.m, l.d - 1, hh, mm, tz); return b }
            "weekly" -> {
                val back = (l.wd - p.rotation.weekday + 7) % 7
                var b = zonedToUtc(l.y, l.m, l.d - back, hh, mm, tz); if (b > now) b = zonedToUtc(l.y, l.m, l.d - back - 7, hh, mm, tz); return b
            }
            "monthly" -> {
                fun at(y: Int, m: Int): Long {
                    val yy = y + Math.floorDiv(m - 1, 12); val mo = Math.floorMod(m - 1, 12) + 1
                    return zonedToUtc(yy, mo, Math.min(p.rotation.dayOfMonth, daysInMonth(yy, mo)), hh, mm, tz)
                }
                var b = at(l.y, l.m); if (b > now) b = at(l.y, l.m - 1); return b
            }
        }
        return null
    }

    /** The first scheduled instant strictly after `t`. */
    fun boundaryAfter(t: Long, p: ThemePrefs): Long {
        val kind = freq[p.rotation.frequency]?.kind; val tz = p.rotation.tz; val (hh, mm) = hm(p.rotation.time)
        val b = lastBoundary(t, p) ?: return t + DAY   // only daily, weekly and monthly reach here
        val l = partsInZone(b, tz)
        return when (kind) {
            "daily" -> zonedToUtc(l.y, l.m, l.d + 1, hh, mm, tz)
            "weekly" -> zonedToUtc(l.y, l.m, l.d + 7, hh, mm, tz)
            else -> { val y = l.y + l.m / 12; val m = (l.m % 12) + 1; zonedToUtc(y, m, Math.min(p.rotation.dayOfMonth, daysInMonth(y, m)), hh, mm, tz) }
        }
    }

    /** When is the next automatic switch? null when nothing is scheduled (off, locked, manual only, or "every launch"). */
    fun nextDueAt(p: ThemePrefs, now: Long): Long? {
        if (!rotating(p)) return null
        val f = freq.getValue(p.rotation.frequency)
        if (f.kind == "launch") return null
        val a = anchorOf(p).takeIf { it != 0L } ?: now
        if (f.kind == "interval") return a + f.hours * HOUR
        return boundaryAfter(a, p)
    }
    fun isDue(p: ThemePrefs, now: Long): Boolean = nextDueAt(p, now)?.let { now >= it } ?: false
    fun kindOf(p: ThemePrefs): String? = freq[p.rotation.frequency]?.kind

    // ---------------------------------------------------------------- choosing the next theme
    fun candidates(p: ThemePrefs): List<String> {
        val avoid = setOf(p.themeId, p.previousThemeId)
        var c = ids.filter { it !in avoid }
        if (c.size < 2) c = ids.filter { it != p.themeId }
        return c
    }

    /**
     * Sequential: the next theme in order, then round again. Random: never the one in use (nor the one before it); drawn from `rand` (a fresh
     * launch) or, for scheduled switches, from a hash of the shared seed, so every device computes the very same "random" theme.
     */
    fun pickNext(p: ThemePrefs, rand: Double? = null): String {
        if (p.rotation.order == "sequential") return ids[(ids.indexOf(p.themeId) + 1) % ids.size]
        val c = candidates(p)
        val idx = if (rand != null) Math.min(c.size - 1, Math.floor(rand * c.size).toInt())
        else (fnv1a32("${p.rotation.seed.ifEmpty { "coco" }}|${p.seq}|${p.themeId}") % c.size).toInt()
        return c[idx]
    }

    fun preview(p: ThemePrefs): NextTheme {
        if (!rotating(p)) return NextTheme("none", null)
        if (kindOf(p) == "launch") return if (p.rotation.order == "sequential") NextTheme("exact", pickNext(p)) else NextTheme("random", null, candidates(p))
        return NextTheme("exact", pickNext(p))
    }

    // ---------------------------------------------------------------- transitions (each returns a NEW document)
    private fun switchTo(p: ThemePrefs, themeId: String, now: Long, reason: String, by: String?): ThemePrefs =
        if (themeId == p.themeId) p.copy(reason = reason, updatedAt = iso(now), updatedBy = pickBy(by, p.updatedBy))
        else p.copy(themeId = themeId, previousThemeId = p.themeId, lastSwitchedAt = iso(now), seq = p.seq + 1, reason = reason, updatedAt = iso(now), updatedBy = pickBy(by, p.updatedBy))

    private fun restartClock(p: ThemePrefs, now: Long) = p.copy(rotation = p.rotation.copy(anchorAt = iso(now)))

    /** The person picked a theme: it applies now, and the rotation clock starts again from here. */
    fun applyManual(p: ThemePrefs, themeId: String, now: Long, by: String?): ThemePrefs =
        if (themeId !in ids) p else restartClock(switchTo(p, themeId, now, "manual", by), now)

    /** "Apply the next theme now": one step in the chosen order, and the clock starts again. */
    fun advance(p: ThemePrefs, now: Long, rand: Double?, by: String?): ThemePrefs = restartClock(switchTo(p, pickNext(p, rand), now, "next", by), now)

    fun setRotation(p: ThemePrefs, patch: JSONObject, now: Long, by: String?): ThemePrefs {
        val rot = p.rotation.toJson(); patch.keys().forEach { rot.put(it, patch.opt(it)) }
        var merged = normalize(p.toJson().put("rotation", rot)).rotation
        // a fresh schedule restarts its own clock and gets a seed the first time it is switched on
        merged = merged.copy(anchorAt = iso(now))
        if (merged.enabled && merged.seed.isEmpty()) {
            val given = patch.opt("seed")
            merged = merged.copy(seed = if (truthy(given)) jsString(given).take(32) else fnv1a32(iso(now) + "|" + p.themeId).toString(16).padStart(8, '0'))
        }
        return p.copy(rotation = merged, reason = "settings", updatedAt = iso(now), updatedBy = pickBy(by, p.updatedBy))
    }

    fun setLocked(p: ThemePrefs, locked: Boolean, now: Long, by: String?): ThemePrefs =
        p.copy(locked = locked, rotation = p.rotation.copy(anchorAt = if (locked) p.rotation.anchorAt else iso(now)), reason = if (locked) "locked" else "unlocked", updatedAt = iso(now), updatedBy = pickBy(by, p.updatedBy))

    fun setAppearance(p: ThemePrefs, appearance: String, now: Long, by: String?): ThemePrefs =
        if (appearance == "system" || appearance == "light" || appearance == "dark") p.copy(appearance = appearance, reason = "appearance", updatedAt = iso(now), updatedBy = pickBy(by, p.updatedBy)) else p

    fun reset(now: Long, by: String?): ThemePrefs = defaultPrefs().copy(reason = "reset", updatedAt = iso(now), updatedBy = by?.ifEmpty { null })

    /**
     * THE decision. Called when the app opens (launch = true), on a timer and when the app wakes up. It only ever looks at timestamps.
     *   launch -> a new session: "every launch" switches; so does any other schedule that fell due while the app was closed
     *   due    -> one step, however many scheduled times were missed
     * A locked theme, a switched-off rotation and "manual only" never change.
     */
    fun evaluate(p: ThemePrefs, now: Long, launch: Boolean, rand: Double?, by: String?): ThemeEval {
        val f = if (rotating(p)) freq[p.rotation.frequency] else null
        if (f == null) return ThemeEval(p, false, null)
        if (f.kind == "launch") {
            if (!launch) return ThemeEval(p, false, null)
            val n = restartClock(switchTo(p, pickNext(p, rand), now, "launch", by), now)
            return ThemeEval(n, n.themeId != p.themeId, "launch")
        }
        if (isDue(p, now)) { val n = switchTo(p, pickNext(p, null), now, "schedule", by); return ThemeEval(n, n.themeId != p.themeId, "schedule") }
        return ThemeEval(p, false, null)
    }

    /** Two copies of the document (this device, the cloud): the later edit wins; a tie keeps the first. */
    fun newer(a: ThemePrefs?, b: ThemePrefs?): ThemePrefs? = if ((msOf(a?.updatedAt) ?: 0L) >= (msOf(b?.updatedAt) ?: 0L)) a else b

    fun resolveDark(appearance: String, systemDark: Boolean): Boolean = when (appearance) { "light" -> false; "dark" -> true; else -> systemDark }
}
