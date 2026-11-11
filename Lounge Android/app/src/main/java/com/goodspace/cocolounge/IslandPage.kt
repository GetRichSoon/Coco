@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.goodspace.cocolounge.island.Island
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.AlertKind
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.model.NavLive
import com.goodspace.cocolounge.island.model.NoteAction
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.runtime.IslandRuntime
import com.goodspace.cocolounge.island.runtime.TorchWatch
import com.goodspace.cocolounge.island.service.IslandAccessibility
import com.goodspace.cocolounge.island.service.ReplyTestReceiver
import com.goodspace.cocolounge.island.util.StatusBarTools

/** More > Island: Coco Island lives inside the Coco app (Boss, 2026-10-25). Same choices the old Coco Halo app had, plus more. */
fun LazyListScope.islandPage() {
    item(key = "island-page") { IslandPage() }
}

@Composable
private fun IslandPage() {
    val ctx = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) tick++ }
        owner.lifecycle.addObserver(obs)
        onDispose { owner.lifecycle.removeObserver(obs) }
    }
    val overlayOk = tick >= 0 && Settings.canDrawOverlays(ctx)
    val listenerOk = tick >= 0 && NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
    val aboveOk = tick >= 0 && run {
        val me = ComponentName(ctx, IslandAccessibility::class.java).flattenToString()
        Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty().split(':').any { it.equals(me, true) }
    }
    val btOk = tick >= 0 && (Build.VERSION.SDK_INT < 31 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED)
    val calOk = tick >= 0 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED
    val oldHalo = tick >= 0 && Island.oldHaloInstalled(ctx)
    var on by remember { mutableStateOf(IslandRuntime.isEnabled(ctx)) }
    LaunchedEffect(overlayOk, on) { if (overlayOk && on) Island.boot(ctx) }
    val askBt = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> tick++; if (ok) IslandRuntime.refreshReceivers(ctx) }
    val askCal = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    fun ready(): Boolean {
        if (!IslandRuntime.ensure(ctx)) { android.widget.Toast.makeText(ctx, "Allow \"Display over other apps\" first", android.widget.Toast.LENGTH_SHORT).show(); return false }
        return true
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (oldHalo) Card(alert = true) {
            Eyebrow("Two islands", MaterialTheme.colorScheme.onErrorContainer)
            Text("The old Coco Halo app is still on this phone", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onErrorContainer)
            Text("The island now lives inside Coco. Remove the old app so only one island shows.", color = MaterialTheme.colorScheme.onErrorContainer)
            MuButton({ ctx.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:" + Island.OLD_HALO))) }) { Text("Remove old app") }
        }

        // Hero with a living preview of the pill
        PanelSurface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(32.dp)) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                IslandPreview()
                Text("Coco Island", style = MaterialTheme.typography.displaySmall)
                Text("Music, calls, timers, maps, meetings, earbuds, torch and Coco's own YES pills, right at the camera.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (on) "Island is on" else "Island is off", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                    Switch(on, { v ->
                        if (v && !overlayOk) { android.widget.Toast.makeText(ctx, "Allow \"Display over other apps\" first", android.widget.Toast.LENGTH_SHORT).show(); return@Switch }
                        Island.setOn(ctx, v); on = v
                    })
                }
            }
        }

        CallTwiceCard(tick)

        Section("Set up")
        Card {
            Step("Display over other apps", "Lets the island sit above every app", overlayOk) {
                ctx.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx.packageName)))
            }
            Step("Above the status bar", "Accessibility: \"Coco Island\" on. Then the pill can be tapped and covers the icons under it. It reads nothing on screen.", aboveOk) {
                ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
            Step("Notification access", "Calls, music, maps, downloads, recorders and Coco's own alerts", listenerOk) {
                ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
            if (!listenerOk || !aboveOk) {
                Muted("Android says \"Restricted setting\"? Open App info, tap the three dots at the top right, choose \"Allow restricted settings\", then come back.")
                MuOutlined({ ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))) }) { Text("Open App info") }
            }
            if (Build.VERSION.SDK_INT >= 31) Step("Nearby devices (optional)", "Earbuds connect moment with the battery ring", btOk) { askBt.launch(Manifest.permission.BLUETOOTH_CONNECT) }
            Step("Calendar (optional)", "Meeting pill 10 minutes before, with a Join button", calOk) { askCal.launch(Manifest.permission.READ_CALENDAR) }
        }

        Section("Quick")
        Card {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MuTonal({ if (ready()) IslandHub.startStopwatch() }) { Text("Stopwatch") }
                listOf(1, 5, 25).forEach { m -> MuTonal({ if (ready()) IslandHub.startTimer(m * 60_000L) }) { Text(if (m == 25) "Focus 25" else "$m min timer") } }
                MuTonal({ if (ready()) TorchWatch.set(ctx, !TorchWatch.isOn()) }) { Text("Torch") }
            }
        }

        Section("Look")
        Card {
            var step by remember { mutableIntStateOf(IslandRuntime.sizeStep(ctx)) }
            Eyebrow("Size")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                IslandRuntime.SIZE_NAMES.forEachIndexed { i, name ->
                    SegmentedButton(step == i, { step = i; IslandRuntime.setSizeStep(ctx, i) }, SegmentedButtonDefaults.itemShape(i, IslandRuntime.SIZE_NAMES.size), colors = segmentedColors()) { Text(name, maxLines = 1) }
                }
            }
            PrefRow("Material You colours", "A deep tonal colour from your wallpaper. Off = the classic black iPhone pill", IslandRuntime.KEY_MATERIAL_YOU, false)
            PrefRow("Lower the island", "Sits just below the status bar and covers nothing", IslandRuntime.KEY_LOWERED, false)
        }
        FitCard()
        StatusBarCard()

        Section("What shows")
        Card {
            PrefRow("Messages in the island", "Messages drop down from the island (iPhone keeps them as normal notifications)", IslandRuntime.KEY_NOTES, false)
            PrefRow("Island only", "The original notification is removed so nothing shows twice", IslandRuntime.KEY_HIDE_ORIGINALS, false)
            PrefRow("Silent, Focus, earbuds and torch", "Short moments for the ringer switch, Do Not Disturb, earbuds and the torch", IslandRuntime.KEY_ALERTS, true)
            PrefRow("Meetings", "A pill 10 minutes before each calendar meeting, with Join", IslandRuntime.KEY_MEETINGS, true)
        }

        Section("Try it")
        Card {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MuOutlined({
                    if (ready()) IslandHub.call(NoteLive(IslandHub.CALL_ID, "Phone", "Big Boss", "Mobile", null, null,
                        listOf(NoteAction("Decline", null, false), NoteAction("Answer", null, true), NoteAction("Speaker", null, null), NoteAction("Mute", null, null)),
                        isCall = true, pkg = "coco.test"))
                }) { Text("Call") }
                MuOutlined({ if (ready()) IslandHub.notify(ReplyTestReceiver.sample(ctx, SystemClock.elapsedRealtime())) }) { Text("Message + reply") }
                MuOutlined({
                    if (ready()) IslandHub.put(NavLive("nav", "Maps", "250 m", "Turn left onto MG Road", "12 min · 3.4 km", null, null, null, "coco.test"), 20_000)
                }) { Text("Maps") }
                MuOutlined({
                    val now = System.currentTimeMillis()
                    if (ready()) IslandHub.put(EventLive(-1L, "Coco weekly review", now + 8 * 60_000L, now + 38 * 60_000L, "", "https://meet.google.com/"), 30_000)
                }) { Text("Meeting") }
                MuOutlined({ if (ready()) IslandHub.alert(AlertLive(AlertKind.Headphones, "Earbuds", "Connected · 82%", 82), 4000) }) { Text("Earbuds") }
                MuOutlined({
                    if (ready()) IslandHub.put(NoteLive("live:test-rec", "Recorder", "Recording", "Voice note", null, null, emptyList(), false,
                        pkg = "coco.test", live = true, since = SystemClock.elapsedRealtime(), recording = true), 20_000)
                }) { Text("Recorder") }
            }
            Muted("Tap the pill to open its app, hold it to open it big, swipe up to hide, swipe sideways to switch.")
        }

        Section("Right now")
        Card {
            val live by IslandHub.live.collectAsState()
            Muted(if (live.isEmpty()) "Nothing live. The island appears by itself for calls, music, maps, timers, meetings and charging."
                else live.values.joinToString(" · ") { it.id.substringBefore(':') })
        }
    }
}

/**
 * Boss's bug (2026-10-25): an incoming call showed twice. The island already makes ONE call card from every call
 * notification; the second copy is the phone app's own pop-up banner, which no app may hide. One tap opens exactly the
 * channel the phone app rang on, where its pop-up is switched off. Calls still ring and still go full screen when locked.
 */
@Composable
private fun CallTwiceCard(tick: Int) {
    val ctx = LocalContext.current
    val app = remember(tick) { IslandRuntime.callApp(ctx) } ?: return
    val label = remember(app.first) { runCatching { ctx.packageManager.getApplicationLabel(ctx.packageManager.getApplicationInfo(app.first, 0)).toString() }.getOrDefault("Phone") }
    Card {
        Eyebrow("One call card only")
        Text("$label shows its own call banner, so the island steps back", style = MaterialTheme.typography.titleMedium)
        Muted("While it rings, the island shows only the small green pill with the caller's name: tap it to open the call, hold it for the big card. If your phone has a Pop-up or Banner switch for incoming calls, turn it off below and the island shows its big iPhone card instead.")
        PrefRow("Big call card anyway", "Shows the island's big card even when $label pops up its banner (you will see two)", IslandRuntime.KEY_BIG_CALL, false)
        MuTonal({
            val i = if (app.second != null) Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, app.first).putExtra(Settings.EXTRA_CHANNEL_ID, app.second)
                else Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, app.first)
            runCatching { ctx.startActivity(i) }.onFailure { ctx.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, app.first)) }
        }) { Text("Open $label call settings") }
    }
}

/** A small living island: a black pill whose music bars move, so the page shows what the island looks like. */
@Composable
private fun IslandPreview() {
    val t = rememberInfiniteTransition(label = "preview")
    val phase by t.animateFloat(0f, 6.283f, infiniteRepeatable(tween(1200, easing = LinearEasing)), label = "bars")
    val calm = LocalCalm.current
    Surface(shape = RoundedCornerShape(50), color = Color.Black, modifier = Modifier.width(170.dp).height(36.dp)) {
        Row(Modifier.padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(22.dp).clip(RoundedCornerShape(7.dp)).background(Mu.tomato))
            Spacer(Modifier.weight(1f))
            Canvas(Modifier.size(20.dp, 16.dp)) {
                val bw = 3.dp.toPx(); val gap = (size.width - 3 * bw) / 2f
                for (i in 0..2) {
                    val f = if (calm) 0.5f else 0.35f + 0.65f * (0.5f + 0.5f * kotlin.math.sin(phase + i * 1.7f))
                    drawRoundRect(Mu.bubblegum, Offset(i * (bw + gap), size.height * (1 - f)), Size(bw, size.height * f), CornerRadius(bw / 2))
                }
            }
        }
    }
}

@Composable
private fun Step(title: String, sub: String, done: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(if (done) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null,
            tint = if (done) LocalCocoRoles.current.success else MaterialTheme.colorScheme.outline)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleMedium); Muted(sub) }
        if (!done) MuTonal(onClick) { Text("Allow") }
    }
}

@Composable
private fun PrefRow(title: String, sub: String, key: String, default: Boolean) {
    val ctx = LocalContext.current
    var v by remember { mutableStateOf(IslandRuntime.pref(ctx, key, default)) }
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.bodyLarge); Muted(sub) }
        Spacer(Modifier.width(8.dp))
        Switch(v, { v = it; IslandRuntime.setPref(ctx, key, it) })
    }
}

/** "Fit to this phone": model and camera found at runtime, plus nudges saved on this phone only. */
@Composable
private fun FitCard() {
    val ctx = LocalContext.current
    val w by IslandHub.fitWidth.collectAsState()
    val y by IslandHub.fitY.collectAsState()
    val cam = remember {
        val m = ctx.getSystemService(android.view.WindowManager::class.java).currentWindowMetrics
        val r = m.windowInsets.displayCutout?.boundingRectTop
        val centred = r != null && !r.isEmpty && kotlin.math.abs(r.exactCenterX() - m.bounds.width() / 2f) < m.bounds.width() * 0.15f
        if (r == null || r.isEmpty) "no camera cutout: top centre" else if (centred) "centre camera: the pill wraps it" else "side camera: the pill stays centred"
    }
    Card {
        Eyebrow("Fit to this phone")
        Muted("${Build.MANUFACTURER} ${Build.MODEL} · $cam")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MuTonal({ IslandRuntime.setFit(ctx, w - 4, y) }, Modifier.weight(1f)) { Text("Narrower") }
            MuTonal({ IslandRuntime.setFit(ctx, w + 4, y) }, Modifier.weight(1f)) { Text("Wider") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MuTonal({ IslandRuntime.setFit(ctx, w, y - 1) }, Modifier.weight(1f)) { Text("Up") }
            MuTonal({ IslandRuntime.setFit(ctx, w, y + 1) }, Modifier.weight(1f)) { Text("Down") }
            TextButton({ IslandRuntime.setFit(ctx, 0, 0) }, Modifier.weight(1f)) { Text("Reset") }
        }
        Muted("Width ${if (w >= 0) "+" else ""}$w dp · height ${if (y >= 0) "+" else ""}$y dp. Start the stopwatch above to see the pill while you adjust.")
    }
}

@Composable
private fun StatusBarCard() {
    val ctx = LocalContext.current
    var clean by remember { mutableStateOf(StatusBarTools.isClean(ctx)) }
    var pct by remember { mutableStateOf(StatusBarTools.batteryPercent(ctx)) }
    var msg by remember { mutableStateOf<String?>(null) }
    Card {
        Eyebrow("Status bar")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Only time and battery", style = MaterialTheme.typography.bodyLarge); Muted("Hides Wi-Fi, signal, VoLTE, alarm, Bluetooth and other icons. Clock and battery stay.") }
            Switch(clean, { v -> msg = StatusBarTools.setClean(ctx, v); clean = StatusBarTools.isClean(ctx) })
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Battery percentage", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            Switch(pct, { v ->
                if (StatusBarTools.setBatteryPercent(ctx, v)) pct = v
                else { msg = "Allow Coco under Modify system settings first."; ctx.startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + ctx.packageName))) }
            })
        }
        if (!StatusBarTools.canWrite(ctx)) {
            Muted("One time setup on the PC (USB debugging on):")
            Text(StatusBarTools.GRANT_CMD, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        }
        Muted("Notification icons cannot be hidden by any app: switch them off in Settings > Notifications & status bar. Undo: switch off here, or run " + StatusBarTools.RESET_CMD)
        msg?.let { Text(it, color = MaterialTheme.colorScheme.error) }
    }
}
