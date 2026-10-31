package com.coco.launcher.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.coco.launcher.theme.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.store: DataStore<Preferences> by preferencesDataStore(name = "coco_launcher")

enum class DoubleTapAction { None, Search, Drawer }

data class Settings(
    val themeMode: ThemeMode = ThemeMode.System,
    val homeColumns: Int = 5,
    val homeRows: Int = 5,
    val iconSizeDp: Int = 52,
    val showLabels: Boolean = true,
    val showAtAGlance: Boolean = true,
    val showNextEvent: Boolean = false,
    val showSearchPill: Boolean = true,
    val showDock: Boolean = true,
    val dockCount: Int = 4,
    val themedIcons: Boolean = false,
    val drawerColumns: Int = 4,
    val doubleTap: DoubleTapAction = DoubleTapAction.None,
    val homeLayout: String = "",
    val dock: String = "",
)

object Prefs {
    private val THEME = stringPreferencesKey("theme_mode")
    private val COLUMNS = intPreferencesKey("home_columns")
    private val ROWS = intPreferencesKey("home_rows")
    private val ICON = intPreferencesKey("icon_size")
    private val LABELS = booleanPreferencesKey("show_labels")
    private val GLANCE = booleanPreferencesKey("show_glance")
    private val EVENT = booleanPreferencesKey("show_event")
    private val PILL = booleanPreferencesKey("show_pill")
    private val DOCK_ON = booleanPreferencesKey("show_dock")
    private val DOCK_N = intPreferencesKey("dock_count")
    private val THEMED = booleanPreferencesKey("themed_icons")
    private val DRAWER_COLS = intPreferencesKey("drawer_columns")
    private val DOUBLE_TAP = stringPreferencesKey("double_tap")
    private val LAYOUT = stringPreferencesKey("home_layout")
    private val DOCK = stringPreferencesKey("dock")

    /**
     * Build this once and hold on to it: each call returns a new mapped flow, and collecting a
     * fresh flow on every recomposition restarts the collection forever, which on a launcher means
     * the first frame never draws.
     */
    fun flow(context: Context): Flow<Settings> = context.store.data.map { p ->
        val d = Settings()
        Settings(
            themeMode = p[THEME]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: d.themeMode,
            homeColumns = (p[COLUMNS] ?: d.homeColumns).coerceIn(3, 7),
            homeRows = (p[ROWS] ?: d.homeRows).coerceIn(3, 7),
            iconSizeDp = (p[ICON] ?: d.iconSizeDp).coerceIn(40, 72),
            showLabels = p[LABELS] ?: d.showLabels,
            showAtAGlance = p[GLANCE] ?: d.showAtAGlance,
            showNextEvent = p[EVENT] ?: d.showNextEvent,
            showSearchPill = p[PILL] ?: d.showSearchPill,
            showDock = p[DOCK_ON] ?: d.showDock,
            dockCount = (p[DOCK_N] ?: d.dockCount).coerceIn(3, 5),
            themedIcons = p[THEMED] ?: d.themedIcons,
            drawerColumns = (p[DRAWER_COLS] ?: d.drawerColumns).coerceIn(3, 6),
            doubleTap = p[DOUBLE_TAP]?.let { runCatching { DoubleTapAction.valueOf(it) }.getOrNull() } ?: d.doubleTap,
            homeLayout = p[LAYOUT] ?: d.homeLayout,
            dock = p[DOCK] ?: d.dock,
        )
    }

    suspend fun setTheme(c: Context, v: ThemeMode) = c.store.edit { it[THEME] = v.name }
    suspend fun setColumns(c: Context, v: Int) = c.store.edit { it[COLUMNS] = v }
    suspend fun setRows(c: Context, v: Int) = c.store.edit { it[ROWS] = v }
    suspend fun setIconSize(c: Context, v: Int) = c.store.edit { it[ICON] = v }
    suspend fun setLabels(c: Context, v: Boolean) = c.store.edit { it[LABELS] = v }
    suspend fun setGlance(c: Context, v: Boolean) = c.store.edit { it[GLANCE] = v }
    suspend fun setNextEvent(c: Context, v: Boolean) = c.store.edit { it[EVENT] = v }
    suspend fun setPill(c: Context, v: Boolean) = c.store.edit { it[PILL] = v }
    suspend fun setDockVisible(c: Context, v: Boolean) = c.store.edit { it[DOCK_ON] = v }
    suspend fun setDockCount(c: Context, v: Int) = c.store.edit { it[DOCK_N] = v }
    suspend fun setThemedIcons(c: Context, v: Boolean) = c.store.edit { it[THEMED] = v }
    suspend fun setDrawerColumns(c: Context, v: Int) = c.store.edit { it[DRAWER_COLS] = v }
    suspend fun setDoubleTap(c: Context, v: DoubleTapAction) = c.store.edit { it[DOUBLE_TAP] = v.name }
    suspend fun setHomeLayout(c: Context, v: String) = c.store.edit { it[LAYOUT] = v }
    suspend fun setDock(c: Context, v: String) = c.store.edit { it[DOCK] = v }
}
