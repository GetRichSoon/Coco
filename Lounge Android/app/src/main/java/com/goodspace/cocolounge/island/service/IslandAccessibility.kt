package com.goodspace.cocolounge.island.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.goodspace.cocolounge.island.runtime.IslandRuntime

/**
 * Only job: give the island a window ABOVE the status bar (TYPE_ACCESSIBILITY_OVERLAY). A normal overlay sits under the
 * status bar, so the bar took every tap and drew its icons over the pill. It reads no screen content.
 */
class IslandAccessibility : AccessibilityService() {
    override fun onServiceConnected() {
        instance = this
        IslandRuntime.attachAbove(this)
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        IslandRuntime.detachAbove(this)
        return super.onUnbind(intent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit

    companion object {
        /** Set while the service runs; used for the "tap again = minimise" home action. */
        var instance: IslandAccessibility? = null
    }
}
