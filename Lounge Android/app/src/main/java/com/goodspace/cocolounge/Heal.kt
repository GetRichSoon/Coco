package com.goodspace.cocolounge

import android.content.Context
import kotlinx.coroutines.delay
import org.json.JSONObject
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

    // ---------- Delivery while devices rest (YES-3 follow-up), the same rules as Lounge/heal.js ----------
    // A device says in its heartbeat (devices.info.presence) whether it is on screen ('active') or resting ('quiet') and by when it
    // checks in next. A resting device reads at least once per shared 30-minute slot and within about half a minute of a command being
    // sent to it (Nova's wake board). So "not seen for 3 minutes" no longer means "gone", and its commands wait for it.
    private const val ACTIVE_GRACE_MS = 150_000L
    private const val QUIET_GRACE_MS = 5 * 60_000L
    const val OFFLINE_EXPIRE_MS = 30 * 60_000L
    fun nextCheckBy(quiet: Boolean, now: Long) = if (quiet) (now / Quiet.SLOT_MS + 1) * Quiet.SLOT_MS + QUIET_GRACE_MS else now + ACTIVE_GRACE_MS
    fun presenceInfo(quiet: Boolean, now: Long): JSONObject = JSONObject().put("mode", if (quiet) "quiet" else "active").put("next_by", Instant.ofEpochMilli(nextCheckBy(quiet, now)).toString())
    internal fun ms(iso: String?) = iso?.takeIf { it.isNotBlank() && it != "null" }?.let { runCatching { OffsetDateTime.parse(it).toInstant().toEpochMilli() }.getOrNull() ?: runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }

    /** online | resting | offline, with by when (resting/online) or since when (offline). A row without presence (an older app): the old 150 s rule. */
    class Presence(val state: String, val nextBy: Long?, val since: Long?)
    fun presence(dev: JSONObject?, now: Long): Presence {
        val seen = ms(dev?.optString("last_seen"))
        val p = dev?.optJSONObject("info")?.optJSONObject("presence")
        val by = ms(p?.optString("next_by")) ?: seen?.plus(ACTIVE_GRACE_MS) ?: return Presence("offline", null, null)
        return if (now <= by) Presence(if (p?.optString("mode") == "quiet") "resting" else "online", by, null) else Presence("offline", null, by)
    }

    /** What the sender sees: queued (sending) / waiting / acked (received) / done / failed / expired / cancelled, with the reason. */
    class State(val state: String, val label: String, val why: String = "", val by: Long? = null)
    fun commandState(row: JSONObject, target: JSONObject?, now: Long): State {
        val r = row.optString("result").let { if (it == "null") "" else it }
        return when (row.optString("status")) {
            "done" -> State("done", "Done")
            "failed" -> when {
                Regex("^(expired|stale|too old)", RegexOption.IGNORE_CASE).containsMatchIn(r) -> State("expired", "Expired", r)
                r.startsWith("cancelled", true) -> State("cancelled", "Cancelled", r)
                else -> State("failed", "Failed", r)
            }
            "running" -> State("acked", "Received", "the device took it and is running it")
            else -> presence(target, now).let { p -> when (p.state) {
                "online" -> State("queued", "Sending", "the device checks every few seconds")
                "resting" -> State("waiting", "Waiting", "the device is resting; it picks this up within a minute", p.nextBy)
                else -> State("waiting", "Waiting", "the device is offline; this waits for it, and is reported as expired if it stays away 30 min")
            } }
        }
    }

    /** The runner's age check: a command that waited only because THIS phone was resting (it ran the whole time) still runs, except a
     *  spoken wish, which is never run late; one sent while the phone was off or asleep keeps the safety limits. The reason is written back. */
    class Run(val run: Boolean, val result: String? = null)
    fun runVerdict(action: String, createdMs: Long, nowMs: Long, aliveSince: Long): Run {
        val age = nowMs - createdMs; val limit = ageLimitSec(action)
        if (limit == Long.MAX_VALUE || age <= limit * 1000) return Run(true)
        val restedOnly = createdMs >= aliveSince; val mins = Math.round(age / 60_000.0)
        if (restedOnly && action !in voice) return Run(true)
        return Run(false, if (restedOnly) "expired: arrived $mins min after it was sent; spoken requests are never run late"
            else "expired: this device was off or asleep when it was sent ($mins min ago); commands older than ${limit / 60} min are not run late, for safety")
    }

    /** The sender's id for a new command, its idempotency key: a retried insert with the same id is refused as a duplicate. */
    fun newCommandId(): String = java.util.UUID.randomUUID().toString()
    fun isDuplicate(e: Throwable) = e is Cloud.CloudError && e.code == 409 && Regex("duplicate|already exists|23505", RegexOption.IGNORE_CASE).containsMatchIn(e.message.orEmpty())

    /** What the sweeper does with a row so the queue never clogs (null = leave it). A queued command is closed only once its device has
     *  been OFFLINE (not resting) for 30 minutes, with that reason. `targetPresence` is the target's info.presence (null for an older app). */
    fun sweepVerdict(status: String, action: String, args: JSONObject, result: String, createdMs: Long, nowMs: Long, lastSeen: String?, targetPresence: JSONObject? = null): Verdict? {
        val age = nowMs - createdMs
        if (status == "failed" && !Regex("^(stale|expired|cancelled)", RegexOption.IGNORE_CASE).containsMatchIn(result) && age > 24 * 3_600_000L) return Verdict("failed", "stale: " + result.ifBlank { "no reason recorded" })
        if (status == "queued" && age > OFFLINE_EXPIRE_MS) {
            val p = presence(JSONObject().put("last_seen", lastSeen ?: "").apply { if (targetPresence != null) put("info", JSONObject().put("presence", targetPresence)) }, nowMs)
            if (p.state == "offline" && (p.since == null || nowMs - p.since > OFFLINE_EXPIRE_MS)) return Verdict("failed", "stale: target device offline (${lastSeen?.take(16)?.replace('T', ' ')?.let { "last seen $it UTC" } ?: "never seen"}), not run")
            return null
        }
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
        // a command that waited only because this phone was resting still runs; one sent while it was asleep keeps the limits (runVerdict)
        Quiet.noteAlive()
        val created = ms(c.optString("created_at")) ?: System.currentTimeMillis()
        val verdict = runVerdict(action, created, System.currentTimeMillis(), Quiet.aliveSince)
        var result: String; var cls: String
        if (!verdict.run) {
            result = verdict.result ?: "expired"; cls = "failed_other"
            note(ctx, cloud, "offline", "A command expired before this phone could run it ($action): $result")
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
        // read fresh, with presence: a resting device's commands wait for it, and only a fresh row can tell resting from gone
        val seen = runCatching { cloud.list("devices", "select=id,last_seen,info") }.getOrNull() ?: return
        val rows = (0 until open.length()).map { open.getJSONObject(it) } + (0 until (old?.length() ?: 0)).map { old!!.getJSONObject(it) }
        for (r in rows) {
            val status = r.optString("status")
            if (status == "running" && r.optString("target_device") != me) continue   // another device owns it
            val dev = (0 until seen.length()).map { seen.getJSONObject(it) }.firstOrNull { it.optString("id") == r.optString("target_device") }
            val last = dev?.optString("last_seen")?.takeIf { it.isNotBlank() && it != "null" }
            val created = runCatching { OffsetDateTime.parse(r.optString("created_at")).toInstant().toEpochMilli() }.getOrNull() ?: continue
            val v = sweepVerdict(status, r.optString("action"), r.optJSONObject("args") ?: JSONObject(), r.optString("result").let { if (it == "null") "" else it }, created, System.currentTimeMillis(), last, dev?.optJSONObject("info")?.optJSONObject("presence")) ?: continue
            val body = JSONObject().put("status", v.status)
            v.result?.let { body.put("result", it) }; v.args?.let { body.put("args", it) }
            if (v.status == "failed") body.put("done_at", Instant.now().toString())
            runCatching { cloud.claim("commands", "id=eq.${r.optString("id")}&status=eq.$status", body) }
        }
    }
}
