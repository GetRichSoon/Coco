package com.goodspace.cocolounge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The one place the theme tests read the shared contract from: the same files build.gradle.kts packs into the assets. */
object ThemeFiles {
    private val dir = File("../../Lounge/contract")
    fun file(name: String) = File(dir, name)
    fun text(name: String) = file(name).readText()
    val contract: ThemeContract by lazy { ThemeContract.parse(text("themes.json"), text("theme-schemes.json")) }
    val engine: ThemeEngine by lazy { ThemeEngine(contract) }
}

/** WCAG 2.x relative luminance and contrast ratio of two opaque ARGB colours. */
object Wcag {
    private fun channel(v: Int): Double = (v / 255.0).let { if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.4) }
    fun luminance(c: Int) = 0.2126 * channel((c shr 16) and 0xFF) + 0.7152 * channel((c shr 8) and 0xFF) + 0.0722 * channel(c and 0xFF)
    fun contrast(a: Int, b: Int): Double { val x = luminance(a); val y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
}

class ThemeContractTest {
    private val c = ThemeFiles.contract
    private fun hex(s: String) = ThemeContract.hex(s)

    @Test fun theSixThemesExist() {
        assertEquals(listOf("signature", "cobalt", "violet", "emerald", "tangerine", "orchid"), c.ids)
        assertEquals((1..6).toList(), c.themes.map { it.number })
        assertEquals("Original Signature", c.theme("signature").name)
        assertTrue(c.theme("signature").locked && c.themes.drop(1).none { it.locked })
        assertEquals("signature", c.defaults.themeId); assertEquals("system", c.defaults.appearance); assertTrue(!c.defaults.rotation.enabled)
        assertEquals("Space Grotesk", c.fontFamily)
        assertEquals(listOf("launch", "5h", "7h", "daily", "weekly", "monthly", "manual"), c.frequencies.map { it.id })
        assertEquals(5, c.frequency("5h")!!.hours); assertEquals(7, c.frequency("7h")!!.hours)
        assertEquals(listOf("sequential", "random"), c.orders.map { it.id })
    }

    @Test fun signatureKeepsItsFiveBrandColoursExactly() {
        val b = c.theme("signature").brand
        assertEquals(hex("#151313"), b.getValue("black")); assertEquals(hex("#FF39A8"), b.getValue("hotPink")); assertEquals(hex("#FFE52E"), b.getValue("brightYellow"))
        assertEquals(hex("#24152E"), b.getValue("darkBackground")); assertEquals(hex("#F0EAF7"), b.getValue("lightBackground"))
        for (dark in listOf(false, true)) {
            val panel = c.roles("signature", dark, panel = true)
            assertEquals("black card surface, dark=$dark", hex("#151313"), panel.getValue("cardSurface"))
            for (scope in listOf(false, true)) {
                val r = c.roles("signature", dark, panel = scope)
                assertEquals("hot pink accent (dark=$dark panel=$scope)", hex("#FF39A8"), r.getValue("accent"))
                assertEquals("hot pink selected (dark=$dark panel=$scope)", hex("#FF39A8"), r.getValue("selected"))
                assertEquals("yellow cta (dark=$dark panel=$scope)", hex("#FFE52E"), r.getValue("cta"))
                assertEquals("yellow highlight (dark=$dark panel=$scope)", hex("#FFE52E"), r.getValue("highlight"))
            }
        }
        assertEquals(hex("#24152E"), c.roles("signature", dark = true, panel = false).getValue("background"))
        assertEquals(hex("#F0EAF7"), c.roles("signature", dark = false, panel = false).getValue("background"))
    }

    @Test fun signatureLightHasABlackPanelOnALavenderPage() {
        val page = c.roles("signature", false, false); val panel = c.roles("signature", false, true)
        assertEquals(hex("#F0EAF7"), page.getValue("surface")); assertEquals(hex("#151313"), panel.getValue("surface"))
        assertTrue("light text on the black panel", Wcag.luminance(panel.getValue("onSurface")) > 0.5)
        assertTrue("dark text on the lavender page", Wcag.luminance(page.getValue("onSurface")) < 0.1)
    }

    @Test fun theOtherFiveThemesUseOneSchemeForPageAndPanel() {
        for (id in c.ids.drop(1)) for (dark in listOf(false, true)) assertEquals("$id dark=$dark", c.roles(id, dark, false), c.roles(id, dark, true))
    }

    @Test fun everyRoleIsPresentInEveryScope() {
        assertEquals(58, c.roleNames.size)
        for (id in c.ids) for (dark in listOf(false, true)) for (panel in listOf(false, true)) {
            val r = c.roles(id, dark, panel)
            assertEquals("$id dark=$dark panel=$panel", c.roleNames.toSet(), r.keys)
            assertNotNull(r["ctaEdge"])
        }
    }

    /** Text pairs on the surfaces they are drawn on, for every theme, mode and scope, from the contract values. WCAG AA for text = 4.5. */
    @Test fun everyTextPairPassesAA() {
        val failures = mutableListOf<String>()
        for (id in c.ids) for (dark in listOf(false, true)) for (panel in listOf(false, true)) {
            val r = c.roles(id, dark, panel)
            fun check(label: String, fg: String, bg: String) {
                val ratio = Wcag.contrast(r.getValue(fg), r.getValue(bg))
                if (ratio < 4.5) failures += "$id ${if (dark) "dark" else "light"} ${if (panel) "panel" else "page"}: $label ${"%.2f".format(ratio)}"
            }
            check("onSurface/surface", "onSurface", "surface")
            check("onSurfaceVariant/surface", "onSurfaceVariant", "surface")
            check("onCta/cta", "onCta", "cta")
            check("onSelected/selected", "onSelected", "selected")
            check("link/surface", "link", "surface")
            // the cards the screens actually draw: cards are PANELS, so their text is checked in the panel scope (on the page scope of Signature the
            // cardSurface role is the black card colour and onSurface is the dark page text, which are never drawn together)
            if (panel) {
                check("onSurface/cardSurface", "onSurface", "cardSurface")
                check("onSurfaceVariant/cardSurface", "onSurfaceVariant", "cardSurface")
                check("link/cardSurface", "link", "cardSurface")
            }
        }
        assertTrue("AA failures:\n" + failures.joinToString("\n"), failures.isEmpty())
    }

    @Test fun contractValuesAreOpaqueExceptTheTransparentCtaEdge() {
        for (id in c.ids) for (dark in listOf(false, true)) for (panel in listOf(false, true)) c.roles(id, dark, panel).forEach { (k, v) ->
            if (k != "ctaEdge") assertEquals("$id $k", 0xFF, (v ushr 24) and 0xFF)
        }
    }
}
