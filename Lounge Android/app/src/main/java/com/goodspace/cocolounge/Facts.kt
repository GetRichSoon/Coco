package com.goodspace.cocolounge

import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Pure rules the redesigned pages share, kept out of Compose so the JVM tests can hold them. The metric rules are the same
 * as the web Lounge's ui-kit.js, so the phone and the desktop show the same numbers: a number is a recorded fact with a
 * source, or it is "unavailable". Missing data never becomes a 0 and an estimate is never shown as an actual.
 */
object Facts {
    const val UNAVAILABLE = "unavailable"
    const val NONE_IN_PERIOD = "none_in_period"
    const val DAYS = 28   // the web's default period ("Last 28 days")

    private fun JSONObject.str(k: String) = optString(k).takeIf { it.isNotBlank() && it != "null" }

    /** A unit belongs to a House when it is the House itself or sits under it ("gigi", "gigi.bunny", "gigi.bunny.cat_3"). */
    fun inHouse(house: String, id: String?): Boolean = !id.isNullOrBlank() && (id == house || id.startsWith("$house."))

    /** The rows of one House: any of the id columns names the House or a unit under it. */
    fun forHouse(house: String, rows: List<JSONObject>, keys: List<String> = listOf("unit_id", "house_id")): List<JSONObject> =
        rows.filter { r -> keys.any { inHouse(house, r.str(it)) } }

    /** A House's metric rows: recorded on one of its units, or on one of its products. */
    fun metricsOf(house: String, metrics: List<JSONObject>, products: List<JSONObject>): List<JSONObject> {
        val mine = products.filter { inHouse(house, it.str("unit_id")) }.mapNotNull { it.str("id") }.toSet()
        return metrics.filter { inHouse(house, it.str("unit_id")) || it.str("product_id") in mine }
    }

    /** Whether a failed read means the table is not in Coco Cloud yet (not deployed, or not served by Nova), not a network blip. */
    fun isMissing(code: Int, message: String?): Boolean =
        code == 404 || Regex("does not exist|no such table|42P01|schema cache", RegexOption.IGNORE_CASE).containsMatchIn(message.orEmpty())

    fun isRevenue(m: JSONObject) = m.str("metric")?.lowercase() == "revenue"
    fun isEstimate(m: JSONObject) = Regex("estimat|forecast|project|target|plan", RegexOption.IGNORE_CASE).containsMatchIn(m.str("source").orEmpty())

    /** One headline number with its provenance. state: unavailable | none_in_period | actual | estimated | mixed. */
    data class Headline(val state: String, val text: String, val latest: String?, val sources: List<String>)

    /**
     * The total of the named metrics over the last [days] UTC days (inclusive), per unit of measure. Currencies are never
     * added together, and estimated rows (by their source) are shown apart from actual ones. A row without a numeric value
     * is skipped, never counted as 0; a recorded 0 is a real 0.
     */
    fun headline(metrics: List<JSONObject>, names: Set<String>, today: LocalDate = LocalDate.now(ZoneOffset.UTC), days: Int = DAYS): Headline {
        val ever = metrics.filter { (it.str("metric")?.lowercase() ?: "") in names }
        if (ever.none { it.str("value")?.toDoubleOrNull() != null }) return Headline(UNAVAILABLE, "Unavailable", null, emptyList())
        val from = today.minusDays(days - 1L).toString(); val to = today.toString()
        val cur = ever.filter { r -> r.str("period")?.take(10)?.let { it in from..to } == true && r.str("value")?.toDoubleOrNull() != null }
        if (cur.isEmpty()) return Headline(NONE_IN_PERIOD, "No records in the last $days days", newest(ever), ever.mapNotNull { it.str("source") }.distinct())
        val parts = cur.groupBy { it.str("unit") ?: "" }.toSortedMap().flatMap { (unit, rs) ->
            val (est, act) = rs.partition(::isEstimate)
            val u = if (unit.isBlank()) "" else " $unit"
            listOfNotNull(act.takeIf { it.isNotEmpty() }?.let { number(it.sumOf { r -> r.str("value")!!.toDouble() }) + u },
                est.takeIf { it.isNotEmpty() }?.let { number(it.sumOf { r -> r.str("value")!!.toDouble() }) + u + " estimated" })
        }
        val state = when { cur.all(::isEstimate) -> "estimated"; cur.none(::isEstimate) -> "actual"; else -> "mixed" }
        return Headline(state, parts.joinToString(" · "), newest(cur), cur.mapNotNull { it.str("source") }.distinct())
    }

    fun revenue(metrics: List<JSONObject>, today: LocalDate = LocalDate.now(ZoneOffset.UTC)) = headline(metrics, setOf("revenue"), today)

    /** The newest timestamp on a row, for "as of" lines (org_metrics: recorded_at, else its period). */
    fun stamp(r: JSONObject): String = listOf("recorded_at", "at", "collected_at", "updated_at", "created_at", "period").firstNotNullOfOrNull { r.str(it) } ?: ""
    fun newest(rows: List<JSONObject>): String? = rows.map(::stamp).filter { it.isNotBlank() }.maxOrNull()

    fun number(v: Double): String = if (v == Math.floor(v) && kotlin.math.abs(v) < 1e15) "%,d".format(java.util.Locale.US, v.toLong()) else "%,.2f".format(java.util.Locale.US, v)

    /** Failed jobs of the last [days] days (the web's live-operations window), by updated_at, else created_at. */
    fun recentFailed(jobs: List<JSONObject>, now: java.time.Instant = java.time.Instant.now(), days: Long = 3): List<JSONObject> {
        val since = now.minus(java.time.Duration.ofDays(days))
        return jobs.filter { it.str("status") == "failed" && instant(it.str("updated_at") ?: it.str("created_at"))?.isAfter(since) == true }
    }
    private fun instant(s: String?): java.time.Instant? = s?.let { v ->
        runCatching { java.time.OffsetDateTime.parse(v.replace(' ', 'T')).toInstant() }.getOrNull() ?: runCatching { java.time.Instant.parse(v) }.getOrNull()
    }

    /** Count of rows by a status column, for queue health. */
    fun countBy(rows: List<JSONObject>, key: String = "status"): Map<String, Int> = rows.groupingBy { it.str(key) ?: "unknown" }.eachCount()
}
