package com.goodspace.cocolounge

/**
 * Neon Free plan (YES-3), the same rule as the web Lounge's quietTick. The database suspends after 5 idle
 * minutes and the free plan has 100 compute-hours a month, so a phone polling every 15 s kept it awake all
 * day. With the app on screen nothing changes. With it behind something the phone is QUIET: it reads only
 * while the database is awake anyway (a founder's screen or a cloud job is using it), when a command waits
 * for this phone (both from Nova's /api/awake wake board, which never touches the database and is shared by
 * every Nova instance), or once per shared 30-minute wall-clock slot, when every device reads at the same
 * moment, so four devices wake it once and not four times. A quiet request says so (x-coco-quiet) so it
 * never counts as "awake" itself.
 */
object Quiet {
    const val SLOT_MS = 30 * 60 * 1000L
    /** How long one decision to read stays open: a little over one background check (30 s). */
    const val WINDOW_MS = 35_000L
    /** The background check of the 15-minute WorkManager job, which cannot keep a wall-clock slot. */
    const val WATCH_EVERY_MS = 2 * 60 * 60 * 1000L
    /** A gap this long between the listener's ticks is the phone asleep or the process gone, not resting. */
    const val GAP_MS = 5 * 60_000L

    fun slotOf(t: Long) = t / SLOT_MS

    /** May a listener read now? On screen always; behind something only while awake, when a command waits, or in a new slot. */
    fun mayRead(foreground: Boolean, warm: Boolean, lastSlot: Long, now: Long, mail: Boolean = false) = foreground || warm || mail || slotOf(now) != lastSlot

    /** The WorkManager check: skipped while this process's own listener is still reading on its slots;
     *  otherwise only while awake, when a command waits, or at most every 2 hours when the app process is gone. */
    fun watchMayRead(warm: Boolean, listenerReadAt: Long, watchReadAt: Long, now: Long, mail: Boolean = false) =
        warm || mail || (now - listenerReadAt > SLOT_MS + 5 * 60_000L && now - watchReadAt >= WATCH_EVERY_MS)

    /** Is this mail new? Compared in Nova's clock only. The first answer in a process counts if the command is under 15 min old
     *  (the start-up read covered older ones). */
    fun mailIsNew(mailAt: Long?, seen: Long?, novaNow: Long?) = mailAt != null && if (seen != null) mailAt > seen else novaNow != null && novaNow - mailAt < 15 * 60_000L

    /** The app is behind something: requests carry x-coco-quiet. */
    @Volatile var quiet = false
    /** Until when the readers may touch the database (set by the listeners in Cloud.listen). */
    @Volatile var readUntil = Long.MAX_VALUE
    /** The last time a listener in this process really read (0 = none: the process is new). */
    @Volatile var listenerReadAt = 0L
    fun mayReadNow(now: Long = System.currentTimeMillis()) = now < readUntil

    /** The newest mail this process has acted on (Nova's clock). */
    @Volatile var mailSeen: Long? = null

    /** Since when this process has run without a gap: a command older than that was sent while the phone was away (Heal.runVerdict). */
    @Volatile var aliveSince = System.currentTimeMillis()
    @Volatile private var aliveTick = aliveSince
    fun noteAlive(now: Long = System.currentTimeMillis()) { if (now - aliveTick > GAP_MS) aliveSince = now; aliveTick = now }

    /** The mode last told to the others in a heartbeat; a change is told once, at once. */
    @Volatile private var presenceSent: Boolean? = null
    @Synchronized fun presenceChanged(): Boolean { if (presenceSent == quiet) return false; presenceSent = quiet; return true }
}
