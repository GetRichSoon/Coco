package com.goodspace.cocolounge

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.net.URLEncoder
import kotlin.random.Random

/** The two contract files, packed into the assets from Lounge/contract at build time. */
fun loadThemeContract(ctx: Context): ThemeContract {
    fun read(name: String) = ctx.assets.open(name).bufferedReader().use { it.readText() }
    return ThemeContract.parse(read("themes.json"), read("theme-schemes.json"))
}

class SharedPrefsKv(private val sp: SharedPreferences) : ThemeKv {
    override fun get(key: String): String? = sp.getString(key, null)
    override fun put(key: String, value: String) { sp.edit().putString(key, value).apply() }
}

/** The cloud copy of the theme document: one row of `controls` (id `ui_theme.<email>`), read and written the way every other control is, through Nova. */
class NovaThemeCloud(private val cloud: Cloud) : ThemeCloud {
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    override suspend fun read(id: String): ThemeRow? {
        val r = cloud.list("controls", "select=*&id=eq.${enc(id)}").optJSONObject(0) ?: return null
        val v = r.opt("value")
        val doc = when (v) { is JSONObject -> v; is String -> runCatching { JSONObject(v) }.getOrNull(); else -> null }
        return ThemeRow(doc, r.optString("updated_at").takeIf { it.isNotBlank() && it != "null" })
    }

    override suspend fun claim(id: String, previousUpdatedAt: String?, value: JSONObject, by: String, at: String): Boolean {
        val stamp = if (previousUpdatedAt == null) "updated_at=is.null" else "updated_at=eq.${enc(previousUpdatedAt)}"
        return cloud.claim("controls", "id=eq.${enc(id)}&$stamp", JSONObject().put("value", value).put("updated_by", by).put("updated_at", at))
    }

    override suspend fun create(id: String, value: JSONObject, by: String, at: String): Boolean = try {
        cloud.insert("controls", JSONObject().put("id", id).put("value", value).put("updated_by", by).put("updated_at", at)); true
    } catch (e: Cloud.CloudError) {
        if (e.code == 409 || e.message.orEmpty().contains("duplicate", ignoreCase = true)) false else throw e   // someone created the row first
    }
}

/**
 * The active COCO theme on this phone: the persisted document (ThemeStore), what the screens observe, and the preview. One per app session.
 *
 * Launch = the app was opened as a new session (MainActivity creates a fresh Activity, not a config change or a restore). On launch, and on
 * every resume and 60 s tick while the app is on screen, the engine looks at the clock: "every launch" switches only on launch, any other
 * schedule switches only when it is DUE (one step, however many times were missed while the app was closed).
 */
class ThemeController(app: Application, private val cloud: Cloud, private val scope: CoroutineScope) {
    val contract: ThemeContract = loadThemeContract(app)
    val engine = ThemeEngine(contract)
    private val store = ThemeStore(engine, SharedPrefsKv(app.getSharedPreferences("coco_settings", Context.MODE_PRIVATE)))

    /** The document, as a Compose state: every screen that reads it redraws when it changes. */
    var prefs by mutableStateOf(store.prefs)
        private set
    /** A theme being tried on the Appearance screen: it wears the whole app until Apply or Cancel (or leaving the screen). */
    var previewId by mutableStateOf<String?>(null)
        private set
    val effectiveThemeId: String get() = previewId ?: prefs.themeId

    init { store.onChange = { p, _ -> prefs = p } }

    /** Who this device is and which cloud row is ours. Cheap; call again once the founder's e-mail is known. */
    fun configure() {
        store.device = cloud.deviceId
        store.owner = cloud.email
        store.cloud = if (cloud.paired) NovaThemeCloud(cloud) else null
    }

    private fun flush() { scope.launch { store.sync() } }

    /** A new session. A schedule that is due is decided only after the cloud copy has been looked at (for at most two seconds), so a device that
     *  was closed for a while cannot step the theme over a newer choice made on another device. */
    fun onLaunch() {
        configure()
        scope.launch {
            val p = store.prefs
            val needsCloudFirst = store.cloud != null && store.rowId != null && engine.rotating(p) && (engine.kindOf(p) == "launch" || engine.isDue(p, System.currentTimeMillis()))
            if (needsCloudFirst) { val look = async { store.sync() }; withTimeoutOrNull(2_000) { look.await() } }
            store.evaluate(launch = true, rand = Random.nextDouble())
            store.sync()
        }
    }

    /** Every resume and every 60 s while the app is on screen: focusing an existing session is NOT a launch, only a due schedule switches. */
    fun tick() {
        store.evaluate(launch = false, rand = Random.nextDouble())
        if (store.dirty) flush()
    }

    /** The periodic company read already carries the `controls` rows: adopt the theme document from it when it is newer. */
    fun adoptFromControls(controls: List<JSONObject>) {
        val id = store.rowId ?: return
        val v = controls.firstOrNull { it.optString("id") == id }?.opt("value") ?: return
        store.adoptRemote(when (v) { is JSONObject -> v; is String -> runCatching { JSONObject(v) }.getOrNull(); else -> null })
    }

    // ---------------------------------------------------------------- what the person does
    fun apply(themeId: String) { previewId = null; store.apply(themeId); flush() }
    fun setAppearance(appearance: String) { store.setAppearance(appearance); flush() }
    fun setRotation(patch: JSONObject) { store.setRotation(patch); flush() }
    fun advance() { previewId = null; store.advance(Random.nextDouble()); flush() }
    fun setLocked(locked: Boolean) { store.setLocked(locked); flush() }
    fun reset() { previewId = null; store.reset(); flush() }
    fun preview(themeId: String) { previewId = themeId.takeIf { it in engine.ids } }
    fun cancelPreview() { previewId = null }
}
