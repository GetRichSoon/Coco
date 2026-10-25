package com.goodspace.cocolounge.island.runtime

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.MediaLive
import com.goodspace.cocolounge.island.util.AppIcons

/** Follows the active media session and publishes it as the island's media activity. Needs notification access. */
object MediaWatcher {
    private var manager: MediaSessionManager? = null
    private var component: ComponentName? = null
    private var appContext: Context? = null
    private val callbacks = HashMap<MediaController, MediaController.Callback>()
    private var controllers: List<MediaController> = emptyList()
    private val main = Handler(Looper.getMainLooper())

    private val sessionsListener = MediaSessionManager.OnActiveSessionsChangedListener { list -> attach(list.orEmpty()) }

    fun start(context: Context, listener: ComponentName) {
        val app = context.applicationContext
        appContext = app
        component = listener
        val m = app.getSystemService(MediaSessionManager::class.java) ?: return
        manager = m
        runCatching {
            m.addOnActiveSessionsChangedListener(sessionsListener, listener, main)
            attach(m.getActiveSessions(listener))
        }
    }

    fun stop() {
        manager?.let { runCatching { it.removeOnActiveSessionsChangedListener(sessionsListener) } }
        callbacks.forEach { (c, cb) -> runCatching { c.unregisterCallback(cb) } }
        callbacks.clear()
        controllers = emptyList()
        manager = null
        IslandHub.remove("media")
    }

    private fun attach(list: List<MediaController>) {
        callbacks.forEach { (c, cb) -> runCatching { c.unregisterCallback(cb) } }
        callbacks.clear()
        controllers = list
        for (c in list) {
            val cb = object : MediaController.Callback() {
                override fun onPlaybackStateChanged(state: PlaybackState?) = publish()
                override fun onMetadataChanged(metadata: MediaMetadata?) { IslandHub.clearMediaDismissal(); publish() }
                override fun onSessionDestroyed() = publish()
            }
            c.registerCallback(cb, main)
            callbacks[c] = cb
        }
        publish()
    }

    private fun publish() {
        val ctx = appContext ?: return
        val pick = controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
            ?: controllers.firstOrNull { it.metadata != null }
        if (pick == null) {
            IslandHub.remove("media")
            return
        }
        val meta = pick.metadata
        val title = meta?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: meta?.getString(MediaMetadata.METADATA_KEY_TITLE)
        if (meta == null || title.isNullOrBlank()) {
            IslandHub.remove("media")
            return
        }
        val state = pick.playbackState
        val playing = state?.state == PlaybackState.STATE_PLAYING
        val art: Bitmap? = (meta.getBitmap(MediaMetadata.METADATA_KEY_ART) ?: meta.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: meta.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON))?.let { AppIcons.scaled(it, 160) }
        val launch: PendingIntent? = pick.sessionActivity ?: ctx.packageManager.getLaunchIntentForPackage(pick.packageName)?.let {
            PendingIntent.getActivity(ctx, 0, it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        }
        val item = MediaLive(
            appName = AppIcons.label(ctx, pick.packageName),
            title = title,
            artist = meta.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: meta.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST).orEmpty(),
            art = art,
            playing = playing,
            positionMs = state?.position?.coerceAtLeast(0) ?: 0,
            durationMs = meta.getLong(MediaMetadata.METADATA_KEY_DURATION),
            stamp = SystemClock.elapsedRealtime(),
            controller = pick,
            launch = launch,
            tint = art?.let { artTint(it) },
        )
        // Paused music stays for two minutes in case you come back to it; playing music stays as long as it plays.
        IslandHub.put(item, if (playing) null else 120_000)
    }

    private var tintFor: Bitmap? = null
    private var tintValue: Int? = null

    /** The album art's main colour, brightened so it reads on black (the waveform and play button use it). */
    private fun artTint(b: Bitmap): Int? {
        if (b === tintFor) return tintValue
        val v = runCatching {
            val small = Bitmap.createScaledBitmap(b, 8, 8, true)
            var r = 0L; var g = 0L; var bl = 0L; var n = 0
            val hsv = FloatArray(3)
            for (x in 0 until 8) for (y in 0 until 8) {
                val c = small.getPixel(x, y)
                android.graphics.Color.colorToHSV(c, hsv)
                if (hsv[1] < 0.2f || hsv[2] < 0.2f) continue
                r += android.graphics.Color.red(c); g += android.graphics.Color.green(c); bl += android.graphics.Color.blue(c); n++
            }
            if (n == 0) return@runCatching null
            android.graphics.Color.colorToHSV(android.graphics.Color.rgb((r / n).toInt(), (g / n).toInt(), (bl / n).toInt()), hsv)
            hsv[1] = hsv[1].coerceAtLeast(0.45f)
            hsv[2] = hsv[2].coerceAtLeast(0.88f)
            android.graphics.Color.HSVToColor(hsv)
        }.getOrNull()
        tintFor = b
        tintValue = v
        return v
    }
}
