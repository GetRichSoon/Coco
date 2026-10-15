package com.goodspace.cocolounge

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Same notifications as every Lounge: new approval, task done, Coco merged a task, task or rule from the other founder. */
object Alerts {
    private const val CHANNEL = "coco_lounge"

    fun setup(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Good Space", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Approvals, finished work, merged tasks and new rules" })
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("coco-watch", ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<Watch>(15, TimeUnit.MINUTES).build())
    }

    private fun allowed(context: Context, kind: String) = context.getSharedPreferences("coco_settings", Context.MODE_PRIVATE).getBoolean("n_$kind", true)

    fun post(context: Context, id: Int, title: String, text: String, kind: String = "other") {
        if (!allowed(context, kind)) return
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_coco_face).setColor(0xFFB83A12.toInt())
            .setContentTitle(title).setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).build()
        NotificationManagerCompat.from(context).notify(id, n)
    }

    /** Compares what was on screen with what the cloud says now and tells the founder only about other people's changes. */
    fun compareAndNotify(context: Context, old: Lounge.Data, new: Lounge.Data, me: String) {
        if (old.houses.isEmpty()) { remember(context, new); return }
        val oldWaiting = old.approvals.filter { it.optString("state") == "waiting" }.map { it.optString("id") }.toSet()
        new.approvals.filter { it.optString("state") == "waiting" && it.optString("id") !in oldWaiting }
            .forEach { post(context, it.optString("id").hashCode(), "Needs your YES: ${it.optString("code")}", it.optString("what").take(140), "approvals") }
        val oldDone = old.tasks.filter { it.optString("status") == "done" }.map { it.optString("id") }.toSet()
        new.tasks.filter { it.optString("status") == "done" && it.optString("id") !in oldDone }
            .forEach { post(context, it.optString("id").hashCode(), "Done: ${it.optString("title")}", it.optString("result").ifBlank { "Finished" }, "done") }
        val lastSeen = old.activity.maxOfOrNull { it.optLong("id") } ?: 0
        new.activity.filter { it.optLong("id") > lastSeen && it.optString("actor") != me }.forEach { a ->
            val detail = a.optString("detail")
            when (a.optString("action")) {
                "rule set" -> post(context, a.optLong("id").toInt(), "${a.optString("actor")} set a new rule", detail, "rules")
                "merged" -> post(context, a.optLong("id").toInt(), "Coco merged a task", detail, "merged")
                "task added" -> post(context, a.optLong("id").toInt(), "${a.optString("actor")} gave a task", detail, "tasks")
                "update" -> post(context, a.optLong("id").toInt(), detail.substringBefore(" | "), detail.substringAfter(" | ", ""), "updates")
            }
        }
        remember(context, new)
    }

    private fun remember(context: Context, d: Lounge.Data) {
        context.getSharedPreferences("coco_watch", Context.MODE_PRIVATE).edit()
            .putString("waiting", d.approvals.filter { it.optString("state") == "waiting" }.joinToString(",") { it.optString("id") })
            .putLong("activity", d.activity.maxOfOrNull { it.optLong("id") } ?: 0).apply()
    }

    /** Every 15 minutes, even when the app is closed: checks Coco Cloud for anything new. */
    class Watch(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
        override suspend fun doWork(): Result {
            val cloud = Cloud(applicationContext)
            if (!cloud.signedIn || !cloud.paired) return Result.success()
            return try {
                val prefs = applicationContext.getSharedPreferences("coco_watch", Context.MODE_PRIVATE)
                val known = prefs.getString("waiting", "").orEmpty().split(",").toSet()
                val lastAct = prefs.getLong("activity", 0)
                val me = cloud.list("founders").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.firstOrNull { it.optString("email").equals(cloud.email, true) }?.optString("name").orEmpty()
                val waiting = cloud.list("approvals", "select=id,code,what&state=eq.waiting").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
                waiting.filter { it.optString("id") !in known }.forEach { post(applicationContext, it.optString("id").hashCode(), "Needs your YES: ${it.optString("code")}", it.optString("what").take(140), "approvals") }
                val act = cloud.list("activity", "select=*&id=gt.$lastAct&order=id.asc").let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
                act.filter { it.optString("actor") != me && it.optString("action") in setOf("rule set", "merged", "task added", "update") }.forEach { a: JSONObject ->
                    val title = when (a.optString("action")) { "rule set" -> "${a.optString("actor")} set a new rule"; "merged" -> "Coco merged a task"; "update" -> a.optString("detail").substringBefore(" | "); else -> "${a.optString("actor")} gave a task" }
                    post(applicationContext, a.optLong("id").toInt(), title, a.optString("detail"))
                }
                prefs.edit().putString("waiting", waiting.joinToString(",") { it.optString("id") }).putLong("activity", act.maxOfOrNull { it.optLong("id") } ?: lastAct).apply()
                Result.success()
            } catch (e: Exception) { Result.retry() }
        }
    }
}
