package com.goodspace.cocolounge.island.util

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween

/**
 * The island's motion language in one place. Tuned 2026-10-22 to feel like the iPhone island (SwiftUI spring, about
 * 0.32 s response, little bounce): width and height share one spring so the pill grows evenly, never stretches.
 * Width, height and corner radius use three different springs, so the
 * container does not stretch like a rubber band but breathes: width leads and overshoots a little, height follows
 * softer, the corner radius settles last and tighter. Content uses a shorter, firmer spring so it lands with the shape.
 * When the user turned animations off, every spec becomes an instant change.
 */
class MotionSpecs(val reduced: Boolean) {
    fun <T> width(): FiniteAnimationSpec<T> = if (reduced) snap() else spring(dampingRatio = 0.8f, stiffness = 380f)
    fun <T> height(): FiniteAnimationSpec<T> = if (reduced) snap() else spring(dampingRatio = 0.8f, stiffness = 380f)
    fun <T> radius(): FiniteAnimationSpec<T> = if (reduced) snap() else spring(dampingRatio = 0.9f, stiffness = 600f)
    fun <T> content(): FiniteAnimationSpec<T> = if (reduced) snap() else spring(dampingRatio = 0.86f, stiffness = 650f)
    fun <T> fadeIn(): FiniteAnimationSpec<T> = if (reduced) snap() else tween(durationMillis = 140, delayMillis = 40)
    fun <T> fadeOut(): FiniteAnimationSpec<T> = if (reduced) snap() else tween(durationMillis = 70)
    fun <T> press(): FiniteAnimationSpec<T> = if (reduced) snap() else spring(dampingRatio = 0.55f, stiffness = 700f)
}

object ReducedMotion {
    /** True when the system animation scale is 0 (Settings > Accessibility > Remove animations). */
    fun enabled(context: Context): Boolean = try {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    } catch (e: Exception) {
        false
    }
}
