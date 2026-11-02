package com.goodspace.cocolounge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The phone must build the same scope keys as Nova (Lounge/chat-cloud.test.js), or two devices would write two threads. */
class ChatScopeTest {
    private fun n(kind: String, id: String, name: String, parent: String? = null, team: String? = null) =
        JSONObject().put("kind", kind).put("id", id).put("name", name).put("parent", parent ?: JSONObject.NULL).apply { team?.let { put("team", it) } }

    private val tree = listOf(
        n("team", "youtube", "YouTube Studio"),
        n("category", "youtube/ai-news", "AI News", "youtube"),
        n("channel", "chan-a", "Channel A", "youtube/ai-news"),
        n("agent", "youtube.scripty", "Scripty", "youtube", "youtube"),
        n("team", "ebooks", "Ebooks"),
        n("subteam", "ebooks/kdp", "KDP", "ebooks"),
        n("agent", "ebooks.kdp-head", "KDP Head", "ebooks/kdp", "ebooks"),
    )

    @Test fun keysSkipEmptyLevelsAndTrimTheEnd() {
        val chan = tree.first { it.optString("id") == "chan-a" }
        assertEquals("youtube||youtube/ai-news|chan-a", ChatScope.pick(emptyList(), chan, tree))
        assertEquals("coco", ChatScope.keyOf(emptyList()))
    }

    @Test fun anAgentJoinsThePathAtItsOwnSlot() {
        val path = ChatScope.path("youtube||youtube/ai-news", tree)
        val agent = ChatScope.next(path, tree).first { it.optString("kind") == "agent" }
        assertEquals("youtube||youtube/ai-news||youtube.scripty", ChatScope.pick(path, agent, tree))
    }

    @Test fun nextOffersTheChildrenAndOnlyThisTeamsAgents() {
        val next = ChatScope.next(ChatScope.path("youtube", tree), tree).map { it.optString("id") }
        assertTrue("youtube/ai-news" in next && "youtube.scripty" in next)
        assertTrue("ebooks.kdp-head" !in next)
        assertEquals(listOf("youtube", "ebooks"), ChatScope.next(emptyList(), tree).map { it.optString("id") })
    }

    @Test fun anUnknownIdStopsTheWalkAndUpGoesBack() {
        assertEquals(listOf("youtube"), ChatScope.path("youtube||gone", tree).map { it.optString("id") })
        val path = ChatScope.path("youtube||youtube/ai-news|chan-a", tree)
        assertEquals("youtube", ChatScope.upTo(path, 0))
    }

    @Test fun anActivityLineOpensThePartItNames() {
        assertEquals("youtube/ai-news", ChatScope.named("Scripty finished the AI News script", tree)?.optString("id"))
        assertNull(ChatScope.named("nothing here", tree))
    }
}
