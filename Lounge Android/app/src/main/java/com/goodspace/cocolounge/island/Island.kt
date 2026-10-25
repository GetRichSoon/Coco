package com.goodspace.cocolounge.island

import android.content.ComponentName
import android.content.Context
import com.goodspace.cocolounge.island.runtime.IslandRuntime
import com.goodspace.cocolounge.island.runtime.MediaWatcher
import com.goodspace.cocolounge.island.service.IslandListener

/**
 * Coco Island lives inside the Coco app (Boss, 2026-10-25: one app, not two). The "Coco connected" service keeps the
 * process alive, so the island needs no notification of its own.
 */
object Island {
    /** The old separate app. While it is installed the phone would show two islands. */
    const val OLD_HALO = "com.novahq.novaisland"

    /** Starts the island if it is switched on and the overlay permission is there. Safe to call again and again. */
    fun boot(context: Context) {
        if (!IslandRuntime.isEnabled(context)) return
        if (IslandRuntime.ensure(context)) runCatching { MediaWatcher.start(context.applicationContext, ComponentName(context, IslandListener::class.java)) }
    }

    fun setOn(context: Context, on: Boolean) {
        IslandRuntime.setEnabled(context, on)
        if (on) boot(context) else IslandRuntime.shutdown(context)
    }

    fun oldHaloInstalled(context: Context): Boolean =
        runCatching { context.packageManager.getApplicationInfo(OLD_HALO, 0).enabled }.getOrDefault(false)
}
