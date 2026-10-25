package com.goodspace.cocolounge.island.runtime

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.CalendarRules
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.model.TorchLive
import com.goodspace.cocolounge.island.util.Haptics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Torch: whoever switches it on (quick settings, camera app, Coco), the island shows a pill; a tap switches it off. */
object TorchWatch {
    private var callback: CameraManager.TorchCallback? = null
    private var torchId: String? = null

    fun start(app: Context) {
        if (callback != null) return
        val cm = app.getSystemService(CameraManager::class.java) ?: return
        torchId = runCatching {
            cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
        }.getOrNull()
        val cb = object : CameraManager.TorchCallback() {
            override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                if (cameraId != torchId) return
                if (enabled && IslandRuntime.pref(app, IslandRuntime.KEY_ALERTS, true)) IslandHub.put(TorchLive()) else IslandHub.remove("torch")
            }
        }
        runCatching { cm.registerTorchCallback(cb, Handler(Looper.getMainLooper())) }
        callback = cb
    }

    fun stop(app: Context) {
        callback?.let { cb -> runCatching { app.getSystemService(CameraManager::class.java)?.unregisterTorchCallback(cb) } }
        callback = null
        IslandHub.remove("torch")
    }

    /** No camera permission is needed to switch the torch. Returns false when this phone has no torch. */
    fun set(context: Context, on: Boolean): Boolean {
        val cm = context.getSystemService(CameraManager::class.java) ?: return false
        val id = torchId ?: runCatching {
            cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
        }.getOrNull()?.also { torchId = it } ?: return false
        return runCatching { cm.setTorchMode(id, on) }.isSuccess
    }

    fun isOn(): Boolean = IslandHub.live.value["torch"] != null
}

/**
 * Meetings: every 30 seconds while the screen is on, the next calendar event that starts within 10 minutes becomes a
 * pill ("in 8 min"), with a Join button when the invite has a Meet, Zoom or Teams link. Needs the calendar permission,
 * which the founder grants on the Island page. Nothing leaves the phone.
 */
object EventWatch {
    private var job: Job? = null
    private var announced = -1L
    /** The meeting this watcher put on the island; it only ever removes that one (never a pill someone else showed). */
    private var shown: Long? = null

    private fun clearOwn() {
        val cur = IslandHub.live.value["event"] as? EventLive
        if (cur != null && cur.eventId == shown) IslandHub.remove("event")
        shown = null
    }

    fun start(app: Context) {
        if (job != null) return
        job = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate).launch {
            while (true) {
                if (IslandHub.screenOn.value) runCatching { refresh(app) }
                delay(30_000)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
        clearOwn()
    }

    fun granted(context: Context) =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED

    suspend fun refresh(app: Context) {
        if (!IslandRuntime.pref(app, IslandRuntime.KEY_MEETINGS, true) || !granted(app)) { clearOwn(); return }
        val now = System.currentTimeMillis()
        val list = withContext(Dispatchers.IO) { query(app, now - CalendarRules.GRACE_MS - 60_000L, now + CalendarRules.LEAD_MS + 60_000L) }
        val ev = CalendarRules.pick(list, now, IslandHub.dismissedEvents)
        if (ev == null) { clearOwn(); return }
        val next = EventLive(ev.id, ev.title, ev.begin, ev.end, ev.location, CalendarRules.joinUrl(ev.location, ev.description))
        if (IslandHub.live.value["event"] != next) IslandHub.put(next)
        shown = ev.id
        if (announced != ev.id) { announced = ev.id; Haptics.arrive(app) }
    }

    private fun query(app: Context, from: Long, to: Long): List<CalendarRules.Ev> {
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            ContentUris.appendId(it, from)
            ContentUris.appendId(it, to)
        }.build()
        val cols = arrayOf(
            CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END, CalendarContract.Instances.EVENT_LOCATION, CalendarContract.Instances.DESCRIPTION,
            CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.SELF_ATTENDEE_STATUS,
        )
        val out = ArrayList<CalendarRules.Ev>()
        app.contentResolver.query(uri, cols, null, null, CalendarContract.Instances.BEGIN + " ASC")?.use { c ->
            while (c.moveToNext()) {
                if (c.getInt(7) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue
                out += CalendarRules.Ev(
                    id = c.getLong(0), title = c.getString(1).orEmpty(), begin = c.getLong(2), end = c.getLong(3),
                    location = c.getString(4).orEmpty(), description = c.getString(5).orEmpty(), allDay = c.getInt(6) == 1,
                )
            }
        }
        return out
    }
}
