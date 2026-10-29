package com.goodspace.cocolounge

import android.content.Context
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

/**
 * Auto-heal for commands (Nono, 2026-10-26). Same rules as Lounge/heal.js on the PC, built from the real failed rows of Coco Cloud:
 * one smart retry for known transient failures, one "needs Nono" note per kind per day (never spam), a sweeper so the queue never clogs,
 * and ONE runner shared by the app and the always-on service (they used to carry two copies of this code).
 */
object Heal {
    val retrySafe = setOf("status", "notify", "open_app", "open_url", "ring")   // running these twice does no harm
    private val lateOk = setOf("status", "notify")                                              // harmless even when late: up to 2 h
    /** Spoken wishes (a song, media keys, volume, a sentence) go stale fast: never run late, never run twice (Boss, 2026-10-26). */
    val voice = setOf("say", "play_youtube", "media", "volume")
    // 'update' never expires. Every other command is something a founder asked for a moment ago, and
    // running it late is worse than dropping it; an update is the opposite - a phone that was off for
    // two days must still take it the moment it comes back, or the cloud loses the one instruction
    // that matters. The same rule as Lounge/heal.js on the PC.
    fun ageLimitSec(action: String) = if (action == "update") Long.MAX_VALUE else if (action in lateOk) 7200L else if (action in voice) 120L else 600L

    /** ok | not_understood | app_missing | refused | timeout | transient | failed_other */
    fun classify(r: String): String = when {
        r.startsWith("Not understood", true) -> "not_understood"
        Regex("""^(.+ is not installed|this app is not on the allowed list)""", RegexOption.IGNORE_CASE).containsMatchIn(r) -> "app_missing"
        Regex("""^(a phone can't|this phone does not|only https)""", RegexOption.IGNORE_CASE).containsMatchIn(r) -> "refused"
        Regex("""^failed: .*(timeout|timed out|unable to resolve|connect|network|fetch)""", RegexOption.IGNORE_CASE).containsMatchIn(r) -> "transient"
        r.startsWith("failed", true) || r.isBlank() -> "failed_other"
        else -> "ok"
    }
    fun canRetry(action: String, args: JSONObject, cls: String) = !args.has("_retried") && cls == "transient" && action in retrySafe

    /** A row the sweeper put back in the queue (_retried) must run again even though its id was seen. */
    fun runKey(c: JSONObject) = c.optString("id") + if (c.optJSONObject("args")?.has("_retried") == true) "r" else ""

    class Verdict(val status: String, val result: String? = null, val args: JSONObject? = null)

    /** What the sweeper does with a row so the queue never clogs (null = leave it). */
    fun sweepVerdict(status: String, action: String, args: JSONObject, result: String, createdMs: Long, nowMs: Long, lastSeen: String?): Verdict? {
        val age = nowMs - createdMs
        if (status == "failed" && !result.startsWith("stale", true) && age > 24 * 3_600_000L) return Verdict("failed", "stale: " + result.ifBlank { "no reason recorded" })
        if (status == "queued" && age > 30 * 60_000L) return Verdict("failed", "stale: target device offline (${lastSeen?.take(16)?.replace('T', ' ')?.let { "last seen $it UTC" } ?: "never seen"}), not run")
        if (status == "running" && age > 3 * 60_000L) {
            if (action in retrySafe && !args.has("_retried") && age < ageLimitSec(action) * 1000) return Verdict("queued", args = JSONObject(args.toString()).put("_retried", 1))
            return Verdict("failed", "interrupted: the app stopped before this finished, not run again")
        }
        return null
    }

    /** Claim, run, retry once if that is right, and always report back (three tries) so a row never stays "running". */
    suspend fun runOne(ctx: Context, cloud: Cloud, c: JSONObject) {
        val id = c.optString("id"); val action = c.optString("action"); val args = c.optJSONObject("args") ?: JSONObject()
        if (!runCatching { cloud.claim("commands", "id=eq.$id&status=eq.queued", JSONObject().put("status", "running")) }.getOrDefault(false)) return
        val age = runCatching { Duration.between(OffsetDateTime.parse(c.optString("created_at")).toInstant(), Instant.now()).seconds }.getOrDefault(0L)
        var result: String; var cls: String
        if (age > ageLimitSec(action)) {
            result = "Too old (over ${ageLimitSec(action) / 60} min), not run: this phone was asleep or offline"; cls = "failed_other"
            note(ctx, cloud, "offline", "A command expired before this phone could run it ($action). Commands are never run late (spoken ones after 2 min, others after 10), for safety.")
        } else {
            // The cloud sends this to every device it finds below the current release, so an update
            // starts without anyone opening Coco and looking. Idempotent: the row was already claimed
            // above, so it runs once, and a check on an up-to-date phone is a no-op that says so.
            result = if (action == "update")
                runCatching { Updater.check(ctx) }.fold(
                    { v -> if (v == null) "already on the current build" else "downloading and installing $v" },
                    { "failed: ${it.message}" })
            else runCatching { PhoneRemote.run(ctx, action, args) }.getOrElse { "failed: ${it.message}" }
            cls = classify(result)
            if (cls != "ok" && canRetry(action, args, cls)) {   // one smart retry after a short pause
                delay(2_000)
                val again = runCatching { PhoneRemote.run(ctx, action, JSONObject(args.toString()).put("_retried", 1)) }.getOrElse { "failed: ${it.message}" }
                cls = classify(again); result = (if (cls == "ok") "retried ok: " else "retried, still failing: ") + again
            }
            if (cls != "ok" && cls != "refused") note(ctx, cloud, "$cls-$action", "Phone command \"$action\" failed ($cls): ${result.take(160)}")
        }
        val body = JSONObject().put("status", if (cls == "ok") "done" else "failed").put("result", result).put("done_at", Instant.now().toString())
        repeat(3) { i -> if (runCatching { cloud.update("commands", "id=eq.$id", body) }.isSuccess) return; delay(2_000L * (i + 1)) }
    }

    /** One note per kind per day to Coco activity for Nono; the same problem never repeats the same day. */
    suspend fun note(ctx: Context, cloud: Cloud, kind: String, detail: String) {
        val prefs = ctx.getSharedPreferences("coco_heal", Context.MODE_PRIVATE)
        val day = java.time.LocalDate.now().toString()
        if (prefs.getString("nono-$kind", null) == day) return
        prefs.edit().putString("nono-$kind", day).apply()
        runCatching { cloud.insert("activity", JSONObject().put("actor", "Coco").put("device_id", cloud.deviceId).put("action", "needs Nono").put("detail", detail.take(300))) }
    }

    /** Every 5 minutes from the always-on service: closes or retries what got stuck. */
    suspend fun sweep(cloud: Cloud) {
        val me = cloud.deviceId ?: return
        val dayAgo = Instant.now().minusSeconds(86_400).toString()
        val open = runCatching { cloud.list("commands", "select=*&status=in.(queued,running)") }.getOrNull() ?: return
        val old = runCatching { cloud.list("commands", "select=*&status=eq.failed&created_at=lt.$dayAgo&result=not.ilike.stale*&limit=200") }.getOrNull()
        val seen = runCatching { cloud.list("devices", "select=id,last_seen") }.getOrNull()
        val rows = (0 until open.length()).map { open.getJSONObject(it) } + (0 until (old?.length() ?: 0)).map { old!!.getJSONObject(it) }
        for (r in rows) {
            val status = r.optString("status")
            if (status == "running" && r.optString("target_device") != me) continue   // another device owns it
            val last = (0 until (seen?.length() ?: 0)).map { seen!!.getJSONObject(it) }.firstOrNull { it.optString("id") == r.optString("target_device") }?.optString("last_seen")
            val created = runCatching { OffsetDateTime.parse(r.optString("created_at")).toInstant().toEpochMilli() }.getOrNull() ?: continue
            val v = sweepVerdict(status, r.optString("action"), r.optJSONObject("args") ?: JSONObject(), r.optString("result"), created, System.currentTimeMillis(), last) ?: continue
            val body = JSONObject().put("status", v.status)
            v.result?.let { body.put("result", it) }; v.args?.let { body.put("args", it) }
            if (v.status == "failed") body.put("done_at", Instant.now().toString())
            runCatching { cloud.claim("commands", "id=eq.${r.optString("id")}&status=eq.$status", body) }
        }
    }
}
