package com.goodspace.cocolounge

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

internal class MemKv(val m: MutableMap<String, String> = mutableMapOf()) : ThemeKv {
    override fun get(key: String) = m[key]
    override fun put(key: String, value: String) { m[key] = value }
}

/** The cloud row, in memory: remembers what was asked of it, and can be told to fail or to lose a race. */
internal class FakeCloud : ThemeCloud {
    var row: ThemeRow? = null
    var failReads = false
    var failWrites = false
    var raceOnce: (() -> Unit)? = null          // runs just before the next claim, to simulate another device writing first
    val calls = mutableListOf<String>()
    var tick = 0

    private fun stamp() = "stamp-${++tick}"
    override suspend fun read(id: String): ThemeRow? { calls += "read"; if (failReads) throw java.io.IOException("offline"); return row }
    override suspend fun claim(id: String, previousUpdatedAt: String?, value: JSONObject, by: String, at: String): Boolean {
        calls += "claim:$previousUpdatedAt"
        if (failWrites) throw java.io.IOException("offline")
        raceOnce?.let { raceOnce = null; it() }
        if (row?.updatedAt != previousUpdatedAt) return false          // the compare-and-set
        row = ThemeRow(value, at); return true
    }
    override suspend fun create(id: String, value: JSONObject, by: String, at: String): Boolean {
        calls += "create:$id:$by"
        if (failWrites) throw java.io.IOException("offline")
        if (row != null) return false
        row = ThemeRow(value, at); return true
    }
}

class ThemeStoreTest {
    private val e = ThemeFiles.engine
    private var now = 1_794_398_400_000L   // 2026-11-11T12:00:00Z
    private fun store(kv: ThemeKv = MemKv(), cloud: FakeCloud? = null, owner: String? = "Founder@Example.com") =
        ThemeStore(e, kv, { now }).also { it.device = "phone-1"; it.owner = owner; it.cloud = cloud }
    private fun doc(theme: String, at: Long, reason: String = "manual") = e.defaultPrefs().copy(themeId = theme, reason = reason, lastSwitchedAt = ThemeEngine.iso(at), seq = 1, updatedAt = ThemeEngine.iso(at), updatedBy = "pc-1")

    @Test fun theDocumentSurvivesARestart() {
        val kv = MemKv()
        val a = store(kv)
        a.apply("violet"); now += 1000; a.setAppearance("dark"); now += 1000
        a.setRotation(JSONObject().put("enabled", true).put("frequency", "weekly").put("weekday", 5).put("time", "18:45").put("tz", "Europe/London")); now += 1000
        a.setLocked(true)
        val b = store(kv)
        assertEquals(a.prefs, b.prefs)
        assertEquals("violet", b.prefs.themeId); assertEquals("dark", b.prefs.appearance); assertTrue(b.prefs.locked); assertEquals("Europe/London", b.prefs.rotation.tz)
        assertTrue(kv.m.containsKey("coco_theme_prefs"))
        assertEquals(a.prefs.toJson().toString().length, JSONObject(kv.m.getValue("coco_theme_prefs")).toString().length)
    }

    @Test fun theOldLightDarkChoiceIsKeptAndABrokenCopyFallsBackToTheDefault() {
        assertEquals("dark", store(MemKv(mutableMapOf("theme" to "dark"))).prefs.appearance)
        assertEquals("light", store(MemKv(mutableMapOf("theme" to "light"))).prefs.appearance)
        assertEquals("system", store(MemKv(mutableMapOf("theme" to "wallpaper"))).prefs.appearance)
        assertEquals(e.defaultPrefs(), store(MemKv(mutableMapOf("coco_theme_prefs" to "{not json"))).prefs)
        assertEquals("dark", store(MemKv(mutableMapOf("coco_theme_prefs" to """{"appearance":"dark"}""", "theme" to "light"))).prefs.appearance)   // the new document wins
    }

    @Test fun aUserActionCreatesTheRowTheFirstTime() = runBlocking {
        val cloud = FakeCloud(); val s = store(cloud = cloud)
        s.apply("cobalt"); assertTrue(s.dirty)
        s.sync()
        assertEquals(listOf("read", "create:ui_theme.founder@example.com:phone-1"), cloud.calls)   // the id is the lower-cased e-mail; updated_by is this device
        assertEquals(s.prefs.toJson().toString(), cloud.row!!.value.toString()); assertEquals(s.prefs.updatedAt, cloud.row!!.updatedAt)
        assertFalse(s.dirty)
    }

    @Test fun theWriteIsACompareAndSetOnThePreviousUpdatedAt() = runBlocking {
        val cloud = FakeCloud().also { it.row = ThemeRow(doc("emerald", now - 3_600_000).toJson(), "2026-11-11T11:00:00.000Z") }
        val s = store(cloud = cloud); s.adoptRemote(cloud.row!!.value)
        assertEquals("emerald", s.prefs.themeId)
        now += 1000; s.apply("orchid"); s.sync()
        assertEquals(listOf("read", "claim:2026-11-11T11:00:00.000Z"), cloud.calls)
        assertEquals("orchid", e.normalize(cloud.row!!.value).themeId); assertEquals(s.prefs.updatedAt, cloud.row!!.updatedAt); assertFalse(s.dirty)
    }

    @Test fun ifSomeoneWroteFirstTheirNewerDocumentIsAdoptedAndOurChangeIsDropped() = runBlocking {
        val cloud = FakeCloud().also { it.row = ThemeRow(doc("emerald", now - 3_600_000).toJson(), "2026-11-11T11:00:00.000Z") }
        val s = store(cloud = cloud)
        s.apply("orchid")                                                        // at `now`
        cloud.raceOnce = { cloud.row = ThemeRow(doc("violet", now + 5_000).toJson(), "other-stamp") }   // another device wrote, LATER than our action
        s.sync()
        assertEquals("violet", s.prefs.themeId); assertEquals("violet", e.normalize(cloud.row!!.value).themeId)
        assertEquals(listOf("read", "claim:2026-11-11T11:00:00.000Z", "read"), cloud.calls)   // lost, read again, adopted, nothing more to send
    }

    @Test fun ifSomeoneWroteFirstButOursIsNewerWeTryOnceMore() = runBlocking {
        val cloud = FakeCloud().also { it.row = ThemeRow(doc("emerald", now - 3_600_000).toJson(), "2026-11-11T11:00:00.000Z") }
        val s = store(cloud = cloud)
        s.apply("orchid")
        cloud.raceOnce = { cloud.row = ThemeRow(doc("violet", now - 1_000).toJson(), "other-stamp") }   // written by another device EARLIER than our action
        s.sync()
        assertEquals("orchid", s.prefs.themeId); assertEquals("orchid", e.normalize(cloud.row!!.value).themeId)
        assertEquals(listOf("read", "claim:2026-11-11T11:00:00.000Z", "read", "claim:other-stamp"), cloud.calls)
    }

    @Test fun aRowSomeoneCreatedFirstIsReadAgainInsteadOfOverwritten() = runBlocking {
        val cloud = FakeCloud(); val s = store(cloud = cloud)
        s.apply("cobalt")
        val real = cloud   // between our read (no row) and our create, another device creates it with a LATER document
        val racing = object : ThemeCloud by real {
            var first = true
            override suspend fun create(id: String, value: JSONObject, by: String, at: String): Boolean {
                if (first) { first = false; real.row = ThemeRow(doc("emerald", now + 10_000).toJson(), "theirs"); return false }
                return real.create(id, value, by, at)
            }
        }
        s.cloud = racing; s.sync()
        assertEquals("emerald", s.prefs.themeId)
    }

    @Test fun aLaunchSwitchStaysOnThisDevice() = runBlocking {
        val cloud = FakeCloud(); val s = store(cloud = cloud)
        s.setRotation(JSONObject().put("enabled", true).put("frequency", "launch")); s.sync()
        cloud.calls.clear(); cloud.row = null
        now += 60_000
        val r = s.evaluate(launch = true, rand = 0.2)
        assertTrue(r.changed); assertEquals("launch", s.prefs.reason); assertFalse(s.dirty)
        s.sync()
        assertEquals(listOf("read"), cloud.calls)       // looked, wrote nothing
        assertNull(cloud.row)
    }

    @Test fun aScheduledRotationIsWrittenToTheCloud() = runBlocking {
        val cloud = FakeCloud(); val s = store(cloud = cloud)
        s.setRotation(JSONObject().put("enabled", true).put("frequency", "5h").put("seed", "s")); s.sync()
        val first = s.prefs.themeId
        now += 5 * ThemeEngine.HOUR + 1000
        assertTrue(s.evaluate(launch = false, rand = 0.0).changed)
        assertEquals("schedule", s.prefs.reason); assertTrue(s.dirty)
        s.sync()
        assertNotEquals(first, e.normalize(cloud.row!!.value).themeId); assertEquals(s.prefs.updatedAt, cloud.row!!.updatedAt)
    }

    @Test fun aNewerRemoteDocumentIsAdoptedAtOnceAndAnOlderOneIsIgnored() {
        val s = store(); var seen: Pair<String, ThemeOrigin>? = null
        s.onChange = { p, o -> seen = p.themeId to o }
        s.apply("cobalt"); assertEquals("cobalt" to ThemeOrigin.User, seen)
        assertFalse(s.adoptRemote(doc("violet", now - 10_000).toJson())); assertEquals("cobalt", s.prefs.themeId)
        assertFalse(s.adoptRemote(doc("violet", now).toJson()))                      // a tie keeps ours
        assertTrue(s.adoptRemote(doc("violet", now + 1).toJson()))
        assertEquals("violet" to ThemeOrigin.Remote, seen); assertEquals("violet", s.prefs.themeId)
        assertFalse(s.adoptRemote(null))
    }

    @Test fun anUnreadableCloudKeepsTheDeviceWorkingLocallyAndSilently() = runBlocking {
        val cloud = FakeCloud().also { it.failReads = true }; val s = store(cloud = cloud)
        s.apply("emerald")
        repeat(ThemeStore.MAX_FAILURES + 3) { s.sync() }                              // never throws
        assertEquals("emerald", s.prefs.themeId)
        assertEquals(ThemeStore.MAX_FAILURES, cloud.calls.count { it == "read" })     // and stops asking after a few failures
        cloud.failReads = false; s.apply("tangerine"); s.sync()                       // a new user action tries again
        assertEquals("tangerine", e.normalize(cloud.row!!.value).themeId)
    }

    @Test fun aFailedWriteKeepsTheChangeForTheNextTry() = runBlocking {
        val cloud = FakeCloud().also { it.failWrites = true }; val s = store(cloud = cloud)
        s.apply("emerald"); s.sync()
        assertTrue(s.dirty); assertNull(cloud.row)
        cloud.failWrites = false; s.sync()
        assertEquals("emerald", e.normalize(cloud.row!!.value).themeId); assertFalse(s.dirty)
        // and a change made offline is still sent after a restart (the state is derived from the two documents)
        val kv = MemKv(); val off = store(kv, FakeCloud().also { it.failWrites = true }); off.apply("orchid"); runBlocking { off.sync() }
        val back = FakeCloud(); val restarted = store(kv, back); assertTrue(restarted.dirty); runBlocking { restarted.sync() }
        assertEquals("orchid", e.normalize(back.row!!.value).themeId)
    }

    @Test fun withoutAnOwnerOrACloudNothingLeavesTheDevice() = runBlocking {
        val cloud = FakeCloud()
        store(cloud = cloud, owner = null).also { it.apply("cobalt"); it.sync() }
        store(cloud = cloud, owner = "  ").also { it.apply("cobalt"); it.sync() }
        store(cloud = null).also { it.apply("cobalt"); it.sync() }
        assertTrue(cloud.calls.isEmpty())
        assertEquals("ui_theme.a@b.c", ThemeStore.rowId(" A@B.C "))
    }
}
