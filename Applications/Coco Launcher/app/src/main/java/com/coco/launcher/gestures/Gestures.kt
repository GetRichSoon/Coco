package com.coco.launcher.gestures

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.abs

/** What the home grid wants to do while an icon is being held or flicked. */
class HomeDrag(
    val onStart: () -> Unit,
    val onDrag: (Offset) -> Unit,
    val onEnd: (cancelled: Boolean) -> Unit,
    val onVerticalSwipe: (totalY: Float) -> Unit,
)

private enum class Outcome { Tap, Swipe, Cancel, LongPress }

/**
 * Every home-screen touch resolved in one loop: a quick release opens the app, a vertical flick is
 * handed back to the home screen so swiping up over a full grid still opens the drawer, and holding
 * still picks the icon up. The gesture consumes its events, which is what stops the wallpaper layer
 * underneath from also treating the same press as a long press on empty space.
 */
fun Modifier.homeItemGestures(
    key: Any?,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
    handlers: HomeDrag,
): Modifier = pointerInput(key) {
    val slop = viewConfiguration.touchSlop
    val longPressTimeout = viewConfiguration.longPressTimeoutMillis

    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        down.consume()
        var totalY = 0f

        val outcome = withTimeoutOrNull(longPressTimeout) {
            var result: Outcome? = null
            while (result == null) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id }
                if (change == null) {
                    result = Outcome.Cancel
                } else {
                    change.consume()
                    val travel = change.position - down.position
                    when {
                        !change.pressed -> result = Outcome.Tap
                        abs(travel.y) > slop && abs(travel.y) > abs(travel.x) -> {
                            totalY = travel.y
                            result = Outcome.Swipe
                        }
                    }
                }
            }
            result
        } ?: Outcome.LongPress

        when (outcome) {
            Outcome.Cancel -> Unit

            Outcome.Tap -> onTap()

            Outcome.Swipe -> {
                // Keep following the finger so the distance at release is the real one.
                val completed = drag(down.id) { change ->
                    totalY = change.position.y - down.position.y
                    change.consume()
                }
                if (completed) handlers.onVerticalSwipe(totalY)
            }

            Outcome.LongPress -> {
                onLongPress()
                var moved = false
                val completed = drag(down.id) { change ->
                    if (!moved) {
                        moved = true
                        handlers.onStart()
                    }
                    handlers.onDrag(change.positionChange())
                    change.consume()
                }
                if (moved) handlers.onEnd(!completed)
            }
        }
    }
}
