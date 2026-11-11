@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.goodspace.cocolounge

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.background
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// ---------- who is doing what (pure, unit tested in HqTest) ----------

enum class CrewState { NeedsYes, Working, Queued, Resting }

/** The HQ entrance plays once per app start, not every time the list scrolls it back into view. */
object HqIntro { var played = false }

/** One Bonbon Club member as Coco HQ shows them: what state they are in and the line that says why. */
data class Crew(val id: String, val name: String, val state: CrewState, val line: String)

private fun JSONObject.str(k: String) = optString(k).let { if (it == "null") "" else it }

object HqRules {
    private val RUNNING = setOf("running", "working")
    private val YES = setOf("needs_yes", "waiting_yes", "need_approval")

    /** A task waiting on a founder beats running work, which beats the member's own "doing" line, then queued work. */
    fun crew(members: List<JSONObject>, tasks: List<JSONObject>): List<Crew> = members.map { m ->
        val id = m.str("id")
        val mine = tasks.filter { it.str("member_id") == id }
        val yes = mine.firstOrNull { it.str("status") in YES }
        val run = mine.firstOrNull { it.str("status") in RUNNING }
        val queued = mine.firstOrNull { it.str("status") == "queued" }
        val doing = m.str("doing")
        val name = m.str("name").ifBlank { id }
        when {
            yes != null -> Crew(id, name, CrewState.NeedsYes, yes.str("title"))
            run != null -> Crew(id, name, CrewState.Working, run.str("title"))
            doing.isNotBlank() -> Crew(id, name, CrewState.Working, doing)
            queued != null -> Crew(id, name, CrewState.Queued, queued.str("title"))
            else -> Crew(id, name, CrewState.Resting, m.str("job"))
        }
    }

    /** What Coco says at the top of HQ, in plain words. */
    fun cocoLine(crew: List<Crew>, queued: Int, waitingYes: Int, paused: Boolean, callMe: String): String {
        val who = callMe.ifBlank { "Boss" }
        val working = crew.filter { it.state == CrewState.Working }.map { it.name }
        return when {
            paused -> "I am paused, $who. Nothing new starts until you resume me."
            waitingYes > 0 -> "$who, $waitingYes ${if (waitingYes == 1) "thing needs" else "things need"} your YES. The rest keeps moving."
            working.size == 1 -> "${working[0]} is at work. I am keeping the queue moving."
            working.size > 1 -> "${working.dropLast(1).joinToString(", ")} and ${working.last()} are at work. I am coordinating."
            queued > 0 -> "$queued ${if (queued == 1) "task is" else "tasks are"} queued. I will hand them out."
            else -> "All quiet. Ready when you are, $who."
        }
    }
}

// ---------- team talk (pure, unit tested) ----------

/** One line of the team talking: who said it, to whom, the words, and when. */
data class Talk(val from: String, val to: String?, val text: String, val kind: String, val atIso: String)

object TalkRules {
    /** Pretty name for an agent id or actor: a Bonbon Club member's name, Coco, or the id tidied up. */
    fun name(raw: String?, members: List<JSONObject>): String {
        val s = (raw ?: "").trim()
        val low = s.lowercase()
        if (low.isEmpty()) return ""
        if (low == "coco" || low.endsWith("nova") || low == "core.nova") return "Coco"
        members.firstOrNull { it.optString("id").equals(low, true) || it.optString("name").equals(s, true) }?.let { return it.optString("name") }
        // "core.scout" / "ext-builder" -> "Scout" / "Ext builder" (sentence case)
        val tail = low.substringAfterLast('.').replace('_', ' ').replace('-', ' ').trim()
        return tail.replaceFirstChar { it.uppercase() }.ifBlank { s }
    }

    /** How an activity row reads as a line of team talk (null = not team talk, skip it). */
    private fun fromActivity(a: JSONObject): Pair<String, String>? {
        val detail = a.optString("detail").let { if (it == "null") "" else it }
        return when (a.optString("action")) {
            "task added" -> "gave a task" to detail
            "merged" -> "merged duplicate work" to detail
            "rule set" -> "set a rule" to detail
            "update" -> (detail.substringBefore(" | ").ifBlank { "update" }) to detail.substringAfter(" | ", "")
            "approved" -> "approved" to detail
            "declined" -> "said no to" to detail
            "published", "posted" -> "published" to detail
            else -> if (detail.isNotBlank()) a.optString("action").replace('_', ' ') to detail else null
        }
    }

    /** The live conversation: direct agent messages first, then what the team did (activity), newest first. */
    fun talk(agentMessages: List<JSONObject>, activity: List<JSONObject>, members: List<JSONObject>, limit: Int = 30): List<Talk> {
        val out = ArrayList<Talk>()
        for (m in agentMessages) {
            val t = m.optString("text").let { if (it == "null") "" else it }
            if (t.isBlank()) continue
            out += Talk(name(m.optString("from_agent"), members), m.optString("to_agent").takeIf { it.isNotBlank() && it != "null" }?.let { name(it, members) }, t, m.optString("kind").ifBlank { "say" }, m.optString("at"))
        }
        for (a in activity) {
            val f = fromActivity(a) ?: continue
            val who = a.optString("actor").let { if (it == "null") "" else it }
            if (who.isBlank()) continue
            out += Talk(name(who, members), null, if (f.second.isBlank()) f.first else "${f.first}: ${f.second}", "did", a.optString("at"))
        }
        return out.sortedByDescending { it.atIso }.take(limit)
    }
}

// ---------- Coco HQ ----------

/**
 * The live office (idea: Pixel Agents, drawn our own way): Coco in the middle, the Bonbon Club around her. A line with
 * moving dots runs from Coco to everyone who is working; "YES?" bubbles show work waiting on a founder; resting members
 * stay still (so only real work moves on screen). Tap a member for what they do, their tools and their tasks.
 */
@Composable
fun CocoHQ(vm: Lounge, onMember: (String) -> Unit) {
    val d = vm.data
    val crew = remember(d.members, d.tasks) { HqRules.crew(d.members, d.tasks) }
    val queued = d.tasks.count { it.str("status") == "queued" }
    val waitingYes = d.approvals.count { it.str("state") == "waiting" }
    val working = crew.count { it.state == CrewState.Working }
    val calm = LocalCalm.current
    val t = rememberInfiniteTransition(label = "hq")
    val flow by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1800, easing = LinearEasing)), label = "flow")
    val pulse by t.animateFloat(0f, 1f, infiniteRepeatable(tween(2600, easing = LinearEasing)), label = "pulse")

    PanelSurface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(32.dp)) {
        val cs = MaterialTheme.colorScheme; val r = LocalCocoRoles.current
        val ink = cs.onSurface; val soft = cs.onSurfaceVariant
        Column(Modifier.padding(top = 18.dp, bottom = 16.dp)) {
            Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("COCO HQ", style = MaterialTheme.typography.labelMedium, color = r.link, modifier = Modifier.weight(1f))
                Box(Modifier.size(8.dp).background(if (vm.live) r.success else cs.outline, CircleShape))
                Spacer(Modifier.width(6.dp))
                Text(if (vm.live) "live" else "offline", style = MaterialTheme.typography.labelSmall, color = soft)
            }
            // Coco speaks: the line cross-fades when the situation changes.
            AnimatedContent(HqRules.cocoLine(crew, queued, waitingYes, d.paused, vm.callMe), label = "coco-line",
                transitionSpec = { (fadeIn(MuMotion.effects()) + slideInVertically(MuMotion.spatial()) { it / 3 }) togetherWith fadeOut(tween(120)) }) { line ->
                Text(line, style = MaterialTheme.typography.titleLarge, color = ink, modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
            }

            BoxWithConstraints(Modifier.fillMaxWidth().height(318.dp)) {
                val w = maxWidth; val h = maxHeight
                val n = crew.size.coerceAtLeast(1)
                val rx = w / 2 - 40.dp; val ry = h / 2 - 46.dp
                fun pos(i: Int): Pair<androidx.compose.ui.unit.Dp, androidx.compose.ui.unit.Dp> {
                    val a = -PI / 2 + i * 2 * PI / n
                    return (w / 2 + rx * cos(a).toFloat()) to (h / 2 + ry * sin(a).toFloat())
                }
                val colors = crew.map { (Marks.members[it.id] ?: Marks.coco).bg }
                // Entrance (once per app start): every member springs out of Coco to their seat, one after another.
                val enter = remember(crew.size) { List(crew.size) { androidx.compose.animation.core.Animatable(if (calm || HqIntro.played) 1f else 0f) } }
                LaunchedEffect(crew.size) {
                    HqIntro.played = true
                    enter.forEachIndexed { i, a -> launch { delay(120L + i * 45L); a.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.62f, stiffness = 170f)) } }
                }
                val cxDp = w / 2; val cyDp = h / 2
                fun androidx.compose.ui.unit.Density.enterOffset(i: Int, px: androidx.compose.ui.unit.Dp, py: androidx.compose.ui.unit.Dp): androidx.compose.ui.unit.IntOffset {
                    val k = enter.getOrNull(i)?.value ?: 1f
                    val x = (cxDp + (px - cxDp) * k - 36.dp).roundToPx(); val y = (cyDp + (py - cyDp) * k - 32.dp).roundToPx()
                    return androidx.compose.ui.unit.IntOffset(x, y)
                }
                Canvas(Modifier.matchParentSize()) {
                    val c = Offset(size.width / 2, size.height / 2)
                    if (working > 0 && !calm) {
                        val rad = 50.dp.toPx() + 34.dp.toPx() * pulse
                        drawCircle(r.accent.copy(alpha = 0.28f * (1f - pulse)), rad, c, style = Stroke(3.dp.toPx()))
                    }
                    crew.forEachIndexed { i, m ->
                        val (px, py) = pos(i)
                        val k = enter.getOrNull(i)?.value ?: 1f
                        val p = Offset(c.x + (px.toPx() - c.x) * k, c.y + (py.toPx() - c.y) * k)
                        val col = colors[i]
                        when (m.state) {
                            CrewState.Working -> {
                                drawLine(col.copy(alpha = 0.55f), c, p, 3.dp.toPx(), cap = StrokeCap.Round)
                                if (!calm) for (k in 0..2) {
                                    val f = (flow + k / 3f) % 1f
                                    drawCircle(ink, 3.5.dp.toPx(), Offset(c.x + (p.x - c.x) * f, c.y + (p.y - c.y) * f), alpha = 1f - f * 0.5f)
                                }
                            }
                            CrewState.NeedsYes -> drawLine(r.warning.copy(alpha = if (calm) 0.7f else 0.35f + 0.5f * (1f - pulse)), c, p, 3.dp.toPx(),
                                cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 8.dp.toPx())))
                            CrewState.Queued -> drawLine(ink.copy(alpha = 0.22f), c, p, 2.dp.toPx(), cap = StrokeCap.Round)
                            CrewState.Resting -> drawLine(ink.copy(alpha = 0.12f), c, p, 1.5.dp.toPx(), cap = StrokeCap.Round,
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 7.dp.toPx())))
                        }
                    }
                }
                // Coco in the middle, with the queue she holds.
                Column(Modifier.offset(w / 2 - 48.dp, h / 2 - 48.dp).width(96.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    LivingMark(Marks.coco, 96.dp)
                }
                // The queue Coco holds, as a count on her corner (it no longer covers the line to the member below).
                if (queued > 0) Surface(Modifier.offset(w / 2 + 22.dp, h / 2 + 20.dp).size(28.dp), shape = CircleShape, color = r.highlight, contentColor = r.onHighlight, shadowElevation = 3.dp) {
                    Box(contentAlignment = Alignment.Center) { Text("$queued", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, maxLines = 1) }
                }
                // The team around her.
                crew.forEachIndexed { i, m ->
                    val (px, py) = pos(i)
                    val mark = Marks.members[m.id] ?: Marks.coco.copy(name = m.name)
                    Column(
                        // Springs out of Coco the first time HQ appears; no clip, so the typing bubble shows whole.
                        Modifier.offset { enterOffset(i, px, py) }.width(72.dp).bounceClick { onMember(m.id) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box {
                            // Only people who work move; resting members keep still.
                            CompositionLocalProvider(LocalCalm provides (calm || m.state == CrewState.Resting)) { LivingMark(mark, 46.dp) }
                            when (m.state) {
                                CrewState.Working -> Surface(Modifier.align(Alignment.TopEnd).offset(x = 12.dp, y = (-8).dp), shape = RoundedCornerShape(50), color = cs.surfaceContainerHighest) {
                                    TypingDots(cs.onSurface, Modifier.padding(horizontal = 5.dp, vertical = 4.dp))
                                }
                                CrewState.NeedsYes -> Surface(Modifier.align(Alignment.TopEnd).offset(x = 14.dp, y = (-10).dp), shape = RoundedCornerShape(50), color = r.warning) {
                                    Text("YES?", Modifier.padding(horizontal = 6.dp, vertical = 1.dp), style = MaterialTheme.typography.labelSmall, color = r.onWarning, fontWeight = FontWeight.Bold)
                                }
                                CrewState.Queued -> Box(Modifier.align(Alignment.TopEnd).size(12.dp).background(r.highlight, CircleShape))
                                CrewState.Resting -> Unit
                            }
                        }
                        Text(m.name, style = MaterialTheme.typography.labelSmall, color = if (m.state == CrewState.Resting) soft else ink,
                            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                    }
                }
            }

            // Who is working on what, with the wavy "in progress" line.
            val busy = crew.filter { it.state != CrewState.Resting }
            if (busy.isNotEmpty()) Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                busy.take(4).forEach { m ->
                    val mark = Marks.members[m.id] ?: Marks.coco
                    Surface(shape = RoundedCornerShape(20.dp), color = r.fieldSurface, modifier = Modifier.fillMaxWidth().bounceClick { onMember(m.id) }) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            CompositionLocalProvider(LocalCalm provides true) { LivingMark(mark, 34.dp) }
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(m.name + when (m.state) { CrewState.NeedsYes -> " · needs your YES"; CrewState.Queued -> " · next"; else -> "" },
                                    style = MaterialTheme.typography.titleMedium, color = ink)
                                Text(m.line, style = MaterialTheme.typography.bodyMedium, color = soft, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                if (m.state == CrewState.Working) WavyLine(mark.bg, Modifier.padding(top = 6.dp).fillMaxWidth(0.6f))
                            }
                        }
                    }
                }
            }
            Row(Modifier.padding(horizontal = 20.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HqChip("$working working", r.success)
                HqChip("$queued queued", r.highlight)
                HqChip("$waitingYes need YES", r.warning)
            }
        }
    }
}

@Composable
private fun HqChip(text: String, dot: Color) {
    Surface(shape = RoundedCornerShape(50), color = LocalCocoRoles.current.fieldSurface, contentColor = MaterialTheme.colorScheme.onSurface) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(7.dp).background(dot, CircleShape))
            Spacer(Modifier.width(6.dp))
            Text(text, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

// ---------- one member up close ----------

@Composable
fun MemberSheet(vm: Lounge, id: String, onClose: () -> Unit) {
    val d = vm.data
    val m = d.members.firstOrNull { it.str("id") == id } ?: run { LaunchedEffect(id) { onClose() }; return }
    val crew = HqRules.crew(listOf(m), d.tasks).first()
    val mark = Marks.members[id] ?: Marks.coco
    val houses = d.memberHouses.filter { it.str("member_id") == id }.mapNotNull { mh -> d.houses.firstOrNull { it.str("id") == mh.str("house_id") } }
    val tools = d.memberTools.filter { it.str("member_id") == id }.mapNotNull { mt -> d.tools.firstOrNull { it.str("id") == mt.str("tool_id") }?.str("name") }
    val tasks = d.tasks.filter { it.str("member_id") == id }.take(6)
    var ask by remember { mutableStateOf("") }
    CocoPanel { ModalBottomSheet(onDismissRequest = onClose, containerColor = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(horizontal = 22.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LivingMark(mark, 76.dp)
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(m.str("name"), style = MaterialTheme.typography.headlineMedium)
                    Muted(listOf(m.str("grp"), m.str("model").takeIf { it.isNotBlank() }?.let { "model $it" }).filterNotNull().filter { it.isNotBlank() }.joinToString(" · "))
                }
            }
            StatusChip(when (crew.state) { CrewState.Working -> "working"; CrewState.NeedsYes -> "needs_yes"; CrewState.Queued -> "queued"; CrewState.Resting -> "resting" },
                if (crew.state == CrewState.Resting) "Resting" else null)
            Card { Eyebrow("Job"); Text(m.str("job"), style = MaterialTheme.typography.bodyLarge) }
            if (crew.state != CrewState.Resting) Card(highlight = true) {
                Eyebrow("Now")
                Text(crew.line, style = MaterialTheme.typography.bodyLarge)
                if (crew.state == CrewState.Working) WavyLine(LocalCocoRoles.current.link, Modifier.fillMaxWidth(0.5f))
            }
            if (houses.isNotEmpty()) {
                Eyebrow("Houses")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    houses.forEach { h -> AssistChip({}, { Text(h.str("name")) }, leadingIcon = { LivingMark(Marks.houses[h.str("id")] ?: Marks.coco, 20.dp) }) }
                }
            }
            if (tools.isNotEmpty()) {
                Eyebrow("Tools")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    tools.take(12).forEach { SuggestionChip({}, { Text(it) }) }
                }
            }
            if (tasks.isNotEmpty()) {
                Eyebrow("Tasks")
                tasks.forEach { tk ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tk.str("title"), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                        StatusChip(tk.str("status"))
                    }
                }
            }
            Eyebrow("Ask ${m.str("name")}")
            OutlinedTextField(ask, { ask = it }, placeholder = { Text("What should ${m.str("name")} do?") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp))
            MuButton({
                if (ask.isNotBlank()) {
                    vm.submitTask(ask.trim(), "For ${m.str("name")} (asked from Coco HQ)", houses.firstOrNull()?.str("id") ?: "gigi", "any")
                    ask = ""; onClose()
                }
            }, enabled = ask.isNotBlank(), modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Send to Coco") }
        }
    } }
}

// ---------- live feed ----------

/** The newest things that happened, sliding in as they arrive. */
@Composable
fun FeedRow(e: JSONObject) {
    val actor = e.str("actor")
    val mark = Marks.members[actor.lowercase()] ?: if (actor.equals("Coco", true)) Marks.coco else null
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
        if (mark != null) CompositionLocalProvider(LocalCalm provides true) { LivingMark(mark, 36.dp) }
        else Surface(Modifier.size(36.dp), shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
            Box(contentAlignment = Alignment.Center) { Text(actor.take(1).uppercase(), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSecondaryContainer) }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("$actor · ${e.str("action")}", style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (e.str("detail").isNotBlank()) Muted(e.str("detail"), 2)
        }
        Spacer(Modifier.width(8.dp))
        Text(ago(e.str("at")), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
    }
}

/** Greeting by the clock: good morning / afternoon / evening, or a late-night one. */
fun greeting(hour: Int, callMe: String): String {
    val who = callMe.ifBlank { "Boss" }
    return when (hour) {
        in 5..11 -> "Good morning, $who"
        in 12..16 -> "Good afternoon, $who"
        in 17..21 -> "Good evening, $who"
        else -> "Still up, $who?"
    }
}

/** Refreshes a value every [ms] while on screen (for "x min ago" labels and greetings). */
@Composable
fun rememberTicker(ms: Long): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(ms) { while (true) { delay(ms); now = System.currentTimeMillis() } }
    return now
}

// ---------- team talk row (used in the Home list) ----------

/** One line of the team talking, like a chat message between teammates. */
@Composable
fun TalkRow(vm: Lounge, t: Talk) {
    val cs = MaterialTheme.colorScheme
    val fromMark = Marks.members[t.from.lowercase()] ?: if (t.from == "Coco") Marks.coco else null
    Surface(shape = RoundedCornerShape(18.dp), color = cs.surfaceContainerLow, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
            if (fromMark != null) CompositionLocalProvider(LocalCalm provides true) { LivingMark(fromMark, 34.dp) }
            else Surface(Modifier.size(34.dp), shape = androidx.compose.foundation.shape.CircleShape, color = cs.secondaryContainer) {
                Box(contentAlignment = Alignment.Center) { Text(t.from.take(1).uppercase(), color = cs.onSecondaryContainer, fontWeight = FontWeight.Bold) }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t.from, style = MaterialTheme.typography.titleSmall, color = LocalCocoRoles.current.link)
                    if (t.to != null) {
                        Text("  →  ", style = MaterialTheme.typography.titleSmall, color = cs.onSurfaceVariant)
                        Text(t.to, style = MaterialTheme.typography.titleSmall, color = cs.onSurfaceVariant)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(ago(t.atIso), style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant, maxLines = 1)
                }
                Text(t.text, style = MaterialTheme.typography.bodyMedium, color = cs.onSurface, maxLines = 4, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
