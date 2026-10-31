package com.coco.launcher.widgets

import android.appwidget.AppWidgetProviderInfo
import android.widget.FrameLayout
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * A live widget on the home grid. If the host cannot produce a view the entry is reported as
 * missing so the layout drops it, which is what happens when a widget's app is uninstalled while
 * the launcher is not running.
 */
@Composable
fun WidgetFrame(
    controller: WidgetController,
    widgetId: Int,
    widthDp: Dp,
    heightDp: Dp,
    onMissing: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val hostView = remember(widgetId) { controller.createView(context, widgetId) }

    LaunchedEffect(widgetId, hostView) { if (hostView == null) onMissing() }
    if (hostView == null) return

    AndroidView(
        factory = { ctx ->
            FrameLayout(ctx).apply {
                clipChildren = true
                (hostView.parent as? FrameLayout)?.removeView(hostView)
                addView(hostView)
            }
        },
        update = { controller.resize(hostView, widthDp.value.toInt(), heightDp.value.toInt()) },
        modifier = modifier.clip(RoundedCornerShape(20.dp)),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WidgetPickerSheet(
    controller: WidgetController,
    onPick: (AppWidgetProviderInfo) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val providers = remember { controller.providers() }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Text(
            text = "Widgets",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(start = 24.dp, end = 24.dp, bottom = 8.dp),
        )
        if (providers.isEmpty()) {
            Text(
                text = "No widgets are installed on this device.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(24.dp),
            )
            return@ModalBottomSheet
        }
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 520.dp)
                .padding(horizontal = 16.dp),
        ) {
            items(items = providers, key = { it.provider.flattenToShortString() + it.configure }) { info ->
                WidgetRow(info = info, onClick = { onPick(info) })
            }
            item { Box(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun WidgetRow(info: AppWidgetProviderInfo, onClick: () -> Unit) {
    val context = LocalContext.current
    val colors = MaterialTheme.colorScheme
    val label = remember(info) {
        runCatching { info.loadLabel(context.packageManager) }.getOrNull().orEmpty()
            .ifEmpty { info.provider.shortClassName }
    }
    val preview by produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, info) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val drawable = info.loadPreviewImage(context, 0) ?: info.loadIcon(context, 0)
                drawable?.toBitmap(
                    width = drawable.intrinsicWidth.coerceIn(48, 480),
                    height = drawable.intrinsicHeight.coerceIn(48, 480),
                )?.asImageBitmap()
            }.getOrNull()
        }
    }

    Surface(
        color = colors.surfaceContainerHigh,
        shape = RoundedCornerShape(20.dp),
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(14.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(14.dp)),
            ) {
                preview?.let { Image(bitmap = it, contentDescription = null, modifier = Modifier.fillMaxSize()) }
            }
            Column(modifier = Modifier.padding(start = 14.dp)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = runCatching { info.provider.packageName }.getOrNull().orEmpty(),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
