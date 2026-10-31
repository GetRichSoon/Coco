package com.coco.launcher.apps

import android.content.ComponentName
import android.content.pm.LauncherActivityInfo

/**
 * One launchable activity. Identity is the component, so a reinstalled or updated app replaces its
 * old entry instead of appearing twice.
 */
class AppEntry(val info: LauncherActivityInfo, val label: String) {
    val component: ComponentName = info.componentName
    val key: String = component.flattenToShortString()

    /** A-Z bucket for the drawer fast scroller; anything that is not a letter lands in "#". */
    val section: String = label.firstOrNull()
        ?.takeIf { it.isLetter() }
        ?.uppercaseChar()?.toString()
        ?: "#"

    override fun equals(other: Any?): Boolean = other is AppEntry && other.key == key
    override fun hashCode(): Int = key.hashCode()
}
