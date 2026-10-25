package com.goodspace.cocolounge.island.util

import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings

/** Hides the status bar icons the island does not need (clock and battery are never touched). Needs a one-time ADB grant. */
object StatusBarTools {
    const val GRANT_CMD = "adb shell pm grant com.goodspace.cocolounge android.permission.WRITE_SECURE_SETTINGS"
    const val RESET_CMD = "adb shell settings delete secure icon_blacklist"
    private const val KEY = "icon_blacklist"

    fun canWrite(c: Context) = c.checkSelfPermission("android.permission.WRITE_SECURE_SETTINGS") == PackageManager.PERMISSION_GRANTED

    fun isClean(c: Context): Boolean {
        val now = IconBlacklist.parse(Settings.Secure.getString(c.contentResolver, KEY)).toSet()
        return IconBlacklist.CLEAN.all { g -> g.slots.any { it in now } }
    }

    /** null = done, otherwise the reason in plain words. */
    fun setClean(c: Context, on: Boolean): String? {
        if (!canWrite(c)) return "Run the ADB command above once, then try again."
        return try {
            val cur = Settings.Secure.getString(c.contentResolver, KEY)
            val v = if (on) IconBlacklist.merge(cur, IconBlacklist.slotsFor(IconBlacklist.CLEAN)) else IconBlacklist.restore(cur)
            Settings.Secure.putString(c.contentResolver, KEY, v)
            null
        } catch (e: SecurityException) {
            "Android refused: ${e.message}"
        }
    }

    fun batteryPercent(c: Context) = Settings.System.getInt(c.contentResolver, "status_bar_show_battery_percent", 0) == 1

    fun setBatteryPercent(c: Context, on: Boolean): Boolean = runCatching {
        Settings.System.canWrite(c) && Settings.System.putInt(c.contentResolver, "status_bar_show_battery_percent", if (on) 1 else 0)
    }.getOrDefault(false)
}
