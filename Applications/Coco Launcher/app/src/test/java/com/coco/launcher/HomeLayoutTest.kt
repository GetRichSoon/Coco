package com.coco.launcher

import com.coco.launcher.home.HomeItem
import com.coco.launcher.home.HomeLayout
import com.coco.launcher.home.ItemKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeLayoutTest {

    private fun app(key: String, x: Int, y: Int) = HomeItem(ItemKind.App, key, x, y)
    private fun widget(key: String, x: Int, y: Int, sx: Int, sy: Int) =
        HomeItem(ItemKind.Widget, key, x, y, sx, sy)

    @Test
    fun occupiedCellRejectsASecondItem() {
        val layout = HomeLayout(listOf(app("a", 1, 1)))
        assertFalse(layout.canPlace(5, 5, app("b", 1, 1)))
        assertTrue(layout.canPlace(5, 5, app("b", 2, 1)))
    }

    @Test
    fun itemsCannotLeaveTheGrid() {
        val layout = HomeLayout()
        assertFalse(layout.canPlace(5, 5, app("a", 5, 0)))
        assertFalse(layout.canPlace(5, 5, app("a", 0, -1)))
        assertFalse(layout.canPlace(5, 5, widget("w", 3, 0, 4, 1)))
        assertTrue(layout.canPlace(5, 5, widget("w", 1, 0, 4, 1)))
    }

    @Test
    fun movingAnItemIgnoresItsOwnOldFootprint() {
        val layout = HomeLayout(listOf(widget("w", 0, 0, 2, 2)))
        assertTrue(layout.canPlace(5, 5, widget("w", 1, 1, 2, 2)))
        assertNotNull(layout.place(5, 5, widget("w", 1, 1, 2, 2)))
        assertEquals(1, layout.place(5, 5, widget("w", 1, 1, 2, 2))!!.items.size)
    }

    @Test
    fun firstFreeScansInReadingOrder() {
        val layout = HomeLayout(listOf(app("a", 0, 0), app("b", 1, 0)))
        assertEquals(2 to 0, layout.firstFree(5, 5))
        assertEquals(0 to 1, layout.firstFree(5, 5, spanX = 2, spanY = 1))
        assertNull(HomeLayout(listOf(widget("w", 0, 0, 5, 5))).firstFree(5, 5))
    }

    @Test
    fun reflowKeepsWhatFitsAndRelocatesTheRest() {
        val layout = HomeLayout(listOf(app("a", 0, 0), app("b", 4, 4), widget("w", 0, 2, 4, 1)))
        val small = layout.reflow(3, 3)
        assertTrue(small.items.all { it.x + it.spanX <= 3 && it.y + it.spanY <= 3 })
        // Nothing overlaps after a reflow, whatever the old positions were.
        small.items.forEachIndexed { i, a ->
            small.items.drop(i + 1).forEach { b -> assertFalse(a.overlaps(b)) }
        }
        assertEquals(3, small.items.size)
    }

    @Test
    fun reflowDropsOnlyWhatCannotFitAnywhere() {
        val full = HomeLayout((0 until 9).map { app("a$it", it % 3, it / 3) } + app("extra", 0, 4))
        val reflowed = full.reflow(3, 3)
        assertEquals(9, reflowed.items.size)
        assertFalse(reflowed.items.any { it.key == "extra" })
    }

    @Test
    fun jsonRoundTripSurvives() {
        val layout = HomeLayout(listOf(app("com.x/.A", 2, 3), widget("41", 0, 0, 4, 2)))
        val back = HomeLayout.fromJson(layout.toJson())
        assertEquals(layout.items.toSet(), back.items.toSet())
    }

    @Test
    fun brokenStoredLayoutIsIgnoredInsteadOfCrashing() {
        assertEquals(0, HomeLayout.fromJson("not json").items.size)
        assertEquals(0, HomeLayout.fromJson("").items.size)
        assertEquals(0, HomeLayout.fromJson(null).items.size)
        // An entry with an unknown kind is skipped, the valid one is kept.
        val mixed = HomeLayout.fromJson("""[{"k":"Nope","id":"x"},{"k":"App","id":"ok","x":1,"y":1}]""")
        assertEquals(1, mixed.items.size)
        assertEquals("ok", mixed.items.first().key)
    }
}
