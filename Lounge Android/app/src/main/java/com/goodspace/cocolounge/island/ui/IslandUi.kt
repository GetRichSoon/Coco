package com.goodspace.cocolounge.island.ui

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.SweepGradient
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodspace.cocolounge.island.model.AlertKind
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.model.ChargeLive
import com.goodspace.cocolounge.island.model.Face
import com.goodspace.cocolounge.island.model.IslandShapes
import com.goodspace.cocolounge.island.model.Live
import com.goodspace.cocolounge.island.model.MediaLive
import com.goodspace.cocolounge.island.model.NoteAction
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.model.TimerLive
import com.goodspace.cocolounge.island.model.StopwatchLive
import com.goodspace.cocolounge.island.model.NavLive
import com.goodspace.cocolounge.island.model.TorchLive
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.model.CalendarRules
import com.goodspace.cocolounge.island.model.Clock
import com.goodspace.cocolounge.island.util.MotionSpecs
import kotlin.math.abs

/** Everything the island can ask the app to do. Implemented by the overlay host. */
interface IslandActions {
    fun onTap(face: Face)
    fun onLongPress(face: Face)
    fun onSwipeUp(face: Face)
    fun onSwipeSide(step: Int)
    fun open(live: Live)
    fun dismiss(live: Live)
    fun mediaPlayPause(m: MediaLive)
    fun mediaNext(m: MediaLive)
    fun mediaPrev(m: MediaLive)
    fun timerToggle()
    fun timerAdd()
    fun timerCancel()
    fun noteAction(a: NoteAction)
    fun closeMenu()
    fun onBubbleTap(live: Live)
    fun sendReply(n: NoteLive, a: NoteAction, text: String)
    /** The size the pill (plus side bubble and glow) is drawn at this frame, so the window can follow it. */
    fun onVisualSize(width: Dp, height: Dp)
    fun cancelReply()
    fun stopwatchToggle()
    fun stopwatchLap()
    fun stopwatchReset()
    fun torchOff()
    fun joinEvent(e: EventLive)
}

/** Extra room around the pill inside its window so the glow is not clipped. */
val GlowMargin = 4.dp

@Composable
fun IslandRoot(face: Face, now: Long, screenOn: Boolean, motion: MotionSpecs, actions: IslandActions, nudge: Int = 0) {
    val ic = LocalIsland.current
    val shape = IslandShapes.of(face)
    val w by animateDpAsState(shape.width, motion.width(), label = "island-width")
    val h by animateDpAsState(shape.height, motion.height(), label = "island-height")
    val r by animateDpAsState(shape.radius, motion.radius(), label = "island-radius")
    val visible = face != Face.Hidden
    val alpha by animateFloatAsState(if (visible) 1f else 0f, if (motion.reduced) tween(0) else tween(180), label = "island-alpha")
    var pressed by remember { mutableStateOf(false) }
    val press by animateFloatAsState(if (pressed) 0.965f else 1f, motion.press(), label = "island-press")

    // The edge highlight only turns while something live is shown, the screen is on and animations are allowed.
    val spinning = visible && screenOn && !motion.reduced
    val angle = remember { mutableFloatStateOf(0f) }
    LaunchedEffect(spinning) {
        if (!spinning) return@LaunchedEffect
        var last = androidx.compose.runtime.withFrameNanos { it }
        while (true) {
            val t = androidx.compose.runtime.withFrameNanos { it }
            angle.floatValue = (angle.floatValue + (t - last) / 1_000_000_000f * 50f) % 360f
            last = t
        }
    }
    val strong = face is Face.Expanded || face is Face.Peek

    val view = androidx.compose.ui.platform.LocalView.current

    // iPhone's "nothing to open here" answer: a quick side-to-side wobble that settles back to the centre.
    val shake = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(nudge) {
        if (nudge == 0 || motion.reduced) return@LaunchedEffect
        shake.snapTo(0f)
        shake.animateTo(0f, androidx.compose.animation.core.keyframes {
            durationMillis = 420
            -9f at 60
            8f at 130
            -6f at 200
            4f at 270
            -2f at 340
        })
    }

    // Second live activity: a separate black circle beside the pill. The pill itself stays centred on the camera.
    val second = (face as? Face.Compact)?.secondary
    var lastSecond by remember { mutableStateOf<Live?>(null) }
    if (second != null) lastSecond = second
    val side by animateDpAsState(
        if (second != null) IslandShapes.Bubble + IslandShapes.BubbleGap else 0.dp, motion.width(), label = "bubble-side",
    )
    val bubbleScale by animateFloatAsState(if (second != null) 1f else 0f, motion.press(), label = "bubble-scale")
    LaunchedEffect(Unit) {
        androidx.compose.runtime.snapshotFlow { (w + side * 2) to (h + GlowMargin) }
            .collect { (ww, hh) -> actions.onVisualSize(ww, hh) }
    }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
      Row(Modifier.padding(top = GlowMargin).graphicsLayer { translationX = shake.value.dp.toPx() }, verticalAlignment = Alignment.Top) {
        Spacer(Modifier.width(side))
        Box(
            Modifier
                .graphicsLayer {
                    this.alpha = alpha
                    scaleX = press
                    scaleY = press
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
                }
                .size(w, h)
                .clip(RoundedCornerShape(r))
                .background(ic.container)
                .drawWithContent {
                    drawContent()
                    val stroke = 1.4.dp.toPx()
                    val brush = EdgeBrush(angle.floatValue, ic.edgeA, ic.edgeB)
                    drawRoundRect(
                        brush = brush,
                        topLeft = Offset(stroke / 2, stroke / 2),
                        size = Size(size.width - stroke, size.height - stroke),
                        cornerRadius = CornerRadius(r.toPx() - stroke / 2),
                        alpha = if (strong) 0.9f else 0.55f,
                        style = Stroke(stroke),
                    )
                }
                .pointerInput(face.key) {
                    detectTapGestures(
                        onPress = {
                            pressed = true
                            tryAwaitRelease()
                            pressed = false
                        },
                        onTap = { actions.onTap(face) },
                        onLongPress = {
                            com.goodspace.cocolounge.island.util.Haptics.longPress(view)
                            actions.onLongPress(face)
                        },
                    )
                }
                .pointerInput(face.key) {
                    var dx = 0f
                    var dy = 0f
                    detectDragGestures(
                        onDragStart = { dx = 0f; dy = 0f },
                        onDrag = { change, amount ->
                            dx += amount.x
                            dy += amount.y
                            change.consume()
                        },
                        onDragEnd = {
                            val slop = 36.dp.toPx()
                            if (-dy > slop && abs(dy) > abs(dx)) actions.onSwipeUp(face)
                            else if (abs(dx) > slop && abs(dx) > abs(dy)) actions.onSwipeSide(if (dx < 0) 1 else -1)
                        },
                    )
                },
        ) {
            AnimatedContent(
                targetState = face,
                contentKey = { it.key },
                modifier = Modifier.fillMaxSize(),
                transitionSpec = {
                    (fadeIn(motion.fadeIn()) + scaleIn(motion.content(), initialScale = 0.9f)) togetherWith
                        (fadeOut(motion.fadeOut()) + scaleOut(motion.content(), targetScale = 0.96f))
                },
                label = "island-face",
            ) { f ->
                // Content is laid out at the size of ITS face and clipped by the animated container, so text never re-wraps mid-morph.
                val target = IslandShapes.of(f)
                Box(Modifier.fillMaxSize()) {
                    Box(
                        Modifier
                            .align(Alignment.TopCenter)
                            .requiredWidth(target.width)
                            .requiredHeight(target.height),
                    ) { FaceContent(f, now, screenOn && !motion.reduced, actions) }
                }
            }
        }
        Box(Modifier.width(side).height(IslandShapes.Bubble), contentAlignment = Alignment.CenterEnd) {
            val b = lastSecond
            if (b != null && bubbleScale > 0.01f) {
                Box(
                    Modifier
                        .size(IslandShapes.Bubble)
                        .graphicsLayer {
                            // The bubble slides out from under the pill and stretches a little as it leaves, like a drop
                            // pulling away (the iPhone "goo" split), then settles round.
                            val k = bubbleScale.coerceIn(0f, 1.2f)
                            val out = 1f - k.coerceAtMost(1f)
                            translationX = -out * (IslandShapes.Bubble + IslandShapes.BubbleGap).toPx()
                            scaleX = k * (1f + 0.35f * out)
                            scaleY = k
                            this.alpha = alpha * k.coerceAtMost(1f)
                        }
                        .clip(CircleShape)
                        .background(ic.container)
                        .clickable { actions.onBubbleTap(b) },
                ) { BubbleContent(b, now, screenOn && !motion.reduced) }
            }
        }
      }
    }
}

/** Sweep-gradient edge highlight. Rotating the gradient (not the box) keeps the rounded outline perfectly still. */
private class EdgeBrush(val angle: Float, val a: Color, val b: Color) : ShaderBrush() {
    override fun createShader(size: Size): android.graphics.Shader {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val colors = intArrayOf(
            a.copy(alpha = 0.05f).toArgbInt(), a.toArgbInt(), b.toArgbInt(), b.copy(alpha = 0.05f).toArgbInt(), a.copy(alpha = 0.05f).toArgbInt(),
        )
        val shader = SweepGradient(cx, cy, colors, floatArrayOf(0f, 0.22f, 0.5f, 0.78f, 1f))
        shader.setLocalMatrix(Matrix().apply { setRotate(angle, cx, cy) })
        return shader
    }
}

private fun Color.toArgbInt(): Int = this.toArgb()

@Composable
private fun FaceContent(face: Face, now: Long, animate: Boolean, actions: IslandActions) {
    when (face) {
        Face.Hidden -> Unit
        is Face.Compact -> CompactContent(face, now, animate)
        is Face.Peek -> {
            val n = face.item as? NoteLive
            when {
                n != null && !n.isCall && face.reply -> ReplyContent(n, actions)
                n != null && !n.isCall && n.appActions.isNotEmpty() -> NotePeekContent(n, actions)
                else -> PeekContent(face.item, actions)
            }
        }
        is Face.Expanded -> ExpandedContent(face, now, animate, actions)
    }
}

// ---- shared bits ----------------------------------------------------------------------------------------

private fun fmt(ms: Long): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private fun titleOf(l: Live, now: Long): String = when (l) {
    is MediaLive -> l.title
    is TimerLive -> "Timer  " + fmt(l.remaining(now))
    is ChargeLive -> if (l.charging) "Charging" else "Battery"
    is NoteLive -> l.title
    is AlertLive -> l.title
    is StopwatchLive -> "Stopwatch  " + fmt(l.elapsed(now))
    is NavLive -> l.distance.ifBlank { l.instruction }
    is TorchLive -> "Torch"
    is EventLive -> l.title
}

private val TorchYellow = Color(0xFFFFD60A)
private val EventBlue = Color(0xFF64D2FF)

/** iPhone colours for the system moments. */
private fun alertColor(k: AlertKind): Color = when (k) {
    AlertKind.Silent -> Color(0xFFFF453A)
    AlertKind.Vibrate -> Color(0xFFFF9F0A)
    AlertKind.Ring -> Color.White
    AlertKind.FocusOn -> Color(0xFF8E8CFF)
    AlertKind.FocusOff -> Color.White.copy(alpha = 0.8f)
    AlertKind.Headphones -> Color.White
    AlertKind.HeadphonesOff -> Color.White.copy(alpha = 0.6f)
}

private fun alertGlyph(k: AlertKind): Glyph = when (k) {
    AlertKind.Silent -> Glyph.BellOff
    AlertKind.Vibrate -> Glyph.Vibrate
    AlertKind.Ring -> Glyph.Bell
    AlertKind.FocusOn, AlertKind.FocusOff -> Glyph.Moon
    AlertKind.Headphones, AlertKind.HeadphonesOff -> Glyph.Headphones
}

private val CallGreen = Color(0xFF30D158)
private val CallRed = Color(0xFFFF453A)

@Composable
private fun mediaTint(m: MediaLive): Color = m.tint?.let { Color(it) } ?: LocalIsland.current.accent

private fun subtitleOf(l: Live): String = when (l) {
    is MediaLive -> l.artist.ifBlank { l.appName }
    is TimerLive -> if (l.running) "Running" else "Paused"
    is ChargeLive -> "${l.percent}%"
    is NoteLive -> if (l.ringing) l.text.ifBlank { l.appName } else l.text
    is AlertLive -> l.detail
    is StopwatchLive -> if (l.running) "Running" else "Paused"
    is NavLive -> l.instruction
    is TorchLive -> "On"
    is EventLive -> CalendarRules.label(l.beginMs, System.currentTimeMillis())
}

@Composable
private fun AppBadge(bitmap: Bitmap?, fallback: Glyph, size: Dp, tint: Color = LocalIsland.current.content) {
    val ic = LocalIsland.current
    val img = remember(bitmap) { bitmap?.asImageBitmap() }
    if (img != null) {
        Image(img, null, Modifier.size(size).clip(RoundedCornerShape(size / 3.4f)), contentScale = ContentScale.Crop)
    } else {
        Box(Modifier.size(size).clip(RoundedCornerShape(size / 3.4f)).background(ic.chip), contentAlignment = Alignment.Center) {
            GlyphIcon(fallback, tint, size * 0.55f)
        }
    }
}

@Composable
private fun leadingGlyph(l: Live): Glyph = when (l) {
    is MediaLive -> Glyph.Music
    is TimerLive -> Glyph.Timer
    is ChargeLive -> Glyph.Bolt
    is NoteLive -> if (l.isCall) Glyph.Call else Glyph.Bell
    is AlertLive -> alertGlyph(l.kind)
    is StopwatchLive -> Glyph.Timer
    is NavLive -> Glyph.Nav
    is TorchLive -> Glyph.Torch
    is EventLive -> Glyph.Calendar
}

@Composable
private fun Leading(l: Live, size: Dp) {
    val ic = LocalIsland.current
    when (l) {
        is MediaLive -> AppBadge(l.art, Glyph.Music, size)
        is NoteLive -> if (l.isCall) AppBadge(l.icon, Glyph.Call, size) else AvatarWithLogo(l, size)
        is TimerLive -> GlyphIcon(Glyph.Timer, ic.timer, size)
        is ChargeLive -> GlyphIcon(Glyph.Bolt, if (l.charging) Brand.Good else ic.content, size)
        is AlertLive -> GlyphIcon(alertGlyph(l.kind), alertColor(l.kind), size)
        is StopwatchLive -> GlyphIcon(Glyph.Timer, ic.timer, size)
        is NavLive -> NavArrow(l, size)
        is TorchLive -> GlyphIcon(Glyph.Torch, TorchYellow, size)
        is EventLive -> GlyphIcon(Glyph.Calendar, EventBlue, size)
    }
}

/** The navigation app's own turn arrow (it draws it for its notification); our arrow when it sends none. */
@Composable
private fun NavArrow(n: NavLive, dim: Dp) {
    val ic = LocalIsland.current
    val img = remember(n.arrow) { n.arrow?.asImageBitmap() }
    if (img != null) Image(img, n.instruction, Modifier.size(dim), contentScale = ContentScale.Fit)
    else GlyphIcon(Glyph.Nav, ic.accent, dim)
}

/** AirPods-style ring: the earbuds' battery as an arc that fills up, green, red when low. */
@Composable
private fun EarbudsRing(level: Int, dim: Dp, glyph: Boolean = false) {
    val ic = LocalIsland.current
    val color = if (level <= 20) CallRed else CallGreen
    val fill by animateFloatAsState(level.coerceIn(0, 100) / 100f, tween(800), label = "earbuds-ring")
    Box(Modifier.size(dim), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val st = (size.minDimension * 0.12f).coerceAtLeast(2.dp.toPx())
            val box = Size(size.width - st, size.height - st)
            val at = Offset(st / 2, st / 2)
            drawArc(color.copy(alpha = 0.22f), 0f, 360f, false, at, box, style = Stroke(st))
            drawArc(color, -90f, 360f * fill, false, at, box, style = Stroke(st, cap = StrokeCap.Round))
        }
        if (glyph) GlyphIcon(Glyph.Headphones, ic.content, dim * 0.48f)
    }
}

@Composable
private fun Bars(active: Boolean, tint: Color) {
    // Three equaliser bars. They only move while music plays and animation is allowed; otherwise they rest.
    var phase by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(active) {
        if (!active) return@LaunchedEffect
        var last = androidx.compose.runtime.withFrameNanos { it }
        while (true) {
            val t = androidx.compose.runtime.withFrameNanos { it }
            phase += (t - last) / 1_000_000_000f * 6f
            last = t
        }
    }
    Canvas(Modifier.size(width = 20.dp, height = 16.dp)) {
        val barW = 3.dp.toPx()
        val gap = (size.width - 3 * barW) / 2f
        for (i in 0..2) {
            val f = if (active) 0.35f + 0.65f * (0.5f + 0.5f * kotlin.math.sin(phase + i * 1.7f)) else 0.45f
            val bh = size.height * f
            drawRoundRect(tint, Offset(i * (barW + gap), size.height - bh), Size(barW, bh), CornerRadius(barW / 2))
        }
    }
}

// ---- compact --------------------------------------------------------------------------------------------

@Composable
private fun CompactContent(face: Face.Compact, now: Long, animate: Boolean) {
    val ic = LocalIsland.current
    val p = face.primary
    // Like iPhone: the left side sits left of the camera, the right side right of it; the middle stays empty.
    Row(Modifier.fillMaxSize().padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        when {
            p is NoteLive && p.isCall -> RingingPhone(if (p.ringing) animate else false, 22.dp)
            else -> Leading(p, 22.dp)
        }
        // Earbuds with a known battery: like AirPods on iPhone, only the icon left and the ring right (the name never fits).
        if (p is AlertLive && !(p.kind == AlertKind.Headphones && p.level >= 0)) {
            Spacer(Modifier.width(8.dp))
            Text(p.title, color = alertColor(p.kind), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        } else {
            Spacer(Modifier.weight(1f))
        }
        when (p) {
            is MediaLive -> Bars(animate && p.playing, mediaTint(p))
            is TimerLive -> Text(fmt(p.remaining(now)), color = ic.timer, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            is ChargeLive -> BatteryIcon(p.percent, p.charging)
            is AlertLive -> if (p.kind == AlertKind.Headphones && p.level >= 0) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${p.level}%", color = ic.content.copy(alpha = 0.8f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.width(5.dp))
                    EarbudsRing(p.level, 16.dp)
                }
            } else Text(
                when (p.kind) { AlertKind.Silent, AlertKind.Vibrate, AlertKind.FocusOn -> "On"; AlertKind.HeadphonesOff, AlertKind.FocusOff -> "Off"; else -> p.detail.substringAfter("· ", "") },
                color = ic.content.copy(alpha = 0.7f), fontSize = 12.sp, maxLines = 1,
            )
            is StopwatchLive -> Text(fmt(p.elapsed(now)), color = ic.timer, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            is NavLive -> Text(p.distance.ifBlank { "Go" }, color = ic.content, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            is TorchLive -> Text("On", color = TorchYellow, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            is EventLive -> Text(CalendarRules.label(p.beginMs, System.currentTimeMillis()), color = EventBlue, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            is NoteLive -> when {
                p.inCall -> Text(fmt(now - p.startedAt), color = CallGreen, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                // Ringing: the caller's full name on the right ("Big Boss", not "Big"), cut with ... only when it is long.
                p.ringing -> Text(p.title, color = ic.content, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    textAlign = androidx.compose.ui.text.style.TextAlign.End, modifier = Modifier.widthIn(max = 104.dp))
                p.live && p.progress == -3 -> Text("YES?", color = ic.timer, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                // A recorder, workout or screen recording: its own running clock, with the red iPhone dot when it records.
                p.since > 0L -> Row(verticalAlignment = Alignment.CenterVertically) {
                    if (p.recording) {
                        Box(Modifier.size(7.dp).clip(CircleShape).background(CallRed))
                        Spacer(Modifier.width(5.dp))
                    }
                    Text(fmt(now - p.since), color = if (p.recording) CallRed else ic.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
                // Android 16 Live Update: the app's own short text ("5 min", "Arriving").
                p.shortText.isNotBlank() -> Text(p.shortText, color = ic.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 70.dp))
                p.live -> ProgressRing(p.progress, ic.accent, 18.dp)
                else -> Box(Modifier.size(8.dp).clip(CircleShape).background(ic.accent))
            }
        }
    }
}

/** iPhone-style progress ring for a live update; a short spinning arc when there is no number. */
@Composable
private fun ProgressRing(progress: Int, tint: Color, size: Dp) {
    var spin by remember { mutableFloatStateOf(0f) }
    if (progress < 0) LaunchedEffect(Unit) {
        while (true) androidx.compose.runtime.withFrameNanos { spin = (it / 3_000_000L % 360).toFloat() }
    }
    Canvas(Modifier.size(size)) {
        val w = 2.5.dp.toPx()
        val box = Size(this.size.width - w, this.size.height - w)
        val at = Offset(w / 2, w / 2)
        drawArc(tint.copy(alpha = 0.25f), 0f, 360f, false, at, box, style = androidx.compose.ui.graphics.drawscope.Stroke(w))
        if (progress >= 0) drawArc(tint, -90f, 3.6f * progress, false, at, box, style = androidx.compose.ui.graphics.drawscope.Stroke(w, cap = androidx.compose.ui.graphics.StrokeCap.Round))
        else drawArc(tint, spin, 90f, false, at, box, style = androidx.compose.ui.graphics.drawscope.Stroke(w, cap = androidx.compose.ui.graphics.StrokeCap.Round))
    }
}

/** Green phone that wiggles while ringing (only when animation is allowed). */
@Composable
private fun RingingPhone(ringing: Boolean, size: Dp) {
    val ic = LocalIsland.current
    var t by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(ringing) {
        if (!ringing) { t = 0f; return@LaunchedEffect }
        val start = androidx.compose.runtime.withFrameNanos { it }
        while (true) {
            val now = androidx.compose.runtime.withFrameNanos { it }
            t = (now - start) / 1_000_000_000f
        }
    }
    // short bursts of wiggle, then rest, like the iPhone ringing glyph
    val cycle = t % 1.2f
    val angle = if (ringing && cycle < 0.5f) 14f * kotlin.math.sin(cycle * 40f) else 0f
    Box(Modifier.size(size).clip(CircleShape).background(CallGreen), contentAlignment = Alignment.Center) {
        GlyphIcon(Glyph.Call, ic.content, size * 0.6f, Modifier.graphicsLayer { rotationZ = angle })
    }
}

/** iPhone-style battery: outline with a fill that turns green while charging and red when low. */
@Composable
private fun BatteryIcon(percent: Int, charging: Boolean) {
    val ic = LocalIsland.current
    val fill = when {
        charging -> CallGreen
        percent <= 20 -> CallRed
        else -> ic.content
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("$percent%", color = if (charging) CallGreen else ic.content, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.width(5.dp))
        Canvas(Modifier.size(width = 26.dp, height = 13.dp)) {
            val s = 1.2.dp.toPx()
            val bodyW = size.width - 3.dp.toPx()
            drawRoundRect(ic.content.copy(alpha = 0.45f), Offset(s / 2, s / 2), Size(bodyW - s, size.height - s), CornerRadius(3.5.dp.toPx()), style = Stroke(s))
            val inner = 2.2.dp.toPx()
            drawRoundRect(fill, Offset(inner, inner), Size((bodyW - inner * 2) * (percent / 100f).coerceIn(0.05f, 1f), size.height - inner * 2), CornerRadius(2.dp.toPx()))
            drawRoundRect(ic.content.copy(alpha = 0.45f), Offset(bodyW + 0.5.dp.toPx(), size.height * 0.33f), Size(2.dp.toPx(), size.height * 0.34f), CornerRadius(1.dp.toPx()))
        }
    }
}

/** The detached circle next to the pill when two activities run at once (iPhone split island). */
@Composable
private fun BubbleContent(l: Live, now: Long, animate: Boolean) {
    val ic = LocalIsland.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when (l) {
            is MediaLive -> if (l.art != null) AppBadge(l.art, Glyph.Music, 24.dp) else Bars(animate && l.playing, mediaTint(l))
            is TimerLive -> {
                val frac = if (l.totalMs > 0) (l.remaining(now).toFloat() / l.totalMs).coerceIn(0f, 1f) else 0f
                Canvas(Modifier.size(24.dp)) {
                    val st = 3.dp.toPx()
                    drawArc(ic.timer.copy(alpha = 0.25f), 0f, 360f, false, Offset(st / 2, st / 2), Size(size.width - st, size.height - st), style = Stroke(st))
                    drawArc(ic.timer, -90f, 360f * frac, false, Offset(st / 2, st / 2), Size(size.width - st, size.height - st), style = Stroke(st, cap = StrokeCap.Round))
                }
            }
            is NoteLive -> if (l.isCall) RingingPhone(l.ringing && animate, 24.dp) else AppBadge(l.icon, Glyph.Bell, 22.dp)
            is ChargeLive -> GlyphIcon(Glyph.Bolt, if (l.charging) CallGreen else ic.content, 18.dp)
            is AlertLive -> if (l.kind == AlertKind.Headphones && l.level >= 0) EarbudsRing(l.level, 24.dp, glyph = true) else GlyphIcon(alertGlyph(l.kind), alertColor(l.kind), 18.dp)
            is StopwatchLive -> GlyphIcon(Glyph.Timer, ic.timer, 18.dp)
            is NavLive -> NavArrow(l, 22.dp)
            is TorchLive -> GlyphIcon(Glyph.Torch, TorchYellow, 18.dp)
            is EventLive -> GlyphIcon(Glyph.Calendar, EventBlue, 18.dp)
        }
    }
}

// ---- peek (notification arrival) ------------------------------------------------------------------------

@Composable
private fun PeekContent(item: Live, actions: IslandActions) {
    val ic = LocalIsland.current
    val call = (item as? NoteLive)?.isCall == true
    Row(Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Leading(item, 42.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(titleOf(item, 0), color = ic.content, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitleOf(item), color = ic.content.copy(alpha = 0.7f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (call && item is NoteLive) {
            val decline = item.actions.firstOrNull { it.positive == false }
            val answer = item.actions.firstOrNull { it.positive == true }
            Spacer(Modifier.width(8.dp))
            decline?.let { RoundButton(Glyph.Call, Brand.Bad, 44.dp, "Decline", rotate = 135f) { actions.noteAction(it) } }
            Spacer(Modifier.width(10.dp))
            answer?.let { RoundButton(Glyph.Call, Brand.Good, 44.dp, "Answer") { actions.noteAction(it) } }
        }
    }
}

@Composable
private fun RoundButton(glyph: Glyph, bg: Color, size: Dp, description: String, rotate: Float = 0f, tint: Color = LocalIsland.current.content, onClick: () -> Unit) {
    Box(
        Modifier
            .size(size)
            .clip(CircleShape)
            .background(bg)
            .semantics { contentDescription = description }
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        GlyphIcon(glyph, tint, size * 0.5f, Modifier.graphicsLayer { rotationZ = rotate })
    }
}

@Composable
private fun Pill(label: String, onClick: () -> Unit, highlight: Boolean = false) {
    val ic = LocalIsland.current
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(if (highlight) ic.accent else ic.chip)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (highlight) ic.onAccent else ic.chipContent, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

/** The sender's photo with the app's logo on its corner (like the shade). No photo: just the app logo. */
@Composable
private fun AvatarWithLogo(n: NoteLive, size: Dp) {
    val avatar = remember(n.avatar) { n.avatar?.asImageBitmap() }
    if (avatar == null) {
        AppBadge(n.icon, Glyph.Bell, size)
        return
    }
    val ic = LocalIsland.current
    val logo = remember(n.icon) { n.icon?.asImageBitmap() }
    Box(Modifier.size(size)) {
        Image(avatar, null, Modifier.size(size).clip(CircleShape), contentScale = ContentScale.Crop)
        if (logo != null) {
            val s = size * 0.42f
            Box(
                Modifier.align(Alignment.BottomEnd).size(s).clip(CircleShape).background(ic.container).padding(1.5.dp),
            ) { Image(logo, n.appName, Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop) }
        }
    }
}

/** One of the app's own buttons (Reply, Mark as read...), with the app's icon for it when it ships one. */
@Composable
private fun ActionChip(a: NoteAction, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val ic = LocalIsland.current
    val img = remember(a.icon) { a.icon?.asImageBitmap() }
    Row(
        modifier
            .height(34.dp)
            .clip(RoundedCornerShape(50))
            .background(if (a.isReply) ic.accent else ic.chip)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        val tint = if (a.isReply) ic.onAccent else ic.chipContent
        if (img != null) {
            Image(img, null, Modifier.size(16.dp), colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(tint))
            Spacer(Modifier.width(6.dp))
        }
        Text(a.label, color = tint, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Message banner with the app's own buttons underneath (all apps, exactly as each app names them). */
@Composable
private fun NotePeekContent(n: NoteLive, actions: IslandActions) {
    val ic = LocalIsland.current
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarWithLogo(n, 42.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(n.title, color = ic.content, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Text("  " + n.appName, color = ic.content.copy(alpha = 0.5f), fontSize = 11.sp, maxLines = 1)
                }
                Text(n.text, color = ic.content.copy(alpha = 0.75f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            n.appActions.forEach { a -> ActionChip(a, { actions.noteAction(a) }, Modifier.weight(1f)) }
        }
    }
}

/** Inline reply: type and send without leaving the app you are in. */
@Composable
private fun ReplyContent(n: NoteLive, actions: IslandActions) {
    val ic = LocalIsland.current
    val reply = n.actions.firstOrNull { it.isReply } ?: return
    var text by remember(n.id) { mutableStateOf("") }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    LaunchedEffect(n.id) {
        kotlinx.coroutines.delay(220)   // the window becomes focusable first
        runCatching { focus.requestFocus() }
        keyboard?.show()
    }
    fun send() { if (text.isNotBlank()) actions.sendReply(n, reply, text) }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarWithLogo(n, 32.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(n.title, color = ic.content, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(n.text, color = ic.content.copy(alpha = 0.65f), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            RoundButton(Glyph.Close, ic.chip, 30.dp, "Close") { actions.cancelReply() }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(50)).background(ic.chip).padding(horizontal = 14.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (text.isEmpty()) Text(reply.remote.firstOrNull()?.label?.toString()?.takeIf { it.isNotBlank() } ?: reply.label, color = ic.chipContent.copy(alpha = 0.5f), fontSize = 14.sp, maxLines = 1)
                androidx.compose.foundation.text.BasicTextField(
                    value = text,
                    onValueChange = { text = it },
                    singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(color = ic.chipContent, fontSize = 14.sp),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(ic.accent),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Send),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSend = { send() }),
                    modifier = Modifier.fillMaxWidth().focusRequester(focus),
                )
            }
            Spacer(Modifier.width(8.dp))
            RoundButton(Glyph.Send, if (text.isBlank()) ic.chip else ic.accent, 40.dp, "Send", tint = if (text.isBlank()) ic.content.copy(alpha = 0.5f) else ic.onAccent) { send() }
        }
    }
}

// ---- expanded -------------------------------------------------------------------------------------------

@Composable
private fun ExpandedContent(face: Face.Expanded, now: Long, animate: Boolean, actions: IslandActions) {
    val ic = LocalIsland.current
    val item = face.item
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 14.dp)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (item) {
                is MediaLive -> MediaExpanded(item, now, actions)
                is TimerLive -> TimerExpanded(item, now, actions)
                is ChargeLive -> ChargeExpanded(item)
                is NoteLive -> if (item.isCall) CallExpanded(item, now, actions) else NoteExpanded(item, actions)
                is AlertLive -> AlertExpanded(item)
                is StopwatchLive -> StopwatchExpanded(item, now, actions)
                is NavLive -> NavExpanded(item, actions)
                is TorchLive -> TorchExpanded(actions)
                is EventLive -> EventExpanded(item, actions)
            }
            if (face.others.isNotEmpty()) {
                Row(Modifier.align(Alignment.TopEnd), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(Modifier.size(6.dp).clip(CircleShape).background(ic.accent))
                    face.others.take(3).forEach { Box(Modifier.size(6.dp).clip(CircleShape).background(ic.content.copy(alpha = 0.3f))) }
                }
            }
        }
        if (face.menu) {
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill("Dismiss", { actions.dismiss(item) })
                Pill("Open", { actions.open(item) })
                Pill("Done", { actions.closeMenu() }, highlight = true)
            }
        }
    }
}

@Composable
private fun MediaExpanded(m: MediaLive, now: Long, actions: IslandActions) {
    val ic = LocalIsland.current
    val position = (m.positionMs + if (m.playing) now - m.stamp else 0L).coerceIn(0L, m.durationMs.coerceAtLeast(0L).takeIf { it > 0 } ?: Long.MAX_VALUE)
    val progress = if (m.durationMs > 0) (position.toFloat() / m.durationMs).coerceIn(0f, 1f) else 0f
    val animatedProgress by animateFloatAsState(progress, tween(400), label = "media-progress")
    Column(verticalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppBadge(m.art, Glyph.Music, 64.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(m.title, color = ic.content, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(m.artist.ifBlank { m.appName }, color = ic.content.copy(alpha = 0.7f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(8.dp))
            RoundButton(Glyph.Open, ic.chip, 34.dp, "Open ${m.appName}") { actions.open(m) }
        }
        Column {
            Box(Modifier.fillMaxWidth().height(5.dp).clip(CircleShape).background(ic.accent.copy(alpha = 0.22f))) {
                Box(Modifier.fillMaxSize(animatedProgress.coerceIn(0.001f, 1f)).clip(CircleShape).background(mediaTint(m)))
            }
            Spacer(Modifier.height(4.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(fmt(position), color = ic.content.copy(alpha = 0.6f), fontSize = 10.sp)
                Text(if (m.durationMs > 0) fmt(m.durationMs) else "", color = ic.content.copy(alpha = 0.6f), fontSize = 10.sp)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            RoundButton(Glyph.Prev, Color.Transparent, 44.dp, "Previous") { actions.mediaPrev(m) }
            Spacer(Modifier.width(18.dp))
            RoundButton(if (m.playing) Glyph.Pause else Glyph.Play, mediaTint(m), 52.dp, if (m.playing) "Pause" else "Play", tint = ic.onAccent) { actions.mediaPlayPause(m) }
            Spacer(Modifier.width(18.dp))
            RoundButton(Glyph.Next, Color.Transparent, 44.dp, "Next") { actions.mediaNext(m) }
        }
    }
}

@Composable
private fun TimerExpanded(t: TimerLive, now: Long, actions: IslandActions) {
    val ic = LocalIsland.current
    val remaining = t.remaining(now)
    val fraction = if (t.totalMs > 0) (remaining.toFloat() / t.totalMs).coerceIn(0f, 1f) else 0f
    val animated by animateFloatAsState(fraction, tween(300), label = "timer-ring")
    val ring = ic.timer
    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(100.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val stroke = 7.dp.toPx()
                drawArc(ring.copy(alpha = 0.22f), 0f, 360f, false, Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke), style = Stroke(stroke))
                drawArc(ring, -90f, 360f * animated, false, Offset(stroke / 2, stroke / 2), Size(size.width - stroke, size.height - stroke), style = Stroke(stroke, cap = StrokeCap.Round))
            }
            Text(fmt(remaining), color = ic.content, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(18.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (t.running) "Timer running" else "Timer paused", color = ic.content.copy(alpha = 0.75f), fontSize = 13.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                RoundButton(if (t.running) Glyph.Pause else Glyph.Play, ring, 44.dp, if (t.running) "Pause timer" else "Resume timer", tint = ic.onAccent) { actions.timerToggle() }
                RoundButton(Glyph.Plus, ic.chip, 44.dp, "Add one minute") { actions.timerAdd() }
                RoundButton(Glyph.Close, ic.chip, 44.dp, "Cancel timer") { actions.timerCancel() }
            }
        }
    }
}

@Composable
private fun ChargeExpanded(c: ChargeLive) {
    val ic = LocalIsland.current
    val animated by animateFloatAsState(c.percent / 100f, tween(500), label = "charge-fill")
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            GlyphIcon(Glyph.Bolt, if (c.charging) Brand.Good else ic.content, 22.dp)
            Spacer(Modifier.width(8.dp))
            Text(if (c.charging) "Charging" else "On battery", color = ic.content.copy(alpha = 0.8f), fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            Text("${c.percent}%", color = ic.content, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.fillMaxWidth().height(10.dp).clip(CircleShape).background(ic.accent.copy(alpha = 0.2f))) {
            Box(
                Modifier.fillMaxSize(animated.coerceIn(0.01f, 1f)).clip(CircleShape)
                    .background(Brush.horizontalGradient(listOf(MaterialTheme.colorScheme.primary, if (c.charging) Brand.Good else MaterialTheme.colorScheme.tertiary))),
            )
        }
    }
}

@Composable
private fun NoteExpanded(n: NoteLive, actions: IslandActions) {
    val ic = LocalIsland.current
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AvatarWithLogo(n, 32.dp)
            Spacer(Modifier.width(10.dp))
            Text(n.appName, color = ic.content.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.weight(1f), maxLines = 1)
        }
        Column {
            Text(n.title, color = ic.content, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(n.text, color = ic.content.copy(alpha = 0.78f), fontSize = 13.sp, maxLines = if (n.live) 1 else 3, overflow = TextOverflow.Ellipsis)
            if (n.live && n.progress >= 0) Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(4.dp).clip(CircleShape).background(ic.content.copy(alpha = 0.2f))) {
                Box(Modifier.fillMaxWidth(n.progress / 100f).height(4.dp).clip(CircleShape).background(ic.accent))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (n.appActions.isNotEmpty()) {
                n.appActions.forEach { a -> ActionChip(a, { actions.noteAction(a) }) }
            } else if (n.open != null) Pill("Open", { actions.open(n) }, highlight = true)
            Pill("Dismiss", { actions.dismiss(n) })
        }
    }
}

@Composable
private fun CallExpanded(n: NoteLive, now: Long, actions: IslandActions) {
    val ic = LocalIsland.current
    val decline = n.actions.firstOrNull { it.positive == false }
    val answer = n.actions.firstOrNull { it.positive == true }
    val extra = n.actions.filter { it.positive == null }.take(3)
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppBadge(n.icon, Glyph.Call, 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(n.title, color = ic.content, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (n.inCall) {
                    Text(fmt(now - n.startedAt), color = CallGreen, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                } else {
                    Text(n.text.ifBlank { n.appName }, color = ic.content.copy(alpha = 0.7f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (n.open != null) {
                Spacer(Modifier.width(8.dp))
                RoundButton(Glyph.Open, ic.chip, 34.dp, "Open call screen") { actions.open(n) }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            if (n.inCall) {
                // In a call: Speaker / Mute (whatever the phone app offers), then the red hang-up button.
                extra.forEach { a ->
                    val l = a.label.lowercase()
                    val g = when {
                        "speaker" in l || "स्पीकर" in l -> Glyph.Speaker
                        "mute" in l || "म्यूट" in l -> Glyph.Mic
                        else -> null
                    }
                    if (g != null) RoundButton(g, ic.chip, 50.dp, a.label) { actions.noteAction(a) }
                    else Pill(a.label, { actions.noteAction(a) })
                }
                decline?.let { RoundButton(Glyph.Call, CallRed, 50.dp, "End call", rotate = 135f) { actions.noteAction(it) } }
            } else {
                decline?.let { RoundButton(Glyph.Call, CallRed, 54.dp, "Decline", rotate = 135f) { actions.noteAction(it) } }
                answer?.let { RoundButton(Glyph.Call, CallGreen, 54.dp, "Answer") { actions.noteAction(it) } }
            }
        }
    }
}

@Composable
private fun AlertExpanded(a: AlertLive) {
    val ic = LocalIsland.current
    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
        if (a.kind == AlertKind.Headphones && a.level >= 0) EarbudsRing(a.level, 48.dp, glyph = true)
        else Box(Modifier.size(44.dp).clip(CircleShape).background(alertColor(a.kind).copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            GlyphIcon(alertGlyph(a.kind), alertColor(a.kind), 24.dp)
        }
        Spacer(Modifier.width(14.dp))
        Column {
            Text(a.title, color = ic.content, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(a.detail, color = ic.content.copy(alpha = 0.7f), fontSize = 13.sp, maxLines = 1)
        }
    }
}

// ---- new live activities (2026-10-25) -------------------------------------------------------------------

/** Stopwatch, iPhone Clock style: big time with tenths, Reset, Start/Pause and Lap. */
@Composable
private fun StopwatchExpanded(s: StopwatchLive, now: Long, actions: IslandActions) {
    val ic = LocalIsland.current
    val t = s.elapsed(now)
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            GlyphIcon(Glyph.Timer, ic.timer, 20.dp)
            Spacer(Modifier.width(8.dp))
            Text("Stopwatch", color = ic.content.copy(alpha = 0.75f), fontSize = 13.sp)
            Spacer(Modifier.weight(1f))
            if (s.laps.isNotEmpty()) {
                val lap = s.laps.last() - (s.laps.getOrNull(s.laps.size - 2) ?: 0L)
                Text("Lap ${s.laps.size}  ${fmt(lap)}", color = ic.content.copy(alpha = 0.6f), fontSize = 12.sp)
            }
        }
        Text(
            Clock.fmtTenths(t), color = ic.content, fontSize = 40.sp, fontWeight = FontWeight.Bold,
            style = androidx.compose.ui.text.TextStyle(fontFeatureSettings = "tnum"),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            RoundButton(Glyph.Reset, ic.chip, 46.dp, "Reset stopwatch") { actions.stopwatchReset() }
            RoundButton(if (s.running) Glyph.Pause else Glyph.Play, ic.timer, 54.dp, if (s.running) "Pause stopwatch" else "Start stopwatch", tint = ic.onAccent) { actions.stopwatchToggle() }
            RoundButton(Glyph.Flag, ic.chip, 46.dp, "Lap") { actions.stopwatchLap() }
        }
    }
}

/** Turn-by-turn: the turn arrow big, distance, the street, arrival time and Open. */
@Composable
private fun NavExpanded(n: NavLive, actions: IslandActions) {
    val ic = LocalIsland.current
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(ic.chip), contentAlignment = Alignment.Center) { NavArrow(n, 48.dp) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(n.distance.ifBlank { "Next" }, color = ic.content, fontSize = 28.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(n.instruction, color = ic.content.copy(alpha = 0.8f), fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppBadge(n.icon, Glyph.Nav, 22.dp)
            Spacer(Modifier.width(8.dp))
            Text(n.eta.ifBlank { n.appName }, color = ic.content.copy(alpha = 0.65f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Pill("Open", { actions.open(n) }, highlight = true)
        }
    }
}

@Composable
private fun TorchExpanded(actions: IslandActions) {
    val ic = LocalIsland.current
    Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(TorchYellow.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            GlyphIcon(Glyph.Torch, TorchYellow, 24.dp)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text("Torch is on", color = ic.content, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Text("Tap the small pill any time to switch it off", color = ic.content.copy(alpha = 0.7f), fontSize = 12.sp, maxLines = 2)
        }
        Pill("Off", { actions.torchOff() }, highlight = true)
    }
}

/** A meeting about to start: title, time, how soon, Join (Meet, Zoom, Teams) or Open in the calendar. */
@Composable
private fun EventExpanded(e: EventLive, actions: IslandActions) {
    val ic = LocalIsland.current
    val time = remember(e.beginMs, e.endMs) {
        val f = java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT)
        f.format(java.util.Date(e.beginMs)) + " to " + f.format(java.util.Date(e.endMs))
    }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(EventBlue.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                GlyphIcon(Glyph.Calendar, EventBlue, 22.dp)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(e.title, color = ic.content, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("$time  ·  ${CalendarRules.label(e.beginMs, System.currentTimeMillis())}", color = ic.content.copy(alpha = 0.7f), fontSize = 12.sp, maxLines = 1)
            }
        }
        if (e.location.isNotBlank() && e.joinUrl == null) Text(e.location, color = ic.content.copy(alpha = 0.6f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(if (e.joinUrl != null) "Join" else "Open", { actions.joinEvent(e) }, highlight = true)
            Pill("Dismiss", { actions.dismiss(e) })
        }
    }
}
