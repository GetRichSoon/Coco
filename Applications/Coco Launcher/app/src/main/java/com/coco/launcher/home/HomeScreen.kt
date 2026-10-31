package com.coco.launcher.home

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.coco.launcher.apps.AppEntry
import com.coco.launcher.apps.AppRepository
import com.coco.launcher.apps.Launch
import com.coco.launcher.drawer.AppDrawer
import com.coco.launcher.drawer.MenuRow
import com.coco.launcher.gestures.HomeDrag
import com.coco.launcher.settings.SettingsScreen
import com.coco.launcher.storage.DoubleTapAction
import com.coco.launcher.storage.Prefs
import com.coco.launcher.storage.Settings
import com.coco.launcher.widgets.WidgetController
import com.coco.launcher.widgets.WidgetPickerSheet
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import kotlin.math.ceil

private const val DOCK_PREFIX = "v1:"
private const val SWIPE_THRESHOLD = 110f

@Composable
fun HomeScreen(widgets: WidgetController, homeReset: Flow<Unit>) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settingsFlow = remember(context) { Prefs.flow(context) }
    val settings by settingsFlow.collectAsState(initial = Settings())
    val apps by AppRepository.apps.collectAsState()

    val layout = remember(settings.homeLayout) { HomeLayout.fromJson(settings.homeLayout) }
    val appsByKey = remember(apps) { apps.associateBy { it.key } }
    val dockKeys = remember(settings.dock) { decodeDock(settings.dock) }

    var drawerOpen by remember { mutableStateOf(false) }
    var drawerSearch by remember { mutableStateOf(false) }
    var customizeOpen by remember { mutableStateOf(false) }
    var pickerOpen by remember { mutableStateOf(false) }
    var settingsOpen by remember { mutableStateOf(false) }
    var itemMenu by remember { mutableStateOf<HomeItem?>(null) }

    fun saveLayout(next: HomeLayout) {
        scope.launch { Prefs.setHomeLayout(context, next.toJson()) }
    }

    fun saveDock(keys: List<String>) {
        scope.launch { Prefs.setDock(context, DOCK_PREFIX + keys.joinToString("|")) }
    }

    fun openDrawer(search: Boolean) {
        drawerSearch = search
        drawerOpen = true
    }

    // The home button closes whatever is on top, which is what pressing home on a stock launcher does.
    LaunchedEffect(homeReset) {
        homeReset.collect {
            drawerOpen = false
            drawerSearch = false
            customizeOpen = false
            pickerOpen = false
            settingsOpen = false
            itemMenu = null
        }
    }

    // A smaller grid cannot hold the old layout, so refit it once and store the result.
    LaunchedEffect(settings.homeColumns, settings.homeRows, settings.homeLayout) {
        val refitted = layout.reflow(settings.homeColumns, settings.homeRows)
        if (refitted.items.toSet() != layout.items.toSet()) saveLayout(refitted)
    }

    // First run: fill the dock from the device's own defaults instead of leaving it empty.
    LaunchedEffect(apps.isNotEmpty(), settings.dock, settings.dockCount) {
        if (settings.dock.isEmpty() && apps.isNotEmpty()) {
            saveDock(defaultDock(context, apps, settings.dockCount))
        }
    }

    LaunchedEffect(widgets, settings.homeColumns, settings.homeRows, settings.homeLayout) {
        widgets.onWidgetReady = { id, info ->
            val cols = settings.homeColumns
            val rows = settings.homeRows
            val wanted = estimateSpan(context, info, cols, rows)
            // Take the requested size when there is room for it, otherwise fall back to one cell.
            var spanX = wanted.first
            var spanY = wanted.second
            var free = layout.firstFree(cols, rows, spanX, spanY)
            if (free == null) {
                spanX = 1
                spanY = 1
                free = layout.firstFree(cols, rows, 1, 1)
            }
            val spot = free
            val next = spot?.let {
                layout.place(cols, rows, HomeItem(ItemKind.Widget, id.toString(), it.first, it.second, spanX, spanY))
            }
            if (next == null) widgets.delete(id) else saveLayout(next)
        }
    }

    BackHandler(enabled = drawerOpen || customizeOpen || pickerOpen || itemMenu != null) {
        when {
            itemMenu != null -> itemMenu = null
            pickerOpen -> pickerOpen = false
            customizeOpen -> customizeOpen = false
            drawerOpen -> drawerOpen = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Wallpaper-level gesture layer. It sits underneath the content, so it only sees presses
        // that the icons, widgets and dock did not already take.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(settings.doubleTap) {
                    detectTapGestures(
                        onLongPress = { customizeOpen = true },
                        onDoubleTap = {
                            when (settings.doubleTap) {
                                DoubleTapAction.None -> Unit
                                DoubleTapAction.Search -> openDrawer(search = true)
                                DoubleTapAction.Drawer -> openDrawer(search = false)
                            }
                        },
                    )
                }
                .pointerInput(Unit) {
                    var total = 0f
                    detectVerticalDragGestures(
                        onDragStart = { total = 0f },
                        onDragEnd = {
                            if (total < -SWIPE_THRESHOLD) openDrawer(search = false)
                            else if (total > SWIPE_THRESHOLD) openDrawer(search = true)
                        },
                    ) { _, delta -> total += delta }
                },
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing),
        ) {
            Column(modifier = Modifier.padding(start = 28.dp, end = 28.dp, top = 16.dp)) {
                HomeClock()
                if (settings.showAtAGlance) {
                    AtAGlance(showNextEvent = settings.showNextEvent, modifier = Modifier.padding(top = 2.dp))
                }
            }

            HomeGrid(
                layout = layout,
                appsByKey = appsByKey,
                settings = settings,
                widgets = widgets,
                onLayout = { saveLayout(it) },
                onItemMenu = { itemMenu = it },
                onVerticalSwipe = { dy ->
                    if (dy < -SWIPE_THRESHOLD) openDrawer(search = false)
                    else if (dy > SWIPE_THRESHOLD) openDrawer(search = true)
                },
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp, vertical = 12.dp),
            )

            if (settings.showDock) {
                Dock(
                    keys = dockKeys,
                    appsByKey = appsByKey,
                    settings = settings,
                    onSwipe = { dy ->
                        if (dy < -SWIPE_THRESHOLD) openDrawer(search = false)
                        else if (dy > SWIPE_THRESHOLD) openDrawer(search = true)
                    },
                    onRemove = { key -> saveDock(dockKeys - key) },
                    modifier = Modifier.padding(horizontal = 18.dp),
                )
            }

            if (settings.showSearchPill) {
                SearchPill(
                    onClick = { openDrawer(search = true) },
                    modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 14.dp),
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
        }

        AppDrawer(
            visible = drawerOpen,
            apps = apps,
            settings = settings,
            startInSearch = drawerSearch,
            onDismiss = { drawerOpen = false },
            onAddToHome = { entry ->
                val free = layout.firstFree(settings.homeColumns, settings.homeRows)
                if (free != null) {
                    layout.place(
                        settings.homeColumns,
                        settings.homeRows,
                        HomeItem(ItemKind.App, entry.key, free.first, free.second),
                    )?.let { saveLayout(it) }
                }
            },
            onAddToDock = { entry ->
                if (dockKeys.size < settings.dockCount && !dockKeys.contains(entry.key)) {
                    saveDock(dockKeys + entry.key)
                }
            },
        )

        if (customizeOpen) {
            CustomizeSheet(
                onDismiss = { customizeOpen = false },
                onWallpaper = {
                    customizeOpen = false
                    openWallpaperPicker(context)
                },
                onWidgets = {
                    customizeOpen = false
                    pickerOpen = true
                },
                onSettings = {
                    customizeOpen = false
                    settingsOpen = true
                },
            )
        }

        if (pickerOpen) {
            WidgetPickerSheet(
                controller = widgets,
                onPick = { info ->
                    pickerOpen = false
                    widgets.add(info)
                },
                onDismiss = { pickerOpen = false },
            )
        }

        itemMenu?.let { item ->
            HomeItemMenu(
                item = item,
                onDismiss = { itemMenu = null },
                onRemove = {
                    saveLayout(layout.remove(item.key))
                    itemMenu = null
                },
            )
        }

        if (settingsOpen) {
            Surface(modifier = Modifier.fillMaxSize()) {
                SettingsScreen(settings = settings, onClose = { settingsOpen = false }, startAt = "home")
            }
        }
    }
}

@Composable
private fun Dock(
    keys: List<String>,
    appsByKey: Map<String, AppEntry>,
    settings: Settings,
    onSwipe: (Float) -> Unit,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val entries = keys.mapNotNull { appsByKey[it] }
    if (entries.isEmpty()) return

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        entries.forEach { entry ->
            AppTile(
                entry = entry,
                iconSize = settings.iconSizeDp.dp,
                showLabel = false,
                themedIcons = settings.themedIcons,
                labelOnWallpaper = true,
                onLongPress = { onRemove(entry.key) },
                drag = remember(entry.key, onSwipe) {
                    HomeDrag(onStart = {}, onDrag = {}, onEnd = {}, onVerticalSwipe = onSwipe)
                },
            )
        }
    }
}

@Composable
private fun SearchPill(onClick: () -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    Surface(
        color = colors.surfaceContainerHigh.copy(alpha = 0.78f),
        shape = CircleShape,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .pointerInput(Unit) { detectTapGestures { onClick() } },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 22.dp),
        ) {
            Icon(Icons.Rounded.Search, contentDescription = null, tint = colors.onSurfaceVariant)
            Text(
                text = "Search apps",
                style = MaterialTheme.typography.bodyLarge,
                color = colors.onSurfaceVariant,
                modifier = Modifier.padding(start = 14.dp),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomizeSheet(
    onDismiss: () -> Unit,
    onWallpaper: () -> Unit,
    onWidgets: () -> Unit,
    onSettings: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Text(
            text = "Customise",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(start = 24.dp, bottom = 4.dp),
        )
        MenuRow("Wallpaper") { onWallpaper() }
        MenuRow("Widgets") { onWidgets() }
        MenuRow("Home settings") { onSettings() }
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun HomeItemMenu(item: HomeItem, onDismiss: () -> Unit, onRemove: () -> Unit) {
    val context = LocalContext.current
    val entry = if (item.kind == ItemKind.App) AppRepository.find(item.key) else null

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) { detectTapGestures { onDismiss() } },
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier.padding(32.dp),
        ) {
            Column(modifier = Modifier.padding(vertical = 12.dp)) {
                Text(
                    text = entry?.label ?: "Widget",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
                MenuRow("Remove from home") { onRemove() }
                if (entry != null) {
                    MenuRow("App info") { Launch.appInfo(context, entry.component); onDismiss() }
                    MenuRow("Uninstall") { Launch.uninstall(context, entry.component); onDismiss() }
                }
                MenuRow("Cancel") { onDismiss() }
            }
        }
    }
}

private fun openWallpaperPicker(context: Context) {
    val intent = Intent(Intent.ACTION_SET_WALLPAPER)
    val chooser = Intent.createChooser(intent, "Wallpaper").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (runCatching { context.startActivity(chooser) }.isFailure) {
        runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
}

internal fun decodeDock(raw: String): List<String> =
    if (!raw.startsWith(DOCK_PREFIX)) emptyList()
    else raw.removePrefix(DOCK_PREFIX).split("|").filter { it.isNotBlank() }

/** The device's own default phone, messaging, browser and camera apps, in that order. */
private fun defaultDock(context: Context, apps: List<AppEntry>, count: Int): List<String> {
    val probes = listOf(
        Intent(Intent.ACTION_DIAL),
        Intent(Intent.ACTION_VIEW, Uri.parse("sms:")),
        Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")),
        Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA),
    )
    val packageManager = context.packageManager
    val picked = LinkedHashSet<String>()
    probes.forEach { intent ->
        val packageName = runCatching {
            packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
        }.getOrNull()
        val match = packageName?.let { name -> apps.firstOrNull { it.component.packageName == name } }
        if (match != null) picked += match.key
    }
    // Whatever the probes could not fill, top up alphabetically so the dock is never half empty.
    apps.forEach { if (picked.size < count) picked += it.key }
    return picked.take(count).toList()
}

/**
 * A first guess at how many cells a widget wants. AppWidgetProviderInfo reports its minimum in
 * pixels, so it is compared against an estimated cell size; the founder can resize afterwards.
 */
private fun estimateSpan(
    context: Context,
    info: android.appwidget.AppWidgetProviderInfo,
    cols: Int,
    rows: Int,
): Pair<Int, Int> {
    val metrics = context.resources.displayMetrics
    val cellWidthPx = (metrics.widthPixels / cols).coerceAtLeast(1)
    val cellHeightPx = ((metrics.heightPixels * 0.55f) / rows).toInt().coerceAtLeast(1)
    val spanX = ceil(info.minWidth.toFloat() / cellWidthPx).toInt().coerceIn(1, cols)
    val spanY = ceil(info.minHeight.toFloat() / cellHeightPx).toInt().coerceIn(1, rows)
    return spanX to spanY
}
