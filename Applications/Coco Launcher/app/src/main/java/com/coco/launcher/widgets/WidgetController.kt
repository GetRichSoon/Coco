package com.coco.launcher.widgets

import android.app.Activity
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts

/**
 * The real AppWidget framework, not a copy of it: one AppWidgetHost for the launcher process, the
 * documented allocate - bind - configure sequence, and an id that is released again whenever any
 * step is refused. A leaked id leaves a dead widget the user cannot remove.
 */
class WidgetController(private val activity: ComponentActivity) {

    private val host = AppWidgetHost(activity, HOST_ID)
    private val manager: AppWidgetManager? = runCatching { AppWidgetManager.getInstance(activity) }.getOrNull()

    /** Called once a widget is bound, configured and ready to be placed on the home grid. */
    var onWidgetReady: ((Int, AppWidgetProviderInfo) -> Unit)? = null

    private var pendingId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var pendingProvider: AppWidgetProviderInfo? = null

    private val bindLauncher: ActivityResultLauncher<Intent> =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val provider = pendingProvider
            if (result.resultCode == Activity.RESULT_OK && provider != null) {
                configureOrFinish(pendingId, provider)
            } else {
                abandonPending()
            }
        }

    fun startListening() {
        runCatching { host.startListening() }.onFailure { Log.w(TAG, "startListening failed", it) }
    }

    fun stopListening() {
        runCatching { host.stopListening() }.onFailure { Log.w(TAG, "stopListening failed", it) }
    }

    fun providers(): List<AppWidgetProviderInfo> =
        runCatching { manager?.installedProviders.orEmpty() }
            .getOrElse { emptyList() }
            .filter { it.provider != null }
            .sortedBy { runCatching { it.loadLabel(activity.packageManager) }.getOrNull().orEmpty().lowercase() }

    fun add(provider: AppWidgetProviderInfo) {
        val widgetManager = manager
        if (widgetManager == null) {
            Toast.makeText(activity, "Widgets are unavailable on this device", Toast.LENGTH_SHORT).show()
            return
        }
        val id = runCatching { host.allocateAppWidgetId() }.getOrNull()
        if (id == null || id == AppWidgetManager.INVALID_APPWIDGET_ID) {
            Toast.makeText(activity, "Couldn't add that widget", Toast.LENGTH_SHORT).show()
            return
        }
        pendingId = id
        pendingProvider = provider

        val allowed = runCatching {
            widgetManager.bindAppWidgetIdIfAllowed(id, provider.provider)
        }.getOrElse { false }

        if (allowed) {
            configureOrFinish(id, provider)
            return
        }

        // Not the default home app yet, so binding needs the user's confirmation.
        val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER, provider.provider)
        if (runCatching { bindLauncher.launch(intent) }.isFailure) {
            abandonPending()
            Toast.makeText(activity, "This device won't allow adding that widget", Toast.LENGTH_SHORT).show()
        }
    }

    private fun configureOrFinish(id: Int, provider: AppWidgetProviderInfo) {
        if (provider.configure != null) {
            val launched = runCatching {
                host.startAppWidgetConfigureActivityForResult(activity, id, 0, REQUEST_CONFIGURE, null)
                true
            }.getOrElse { false }
            if (launched) return
            // Some OEM widgets declare a configure activity that refuses to start. Their defaults
            // are usually fine, so keep the widget rather than dropping it on the floor.
            Log.w(TAG, "configure activity refused for " + provider.provider)
        }
        finishPending(id, provider)
    }

    /** Forwarded from the activity: the configure screen uses the classic result path. */
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CONFIGURE) return
        val id = data?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, pendingId) ?: pendingId
        val provider = pendingProvider
        if (resultCode == Activity.RESULT_OK && provider != null) {
            finishPending(id, provider)
        } else {
            abandonPending()
        }
    }

    private fun finishPending(id: Int, provider: AppWidgetProviderInfo) {
        pendingId = AppWidgetManager.INVALID_APPWIDGET_ID
        pendingProvider = null
        onWidgetReady?.invoke(id, provider)
    }

    private fun abandonPending() {
        if (pendingId != AppWidgetManager.INVALID_APPWIDGET_ID) delete(pendingId)
        pendingId = AppWidgetManager.INVALID_APPWIDGET_ID
        pendingProvider = null
    }

    fun delete(id: Int) {
        runCatching { host.deleteAppWidgetId(id) }.onFailure { Log.w(TAG, "deleteAppWidgetId failed", it) }
    }

    fun providerFor(id: Int): AppWidgetProviderInfo? =
        runCatching { manager?.getAppWidgetInfo(id) }.getOrNull()

    /**
     * A host view for an id that still exists. Returns null when the widget's app was uninstalled
     * while the launcher was not running, which is how a stale entry gets cleaned up instead of
     * throwing on the first frame.
     */
    fun createView(context: Context, id: Int): AppWidgetHostView? {
        val provider = providerFor(id) ?: return null
        return runCatching { host.createView(context, id, provider) }
            .onFailure { Log.w(TAG, "createView failed for " + id, it) }
            .getOrNull()
    }

    fun resize(view: AppWidgetHostView, widthDp: Int, heightDp: Int) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                view.updateAppWidgetSize(Bundle.EMPTY, listOf(SizeF(widthDp.toFloat(), heightDp.toFloat())))
            } else {
                @Suppress("DEPRECATION")
                view.updateAppWidgetSize(Bundle.EMPTY, widthDp, heightDp, widthDp, heightDp)
            }
        }
    }

    companion object {
        private const val TAG = "CocoWidgets"
        private const val HOST_ID = 0x0C0C0
        const val REQUEST_CONFIGURE = 0x1C0
    }
}
