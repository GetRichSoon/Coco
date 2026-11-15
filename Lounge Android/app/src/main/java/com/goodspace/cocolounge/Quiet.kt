package com.goodspace.cocolounge

/**
 * Neon Free plan (YES-3), the same rule as the web Lounge's quietTick. The database suspends after 5 idle
 * minutes and the free plan has 100 compute-hours a month, so a phone polling every 15 s kept it awake all
 * day. With the app on screen nothing changes. With it behind something the phone is QUIET: it reads only
 * while the database is awake anyway (a founder's screen or a cloud job is using it: Nova's /api/awake,
 * which never touches the database), or once per shared 30-minute wall-clock slot, when every device reads
 * at the same moment, so four devices wake it once and not four times. A quiet request says so
 * (x-coco-quiet) so it never counts as "awake" itself.
 */
object Quiet {
    const val SLOT_MS = 30 * 60 * 1000L
    /** How long one decision to read stays open: a little over one background check (30 s). */
    const val WINDOW_MS = 35_000L
    /** The background check of the 15-minute WorkManager job, which cannot keep a wall-clock slot. */
    const val WATCH_EVERY_MS = 2 * 60 * 60 * 1000L

    fun slotOf(t: Long) = t / SLOT_MS

    /** May a listener read now? On screen always; behind something only while awake or in a new slot. */
    fun mayRead(foreground: Boolean, warm: Boolean, lastSlot: Long, now: Long) = foreground || warm || slotOf(now) != lastSlot

    /** The WorkManager check: skipped while this process's own listener is still reading on its slots;
     *  otherwise only while awake, or at most every 2 hours when the app process is gone. */
    fun watchMayRead(warm: Boolean, listenerReadAt: Long, watchReadAt: Long, now: Long) =
        warm || (now - listenerReadAt > SLOT_MS + 5 * 60_000L && now - watchReadAt >= WATCH_EVERY_MS)

    /** The app is behind something: requests carry x-coco-quiet. */
    @Volatile var quiet = false
    /** Until when the readers may touch the database (set by the listeners in Cloud.listen). */
    @Volatile var readUntil = Long.MAX_VALUE
    /** The last time a listener in this process really read (0 = none: the process is new). */
    @Volatile var listenerReadAt = 0L
    fun mayReadNow(now: Long = System.currentTimeMillis()) = now < readUntil
}
