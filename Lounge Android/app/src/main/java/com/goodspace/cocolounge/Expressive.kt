package com.goodspace.cocolounge

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Material 3 Expressive pieces for the Good Space theme (Design Atelier THEME.md): spring motion, buttons that shift
 * from pill to rounded square while pressed, cards that give a little under the finger, a floating navigation pill,
 * drifting colour blobs behind heroes and a wavy "working" line. "Calm motion" (LocalCalm) stops every loop.
 */
object MuMotion {
    /** Spatial springs (position, size, shape): a little bounce, like the Expressive motion scheme. */
    fun <T> spatial(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.8f, stiffness = 380f)
    fun <T> spatialFast(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.6f, stiffness = 800f)
    fun <T> spatialSlow(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.8f, stiffness = 200f)
    /** Effect springs (colour, alpha): no bounce. */
    fun <T> effects(): FiniteAnimationSpec<T> = spring(dampingRatio = 1f, stiffness = 1600f)
}

/** Pill at rest, rounded square while pressed (THEME.md 4: the Expressive shape-shift). */
@Composable
private fun shiftShape(src: MutableInteractionSource): RoundedCornerShape {
    val pressed by src.collectIsPressedAsState()
    val r by animateDpAsState(if (pressed) 12.dp else 28.dp, MuMotion.spatialFast(), label = "shape-shift")
    return RoundedCornerShape(r)
}

@Composable
fun MuButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, colors: ButtonColors = ButtonDefaults.buttonColors(), content: @Composable RowScope.() -> Unit) {
    val src = remember { MutableInteractionSource() }
    val edge = LocalCocoRoles.current.ctaEdge
    Button(onClick, modifier, enabled, shape = shiftShape(src), colors = colors, border = if (edge.alpha > 0f) BorderStroke(1.dp, edge) else null, interactionSource = src, content = content)
}

@Composable
fun MuTonal(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, colors: ButtonColors = ButtonDefaults.filledTonalButtonColors(), content: @Composable RowScope.() -> Unit) {
    val src = remember { MutableInteractionSource() }
    FilledTonalButton(onClick, modifier, enabled, shape = shiftShape(src), colors = colors, interactionSource = src, content = content)
}

@Composable
fun MuOutlined(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) {
    val src = remember { MutableInteractionSource() }
    OutlinedButton(onClick, modifier, enabled, shape = shiftShape(src), colors = ButtonDefaults.outlinedButtonColors(contentColor = LocalCocoRoles.current.link), interactionSource = src, content = content)
}

/** Click that gives a little under the finger (scale spring), for whole cards and tiles. */
fun Modifier.bounceClick(onClick: () -> Unit): Modifier = composed {
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed) 0.96f else 1f, MuMotion.spatialFast(), label = "bounce")
    graphicsLayer { scaleX = s; scaleY = s }.clickable(interactionSource = src, indication = ripple(), onClick = onClick)
}

/**
 * The floating navigation pill: the chosen tab stretches (spring) and shows its name, the others keep only the icon.
 * Fits any phone width because the parts share the row by weight.
 */
@Composable
fun FloatingNav(current: Tab, badge: Int, onPick: (Tab) -> Unit, modifier: Modifier = Modifier, backdrop: Backdrop? = null, labels: (Tab) -> String = { it.label }) {
    CocoPanel {
        val cs = MaterialTheme.colorScheme; val r = LocalCocoRoles.current
        val shape = RoundedCornerShape(36.dp)
        Box(
            modifier.navigationBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp).fillMaxWidth()
                .shadow(14.dp, shape, clip = false, ambientColor = Color.Black.copy(alpha = 0.35f), spotColor = Color.Black.copy(alpha = 0.35f))
                .then(if (backdrop != null) Modifier.glass(backdrop, shape, r.cardSurface.copy(alpha = 0.62f)) else Modifier.background(r.cardSurface, shape).border(1.dp, cs.outlineVariant, shape)),
        ) {
            Row(Modifier.padding(6.dp).height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                Tab.entries.forEach { t ->
                    val sel = t == current
                    val weight by animateFloatAsState(if (sel) 2.3f else 1f, MuMotion.spatial(), label = "nav-weight")
                    val bg by animateColorAsState(if (sel) cs.primaryContainer else Color.Transparent, MuMotion.effects(), label = "nav-bg")
                    val fg by animateColorAsState(if (sel) cs.onPrimaryContainer else cs.onSurfaceVariant, MuMotion.effects(), label = "nav-fg")
                    Box(
                        Modifier.weight(weight).fillMaxHeight().clip(RoundedCornerShape(28.dp)).background(bg)
                            .clickable { onPick(t) }
                            .semantics { contentDescription = labels(t); role = Role.Tab; selected = sel },
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            BadgedBox(badge = { if (t == Tab.Work && badge > 0) Badge { Text("$badge") } }) { Icon(t.icon, null, tint = fg) }
                            AnimatedVisibility(sel, enter = fadeIn(MuMotion.effects()) + expandHorizontally(MuMotion.spatial()), exit = fadeOut(tween(90)) + shrinkHorizontally(MuMotion.spatial())) {
                                Text(labels(t), Modifier.padding(start = 8.dp), color = fg, style = MaterialTheme.typography.labelLarge, maxLines = 1, softWrap = false)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Soft colour blobs drifting slowly behind a hero (THEME.md loop "Drift", 22 s). Still when Calm motion is on. */
@Composable
fun DriftBlobs(colors: List<Color>, modifier: Modifier = Modifier) {
    val calm = LocalCalm.current
    val t by rememberInfiniteTransition(label = "drift").animateFloat(0f, 1f, infiniteRepeatable(tween(22_000, easing = LinearEasing)), label = "drift-t")
    // Gradients are made once per size (drawWithCache); each frame only moves them.
    Spacer(modifier.drawWithCache {
        val r = size.minDimension * 0.62f
        val brushes = colors.map { c -> Brush.radialGradient(listOf(c.copy(alpha = 0.5f), c.copy(alpha = 0f)), center = Offset.Zero, radius = r) }
        onDrawBehind {
            brushes.forEachIndexed { i, b ->
                val a = (if (calm) 0f else t) * 2f * PI.toFloat() + i * 2.1f
                translate(size.width * (0.5f + 0.38f * cos(a + i)), size.height * (0.5f + 0.32f * sin(a * 1.3f + i))) { drawCircle(b, r, Offset.Zero) }
            }
        }
    })
}

/** Wavy line that flows while work is happening (Expressive wavy progress, hand drawn). */
@Composable
fun WavyLine(color: Color, modifier: Modifier = Modifier, amplitude: Dp = 3.dp, wavelength: Dp = 22.dp) {
    val calm = LocalCalm.current
    val phase by rememberInfiniteTransition(label = "wavy").animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing)), label = "wavy-p")
    val p = remember { Path() }
    Canvas(modifier.height(amplitude * 2 + 4.dp)) {
        val a = amplitude.toPx(); val wl = wavelength.toPx(); val mid = size.height / 2
        val shift = (if (calm) 0f else phase) * wl
        p.reset()
        var x = 0f
        p.moveTo(0f, mid + a * sin((shift / wl) * 2f * PI.toFloat()))
        while (x < size.width) { x += 3f; p.lineTo(x, mid + a * sin(((x + shift) / wl) * 2f * PI.toFloat())) }
        drawPath(p, color, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** Three dots that bounce one after another: someone is typing / working. */
@Composable
fun TypingDots(color: Color, modifier: Modifier = Modifier) {
    val calm = LocalCalm.current
    val t by rememberInfiniteTransition(label = "dots").animateFloat(0f, 1f, infiniteRepeatable(tween(1100, easing = LinearEasing)), label = "dots-t")
    Canvas(modifier.size(22.dp, 8.dp)) {
        val r = 2.6.dp.toPx(); val gap = (size.width - 6 * r) / 2
        for (i in 0..2) {
            val f = if (calm) 0f else (sin(((t - i * 0.18f) * 2f * PI.toFloat())).coerceAtLeast(0f))
            drawCircle(color, r, Offset(r + i * (2 * r + gap), size.height / 2 - f * size.height * 0.35f))
        }
    }
}
