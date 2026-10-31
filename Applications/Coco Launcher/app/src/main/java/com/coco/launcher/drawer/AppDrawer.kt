package com.coco.launcher.drawer

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coco.launcher.apps.AppEntry
import com.coco.launcher.apps.Launch
import com.coco.launcher.home.AppTile
import com.coco.launcher.storage.Settings
import kotlinx.coroutines.launch

/** Case- and position-insensitive match, so "cal" finds Calculator and "tube" finds YouTube. */
fun filterApps(apps: List<AppEntry>, query: String): List<AppEntry> {
    val q = query.trim()
    if (q.isEmpty()) return apps
    val starts = ArrayList<AppEntry>()
    val contains = ArrayList<AppEntry>()
    apps.forEach { app ->
        val label = app.label
        when {
            label.startsWith(q, ignoreCase = true) -> starts += app
            label.contains(q, ignoreCase = true) -> contains += app
            // Match the start of any word: "play st" finds Play Store.
            label.split(' ', '-', '_').any { it.startsWith(q, ignoreCase = true) } -> contains += app
        }
    }
    return starts + contains
}

@Composable
fun AppDrawer(
    visible: Boolean,
    apps: List<AppEntry>,
    settings: Settings,
    startInSearch: Boolean,
    onDismiss: () -> Unit,
    onAddToHome: (AppEntry) -> Unit,
    onAddToDock: (AppEntry) -> Unit,
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(
            animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
            initialOffsetY = { it / 3 },
        ) + fadeIn(spring(stiffness = Spring.StiffnessMedium)),
        exit = slideOutVertically(
            animationSpec = spring(stiffness = Spring.StiffnessMedium),
            targetOffsetY = { it / 4 },
        ) + fadeOut(),
    ) {
        DrawerContent(apps, settings, startInSearch, onDismiss, onAddToHome, onAddToDock)
    }
}

@Composable
private fun DrawerContent(
    apps: List<AppEntry>,
    settings: Settings,
    startInSearch: Boolean,
    onDismiss: () -> Unit,
    onAddToHome: (AppEntry) -> Unit,
    onAddToDock: (AppEntry) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    var query by remember { mutableStateOf("") }
    val results = remember(apps, query) { filterApps(apps, query) }
    val gridState = rememberLazyGridState()
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val view = androidx.compose.ui.platform.LocalView.current
    var menuFor by remember { mutableStateOf<AppEntry?>(null) }

    LaunchedEffect(startInSearch) {
        if (startInSearch) runCatching { focus.requestFocus() }
    }

    Surface(
        color = colors.surface.copy(alpha = 0.94f),
        modifier = Modifier
            .fillMaxSize()
            // A downward fling anywhere on the drawer closes it, as on the stock home screen.
            .pointerInput(Unit) {
                var total = 0f
                detectVerticalDragGestures(
                    onDragStart = { total = 0f },
                    onDragEnd = { if (total > 140f) onDismiss() },
                ) { _, delta -> total += delta }
            },
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing),
        ) {
            SearchField(
                query = query,
                onQuery = { query = it },
                focusRequester = focus,
                onSubmit = {
                    results.firstOrNull()?.let { first ->
                        keyboard?.hide()
                        menuFor = null
                        Launch.app(view, first, null)
                    }
                },
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            )

            if (results.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                    Text(
                        text = if (apps.isEmpty()) "Loading apps" else "No apps match \"" + query.trim() + "\"",
                        style = MaterialTheme.typography.bodyLarge,
                        color = colors.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 64.dp, start = 32.dp, end = 32.dp),
                    )
                }
            } else {
                Row(modifier = Modifier.fillMaxSize()) {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(settings.drawerColumns),
                        state = gridState,
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            start = 16.dp, end = 4.dp, top = 8.dp, bottom = 32.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(18.dp),
                        modifier = Modifier.weight(1f),
                    ) {
                        items(items = results, key = { it.key }) { app ->
                            AppTile(
                                entry = app,
                                iconSize = settings.iconSizeDp.dp,
                                showLabel = true,
                                themedIcons = settings.themedIcons,
                                onLongPress = { menuFor = app },
                                modifier = Modifier.padding(horizontal = 2.dp),
                            )
                        }
                    }
                    FastScroller(
                        sections = remember(results) { results.map { it.section }.distinct() },
                        onSection = { section ->
                            val index = results.indexOfFirst { it.section == section }
                            if (index >= 0) scope.launch { gridState.scrollToItem(index) }
                        },
                        modifier = Modifier
                            .width(28.dp)
                            .fillMaxSize()
                            .padding(vertical = 24.dp),
                    )
                }
            }
        }
    }

    menuFor?.let { app ->
        AppMenu(
            entry = app,
            onDismiss = { menuFor = null },
            onHome = { onAddToHome(app); menuFor = null; onDismiss() },
            onDock = { onAddToDock(app); menuFor = null },
        )
    }
}

@Composable
private fun SearchField(
    query: String,
    onQuery: (String) -> Unit,
    focusRequester: FocusRequester,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        color = colors.surfaceContainerHigh,
        shape = CircleShape,
        modifier = modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .padding(horizontal = 18.dp),
        ) {
            Icon(Icons.Rounded.Search, contentDescription = null, tint = colors.onSurfaceVariant)
            Box(modifier = Modifier
                .weight(1f)
                .padding(start = 12.dp)) {
                if (query.isEmpty()) {
                    Text(
                        text = "Search apps",
                        style = MaterialTheme.typography.bodyLarge,
                        color = colors.onSurfaceVariant,
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQuery,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.onSurface),
                    cursorBrush = SolidColor(colors.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                    keyboardActions = KeyboardActions(onGo = { onSubmit() }),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester),
                )
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQuery("") }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Clear", tint = colors.onSurfaceVariant)
                }
            }
        }
    }
}

/** A-Z strip: tap or slide to jump. Only sections that exist are listed. */
@Composable
private fun FastScroller(
    sections: List<String>,
    onSection: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    var active by remember { mutableStateOf<String?>(null) }
    Box(modifier = modifier) {
        Column(
            verticalArrangement = Arrangement.SpaceEvenly,
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(sections) {
                    if (sections.isEmpty()) return@pointerInput
                    val pick: (Float) -> Unit = { y ->
                        val index = ((y / size.height) * sections.size).toInt().coerceIn(0, sections.lastIndex)
                        val section = sections[index]
                        if (section != active) {
                            active = section
                            onSection(section)
                        }
                    }
                    detectVerticalDragGestures(
                        onDragStart = { offset -> pick(offset.y) },
                        onDragEnd = { active = null },
                        onDragCancel = { active = null },
                    ) { change, _ -> pick(change.position.y) }
                },
        ) {
            sections.forEach { section ->
                Text(
                    text = section,
                    fontSize = 10.sp,
                    color = if (section == active) colors.primary else colors.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
        active?.let { section ->
            Surface(
                color = colors.primaryContainer,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(end = 36.dp)
                    .size(44.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(section, style = MaterialTheme.typography.titleLarge, color = colors.onPrimaryContainer)
                }
            }
        }
    }
}

@Composable
private fun AppMenu(
    entry: AppEntry,
    onDismiss: () -> Unit,
    onHome: () -> Unit,
    onDock: () -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.4f))
            .pointerInput(Unit) {
                detectTapGestures { onDismiss() }
            },
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surfaceContainerHigh,
            modifier = Modifier.padding(32.dp),
        ) {
            Column(modifier = Modifier.padding(vertical = 12.dp)) {
                Text(
                    text = entry.label,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
                MenuRow("Add to home") { onHome() }
                MenuRow("Add to dock") { onDock() }
                MenuRow("App info") { Launch.appInfo(context, entry.component); onDismiss() }
                MenuRow("Uninstall") { Launch.uninstall(context, entry.component); onDismiss() }
                Spacer(Modifier.height(4.dp))
                MenuRow("Cancel") { onDismiss() }
            }
        }
    }
}

@Composable
internal fun MenuRow(label: String, onClick: () -> Unit) {
    Text(
        text = label,
        style = MaterialTheme.typography.bodyLarge,
        modifier = Modifier
            .fillMaxWidth()
            .pointerInput(label) {
                detectTapGestures { onClick() }
            }
            .padding(horizontal = 24.dp, vertical = 14.dp),
    )
}
