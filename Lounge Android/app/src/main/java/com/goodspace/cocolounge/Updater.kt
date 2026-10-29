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
        val token = cloud.token()
        fun get(path: String) = http.newCall(Request.Builder().url(if (path.startsWith("https://")) path else "${Cloud.URL}/storage/v1/object/authenticated/apk/$path")
            .apply { if (!path.startsWith("https://")) header("apikey", Cloud.KEY).header("Authorization", "Bearer $token") }.build()).execute()
        // The newest build is announced in controls/apk_latest with a ready download link (works without storage rules);
        // the bucket file is the fallback. A failure is an error, never "up to date".
        val meta = runCatching { cloud.list("controls", "select=value&id=eq.apk_latest").optJSONObject(0)?.optJSONObject("value") }.getOrNull()
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

    /** Hands the downloaded build to Android's installer (the system shows one "Update" button). */
    fun install(ctx: Context) {
        val file = apk(ctx)
        if (!file.exists()) return
        if (!ctx.packageManager.canRequestPackageInstalls()) {
            // One time only: allow Coco Lounge to install its own updates.
            ctx.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        val pi = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        val id = pi.createSession(params)
        pi.openSession(id).use { s ->
            s.openWrite("coco", 0, file.length()).use { out -> file.inputStream().use { it.copyTo(out) }; s.fsync(out) }
            val done = PendingIntent.getBroadcast(ctx, id, Intent(ctx, Result::class.java), PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            s.commit(done.intentSender)
        }
    }

    /** Android asks for the confirm screen through this receiver. */
    class Result : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
            if (status != PackageInstaller.STATUS_SUCCESS && status != PackageInstaller.STATUS_PENDING_USER_ACTION) {
                // Broken or refused file: forget it, so the next check downloads it again.
                apk(ctx).delete(); ctx.getSharedPreferences("coco_update", Context.MODE_PRIVATE).edit().remove("ready").apply()
            }
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                @Suppress("DEPRECATION") val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                ctx.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }
}
