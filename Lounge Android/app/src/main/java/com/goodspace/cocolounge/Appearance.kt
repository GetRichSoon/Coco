@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale

// ---------------------------------------------------------------- the Appearance screen (System section)
fun LazyListScope.appearance(vm: Lounge) {
    val th = vm.themes
    item(key = "ap-head") { AppearanceHeader(th) }
    item(key = "ap-mode") { ModeCard(th) }
    item(key = "ap-themes-h") { Section("Themes") }
    item(key = "ap-themes") { ThemeGrid(th) }
    item(key = "ap-auto") { RotationCard(th) }
    item(key = "ap-more") { ActionsCard(th) }
}

private fun themeLabel(th: ThemeController, id: String?): String = id?.let { th.contract.theme(it).let { t -> "${t.number}. ${t.name}" } }.orEmpty()

/** The next automatic switch, in the schedule's own clock, or the honest reason there is none. */
fun nextSwitchText(th: ThemeController, now: Long = System.currentTimeMillis()): String {
    val p = th.prefs; val e = th.engine; val pv = e.preview(p)
    if (pv.kind == "none") return if (p.locked) "Never (this theme is locked)" else "Never (manual only)"
    if (e.kindOf(p) == "launch") return "On the next launch → " + (pv.themeId?.let { themeLabel(th, it) } ?: "one of the other themes, chosen at random")
    val due = e.nextDueAt(p, now) ?: return "Never (manual only)"
    val at = DateTimeFormatter.ofPattern("EEE d MMM, HH:mm", Locale.getDefault()).withZone(ThemeEngine.zoneOf(p.rotation.tz)).format(Instant.ofEpochMilli(due))
    return "$at → ${themeLabel(th, pv.themeId)}"
}

private fun lastSwitchedText(p: ThemePrefs): String {
    val at = p.lastSwitchedAt ?: return "Not switched yet"
    // the reason field describes the latest change to the document, so it is only quoted when that change was the switch itself
    val why = mapOf("manual" to "chosen by hand", "next" to "applied next", "launch" to "on launch", "schedule" to "by schedule")[p.reason]
    return ago(at) + (why?.let { " ($it)" } ?: "")
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Four overlapping dots: the theme's three seed colours (what makes it that theme) and its page colour in the given mode. */
@Composable
private fun Swatches(contract: ThemeContract, themeId: String, dark: Boolean) {
    val seeds = contract.theme(themeId).seeds
    val page = contract.roles(themeId, dark, panel = false).getValue("background")
    val edge = MaterialTheme.colorScheme.outline
    Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
        listOf(page, seeds.getValue("tertiary"), seeds.getValue("secondary"), seeds.getValue("primary")).forEach {
            Box(Modifier.size(30.dp).clip(CircleShape).background(Color(it)).border(1.dp, edge, CircleShape))
        }
    }
}

@Composable
private fun AppearanceHeader(th: ThemeController) {
    val p = th.prefs; val def = th.contract.theme(p.themeId)
    val dark = th.engine.resolveDark(p.appearance, isSystemInDarkTheme())
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Swatches(th.contract, def.id, dark)
            Column(Modifier.weight(1f)) {
                Eyebrow("Current theme")
                Text("${def.number}. ${def.name}", style = MaterialTheme.typography.titleLarge)
            }
        }
        Muted(def.tagline, 3)
        InfoRow("Mode", when (p.appearance) { "light" -> "Light"; "dark" -> "Dark"; else -> "System (${if (dark) "dark" else "light"} right now)" })
        InfoRow("Last switched", lastSwitchedText(p))
        InfoRow("Next scheduled switch", nextSwitchText(th))
        if (p.locked) InfoRow("Locked", "This theme never changes automatically")
    }
}

@Composable
private fun ModeCard(th: ThemeController) {
    Card {
        Eyebrow("Mode")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("light" to "Light", "dark" to "Dark", "system" to "System").forEachIndexed { i, (v, l) ->
                SegmentedButton(th.prefs.appearance == v, { th.setAppearance(v) }, SegmentedButtonDefaults.itemShape(i, 3), colors = segmentedColors()) { Text(l) }
            }
        }
    }
}

// ---------------------------------------------------------------- the six themes
@Composable
private fun ThemeGrid(th: ThemeController) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), maxItemsInEachRow = 2) {
        th.contract.themes.forEach { t -> ThemeCard(th, t, Modifier.weight(1f)) }
    }
}

@Composable
private fun Pill(text: String, container: Color, content: Color) {
    Surface(shape = RoundedCornerShape(50), color = container, contentColor = content) {
        Text(text, Modifier.padding(horizontal = 9.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall, maxLines = 1)
    }
}

@Composable
private fun ThemeCard(th: ThemeController, t: ThemeDef, modifier: Modifier) {
    val p = th.prefs; val cs = MaterialTheme.colorScheme
    val current = p.themeId == t.id
    val next = th.engine.preview(p).let { it.kind == "exact" && it.themeId == t.id }
    val previewing = th.previewId == t.id
    PanelSurface(modifier, highlight = current || previewing) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            // the theme as it will look, in both modes, drawn from that theme's own roles (not from the one in use)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MiniPreview(th.contract, t.id, dark = false, label = "Light", modifier = Modifier.weight(1f))
                MiniPreview(th.contract, t.id, dark = true, label = "Dark", modifier = Modifier.weight(1f))
            }
            Text("${t.number}  ${t.name}", style = MaterialTheme.typography.titleMedium)
            Muted(t.tagline, 4)
            if (current || next || previewing) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (current) Pill("Current", cs.primaryContainer, cs.onPrimaryContainer)
                if (next) Pill("Next", cs.surfaceContainerHighest, cs.onSurface)
                if (previewing) Pill("Previewing", cs.secondaryContainer, cs.onSecondaryContainer)
            }
            MuOutlined({ th.preview(t.id) }, Modifier.fillMaxWidth()) { Text("Preview") }
            MuButton({ th.apply(t.id) }, Modifier.fillMaxWidth(), enabled = !current) { Text(if (current) "In use" else "Apply") }
        }
    }
}

/** A miniature screen: top bar, card with text lines, a call to action, the selected state and the navigation pill, in one mode. */
@Composable
private fun MiniPreview(contract: ThemeContract, themeId: String, dark: Boolean, label: String, modifier: Modifier) {
    val page = contract.roles(themeId, dark, panel = false); val panel = contract.roles(themeId, dark, panel = true)
    fun pg(k: String) = Color(page.getValue(k))
    fun pn(k: String) = Color(panel.getValue(k))
    val shape = RoundedCornerShape(10.dp)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Column(Modifier.fillMaxWidth().clip(shape).background(pg("background")).border(1.dp, pg("outlineVariant"), shape).padding(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(3.dp)).background(pn("surface")))
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(pn("cardSurface")).padding(5.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Box(Modifier.fillMaxWidth(0.7f).height(4.dp).clip(CircleShape).background(pn("onSurface")))
                Box(Modifier.fillMaxWidth(0.45f).height(3.dp).clip(CircleShape).background(pn("onSurfaceVariant")))
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.width(18.dp).height(8.dp).clip(CircleShape).background(pn("cta")))
                    Box(Modifier.size(8.dp).clip(CircleShape).background(pn("selected")))
                    Box(Modifier.size(8.dp).clip(CircleShape).background(pn("highlight")))
                }
            }
            Box(Modifier.fillMaxWidth().height(9.dp).clip(CircleShape).background(pn("cardSurface")), contentAlignment = Alignment.CenterStart) {
                Box(Modifier.padding(start = 3.dp).width(14.dp).height(5.dp).clip(CircleShape).background(pn("selected")))
            }
        }
        Text(label, Modifier.fillMaxWidth(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ---------------------------------------------------------------- automatic rotation
private val WEEKDAYS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

@Composable
private fun RotationCard(th: ThemeController) {
    val p = th.prefs; val rot = p.rotation; val kind = th.engine.kindOf(p)
    var timeDialog by remember { mutableStateOf(false) }
    fun set(k: String, v: Any) = th.setRotation(JSONObject().put(k, v))
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Automatic rotation", style = MaterialTheme.typography.titleMedium)
                Muted(if (rot.enabled) "On: the theme changes by itself" else "Off: the theme only changes when you change it. You can set the schedule below first.")
            }
            Switch(rot.enabled, { set("enabled", it) })
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Eyebrow("How often")
        th.contract.frequencies.forEach { f ->
            Row(Modifier.fillMaxWidth().selectable(rot.frequency == f.id, role = Role.RadioButton) { set("frequency", f.id) }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                RadioButton(rot.frequency == f.id, null)
                Spacer(Modifier.width(10.dp))
                Text(f.label, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Eyebrow("Order")
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("sequential" to "Sequential", "random" to "Random").forEachIndexed { i, (v, l) ->
                SegmentedButton(rot.order == v, { set("order", v) }, SegmentedButtonDefaults.itemShape(i, 2), colors = segmentedColors()) { Text(l) }
            }
        }
        Muted(th.contract.orders.firstOrNull { it.id == rot.order }?.label.orEmpty())
        if (kind == "daily" || kind == "weekly" || kind == "monthly") {
            Eyebrow("When")
            MuTonal({ timeDialog = true }) { Icon(Icons.Rounded.Schedule, null); Spacer(Modifier.width(8.dp)); Text("At ${rot.time}") }
            if (kind == "weekly") FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                WEEKDAYS.forEachIndexed { i, d -> FilterChip(rot.weekday == i, { set("weekday", i) }, { Text(d) }) }
            }
            if (kind == "monthly") Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton({ set("dayOfMonth", (rot.dayOfMonth - 1).coerceAtLeast(1)) }, enabled = rot.dayOfMonth > 1) { Icon(Icons.Rounded.Remove, "Earlier day") }
                Text("Day ${rot.dayOfMonth} of the month", Modifier.padding(horizontal = 8.dp), style = MaterialTheme.typography.bodyLarge)
                IconButton({ set("dayOfMonth", (rot.dayOfMonth + 1).coerceAtMost(31)) }, enabled = rot.dayOfMonth < 31) { Icon(Icons.Rounded.Add, "Later day") }
            }
            if (kind == "monthly" && rot.dayOfMonth > 28) Muted("A shorter month switches on its last day.")
            Muted("Time zone: " + rot.tz.ifEmpty { "this device (${java.time.ZoneId.systemDefault().id})" })
        }
        if (kind == "launch") Muted("It switches when COCO is opened as a new session, never when you come back to it.")
    }
    if (timeDialog) TimeDialog(rot.time, { timeDialog = false }) { set("time", it); timeDialog = false }
}

@Composable
private fun TimeDialog(initial: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val state = rememberTimePickerState(initial.substringBefore(':').toIntOrNull() ?: 9, initial.substringAfter(':').toIntOrNull() ?: 0, is24Hour = true)
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        CocoPanel {
            Surface(Modifier.padding(16.dp), shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, contentColor = MaterialTheme.colorScheme.onSurface) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Switch at", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth())
                    TimePicker(state)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onDismiss) { Text("Cancel") }
                        TextButton({ onPick("%02d:%02d".format(Locale.ROOT, state.hour, state.minute)) }) { Text("Set") }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- the rest: next now, lock, reset
@Composable
private fun ActionsCard(th: ThemeController) {
    val p = th.prefs
    var confirmReset by remember { mutableStateOf(false) }
    Card {
        MuTonal({ th.advance() }, Modifier.fillMaxWidth()) { Icon(Icons.Rounded.SkipNext, null); Spacer(Modifier.width(8.dp)); Text("Apply next theme now") }
        Muted(if (p.rotation.order == "sequential") "Next in order: " + themeLabel(th, th.engine.pickNext(p)) else "A random one of the other themes, never the one in use.")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Lock this theme", style = MaterialTheme.typography.titleMedium)
                Muted("A locked theme never changes automatically.")
            }
            Switch(p.locked, { th.setLocked(it) })
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        MuOutlined({ confirmReset = true }, Modifier.fillMaxWidth()) { Text("Reset to default") }
    }
    if (confirmReset) AlertDialog(onDismissRequest = { confirmReset = false }, title = { Text("Reset appearance?") },
        text = { Text("Back to ${themeLabel(th, th.contract.defaults.themeId)}, mode System, automatic rotation off, theme unlocked.") },
        confirmButton = { TextButton({ th.reset(); confirmReset = false }) { Text("Reset") } }, dismissButton = { TextButton({ confirmReset = false }) { Text("Cancel") } })
}

// ---------------------------------------------------------------- preview bar and the quick switch menu
/** Shown over the app while a theme is being previewed: the whole app already wears it; Apply keeps it, Cancel (or leaving the screen) puts it back. */
@Composable
fun PreviewBar(th: ThemeController, modifier: Modifier = Modifier) {
    val id = th.previewId ?: return
    PanelSurface(modifier.fillMaxWidth().padding(horizontal = 14.dp), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Eyebrow("Previewing")
                Text(themeLabel(th, id), style = MaterialTheme.typography.titleSmall, maxLines = 1)
            }
            TextButton({ th.cancelPreview() }) { Text("Cancel") }
            MuButton({ th.apply(id) }) { Text("Apply") }
        }
    }
}

/** The palette icon's menu: the six themes, one tap to apply, and a way into the full screen. */
@Composable
fun ThemeQuickMenu(th: ThemeController, expanded: Boolean, onDismiss: () -> Unit, onOpenAppearance: () -> Unit) {
    val dark = th.engine.resolveDark(th.prefs.appearance, isSystemInDarkTheme())
    DropdownMenu(expanded, onDismiss) {
        th.contract.themes.forEach { t ->
            val cta = Color(th.contract.roles(t.id, dark, panel = true).getValue("cta")); val sel = Color(th.contract.roles(t.id, dark, panel = true).getValue("selected"))
            DropdownMenuItem(
                text = { Text("${t.number}  ${t.name}") },
                leadingIcon = { Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) { Box(Modifier.size(18.dp).clip(CircleShape).background(sel)); Box(Modifier.size(18.dp).clip(CircleShape).background(cta)) } },
                trailingIcon = { if (th.prefs.themeId == t.id) Icon(Icons.Rounded.Check, "In use") },
                onClick = { th.apply(t.id); onDismiss() },
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        DropdownMenuItem(text = { Text("Appearance settings") }, leadingIcon = { Icon(Icons.Rounded.Tune, null) }, onClick = { onOpenAppearance(); onDismiss() })
    }
}
