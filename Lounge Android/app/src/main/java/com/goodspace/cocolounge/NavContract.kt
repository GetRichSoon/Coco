package com.goodspace.cocolounge

import org.json.JSONArray
import org.json.JSONObject

/**
 * The one navigation for desktop, phone and Android (Lounge/contract/nav-contract.json). The file is packed into this
 * app's assets at build time (app/build.gradle.kts sourceSets), so a label, a section or a House changes in one place.
 */
data class NavPage(val id: String, val label: String, val icon: String)
data class NavSection(val id: String, val label: String, val icon: String, val pages: List<NavPage>)
data class HouseDef(val id: String, val name: String, val domain: String, val label: String, val icon: String, val color: Long,
                    val metrics: List<String>, val platforms: List<String>)

data class NavContract(
    val sections: List<NavSection>, val global: List<NavPage>, val phoneBottom: List<String>,
    val houses: List<HouseDef>, val houseTabs: List<Pair<String, String>>, val legacy: Map<String, String>,
) {
    fun section(id: String) = sections.firstOrNull { it.id == id }
    fun house(id: String) = houses.firstOrNull { it.id == id }
    fun globalLabel(id: String) = global.firstOrNull { it.id == id }?.label ?: id

    /** Where an old page id lands now: section (or "global") and page. Null for an id the contract does not know.
     *  A value may carry a note after the route ("global/remote (also system/remote)"); only the route counts. */
    fun resolve(legacyId: String): Pair<String, String>? =
        legacy[legacyId]?.trim()?.substringBefore(' ')?.split('/')?.takeIf { it.size == 2 && it.all(String::isNotBlank) }?.let { it[0] to it[1] }

    /** True when the Android build has a destination for this old page id: a page it draws inside a section it shows,
     *  a global (Ask COCO, Remote Control), or the House workspace. */
    fun reachable(legacyId: String): Boolean {
        val (sec, page) = resolve(legacyId) ?: return false
        if (sec == "global") return page in ANDROID_GLOBALS
        if (sec == "houses" && page == HOUSE_WORKSPACE) return houses.isNotEmpty()   // Houses.kt HouseWorkspace, opened from a House card
        return section(sec)?.pages?.any { it.id == page } == true && page in ANDROID_PAGES
    }

    companion object {
        /** Every page id Pages.kt draws (see page()). A contract page missing here is unreachable, and the test says so. */
        val ANDROID_PAGES = setOf("themes", "home", "houses", "company", "structure", "teams", "club", "tasks", "board", "notes", "approvals", "runs", "automation", "workflows",
            "hierarchy", "brain", "agents", "insights", "ai", "connections", "control", "system", "cloud", "devices", "remote", "rules", "settings")
        val ANDROID_GLOBALS = setOf("chat", "remote")
        const val HOUSE_WORKSPACE = "house"

        private fun JSONArray.objs() = (0 until length()).map { getJSONObject(it) }
        private fun JSONArray.strs() = (0 until length()).map { getString(it) }
        private fun page(o: JSONObject) = NavPage(o.getString("id"), o.getString("label"), o.optString("icon"))

        fun parse(text: String): NavContract = parseRaw(text)

        private fun parseRaw(text: String): NavContract {
            val j = JSONObject(text)
            val legacy = j.getJSONObject("legacy_pages").let { o -> o.keys().asSequence().associateWith { o.getString(it) } }
            return NavContract(
                sections = j.getJSONArray("sections").objs().map { s -> NavSection(s.getString("id"), s.getString("label"), s.optString("icon"), s.getJSONArray("pages").objs().map(::page)) },
                global = j.getJSONArray("global").objs().map(::page),
                phoneBottom = j.getJSONArray("phone_bottom").strs(),
                houses = j.getJSONArray("houses").objs().map { h ->
                    HouseDef(h.getString("id"), h.getString("name"), h.optString("domain"), h.optString("label", h.getString("name")), h.optString("icon"),
                        0xFF000000L or h.optString("color", "#4B57C4").removePrefix("#").toLong(16),
                        h.optJSONArray("metrics")?.strs().orEmpty(), h.optJSONArray("platforms")?.strs().orEmpty())
                },
                houseTabs = j.getJSONArray("house_tabs").let { a -> (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getString(0) to p.getString(1) } } },
                legacy = legacy,
            )
        }

        fun load(ctx: android.content.Context): NavContract = parse(ctx.assets.open("nav-contract.json").bufferedReader().use { it.readText() })
    }
}
