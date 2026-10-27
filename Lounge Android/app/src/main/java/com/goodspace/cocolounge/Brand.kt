package com.goodspace.cocolounge

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/** Theme shape library: 96 polar radii per shape, so any shape morphs smoothly into any other. */
object MuShapes {
    private const val N = 96
    private fun wave(k: Int, depth: Float, phase: Float = 0f) = FloatArray(N) { i -> 1f - depth * (0.5f + 0.5f * cos((i.toFloat() / N) * 2f * PI.toFloat() * k + phase)) }
    private fun lobes(k: Int, depth: Float) = FloatArray(N) { i -> val t = (i.toFloat() / N) * k * 2f * PI.toFloat(); 1f - depth * abs(sin(t / 2f)).toDouble().pow(1.6).toFloat() }
    val cookie = wave(12, 0.13f); val flower = lobes(6, 0.17f); val clover = lobes(4, 0.25f); val sunny = wave(8, 0.2f)
    val burst = wave(12, 0.33f); val soft = wave(10, 0.2f, 0.3f); val wavy = wave(16, 0.09f)
    val blob = FloatArray(N) { i -> 0.78f + 0.22f * abs(cos((i.toFloat() / N) * PI.toFloat())) }
    val circle = FloatArray(N) { 1f }
    const val COUNT = N
}

/** A team mark: who, colours, symbol, and the shapes it keeps morphing through. */
data class Mark(val name: String, val bg: Color, val fg: Color, val icon: ImageVector, val shapes: List<FloatArray>, val spin: Float = 8f)

object Marks {
    private val S = MuShapes
    val coco = Mark("Coco", Mu.plum, Mu.bubblegum, Icons.Rounded.WorkspacePremium, listOf(S.sunny, S.flower, S.wavy, S.cookie))
    // Kept in step with Lounge/identity.json, which is where these values are written down for all
    // four clients. Poppy, Mochi and Tilly are houses that exist in Coco Cloud and had no mark, so
    // the desktop drew them as grey initials while their neighbours had faces.
    val houses = mapOf(
        "gigi" to Mark("Gigi", Mu.tomato, Mu.cream, Icons.Rounded.PlayArrow, listOf(S.cookie, S.wavy, S.sunny, S.flower)),
        "lulu" to Mark("Lulu", Mu.cobalt, Mu.sky, Icons.Rounded.Extension, listOf(S.clover, S.soft, S.wavy, S.cookie), -7f),
        "fifi" to Mark("Fifi", Mu.butter, Mu.cocoa, Icons.Rounded.MenuBook, listOf(S.flower, S.blob, S.cookie, S.wavy)),
        "zaza" to Mark("Zaza", Mu.forest, Mu.butter, Icons.Rounded.SportsEsports, listOf(S.burst, S.sunny, S.soft, S.clover), -9f),
        "poppy" to Mark("Poppy", Mu.plum, Mu.butter, Icons.Rounded.AutoStories, listOf(S.flower, S.cookie, S.soft, S.blob), 7f),
        "mochi" to Mark("Mochi", Mu.cobalt, Mu.bubblegum, Icons.Rounded.Draw, listOf(S.blob, S.clover, S.wavy, S.soft), -8f),
        "tilly" to Mark("Tilly", Mu.forest, Mu.cream, Icons.Rounded.Storefront, listOf(S.clover, S.cookie, S.sunny, S.wavy), 6f),
    )
    val members = mapOf(
        "lola" to Mark("Lola", Mu.marigold, Mu.ink, Icons.Rounded.Lightbulb, listOf(S.sunny, S.burst, S.cookie)),
        "lili" to Mark("Lili", Mu.sky, Mu.ink, Icons.Rounded.QueryStats, listOf(S.wavy, S.circle, S.soft), -6f),
        "remy" to Mark("Remy", Mu.cocoa, Mu.cream, Icons.Rounded.Construction, listOf(S.cookie, S.clover, S.soft)),
        "vivi" to Mark("Vivi", Mu.bubblegum, Mu.plum, Icons.Rounded.Palette, listOf(S.flower, S.blob, S.wavy), -8f),
        "margot" to Mark("Margot", Mu.wine, Mu.marigold, Icons.Rounded.Edit, listOf(S.soft, S.flower, S.cookie)),
        "cleo" to Mark("Cleo", Mu.tomato, Mu.ink, Icons.Rounded.Movie, listOf(S.burst, S.cookie, S.sunny), -7f),
        "elise" to Mark("Elise", Mu.forest, Mu.butter, Icons.Rounded.Verified, listOf(S.cookie, S.wavy, S.clover)),
        "kiki" to Mark("Kiki", Mu.cobalt, Mu.sky, Icons.Rounded.RocketLaunch, listOf(S.burst, S.soft, S.sunny), -9f),
        "didi" to Mark("Didi", Mu.cherry, Mu.cream, Icons.Rounded.Forum, listOf(S.blob, S.flower, S.wavy)),
        "bibi" to Mark("Bibi", Mu.butter, Mu.cocoa, Icons.Rounded.Payments, listOf(S.clover, S.cookie, S.blob), -6f),
        "pixie" to Mark("Pixie", Mu.sky, Mu.ink, Icons.Rounded.TaskAlt, listOf(S.wavy, S.circle, S.soft), 7f),
        "nono" to Mark("Nono", Mu.cocoa, Mu.butter, Icons.Rounded.HealthAndSafety, listOf(S.soft, S.blob, S.cookie), -7f),
    )

    /** The company core itself, which is not a house and not a helper. */
    val core = Mark("Core", Mu.plum, Mu.sky, Icons.Rounded.Hub, listOf(S.sunny, S.wavy, S.soft), 6f)

    /** Whatever this id is - house, helper or the core - the one mark it wears everywhere. */
    fun of(id: String?): Mark? {
        val k = id?.lowercase()?.trim() ?: return null
        return when (k) {
            "core" -> core
            "coco" -> coco
            else -> houses[k] ?: members[k]
        }
    }
}

/** Angles of the 96 outline points, worked out once (the outline is redrawn every frame). */
private val MARK_COS = FloatArray(MuShapes.COUNT) { k -> cos((k.toFloat() / MuShapes.COUNT) * 2f * PI.toFloat() - PI.toFloat() / 2f) }
private val MARK_SIN = FloatArray(MuShapes.COUNT) { k -> sin((k.toFloat() / MuShapes.COUNT) * 2f * PI.toFloat() - PI.toFloat() / 2f) }

private fun easeInOut(x: Float) = if (x < 0.5f) 4 * x * x * x else 1 - (-2 * x + 2).toDouble().pow(3.0).toFloat() / 2

/** Living logo: the shape morphs, turns and breathes; only drawing changes, so it stays smooth at 60 fps. */
@Composable
fun LivingMark(mark: Mark, size: Dp, modifier: Modifier = Modifier) {
    val calm = LocalCalm.current
    val t = rememberInfiniteTransition(label = "mark-${mark.name}")
    val cycle by t.animateFloat(0f, mark.shapes.size.toFloat(), infiniteRepeatable(tween(3200 * mark.shapes.size, easing = LinearEasing)), label = "morph")
    val turn by t.animateFloat(0f, 360f, infiniteRepeatable(tween((360f / kotlin.math.abs(mark.spin) * 1000).toInt(), easing = LinearEasing)), label = "turn")
    val breathe by t.animateFloat(0.97f, 1.03f, infiniteRepeatable(tween(1800), RepeatMode.Reverse), label = "breathe")
    val p = androidx.compose.runtime.remember { Path() }   // one outline, reused every frame (no garbage while it moves)
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size).graphicsLayer { val s = if (calm) 1f else breathe; scaleX = s; scaleY = s }) {
            val c = if (calm) 0f else cycle
            val i = c.toInt() % mark.shapes.size; val f = easeInOut(c - c.toInt())
            val a = mark.shapes[i]; val b = mark.shapes[(i + 1) % mark.shapes.size]
            val r = this.size.minDimension / 2f * 0.96f; val cx = this.size.width / 2f; val cy = this.size.height / 2f
            p.reset()
            for (k in 0 until MuShapes.COUNT) {
                val rr = (a[k] + (b[k] - a[k]) * f) * r
                val x = cx + MARK_COS[k] * rr; val y = cy + MARK_SIN[k] * rr
                if (k == 0) p.moveTo(x, y) else p.lineTo(x, y)
            }
            p.close()
            rotate(if (calm) 0f else turn * kotlin.math.sign(mark.spin)) { drawPath(p, mark.bg) }
        }
        Icon(mark.icon, mark.name, tint = mark.fg, modifier = Modifier.size(size * 0.42f))
    }
}

/** Small platform marks so every channel shows where it lives. Simple shapes in each platform's colours. */
@Composable
fun PlatformMark(platform: String, size: Dp = 28.dp) {
    Canvas(Modifier.size(size)) {
        val w = this.size.width; val h = this.size.height
        when (platform) {
            "youtube" -> {
                drawRoundRect(Color(0xFFFF0033), Offset(0f, h * 0.18f), Size(w, h * 0.64f), CornerRadius(w * 0.22f))
                val tri = Path().apply { moveTo(w * 0.40f, h * 0.34f); lineTo(w * 0.68f, h * 0.5f); lineTo(w * 0.40f, h * 0.66f); close() }
                drawPath(tri, Color.White)
            }
            "play" -> {
                val tri = Path().apply { moveTo(w * 0.18f, h * 0.08f); lineTo(w * 0.88f, h * 0.5f); lineTo(w * 0.18f, h * 0.92f); close() }
                drawPath(tri, Color(0xFF00C853))
                drawPath(Path().apply { moveTo(w * 0.18f, h * 0.08f); lineTo(w * 0.62f, h * 0.5f); lineTo(w * 0.18f, h * 0.5f); close() }, Color(0xFF2196F3))
                drawPath(Path().apply { moveTo(w * 0.18f, h * 0.92f); lineTo(w * 0.62f, h * 0.5f); lineTo(w * 0.18f, h * 0.5f); close() }, Color(0xFFFF3D00))
                drawPath(Path().apply { moveTo(w * 0.62f, h * 0.5f); lineTo(w * 0.88f, h * 0.5f); lineTo(w * 0.74f, h * 0.36f); close() }, Color(0xFFFFC400))
            }
            "chrome" -> {
                drawArc(Color(0xFFDB4437), -150f, 120f, true); drawArc(Color(0xFFF4B400), -30f, 120f, true); drawArc(Color(0xFF0F9D58), 90f, 120f, true)
                drawCircle(Color.White, w * 0.24f); drawCircle(Color(0xFF4285F4), w * 0.18f)
            }
            "roblox" -> rotate(15f) { drawRoundRect(Color(0xFF2B1712), Offset(w * 0.12f, h * 0.12f), Size(w * 0.76f, h * 0.76f), CornerRadius(w * 0.08f)); drawRect(Color.White, Offset(w * 0.42f, h * 0.42f), Size(w * 0.16f, h * 0.16f)) }
            "social" -> {
                drawRoundRect(Color(0xFFE1306C), Offset(w * 0.08f, h * 0.08f), Size(w * 0.84f, h * 0.84f), CornerRadius(w * 0.26f))
                drawCircle(Color.White, w * 0.2f, style = Stroke(w * 0.08f)); drawCircle(Color.White, w * 0.05f, Offset(w * 0.72f, h * 0.28f))
            }
            else -> { drawCircle(Color(0xFF2F55C4)); drawCircle(Color.White, w * 0.32f, style = Stroke(w * 0.07f)); drawLine(Color.White, Offset(w * 0.18f, h * 0.5f), Offset(w * 0.82f, h * 0.5f), w * 0.07f) }
        }
    }
}
