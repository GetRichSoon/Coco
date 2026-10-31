package com.coco.launcher.home

import org.json.JSONArray
import org.json.JSONObject

enum class ItemKind { App, Widget }

/**
 * One occupant of the home grid. [key] is a flattened component for an app and an AppWidget id for
 * a widget. Position and span are in grid cells, never pixels, so the same layout survives a
 * rotation, a font-size change and a different device.
 */
data class HomeItem(
    val kind: ItemKind,
    val key: String,
    val x: Int,
    val y: Int,
    val spanX: Int = 1,
    val spanY: Int = 1,
) {
    fun covers(cx: Int, cy: Int): Boolean = cx >= x && cx < x + spanX && cy >= y && cy < y + spanY

    fun overlaps(other: HomeItem): Boolean =
        x < other.x + other.spanX && other.x < x + spanX &&
            y < other.y + other.spanY && other.y < y + spanY
}

/** The placed contents of the single home page. Pure data: no Android types, so it is unit tested. */
data class HomeLayout(val items: List<HomeItem> = emptyList()) {

    fun itemAt(cx: Int, cy: Int): HomeItem? = items.firstOrNull { it.covers(cx, cy) }

    /** True when [candidate] is inside the grid and clear of everything except [ignoreKey]. */
    fun canPlace(cols: Int, rows: Int, candidate: HomeItem, ignoreKey: String? = null): Boolean {
        if (candidate.x < 0 || candidate.y < 0) return false
        if (candidate.spanX < 1 || candidate.spanY < 1) return false
        if (candidate.x + candidate.spanX > cols) return false
        if (candidate.y + candidate.spanY > rows) return false
        return items.none { it.key != ignoreKey && it.key != candidate.key && it.overlaps(candidate) }
    }

    fun place(cols: Int, rows: Int, item: HomeItem): HomeLayout? {
        if (!canPlace(cols, rows, item, ignoreKey = item.key)) return null
        return HomeLayout(items.filterNot { it.key == item.key } + item)
    }

    fun remove(key: String): HomeLayout = HomeLayout(items.filterNot { it.key == key })

    /** Top-left-most free block of the requested size, scanning in reading order. */
    fun firstFree(cols: Int, rows: Int, spanX: Int = 1, spanY: Int = 1): Pair<Int, Int>? {
        for (y in 0..rows - spanY) {
            for (x in 0..cols - spanX) {
                val probe = HomeItem(ItemKind.App, "?probe", x, y, spanX, spanY)
                if (items.none { it.overlaps(probe) }) return x to y
            }
        }
        return null
    }

    /**
     * Fit the layout to a new grid size. Items that still fit stay where they are, items pushed
     * outside are moved to the first free cell, and anything with nowhere left to go is dropped -
     * which is the only honest option when a 5x5 layout is asked to become 3x3.
     */
    fun reflow(cols: Int, rows: Int): HomeLayout {
        var kept = HomeLayout(emptyList())
        // Bigger items first: a 4x2 widget has fewer valid homes than a single icon.
        val ordered = items.sortedWith(compareByDescending<HomeItem> { it.spanX * it.spanY }.thenBy { it.y }.thenBy { it.x })
        for (item in ordered) {
            val spanX = item.spanX.coerceAtMost(cols)
            val spanY = item.spanY.coerceAtMost(rows)
            val asIs = item.copy(spanX = spanX, spanY = spanY)
            kept = if (kept.canPlace(cols, rows, asIs)) {
                HomeLayout(kept.items + asIs)
            } else {
                val free = kept.firstFree(cols, rows, spanX, spanY) ?: continue
                HomeLayout(kept.items + asIs.copy(x = free.first, y = free.second))
            }
        }
        return HomeLayout(kept.items.sortedWith(compareBy({ it.y }, { it.x })))
    }

    fun toJson(): String {
        val array = JSONArray()
        items.forEach { item ->
            array.put(
                JSONObject()
                    .put("k", item.kind.name)
                    .put("id", item.key)
                    .put("x", item.x)
                    .put("y", item.y)
                    .put("sx", item.spanX)
                    .put("sy", item.spanY),
            )
        }
        return array.toString()
    }

    companion object {
        fun fromJson(raw: String?): HomeLayout {
            if (raw.isNullOrBlank()) return HomeLayout()
            return runCatching {
                val array = JSONArray(raw)
                val items = ArrayList<HomeItem>(array.length())
                for (i in 0 until array.length()) {
                    val o = array.optJSONObject(i) ?: continue
                    val kind = runCatching { ItemKind.valueOf(o.optString("k")) }.getOrNull() ?: continue
                    val key = o.optString("id").takeIf { it.isNotEmpty() } ?: continue
                    items += HomeItem(
                        kind = kind,
                        key = key,
                        x = o.optInt("x"),
                        y = o.optInt("y"),
                        spanX = o.optInt("sx", 1).coerceAtLeast(1),
                        spanY = o.optInt("sy", 1).coerceAtLeast(1),
                    )
                }
                HomeLayout(items)
            }.getOrElse { HomeLayout() }
        }
    }
}
