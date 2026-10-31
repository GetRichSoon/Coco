package com.coco.launcher.settings

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.coco.launcher.storage.DoubleTapAction
import com.coco.launcher.storage.Prefs
import com.coco.launcher.storage.Settings
import com.coco.launcher.theme.ThemeMode
import kotlinx.coroutines.launch

private enum class Section(val title: String) {
    Index("Settings"),
    Home("Home"),
    Appearance("Appearance"),
    Gestures("Gestures"),
    Drawer("App drawer"),
    About("About Coco Launcher"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(settings: Settings, onClose: () -> Unit, startAt: String? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var section by remember {
        mutableStateOf(if (startAt == "home") Section.Home else Section.Index)
    }

    BackHandler(enabled = true) {
        if (section == Section.Index) onClose() else section = Section.Index
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(section.title) },
                navigationIcon = {
                    IconButton(onClick = {
                        if (section == Section.Index) onClose() else section = Section.Index
                    }) {
                        Icon(Icons.Rounded.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when (section) {
                Section.Index -> {
                    listOf(
                        Section.Home to "Grid, icons, labels, dock",
                        Section.Appearance to "Theme and icon style",
                        Section.Gestures to "Swipe and double tap",
                        Section.Drawer to "Drawer layout",
                        Section.About to "Version and privacy",
                    ).forEach { (target, summary) ->
                        ListItem(
                            headlineContent = { Text(target.title) },
                            supportingContent = { Text(summary) },
                            modifier = Modifier.clickableRow { section = target },
                        )
                    }
                }

                Section.Home -> {
                    StepperRow("Columns", settings.homeColumns, 3..7) { scope.launch { Prefs.setColumns(context, it) } }
                    StepperRow("Rows", settings.homeRows, 3..7) { scope.launch { Prefs.setRows(context, it) } }
                    SliderRow("Icon size", settings.iconSizeDp, 40..72, "dp") {
                        scope.launch { Prefs.setIconSize(context, it) }
                    }
                    SwitchRow("App labels", "Show names under icons", settings.showLabels) {
                        scope.launch { Prefs.setLabels(context, it) }
                    }
                    SwitchRow("At a Glance", "Date and next alarm above the clock area", settings.showAtAGlance) {
                        scope.launch { Prefs.setGlance(context, it) }
                    }
                    NextEventRow(settings)
                    SwitchRow("Search bar", "Show the search pill at the bottom", settings.showSearchPill) {
                        scope.launch { Prefs.setPill(context, it) }
                    }
                    SwitchRow("Dock", "Show the bottom row of favourites", settings.showDock) {
                        scope.launch { Prefs.setDockVisible(context, it) }
                    }
                    StepperRow("Dock apps", settings.dockCount, 3..5) {
                        scope.launch { Prefs.setDockCount(context, it) }
                    }
                }

                Section.Appearance -> {
                    SectionLabel("Theme")
                    ThemeMode.entries.forEach { mode ->
                        val label = when (mode) {
                            ThemeMode.System -> "Follow system"
                            ThemeMode.Light -> "Light"
                            ThemeMode.Dark -> "Dark"
                        }
                        RadioRow(label, settings.themeMode == mode) {
                            scope.launch { Prefs.setTheme(context, mode) }
                        }
                    }
                    HorizontalDivider()
                    SwitchRow(
                        title = "Themed icons",
                        summary = "Tint icons that ship a monochrome layer (Android 13 and newer)",
                        checked = settings.themedIcons,
                    ) { scope.launch { Prefs.setThemedIcons(context, it) } }
                    ListItem(
                        headlineContent = { Text("Colours") },
                        supportingContent = {
                            Text("Taken from the system wallpaper palette on Android 12 and newer.")
                        },
                    )
                }

                Section.Gestures -> {
                    ListItem(
                        headlineContent = { Text("Swipe up") },
                        supportingContent = { Text("Open the app drawer") },
                    )
                    ListItem(
                        headlineContent = { Text("Swipe down") },
                        supportingContent = { Text("Open app search") },
                    )
                    ListItem(
                        headlineContent = { Text("Long press") },
                        supportingContent = { Text("Wallpaper, widgets and home settings") },
                    )
                    HorizontalDivider()
                    SectionLabel("Double tap on the home screen")
                    DoubleTapAction.entries.forEach { action ->
                        val label = when (action) {
                            DoubleTapAction.None -> "Nothing"
                            DoubleTapAction.Search -> "Open search"
                            DoubleTapAction.Drawer -> "Open app drawer"
                        }
                        RadioRow(label, settings.doubleTap == action) {
                            scope.launch { Prefs.setDoubleTap(context, action) }
                        }
                    }
                }

                Section.Drawer -> {
                    StepperRow("Columns", settings.drawerColumns, 3..6) {
                        scope.launch { Prefs.setDrawerColumns(context, it) }
                    }
                    ListItem(
                        headlineContent = { Text("Order") },
                        supportingContent = { Text("Alphabetical, using the device language") },
                    )
                }

                Section.About -> {
                    ListItem(
                        headlineContent = { Text("Coco Launcher") },
                        supportingContent = { Text("Version 1.0") },
                    )
                    ListItem(
                        headlineContent = { Text("Privacy") },
                        supportingContent = {
                            Text(
                                "No account, no analytics, no network access. Your app list, layout and " +
                                    "settings stay on this device.",
                            )
                        },
                    )
                    ListItem(
                        headlineContent = { Text("Permissions") },
                        supportingContent = {
                            Text("Calendar, and only if you turn on the next event line in Home settings.")
                        },
                    )
                    Box(modifier = Modifier.height(24.dp))
                    Text(
                        text = "Made for Good Space",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 24.dp),
                    )
                }
            }
        }
    }
}

/** The one permission this launcher ever asks for, and only when this row is switched on. */
@Composable
private fun NextEventRow(settings: Settings) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val request = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        scope.launch { Prefs.setNextEvent(context, granted) }
    }
    SwitchRow(
        title = "Next event",
        summary = "Show the next calendar event in At a Glance",
        checked = settings.showNextEvent,
    ) { wanted ->
        if (wanted) request.launch(Manifest.permission.READ_CALENDAR)
        else scope.launch { Prefs.setNextEvent(context, false) }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 4.dp),
    )
}

@Composable
private fun SwitchRow(title: String, summary: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(summary) },
        trailingContent = { Switch(checked = checked, onCheckedChange = onChange) },
        modifier = Modifier.clickableRow { onChange(!checked) },
    )
}

@Composable
private fun RadioRow(title: String, selected: Boolean, onSelect: () -> Unit) {
    ListItem(
        headlineContent = { Text(title) },
        leadingContent = { RadioButton(selected = selected, onClick = onSelect) },
        modifier = Modifier.clickableRow(onSelect),
    )
}

@Composable
private fun StepperRow(title: String, value: Int, range: IntRange, onChange: (Int) -> Unit) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(value.toString()) },
        trailingContent = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(
                    onClick = { if (value > range.first) onChange(value - 1) },
                    enabled = value > range.first,
                ) { Text("-", style = MaterialTheme.typography.titleLarge) }
                IconButton(
                    onClick = { if (value < range.last) onChange(value + 1) },
                    enabled = value < range.last,
                ) { Text("+", style = MaterialTheme.typography.titleLarge) }
            }
        },
    )
}

@Composable
private fun SliderRow(title: String, value: Int, range: IntRange, unit: String, onChange: (Int) -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(title + "  " + value + " " + unit, style = MaterialTheme.typography.bodyLarge)
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt()) },
            valueRange = range.first.toFloat()..range.last.toFloat(),
            steps = (range.last - range.first) - 1,
        )
    }
}

private fun Modifier.clickableRow(onClick: () -> Unit): Modifier =
    this.fillMaxWidth().clickable(onClick = onClick)
