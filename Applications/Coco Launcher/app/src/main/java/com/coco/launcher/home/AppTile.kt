package com.coco.launcher.home

import android.graphics.Rect as AndroidRect
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coco.launcher.apps.AppEntry
import com.coco.launcher.apps.IconCache
import com.coco.launcher.apps.Launch
import com.coco.launcher.gestures.HomeDrag
import com.coco.launcher.gestures.homeItemGestures

/**
 * One app icon with its label. Used on the home grid, in the dock and in the drawer, so the icon
 * pipeline, the launch animation and the long-press menu exist once.
 */
@Composable
fun AppTile(
    entry: AppEntry,
    iconSize: Dp,
    showLabel: Boolean,
    themedIcons: Boolean,
    modifier: Modifier = Modifier,
    labelOnWallpaper: Boolean = false,
    onLongPress: (() -> Unit)? = null,
    drag: HomeDrag? = null,
) {
    val context = LocalContext.current
    val view = LocalView.current
    val density = LocalDensity.current
    val sizePx = remember(iconSize, density) { with(density) { iconSize.roundToPx() } }
    val colors = MaterialTheme.colorScheme
    val foreground = colors.onSurface.toArgb()
    val background = colors.surfaceContainerHigh.toArgb()

    // Peek first so a scroll back over an already-decoded icon shows no blank frame.
    val cached = remember(entry.key, sizePx, themedIcons, foreground, background) {
        IconCache.peek(IconCache.cacheKey(entry, sizePx, themedIcons, foreground, background))
    }
    val icon by produceState(cached, entry.key, sizePx, themedIcons, foreground, background) {
        if (value == null) {
            value = IconCache.icon(context, entry, sizePx, themedIcons, foreground, background)
        }
    }

    var bounds by remember { mutableStateOf<AndroidRect?>(null) }

    // One gesture installer per tile. The home grid needs drag and swipe forwarding; the drawer and
    // the dock only need tap and long press, so they get the plain detector.
    val gestures = if (drag != null) {
        Modifier.homeItemGestures(
            key = entry.key,
            onTap = { Launch.app(view, entry, bounds) },
            onLongPress = { onLongPress?.invoke() },
            handlers = drag,
        )
    } else {
        Modifier.pointerInput(entry.key, onLongPress) {
            detectTapGestures(
                onTap = { Launch.app(view, entry, bounds) },
                onLongPress = onLongPress?.let { action -> { action() } },
            )
        }
    }

    Column(
        modifier = modifier
            .onGloballyPositioned { coordinates ->
                val box = coordinates.boundsInRoot()
                val origin = IntArray(2).also { view.getLocationOnScreen(it) }
                bounds = AndroidRect(
                    origin[0] + box.left.toInt(),
                    origin[1] + box.top.toInt(),
                    origin[0] + box.right.toInt(),
                    origin[1] + box.bottom.toInt(),
                )
            }
            .then(gestures),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(modifier = Modifier.size(iconSize), contentAlignment = Alignment.Center) {
            val image = icon
            if (image != null) {
                Image(bitmap = image, contentDescription = entry.label, modifier = Modifier.size(iconSize))
            } else {
                // Placeholder keeps the grid from reflowing while an icon decodes.
                Box(
                    modifier = Modifier
                        .size(iconSize)
                        .alpha(0.25f)
                        .background(colors.onSurface, CircleShape),
                )
            }
        }
        if (showLabel) {
            Text(
                text = entry.label,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontSize = 11.sp,
                    shadow = if (labelOnWallpaper) {
                        Shadow(Color.Black.copy(alpha = 0.55f), blurRadius = 6f)
                    } else {
                        null
                    },
                ),
                color = if (labelOnWallpaper) Color.White else colors.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp, start = 2.dp, end = 2.dp),
            )
        }
    }
}
