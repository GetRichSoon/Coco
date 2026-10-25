package com.goodspace.cocolounge.island.runtime

import android.Manifest
import android.app.NotificationManager
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.AlertKind
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.util.ReducedMotion

/** Process-wide wiring: one overlay host, one set of system receivers. Safe to call `ensure` repeatedly. */
object IslandRuntime {
    const val KEY_NOTES = "notes"
    const val KEY_HIDE_ORIGINALS = "hide_originals"
    const val KEY_LOWERED = "lowered"
    const val KEY_ALERTS = "alerts"
    const val KEY_MATERIAL_YOU = "material_you"
    const val KEY_MEETINGS = "meetings"
    const val KEY_BIG_CALL = "big_call_card"

    /** Show the island's big call card even when the phone app pops up its own banner (two cards). Off by default. */
    @Volatile var bigCallCard = false
    private const val KEY_SIZE = "size"

    /** Island size steps: Standard (the 1.1 size), Large, Extra large. */
    val SIZES = listOf(1f, 1.15f, 1.3f)
    val SIZE_NAMES = listOf("Standard", "Large", "Extra large")
    const val DEFAULT_SIZE = 0

    private const val ACTION_BT_BATTERY = "android.bluetooth.device.action.BATTERY_LEVEL_CHANGED"
    private const val EXTRA_BT_BATTERY = "android.bluetooth.device.extra.BATTERY_LEVEL"

    private var host: IslandHost? = null
    private var receiver: BroadcastReceiver? = null
    private var lastCharging: Boolean? = null
    private var lowShown = false
    private var lastRinger: Int? = null
    private var lastHeadphones: String? = null

    private fun prefs(context: Context) = context.getSharedPreferences("coco_island", Context.MODE_PRIVATE)

    fun isEnabled(context: Context): Boolean = prefs(context).getBoolean("enabled", true)

    fun setEnabled(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean("enabled", on).apply()
    }

    fun pref(context: Context, key: String, default: Boolean): Boolean = prefs(context).getBoolean(key, default)

    fun setPref(context: Context, key: String, on: Boolean) {
        prefs(context).edit().putBoolean(key, on).apply()
        if (key == KEY_MATERIAL_YOU) IslandHub.materialYou.value = on
        if (key == KEY_BIG_CALL) bigCallCard = on
        if (key == KEY_LOWERED) IslandHub.lowered.value = on
    }

    /** Saved on this phone only, so Boss's OnePlus and Big Boss's Realme each keep their own fit. */
    fun setFit(context: Context, width: Int, y: Int) {
        prefs(context).edit().putInt("fit_w", width).putInt("fit_y", y).apply()
        IslandHub.fitWidth.value = width
        IslandHub.fitY.value = y
    }

    fun rememberCallApp(context: Context, pkg: String, channel: String?) {
        val p = prefs(context)
        if (p.getString("call_pkg", null) != pkg || p.getString("call_channel", null) != channel) p.edit().putString("call_pkg", pkg).putString("call_channel", channel).apply()
    }

    /** The phone app that rang last and its call channel; before the first call, the phone's default dialer. */
    fun callApp(context: Context): Pair<String, String?>? {
        val p = prefs(context)
        p.getString("call_pkg", null)?.let { return it to p.getString("call_channel", null) }
        val dialer = runCatching { context.getSystemService(android.telecom.TelecomManager::class.java)?.defaultDialerPackage }.getOrNull() ?: return null
        // Google Phone and the stock Android dialer ring on this channel (checked on the Nord CE 2 with dumpsys, 2026-10-25).
        return dialer to (if (dialer == "com.google.android.dialer" || dialer == "com.android.dialer") "phone_incoming_call" else null)
    }

    fun sizeStep(context: Context): Int = prefs(context).getInt(KEY_SIZE, DEFAULT_SIZE).coerceIn(0, SIZES.lastIndex)

    fun setSizeStep(context: Context, step: Int) {
        prefs(context).edit().putInt(KEY_SIZE, step).apply()
        IslandHub.scale.value = SIZES[step.coerceIn(0, SIZES.lastIndex)]
    }

    fun ensure(context: Context): Boolean {
        val app = context.applicationContext
        IslandHub.init(app)
        // 1.4.0 (Boss, 2026-10-22): exact iPhone behaviour. Messages leave the island and are never removed from the shade.
        if (!prefs(app).getBoolean("iphone_defaults", false)) prefs(app).edit().putBoolean(KEY_NOTES, false).putBoolean(KEY_HIDE_ORIGINALS, false).putBoolean("iphone_defaults", true).apply()
        // Boss chose the iPhone place: in the status bar line, not lowered (2026-10-22).
        if (!prefs(app).getBoolean("iphone_place3", false)) prefs(app).edit().putBoolean(KEY_LOWERED, false).putInt(KEY_SIZE, 0).putBoolean(KEY_MATERIAL_YOU, false).putBoolean("iphone_place3", true).apply()
        // Boss, 2026-10-25: "a little bit bigger" -> Large (taller pill, bigger text and icons; the width still stops
        // before the clock and the Wi-Fi icon). Once; any size chosen later on the Island page wins.
        if (!prefs(app).getBoolean("bigger_2026_10_25", false)) prefs(app).edit().putInt(KEY_SIZE, 1).putBoolean("bigger_2026_10_25", true).apply()
        if (!Settings.canDrawOverlays(app)) return false
        IslandHub.reduced.value = ReducedMotion.enabled(app)
        IslandHub.scale.value = SIZES[sizeStep(app)]
        IslandHub.materialYou.value = pref(app, KEY_MATERIAL_YOU, false)
        IslandHub.lowered.value = pref(app, KEY_LOWERED, false)
        IslandHub.fitWidth.value = prefs(app).getInt("fit_w", 0)
        IslandHub.fitY.value = prefs(app).getInt("fit_y", 0)
        bigCallCard = pref(app, KEY_BIG_CALL, false)
        register(app)
        if (host == null) host = (com.goodspace.cocolounge.island.service.IslandAccessibility.instance?.let { IslandHost(it, android.view.WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY) } ?: IslandHost(app)).also { it.attach() }
        return true
    }

    /** The accessibility service is on: move the island into its window, above the status bar. */
    fun attachAbove(service: android.accessibilityservice.AccessibilityService) {
        IslandHub.init(service.applicationContext)
        if (!isEnabled(service)) return
        host?.detach()
        host = IslandHost(service, android.view.WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY).also { it.attach() }
        register(service.applicationContext)
    }

    /** The service was switched off: back to the normal overlay (under the status bar). */
    fun detachAbove(context: Context) {
        host?.detach()
        host = null
        ensure(context)
    }

    fun shutdown(context: Context) {
        val app = context.applicationContext
        host?.detach()
        host = null
        receiver?.let { runCatching { app.unregisterReceiver(it) } }
        receiver = null
        lastRinger = null
        MediaWatcher.stop()
        TorchWatch.stop(app)
        EventWatch.stop()
    }

    private fun canBluetooth(app: Context) =
        Build.VERSION.SDK_INT < 31 || ContextCompat.checkSelfPermission(app, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun register(app: Context) {
        if (receiver != null) return
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    Intent.ACTION_SCREEN_OFF -> IslandHub.screenOn.value = false
                    Intent.ACTION_SCREEN_ON -> {
                        IslandHub.screenOn.value = true
                        IslandHub.reduced.value = ReducedMotion.enabled(context)
                    }
                    Intent.ACTION_BATTERY_CHANGED -> battery(intent)
                    AudioManager.RINGER_MODE_CHANGED_ACTION -> ringer(context, intent)
                    NotificationManager.ACTION_INTERRUPTION_FILTER_CHANGED -> focus(context)
                    BluetoothDevice.ACTION_ACL_CONNECTED -> headphones(context, intent, true)
                    BluetoothDevice.ACTION_ACL_DISCONNECTED -> headphones(context, intent, false)
                    ACTION_BT_BATTERY -> headphoneBattery(context, intent)
                }
            }
        }
        val f = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_BATTERY_CHANGED)
            addAction(AudioManager.RINGER_MODE_CHANGED_ACTION)
            addAction(NotificationManager.ACTION_INTERRUPTION_FILTER_CHANGED)
            if (canBluetooth(app)) {
                addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
                addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
                addAction(ACTION_BT_BATTERY)
            }
        }
        if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(r, f, Context.RECEIVER_EXPORTED) else app.registerReceiver(r, f)
        receiver = r
        TorchWatch.start(app)
        EventWatch.start(app)
    }

    /** Re-register so a Bluetooth permission granted later starts working without a restart. */
    fun refreshReceivers(context: Context) {
        val app = context.applicationContext
        receiver?.let { runCatching { app.unregisterReceiver(it) } }
        receiver = null
        lastRinger = null
        if (host != null) register(app)
    }

    /** Show the battery for a few seconds when the cable is plugged or unplugged, and once when it gets low. */
    private fun battery(i: Intent) {
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        if (level < 0 || scale <= 0) return
        val percent = level * 100 / scale
        val status = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        val previous = lastCharging
        lastCharging = charging
        when {
            previous != null && previous != charging -> IslandHub.showCharge(percent, charging)
            !charging && percent <= 15 && !lowShown -> { lowShown = true; IslandHub.showCharge(percent, false, 8000) }
            else -> IslandHub.updateChargeIfShown(percent, charging)
        }
        if (percent > 20 || charging) lowShown = false
    }

    /** iPhone silent switch moment: Silent (red), Vibrate, Ring. The first (sticky) broadcast only records the mode. */
    private fun ringer(context: Context, i: Intent) {
        val mode = i.getIntExtra(AudioManager.EXTRA_RINGER_MODE, -1)
        val prev = lastRinger
        lastRinger = mode
        if (prev == null || prev == mode || !pref(context, KEY_ALERTS, true)) return
        val a = when (mode) {
            AudioManager.RINGER_MODE_SILENT -> AlertLive(AlertKind.Silent, "Silent", "Silent mode on")
            AudioManager.RINGER_MODE_VIBRATE -> AlertLive(AlertKind.Vibrate, "Vibrate", "Vibrate only")
            AudioManager.RINGER_MODE_NORMAL -> AlertLive(AlertKind.Ring, "Ring", "Ringer on")
            else -> return
        }
        IslandHub.alert(a)
    }

    private fun focus(context: Context) {
        if (!pref(context, KEY_ALERTS, true)) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        val on = nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL
        IslandHub.alert(if (on) AlertLive(AlertKind.FocusOn, "Focus", "Do Not Disturb on") else AlertLive(AlertKind.FocusOff, "Focus off", "Do Not Disturb off"))
    }

    @Suppress("DEPRECATION", "MissingPermission")
    private fun device(i: Intent): BluetoothDevice? =
        if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        else i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)

    @Suppress("MissingPermission")
    private fun headphones(context: Context, i: Intent, connected: Boolean) {
        if (!pref(context, KEY_ALERTS, true) || !canBluetooth(context)) return
        val d = device(i) ?: return
        val major = runCatching { d.bluetoothClass?.majorDeviceClass }.getOrNull()
        if (major != null && major != BluetoothClass.Device.Major.AUDIO_VIDEO && major != BluetoothClass.Device.Major.WEARABLE) return
        val name = runCatching { (if (Build.VERSION.SDK_INT >= 30) d.alias else null) ?: d.name }.getOrNull()?.takeIf { it.isNotBlank() } ?: "Headphones"
        lastHeadphones = if (connected) d.address else null
        // Like AirPods on iPhone: the earbuds' battery ring right away when the phone already knows it (hidden API on
        // many phones; the BATTERY_LEVEL_CHANGED broadcast below fills it in when it does not).
        val level = if (connected) runCatching { d.javaClass.getMethod("getBatteryLevel").invoke(d) as Int }.getOrDefault(-1).takeIf { it in 0..100 } ?: -1 else -1
        IslandHub.alert(
            if (connected) AlertLive(AlertKind.Headphones, name, if (level >= 0) "Connected · $level%" else "Connected", level)
            else AlertLive(AlertKind.HeadphonesOff, name, "Disconnected"),
            forMs = 4000,
        )
    }

    @Suppress("MissingPermission")
    private fun headphoneBattery(context: Context, i: Intent) {
        val d = device(i) ?: return
        if (d.address != lastHeadphones) return
        val level = i.getIntExtra(EXTRA_BT_BATTERY, -1)
        if (level < 0) return
        val name = runCatching { (if (Build.VERSION.SDK_INT >= 30) d.alias else null) ?: d.name }.getOrNull()?.takeIf { it.isNotBlank() } ?: "Headphones"
        IslandHub.updateAlertIfShown(AlertLive(AlertKind.Headphones, name, "Connected · $level%", level.coerceIn(0, 100)))
    }
}
