package com.goodspace.cocolounge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant

/**
 * "Coco connected" (Boss, 2026-10-21): keeps this phone online with Coco Cloud even when the app is closed.
 * Runs commands sent to this phone and sends the heartbeat (with the app version). Starts again after a reboot.
 * While the app is open, the app itself runs the commands (no double run).
 */
class Connected : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var stopListen: (() -> Unit)? = null
    private val handled = mutableSetOf<String>()

    companion object {
        private const val CHANNEL = "coco_connected"
        fun start(ctx: Context) = runCatching { ContextCompat.startForegroundService(ctx, Intent(ctx, Connected::class.java)) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Coco connected", NotificationManager.IMPORTANCE_MIN).apply { description = "Keeps Coco online so your other devices can reach this phone" })
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val n: Notification = NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_coco_face).setColor(0xFFB83A12.toInt())
            .setContentTitle("Coco connected").setContentText("Your devices can reach this phone").setOngoing(true).setContentIntent(open).build()
        startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        if (stopListen == null) loop()
        return START_STICKY
    }

    private fun loop() {
        val cloud = Cloud(applicationContext)
        stopListen = runCatching { cloud.listen(onPulse = { scope.launch { runQueued(cloud) } }, onState = {}) }.getOrNull()
        scope.launch {
            var n = 0
            while (true) {
                if (cloud.signedIn && cloud.paired) {
                    runQueued(cloud)
                    if (n % 4 == 0) beat(cloud)
                    if (n % 120 == 0) runCatching { Updater.check(applicationContext) }
                }
                n++; delay(15_000)
            }
        }
    }

    private suspend fun beat(cloud: Cloud) {
        val id = cloud.deviceId ?: return
        val version = runCatching { packageManager.getPackageInfo(packageName, 0).versionName }.getOrNull() ?: "?"
        runCatching {
            val info = JSONObject().put("summary", PhoneRemote.status(applicationContext)).put("at", Instant.now().toString()).put("version", version).put("connected", "service")
            cloud.update("devices", "id=eq.$id", JSONObject().put("last_seen", Instant.now().toString()).put("app_version", "android-$version").put("info", info))
        }
    }

    private suspend fun runQueued(cloud: Cloud) {
        val me = cloud.deviceId ?: return
        val list = runCatching { cloud.list("commands", "select=*&target_device=eq.$me&status=eq.queued&order=created_at.asc") }.getOrNull() ?: return
        for (i in 0 until list.length()) {
            val c = list.getJSONObject(i)
            val id = c.optString("id")
            if (!handled.add(id)) continue
            if (!runCatching { cloud.claim("commands", "id=eq.$id&status=eq.queued", JSONObject().put("status", "running")) }.getOrDefault(false)) continue
            val age = runCatching { java.time.Duration.between(java.time.OffsetDateTime.parse(c.optString("created_at")).toInstant(), Instant.now()).seconds }.getOrDefault(0L)
            val result = if (age > 600) "failed: too old (over 10 minutes), not run"
                else runCatching { PhoneRemote.run(applicationContext, c.optString("action"), c.optJSONObject("args") ?: JSONObject()) }.getOrElse { "failed: ${it.message}" }
            runCatching { cloud.update("commands", "id=eq.$id", JSONObject().put("status", if (result.startsWith("failed") || result.startsWith("Not understood")) "failed" else "done").put("result", result).put("done_at", Instant.now().toString())) }
        }
    }

    override fun onDestroy() { stopListen?.invoke(); scope.cancel(); super.onDestroy() }

    /** Phone restarted or the app was updated: connect again by itself. */
    class Boot : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) { if (Cloud(ctx).signedIn) start(ctx) }
    }
}
