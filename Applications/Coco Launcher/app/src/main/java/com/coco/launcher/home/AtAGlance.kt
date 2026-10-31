package com.coco.launcher.home

import android.Manifest
import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CalendarContract
import android.text.format.DateFormat
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.Event
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Date
import java.util.concurrent.TimeUnit

private val WallpaperShadow = Shadow(Color.Black.copy(alpha = 0.45f), blurRadius = 10f)

/**
 * Minute-accurate time without polling: the system already broadcasts ACTION_TIME_TICK once a
 * minute, plus a tick whenever the clock or the timezone is changed by hand.
 */
@Composable
private fun rememberNow(): Long {
    val context = androidx.compose.ui.platform.LocalContext.current
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    DisposableEffect(Unit) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                now = System.currentTimeMillis()
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_TIME_TICK)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
            addAction(Intent.ACTION_LOCALE_CHANGED)
        }
        runCatching { ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED) }
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }
    return now
}

@Composable
fun HomeClock(modifier: Modifier = Modifier) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val now = rememberNow()
    val is24 = DateFormat.is24HourFormat(context)
    val time = remember(now, is24) {
        DateFormat.format(if (is24) "HH:mm" else "h:mm", Date(now)).toString()
    }

    Crossfade(targetState = time, label = "clock") { value ->
        Text(
            text = value,
            style = MaterialTheme.typography.displayLarge.copy(shadow = WallpaperShadow),
            color = Color.White,
            modifier = modifier,
        )
    }
}

/**
 * The At a Glance line: the date always, the next alarm when one is set, and the next calendar
 * event only when the founder has turned that on and the permission is already granted. Anything
 * unavailable is hidden rather than shown empty. There is no weather here on purpose - the
 * launcher makes no network requests.
 */
@Composable
fun AtAGlance(showNextEvent: Boolean, modifier: Modifier = Modifier) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val now = rememberNow()

    val date = remember(now) { DateFormat.format("EEE, MMM d", Date(now)).toString() }

    val alarm = remember(now) {
        runCatching {
            val manager = context.getSystemService(AlarmManager::class.java)
            manager?.nextAlarmClock?.triggerTime?.takeIf { it > now }
        }.getOrNull()
    }
    val alarmText = alarm?.let {
        val pattern = if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a"
        DateFormat.format(pattern, Date(it)).toString()
    }

    var eventText by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(showNextEvent, now) {
        eventText = if (showNextEvent && hasCalendarPermission(context)) nextEvent(context, now) else null
    }

    Column(modifier = modifier) {
        Text(
            text = date,
            style = MaterialTheme.typography.titleMedium.copy(
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                shadow = WallpaperShadow,
            ),
            color = Color.White,
        )
        AnimatedVisibility(visible = alarmText != null, enter = fadeIn(), exit = fadeOut()) {
            GlanceRow(icon = true, text = alarmText.orEmpty(), alarm = true)
        }
        AnimatedVisibility(visible = eventText != null, enter = fadeIn(), exit = fadeOut()) {
            GlanceRow(icon = true, text = eventText.orEmpty(), alarm = false)
        }
    }
}

@Composable
private fun GlanceRow(icon: Boolean, text: String, alarm: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
        if (icon) {
            Icon(
                imageVector = if (alarm) Icons.Rounded.Alarm else Icons.Rounded.Event,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier
                    .size(14.dp)
                    .padding(end = 0.dp),
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp, shadow = WallpaperShadow),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 6.dp),
        )
    }
}

private fun hasCalendarPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) ==
        PackageManager.PERMISSION_GRANTED

/** Next event starting in the coming day, or null. Read-only, and never without permission. */
private suspend fun nextEvent(context: Context, now: Long): String? = withContext(Dispatchers.IO) {
    runCatching {
        val end = now + TimeUnit.DAYS.toMillis(1)
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon()
            .appendPath(now.toString())
            .appendPath(end.toString())
            .build()
        val projection = arrayOf(
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.ALL_DAY,
        )
        val cursor: Cursor? = context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            CalendarContract.Instances.BEGIN + " ASC",
        )
        cursor?.use {
            while (it.moveToNext()) {
                val title = it.getString(0)?.trim().orEmpty().ifEmpty { "Event" }
                val begin = it.getLong(1)
                val allDay = it.getInt(2) == 1
                if (!allDay && begin < now) continue
                val whenText = if (allDay) {
                    "today"
                } else {
                    val pattern = if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a"
                    DateFormat.format(pattern, Date(begin)).toString()
                }
                return@runCatching title + " - " + whenText
            }
            null
        }
    }.getOrNull()
}
