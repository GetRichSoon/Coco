package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate

/** The contract Android packs into its assets is the one the web Lounge uses, and every old page still has a home. */
class NavContractTest {
    // unit tests run in the app module; this is the same file build.gradle.kts packs into the assets
    private val nav = NavContract.parse(File("../../Lounge/contract/nav-contract.json").readText())

    /** The 23 pages the web Lounge had before the redesign: each must still open somewhere on Android. */
    private val legacy23 = listOf("home", "control", "board", "notes", "remote", "approvals", "company", "teams", "agents", "runs", "ai", "brain",
        "workflows", "system", "chat", "connections", "club", "rules", "devices", "settings", "structure", "automation", "cloud")

    @Test fun parsesTheContract() {
        assertEquals(listOf("home", "houses", "work", "more"), nav.phoneBottom)
        assertEquals(listOf("gigi", "lulu", "poppy", "mochi", "fifi", "zaza", "tilly"), nav.houses.map { it.id })
        assertEquals(20, nav.houseTabs.size)
        assertEquals(setOf("chat", "remote"), nav.global.map { it.id }.toSet())
        assertTrue(nav.sections.isNotEmpty() && nav.sections.all { it.pages.isNotEmpty() })
        nav.houses.forEach { assertEquals("${it.id} colour is opaque", 0xFF000000, it.color and 0xFF000000); assertTrue(it.metrics.isNotEmpty()) }
    }

    @Test fun bottomBarMatchesTheContract() {
        assertEquals(nav.phoneBottom, Tab.entries.map { it.id })
        nav.phoneBottom.filter { it != "more" }.forEach { assertTrue("$it is a section", nav.section(it) != null) }
    }

    @Test fun everyLegacyPageIsReachable() {
        assertEquals(23, legacy23.size)
        legacy23.forEach { assertTrue("$it is missing from legacy_pages", it in nav.legacy) }
        nav.legacy.keys.forEach { assertTrue("$it has no Android destination", nav.reachable(it)) }
    }

    @Test fun everyContractPageIsDrawn() {
        nav.sections.flatMap { it.pages }.forEach { assertTrue("${it.id} is not drawn on Android", it.id in NavContract.ANDROID_PAGES) }
    }

    @Test fun theAppearanceScreenIsInTheSystemSection() {
        assertTrue(nav.section("system")!!.pages.any { it.id == "themes" })
        assertEquals("system" to "themes", nav.resolve("themes")); assertTrue(nav.reachable("themes"))
    }

    @Test fun routesWithANoteStillResolve() {
        val n = NavContract.parse("""{"sections":[{"id":"system","label":"System","icon":"tune","pages":[{"id":"remote","label":"Remote","icon":"x"}]}],
            "global":[{"id":"remote","label":"Remote","icon":"x"}],"phone_bottom":["home"],"houses":[{"id":"gigi","name":"Gigi","color":"#4F5BD5"}],
            "house_tabs":[["overview","Overview"]],"legacy_pages":{"remote":"global/remote (also system/remote)","house":"houses/house (workspace)","x":"nowhere"}}""")
        assertEquals("global" to "remote", n.resolve("remote"))
        assertTrue(n.reachable("remote")); assertTrue(n.reachable("house"))
        assertFalse(n.reachable("x")); assertFalse(n.reachable("missing"))
        assertEquals(0xFF4F5BD5, n.house("gigi")!!.color)
    }
}

class FactsTest {
    private fun o(vararg kv: Pair<String, Any?>) = JSONObject().apply { kv.forEach { (k, v) -> put(k, v ?: JSONObject.NULL) } }
    private val today = LocalDate.parse("2026-11-11")

    @Test fun houseFilterTakesTheHouseAndWhatIsUnderIt() {
        assertTrue(Facts.inHouse("gigi", "gigi")); assertTrue(Facts.inHouse("gigi", "gigi.bunny.cat_3"))
        assertFalse(Facts.inHouse("gigi", "gigix")); assertFalse(Facts.inHouse("gigi", "lulu.gigi")); assertFalse(Facts.inHouse("gigi", null)); assertFalse(Facts.inHouse("gigi", ""))
        val rows = listOf(o("id" to 1, "unit_id" to "gigi.bunny"), o("id" to 2, "unit_id" to "lulu"), o("id" to 3, "unit_id" to null, "house_id" to "gigi"), o("id" to 4, "unit_id" to "null"))
        assertEquals(listOf(1, 3), Facts.forHouse("gigi", rows).map { it.getInt("id") })
    }

    @Test fun houseMetricsIncludeItsProducts() {
        val products = listOf(o("id" to "p1", "unit_id" to "poppy.practical"), o("id" to "p2", "unit_id" to "lulu"))
        val m = listOf(o("n" to 1, "unit_id" to "poppy"), o("n" to 2, "product_id" to "p1"), o("n" to 3, "product_id" to "p2"), o("n" to 4, "unit_id" to "poppyx"))
        assertEquals(listOf(1, 2), Facts.metricsOf("poppy", m, products).map { it.getInt("n") })
    }

    @Test fun missingRevenueIsUnavailableNeverZero() {
        assertEquals(Facts.UNAVAILABLE, Facts.revenue(emptyList(), today).state)
        assertEquals("Unavailable", Facts.revenue(emptyList(), today).text)
        assertEquals(Facts.UNAVAILABLE, Facts.revenue(listOf(o("metric" to "views", "value" to 900, "period" to "2026-11-10")), today).state)
        assertEquals(Facts.UNAVAILABLE, Facts.revenue(listOf(o("metric" to "revenue", "value" to null, "period" to "2026-11-10")), today).state)
        assertEquals(Facts.UNAVAILABLE, Facts.revenue(listOf(o("metric" to "revenue", "value" to "", "period" to "2026-11-10")), today).state)
        // only "revenue" itself counts, as in the web's ui-kit KINDS
        assertEquals(Facts.UNAVAILABLE, Facts.revenue(listOf(o("metric" to "gross_revenue", "value" to 5, "period" to "2026-11-10")), today).state)
    }

    @Test fun oldRevenueIsNoRecordsNotZero() {
        val h = Facts.revenue(listOf(o("metric" to "revenue", "value" to 40, "unit" to "USD", "period" to "2026-09-01", "source" to "gumroad")), today)
        assertEquals(Facts.NONE_IN_PERIOD, h.state)
        assertTrue(h.text.startsWith("No records"))
        assertEquals("2026-09-01", h.latest)
    }

    @Test fun revenueNeverAddsCurrenciesOrEstimates() {
        val rows = listOf(
            o("unit_id" to "poppy", "metric" to "revenue", "value" to 10, "unit" to "USD", "period" to "2026-11-01", "source" to "gumroad"),
            o("unit_id" to "poppy", "metric" to "Revenue", "value" to 2.5, "unit" to "USD", "period" to "2026-11-10", "source" to "gumroad"),
            o("unit_id" to "tilly", "metric" to "revenue", "value" to 0, "unit" to "USD", "period" to "2026-11-10", "source" to "shopify"),
            o("unit_id" to "lulu", "metric" to "revenue", "value" to 500, "unit" to "INR", "period" to "2026-11-09", "source" to "play"),
            o("unit_id" to "fifi", "metric" to "revenue", "value" to 99, "unit" to "USD", "period" to "2026-11-09", "source" to "forecast model"),
            o("unit_id" to "poppy", "metric" to "revenue", "value" to 7, "unit" to "USD", "period" to "2026-10-14", "source" to "gumroad"),   // before the 28 days
        )
        val h = Facts.revenue(rows, today)
        // a recorded 0 is a real 0; INR is never added to USD; the forecast stays apart from the actual money
        assertEquals("mixed", h.state)
        assertEquals("500 INR · 12.50 USD · 99 USD estimated", h.text)
        assertEquals("2026-11-10", h.latest)
    }

    @Test fun failedJobsCountOnlyTheLastThreeDays() {
        val now = java.time.Instant.parse("2026-11-11T12:00:00Z")
        val jobs = listOf(o("n" to 1, "status" to "failed", "created_at" to "2026-11-10T08:00:00+00:00"), o("n" to 2, "status" to "failed", "created_at" to "2026-11-01T08:00:00Z"),
            o("n" to 3, "status" to "failed", "created_at" to "2026-11-01T08:00:00Z", "updated_at" to "2026-11-11T09:00:00.5Z"), o("n" to 4, "status" to "running", "created_at" to "2026-11-11T08:00:00Z"),
            o("n" to 5, "status" to "failed", "created_at" to null))
        assertEquals(listOf(1, 3), Facts.recentFailed(jobs, now).map { it.getInt("n") })
    }

    @Test fun missingTableIsToldApartFromANetworkError() {
        assertTrue(Facts.isMissing(404, "no such table org_metrics"))
        assertTrue(Facts.isMissing(400, "relation \"public.org_metrics\" does not exist"))
        assertFalse(Facts.isMissing(0, "timeout"))
        assertFalse(Facts.isMissing(500, "Coco Cloud error 500"))
    }
}
