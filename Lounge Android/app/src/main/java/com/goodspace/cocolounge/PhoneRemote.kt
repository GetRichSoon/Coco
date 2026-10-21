package com.goodspace.cocolounge

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.StatFs
import android.provider.MediaStore
import android.provider.Settings
import android.view.KeyEvent
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import java.net.URLEncoder

/** Phone Control mode: a fixed list of actions a founder's PC may send to this phone. Nothing else runs. */
object PhoneRemote {
    @Volatile var foreground = false

    private val apps = mapOf(
        "youtube" to "com.google.android.youtube", "ytmusic" to "com.google.android.apps.youtube.music", "whatsapp" to "com.whatsapp",
        "instagram" to "com.instagram.android", "chrome" to "com.android.chrome", "brave" to "com.brave.browser",
        "maps" to "com.google.android.apps.maps", "spotify" to "com.spotify.music", "gmail" to "com.google.android.gm",
    )

    private val appWords = listOf(
        """\b(vs ?code|visual studio|code)\b""" to "vscode", """\bcursor\b""" to "cursor", """\bchrome\b""" to "chrome", """\bbrave\b""" to "brave", """\bedge\b""" to "edge",
        """\bnotepad\b""" to "notepad", """\b(calculator|calc)\b""" to "calculator", """\b(files?|explorer|folder)\b""" to "files", """\bsettings?\b""" to "settings", """\bspotify\b""" to "spotify",
        """\bwhats ?app\b""" to "whatsapp", """\b(yt|youtube) ?music\b""" to "ytmusic", """\b(yt|youtube)\b""" to "youtube", """\b(insta|instagram)\b""" to "instagram", """\bmaps?\b""" to "maps",
        """\b(gmail|mail)\b""" to "gmail", """\bcamera\b""" to "camera", """\b(lounge|coco)\b""" to "lounge",
    ).map { Regex(it.first) to it.second }

    /** Plain words (English or Hinglish) into one fixed action. Same rules as `understand` in the desktop app's main.js. */
    fun understand(text: String, kind: String): Pair<String, JSONObject>? {
        val t = text.lowercase().replace(Regex("[.!?,]+"), " ").replace(Regex("\\s+"), " ").trim()
        if (t.isEmpty()) return null
        fun r(p: String) = Regex(p).containsMatchIn(t)
        fun a(action: String, vararg kv: Pair<String, Any>) = action to JSONObject().apply { kv.forEach { (k, v) -> put(k, v) } }
        Regex("""https?://\S+""").find(t)?.let { return a("open_url", "url" to it.value.replace(Regex("^http:"), "https:")) }
        val play = Regex("""^(?:play|chala(?:o)?|bajao|baja|laga(?:o)?|sunao|suna)\s+(.+)$""").find(t) ?: Regex("""^(.+?)\s+(?:chala(?:o|do)?|bajao|baja do|laga(?:o|do)?|sunao|play kar(?:o|do)?|play)$""").find(t)
        play?.groupValues?.get(1)?.takeIf { !Regex("^(music|song|gaana|video)$").matches(it) }?.let { q ->
            return a("play_youtube", "q" to q.replace(Regex("""\b(song|gaana|gana|ke gaane|gaane|on youtube|youtube pe|youtube par)\b"""), " ").replace(Regex("\\s+"), " ").trim().ifEmpty { q })
        }
        val browser = Regex("""\b(brave|chrome|edge)\b""").find(t)?.groupValues?.get(1)
        val web = mapOf("youtube" to "https://www.youtube.com", "ytmusic" to "https://music.youtube.com", "instagram" to "https://www.instagram.com", "gmail" to "https://mail.google.com", "maps" to "https://maps.google.com")
        fun openIt(app: String) = if (kind == "pc" && web[app] != null) a("open_url", "url" to web[app]!!, "browser" to (browser ?: "brave")) else a("open_app", "app" to app)
        // "youtube brave app", "youtube brave chalu kar"
        if (r("""\b(yt|youtube)\b""") && !r("""\bmusic\b""") && (browser != null || t.split(" ").size <= 4)) return openIt("youtube")
        if (r("""\b(close|band kar(?:o|do)?|hata(?:o|do)?|exit)\b""") && !r("""\b(pc|laptop|computer|system)\b""")) return a("close_app")
        val open = Regex("""^(?:open|khol(?:o|do)?|start|launch|chalu kar(?:o)?)\s+(.+)$""").find(t) ?: Regex("""^(.+?)\s+(?:khol(?:o|do)?|open kar(?:o|do)?|open|chalu kar(?:o|do)?)$""").find(t)
        open?.groupValues?.get(1)?.let { w -> appWords.firstOrNull { it.first.containsMatchIn(w) }?.let { (_, app) -> return openIt(app) } }
        // just an app name: "chrome", "whatsapp"
        if (t.split(" ").size <= 3 && !r("""\b(volume|awaaz|play|chala|bajao|status|lock)\b""")) appWords.firstOrNull { it.first.containsMatchIn(t) }?.let { (_, app) -> return openIt(app) }
        if (r("""\b(volume|awaaz|awaz|aawaz|sound|louder|quieter)\b""")) {
            val steps = Regex("""\b(\d{1,2})\b""").find(t)?.groupValues?.get(1)?.toIntOrNull() ?: 3
            return when { r("""\b(mute|band|chup)\b""") -> a("volume", "key" to "mute"); r("""\b(down|kam|low|dheere|dheema|quieter)\b""") -> a("volume", "key" to "down", "steps" to steps); else -> a("volume", "key" to "up", "steps" to steps) }
        }
        return when {
            r("""^(mute|chup)\b""") -> a("volume", "key" to "mute")
            r("""^(next|agla|skip)\b""") -> a("media", "key" to "next")
            r("""^(previous|prev|pichla|back)\b""") -> a("media", "key" to "prev")
            r("""^(pause|resume|play|ruko|rok|stop music|gaana rok)\b""") -> a("media", "key" to "playpause")
            r("""\b(status|battery|kya haal)\b""") -> a("status")
            r("""\b(ring|find (my )?phone|phone dhundo)\b""") -> a("ring")
            r("""\block\b""") -> a("lock")
            r("""\b(cancel|mat karo|ruk ja)\b""") -> a("cancel_power")
            r("""\b(restart|reboot)\b""") -> a("restart")
            r("""\b(shut ?down|switch off|power off|band kar(o|do)?)\b""") -> a("shutdown")
            r("""\b(sleep|so ja(o)?)\b""") -> a("sleep")
            else -> Regex("""^(?:say|message|msg|bol(?:o)?|likho)\s+(.+)$""").find(t)?.let { a("notify", "text" to it.groupValues[1]) }
        }
    }

    suspend fun run(ctx: Context, action: String, args: JSONObject): String = when (action) {
        "say" -> understand(args.optString("text"), "phone")?.takeIf { it.first != "say" }?.let { (a, x) -> run(ctx, a, x) }
            ?: "Not understood: \"${args.optString("text").take(60)}\". Try: kesariya chalao, youtube kholo, whatsapp kholo, awaaz badhao, ring, status"
        "lock", "sleep", "restart", "shutdown", "cancel_power", "close_app", "workspace" -> "A phone can't do \"$action\" from Coco; use the phone's own buttons"
        "status" -> status(ctx)
        "notify" -> { post(ctx, "Coco", args.optString("text").take(200), null); "Shown on the phone" }
        "open_url" -> args.optString("url").let { u -> if (!u.startsWith("https://")) "Only https links" else launch(ctx, Intent(Intent.ACTION_VIEW, Uri.parse(u)), "Open link", "Opened $u") }
        "play_youtube" -> {
            val q = args.optString("q").trim().take(120)
            if (q.isBlank()) "Say what to play" else {
                val id = firstVideo(q)
                val url = if (id != null) "https://www.youtube.com/watch?v=$id" else "https://www.youtube.com/results?search_query=${URLEncoder.encode(q, "UTF-8")}"
                launch(ctx, Intent(Intent.ACTION_VIEW, Uri.parse(url)), "Play \"$q\"", if (id != null) "Playing \"$q\" on YouTube" else "Opened YouTube search for \"$q\"")
            }
        }
        "open_app" -> when (val app = args.optString("app")) {
            "camera" -> launch(ctx, Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA), "Open camera", "Opened camera")
            "settings" -> launch(ctx, Intent(Settings.ACTION_SETTINGS), "Open settings", "Opened settings")
            else -> apps[app]?.let { pkg -> ctx.packageManager.getLaunchIntentForPackage(pkg)?.let { launch(ctx, it, "Open $app", "Opened $app") } ?: "$app is not installed" } ?: "This app is not on the allowed list"
        }
        "media" -> {
            val code = mapOf("playpause" to KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, "next" to KeyEvent.KEYCODE_MEDIA_NEXT, "prev" to KeyEvent.KEYCODE_MEDIA_PREVIOUS)[args.optString("key")]
            if (code == null) volume(ctx, args) else { val am = ctx.getSystemService(AudioManager::class.java); am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code)); am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code)); "Done: ${args.optString("key")}" }
        }
        "volume" -> volume(ctx, args)
        "ring" -> ring(ctx)
        else -> "This phone does not do \"$action\""
    }

    private fun volume(ctx: Context, args: JSONObject): String {
        val am = ctx.getSystemService(AudioManager::class.java)
        val dir = when (args.optString("key")) { "up" -> AudioManager.ADJUST_RAISE; "down" -> AudioManager.ADJUST_LOWER; "mute" -> AudioManager.ADJUST_TOGGLE_MUTE; else -> return "Unknown key" }
        repeat(if (dir == AudioManager.ADJUST_TOGGLE_MUTE) 1 else args.optInt("steps", 3).coerceIn(1, 10)) { am.adjustStreamVolume(AudioManager.STREAM_MUSIC, dir, AudioManager.FLAG_SHOW_UI) }
        return "Volume ${am.getStreamVolume(AudioManager.STREAM_MUSIC)} of ${am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)}"
    }

    /** Find my phone: rings for 20 seconds, even on silent volume for media. */
    private fun ring(ctx: Context): String {
        val uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        val r = RingtoneManager.getRingtone(ctx, uri) ?: return "No ringtone found"
        r.audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        r.play(); Handler(Looper.getMainLooper()).postDelayed({ r.stop() }, 20_000)
        return "Ringing for 20 seconds"
    }

    fun status(ctx: Context): String {
        val bm = ctx.getSystemService(BatteryManager::class.java)
        val st = StatFs(Environment.getDataDirectory().path)
        val am = ctx.getSystemService(AudioManager::class.java)
        return "${android.os.Build.MODEL} · battery ${bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)}%${if (bm.isCharging) " charging" else ""} · free ${st.availableBytes / 1_000_000_000} GB · volume ${am.getStreamVolume(AudioManager.STREAM_MUSIC)}/${am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)}"
    }

    /** Opens at once when the Lounge is on screen; otherwise Android allows it only from a tap, so a notification asks for one. */
    private fun launch(ctx: Context, intent: Intent, ask: String, done: String): String {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        // "Display over other apps" (Boss, 2026-10-21) lets Coco open apps even when the Lounge is closed.
        if (foreground) return runCatching { ctx.startActivity(intent); done }.getOrElse { "failed: ${it.message}" }
        if (android.provider.Settings.canDrawOverlays(ctx)) {
            // OnePlus/ColorOS blocks app starts from a closed app unless it has a visible window: show a 1-pixel
            // see-through overlay for a moment, open the app while it is up, then remove it.
            val main = android.os.Handler(android.os.Looper.getMainLooper())
            main.post {
                val wm = ctx.getSystemService(android.view.WindowManager::class.java)
                val dot = android.view.View(ctx)
                val lp = android.view.WindowManager.LayoutParams(1, 1, android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                    android.graphics.PixelFormat.TRANSLUCENT)
                val added = runCatching { wm.addView(dot, lp) }.isSuccess
                main.postDelayed({
                    runCatching { ctx.startActivity(intent) }
                    main.postDelayed({ if (added) runCatching { wm.removeView(dot) } }, 1500)
                }, 150)
            }
            return done
        }
        post(ctx, "From your PC", "$ask: tap to open", intent)
        return "$ask: waiting for a tap on the phone notification"
    }

    private fun post(ctx: Context, title: String, text: String, intent: Intent?) {
        val n = NotificationCompat.Builder(ctx, "coco_lounge").setSmallIcon(R.drawable.ic_coco_face).setColor(0xFFB83A12.toInt())
            .setContentTitle(title).setContentText(text).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH)
        intent?.let { n.setContentIntent(PendingIntent.getActivity(ctx, text.hashCode(), it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)) }
        runCatching { ctx.getSystemService(NotificationManager::class.java).notify(7000 + (text.hashCode() and 0xfff), n.build()) }
    }

    private suspend fun firstVideo(q: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val c = URL("https://www.youtube.com/results?search_query=${URLEncoder.encode(q, "UTF-8")}&hl=en").openConnection()
            c.setRequestProperty("accept-language", "en-US"); c.setRequestProperty("cookie", "CONSENT=YES+1")
            // Without a browser name YouTube sends a page with no video list, so play always fell back to search.
            c.setRequestProperty("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
            c.connectTimeout = 8000; c.readTimeout = 8000
            Regex("\"videoId\":\"([\\w-]{11})\"").find(c.getInputStream().bufferedReader().readText())?.groupValues?.get(1)
        }.getOrNull()
    }
}
