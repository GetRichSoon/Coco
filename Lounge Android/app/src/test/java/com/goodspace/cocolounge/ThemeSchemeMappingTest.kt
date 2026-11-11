package com.goodspace.cocolounge

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The contract roles become the Material colour scheme the screens read: primary = call to action, primaryContainer = selected, tertiary = highlight. */
class ThemeSchemeMappingTest {
    private val c = ThemeFiles.contract

    @Test fun everyThemeModeAndScopeBuildsAColourSchemeFromItsRoles() {
        for (id in c.ids) for (dark in listOf(false, true)) {
            val s = c.cocoScheme(id, dark)
            assertEquals(id, s.themeId); assertEquals(dark, s.dark)
            listOf(s.pageRoles to s.page, s.panelRoles to s.panel).forEach { (r, cs) ->
                assertEquals("$id cta", r.cta, cs.primary); assertEquals(r.onCta, cs.onPrimary)
                assertEquals("$id selected", r.selected, cs.primaryContainer); assertEquals(r.onSelected, cs.onPrimaryContainer)
                assertEquals("$id highlight", r.highlight, cs.tertiary); assertEquals(r.onHighlight, cs.onTertiary)
                assertEquals(r["background"], cs.background); assertEquals(r["surface"], cs.surface); assertEquals(r["onSurface"], cs.onSurface)
                assertEquals(r["error"], cs.error); assertEquals(r["errorContainer"], cs.errorContainer)
                assertEquals(r["outline"], cs.outline); assertEquals(r["outlineVariant"], cs.outlineVariant)
                assertEquals(r["surfaceContainerHigh"], cs.surfaceContainerHigh); assertEquals(r["inverseSurface"], cs.inverseSurface)
                // the extras Material has no slot for are still there for the screens
                assertTrue(listOf(r.link, r.success, r.warning, r.cardSurface, r.fieldSurface, r.fieldSurface2, r.ctaEdge, r.chart1, r.chart2, r.chart3).size == 10)
            }
        }
    }

    @Test fun signatureLightIsALavenderPageWithBlackPanels() {
        val s = c.cocoScheme("signature", false)
        assertEquals(Color(0xFFF0EAF7), s.page.background); assertEquals(Color(0xFF151313), s.panel.surface)
        assertEquals(Color(0xFF151313), s.panelRoles.cardSurface); assertEquals(Color(0xFFFFE52E), s.panel.primary); assertEquals(Color(0xFFFF39A8), s.panel.primaryContainer)
        assertEquals(Color(0xFF24152E), c.cocoScheme("signature", true).page.background)
    }

    @Test fun anUnknownThemeFallsBackToTheFirst() {
        assertEquals("signature", c.cocoScheme("nope", false).themeId)
    }
}
