package com.goodspace.cocolounge.island.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.SystemClock
import com.goodspace.cocolounge.R
import com.goodspace.cocolounge.island.Island
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.AlertKind
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.runtime.TorchWatch

/**
 * Test hook for the PC (USB debugging only): drives every island case on the real phone so each one can be checked
 * with a screenshot. Protected by the DUMP permission, which only the adb shell holds: no app on the phone can call it.
 *
 *   adb shell am broadcast -n com.goodspace.cocolounge/.island.service.IslandTestReceiver --es case <case>
 *
 * "real_*" cases post a REAL Android notification on the "coco_test" channel; the island's listener reads it exactly
 * like one from WhatsApp, the Phone app or Maps (full path: Android -> listener -> hub -> overlay).
 */
class IslandTestReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val case = i.getStringExtra("case") ?: return
        Island.boot(c)
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Coco Island tests", NotificationManager.IMPORTANCE_LOW))
        val now = SystemClock.elapsedRealtime()
        when (case) {
            // ---- real notifications through Android ----
            "real_call" -> nm.notify(ID_CALL, base(c, "Big Boss", "Incoming call").setCategory(Notification.CATEGORY_CALL).setOngoing(true)
                .addAction(Notification.Action.Builder(null, "Decline", pi(c, 1)).build())
                .addAction(Notification.Action.Builder(null, "Answer", pi(c, 2)).build())
                .also { it.extras.putInt("android.callType", 1) }.build())
            // Boss's bug: the phone app pops up its own banner (high importance) -> the island must stay the small pill.
            "real_call_banner" -> {
                nm.createNotificationChannel(NotificationChannel(CHANNEL_HIGH, "Coco Island tests (pop-up)", NotificationManager.IMPORTANCE_HIGH))
                nm.notify(ID_CALL, Notification.Builder(c, CHANNEL_HIGH).setSmallIcon(R.drawable.ic_coco_notify).setContentTitle("Big Boss").setContentText("Incoming call")
                    .setContentIntent(pi(c, 0)).setCategory(Notification.CATEGORY_CALL).setOngoing(true)
                    .addAction(Notification.Action.Builder(null, "Decline", pi(c, 1)).build())
                    .addAction(Notification.Action.Builder(null, "Answer", pi(c, 2)).build())
                    .also { it.extras.putInt("android.callType", 1) }.build())
            }
            "real_call_ongoing" -> nm.notify(ID_CALL, base(c, "Big Boss", "Ongoing call").setCategory(Notification.CATEGORY_CALL).setOngoing(true)
                .setUsesChronometer(true).setWhen(System.currentTimeMillis() - 42_000)
                .addAction(Notification.Action.Builder(null, "Speaker", pi(c, 3)).build())
                .addAction(Notification.Action.Builder(null, "Hang up", pi(c, 4)).build())
                .also { it.extras.putInt("android.callType", 2) }.build())
            "real_call_end" -> nm.cancel(ID_CALL)
            "real_nav" -> nm.notify(ID_NAV, base(c, "250 m", "Turn left onto MG Road").setCategory(Notification.CATEGORY_NAVIGATION).setOngoing(true)
                .setSubText("12 min · 3.4 km").setLargeIcon(arrow()).build())
            "real_nav_end" -> nm.cancel(ID_NAV)
            "real_recorder" -> nm.notify(ID_REC, base(c, "Recording", "Voice note").setOngoing(true).setUsesChronometer(true)
                .setWhen(System.currentTimeMillis() - 65_000).setChannelId(CHANNEL).build())
            "real_recorder_end" -> nm.cancel(ID_REC)
            "real_download" -> nm.notify(ID_DL, base(c, "Coco Lounge 2.8.0.apk", "Downloading").setCategory(Notification.CATEGORY_PROGRESS)
                .setOngoing(true).setProgress(100, i.getIntExtra("p", 40), false).build())
            "real_download_end" -> nm.cancel(ID_DL)
            "real_clear" -> listOf(ID_CALL, ID_NAV, ID_REC, ID_DL).forEach { nm.cancel(it) }

            // ---- island states set directly ----
            "stopwatch" -> IslandHub.startStopwatch()
            "stopwatch_lap" -> IslandHub.lapStopwatch()
            "stopwatch_pause" -> IslandHub.toggleStopwatch()
            "timer" -> IslandHub.startTimer(i.getIntExtra("s", 300) * 1000L)
            "torch_on" -> TorchWatch.set(c, true)
            "torch_off" -> TorchWatch.set(c, false)
            "meeting" -> System.currentTimeMillis().let { t ->
                IslandHub.put(EventLive(-1L, "Coco weekly review", t + 8 * 60_000L, t + 38 * 60_000L, "", "https://meet.google.com/"), 60_000)
            }
            "earbuds" -> IslandHub.alert(AlertLive(AlertKind.Headphones, "Earbuds", "Connected · 82%", 82), 6000)
            "silent" -> IslandHub.alert(AlertLive(AlertKind.Silent, "Silent", "Silent mode on"), 6000)
            "charge" -> IslandHub.showCharge(i.getIntExtra("p", 64), true, 8000)
            "low" -> IslandHub.showCharge(12, false, 8000)
            "coco_yes" -> IslandHub.put(NoteLive("coco:test", "Coco", "Needs your YES: A-099", "Publish the new Short", null, null, emptyList(), false,
                pkg = c.packageName, live = true, progress = -3), 60_000)
            "message" -> IslandHub.notify(ReplyTestReceiver.sample(c, now))
            "expand" -> IslandHub.expand(i.getStringExtra("id"))
            "collapse" -> IslandHub.collapse()
            "menu" -> IslandHub.openMenu()
            "nudge" -> IslandHub.nudge()
            "clear" -> {
                listOf(ID_CALL, ID_NAV, ID_REC, ID_DL).forEach { nm.cancel(it) }
                IslandHub.live.value.keys.toList().forEach { IslandHub.remove(it) }
                TorchWatch.set(c, false)
            }
        }
        resultData = "ok $case · live: " + IslandHub.live.value.keys.joinToString(",")
    }

    private fun base(c: Context, title: String, text: String) = Notification.Builder(c, CHANNEL)
        .setSmallIcon(R.drawable.ic_coco_notify).setContentTitle(title).setContentText(text)
        .setContentIntent(pi(c, 0))

    private fun pi(c: Context, code: Int) = PendingIntent.getBroadcast(
        c, 900 + code, Intent(c, ReplyTestReceiver::class.java).setAction("coco.test.island.$code"), PendingIntent.FLAG_IMMUTABLE,
    )

    /** A white turn-left arrow, like the one Maps draws for its notification. */
    private fun arrow(): Bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888).also { b ->
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.STROKE; strokeWidth = 12f; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
        val path = Path().apply { moveTo(64f, 84f); lineTo(64f, 44f); quadTo(64f, 32f, 52f, 32f); lineTo(24f, 32f) }
        Canvas(b).apply {
            drawPath(path, p)
            drawPath(Path().apply { moveTo(38f, 16f); lineTo(22f, 32f); lineTo(38f, 48f) }, p)
        }
    }

    companion object {
        const val CHANNEL = "coco_test"
        const val CHANNEL_HIGH = "coco_test_popup"
        private const val ID_CALL = 7701
        private const val ID_NAV = 7702
        private const val ID_REC = 7703
        private const val ID_DL = 7704
    }
}
