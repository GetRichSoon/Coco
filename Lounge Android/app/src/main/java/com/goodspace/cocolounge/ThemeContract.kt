package com.goodspace.cocolounge

import org.json.JSONArray
import org.json.JSONObject

/**
 * The six COCO themes, read from the one contract every client shares: Lounge/contract/themes.json (seeds, schedule choices,
 * defaults) and theme-schemes.json (every colour role, per theme, per mode, per scope). Nothing here generates a colour; it only
 * reads the tables. Pure: no Android imports, so the JVM tests load the very same files.
 *
 * A colour is an ARGB Int; the contract's "transparent" (the CTA edge on a panel) is 0.
 */
typealias Roles = Map<String, Int>

data class ThemeDef(
    val id: String, val number: Int, val name: String, val tagline: String, val locked: Boolean,
    val seeds: Map<String, Int>, val brand: Map<String, Int>,
)
data class FrequencyDef(val id: String, val label: String, val short: String, val kind: String, val hours: Int)
data class OrderDef(val id: String, val label: String)
data class RotationDefaults(val enabled: Boolean, val frequency: String, val order: String, val time: String, val weekday: Int, val dayOfMonth: Int)
data class ThemeDefaults(val themeId: String, val appearance: String, val locked: Boolean, val rotation: RotationDefaults)

/** `page` = the screen background and plain content; `panel` = cards, navigation, top bar, sheets, dialogs, menus. */
class ThemeScheme(val page: Roles, val panel: Roles)

class ThemeContract(
    val fontFamily: String, val roleNames: List<String>, val themes: List<ThemeDef>, val frequencies: List<FrequencyDef>,
    val orders: List<OrderDef>, val defaults: ThemeDefaults, val light: Map<String, ThemeScheme>, val dark: Map<String, ThemeScheme>,
) {
    val ids: List<String> = themes.map { it.id }
    fun theme(id: String): ThemeDef = themes.firstOrNull { it.id == id } ?: themes.first()
    fun frequency(id: String): FrequencyDef? = frequencies.firstOrNull { it.id == id }
    fun scheme(themeId: String, dark: Boolean): ThemeScheme {
        val m = if (dark) this.dark else this.light
        return m[themeId] ?: m.getValue(ids.first())   // an unknown id falls back to theme 1, like the web engine
    }
    fun roles(themeId: String, dark: Boolean, panel: Boolean): Roles = scheme(themeId, dark).let { if (panel) it.panel else it.page }

    companion object {
        private fun JSONArray.objs() = (0 until length()).map { getJSONObject(it) }
        fun hex(s: String): Int = if (s.equals("transparent", ignoreCase = true)) 0 else (0xFF000000L or s.trim().removePrefix("#").toLong(16)).toInt()
        private fun colours(o: JSONObject?): Map<String, Int> = o?.let { j -> j.keys().asSequence().associateWith { hex(j.getString(it)) } }.orEmpty()
        private fun roleMap(o: JSONObject): Roles = o.keys().asSequence().associateWith { hex(o.getString(it)) }

        fun parse(themesJson: String, schemesJson: String): ThemeContract {
            val t = JSONObject(themesJson); val s = JSONObject(schemesJson)
            val rd = t.getJSONObject("defaults").getJSONObject("rotation")
            val defaults = ThemeDefaults(t.getJSONObject("defaults").getString("themeId"), t.getJSONObject("defaults").getString("appearance"), t.getJSONObject("defaults").optBoolean("locked"),
                RotationDefaults(rd.optBoolean("enabled"), rd.getString("frequency"), rd.getString("order"), rd.getString("time"), rd.getInt("weekday"), rd.getInt("dayOfMonth")))
            val schemes = s.getJSONObject("themes")
            fun mode(m: String) = schemes.keys().asSequence().associateWith { id -> schemes.getJSONObject(id).getJSONObject(m).let { ThemeScheme(roleMap(it.getJSONObject("page")), roleMap(it.getJSONObject("panel"))) } }
            return ThemeContract(
                fontFamily = t.optJSONObject("font")?.optString("family").orEmpty(),
                roleNames = s.getJSONArray("roles").let { a -> (0 until a.length()).map { a.getString(it) } },
                themes = t.getJSONArray("themes").objs().map { o ->
                    ThemeDef(o.getString("id"), o.getInt("number"), o.getString("name"), o.optString("tagline"), o.optBoolean("locked"), colours(o.optJSONObject("seeds")), colours(o.optJSONObject("brand")))
                },
                frequencies = t.getJSONArray("frequencies").objs().map { FrequencyDef(it.getString("id"), it.getString("label"), it.optString("short"), it.getString("kind"), it.optInt("hours")) },
                orders = t.getJSONArray("orders").objs().map { OrderDef(it.getString("id"), it.getString("label")) },
                defaults = defaults, light = mode("light"), dark = mode("dark"),
            )
        }
    }
}
