package com.goodspace.cocolounge.island.model

/**
 * The island's decisions as plain functions with no Android calls, so every one of them is unit tested
 * (app/src/test/.../island). The hub, the listener and the UI call these.
 */
object FaceRules {
    /** Which face the island shows: open card, arrival banner, small pill (with a side bubble when it fits) or nothing. */
    fun faceOf(live: Collection<Live>, ui: IslandUi, splitFits: Boolean): Face {
        val sorted = live.sortedByDescending { it.priority }
        if (ui.expanded) {
            val item = sorted.firstOrNull { it.id == ui.selectedId } ?: sorted.firstOrNull() ?: return Face.Hidden
            return Face.Expanded(item, sorted.filter { it.id != item.id }, ui.menu)
        }
        val peek = ui.peekId?.let { id -> sorted.firstOrNull { it.id == id } }
        if (peek != null) return Face.Peek(peek, reply = ui.replyId == peek.id)
        if (sorted.isEmpty()) return Face.Hidden
        return Face.Compact(sorted[0], if (splitFits) sorted.getOrNull(1) else null)
    }
}

/** Time as the island writes it: 4:05, 1:02:03, and with tenths for the open stopwatch (4:05.3). */
object Clock {
    fun fmt(ms: Long): String {
        val total = (ms / 1000).coerceAtLeast(0)
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
    }

    fun fmtTenths(ms: Long): String = fmt(ms) + "." + ((ms.coerceAtLeast(0) % 1000) / 100)
}

/** Reads a navigation notification ("250 m · Turn left onto MG Road") into distance + instruction. */
object NavText {
    data class Nav(val distance: String, val instruction: String)

    // A number with a unit at the start: 250 m, 1.2 km, 0,5 km, 300 ft, 2 mi, 120 yd, 250 मी, 1.2 किमी
    private val DIST = Regex("""^\s*(\d+(?:[.,]\d+)?\s?(?:km|m|ft|mi|yd|किमी|कि\.मी\.|मी\.?|मीटर))(?=$|[\s·•,\-–])\s*[·•,\-–]?\s*(.*)$""", RegexOption.IGNORE_CASE)

    fun parse(title: String, text: String): Nav {
        DIST.find(title.trim())?.let { m ->
            val rest = m.groupValues[2].trim()
            return Nav(m.groupValues[1].trim(), rest.ifBlank { text.trim() })
        }
        DIST.find(text.trim())?.let { m ->
            val rest = m.groupValues[2].trim()
            return Nav(m.groupValues[1].trim(), title.trim().ifBlank { rest })
        }
        return Nav("", title.trim().ifBlank { text.trim() })
    }
}

/** Which calendar meeting the island shows, and its join link. */
object CalendarRules {
    data class Ev(val id: Long, val title: String, val begin: Long, val end: Long, val location: String, val description: String, val allDay: Boolean)

    /** Shown from 10 minutes before the start ... */
    const val LEAD_MS = 10 * 60_000L
    /** ... until 5 minutes after it began (late joiners still get the Join button). */
    const val GRACE_MS = 5 * 60_000L

    fun pick(events: List<Ev>, now: Long, dismissed: Set<Long>): Ev? =
        events.asSequence()
            .filter { !it.allDay && it.id !in dismissed && it.title.isNotBlank() }
            .filter { it.begin - now <= LEAD_MS && now - it.begin <= GRACE_MS && it.end > now }
            .minByOrNull { it.begin }

    private val JOIN = Regex("""https?://(?:[a-z0-9-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|webex\.com|meet\.jit\.si)/[^\s<>"')\]]+""", RegexOption.IGNORE_CASE)

    fun joinUrl(vararg texts: String): String? = texts.firstNotNullOfOrNull { JOIN.find(it)?.value?.trimEnd('.', ',', ';') }

    /** "in 8 min", "now", "3 min ago" */
    fun label(begin: Long, now: Long): String {
        val d = begin - now
        return when {
            d > 60_000L -> "in ${(d + 30_000L) / 60_000L} min"
            d > -60_000L -> "now"
            else -> "${-d / 60_000L} min ago"
        }
    }
}

/** Call buttons by their label, in English and Hindi: true = answer, false = decline or hang up, null = neither. */
object CallWords {
    private val ANSWER = Regex("""\b(answer|accept|pick up)\b|उठा|जवाब|स्वीकार करें|उत्तर""")
    private val DECLINE = Regex("""\b(decline|reject|hang ?up|end call|end|dismiss|ignore)\b|अस्वीकार|काट|समाप्त""")

    fun classify(label: String): Boolean? {
        val l = label.lowercase()
        return when {
            ANSWER.containsMatchIn(l) && !l.contains("अस्वीकार") -> true
            DECLINE.containsMatchIn(l) -> false
            else -> null
        }
    }
}

/** Recorders and screen recording get the red iPhone dot; anything else with a running clock gets the accent colour. */
object LiveKinds {
    fun isRecording(pkg: String, title: String, channel: String?): Boolean {
        val all = (pkg + " " + title + " " + channel.orEmpty()).lowercase()
        return listOf("screenrecord", "screen record", "screen_record", "recorder", "recording", "soundrecorder", "रिकॉर्ड").any { it in all }
    }
}
