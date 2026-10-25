package com.goodspace.cocolounge.island.model

import android.app.PendingIntent
import android.graphics.Bitmap
import android.media.session.MediaController
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** One live activity the island can show. Higher priority wins the main pill; the next one becomes the side bubble. */
sealed interface Live {
    val id: String
    val priority: Int
}

data class MediaLive(
    val appName: String,
    val title: String,
    val artist: String,
    val art: Bitmap?,
    val playing: Boolean,
    val positionMs: Long,
    val durationMs: Long,
    /** SystemClock.elapsedRealtime() when positionMs was read, so progress can be extrapolated while playing. */
    val stamp: Long,
    val controller: MediaController?,
    val launch: PendingIntent?,
    /** Colour taken from the album art (ARGB), used for the waveform and controls like on iPhone. */
    val tint: Int? = null,
) : Live {
    override val id = "media"
    override val priority = 20
}

data class TimerLive(
    val totalMs: Long,
    /** elapsedRealtime when it ends (only meaningful while running). */
    val endsAt: Long,
    val running: Boolean,
    val remainingWhenPaused: Long,
) : Live {
    override val id = "timer"
    override val priority = 40
    fun remaining(now: Long): Long = if (running) (endsAt - now).coerceAtLeast(0) else remainingWhenPaused
}

data class ChargeLive(val percent: Int, val charging: Boolean) : Live {
    override val id = "charge"
    override val priority = 10
}

data class NoteAction(
    val label: String,
    val intent: PendingIntent?,
    val positive: Boolean?,
    /** The app's own reply box (WhatsApp, Telegram, Messages...). Non-empty = typing happens inside the island. */
    val remote: List<android.app.RemoteInput> = emptyList(),
    /** The app's own icon for this button, when it ships one. */
    val icon: Bitmap? = null,
) {
    val isReply get() = remote.isNotEmpty()
}

enum class CallState { Incoming, Ongoing }

data class NoteLive(
    override val id: String,
    val appName: String,
    val title: String,
    val text: String,
    val icon: Bitmap?,
    val open: PendingIntent?,
    val actions: List<NoteAction>,
    val isCall: Boolean,
    val callState: CallState = CallState.Incoming,
    /** elapsedRealtime when the call connected (ongoing calls only). */
    val startedAt: Long = 0L,
    val pkg: String = "",
    /** Sender photo (the notification large icon), shown with the app logo on its corner. */
    val avatar: Bitmap? = null,
    /** An ongoing live update (download, navigation, ride): shown as a quiet pill, never as a banner. */
    val live: Boolean = false,
    /** 0..100, -1 = busy without a number, -2 = no progress bar, -3 = waiting for the founder (Coco approval). */
    val progress: Int = -2,
    /** elapsedRealtime the app's own clock counts from (recorder, workout, screen recording); 0 = no clock. */
    val since: Long = 0L,
    /** The short status-bar text an Android 16 Live Update asks for ("5 min", "2 stops"). */
    val shortText: String = "",
    /** A recorder or screen recording: the pill gets a red dot like iPhone. */
    val recording: Boolean = false,
    /** The phone app already pops up its own call banner (high importance), so the island must not add a second big card. */
    val systemBanner: Boolean = false,
) : Live {
    override val priority = if (isCall) 100 else if (live && progress == -3) 70 else if (recording) 55 else if (live) 30 else 60
    /** Buttons the app offers for this message (Reply, Mark as read, Like...), exactly as the app labels them. */
    val appActions get() = if (isCall) emptyList() else actions.filter { it.positive == null }.take(3)
    val ringing get() = isCall && callState == CallState.Incoming
    val inCall get() = isCall && callState == CallState.Ongoing
}

enum class AlertKind { Silent, Vibrate, Ring, FocusOn, FocusOff, Headphones, HeadphonesOff }

/** A short system moment (silent switch, Focus, headphones), shown for a couple of seconds like the iPhone island. */
data class AlertLive(
    val kind: AlertKind,
    val title: String,
    val detail: String,
    /** Earbuds battery 0..100 for the AirPods-style ring; -1 = unknown. */
    val level: Int = -1,
) : Live {
    override val id = "alert"
    override val priority = 80
}

/** Stopwatch started from the island or the Coco app. */
data class StopwatchLive(
    /** elapsedRealtime of the last start (only meaningful while running). */
    val startedAt: Long,
    val running: Boolean,
    /** Time collected before the last pause. */
    val bankedMs: Long,
    /** Total elapsed at each lap, oldest first. */
    val laps: List<Long> = emptyList(),
) : Live {
    override val id = "stopwatch"
    override val priority = 41
    fun elapsed(now: Long): Long = bankedMs + if (running) (now - startedAt).coerceAtLeast(0) else 0
}

/** Turn-by-turn navigation (Google Maps and others): the app's own turn arrow, distance to the turn and the street. */
data class NavLive(
    override val id: String,
    val appName: String,
    val distance: String,
    val instruction: String,
    val eta: String,
    val arrow: Bitmap?,
    val icon: Bitmap?,
    val open: PendingIntent?,
    val pkg: String,
) : Live {
    override val priority = 50
}

/** The torch is on (switched on from anywhere). A tap on the pill switches it off. */
data class TorchLive(val on: Boolean = true) : Live {
    override val id = "torch"
    override val priority = 36
}

/** A meeting from the phone calendar, from 10 minutes before it starts until 5 minutes after. */
data class EventLive(
    val eventId: Long,
    val title: String,
    /** Wall-clock millis. */
    val beginMs: Long,
    val endMs: Long,
    val location: String,
    val joinUrl: String?,
) : Live {
    override val id = "event"
    override val priority = 45
}

/** What the island looks like right now. Pure data, so the same value drives the window size and the animation. */
sealed interface Face {
    val key: String

    data object Hidden : Face { override val key = "hidden" }

    data class Compact(val primary: Live, val secondary: Live?) : Face {
        override val key = "c:${primary.id}:${secondary?.id ?: "-"}"
    }

    /** reply = the inline reply box is open inside the banner. */
    data class Peek(val item: Live, val reply: Boolean = false) : Face { override val key = "p:${item.id}:${if (reply) "r" else "-"}" }

    data class Expanded(val item: Live, val others: List<Live>, val menu: Boolean) : Face {
        override val key = "e:${item.id}:${if (menu) "m" else "-"}:${(item as? NoteLive)?.callState ?: ""}"
    }
}

/** User interaction state held by the hub. */
data class IslandUi(
    val expanded: Boolean = false,
    val menu: Boolean = false,
    val selectedId: String? = null,
    val peekId: String? = null,
    /** The banner whose reply box is open (keyboard up). */
    val replyId: String? = null,
)

/** Target geometry for a face. The container springs toward it; the host window follows it. */
data class IslandShape(val width: Dp, val height: Dp, val radius: Dp)

object IslandShapes {
    /** Set from the real screen width at start, so the island can never be wider than the display. */
    var maxWidth: Dp = 360.dp
    private fun fit(w: Dp): Dp = if (w > maxWidth) maxWidth else w

    /** Widest the small pill may be so it stays clear of the clock (left) and battery (right). Set from the real screen. */
    var maxCompact: Dp = 400.dp
    /** Same, while the side bubble is shown (the bubble needs room on the right too). */
    var maxCompactSplit: Dp = 400.dp
    /** False when the status bar has no room for the side circle (Nord CE 2: it would sit on the Wi-Fi icon). */
    var splitFits = true

    val Dot = IslandShape(34.dp, 34.dp, 17.dp)
    /** Fits inside the status bar with a small gap above and below, like the iPhone pill (was 36 dp, taller than the bar). */
    val compactHeight = 28.dp

    /** The detached circle that shows a second live activity next to the pill (iPhone "split" island). */
    val Bubble = 36.dp
    val BubbleGap = 7.dp

    fun of(face: Face): IslandShape = when (face) {
        Face.Hidden -> Dot
        is Face.Compact -> {
            val base = when (val p = face.primary) {
                is MediaLive -> 150
                is TimerLive -> 150
                is ChargeLive -> 150
                is AlertLive -> 196
                is NoteLive -> when {
                    p.inCall -> 156
                    p.ringing -> 176
                    p.since > 0L || p.shortText.isNotBlank() -> 160
                    else -> 150
                }
                is StopwatchLive -> 156
                is NavLive -> 176
                is TorchLive -> 140
                is EventLive -> 176
            }
            val limit = if (face.secondary != null) maxCompactSplit else maxCompact
            IslandShape(minOf(fit(base.dp), limit), compactHeight, 18.dp)
        }
        is Face.Peek -> {
            val n = face.item as? NoteLive
            when {
                n?.isCall == true -> IslandShape(fit(340.dp), 84.dp, 42.dp)
                // Same height with or without the reply box, so opening it never resizes the window.
                face.reply || (n != null && n.appActions.isNotEmpty()) -> IslandShape(fit(352.dp), 124.dp, 32.dp)
                else -> IslandShape(fit(340.dp), 72.dp, 36.dp)
            }
        }
        is Face.Expanded -> IslandShape(
            fit(360.dp),
            when (val i = face.item) {
                is MediaLive -> 208.dp
                is TimerLive -> 176.dp
                is ChargeLive -> 132.dp
                is AlertLive -> 96.dp
                is NoteLive -> when {
                    i.inCall -> 168.dp
                    i.ringing -> 156.dp
                    else -> 168.dp
                }
                is StopwatchLive -> 176.dp
                is NavLive -> 150.dp
                is TorchLive -> 96.dp
                is EventLive -> 150.dp
            } + if (face.menu) 52.dp else 0.dp,
            44.dp,
        )
    }
}
