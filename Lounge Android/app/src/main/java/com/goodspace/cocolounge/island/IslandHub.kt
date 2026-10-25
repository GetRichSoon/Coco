package com.goodspace.cocolounge.island

import android.content.Context
import android.os.SystemClock
import com.goodspace.cocolounge.island.runtime.IslandRuntime
import com.goodspace.cocolounge.island.model.AlertLive
import com.goodspace.cocolounge.island.model.CallState
import com.goodspace.cocolounge.island.model.ChargeLive
import com.goodspace.cocolounge.island.model.Face
import com.goodspace.cocolounge.island.model.IslandUi
import com.goodspace.cocolounge.island.model.Live
import com.goodspace.cocolounge.island.model.MediaLive
import com.goodspace.cocolounge.island.model.NoteAction
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.model.TimerLive
import com.goodspace.cocolounge.island.model.StopwatchLive
import com.goodspace.cocolounge.island.model.EventLive
import com.goodspace.cocolounge.island.util.Haptics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The single source of truth for the island: which live activities exist, what the user did to the island
 * (expanded, menu, selection) and which transient banner is showing. Every source (notifications, calls, media,
 * timer, battery, system alerts) writes here; the overlay only reads. All mutations happen on the main thread.
 */
object IslandHub {
    const val CALL_ID = "call"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var appContext: Context

    private val _live = MutableStateFlow<Map<String, Live>>(emptyMap())
    val live: StateFlow<Map<String, Live>> = _live.asStateFlow()

    private val _ui = MutableStateFlow(IslandUi())
    val ui: StateFlow<IslandUi> = _ui.asStateFlow()

    /** False while the screen is off: the overlay stops every looping animation. */
    val screenOn = MutableStateFlow(true)

    /** True when the user turned system animations off; the overlay then changes shape instantly. */
    val reduced = MutableStateFlow(false)

    /** How big the island is drawn (1.0 = the 1.1 size). Set from the Island look setting. */
    val scale = MutableStateFlow(IslandRuntime.SIZES[IslandRuntime.DEFAULT_SIZE])

    /** True = the island sits lower, more than half below the status bar, so it never hides behind notification icons. */
    val lowered = MutableStateFlow(false)

    /** Per-phone fine tuning from "Fit to this phone" (dp): wider (+) or narrower (-) pill, lower (+) or higher (-). */
    val fitWidth = MutableStateFlow(0)
    val fitY = MutableStateFlow(0)

    /** Material You tonal island (true) or the classic all-black pill (false). */
    val materialYou = MutableStateFlow(true)

    private val expiry = HashMap<String, Job>()
    private var peekJob: Job? = null
    private var timerJob: Job? = null
    private var mediaDismissedTitle: String? = null

    // de-duplication of notification banners
    private var lastSig: String? = null
    private var lastSigAt = 0L

    /** When the user tapped Answer in the island. A phone app that still says "incoming" for a moment is treated as connected. */
    private var answeredAt = 0L

    /** The user swiped a ringing call away: it keeps ringing as the small pill until the call changes. */
    private var minimizedCall = false

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    // ---- face -----------------------------------------------------------------------------------------------

    fun faceOf(live: Collection<Live>, ui: IslandUi): Face =
        com.goodspace.cocolounge.island.model.FaceRules.faceOf(live, ui, com.goodspace.cocolounge.island.model.IslandShapes.splitFits)

    /** Goes up by one each time the island should give its "nothing to open here" shake (like iPhone). */
    val nudge = MutableStateFlow(0)
    fun nudge() { nudge.value = nudge.value + 1 }

    /** Meetings the founder closed; they do not come back until the next one. */
    val dismissedEvents = HashSet<Long>()

    // ---- writes ---------------------------------------------------------------------------------------------

    fun put(item: Live, lifetimeMs: Long? = null) {
        if (item is MediaLive && item.title == mediaDismissedTitle) return
        _live.update { it + (item.id to item) }
        expiry.remove(item.id)?.cancel()
        if (lifetimeMs != null) {
            expiry[item.id] = scope.launch { delay(lifetimeMs); remove(item.id) }
        }
    }

    fun remove(id: String) {
        expiry.remove(id)?.cancel()
        _live.update { it - id }
        _ui.update { u ->
            val gone = u.selectedId == id
            val still = _live.value.isNotEmpty()
            u.copy(
                peekId = if (u.peekId == id) null else u.peekId,
                replyId = if (u.replyId == id) null else u.replyId,
                selectedId = if (gone) null else u.selectedId,
                expanded = u.expanded && still,
                menu = u.menu && still && !gone,
            )
        }
        if (id == CALL_ID) minimizedCall = false
    }

    private fun ringingCall(): NoteLive? = (_live.value[CALL_ID] as? NoteLive)?.takeIf { it.ringing }

    /**
     * A plain notification arrives. Only ONE banner exists at a time (a new one replaces the old one, they never
     * stack), the same message posted again within a few seconds is ignored, and a ringing call keeps the stage.
     */
    fun notify(note: NoteLive, bannerMs: Long = if (note.appActions.isNotEmpty()) 7000 else 4500) {
        val now = SystemClock.elapsedRealtime()
        val sig = note.pkg + "|" + note.title + "|" + note.text
        val existing = _live.value[note.id] as? NoteLive
        if (existing != null && existing.title == note.title && existing.text == note.text) return
        if (sig == lastSig && now - lastSigAt < 8000) return
        lastSig = sig
        lastSigAt = now
        // While the user types a reply, a new message waits quietly instead of taking the banner away.
        val replying = _ui.value.replyId
        if (replying != null && replying != note.id) {
            put(note, 30_000)
            return
        }
        if (replying == note.id) {
            put(note)
            return
        }

        // the previous banner leaves when a new one arrives
        _live.value.values.filterIsInstance<NoteLive>().filter { !it.isCall && !it.live && it.id != note.id }.forEach { remove(it.id) }   // live pills (downloads, Coco approvals) stay
        put(note, 30_000)
        if (_ui.value.expanded || ringingCall() != null) return
        peekJob?.cancel()
        _ui.update { it.copy(peekId = note.id) }
        Haptics.arrive(appContext)
        peekJob = scope.launch {
            delay(bannerMs)
            // One step: the banner and its notification leave together. Clearing the banner first used to show the
            // note as a small pill with a side bubble for one frame, which made the island jump sideways.
            remove(note.id)
        }
    }

    // ---- inline reply -------------------------------------------------------------------------------------

    /** Opens the reply box inside the banner. The banner stays until the user sends or closes it. */
    fun startReply(id: String) {
        if (_live.value[id] !is NoteLive) return
        peekJob?.cancel()
        expiry.remove(id)?.cancel()
        _ui.update { it.copy(expanded = false, menu = false, selectedId = null, peekId = id, replyId = id) }
    }

    /** Closes the reply box; sent = the message went out, so the banner leaves too. */
    fun endReply(sent: Boolean) {
        val id = _ui.value.replyId ?: return
        _ui.update { it.copy(replyId = null) }
        if (sent) remove(id) else {
            peekJob?.cancel()
            peekJob = scope.launch { delay(2500); remove(id) }
        }
    }

    /** The app re-posts its notification right after a reply (with your own text). That echo must not pop up again. */
    private val quietUntil = HashMap<String, Long>()
    fun quiet(pkg: String, ms: Long = 6000) { quietUntil[pkg] = SystemClock.elapsedRealtime() + ms }
    fun isQuiet(pkg: String) = (quietUntil[pkg] ?: 0L) > SystemClock.elapsedRealtime()

    /**
     * The one and only call slot. Phone apps repost their call notification many times (every state change,
     * sometimes under a new key, sometimes from two apps at once). All of them land here and update the SAME
     * island in place, so there is never a second call card.
     */
    fun call(incoming: NoteLive) {
        val now = SystemClock.elapsedRealtime()
        var c = incoming.copy(id = CALL_ID)
        val prev = _live.value[CALL_ID] as? NoteLive
        if (c.ringing && now - answeredAt < 4000) {
            c = c.copy(
                callState = CallState.Ongoing,
                startedAt = prev?.startedAt?.takeIf { it > 0 } ?: answeredAt,
                actions = c.actions.filter { it.positive != true },
            )
        }
        if (c.inCall && c.startedAt <= 0L) c = c.copy(startedAt = prev?.startedAt?.takeIf { it > 0 } ?: now)
        put(c)

        val wasRinging = prev?.ringing == true
        if (c.ringing && !wasRinging) {
            // a new ring: one banner, one buzz. Boss's bug (2026-10-25): the phone app's own banner plus the island's big
            // card showed the call twice. When the phone app pops up its banner, the island stays the small ringing pill.
            minimizedCall = false
            if (!_ui.value.expanded && (!c.systemBanner || IslandRuntime.bigCallCard)) {
                peekJob?.cancel()
                _ui.update { it.copy(peekId = CALL_ID) }
            }
            Haptics.arrive(appContext)
        } else if (c.inCall && (wasRinging || prev == null)) {
            // connected: the big ringing card shrinks to the small green pill with the call timer
            _ui.update {
                val openOnCall = it.expanded && (it.selectedId == CALL_ID || it.selectedId == null)
                it.copy(
                    peekId = if (it.peekId == CALL_ID) null else it.peekId,
                    expanded = it.expanded && !openOnCall,
                    menu = it.menu && !openOnCall,
                    selectedId = if (openOnCall) null else it.selectedId,
                )
            }
        }
    }

    fun endCall() = remove(CALL_ID)

    /** The user answered from the island: show it connected at once, before the phone app confirms. */
    fun markAnswered() {
        answeredAt = SystemClock.elapsedRealtime()
        val c = _live.value[CALL_ID] as? NoteLive ?: return
        call(c.copy(callState = CallState.Ongoing, startedAt = answeredAt, actions = c.actions.filter { it.positive != true }))
    }

    /** A short system moment such as Silent mode or headphones connecting. */
    fun alert(a: AlertLive, forMs: Long = 2600) {
        put(a, forMs)
        if (_ui.value.peekId != null && _ui.value.peekId != CALL_ID) {
            peekJob?.cancel()
            _ui.update { it.copy(peekId = null) }
        }
    }

    fun updateAlertIfShown(a: AlertLive) {
        val cur = _live.value["alert"] as? AlertLive ?: return
        if (cur.kind == a.kind) _live.update { it + ("alert" to a) }
    }

    // ---- gestures -------------------------------------------------------------------------------------------

    fun toggleExpanded(id: String? = null) {
        if (_ui.value.expanded) collapse() else expand(id)
    }

    fun expand(id: String? = null) {
        if (_live.value.isEmpty()) return
        peekJob?.cancel()
        _ui.update { it.copy(expanded = true, menu = false, selectedId = id ?: it.peekId ?: it.selectedId, peekId = null) }
    }

    fun collapse() {
        _ui.update { it.copy(expanded = false, menu = false, selectedId = null) }
    }

    /** Swipe up on a ringing call: it keeps ringing, but as the small pill (like iPhone). */
    fun minimizeCall() {
        minimizedCall = true
        _ui.update { if (it.peekId == CALL_ID) it.copy(peekId = null) else it }
    }

    fun openMenu() {
        if (_live.value.isEmpty()) return
        peekJob?.cancel()
        _ui.update { it.copy(expanded = true, menu = true, selectedId = it.selectedId ?: it.peekId, peekId = null) }
    }

    /** Swipe sideways while open: move to the next or previous live activity. */
    fun cycle(step: Int) {
        val sorted = _live.value.values.sortedByDescending { it.priority }
        if (sorted.size < 2) return
        val cur = _ui.value.selectedId ?: sorted.first().id
        val at = sorted.indexOfFirst { it.id == cur }.coerceAtLeast(0)
        val next = sorted[(at + step).mod(sorted.size)]
        _ui.update { it.copy(selectedId = next.id, menu = false) }
    }

    /** Swipe up / "Dismiss": closes the banner or hides that activity until it changes. A call only gets smaller. */
    fun dismiss(id: String) {
        val item = _live.value[id]
        if (item is MediaLive) mediaDismissedTitle = item.title
        when {
            item is TimerLive -> cancelTimer()
            item is StopwatchLive -> resetStopwatch()
            item is NoteLive && item.isCall -> minimizeCall()
            item is EventLive -> { dismissedEvents += item.eventId; remove(id) }
            else -> remove(id)
        }
        collapse()
    }

    // ---- stopwatch ------------------------------------------------------------------------------------------

    fun startStopwatch() {
        put(StopwatchLive(startedAt = SystemClock.elapsedRealtime(), running = true, bankedMs = 0L))
    }

    fun toggleStopwatch() {
        val s = _live.value["stopwatch"] as? StopwatchLive ?: return startStopwatch()
        val now = SystemClock.elapsedRealtime()
        put(if (s.running) s.copy(running = false, bankedMs = s.elapsed(now)) else s.copy(running = true, startedAt = now))
    }

    fun lapStopwatch() {
        val s = _live.value["stopwatch"] as? StopwatchLive ?: return
        if (!s.running) return
        put(s.copy(laps = (s.laps + s.elapsed(SystemClock.elapsedRealtime())).takeLast(20)))
    }

    fun resetStopwatch() = remove("stopwatch")

    /** Answer makes the island show the call as connected; Decline / Hang up ends it at once. */
    fun onCallAction(a: NoteAction) {
        when (a.positive) {
            true -> markAnswered()
            false -> endCall()
            null -> Unit
        }
    }

    // ---- timer ----------------------------------------------------------------------------------------------

    fun startTimer(ms: Long) {
        val now = SystemClock.elapsedRealtime()
        put(TimerLive(totalMs = ms, endsAt = now + ms, running = true, remainingWhenPaused = ms))
        scheduleTimerEnd()
    }

    fun pauseOrResumeTimer() {
        val t = _live.value["timer"] as? TimerLive ?: return
        val now = SystemClock.elapsedRealtime()
        if (t.running) {
            put(t.copy(running = false, remainingWhenPaused = t.remaining(now)))
            timerJob?.cancel()
        } else {
            put(t.copy(running = true, endsAt = now + t.remainingWhenPaused))
            scheduleTimerEnd()
        }
    }

    fun addToTimer(ms: Long) {
        val t = _live.value["timer"] as? TimerLive ?: return
        put(t.copy(totalMs = t.totalMs + ms, endsAt = t.endsAt + ms, remainingWhenPaused = t.remainingWhenPaused + ms))
        if (t.running) scheduleTimerEnd()
    }

    fun cancelTimer() {
        timerJob?.cancel()
        remove("timer")
    }

    private fun scheduleTimerEnd() {
        timerJob?.cancel()
        val t = _live.value["timer"] as? TimerLive ?: return
        timerJob = scope.launch {
            delay(t.remaining(SystemClock.elapsedRealtime()))
            remove("timer")
            Haptics.finish(appContext)
            notify(
                NoteLive("timer-done", "Timer", "Time is up", "Your timer has finished", null, null, emptyList(), false, pkg = "coco.timer"),
                bannerMs = 7000,
            )
        }
    }

    // ---- charging -------------------------------------------------------------------------------------------

    fun showCharge(percent: Int, charging: Boolean, forMs: Long = 6000) {
        put(ChargeLive(percent, charging), forMs)
    }

    fun updateChargeIfShown(percent: Int, charging: Boolean) {
        if (_live.value["charge"] != null) _live.update { it + ("charge" to ChargeLive(percent, charging)) }
    }

    fun clearMediaDismissal() {
        mediaDismissedTitle = null
    }
}
