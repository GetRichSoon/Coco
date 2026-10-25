package com.goodspace.cocolounge.island.runtime

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.goodspace.cocolounge.island.IslandHub
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
import com.goodspace.cocolounge.island.ui.GlowMargin
import com.goodspace.cocolounge.island.ui.IslandActions
import com.goodspace.cocolounge.island.ui.IslandRoot
import com.goodspace.cocolounge.island.ui.LocalIsland
import com.goodspace.cocolounge.island.ui.islandColors
import com.goodspace.cocolounge.MainActivity
import com.goodspace.cocolounge.island.ui.IslandTheme
import com.goodspace.cocolounge.island.util.Haptics
import com.goodspace.cocolounge.island.util.MotionSpecs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.math.ceil

/** Room (dp) kept free at the left for camera + clock and at the right for the battery. */
/**
 * Room kept free on each side for the clock (left) and Wi-Fi + battery (right), as a share of the screen width, so every
 * phone gets its own value at runtime (Nord CE 2, 360 dp wide: 115 dp, measured 2026-10-22). The founder's per-phone
 * "Fit to this phone" adjustment (IslandHub.fitWidth) is added on top.
 */
private const val SIDE_SHARE = 0.32f

/** Owns the overlay window at the top of the screen and turns island gestures into actions. */
class IslandHost(private val context: Context, private val windowType: Int = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY) : IslandActions {
    private val wm = context.getSystemService(WindowManager::class.java)
    private val owner = HostOwner()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val density = context.resources.displayMetrics.density
    private var view: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var shrinkJob: Job? = null
    private var hideJob: Job? = null
    private var curW = 0
    private var curH = 0
    private var focusable = false
    private var screenW = 0
    /** Size the current face settles at (px, with margins). The window never stays smaller than this. */
    private var targetW = 0
    private var targetH = 0
    /** Latest size the pill is actually drawn at, reported every animation frame (dp, at island scale). */
    private var drawnW = 0f
    private var drawnH = 0f
    /** True while an app is full screen (status bar hidden) or the phone is sideways: like iPhone, no island then. */
    private var systemHides = false
    private var probe: View? = null
    /** Window top for the small pill (in the status bar) and for the big card (just under it). */
    private var pillY = 0
    private var belowBarY = 0

    private val face: StateFlow<Face> = combine(IslandHub.live, IslandHub.ui) { live, ui -> IslandHub.faceOf(live.values, ui) }
        .distinctUntilChanged()
        .stateIn(scope, SharingStarted.Eagerly, Face.Hidden)

    fun attach() {
        if (view != null) return
        val (x, y) = anchor()   // also sets IslandShapes.maxWidth from the real screen
        pillY = y
        val start = windowSizeFor(Face.Hidden)
        curW = start.first
        curH = start.second
        val lp = WindowManager.LayoutParams(
            curW, curH, windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            this.x = x
            this.y = y
            title = "CocoIsland"
            layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30) WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_STATE_UNCHANGED or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        }
        val cv = ComposeView(context).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
            setContent { IslandTheme(dark = true) { HostContent() } }
        }
        // Root that hears the Back key while the reply box has the keyboard.
        val root = object : android.widget.FrameLayout(context) {
            override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
                if (event.keyCode == android.view.KeyEvent.KEYCODE_BACK && IslandHub.ui.value.replyId != null) {
                    if (event.action == android.view.KeyEvent.ACTION_UP) IslandHub.endReply(sent = false)
                    return true
                }
                return super.dispatchKeyEvent(event)
            }
        }.apply {
            setViewTreeLifecycleOwner(owner)
            setViewTreeSavedStateRegistryOwner(owner)
            setViewTreeViewModelStoreOwner(owner)
            visibility = View.GONE
            addView(cv, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT))
        }
        // Full screen (video, games, camera) hides the status bar; sideways the iPhone island steps aside too.
        // The status bar state is read from a 1 px invisible normal overlay: the island's own window (above the status bar
        // when the accessibility service runs) is always told the bar is hidden.
        val probe = if (windowType == WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY) root
            else View(context.applicationContext).takeIf { android.provider.Settings.canDrawOverlays(context) }
        probe?.setOnApplyWindowInsetsListener { _, insets ->
            val v = root
            val landscape = context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
            val hide = landscape || !insets.isVisible(WindowInsets.Type.statusBars())
            if (hide != systemHides) {
                systemHides = hide
                if (hide) v.visibility = View.GONE
                else if (face.value != Face.Hidden) {
                    val (nx, ny) = anchor()   // rotated back: the camera is in a new place on screen
                    lp.x = nx
                    pillY = ny
                    lp.y = if (face.value is Face.Compact) ny else maxOf(ny, belowBarY)
                    v.visibility = View.VISIBLE
                    runCatching { wm.updateViewLayout(v, lp) }
                }
            }
            insets
        }
        params = lp
        view = root
        wm.addView(root, lp)
        if (probe != null && probe !== root) {
            val pp = WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, 2, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT)
            pp.gravity = Gravity.TOP or Gravity.START
            pp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            runCatching { context.applicationContext.getSystemService(WindowManager::class.java).addView(probe, pp); this.probe = probe }
        }
        scope.launch { face.collect { onFace(it) } }
        scope.launch {
            // A new size from settings: re-measure the screen and resize the window at once.
            combine(IslandHub.scale, IslandHub.lowered, IslandHub.fitWidth, IslandHub.fitY) { s, l, w, y -> listOf(s, l, w, y) }.distinctUntilChanged().drop(1).collect {
                val (nx, ny) = anchor()
                lp.x = nx
                pillY = ny
                lp.y = ny
                curW = -1
                curH = -1
                onFace(face.value)
            }
        }
    }

    fun detach() {
        scope.cancel()
        view?.let { runCatching { wm.removeView(it) } }
        probe?.let { runCatching { context.applicationContext.getSystemService(WindowManager::class.java).removeView(it) } }
        probe = null
        view = null
        owner.destroy()
    }

    @Composable
    private fun HostContent() {
        val f by face.collectAsState()
        val screenOn by IslandHub.screenOn.collectAsState()
        val reduced by IslandHub.reduced.collectAsState()
        val motion = remember(reduced) { MotionSpecs(reduced) }
        val tick = tickFor(f)
        // The clock only runs while something on screen changes with time (a timer, media progress) and the screen is on.
        val now by produceState(SystemClock.elapsedRealtime(), tick, screenOn) {
            value = SystemClock.elapsedRealtime()
            while (tick > 0 && screenOn) {
                delay(tick)
                value = SystemClock.elapsedRealtime()
            }
        }
        val scale by IslandHub.scale.collectAsState()
        val materialYou by IslandHub.materialYou.collectAsState()
        val nudge by IslandHub.nudge.collectAsState()
        val base = LocalDensity.current
        // Scaling the density (not the bitmap) keeps every line, glyph and letter sharp at the bigger sizes.
        CompositionLocalProvider(
            LocalDensity provides Density(base.density * scale, base.fontScale),
            LocalIsland provides islandColors(materialYou),
        ) { IslandRoot(f, now, screenOn, motion, this@IslandHost, nudge) }
    }

    private fun tickFor(f: Face): Long = when (f) {
        is Face.Expanded -> when (val i = f.item) {
            is MediaLive -> if (i.playing) 500 else 0
            is TimerLive -> if (i.running) 250 else 0
            is NoteLive -> if (i.inCall || i.since > 0L) 1000 else 0
            is StopwatchLive -> if (i.running) 100 else 0
            is EventLive -> 15_000
            else -> 0
        }
        is Face.Compact -> when (val p = f.primary) {
            is TimerLive -> if (p.running) 1000 else 0
            is NoteLive -> if (p.inCall || p.since > 0L) 1000 else 0
            is StopwatchLive -> if (p.running) 1000 else 0
            is EventLive -> 15_000
            else -> 0
        }
        else -> 0
    }

    // ---- window geometry --------------------------------------------------------------------------------

    /** Window size for a face: the pill plus room for spring overshoot and the glow. */
    private fun windowSizeFor(f: Face): Pair<Int, Int> {
        val s = IslandShapes.of(f)
        val bubble = if (f is Face.Compact && f.secondary != null) 2 * (IslandShapes.Bubble.value + IslandShapes.BubbleGap.value) else 0f
        val k = density * IslandHub.scale.value
        val w = ceil((s.width.value + bubble + 28f) * k).toInt()
        val h = ceil((s.height.value + GlowMargin.value + 16f) * k).toInt()
        return w to h
    }

    /** Horizontal offset and top offset that put the compact pill over the camera cutout (or the top centre when there is none). */
    private fun anchor(): Pair<Int, Int> {
        val metrics = wm.currentWindowMetrics
        val screenW = metrics.bounds.width()
        this.screenW = screenW
        val k = IslandHub.scale.value
        IslandShapes.maxWidth = ((screenW / density - 32f) / k).coerceAtLeast(200f).dp
        // Keep the small pill clear of the status bar sides. Sized for OnePlus Nord CE 2: punch-hole camera + clock
        // on the left, battery with percentage on the right. Narrower phones get a narrower pill, never an overlap.
        val centre = screenW / density / 2f
        val side = screenW / density * SIDE_SHARE - IslandHub.fitWidth.value
        IslandShapes.maxCompact = (2f * (centre - side) / k).coerceAtLeast(110f).dp
        val bubble = (IslandShapes.Bubble.value + IslandShapes.BubbleGap.value) * k
        IslandShapes.maxCompactSplit = (2f * (centre - side - bubble) / k).coerceAtLeast(96f).dp
        IslandShapes.splitFits = 2f * (centre - side - bubble) / k >= 96f
        val bar = metrics.windowInsets.getInsets(WindowInsets.Type.statusBars()).top
        // Android draws the status bar above every overlay, so the big card (call, reply, open view) starts just under it.
        belowBarY = (bar + 4f * density - GlowMargin.value * density * k).toInt()
        // Like iPhone the pill wraps the front camera: centred on the real punch hole of this phone (any brand).
        val cam = metrics.windowInsets.displayCutout?.boundingRectTop?.takeIf { !it.isEmpty }
        if (cam != null && !IslandHub.lowered.value) {
            // A corner camera (vivo IV2201 reports 0..150 px at the top left) would drag the pill sideways: then only the
            // height is taken from it and the pill stays dead centre, like iPhone.
            val centred = kotlin.math.abs(cam.exactCenterX() - screenW / 2f) < screenW * 0.15f
            val pillHalf = IslandShapes.compactHeight.value / 2f * density * k
            // Centred on the clock line (62% down the bar on the Nord CE 2), not on the cutout box, which starts at the edge.
            val top = maxOf(cam.exactCenterY(), (if (bar > 0) bar else cam.height()) * 0.62f) - pillHalf - GlowMargin.value * density * k
            val nudge = IslandHub.fitY.value * density
            return (if (centred) (cam.exactCenterX() - screenW / 2f).toInt() else 0) to (top + nudge).toInt().coerceAtLeast(-(GlowMargin.value * density * k).toInt())
        }
        // No camera hole: top centre, inside the status bar.
        val x = 0
        // Slightly below the middle of the status bar: clearly visible, not dropping into the app content.
        // The pill top stays where 1.0.5 put it at every size; a bigger island grows sideways and down, not up into the edge.
        val y = ((bar * 0.3f) + GlowMargin.value * density * (1f - k)).toInt().coerceAtLeast((2 * density).toInt() - (GlowMargin.value * density * k).toInt())
        // Lowered: the whole island starts just under the status bar, so it never covers clock, battery or icons.
        val low = (bar + 4f * density - GlowMargin.value * density * k).toInt().coerceAtLeast(y)
        return x to (if (IslandHub.lowered.value) low else y + (IslandHub.fitY.value * density).toInt())
    }

    private fun onFace(f: Face) {
        val v = view ?: return
        val lp = params ?: return
        val (w, h) = windowSizeFor(f)
        targetW = w
        targetH = h
        if (f == Face.Hidden) {
            setFocusable(false)
            hideJob?.cancel()
            hideJob = scope.launch {
                // wait for the closing spring to settle before the window goes away, or the pill is cut mid-animation
                delay(680)
                v.visibility = View.GONE
            }
            return
        }
        hideJob?.cancel()
        if (v.visibility != View.VISIBLE && !systemHides) {
            // Appearing: position again (the display may have rotated or changed since last time).
            val (x, y) = anchor()
            lp.x = x
            pillY = y
            v.visibility = View.VISIBLE
        }
        val wantY = if (f is Face.Compact) pillY else maxOf(pillY, belowBarY)
        if (lp.y != wantY) { lp.y = wantY; curW = -1 }
        setFocusable(f is Face.Peek && f.reply)
        // Height grows at once (the top edge is fixed, so that never shows). Width follows the drawn pill frame by frame.
        resize(lp, v)
    }

    /**
     * Called every animation frame with the size the pill is drawn at. The window follows it in small steps instead
     * of one jump at the end. A single big width change made Android show the new (narrow) picture at the old
     * window position for one frame, so the pill jumped left when it minimised.
     */
    override fun onVisualSize(width: androidx.compose.ui.unit.Dp, height: androidx.compose.ui.unit.Dp) {
        drawnW = width.value
        drawnH = height.value
        val v = view ?: return
        val lp = params ?: return
        if (v.visibility != View.VISIBLE) return
        resize(lp, v)
    }

    private fun resize(lp: WindowManager.LayoutParams, v: View) {
        val k = density * IslandHub.scale.value
        // Extra room while moving so a fast spring frame is never clipped; settles to the normal margin at rest.
        val moving = drawnW > 0f && kotlin.math.abs(ceil((drawnW + 28f) * k) - targetW) > 2f * k
        val pad = if (moving) 56f else 28f
        var w = maxOf(ceil((drawnW + pad) * k).toInt(), if (moving) 0 else targetW)
        // Same parity as the screen: the window is centred on a whole pixel, never half a pixel off.
        if (screenW > 0 && (screenW - w) % 2 != 0) w++
        if (screenW > 0) w = minOf(w, screenW + 2 * (pad * k).toInt())
        val h = maxOf(targetH, ceil((drawnH + 16f) * k).toInt())
        apply(lp, v, w, h)
    }

    private fun apply(lp: WindowManager.LayoutParams, v: View, w: Int, h: Int) {
        if (w == curW && h == curH) return
        curW = w
        curH = h
        lp.width = w
        lp.height = h
        runCatching { wm.updateViewLayout(v, lp) }
    }

    /** The reply box needs the keyboard, and only a focusable window gets one. Off again as soon as it closes. */
    private fun setFocusable(on: Boolean) {
        val v = view ?: return
        val lp = params ?: return
        if (on == focusable) return
        focusable = on
        lp.flags = if (on) lp.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
        else lp.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        lp.softInputMode = if (on) WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        else WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        runCatching { wm.updateViewLayout(v, lp) }
    }

    // ---- actions ----------------------------------------------------------------------------------------

    private fun send(pi: PendingIntent?) {
        runCatching { pi?.send() }
    }

    private fun launchSelf() {
        val i = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        runCatching { context.startActivity(i) }
    }

    override fun onTap(face: Face) {
        val v = view ?: return
        when (face) {
            // Like iPhone: a tap opens the app that owns the activity. The timer has no app, so it expands; charging and
            // system moments do nothing.
            is Face.Compact -> when (val p = face.primary) {
                is MediaLive -> toggleApp(p)
                is NoteLive -> if (p.open != null) toggleApp(p) else { Haptics.expand(v); IslandHub.expand(p.id) }
                is NavLive -> if (p.open != null) toggleApp(p) else { Haptics.expand(v); IslandHub.expand(p.id) }
                is TimerLive, is StopwatchLive, is EventLive -> { Haptics.expand(v); IslandHub.expand(p.id) }
                is TorchLive -> { Haptics.collapse(v); TorchWatch.set(context, false) }
                // Nothing to open: the iPhone island gives a little shake.
                else -> { Haptics.collapse(v); IslandHub.nudge() }
            }
            is Face.Peek -> {
                val item = face.item
                if (item is NoteLive && item.isCall) { Haptics.expand(v); IslandHub.expand(item.id) } else open(item)
            }
            is Face.Expanded -> { Haptics.collapse(v); IslandHub.collapse() }
            Face.Hidden -> Unit
        }
    }

    /** Which pill opened its app last; a second tap on it within a minute minimises that app. */
    private var openedId: String? = null
    private var openedAt = 0L

    private fun toggleApp(live: Live) {
        view?.let { Haptics.expand(it) }
        val now = SystemClock.elapsedRealtime()
        if (openedId == live.id && now - openedAt < 60_000) {
            openedId = null
            val a11y = com.goodspace.cocolounge.island.service.IslandAccessibility.instance
            if (a11y != null) a11y.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
            else runCatching { context.startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            return
        }
        openedId = live.id
        openedAt = now
        open(live)
    }

    override fun onLongPress(face: Face) {
        // Like iPhone: press and hold the small pill to open it big; hold the big one for the menu.
        when (face) {
            is Face.Compact -> { view?.let { Haptics.expand(it) }; IslandHub.expand(face.primary.id) }
            Face.Hidden -> Unit
            else -> IslandHub.openMenu()
        }
    }

    override fun onSwipeUp(face: Face) {
        val v = view
        when (face) {
            is Face.Expanded -> { v?.let { Haptics.collapse(it) }; IslandHub.collapse() }
            is Face.Peek -> if ((face.item as? NoteLive)?.isCall == true) IslandHub.minimizeCall() else IslandHub.dismiss(face.item.id)
            is Face.Compact -> if (face.primary !is TimerLive && face.primary !is StopwatchLive && face.primary !is NavLive && (face.primary as? NoteLive)?.isCall != true) IslandHub.dismiss(face.primary.id)
            Face.Hidden -> Unit
        }
    }

    override fun onSwipeSide(step: Int) {
        if (IslandHub.ui.value.expanded) IslandHub.cycle(step)
    }

    override fun open(live: Live) {
        when (live) {
            is MediaLive -> send(live.launch)
            is NoteLive -> { send(live.open); if (!live.isCall && !live.live) IslandHub.remove(live.id) }
            is NavLive -> send(live.open)
            is EventLive -> joinEvent(live)
            else -> Unit   // charging, alerts, the torch, timer and stopwatch never open an app
        }
        IslandHub.collapse()
        val isCall = (live as? NoteLive)?.isCall == true
        if (isCall) IslandHub.minimizeCall()
        else IslandHub.ui.value.peekId?.let { if (it == live.id) IslandHub.remove(live.id) }
    }

    override fun onBubbleTap(live: Live) {
        view?.let { Haptics.expand(it) }
        IslandHub.expand(live.id)
    }

    override fun dismiss(live: Live) = IslandHub.dismiss(live.id)

    override fun mediaPlayPause(m: MediaLive) {
        val c = m.controller ?: return   // a real media session always has one
        if (m.playing) c.transportControls.pause() else c.transportControls.play()
    }

    override fun mediaNext(m: MediaLive) { m.controller?.transportControls?.skipToNext() }
    override fun mediaPrev(m: MediaLive) { m.controller?.transportControls?.skipToPrevious() }
    override fun timerToggle() = IslandHub.pauseOrResumeTimer()
    override fun timerAdd() = IslandHub.addToTimer(60_000)
    override fun timerCancel() = IslandHub.cancelTimer()
    override fun stopwatchToggle() { view?.let { Haptics.expand(it) }; IslandHub.toggleStopwatch() }
    override fun stopwatchLap() { view?.let { Haptics.collapse(it) }; IslandHub.lapStopwatch() }
    override fun stopwatchReset() { IslandHub.resetStopwatch(); IslandHub.collapse() }
    override fun torchOff() { TorchWatch.set(context, false) }

    /** Join: the meeting link (Meet, Zoom, Teams open their own app), otherwise the event in the calendar app. */
    override fun joinEvent(e: EventLive) {
        val uri = android.net.Uri.parse(e.joinUrl ?: "content://com.android.calendar/events/${e.eventId}")
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        IslandHub.collapse()
    }
    override fun closeMenu() = IslandHub.expand(IslandHub.ui.value.selectedId)

    /** Sends the typed text through the app's own reply action (exactly what the notification shade does). */
    override fun sendReply(n: NoteLive, a: NoteAction, text: String) {
        val body = text.trim()
        if (body.isEmpty()) return
        val ok = runCatching {
            val intent = Intent()
            val results = android.os.Bundle()
            a.remote.forEach { results.putCharSequence(it.resultKey, body) }
            android.app.RemoteInput.addResultsToIntent(a.remote.toTypedArray(), intent, results)
            a.intent!!.send(context, 0, intent)
        }.isSuccess
        view?.let { Haptics.expand(it) }
        if (ok) IslandHub.quiet(n.pkg)
        IslandHub.endReply(sent = ok)
    }

    override fun cancelReply() = IslandHub.endReply(sent = false)

    override fun noteAction(a: NoteAction) {
        if (a.isReply) {
            val note = IslandHub.live.value.values.filterIsInstance<NoteLive>().firstOrNull { a in it.actions } ?: return
            IslandHub.startReply(note.id)
            return
        }
        send(a.intent)
        val call = IslandHub.live.value[IslandHub.CALL_ID] as? NoteLive
        if (call != null && call.actions.contains(a)) {
            // Answer: the same island turns into the green in-call pill. Decline / Hang up: it closes. Speaker / Mute: it stays.
            IslandHub.onCallAction(a)
            if (a.positive != null) IslandHub.collapse()
            return
        }
        IslandHub.collapse()
    }
}

internal class HostOwner : LifecycleOwner, SavedStateRegistryOwner, ViewModelStoreOwner {
    private val registry = LifecycleRegistry(this)
    private val controller = SavedStateRegistryController.create(this)
    override val lifecycle: Lifecycle get() = registry
    override val savedStateRegistry: SavedStateRegistry get() = controller.savedStateRegistry
    override val viewModelStore: ViewModelStore = ViewModelStore()

    init {
        controller.performAttach()
        controller.performRestore(null)
        registry.currentState = Lifecycle.State.RESUMED
    }

    fun destroy() {
        registry.currentState = Lifecycle.State.DESTROYED
        viewModelStore.clear()
    }
}
