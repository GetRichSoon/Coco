@file:OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun JSONObject.str(k: String) = optString(k).let { if (it == "null") "" else it }

/** Questions Boss asks most, one tap each. Plain words; Coco Cloud answers them like typed ones. */
private val QUICK = listOf("What is the team doing?", "Anything for my YES?", "How is my PC?", "Plan my day", "Play kesariya on my PC")

private fun at(m: JSONObject): Instant? = runCatching { java.time.OffsetDateTime.parse(m.str("created_at").replace(" ", "T")).toInstant() }.getOrNull()

/** "Today", "Yesterday" or "Mon, 21 Oct". */
fun dayLabel(day: LocalDate, today: LocalDate): String = when (day) {
    today -> "Today"
    today.minusDays(1) -> "Yesterday"
    else -> day.format(DateTimeFormatter.ofPattern("EEE, d MMM"))
}

/** Messages from the same person within 5 minutes form one group (only the last one gets the tail, name and time). */
fun sameGroup(a: JSONObject?, b: JSONObject?): Boolean {
    if (a == null || b == null) return false
    if (a.str("role") != b.str("role") || a.str("author") != b.str("author")) return false
    val ta = at(a) ?: return false; val tb = at(b) ?: return false
    return kotlin.math.abs(java.time.Duration.between(ta, tb).toMinutes()) < 5
}

@Composable
fun ChatScreen(vm: Lounge) {
    val msgs = vm.data.chat
    val list = rememberLazyListState()
    var text by rememberSaveable { mutableStateOf("") }
    val thinking = msgs.lastOrNull()?.let { it.str("role") == "founder" && it.str("status") in setOf("new", "thinking") } == true
    LaunchedEffect(msgs.size, thinking) { val n = list.layoutInfo.totalItemsCount; if (n > 0) list.animateScrollToItem(n - 1) }
    val send = { t: String -> if (t.isNotBlank()) { vm.sendChat(t.trim()); text = "" } }
    val mic = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        r.data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { heard -> send(heard) }
    }
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)

    Column(Modifier.fillMaxSize().imePadding()) {
        CocoPresence(thinking, vm.live)
        LazyColumn(Modifier.weight(1f), state = list, contentPadding = PaddingValues(14.dp, 6.dp, 14.dp, 10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            if (msgs.isEmpty()) item(key = "empty") { EmptyChat() }
            var lastDay: LocalDate? = null
            msgs.forEachIndexed { i, m ->
                val day = at(m)?.atZone(zone)?.toLocalDate()
                if (day != null && day != lastDay) {
                    val label = dayLabel(day, today)
                    item(key = "day-$day") { DaySep(label) }
                    lastDay = day
                }
                val first = !sameGroup(msgs.getOrNull(i - 1), m)
                val last = !sameGroup(m, msgs.getOrNull(i + 1))
                item(key = "m-" + m.str("id")) {
                    Bubble(vm, m, first, last, Modifier.animateItem(
                        fadeInSpec = spring(stiffness = Spring.StiffnessMediumLow),
                        placementSpec = spring(dampingRatio = 0.8f, stiffness = 380f),
                    ))
                }
            }
            if (thinking) item(key = "typing") { TypingBubble(Modifier.animateItem()) }
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 8.dp)) {
            items(QUICK) { q -> SuggestionChip({ send(q) }, { Text(q) }, shape = RoundedCornerShape(50)) }
        }
        Composer(text, { text = it }, { send(text) }) {
            mic.launch(Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Talk to Coco"))
        }
    }
}

/** Coco is here: her living mark and what she is doing right now. */
@Composable
private fun CocoPresence(thinking: Boolean, live: Boolean) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        CompositionLocalProvider(LocalCalm provides (LocalCalm.current || !thinking)) { LivingMark(Marks.coco, 42.dp) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("Coco", style = MaterialTheme.typography.titleLarge)
            AnimatedContent(if (thinking) "Thinking…" else if (live) "Online · answers in seconds" else "Reconnecting · your message waits safely", label = "presence") { s ->
                Text(s, style = MaterialTheme.typography.bodyMedium, color = if (thinking) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (thinking) TypingDots(MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun DaySep(label: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
        Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.surfaceContainerHigh) {
            Text(label, Modifier.padding(horizontal = 12.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun EmptyChat() {
    Column(Modifier.fillMaxWidth().padding(vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        LivingMark(Marks.coco, 96.dp)
        Text("Ask Coco anything", style = MaterialTheme.typography.headlineSmall)
        Muted("A task, a question, a rule. Coco answers from the cloud, then acts or asks for your YES.")
    }
}

/** Links in a message become tappable. */
private val URL = Regex("""https?://[^\s<>"')\]]+""")
private fun linkify(s: String, linkColor: androidx.compose.ui.graphics.Color): AnnotatedString = buildAnnotatedString {
    var at = 0
    for (m in URL.findAll(s)) {
        append(s.substring(at, m.range.first))
        withLink(LinkAnnotation.Url(m.value, TextLinkStyles(SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)))) { append(m.value) }
        at = m.range.last + 1
    }
    append(s.substring(at))
}

@Composable
private fun Bubble(vm: Lounge, m: JSONObject, first: Boolean, last: Boolean, modifier: Modifier) {
    val cs = MaterialTheme.colorScheme
    val founder = m.str("role") == "founder"
    val mine = founder && (m.str("author") == vm.name || m.str("device_id") == vm.cloud.deviceId)
    val coco = !founder
    val clip = LocalClipboardManager.current
    val big = 22.dp; val inner = 8.dp; val tail = 5.dp
    val shape = if (mine) RoundedCornerShape(topStart = big, topEnd = if (first) big else inner, bottomEnd = if (last) tail else inner, bottomStart = big)
        else RoundedCornerShape(topStart = if (first) big else inner, topEnd = big, bottomEnd = big, bottomStart = if (last) tail else inner)
    val bg = when { mine -> cs.primary; coco -> cs.surfaceContainerHigh; else -> cs.secondaryContainer }
    val fg = when { mine -> cs.onPrimary; coco -> cs.onSurface; else -> cs.onSecondaryContainer }
    Column(modifier.fillMaxWidth().padding(top = if (first) 6.dp else 0.dp), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
        if (first && !mine) Text(m.str("author").ifBlank { if (coco) "Coco" else "" }, style = MaterialTheme.typography.labelMedium,
            color = cs.onSurfaceVariant, modifier = Modifier.padding(start = 46.dp, bottom = 2.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            if (!mine) {
                if (last) { if (coco) CompositionLocalProvider(LocalCalm provides true) { LivingMark(Marks.coco, 34.dp) } else Surface(Modifier.size(34.dp), shape = RoundedCornerShape(50), color = cs.secondaryContainer) {
                    Box(contentAlignment = Alignment.Center) { Text(m.str("author").take(1).uppercase(), color = cs.onSecondaryContainer, fontWeight = FontWeight.Bold) } } }
                else Spacer(Modifier.width(34.dp))
                Spacer(Modifier.width(8.dp))
            }
            Surface(shape = shape, color = bg, contentColor = fg, modifier = Modifier.widthIn(max = 290.dp)
                .combinedClickable(onClick = {}, onLongClick = { clip.setText(AnnotatedString(m.str("body"))); vm.message = "Copied" })) {
                Text(linkify(m.str("body"), if (mine) cs.onPrimary else cs.primary), Modifier.padding(horizontal = 14.dp, vertical = 9.dp), style = MaterialTheme.typography.bodyLarge)
            }
        }
        if (last) Text(
            when { mine && m.str("status") == "new" -> "Sent · Coco will answer"; mine && m.str("status") == "thinking" -> "Coco is working on it"; else -> ago(m.str("created_at")) },
            style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant,
            modifier = Modifier.padding(start = if (mine) 0.dp else 46.dp, top = 3.dp, end = 4.dp),
        )
    }
}

@Composable
private fun TypingBubble(modifier: Modifier) {
    Row(modifier.padding(top = 6.dp), verticalAlignment = Alignment.Bottom) {
        LivingMark(Marks.coco, 34.dp)
        Spacer(Modifier.width(8.dp))
        Surface(shape = RoundedCornerShape(22.dp, 22.dp, 22.dp, 5.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh) {
            TypingDots(MaterialTheme.colorScheme.onSurfaceVariant, Modifier.padding(horizontal = 16.dp, vertical = 14.dp))
        }
    }
}

/** Pill composer: the mic turns into Send as soon as there is text (shape and icon morph with a spring). */
@Composable
private fun Composer(text: String, onText: (String) -> Unit, onSend: () -> Unit, onMic: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.Bottom) {
        Surface(shape = RoundedCornerShape(28.dp), color = cs.surfaceContainerHigh, modifier = Modifier.weight(1f)) {
            Box(Modifier.padding(horizontal = 18.dp, vertical = 14.dp)) {
                if (text.isEmpty()) Text("Message Coco…", style = MaterialTheme.typography.bodyLarge, color = cs.onSurfaceVariant)
                BasicTextField(text, onText, textStyle = MaterialTheme.typography.bodyLarge.copy(color = cs.onSurface), cursorBrush = SolidColor(cs.primary),
                    maxLines = 5, keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { onSend() }),
                    modifier = Modifier.fillMaxWidth())
            }
        }
        Spacer(Modifier.width(8.dp))
        AnimatedContent(text.isBlank(), label = "send-or-mic", transitionSpec = {
            (scaleIn(MuMotion.spatialFast(), initialScale = 0.6f) + fadeIn(MuMotion.effects())) togetherWith (scaleOut(MuMotion.spatialFast(), targetScale = 0.6f) + fadeOut(MuMotion.effects()))
        }) { empty ->
            if (empty) FilledTonalIconButton(onMic, Modifier.size(54.dp)) { Icon(Icons.Rounded.Mic, "Speak to Coco") }
            else FilledIconButton(onSend, Modifier.size(54.dp)) { Icon(Icons.AutoMirrored.Rounded.Send, "Send") }
        }
    }
}
