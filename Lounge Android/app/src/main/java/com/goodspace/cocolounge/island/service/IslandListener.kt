package com.goodspace.cocolounge.island.service

import android.app.Notification
import android.content.ComponentName
import android.os.SystemClock
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.goodspace.cocolounge.island.IslandHub
import com.goodspace.cocolounge.island.model.CallState
import com.goodspace.cocolounge.island.model.NoteAction
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.runtime.IslandRuntime
import com.goodspace.cocolounge.island.runtime.MediaWatcher
import androidx.core.graphics.drawable.toBitmap
import com.goodspace.cocolounge.island.util.AppIcons

/** Feeds real notifications, calls and the media session into the island. Android starts it again after a reboot by itself. */
class IslandListener : NotificationListenerService() {
    /** Every live call notification by key. Several keys (or two apps) for one call still make ONE island. */
    private val calls = LinkedHashMap<String, NoteLive>()

    /** Keys we removed ourselves (island-only mode). Their removal callback must not close the banner. */
    private val selfCancelled = HashSet<String>()

    override fun onListenerConnected() {
        if (IslandRuntime.isEnabled(this) && IslandRuntime.ensure(this)) {
            MediaWatcher.start(this, ComponentName(this, IslandListener::class.java))
            // A call that was already ringing or running when we connected.
            runCatching { activeNotifications }.getOrNull().orEmpty()
                .filter { it.notification.category == Notification.CATEGORY_CALL }
                .forEach { onCall(it) }
        }
    }

    override fun onListenerDisconnected() {
        MediaWatcher.stop()
        calls.clear()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification, rankingMap: RankingMap) {
        if (!IslandRuntime.isEnabled(this)) return
        // Coco Brain: the island now lives inside the Coco app, so its own approval and done alerts come from this package.
        if (sbn.packageName == packageName) {
            when (sbn.notification.channelId) {
                "coco_lounge" -> { onCoco(sbn); return }
                IslandTestReceiver.CHANNEL, IslandTestReceiver.CHANNEL_HIGH -> Unit   // tests from the PC take the same path as any app's
                else -> return
            }
        }
        val n = sbn.notification
        if (n.category == Notification.CATEGORY_CALL) {
            onCall(sbn)
            return
        }
        val extras = n.extras
        if (sbn.isOngoing) { onLive(sbn); return }
        // Like iPhone: messages are not island material; they stay normal Android notifications unless switched on.
        if (!IslandRuntime.pref(this, IslandRuntime.KEY_NOTES, false)) return
        if (n.category in setOf(Notification.CATEGORY_PROGRESS, Notification.CATEGORY_TRANSPORT, Notification.CATEGORY_SERVICE, Notification.CATEGORY_SYSTEM)) return
        if (extras.getString(Notification.EXTRA_TEMPLATE)?.endsWith("MediaStyle") == true) return

        // Island-only: every message notification leaves the system shade, so nothing ever shows twice. That includes
        // the group summary ("2 new messages", which used to stay behind as a second WhatsApp notification) and the
        // quiet re-posts apps make when a chat updates.
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        val summary = n.flags and Notification.FLAG_GROUP_SUMMARY != 0
        val hide = IslandRuntime.pref(this, IslandRuntime.KEY_HIDE_ORIGINALS, false) && n.flags and Notification.FLAG_NO_CLEAR == 0 &&
            (summary || title.isNotBlank() || text.isNotBlank())
        if (hide) {
            selfCancelled += sbn.key
            if (selfCancelled.size > 200) selfCancelled.clear()
            cancelNotification(sbn.key)
        }
        if (summary) return
        val quietRepost = n.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0
        if (quietRepost && n.`when` != 0L && System.currentTimeMillis() - n.`when` > 15_000) return
        if (quietRepost && IslandHub.isQuiet(sbn.packageName)) return   // the echo of a reply just sent from the island
        if (title.isBlank() && text.isBlank()) return

        // The app's own buttons, labels and icons as it ships them (Reply, Mark as read, Like, Archive...), for every app.
        val actions = n.actions.orEmpty().mapNotNull { a ->
            val label = a.title?.toString()?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
            NoteAction(
                label = label,
                intent = a.actionIntent,
                positive = null,
                remote = a.remoteInputs.orEmpty().filter { it.allowFreeFormInput },
                icon = runCatching { a.getIcon()?.loadDrawable(this)?.toBitmap(48, 48) }.getOrNull(),
            )
        }
        val avatar = runCatching { n.getLargeIcon()?.loadDrawable(this)?.toBitmap(128, 128) }.getOrNull()
        IslandHub.notify(
            NoteLive(
                id = "note:" + sbn.key,
                appName = AppIcons.label(this, sbn.packageName),
                title = title.ifBlank { AppIcons.label(this, sbn.packageName) },
                text = text,
                icon = AppIcons.icon(this, sbn.packageName),
                open = n.contentIntent,
                actions = actions,
                isCall = false,
                pkg = sbn.packageName,
                avatar = avatar,
            ),
        )
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (calls.remove(sbn.key) != null) {
            val left = pickCall()
            if (left == null) IslandHub.endCall() else IslandHub.call(left)
            return
        }
        IslandHub.remove("live:" + sbn.key)
        if (sbn.key == navKey) { navKey = null; IslandHub.remove("nav") }
        IslandHub.remove("coco:" + sbn.key)
        if (selfCancelled.remove(sbn.key)) return   // we hid it ourselves; the banner keeps its own timer
        IslandHub.remove("note:" + sbn.key)
    }

    /**
     * iPhone Live Activities: an ongoing download, navigation, ride or delivery becomes a quiet pill that updates in
     * place (same key = same pill). A plain "app is running" service notice without progress is ignored.
     */
    private fun onLive(sbn: StatusBarNotification) {
        val n = sbn.notification
        val extras = n.extras
        if (extras.getString(Notification.EXTRA_TEMPLATE)?.endsWith("MediaStyle") == true) return
        val max = extras.getInt(Notification.EXTRA_PROGRESS_MAX, 0)
        val busy = extras.getBoolean(Notification.EXTRA_PROGRESS_INDETERMINATE, false)
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val sub = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()
        // Android 16 Live Updates put a short status-bar text here ("5 min", "Arriving"); older phones never set it.
        val short = extras.getCharSequence("android.shortCriticalText")?.toString().orEmpty()
        // The app's own running clock: recorders, workouts, screen recording, stopwatch apps.
        val chrono = extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false) && n.`when` > 0L &&
            !extras.getBoolean(Notification.EXTRA_CHRONOMETER_COUNT_DOWN, false)
        val nav = n.category == Notification.CATEGORY_NAVIGATION || sbn.packageName in NAV_APPS
        val liveCategory = nav || n.category == Notification.CATEGORY_PROGRESS || n.category == Notification.CATEGORY_STOPWATCH
        if (max <= 0 && !busy && !liveCategory && !chrono && short.isBlank()) return
        if (title.isBlank() && text.isBlank()) return
        if (nav) {
            // Turn-by-turn like the iPhone Maps activity: the app's own turn arrow, the distance, the street, the arrival time.
            val parsed = com.goodspace.cocolounge.island.model.NavText.parse(title, text)
            IslandHub.put(
                com.goodspace.cocolounge.island.model.NavLive(
                    id = "nav", appName = AppIcons.label(this, sbn.packageName), distance = parsed.distance.ifBlank { short },
                    instruction = parsed.instruction, eta = sub.ifBlank { if (parsed.distance.isBlank()) text else "" },
                    arrow = runCatching { n.getLargeIcon()?.loadDrawable(this)?.toBitmap(96, 96) }.getOrNull(),
                    icon = AppIcons.icon(this, sbn.packageName), open = n.contentIntent, pkg = sbn.packageName,
                ),
            )
            navKey = sbn.key
            return
        }
        val progress = when { max > 0 -> (extras.getInt(Notification.EXTRA_PROGRESS, 0) * 100 / max).coerceIn(0, 100); busy -> -1; else -> -2 }
        val since = if (chrono) SystemClock.elapsedRealtime() - (System.currentTimeMillis() - n.`when`).coerceAtLeast(0L) else 0L
        IslandHub.put(
            NoteLive(
                id = "live:" + sbn.key,
                appName = AppIcons.label(this, sbn.packageName),
                title = title.ifBlank { AppIcons.label(this, sbn.packageName) },
                text = text,
                icon = AppIcons.icon(this, sbn.packageName),
                open = n.contentIntent,
                actions = emptyList(),
                isCall = false,
                pkg = sbn.packageName,
                live = true,
                progress = progress,
                since = since,
                shortText = short,
                recording = chrono && com.goodspace.cocolounge.island.model.LiveKinds.isRecording(sbn.packageName, title, n.channelId),
            ),
        )
    }

    /** The key of the notification that feeds the navigation pill, so its removal ends the pill. */
    private var navKey: String? = null

    private companion object {
        /** Navigation apps that do not always mark their notification as navigation. */
        val NAV_APPS = setOf("com.google.android.apps.maps", "com.waze", "com.mapmyindia.app", "com.google.android.apps.mapslite")
    }

    /**
     * Coco Brain: Coco Lounge's own alerts ("Needs your YES: A-014", "Done: ...") always reach the island, even with
     * messages off. A new approval drops down once, then stays as a small orange pill until it is decided (the Lounge
     * notification goes away); a tap opens Coco Lounge's real approval screen.
     */
    private fun onCoco(sbn: StatusBarNotification) {
        val n = sbn.notification
        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        if (sbn.isOngoing || title.isBlank()) return   // "Coco connected" service notice
        val note = NoteLive(
            id = "note:" + sbn.key, appName = "Coco", title = title, text = text, icon = AppIcons.icon(this, sbn.packageName),
            open = n.contentIntent, actions = emptyList(), isCall = false, pkg = sbn.packageName,
        )
        IslandHub.notify(note)
        if (title.startsWith("Needs your YES")) IslandHub.put(note.copy(id = "coco:" + sbn.key, live = true, progress = -3))
    }

    private fun onCall(sbn: StatusBarNotification) {
        val n = sbn.notification
        // Remember which phone app rings and on which channel: the Island page opens exactly that setting so its own
        // pop-up can be switched off (no app may hide another app's call pop-up).
        if (sbn.packageName != packageName) IslandRuntime.rememberCallApp(this, sbn.packageName, n.channelId)
        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_TEXT) ?: extras.getCharSequence(Notification.EXTRA_SUB_TEXT))?.toString().orEmpty()
        val actions = n.actions.orEmpty().mapNotNull { a ->
            val label = a.title?.toString() ?: return@mapNotNull null
            NoteAction(label, a.actionIntent, com.goodspace.cocolounge.island.model.CallWords.classify(label))
        }
        // Android 12+ CallStyle tells us the state directly: 1 incoming, 2 ongoing, 3 screening.
        val state = when (extras.getInt("android.callType", 0)) {
            1, 3 -> CallState.Incoming
            2 -> CallState.Ongoing
            else -> if (actions.any { it.positive == true }) CallState.Incoming else CallState.Ongoing
        }
        val chrono = extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false)
        val startedAt = if (state == CallState.Ongoing && chrono && n.`when` > 0L) {
            SystemClock.elapsedRealtime() - (System.currentTimeMillis() - n.`when`).coerceAtLeast(0L)
        } else 0L
        val appName = AppIcons.label(this, sbn.packageName)
        @Suppress("DEPRECATION")
        val person = runCatching { extras.getParcelable<android.app.Person>("android.callPerson") }.getOrNull()?.name?.toString()
        val caller = person?.takeIf { it.isNotBlank() } ?: title.ifBlank { appName }
        // High importance = Android pops the phone app's own banner up (the default phone app cannot be changed on ColorOS).
        val ranking = Ranking()
        val banner = runCatching { currentRanking.getRanking(sbn.key, ranking) && ranking.importance >= android.app.NotificationManager.IMPORTANCE_HIGH }.getOrDefault(false)
        calls[sbn.key] = NoteLive(
            systemBanner = banner,
            id = IslandHub.CALL_ID,
            appName = appName,
            title = caller,
            text = if (person != null && title.isNotBlank() && title != person) title else text,
            icon = AppIcons.icon(this, sbn.packageName),
            open = n.contentIntent,
            actions = actions,
            isCall = true,
            callState = state,
            startedAt = startedAt,
            pkg = sbn.packageName,
        )
        if (!IslandRuntime.isEnabled(this)) return
        pickCall()?.let { IslandHub.call(it) }
    }

    /** Ringing beats a call in progress (call waiting); otherwise the newest one. */
    private fun pickCall(): NoteLive? =
        calls.values.lastOrNull { it.ringing } ?: calls.values.lastOrNull()

}
