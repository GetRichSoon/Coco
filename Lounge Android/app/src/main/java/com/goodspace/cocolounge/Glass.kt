package com.goodspace.cocolounge

import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * iOS 26 style "liquid glass" for the floating bars (Boss, 2026-10-25: "transparent like iPhone"). The screen content
 * is recorded once into a layer and drawn as usual; a glass bar draws the part of that layer that lies behind it,
 * blurred, with a light tint and a soft bright edge. Android 12+ (RenderEffect); older phones get a solid tonal bar.
 */
class Backdrop(internal val layer: GraphicsLayer) {
    internal var origin = Offset.Zero
    /** Bumped every time the content draws, so the glass redraws with it (scrolling, animations). */
    internal var version by mutableIntStateOf(0)
}

@Composable
fun rememberBackdrop(): Backdrop {
    val layer = rememberGraphicsLayer()
    return remember(layer) { Backdrop(layer) }
}

/** The content the glass shows through. */
fun Modifier.backdropSource(b: Backdrop): Modifier = this
    .onGloballyPositioned { b.origin = it.positionInRoot() }
    .drawWithContent {
        b.layer.record { this@drawWithContent.drawContent() }
        drawLayer(b.layer)
        b.version++
    }

/** A glass surface: blurred backdrop, tint, bright top edge. Put it on the bar's outermost modifier. */
fun Modifier.glass(b: Backdrop, shape: Shape, tint: Color, blur: Dp = 26.dp): Modifier = composed {
    val blurred = rememberGraphicsLayer()
    var me = remember { arrayOf(Offset.Zero) }
    this
        .onGloballyPositioned { me[0] = it.positionInRoot() }
        .drawWithContent {
            val outline = shape.createOutline(size, layoutDirection, this)
            if (Build.VERSION.SDK_INT >= 31) {
                @Suppress("UNUSED_VARIABLE") val v = b.version   // read: redraw whenever the content redraws
                val path = Path().apply { addOutline(outline) }
                blurred.renderEffect = BlurEffect(blur.toPx(), blur.toPx(), TileMode.Clamp)
                blurred.record { translate(b.origin.x - me[0].x, b.origin.y - me[0].y) { drawLayer(b.layer) } }
                clipPath(path) {
                    drawLayer(blurred)
                    drawRect(tint)
                }
            } else {
                drawOutline(outline, tint.copy(alpha = 1f))
            }
            // the glass edge: brighter on top, fading down, like light catching the rim
            drawOutline(outline, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.32f), Color.White.copy(alpha = 0.04f))), style = Stroke(1.dp.toPx()))
            drawContent()
        }
}
