package com.coco.launcher.apps

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Icons are decoded on demand for what is on screen and held in a byte-bounded cache, so a device
 * with 300 apps never pays for 300 bitmaps at once.
 */
object IconCache {

    private const val BUDGET_BYTES = 8 * 1024 * 1024

    private val cache = object : LruCache<String, ImageBitmap>(BUDGET_BYTES) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 4
    }

    fun peek(key: String): ImageBitmap? = cache.get(key)

    fun cacheKey(entry: AppEntry, sizePx: Int, themed: Boolean, foreground: Int, background: Int): String =
        if (themed) entry.key + "|" + sizePx + "|t" + foreground + "_" + background
        else entry.key + "|" + sizePx

    suspend fun icon(
        context: Context,
        entry: AppEntry,
        sizePx: Int,
        themed: Boolean,
        foreground: Int,
        background: Int,
    ): ImageBitmap? {
        val size = sizePx.coerceIn(48, 192)
        val key = cacheKey(entry, size, themed, foreground, background)
        cache.get(key)?.let { return it }

        return withContext(Dispatchers.IO) {
            val drawable = loadDrawable(context, entry) ?: return@withContext null
            val bitmap = runCatching {
                if (themed) themedBitmap(drawable, size, foreground, background)
                else drawable.toBitmap(size, size)
            }.getOrNull() ?: return@withContext null
            val image = bitmap.asImageBitmap()
            cache.put(key, image)
            image
        }
    }

    private fun loadDrawable(context: Context, entry: AppEntry): Drawable? =
        runCatching { entry.info.getIcon(0) }.getOrNull()
            ?: runCatching { context.packageManager.getActivityIcon(entry.component) }.getOrNull()
            ?: runCatching { context.packageManager.defaultActivityIcon }.getOrNull()

    /**
     * Themed icons reuse the icon's own monochrome layer (Android 13+). Apps that never shipped one
     * keep their full-colour icon rather than being flattened into an unreadable silhouette.
     */
    private fun themedBitmap(drawable: Drawable, size: Int, foreground: Int, background: Int): Bitmap {
        val mono = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && drawable is AdaptiveIconDrawable) {
            drawable.monochrome
        } else {
            null
        } ?: return drawable.toBitmap(size, size)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawCircle(
            size / 2f,
            size / 2f,
            size / 2f,
            Paint().apply {
                isAntiAlias = true
                color = background
            },
        )
        // The monochrome layer is authored at adaptive-icon scale, so it needs the same inset.
        val inset = (size * 0.18f).toInt()
        val layer = mono.mutate()
        layer.setBounds(inset, inset, size - inset, size - inset)
        layer.colorFilter = PorterDuffColorFilter(foreground, PorterDuff.Mode.SRC_IN)
        layer.draw(canvas)
        return bitmap
    }
}
