package com.goodspace.cocolounge

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Self update without USB (Boss, 2026-10-21). New builds go to the private Coco Cloud bucket "apk"
 * (apk/latest.json = {"versionCode":N,"versionName":"x","file":"coco-lounge-N.apk"}).
 * The phone checks on open and every 15 minutes, downloads in the background, then one tap installs it.
 * shortcut: Android always asks once per update for a side-loaded app; fully silent needs Play Store or device owner.
 */
/** The rules for PackageInstaller sessions, pure so they are tested without a phone (UpdaterSessionsTest). */
object InstallSessions {
    data class S(val id: Int, val active: Boolean)
    const val COOLDOWN_MS = 30 * 60 * 1000L
    /** Sessions this app left behind that nobody is working on: safe to abandon. */
    fun stale(mine: List<S>): List<Int> = mine.filter { !it.active }.map { it.id }
    /** A new session only when none is in progress, and the same build is not hammered (a person tapping always may). */
    fun mayStart(mine: List<S>, code: Long, triedCode: Long, triedAt: Long, now: Long, byPerson: Boolean): Boolean {
        if (mine.any { it.active }) return false
        return byPerson || code != triedCode || now - triedAt >= COOLDOWN_MS
    }
}

object Updater {
    private val http = OkHttpClient()
    private val lock = Mutex()   // app, worker and service may all check at once
    private fun apk(ctx: Context) = File(ctx.filesDir, "update.apk")

    /**
     * Tells Coco Cloud which phase this phone is in, so the Release Center shows a phone that is
     * busy differently from one that is stuck. Never allowed to break an update: a phone with no
     * signal must still be able to install, so a failure to report is swallowed.
     *
     * UPDATE_REQUIRED and UPDATED are deliberately not sent from here. The cloud decides those by
     * comparing the version this phone reports with the release, and a phone saying "I am updated"
     * is a claim; the version it reports is the proof.
     */
    private suspend fun phase(cloud: Cloud, state: String, why: String? = null) {
        val id = cloud.deviceId ?: return
        runCatching {
            cloud.update("devices", "id=eq.$id", JSONObject().apply {
                put("update_state", state)
                put("update_attempt_at", java.time.Instant.now().toString())
                if (why != null) put("update_result", why)
            })
        }
    }

    private fun sha256(f: File): String {
        val d = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { inp ->
            val buf = ByteArray(1 shl 16)
            while (true) { val n = inp.read(buf); if (n <= 0) break; d.update(buf, 0, n) }
        }
        return d.digest().joinToString("") { "%02x".format(it) }
    }
    private fun current(ctx: Context) = ctx.packageManager.getPackageInfo(ctx.packageName, 0).longVersionCode

    /** Downloads a newer build if there is one. Returns its version name, or null when up to date. */
    suspend fun check(ctx: Context, manual: Boolean = false): String? = lock.withLock { withContext(Dispatchers.IO) {
        val cloud = Cloud(ctx)
        if (!cloud.signedIn) return@withContext null
        val token = if (Cloud.viaNova) "" else cloud.token()
        fun get(path: String) = http.newCall(Request.Builder().url(if (path.startsWith("https://")) path else "${Cloud.URL}/storage/v1/object/authenticated/apk/$path")
            .apply { if (!path.startsWith("https://")) header("apikey", Cloud.KEY).header("Authorization", "Bearer $token") }.build()).execute()
        // Nova mode: the newest build is announced by Nova (version, sha256 and a short-lived B2 link for this device)
        fun fromNova(): JSONObject? = runCatching {
            val b = Request.Builder().url("${Cloud.NOVA}/api/apk/latest"); cloud.deviceKey?.let { b.header("x-device-key", it) }
            http.newCall(b.get().build()).execute().use { r -> if (!r.isSuccessful) throw Exception("Nova said ${r.code}"); JSONObject(r.body!!.string()) }
        }.getOrNull()
        // The newest build is announced in controls/apk_latest with a ready download link (works without storage rules);
        // the bucket file is the fallback. A failure is an error, never "up to date".
        val meta = (if (Cloud.viaNova) fromNova() else null)
            ?: runCatching { cloud.list("controls", "select=value&id=eq.apk_latest").optJSONObject(0)?.optJSONObject("value") }.getOrNull()
            ?: get("latest.json").use { r -> if (!r.isSuccessful) throw Exception("Coco Cloud said ${r.code}"); JSONObject(r.body!!.string()) }
        val code = meta.optLong("versionCode")
        if (code <= current(ctx)) { apk(ctx).delete(); return@withContext null }
        val prefs = ctx.getSharedPreferences("coco_update", Context.MODE_PRIVATE)
        if (prefs.getLong("ready", 0) != code || !apk(ctx).exists()) {
            phase(cloud, "DOWNLOADING")
            val tmp = File(ctx.filesDir, "update.part")
            try {
                get(meta.optString("url").ifBlank { meta.getString("file") }).use { r -> if (!r.isSuccessful) throw Exception("Download failed (${r.code})"); tmp.outputStream().use { r.body!!.byteStream().copyTo(it) } }
            } catch (e: Exception) {
                tmp.delete(); phase(cloud, "FAILED", "download: ${e.message}"); throw e
            }
            // The hash the cloud recorded when it built and signed this APK. A file that does not match
            // it is not the release, whatever the link said, and is thrown away rather than installed -
            // the one point where a wrong or tampered artifact can still be stopped for free.
            val want = meta.optString("sha256").lowercase()
            if (want.isNotBlank()) {
                phase(cloud, "VERIFYING")
                val got = sha256(tmp)
                if (got != want) {
                    tmp.delete()
                    phase(cloud, "FAILED", "checksum did not match: expected ${want.take(12)}, got ${got.take(12)}")
                    throw Exception("That download is not the release Coco Cloud built")
                }
            }
            tmp.renameTo(apk(ctx))
            prefs.edit().putLong("ready", code).apply()
        }
        // Install by itself when Android allows it; otherwise one tap on the notification. Either way
        // the cloud is told, because INSTALLING and RESTART_REQUIRED are different situations for a
        // founder: one is working, the other is waiting for a thumb.
        if (ctx.packageManager.canRequestPackageInstalls()) {
            phase(cloud, "INSTALLING")
            runCatching { install(ctx) }.onFailure { phase(cloud, "FAILED", "install: ${it.message}") }
        } else {
            phase(cloud, "RESTART_REQUIRED", "Android needs one tap to install a side-loaded update")
            Alerts.post(ctx, 4242, "Coco update ready: ${meta.optString("versionName")}", "Tap to install the new Coco Lounge.", "update", install = true)
        }
        meta.optString("versionName")
    } }

    /** For the Settings button: says what happened in plain words. */
    suspend fun checkNow(ctx: Context): String = runCatching { check(ctx, manual = true) }.fold(
        { v -> if (v == null) "Coco Lounge is up to date" else "Installing Coco Lounge $v" },
        { "Could not check: ${it.message}" })

    /**
     * Hands the downloaded build to Android's installer (the system shows one "Update" button).
     *
     * "Too many active sessions for UID" (both phones, 2026-11-04): every call used to open a NEW installer
     * session and never closed one. A session leaks whenever the commit throws, the confirm screen is never
     * tapped, or Android refuses the file, and this runs on every 15 minute check plus every app open, so the
     * leaks piled up until Android's per-app limit. Now: one install at a time, the stale sessions this app
     * left behind are abandoned first, nothing new is opened while one is genuinely in progress, the same
     * build is not retried more than every 30 minutes on its own (a person tapping always goes through), and a
     * session whose commit fails is abandoned on the spot. Authentication and Android's limit are untouched.
     */
    @Synchronized
    fun install(ctx: Context, byPerson: Boolean = false) {
        val file = apk(ctx)
        if (!file.exists()) return
        if (!ctx.packageManager.canRequestPackageInstalls()) {
            // One time only: allow Coco Lounge to install its own updates.
            ctx.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        val pi = ctx.packageManager.packageInstaller
        val prefs = ctx.getSharedPreferences("coco_update", Context.MODE_PRIVATE)
        val mine = pi.mySessions.map { InstallSessions.S(it.sessionId, it.isActive) }
        InstallSessions.stale(mine).forEach { runCatching { pi.abandonSession(it) } }   // free what earlier attempts leaked
        val code = prefs.getLong("ready", 0)
        if (!InstallSessions.mayStart(mine, code, prefs.getLong("tried", 0), prefs.getLong("tried_at", 0), System.currentTimeMillis(), byPerson)) return
        prefs.edit().putLong("tried", code).putLong("tried_at", System.currentTimeMillis()).apply()
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        var id = -1
        try {
            id = pi.createSession(params)
            pi.openSession(id).use { s ->
                s.openWrite("coco", 0, file.length()).use { out -> file.inputStream().use { it.copyTo(out) }; s.fsync(out) }
                val done = PendingIntent.getBroadcast(ctx, id, Intent(ctx, Result::class.java), PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
                s.commit(done.intentSender)
            }
        } catch (e: Exception) {
            if (id >= 0) runCatching { pi.abandonSession(id) }   // never leave a half-made session behind
            throw e
        }
    }

    /** Android asks for the confirm screen through this receiver. */
    class Result : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
            if (status != PackageInstaller.STATUS_SUCCESS && status != PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // Broken or refused file: forget it, so the next check downloads it again, and close its session.
                apk(ctx).delete(); ctx.getSharedPreferences("coco_update", Context.MODE_PRIVATE).edit().remove("ready").remove("tried").apply()
                intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1).takeIf { it >= 0 }?.let { sid -> runCatching { ctx.packageManager.packageInstaller.abandonSession(sid) } }
            }
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                ctx.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }
}
