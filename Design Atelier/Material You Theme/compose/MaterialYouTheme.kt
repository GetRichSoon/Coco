// Material You Design Theme for native Android (Jetpack Compose, Material 3).
// Setup (see THEME.md): copy this file + dist/compose/MaterialYouColors.kt into your app's
// ui/theme package (fix the package line), copy fonts/ttf/*.ttf into res/font/ renamed to
// fraunces.ttf, figtree.ttf, bagel_fat_one.ttf, then wrap your UI in MaterialYouTheme { ... }.
package com.getrichsoon.theme

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** Pass your app's font families (built from res/font) — see THEME.md for the exact snippet. */
data class MuFonts(
    val display: FontFamily = FontFamily.Serif,
    val body: FontFamily = FontFamily.SansSerif,
    val fun_: FontFamily = FontFamily.Default,
)

fun muTypography(f: MuFonts): Typography {
    fun d(size: Int, line: Float, w: Int, track: Float) =
        TextStyle(fontFamily = f.display, fontSize = size.sp, lineHeight = (size * line).sp, fontWeight = FontWeight(w), letterSpacing = track.em)
    fun b(size: Int, line: Float, w: Int) =
        TextStyle(fontFamily = f.body, fontSize = size.sp, lineHeight = (size * line).sp, fontWeight = FontWeight(w))
    return Typography(
        displayLarge = d(56, 1.05f, 900, -0.02f), displayMedium = d(40, 1.1f, 900, -0.015f), displaySmall = d(32, 1.15f, 800, -0.01f),
        headlineLarge = d(28, 1.2f, 700, 0f), headlineMedium = d(24, 1.25f, 700, 0f), headlineSmall = d(20, 1.3f, 700, 0f),
        titleLarge = b(20, 1.3f, 700), titleMedium = b(16, 1.4f, 600), titleSmall = b(14, 1.4f, 600),
        bodyLarge = b(16, 1.5f, 400), bodyMedium = b(14, 1.5f, 400), bodySmall = b(12, 1.45f, 400),
        labelLarge = b(14, 1.3f, 700), labelMedium = b(12, 1.3f, 600), labelSmall = b(11, 1.3f, 600),
    )
}

val MuShapeScale = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun MaterialYouTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    fonts: MuFonts = MuFonts(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) MaterialYouDarkColors else MaterialYouLightColors,
        typography = remember(fonts) { muTypography(fonts) },
        shapes = MuShapeScale,
        content = content,
    )
}

// ---------------------------------------------------------------------------
// Shapes + looping motion
// ---------------------------------------------------------------------------

/** Path for a library shape, or a morph from [from] to [to] at [t] (0..1). */
fun muShapePath(size: Size, from: FloatArray, to: FloatArray = from, t: Float = 0f, rotation: Float = 0f): Path {
    val n = from.size
    val cx = size.width / 2f; val cy = size.height / 2f; val r = min(cx, cy)
    val pts = Array(n) { i ->
        val k = from[i] + (to[i] - from[i]) * t
        val a = i.toFloat() / n * 2f * PI.toFloat() - PI.toFloat() / 2f + rotation
        Offset(cx + cos(a) * r * k, cy + sin(a) * r * k)
    }
    return Path().apply {
        moveTo(pts[0].x, pts[0].y)
        for (i in 0 until n) {
            val p0 = pts[(i - 1 + n) % n]; val p1 = pts[i]; val p2 = pts[(i + 1) % n]; val p3 = pts[(i + 2) % n]
            val c1 = p1 + (p2 - p0) / 6f; val c2 = p2 - (p3 - p1) / 6f
            cubicTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y)
        }
        close()
    }
}

/** Use a library shape anywhere a Shape is accepted: Modifier.clip(MuShape(MuShapes.cookie)). */
class MuShape(private val radii: FloatArray) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density) =
        Outline.Generic(muShapePath(size, radii))
}

/** True when the user turned animations off (Settings > Accessibility > Remove animations). */
@Composable
fun muMotionOff(): Boolean {
    val ctx = LocalContext.current
    return remember {
        Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

/** The signature loop: morphs cookie -> flower -> clover -> sunny -> circle while slowly spinning. */
@Composable
fun MuMorphShape(
    modifier: Modifier = Modifier,
    size: Dp = 160.dp,
    color: Color = MaterialTheme.colorScheme.primary,
    sequence: List<FloatArray> = listOf(MuShapes.cookie, MuShapes.flower, MuShapes.clover, MuShapes.sunny, MuShapes.circle),
) {
    val off = muMotionOff()
    val tr = rememberInfiniteTransition(label = "mu-morph")
    val v by tr.animateFloat(0f, 1f, infiniteRepeatable(tween(MuMotion.loopMorph, easing = LinearEasing)), label = "v")
    val spin by tr.animateFloat(0f, 2f * PI.toFloat(), infiniteRepeatable(tween(MuMotion.loopSpin, easing = LinearEasing)), label = "spin")
    Canvas(modifier.size(size)) {
        val value = if (off) 0f else v
        val pos = value * sequence.size
        val i = pos.toInt() % sequence.size
        val local = pos - pos.toInt()
        val raw = ((local - 0.4f) / 0.6f).coerceIn(0f, 1f)
        val t = raw * raw * (3f - 2f * raw) // smoothstep, close to the CSS loop curve
        drawPath(muShapePath(this.size, sequence[i], sequence[(i + 1) % sequence.size], t, if (off) 0f else spin), color)
    }
}

enum class MuLoopKind { Spin, Float, Wobble, Breathe }

/** Slow decorative loop for stickers and the one CTA: Modifier.muLoop(MuLoopKind.Float). */
@Composable
fun Modifier.muLoop(kind: MuLoopKind, reverse: Boolean = false): Modifier {
    if (muMotionOff()) return this
    val period = when (kind) {
        MuLoopKind.Spin -> MuMotion.loopSpin
        MuLoopKind.Float -> MuMotion.loopFloat
        MuLoopKind.Wobble -> MuMotion.loopWobble
        MuLoopKind.Breathe -> MuMotion.loopBreathe
    }
    val tr = rememberInfiniteTransition(label = "mu-loop")
    val v by tr.animateFloat(0f, 1f, infiniteRepeatable(tween(period, easing = LinearEasing), RepeatMode.Restart), label = "v")
    return graphicsLayer {
        val p = if (reverse) 1f - v else v
        val wave = sin(p * 2f * PI.toFloat())
        when (kind) {
            MuLoopKind.Spin -> rotationZ = p * 360f
            MuLoopKind.Float -> translationY = -8.dp.toPx() * (wave + 1f) / 2f
            MuLoopKind.Wobble -> rotationZ = wave * 4f
            MuLoopKind.Breathe -> { val s = 1f + 0.02f * (wave + 1f); scaleX = s; scaleY = s }
        }
    }
}
