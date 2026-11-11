package com.goodspace.cocolounge

import kotlinx.coroutines.CancellationException
import org.json.JSONObject

/**
 * Where the one theme document lives and how it stays the same on every device. Pure Kotlin over two tiny interfaces (a key-value store and
 * the cloud row), so the JVM tests drive it with fakes.
 *
 * Local copy: one JSON string under `coco_theme_prefs`. Cloud copy: the `controls` row `ui_theme.<owner email>`, value = the document,
 * `updated_by` = this device, `updated_at` = the document's own `updatedAt`. No migration: the table already exists.
 *
 * Rules (the web Lounge follows the same ones):
 *  - the document with the later `updatedAt` wins; a running session adopts a newer remote document at once;
 *  - only user actions and scheduled rotations go to the cloud. A switch made because the app opened ("every launch") stays on this device;
 *  - the write is a compare-and-set on the row's previous `updated_at`. If someone else wrote first, read again, adopt theirs when it is
 *    newer, otherwise try once more. A missing row is created;
 *  - if the cloud cannot be read or written, this device keeps working on its local copy, silently.
 */
interface ThemeKv { fun get(key: String): String?; fun put(key: String, value: String) }

class ThemeRow(val value: JSONObject?, val updatedAt: String?)

interface ThemeCloud {
    /** The row, or null when there is none; throws when the cloud cannot be read. */
    suspend fun read(id: String): ThemeRow?
    /** PATCH ... updated_at = previous; true only when this write took the row. `previousUpdatedAt` null means the row has no stamp yet. */
    suspend fun claim(id: String, previousUpdatedAt: String?, value: JSONObject, by: String, at: String): Boolean
    /** POST a new row; false when it already exists (someone created it first). */
    suspend fun create(id: String, value: JSONObject, by: String, at: String): Boolean
}

enum class ThemeOrigin { User, Rotation, Remote }

class ThemeStore(val engine: ThemeEngine, private val kv: ThemeKv, private val clock: () -> Long = { System.currentTimeMillis() }) {
    companion object {
        const val KEY = "coco_theme_prefs"
        const val LEGACY_APPEARANCE = "theme"   // the old Light / Dark / System choice (before the six themes)
        const val ROW_PREFIX = "ui_theme."
        const val MAX_FAILURES = 5
        fun rowId(email: String?): String? = email?.trim()?.takeIf { it.isNotEmpty() }?.let { ROW_PREFIX + it.lowercase() }
    }

    var prefs: ThemePrefs = load()
        private set
    var device: String? = null
    var cloud: ThemeCloud? = null
    /** The founder's e-mail: names the cloud row. Without it the document stays on this device. */
    var owner: String? = null
    var onChange: ((ThemePrefs, ThemeOrigin) -> Unit)? = null
    private var failures = 0
    /** The `updatedAt` of the document the cloud is known to hold (null until this run has looked). */
    private var syncedAt: String? = null

    // ---------------------------------------------------------------- local copy
    private fun load(): ThemePrefs {
        val raw = kv.get(KEY)?.let { runCatching { JSONObject(it) }.getOrNull() }
        if (raw != null) return engine.normalize(raw)
        val legacy = kv.get(LEGACY_APPEARANCE)   // keep the Light / Dark / System choice people already made
        return engine.defaultPrefs().let { if (legacy == "light" || legacy == "dark" || legacy == "system") it.copy(appearance = legacy) else it }
    }
    private fun commit(next: ThemePrefs, origin: ThemeOrigin) {
        prefs = next
        if (origin == ThemeOrigin.Remote) syncedAt = next.updatedAt
        runCatching { kv.put(KEY, next.toJson().toString()) }
        onChange?.invoke(next, origin)
    }

    // ---------------------------------------------------------------- what the person does
    private fun user(next: ThemePrefs) { failures = 0; if (next != prefs) commit(next, ThemeOrigin.User) }
    fun apply(themeId: String) = user(engine.applyManual(prefs, themeId, clock(), device))
    fun advance(rand: Double) = user(engine.advance(prefs, clock(), rand, device))
    fun setAppearance(appearance: String) = user(engine.setAppearance(prefs, appearance, clock(), device))
    fun setRotation(patch: JSONObject) = user(engine.setRotation(prefs, patch, clock(), device))
    fun setLocked(locked: Boolean) = user(engine.setLocked(prefs, locked, clock(), device))
    fun reset() = user(engine.reset(clock(), device))

    // ---------------------------------------------------------------- what the clock does
    /** Launch = the app was opened as a new session; otherwise only a schedule that is due changes anything. */
    fun evaluate(launch: Boolean, rand: Double): ThemeEval {
        val r = engine.evaluate(prefs, clock(), launch, rand, device)
        if (r.reason != null) commit(r.prefs, ThemeOrigin.Rotation)
        return r
    }

    // ---------------------------------------------------------------- the cloud copy
    private fun newerThanLocal(remote: ThemePrefs) = (ThemeEngine.msOf(remote.updatedAt) ?: 0L) > (ThemeEngine.msOf(prefs.updatedAt) ?: 0L)

    /** A copy of the document that arrived by another road (the periodic company read). Adopted only when it is newer. */
    fun adoptRemote(value: JSONObject?): Boolean {
        val remote = value?.let { engine.normalize(it) } ?: return false
        if (!newerThanLocal(remote)) return false
        commit(remote, ThemeOrigin.Remote); return true
    }

    /**
     * Does this device hold a change the cloud has not seen? A launch switch never counts: it is only ever this device's own business.
     * Derived from the two documents, so a change made offline is still sent after a restart.
     */
    fun needsPush(remote: ThemePrefs?): Boolean {
        val mine = ThemeEngine.msOf(prefs.updatedAt) ?: return false
        return prefs.reason != "launch" && (remote == null || mine > (ThemeEngine.msOf(remote.updatedAt) ?: 0L))
    }

    val rowId: String? get() = rowId(owner)

    /** This device holds a change that still has to reach the cloud (and nothing has failed for good). */
    val dirty: Boolean get() = prefs.reason != "launch" && prefs.updatedAt != null && prefs.updatedAt != syncedAt && failures < MAX_FAILURES

    /** Read the row, adopt it if it is newer, otherwise send this device's change. Never throws (except to cancel). */
    suspend fun sync() {
        val c = cloud ?: return
        val id = rowId ?: return
        if (failures >= MAX_FAILURES) return
        repeat(2) {   // the second pass is the one retry after a lost compare-and-set
            val row = try { c.read(id) } catch (e: CancellationException) { throw e } catch (e: Exception) { failures++; return }
            val remote = row?.value?.let { engine.normalize(it) }
            if (remote != null && newerThanLocal(remote)) { commit(remote, ThemeOrigin.Remote); return }
            if (!needsPush(remote)) { syncedAt = prefs.updatedAt; return }
            val doc = prefs.toJson(); val by = device.orEmpty(); val at = prefs.updatedAt ?: return
            val took = try {
                if (row == null) c.create(id, doc, by, at) else c.claim(id, row.updatedAt, doc, by, at)
            } catch (e: CancellationException) { throw e } catch (e: Exception) { failures++; return }
            if (took) { failures = 0; syncedAt = at; return }
        }
    }
}
