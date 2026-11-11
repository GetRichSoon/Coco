package com.goodspace.cocolounge

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate

/** Everything the Lounge shows, kept in step with Coco Cloud. One source of truth: the cloud. */
class Lounge(app: Application) : AndroidViewModel(app) {
    companion object {
        /** However little pulses, a full read still runs this often while the app is on screen, so
         *  the tables with no slice of their own can never be more than a minute stale to a founder
         *  who is looking. Same number as the web Lounge. */
        const val FULL_EVERY = 60_000L
        /** What a failed connection says on screen (an IOException's own text is a hostname and an errno). */
        const val NO_LINK = "No connection to Coco Cloud right now"
        /** The topics a single read can answer. Anything else means the full read - deliberately,
         *  because controls, policies, events and pipelines have no slice and must still arrive. */
        val SLICES = setOf("devices", "houses", "tasks", "approvals", "decisions", "rules", "activity", "commands")

        /** Whether this burst of pulses needs the whole company read back. Kept pure so the rule can
         *  be tested without an Android context, because one line of it is load-bearing: a topic
         *  with no slice takes the full read whether the app is on screen or not, which is how a
         *  company stop reaches a phone in someone's pocket. */
        fun needsFullRead(topics: List<String>, foreground: Boolean, sinceFull: Long) =
            topics.isEmpty() || topics.any { it !in SLICES } || (foreground && sinceFull > FULL_EVERY)
    }

    val cloud = Cloud(app)
    /** The one active COCO theme (six themes, light / dark, automatic rotation, synced through Coco Cloud). */
    val themes = ThemeController(app, cloud, viewModelScope)

    enum class Gate { SignIn, Pair, Open }
    var gate by mutableStateOf(if (!cloud.signedIn) Gate.SignIn else if (!cloud.paired) Gate.Pair else Gate.Open)
    var live by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var message by mutableStateOf<String?>(null)
    var founder by mutableStateOf<JSONObject?>(null)
    var data by mutableStateOf(Data())
    /** When the company was last read in full (0 = never on this run). Until then every count is unknown, not zero. */
    var dataAt by mutableStateOf(0L)
    var dialog by mutableStateOf<Dialog?>(null)

    // Settings (this device only), same choices as every Lounge
    private val sp = app.getSharedPreferences("coco_settings", android.content.Context.MODE_PRIVATE)
    var calm by mutableStateOf(sp.getBoolean("calm", false))
    fun chooseCalm(v: Boolean) { calm = v; sp.edit().putBoolean("calm", v).apply() }
    fun notifyOn(kind: String) = sp.getBoolean("n_$kind", true)
    fun setNotify(kind: String, v: Boolean) { sp.edit().putBoolean("n_$kind", v).apply(); notifyTick++ }
    var notifyTick by mutableStateOf(0)
    fun checkUpdate() = viewModelScope.launch { message = "Checking for update…"; message = Updater.checkNow(getApplication()) }
    val appVersion: String get() = runCatching { getApplication<android.app.Application>().let { a -> a.packageManager.getPackageInfo(a.packageName, 0).versionName } }.getOrDefault("?") ?: "?"
    fun refreshNow() = viewModelScope.launch { reload(); loadExtra(force = true); message = "Up to date" }

    data class Data(
        val houses: List<JSONObject> = emptyList(), val categories: List<JSONObject> = emptyList(), val offerings: List<JSONObject> = emptyList(),
        val platforms: List<JSONObject> = emptyList(), val members: List<JSONObject> = emptyList(), val memberHouses: List<JSONObject> = emptyList(),
        val tools: List<JSONObject> = emptyList(), val memberTools: List<JSONObject> = emptyList(), val tasks: List<JSONObject> = emptyList(),
        val notes: List<JSONObject> = emptyList(), val approvals: List<JSONObject> = emptyList(), val devices: List<JSONObject> = emptyList(),
        val decisions: List<JSONObject> = emptyList(), val activity: List<JSONObject> = emptyList(), val rules: List<JSONObject> = emptyList(),
        val chat: List<JSONObject> = emptyList(), val commands: List<JSONObject> = emptyList(), val controls: List<JSONObject> = emptyList(),
        val events: List<JSONObject> = emptyList(), val pipelines: List<JSONObject> = emptyList(),
        val integrations: List<JSONObject> = emptyList(),
        // Settings > Integrations & Connections (0041): every account with its authorization facts, and the cloud providers
        val accounts: List<JSONObject> = emptyList(), val cloudProviders: List<JSONObject> = emptyList(), val switches: List<JSONObject> = emptyList(),
        val agentMessages: List<JSONObject> = emptyList(),
    ) {
        val paused get() = controls.firstOrNull { it.optString("id") == "coco_paused" }?.optString("value") == "true"
    }
    sealed class Dialog {
        data class Merged(val title: String, val status: String, val device: String?, val by: String, val taskId: String) : Dialog()
        data class PairCode(val device: String, val code: String) : Dialog()
        data class AddPoints(val taskId: String, val title: String) : Dialog()
    }

    private var stopListening: (() -> Unit)? = null
    private var heartbeat: Job? = null
    private var reloadJob: Job? = null
    // A pulse names the one table that changed, so most changes do not need the whole company read
    // back. reload() is twenty-two queries; before this, every pulse of any topic took all of them,
    // foreground or not. Measured 2026-10-31: devices, houses, tasks, commands and activity are
    // 99.4% of all pulses, and `devices` alone is 56%.
    private val hot = mutableSetOf<String>()
    private var lastFull = 0L
    private var reloading = false
    private var reloadAgain = false

    init { if (gate == Gate.Open) open() }

    val name get() = founder?.optString("name") ?: cloud.email.orEmpty()
    val callMe get() = founder?.optString("call_me").orEmpty()
    fun deviceName(id: String?) = data.devices.firstOrNull { it.optString("id") == id }?.optString("name") ?: id.orEmpty()
    fun houseName(id: String?) = data.houses.firstOrNull { it.optString("id") == id }?.optString("name") ?: "Coco"

    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private fun fail(e: Throwable) { if (e is kotlinx.coroutines.CancellationException) return; message = if (e is java.io.IOException) NO_LINK else e.message ?: "Something went wrong" }

    fun pair(code: String) = viewModelScope.launch {
        busy = true
        try { cloud.pair(code); gate = Gate.Open; message = "This phone is now one of the four"; open() }
        catch (e: Exception) { message = if (e.message.orEmpty().contains("expired")) "That code is wrong or expired." else e.message }
        busy = false
    }

    /**
     * The only way a device gets in. One pairing code does everything: Coco Cloud reads which device
     * the code was made for, mints a real session for that device's owner and issues a fresh device
     * key. There is no email and no password anywhere in this path - the account password is lost, the
     * project has no SMTP, and a reset returns 429, so the code is the credential.
     *
     * This covers first pairing and getting back in after a reinstall with the same screen, because
     * they are the same act: the device id is not sent when there is none to send, and the code says
     * which device it belongs to.
     */
    fun connect(code: String) = viewModelScope.launch {
        busy = true
        try { cloud.recoverDevice(code); gate = Gate.Open; message = "This device is connected"; open() }
        catch (e: Exception) { message = e.message ?: "That pairing code did not work." }
        busy = false
    }

    fun signOut() { stopListening?.invoke(); heartbeat?.cancel(); cloud.signOut(); gate = Gate.SignIn }

    private fun open() {
        viewModelScope.launch {
            try {
                val founders = cloud.list("founders")
                if (founders.length() == 0) { cloud.forgetDevice(); gate = Gate.Pair; message = "This phone is not paired (or was switched off). Pair it again with a new code."; return@launch }
                founder = founders.objects().firstOrNull { it.optString("email").equals(cloud.email, true) }
                themes.configure()   // the founder's e-mail is known now: it names this account's theme row
                reload()
                stopListening?.invoke()
                // A reconnect is reported as "*": while the socket was down anything could have
                // changed, so that one takes the full read.
                stopListening = cloud.listen(onPulse = { topic -> quickCommands(); scheduleReload(topic) }, onState = { ok -> live = ok; if (ok) scheduleReload("*") })
                heartbeat?.cancel()
                heartbeat = viewModelScope.launch { var n = 0; while (true) { if (n % 12 == 0) beat(); if (!live) quickCommands(); n++; delay(5_000) } }
            } catch (e: Cloud.CloudError) { if (e.code == 401) gate = Gate.SignIn else fail(e) } catch (e: Exception) { fail(e) }
        }
    }

    fun onResume() { if (gate == Gate.Open) viewModelScope.launch { beat(); reload() } }

    /** Heartbeat with this phone's own live data (battery, storage, volume), so every device sees it. */
    private suspend fun beat() { cloud.deviceId?.let { runCatching {
        val info = JSONObject().put("summary", PhoneRemote.status(getApplication())).put("at", Instant.now().toString())
        cloud.update("devices", "id=eq.$it", JSONObject().put("last_seen", Instant.now().toString()).put("app_version", "android-" + runCatching { getApplication<android.app.Application>().let { a -> a.packageManager.getPackageInfo(a.packageName, 0).versionName } }.getOrDefault("?")).put("info", info)) } } }

    /** Fast path: on every cloud ping, fetch only the commands waiting for this phone and run them at once. */
    private fun quickCommands() {
        val me = cloud.deviceId ?: return
        viewModelScope.launch { runCatching { runMyCommands(cloud.list("commands", "select=*&target_device=eq.$me&status=eq.queued&order=created_at.asc").objects()) } }
    }

    /** Pulses arriving in the same breath are coalesced into one refresh, and what they named is
     *  kept so the refresh knows which tables to read. */
    private fun scheduleReload(topic: String) {
        synchronized(hot) { hot.add(topic) }
        reloadJob?.cancel()
        reloadJob = viewModelScope.launch {
            delay(350)
            refreshFor(synchronized(hot) { hot.toList().also { hot.clear() } })
        }
    }

    /** One read per changed table, with the same safety net as the web Lounge: a topic we have no
     *  slice for takes the full read, so controls, policies, events and pipelines keep propagating -
     *  that is how a company stop reaches this phone. The one-minute floor only applies in the
     *  foreground: with the app behind something there is no screen to keep fresh, and onResume()
     *  already does a full read the moment it comes back. Notifications are unaffected either way -
     *  approvals, tasks and activity each have a slice, and Alerts runs on every one of them. */
    private suspend fun refreshFor(topics: List<String>) {
        if (needsFullRead(topics, PhoneRemote.foreground, System.currentTimeMillis() - lastFull)) { reload(); return }
        for (t in topics) if (!slice(t)) { reload(); return }
    }

    /** Reads back the one table a pulse named. Returns false if anything went wrong, which is never
     *  a reason to keep showing old rows: the caller falls back to the full read. */
    private suspend fun slice(topic: String): Boolean = runCatching {
        val was = data
        data = when (topic) {
            "devices" -> was.copy(devices = cloud.list("devices", "select=*&order=id.asc").objects())
            "houses" -> was.copy(houses = cloud.list("houses", "select=*&order=sort.asc").objects())
            "tasks" -> was.copy(tasks = cloud.list("tasks", "select=*&order=created_at.desc").objects())
            "approvals" -> was.copy(approvals = cloud.list("approvals", "select=*&order=raised_on.desc").objects())
            "decisions" -> was.copy(decisions = cloud.list("decisions", "select=*&order=decided_on.desc").objects())
            "rules" -> was.copy(rules = cloud.list("rules", "select=*&order=updated_at.desc").objects())
            "activity" -> was.copy(activity = cloud.list("activity", "select=*&order=at.desc&limit=20").objects())
            "commands" -> was.copy(commands = cloud.list("commands", "select=*&order=created_at.desc&limit=30").objects())
            else -> return false
        }
        Alerts.compareAndNotify(getApplication(), was, data, name)
        if (topic == "commands") runMyCommands(data.commands)
        true
    }.getOrDefault(false)

    /** One full read at a time. onResume() and a pulse can land together, and two whole-company
     *  reads at once is the thing this change exists to stop; a change that arrives mid-read is
     *  picked up by the repeat below rather than lost. Same rule as the web Lounge. */
    suspend fun reload() {
        if (reloading) { reloadAgain = true; return }
        reloading = true
        try {
            readAll()
            while (reloadAgain) { reloadAgain = false; readAll() }
        } finally { reloading = false }
    }

    private suspend fun readAll() {
        try {
            val d = Data(
                houses = cloud.list("houses", "select=*&order=sort.asc").objects(),
                categories = cloud.list("categories", "select=*&order=code.asc").objects(),
                offerings = cloud.list("offerings", "select=*&order=name.asc").objects(),
                platforms = cloud.list("platforms", "select=*&order=sort.asc").objects(),
                members = cloud.list("members", "select=*&order=sort.asc").objects(),
                memberHouses = cloud.list("member_houses").objects(),
                tools = cloud.list("tools", "select=*&order=name.asc").objects(),
                memberTools = cloud.list("member_tools").objects(),
                tasks = cloud.list("tasks", "select=*&order=created_at.desc").objects(),
                notes = cloud.list("task_notes", "select=*&order=at.asc").objects(),
                approvals = cloud.list("approvals", "select=*&order=raised_on.desc").objects(),
                devices = cloud.list("devices", "select=*&order=id.asc").objects(),
                decisions = cloud.list("decisions", "select=*&order=decided_on.desc").objects(),
                activity = cloud.list("activity", "select=*&order=at.desc&limit=20").objects(),
                rules = cloud.list("rules", "select=*&order=updated_at.desc").objects(),
                chat = chatRows(),
                commands = cloud.list("commands", "select=*&order=created_at.desc&limit=30").objects(),
                controls = cloud.list("controls").objects(),
                events = cloud.list("events", "select=*&order=due_at.asc.nullsfirst").objects(),
                pipelines = cloud.list("pipelines", "select=*&order=house_id.asc").objects(),
                integrations = runCatching { cloud.list("integrations", "select=*&order=platform.asc").objects() }.getOrDefault(emptyList()),
                accounts = runCatching { cloud.list("integration_registry", "select=*&order=provider.asc").objects() }.getOrDefault(emptyList()),
                cloudProviders = runCatching { cloud.list("cloud_providers", "select=*&order=capability.asc").objects() }.getOrDefault(emptyList()),
                switches = runCatching { cloud.list("provider_switches", "select=*&order=created_at.desc&limit=10").objects() }.getOrDefault(emptyList()),
                agentMessages = runCatching { cloud.list("agent_messages", "select=*&order=at.desc&limit=40").objects() }.getOrDefault(emptyList()),
            )
            lastFull = System.currentTimeMillis()
            Alerts.compareAndNotify(getApplication(), data, d, name)
            data = d
            dataAt = System.currentTimeMillis()
            themes.adoptFromControls(d.controls)   // the controls rows are already in this read: a newer theme from another device shows at once
            runMyCommands(d.commands)
            if (PhoneRemote.foreground) loadExtra()
        } catch (e: Exception) { fail(e) }
    }

    /** Commands a PC sent to this phone: run each once, report the result back to the cloud. */
    private val handled = mutableSetOf<String>()
    private fun runMyCommands(list: List<JSONObject>) {
        val me = cloud.deviceId ?: return
        list.filter { it.optString("target_device") == me && it.optString("status") == "queued" && handled.add(Heal.runKey(it)) }.forEach { c ->
            viewModelScope.launch { Heal.runOne(getApplication(), cloud, c) }
        }
    }

    private suspend fun log(action: String, detail: String?) = runCatching {
        cloud.insert("activity", JSONObject().put("actor", name).put("device_id", cloud.deviceId).put("action", action).put("detail", detail))
    }

    /** Coco Cloud decides: the same open work in the same House is merged, never done twice. */
    fun submitTask(title: String, details: String?, house: String, needs: String) = viewModelScope.launch {
        try {
            val r = JSONObject(cloud.rpc("submit_task", JSONObject().put("p_title", title).put("p_details", details).put("p_house", house)
                .put("p_needs", needs).put("p_device", cloud.deviceId).put("p_by", name)))
            if (r.optBoolean("merged")) dialog = Dialog.Merged(r.optString("title"), r.optString("status"), r.optString("device").takeIf { it.isNotBlank() && it != "null" }, r.optString("by"), r.optString("task_id"))
            else message = "Sent to Coco"
            reload()
        } catch (e: Exception) { fail(e) }
    }

    fun stopTask(id: String, title: String) = viewModelScope.launch {
        try { cloud.update("tasks", "id=eq.$id", JSONObject().put("status", "stopped").put("updated_at", Instant.now().toString())); log("task stopped", title); reload() } catch (e: Exception) { fail(e) }
    }

    fun addPoints(id: String, text: String) = viewModelScope.launch {
        try { cloud.insert("task_notes", JSONObject().put("task_id", id).put("note", text).put("by_email", name).put("device_id", cloud.deviceId)); message = "Points added"; reload() } catch (e: Exception) { fail(e) }
    }

    /**
     * One approval exists in the cloud for all four devices, so the decision is taken, not written:
     * claim() moves the row only while it is still undecided, so a phone holding a card that another
     * founder device already answered changes nothing and says so. Before this it was a plain write
     * by id, which overwrote the record of who really pressed YES and could turn a rejected request
     * into an approved one.
     */
    fun decide(a: JSONObject, yes: Boolean) = viewModelScope.launch {
        try {
            val mine = cloud.claim("approvals", "id=eq.${a.getString("id")}&state=in.(waiting,on-hold)",
                JSONObject().put("state", if (yes) "approved" else "rejected").put("decided_by", name).put("decided_at", Instant.now().toString()))
            if (!mine) {
                reload()
                val now = data.approvals.firstOrNull { it.optString("id") == a.optString("id") }
                val who = now?.optString("decided_by").orEmpty().takeIf { it.isNotBlank() && it != "null" }
                message = "${a.optString("code")} was already ${now?.optString("state") ?: "decided"}" + (who?.let { " by $it" } ?: "")
                return@launch
            }
            cloud.insert("decisions", JSONObject().put("decided_on", LocalDate.now().toString()).put("by_name", name).put("text", "${if (yes) "YES" else "NO"} ${a.optString("code")}: ${a.optString("what").take(180)}"))
            log(if (yes) "approved" else "declined", a.optString("code")); message = if (yes) "YES saved" else "No saved"; reload()
        } catch (e: Exception) { fail(e) }
    }

    fun addRule(title: String, body: String) = viewModelScope.launch {
        try {
            val slug = title.lowercase().replace(Regex("[^a-z0-9]+"), " ").trim().split(" ").take(6).joinToString("_")
            cloud.insert("rules", JSONObject().put("id", "rule-$slug-${System.currentTimeMillis().toString(36)}").put("title", title).put("body", "$body\n\nSet by $name on ${LocalDate.now()}."))
            cloud.insert("decisions", JSONObject().put("decided_on", LocalDate.now().toString()).put("by_name", name).put("text", "New rule: $title. $body"))
            log("rule set", title); message = "Rule saved for all devices"; reload()
        } catch (e: Exception) { fail(e) }
    }

    fun makePairingCode(deviceId: String) = viewModelScope.launch {
        try {
            val letters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
            val rnd = java.security.SecureRandom()
            val code = (1..8).map { letters[rnd.nextInt(letters.length)] }.joinToString("")
            val hash = java.security.MessageDigest.getInstance("SHA-256").digest(code.toByteArray()).joinToString("") { "%02x".format(it) }
            cloud.insert("pairing_codes", JSONObject().put("code_hash", hash).put("device_id", deviceId).put("created_by", name))
            log("pairing code made", deviceId); dialog = Dialog.PairCode(deviceName(deviceId), code)
        } catch (e: Exception) { fail(e) }
    }

    fun switchOn(deviceId: String) = viewModelScope.launch {
        try { cloud.update("devices", "id=eq.$deviceId", JSONObject().put("active", true)); log("device switched on", deviceId); reload() } catch (e: Exception) { fail(e) }
    }
    fun switchOff(deviceId: String) = viewModelScope.launch {
        if (deviceId == cloud.deviceId) return@launch
        try { cloud.update("devices", "id=eq.$deviceId", JSONObject().put("active", false)); log("device switched off", deviceId); reload() } catch (e: Exception) { fail(e) }
    }

    // ---------------------------------------------------------------- Coco Chat
    // Which part of the company this phone is talking to (COCO, a team, ... an agent), and the company as
    // a tree to pick from. The thread for a scope is the same rows on all four devices; Nova answers it.
    var chatScope by mutableStateOf(sp.getString("chat_scope", "coco")!!)
    var chatTree by mutableStateOf<List<JSONObject>>(emptyList())
    var chatSending by mutableStateOf(false)
    val chatPath get() = ChatScope.path(chatScope, chatTree)
    private suspend fun chatRows() = cloud.list("chat", "select=*&scope=eq.${java.net.URLEncoder.encode(chatScope, "UTF-8")}&order=id.desc&limit=80").objects().reversed()
    private suspend fun chatLoad() { runCatching { chatRows() }.onSuccess { data = data.copy(chat = it) } }
    fun loadChatTree() = viewModelScope.launch {
        runCatching { JSONObject(cloud.api("/api/chat/tree")).getJSONArray("tree").objects() }.onSuccess { chatTree = it }
    }
    fun chatGo(key: String) = viewModelScope.launch {
        chatScope = key; sp.edit().putString("chat_scope", key).apply()
        data = data.copy(chat = emptyList()); chatLoad()
    }

    /** Chat with Coco: Nova runs the one engine for every device and writes both sides into the scope's thread. */
    fun sendChat(text: String) = viewModelScope.launch {
        chatSending = true
        try {
            val r = JSONObject(cloud.api("/api/chat", JSONObject().put("scope", chatScope).put("body", text)))
            // a part that no longer exists lands one level up: follow the cloud, never keep a dead key
            r.optString("scope").takeIf { it.isNotBlank() && it != chatScope }?.let { chatScope = it; sp.edit().putString("chat_scope", it).apply() }
            chatLoad()
            if (r.optJSONObject("reply")?.optJSONObject("meta")?.optString("state") == "Completed") reload()
            if (r.optBoolean("tree_changed")) loadChatTree()                       // new parts show in the picker at once
            r.optString("goto").takeIf { it.isNotBlank() && it != "null" && it != chatScope }?.let { chatGo(it) }   // "go to YouTube Studio"
        } catch (e: Exception) {
            // a Nova without the chat route yet: the old way, into the company thread
            if (e is Cloud.CloudError && e.code == 404) runCatching {
                cloud.insert("chat", JSONObject().put("role", "founder").put("author", name).put("device_id", cloud.deviceId).put("body", text)); reload()
            }.onFailure { fail(it) } else fail(e)
        } finally { chatSending = false }
    }

    /** PC Control mode: send a fixed command to one PC; its Coco Lounge app runs it and reports back. */
    fun sendCommand(target: String, action: String, args: JSONObject = JSONObject()) = viewModelScope.launch {
        try {
            cloud.insert("commands", JSONObject().put("target_device", target).put("action", action).put("args", args).put("created_by", name).put("created_device", cloud.deviceId))
            log("pc command sent", "$action to ${deviceName(target)}"); message = "Sent to ${deviceName(target)}"; reload()
        } catch (e: Exception) { fail(e) }
    }

    /** Emergency switch: pause or resume all of Coco's work on every device and in the cloud. */
    /** A founder approves or rolls back a cloud provider switch. The database re-checks the founder, this paired phone,
     *  the verified backup and the passing checks itself (0041 coco_provider_switch); this only asks and reports. */
    fun providerSwitch(op: String, id: String) = viewModelScope.launch {
        try {
            cloud.rpc("coco_provider_switch", JSONObject().put("p_op", op).put("p_id", id))
            log("provider switch $op", id); message = if (op == "approve") "Cut-over approved" else "Switch rolled back"; reload()
        } catch (e: Exception) { fail(e) }
    }

    fun setPaused(paused: Boolean) = viewModelScope.launch {
        try {
            cloud.update("controls", "id=eq.coco_paused", JSONObject().put("value", paused).put("updated_by", name).put("updated_at", Instant.now().toString()))
            log(if (paused) "coco paused" else "coco resumed", name); message = if (paused) "Coco paused everywhere" else "Coco is working again"; reload()
        } catch (e: Exception) { fail(e) }
    }

    // ---------------------------------------------------------------- the redesigned pages (2.11)
    /** One read for a redesigned page: its rows, or the honest reason there are none. */
    data class Rows(val rows: List<JSONObject> = emptyList(), val error: String? = null, val missing: Boolean = false, val loaded: Boolean = false)
    var ext by mutableStateOf<Map<String, Rows>>(emptyMap())
    fun rows(key: String) = ext[key] ?: Rows()
    private var extAt = 0L
    private var extBusy = false
    /** Tables the new pages read (same queries as the web Lounge). Read at most once a minute, and only with the app on
     *  screen, so the company read every pulse stays as small as before. */
    private val EXTRA = mapOf(
        "notes" to "select=*&order=created_at.desc", "runs" to "select=*&order=opened_at.desc&limit=60", "run_events" to "select=*&order=at.asc&limit=600",
        "ai_calls" to "select=*&order=at.desc&limit=200", "brain_items" to "select=*&retired=eq.false&order=created_at.desc&limit=200",
        "brain_records_latest" to "select=*&order=at.desc&limit=500", "org_units" to "select=*", "org_products" to "select=*", "org_agents" to "select=*",
        "org_brains" to "select=*", "org_refs" to "select=*", "org_metrics" to "select=*", "policies" to "select=*", "control_ops" to "select=*&order=at.desc&limit=60",
        "releases" to "select=*&order=created_at.desc&limit=5", "jobs" to "select=id,team_id,type,status,attempt,max_attempts,created_at,run_after&order=created_at.desc&limit=500",
        "integration_accounts" to "select=*&order=provider.asc", "integration_links" to "select=*", "outputs" to "select=*&order=at.desc&limit=300",
    )
    /** Nova's own read routes, kept in the same map: key to (path, array field or null for the whole object). */
    private val NOVA_READS = mapOf("yt" to ("/api/youtube/latest" to null), "templates" to ("/api/automation/templates" to "templates"), "prompts" to ("/api/automation/prompts" to "prompts"))

    private var extAgain = false
    fun loadExtra(force: Boolean = false) {
        if (extBusy) { if (force) extAgain = true; return }   // a write during a read: read once more after it, never lose it
        if (!force && System.currentTimeMillis() - extAt < FULL_EVERY) return
        extBusy = true
        viewModelScope.launch {
            try {
                val got = EXTRA.map { (t, q) -> t to async { readRows { cloud.list(t, q).objects() } } } +
                    NOVA_READS.map { (k, v) -> k to async { readRows { JSONObject(cloud.api(v.first)).let { o -> v.second?.let { f -> o.optJSONArray(f)?.objects().orEmpty() } ?: listOf(o) } } } }
                ext = got.associate { (k, d) -> k to d.await() }
                extAt = System.currentTimeMillis()
            } finally { extBusy = false }
            if (extAgain) { extAgain = false; loadExtra(force = true) }
        }
    }
    private suspend fun readRows(read: suspend () -> List<JSONObject>): Rows = try { Rows(read(), loaded = true) } catch (e: Exception) {
        if (e is kotlinx.coroutines.CancellationException) throw e
        val code = (e as? Cloud.CloudError)?.code ?: 0
        Rows(error = if (e is java.io.IOException) NO_LINK.replaceFirstChar { it.lowercase() } else e.message ?: "could not be read", missing = Facts.isMissing(code, e.message), loaded = true)
    }

    /** Notes tab: exactly the web insert (kind link when the text holds a link, status new, who and which device). */
    fun addNote(text: String) = viewModelScope.launch {
        try {
            val url = Regex("https?://\\S+").find(text)?.value
            cloud.insert("notes", JSONObject().put("kind", if (url != null) "link" else "note").put("source_url", url ?: JSONObject.NULL).put("text", text)
                .put("status", "new").put("created_by", name).put("device_id", cloud.deviceId))
            message = if (url != null) "Link kept — Coco will study it" else "Kept"; loadExtra(force = true)
        } catch (e: Exception) { fail(e) }
    }

    /** A control change, the same call as the web's control(): the database checks founder + device and may ask for a YES. */
    fun control(scope: String, id: String, key: String, value: Any, note: String? = null) = viewModelScope.launch {
        try {
            val r = cloud.rpc("coco_control", JSONObject().put("p_scope", scope).put("p_scope_id", id.ifBlank { "*" }).put("p_key", key).put("p_value", value).put("p_note", note ?: JSONObject.NULL))
            val o = runCatching { JSONObject(r) }.getOrNull()
            message = if (o?.optString("state") == "needs_approval") "Raised for your YES (${o.optString("approval_code")})" else "Done"
            reload(); loadExtra(force = true)
        } catch (e: Exception) { fail(e) }
    }

    /** Connect a platform account: Nova returns the platform's consent page, which opens in the browser. The token never
     *  comes to this phone; it lands in Coco Cloud. Same body as the web's novaOauth('begin'). */
    fun oauthBegin(provider: String, connection: String, open: (String) -> Unit) = viewModelScope.launch {
        try {
            val body = JSONObject().put("provider", provider).put("connection_id", connection)
            if (provider == "gumroad") body.put("team", "ebooks").put("subteam", "ebooks/practical-skills")   // the web's OAUTH_PLATFORMS.gumroad
            val url = JSONObject(cloud.api("/api/oauth/begin", body)).optString("authorize_url")
            if (url.startsWith("https://")) open(url) else message = "Coco did not return an authorization link"
        } catch (e: Exception) { fail(e) }
    }

    /** Verify asks the platform from the cloud (web's novaOauth('verify')); this only shows the verdict. */
    fun oauthVerify(connection: String) = viewModelScope.launch {
        try {
            message = "Asking the platform…"
            val r = JSONObject(cloud.api("/api/oauth/verify", JSONObject().put("connection_id", connection)))
            message = "${VERIFY_SAID[r.optString("status")] ?: r.optString("status")}: ${r.optString("detail")}".take(220); loadExtra(force = true)
        } catch (e: Exception) { fail(e) }
    }
    private val VERIFY_SAID = mapOf("CONNECTED_VERIFIED" to "Verified from the cloud", "NOT_ASSIGNED" to "Verified — assignment required",
        "CONNECTED_WRONG_CHANNEL" to "Wrong channel — not safe to publish", "CONNECTED_EXPIRED" to "Authorization expired — reconnect",
        "CONNECTED_MISSING_PERMISSION" to "Missing a permission", "NOT_CONNECTED" to "Not connected to the cloud", "CANNOT_CHECK" to "No cloud check for this platform yet")

    override fun onCleared() { stopListening?.invoke(); super.onCleared() }
}
