package com.goodspace.cocolounge.island.util

import android.content.Context
import android.graphics.Bitmap
import android.util.LruCache
import androidx.core.graphics.drawable.toBitmap

/** Small cache for app icons and labels, so a burst of notifications never decodes the same icon twice. */
object AppIcons {
    private val icons = LruCache<String, Bitmap>(24)
    private val labels = LruCache<String, String>(48)

    fun icon(context: Context, pkg: String): Bitmap? {
        icons.get(pkg)?.let { return it }
        return runCatching { context.packageManager.getApplicationIcon(pkg).toBitmap(96, 96) }.getOrNull()?.also { icons.put(pkg, it) }
    }

    fun label(context: Context, pkg: String): String {
        labels.get(pkg)?.let { return it }
        val pm = context.packageManager
        val name = runCatching { pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString() }.getOrDefault(pkg)
        labels.put(pkg, name)
        return name
    }

    /** Down-scales artwork once; the island never needs more than a thumbnail. */
    fun scaled(src: Bitmap, size: Int): Bitmap =
        if (src.width <= size && src.height <= size) src else Bitmap.createScaledBitmap(src, size, size, true)
}
