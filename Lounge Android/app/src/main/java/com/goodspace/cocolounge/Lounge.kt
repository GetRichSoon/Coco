package com.goodspace.cocolounge

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate

/** Everything the Lounge shows, kept in step with Coco Cloud. One source of truth: the cloud. */
class Lounge(app: Application) : AndroidViewModel(app) {
    val cloud = Cloud(app)

    enum class Gate { SignIn, Pair, Open }
    var gate by mutableStateOf(if (!cloud.signedIn) Gate.SignIn else if (!cloud.paired) Gate.Pair else Gate.Open)
    var live by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var message by mutableStateOf<String?>(null)
    var founder by mutableStateOf<JSONObject?>(null)
    var data by mutableStateOf(Data())
    var dialog by mutableStateOf<Dialog?>(null)

    // Settings (this device only), same choices as every Lounge
    private val sp = app.getSharedPreferences("coco_settings", android.content.Context.MODE_PRIVATE)
    var theme by mutableStateOf(sp.getString("theme", "system")!!)
    var calm by mutableStateOf(sp.getBoolean("calm", false))
    fun setTheme(v: String) { theme = v; sp.edit().putString("theme", v).apply() }
    fun setCalm(v: Boolean) { calm = v; sp.edit().putBoolean("calm", v).apply() }
    fun notifyOn(kind: String) = sp.getBoolean("n_$kind", true)
    fun setNotify(kind: String, v: Boolean) { sp.edit().putBoolean("n_$kind", v).apply(); notifyTick++ }
    var notifyTick by mutableStateOf(0)
    fun refreshNow() = viewModelScope.launch { reload(); message = "Up to date" }

    data class Data(
        val houses: List<JSONObject> = emptyList(), val categories: List<JSONObject> = emptyList(), val offerings: List<JSONObject> = emptyList(),
        val platforms: List<JSONObject> = emptyList(), val members: List<JSONObject> = emptyList(), val memberHouses: List<JSONObject> = emptyList(),
        val tools: List<JSONObject> = emptyList(), val memberTools: List<JSONObject> = emptyList(), val tasks: List<JSONObject> = emptyList(),
        val notes: List<JSONObject> = emptyList(), val approvals: List<JSONObject> = emptyList(), val devices: List<JSONObject> = emptyList(),
        val decisions: List<JSONObject> = emptyList(), val activity: List<JSONObject> = emptyList(), val rules: List<JSONObject> = emptyList(),
    )
    sealed class Dialog {
        data class Merged(val title: String, val status: String, val device: String?, val by: String, val taskId: String) : Dialog()
        data class PairCode(val device: String, val code: String) : Dialog()
        data class AddPoints(val taskId: String, val title: String) : Dialog()
    }

    private var stopListening: (() -> Unit)? = null
    private var heartbeat: Job? = null
    private var reloadJob: Job? = null

    init { if (gate == Gate.Open) open() }

    val name get() = founder?.optString("name") ?: cloud.email.orEmpty()
    val callMe get() = founder?.optString("call_me").orEmpty()
    fun deviceName(id: String?) = data.devices.firstOrNull { it.optString("id") == id }?.optString("name") ?: id.orEmpty()
    fun houseName(id: String?) = data.houses.firstOrNull { it.optString("id") == id }?.optString("name") ?: "Coco"

    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private fun fail(e: Throwable) { message = e.message ?: "Something went wrong" }

    fun signIn(mail: String, pass: String) = viewModelScope.launch {
        busy = true
        try { cloud.signIn(mail.trim(), pass); gate = if (cloud.paired) Gate.Open else Gate.Pair; if (gate == Gate.Open) open() }
        catch (e: Exception) { message = if (e.message.orEmpty().contains("confirm", true)) "Open the confirmation email first, then sign in." else "Email or password is not right." }
        busy = false
    }

    fun signUp(mail: String, pass: String) = viewModelScope.launch {
        if (pass.length < 8) { message = "Use a password of 8 or more characters."; return@launch }
        busy = true
        try { cloud.signUp(mail.trim(), pass); message = "Done. Open the email from Supabase, tap the link, then sign in here." } catch (e: Exception) { fail(e) }
        busy = false
    }

    fun pair(code: String) = viewModelScope.launch {
        busy = true
        try { cloud.pair(code); gate = Gate.Open; message = "This phone is now one of the four"; open() }
        catch (e: Exception) { message = if (e.message.orEmpty().contains("expired")) "That code is wrong or expired." else e.message }
        busy = false
    }

    fun signOut() { stopListening?.invoke(); heartbeat?.cancel(); cloud.signOut(); gate = Gate.SignIn }

    private fun open() {
        viewModelScope.launch {
            try {
                val founders = cloud.list("founders")
                if (founders.length() == 0) { cloud.forgetDevice(); gate = Gate.Pair; message = "This phone is not paired (or was switched off). Pair it again with a new code."; return@launch }
                founder = founders.objects().firstOrNull { it.optString("email").equals(cloud.email, true) }
                reload()
                stopListening?.invoke()
                stopListening = cloud.listen(onPulse = { scheduleReload() }, onState = { ok -> live = ok; if (ok) scheduleReload() })
                heartbeat?.cancel()
                heartbeat = viewModelScope.launch { while (true) { beat(); delay(60_000) } }
            } catch (e: Cloud.CloudError) { if (e.code == 401) gate = Gate.SignIn else fail(e) } catch (e: Exception) { fail(e) }
        }
    }

    fun onResume() { if (gate == Gate.Open) viewModelScope.launch { beat(); reload() } }

    private suspend fun beat() { cloud.deviceId?.let { runCatching { cloud.update("devices", "id=eq.$it", JSONObject().put("last_seen", Instant.now().toString()).put("app_version", "android-1")) } } }

    private fun scheduleReload() { reloadJob?.cancel(); reloadJob = viewModelScope.launch { delay(350); reload() } }

    suspend fun reload() {
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
            )
            Alerts.compareAndNotify(getApplication(), data, d, name)
            data = d
        } catch (e: Exception) { fail(e) }
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

    fun decide(a: JSONObject, yes: Boolean) = viewModelScope.launch {
        try {
            cloud.update("approvals", "id=eq.${a.getString("id")}", JSONObject().put("state", if (yes) "approved" else "rejected").put("decided_by", name).put("decided_at", Instant.now().toString()))
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

    fun switchOff(deviceId: String) = viewModelScope.launch {
        if (deviceId == cloud.deviceId) return@launch
        try { cloud.update("devices", "id=eq.$deviceId", JSONObject().put("active", false)); log("device switched off", deviceId); reload() } catch (e: Exception) { fail(e) }
    }

    override fun onCleared() { stopListening?.invoke(); super.onCleared() }
}
