package com.coco.launcher.apps

import android.content.Context
import android.content.pm.LauncherApps
import android.content.pm.ShortcutInfo
import android.os.Process
import android.os.UserHandle
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.Collator

/**
 * The installed-app list, kept current by LauncherApps callbacks rather than polling. One broken
 * package must never take the home screen down with it, so every entry is read defensively.
 */
object AppRepository {

    private const val TAG = "CocoApps"

    private val _apps = MutableStateFlow<List<AppEntry>>(emptyList())
    val apps: StateFlow<List<AppEntry>> = _apps.asStateFlow()

    private var launcherApps: LauncherApps? = null
    private var callback: LauncherApps.Callback? = null
    private var scope: CoroutineScope? = null

    fun start(context: Context, scope: CoroutineScope) {
        this.scope = scope
        if (callback == null) {
            val service = context.getSystemService(LauncherApps::class.java) ?: return
            launcherApps = service
            val cb = object : LauncherApps.Callback() {
                override fun onPackageAdded(packageName: String?, user: UserHandle?) = reload()
                override fun onPackageRemoved(packageName: String?, user: UserHandle?) = reload()
                override fun onPackageChanged(packageName: String?, user: UserHandle?) = reload()
                override fun onPackagesAvailable(p: Array<out String>?, u: UserHandle?, r: Boolean) = reload()
                override fun onPackagesUnavailable(p: Array<out String>?, u: UserHandle?, r: Boolean) = reload()
                override fun onShortcutsChanged(
                    packageName: String,
                    shortcuts: MutableList<ShortcutInfo>,
                    user: UserHandle,
                ) = Unit
            }
            callback = cb
            runCatching { service.registerCallback(cb) }
                .onFailure { Log.w(TAG, "registerCallback failed", it) }
        }
        reload()
    }

    fun stop() {
        val service = launcherApps
        val cb = callback
        if (service != null && cb != null) runCatching { service.unregisterCallback(cb) }
        callback = null
        launcherApps = null
        scope = null
    }

    fun reload() {
        val s = scope ?: return
        s.launch { _apps.value = load() }
    }

    private suspend fun load(): List<AppEntry> = withContext(Dispatchers.IO) {
        val service = launcherApps ?: return@withContext emptyList()
        val user = Process.myUserHandle()
        val raw = runCatching { service.getActivityList(null, user) }
            .onFailure { Log.w(TAG, "getActivityList failed", it) }
            .getOrNull()
            .orEmpty()

        val collator = Collator.getInstance().apply { strength = Collator.PRIMARY }
        raw.mapNotNull { info ->
            // A label can throw or come back blank on a half-installed or malformed package.
            val label = runCatching { info.label?.toString() }.getOrNull()?.trim()
            val name = if (label.isNullOrEmpty()) info.componentName.packageName else label
            runCatching { AppEntry(info, name) }.getOrNull()
        }
            .distinctBy { it.key }
            .sortedWith(compareBy(collator) { it.label })
    }

    fun find(key: String): AppEntry? = _apps.value.firstOrNull { it.key == key }
}
