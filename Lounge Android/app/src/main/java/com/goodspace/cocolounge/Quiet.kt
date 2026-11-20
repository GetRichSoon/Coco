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
    /** How long one decision to read stays open: a little over one background check (60 s, +10% jitter). */
    const val WINDOW_MS = 70_000L
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

    /** Every /api/awake ping is a function call on Vercel's free plan (1M a month for all of Nova), the same rule as the web Lounge's
     *  awakeDue: it is asked only where Nova has it. A 4xx or an answer without { warm, mail_at, now } is an older Nova, asked again
     *  in 6 hours (Cloud keeps that in its prefs, so a new process does not ask again) while the shared slot reads go on as before.
     *  Background checks are a minute apart (+/-10%), and after 10 failed pings in a row, 5 minutes. */
    const val AWAKE_EVERY_MS = 60_000L
    const val AWAKE_OFF_MS = 6 * 60 * 60_000L
    const val AWAKE_SLOW_MS = 5 * 60_000L
    @Volatile var awakeFails = 0
    @Volatile var awakeAskedAt = 0L
    fun awakeDue(now: Long, offUntil: Long) = now >= offUntil && (awakeFails < 10 || now - awakeAskedAt >= AWAKE_SLOW_MS)
    /** One answer to /api/awake: true = this Nova has the wake board, false = an older one without it (a 4xx, or another shape), null = no answer (5xx). */
    fun awakeSupported(code: Int, shaped: Boolean): Boolean? = if (code in 200..299 && shaped) true else if (code < 500) false else null
    fun jittered(ms: Long, r: Double = Math.random()) = (ms * (0.9 + 0.2 * r)).toLong()

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
