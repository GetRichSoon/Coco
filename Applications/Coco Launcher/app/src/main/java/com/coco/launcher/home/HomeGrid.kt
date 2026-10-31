package com.coco.launcher.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.coco.launcher.apps.AppEntry
import com.coco.launcher.gestures.HomeDrag
import com.coco.launcher.gestures.homeItemGestures
import com.coco.launcher.storage.Settings
import com.coco.launcher.widgets.WidgetController
import com.coco.launcher.widgets.WidgetFrame
import kotlin.math.roundToInt

/**
 * The single home page. Everything is positioned in grid cells, so the same saved layout lands in
 * the right place on a 5x5 phone grid and a 7x5 tablet one. Dragging moves an item; a drop on an
 * occupied or off-grid cell springs back instead of silently swallowing the icon.
 */
@Composable
fun HomeGrid(
    layout: HomeLayout,
    appsByKey: Map<String, AppEntry>,
    settings: Settings,
    widgets: WidgetController,
    onLayout: (HomeLayout) -> Unit,
    onItemMenu: (HomeItem) -> Unit,
    onVerticalSwipe: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cols = settings.homeColumns
    val rows = settings.homeRows
    val density = LocalDensity.current

    BoxWithConstraints(modifier = modifier) {
        val cellWidth = maxWidth / cols
        val cellHeight = maxHeight / rows
        val cellWidthPx = with(density) { cellWidth.toPx() }
        val cellHeightPx = with(density) { cellHeight.toPx() }

        var dragKey by remember { mutableStateOf<String?>(null) }
        var dragDelta by remember { mutableStateOf(Offset.Zero) }
        var selectedWidget by remember { mutableStateOf<String?>(null) }

        layout.items.forEach { item ->
            val dragging = dragKey == item.key
            val base = Offset(item.x * cellWidthPx, item.y * cellHeightPx)
            val position = if (dragging) base + dragDelta else base

            val handlers = remember(item, cellWidthPx, cellHeightPx, cols, rows) {
                HomeDrag(
                    onStart = { dragKey = item.key; dragDelta = Offset.Zero },
                    onDrag = { dragDelta += it },
                    onEnd = { cancelled ->
                        if (!cancelled) {
                            commitDrop(
                                layout = layout,
                                item = item,
                                position = base + dragDelta,
                                cellWidthPx = cellWidthPx,
                                cellHeightPx = cellHeightPx,
                                cols = cols,
                                rows = rows,
                                onLayout = onLayout,
                            )
                        }
                        dragKey = null
                        dragDelta = Offset.Zero
                    },
                    onVerticalSwipe = onVerticalSwipe,
                )
            }

            Box(
                modifier = Modifier
                    .offset { IntOffset(position.x.roundToInt(), position.y.roundToInt()) }
                    .size(cellWidth * item.spanX, cellHeight * item.spanY)
                    .then(if (dragging) Modifier.scale(1.08f).alpha(0.9f) else Modifier),
            ) {
                when (item.kind) {
                    ItemKind.App -> {
                        val entry = appsByKey[item.key]
                        if (entry == null) {
                            // The app was uninstalled: drop the tile rather than leave a hole. Done
                            // as an effect, never during composition, or it would retrigger forever.
                            LaunchedEffect(item.key, appsByKey.size) {
                                if (appsByKey.isNotEmpty()) onLayout(layout.remove(item.key))
                            }
                        } else {
                            AppTile(
                                entry = entry,
                                iconSize = settings.iconSizeDp.dp,
                                showLabel = settings.showLabels,
                                themedIcons = settings.themedIcons,
                                labelOnWallpaper = true,
                                onLongPress = { onItemMenu(item) },
                                drag = handlers,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(2.dp),
                            )
                        }
                    }

                    ItemKind.Widget -> {
                        val id = item.key.toIntOrNull()
                        if (id == null) {
                            LaunchedEffect(item.key) { onLayout(layout.remove(item.key)) }
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(4.dp)
                                    .then(
                                        if (selectedWidget == item.key) {
                                            Modifier.border(
                                                2.dp,
                                                MaterialTheme.colorScheme.primary,
                                                RoundedCornerShape(20.dp),
                                            )
                                        } else {
                                            Modifier
                                        },
                                    )
                                    // Gestures sit on the frame, not over the widget: anything the
                                    // widget's own views handle (a tap on the clock) is consumed by
                                    // them first, and what they ignore reaches the launcher.
                                    .homeItemGestures(
                                        key = "frame" + item.key,
                                        onTap = { selectedWidget = null },
                                        onLongPress = { selectedWidget = item.key },
                                        handlers = handlers,
                                    ),
                            ) {
                                WidgetFrame(
                                    controller = widgets,
                                    widgetId = id,
                                    widthDp = cellWidth * item.spanX,
                                    heightDp = cellHeight * item.spanY,
                                    onMissing = {
                                        widgets.delete(id)
                                        onLayout(layout.remove(item.key))
                                    },
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }

                            if (selectedWidget == item.key) {
                                WidgetHandles(
                                    item = item,
                                    cellWidthPx = cellWidthPx,
                                    cellHeightPx = cellHeightPx,
                                    cols = cols,
                                    rows = rows,
                                    layout = layout,
                                    onLayout = onLayout,
                                    onRemove = {
                                        selectedWidget = null
                                        widgets.delete(id)
                                        onLayout(layout.remove(item.key))
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Drop onto the nearest cell, but only if the item actually fits there. */
private fun commitDrop(
    layout: HomeLayout,
    item: HomeItem,
    position: Offset,
    cellWidthPx: Float,
    cellHeightPx: Float,
    cols: Int,
    rows: Int,
    onLayout: (HomeLayout) -> Unit,
) {
    if (cellWidthPx <= 0f || cellHeightPx <= 0f) return
    val targetX = (position.x / cellWidthPx).roundToInt().coerceIn(0, (cols - item.spanX).coerceAtLeast(0))
    val targetY = (position.y / cellHeightPx).roundToInt().coerceIn(0, (rows - item.spanY).coerceAtLeast(0))
    if (targetX == item.x && targetY == item.y) return
    layout.place(cols, rows, item.copy(x = targetX, y = targetY))?.let(onLayout)
}

/** Resize and remove controls for the selected widget: drag the corner, tap the cross. */
@Composable
private fun WidgetHandles(
    item: HomeItem,
    cellWidthPx: Float,
    cellHeightPx: Float,
    cols: Int,
    rows: Int,
    layout: HomeLayout,
    onLayout: (HomeLayout) -> Unit,
    onRemove: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    var accumulated by remember(item.key) { mutableStateOf(Offset.Zero) }

    Box(modifier = Modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .size(28.dp)
                .background(colors.errorContainer, CircleShape)
                .pointerInput(item.key) { detectTapGestures { onRemove() } },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Rounded.Close,
                contentDescription = "Remove widget",
                tint = colors.onErrorContainer,
                modifier = Modifier.size(16.dp),
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(30.dp)
                .background(colors.primary, CircleShape)
                .border(2.dp, Color.White.copy(alpha = 0.7f), CircleShape)
                .pointerInput(item.key, cellWidthPx, cellHeightPx) {
                    detectDragGestures(
                        onDragEnd = { accumulated = Offset.Zero },
                        onDragCancel = { accumulated = Offset.Zero },
                    ) { _, delta ->
                        accumulated += delta
                        // One whole cell of travel equals one cell of span, in either direction.
                        val stepX = (accumulated.x / cellWidthPx).toInt()
                        val stepY = (accumulated.y / cellHeightPx).toInt()
                        if (stepX != 0 || stepY != 0) {
                            val candidate = item.copy(
                                spanX = (item.spanX + stepX).coerceIn(1, cols - item.x),
                                spanY = (item.spanY + stepY).coerceIn(1, rows - item.y),
                            )
                            if (candidate.spanX != item.spanX || candidate.spanY != item.spanY) {
                                layout.place(cols, rows, candidate)?.let {
                                    onLayout(it)
                                    accumulated = Offset.Zero
                                }
                            }
                        }
                    }
                },
        )
    }
}
