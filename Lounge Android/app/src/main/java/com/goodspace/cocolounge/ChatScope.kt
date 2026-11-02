package com.goodspace.cocolounge

import org.json.JSONObject

/**
 * COCO › Team › Sub-team › Category › Channel › Agent - the same key Nova uses to name a chat thread
 * (`team|subteam|category|channel|agent`, empty levels kept, trailing ones trimmed, `coco` = the whole
 * company). The tree comes from Nova's /api/chat/tree, so the phone only ever offers parts the company
 * really has. Pure on purpose: no Android in here, so the rules match the cloud's and can be tested.
 */
object ChatScope {
    val LEVELS = listOf("team", "subteam", "category", "channel", "agent")
    val LABEL = mapOf("team" to "Team", "subteam" to "Sub-team", "category" to "Category", "channel" to "Channel", "agent" to "Agent")

    private fun JSONObject.s(k: String) = optString(k).let { if (it == "null") "" else it }

    /** The key's levels, resolved against the tree. An id the tree does not have stops the walk. */
    fun path(key: String, tree: List<JSONObject>): List<JSONObject> {
        if (key == "coco") return emptyList()
        val out = mutableListOf<JSONObject>()
        for ((i, id) in key.split("|").withIndex()) {
            if (i >= LEVELS.size) break
            if (id.isEmpty()) continue
            out += tree.firstOrNull { it.s("kind") == LEVELS[i] && it.s("id") == id } ?: break
        }
        return out
    }

    fun keyOf(nodes: List<JSONObject>): String {
        val slots = Array(LEVELS.size) { "" }
        for (n in nodes) LEVELS.indexOf(n.s("kind")).takeIf { it >= 0 }?.let { slots[it] = n.s("id") }
        return slots.joinToString("|").trimEnd('|').ifEmpty { "coco" }
    }

    /** One level down: the parts under the deepest part, and the agents who work in its team. */
    fun next(path: List<JSONObject>, tree: List<JSONObject>): List<JSONObject> {
        if (path.any { it.s("kind") == "agent" }) return emptyList()
        val at = path.lastOrNull()
        val parts = tree.filter { it.s("kind") != "agent" && (if (at == null) it.s("kind") == "team" else it.s("parent") == at.s("id")) }
        if (at == null) return parts
        val team = path.firstOrNull { it.s("kind") == "team" }?.s("id")
        val sub = path.firstOrNull { it.s("kind") == "subteam" }?.s("id")
        return parts + tree.filter { it.s("kind") == "agent" && it.s("team") == team && (sub == null || it.s("parent") == sub || it.s("parent") == team) }
    }

    /** The key for a picked node: an agent joins the current path; a part brings its parents with it. */
    fun pick(path: List<JSONObject>, n: JSONObject, tree: List<JSONObject>): String {
        if (n.s("kind") == "agent") return keyOf(path.filter { it.s("kind") != "agent" } + n)
        val chain = mutableListOf(n)
        var p = n.s("parent"); var guard = 0
        while (p.isNotEmpty() && guard++ < 8) {
            val up = tree.firstOrNull { it.s("id") == p && it.s("kind") != "agent" } ?: break
            chain += up; p = up.s("parent")
        }
        return keyOf(chain)
    }

    fun upTo(path: List<JSONObject>, index: Int): String = keyOf(path.take(index + 1))

    /** The part of the company an activity line names, longest name first; null when it names none. */
    fun named(text: String, tree: List<JSONObject>): JSONObject? {
        val low = text.lowercase()
        return tree.filter { it.s("kind") != "agent" && it.s("name").length > 3 && low.contains(it.s("name").lowercase()) }
            .maxByOrNull { it.s("name").length }
    }
}
