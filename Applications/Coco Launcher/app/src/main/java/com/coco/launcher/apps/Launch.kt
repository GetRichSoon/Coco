package com.coco.launcher.apps

import android.app.ActivityOptions
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.LauncherApps
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.view.View
import android.widget.Toast

/**
 * Starting an app from a launcher fails in ordinary ways: the activity was removed by an update,
 * the package was disabled, the profile is locked. Every one of those is a toast, never a crash.
 */
object Launch {

    fun app(view: View, entry: AppEntry, bounds: Rect?) {
        val context = view.context
        val service = context.getSystemService(LauncherApps::class.java)
        val options = scaleUp(view, bounds)

        val started = runCatching {
            service?.startMainActivity(entry.component, Process.myUserHandle(), bounds, options)
            service != null
        }.getOrElse { false }
        if (started) return

        val fallback = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(entry.component)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            .apply { sourceBounds = bounds }
        if (runCatching { context.startActivity(fallback, options) }.isSuccess) return

        Toast.makeText(context, "Can't open " + entry.label, Toast.LENGTH_SHORT).show()
        AppRepository.reload()
    }

    fun appInfo(context: Context, component: ComponentName) {
        val service = context.getSystemService(LauncherApps::class.java)
        val shown = runCatching {
            service?.startAppDetailsActivity(component, Process.myUserHandle(), null, null)
            service != null
        }.getOrElse { false }
        if (shown) return

        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", component.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    fun uninstall(context: Context, component: ComponentName) {
        val intent = Intent(Intent.ACTION_DELETE)
            .setData(Uri.fromParts("package", component.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (runCatching { context.startActivity(intent) }.isFailure) appInfo(context, component)
    }

    /** Pixel-style expand: the new activity grows out of the icon that was actually touched. */
    private fun scaleUp(view: View, bounds: Rect?): Bundle? = runCatching {
        if (bounds == null) return@runCatching null
        val origin = IntArray(2).also { view.getLocationOnScreen(it) }
        ActivityOptions.makeScaleUpAnimation(
            view,
            bounds.left - origin[0],
            bounds.top - origin[1],
            bounds.width(),
            bounds.height(),
        ).toBundle()
    }.getOrNull()
}
