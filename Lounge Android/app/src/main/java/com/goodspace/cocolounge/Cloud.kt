package com.goodspace.cocolounge

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.TimeUnit

/** Coco Cloud connection: founder sign-in, this device's key, REST calls and the live pulse. */
class Cloud(context: Context) {
    companion object {
        const val URL = "https://bfnhnkxvppqmklfpslfm.supabase.co"
        const val KEY = "sb_publishable_had-6h5KG1epTVwISeuWbg_IKg7IO1s"
        private val JSON = "application/json".toMediaType()
        /** Nova (2026-11-02): the control API the apps talk to instead of the database gateway. It speaks the
         *  same PostgREST paths, authenticates by this device's key alone (no founder session needed) and serves
         *  from its cache; the live pulse becomes a 15 s poll of one tiny row. Blank = talk to the gateway directly. */
        const val NOVA = "https://cocolounge.vercel.app"
        val viaNova get() = NOVA.isNotBlank()
    }

    private val prefs = context.getSharedPreferences("coco_lounge", Context.MODE_PRIVATE)
    private val http = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).pingInterval(25, TimeUnit.SECONDS).build()

    var accessToken: String? get() = prefs.getString("access", null); set(v) = prefs.edit().putString("access", v).apply()
    var refreshToken: String? get() = prefs.getString("refresh", null); set(v) = prefs.edit().putString("refresh", v).apply()
    var expiresAt: Long get() = prefs.getLong("expires", 0); set(v) = prefs.edit().putLong("expires", v).apply()
    var email: String? get() = prefs.getString("email", null); set(v) = prefs.edit().putString("email", v).apply()
    var deviceKey: String? get() = prefs.getString("device_key", null); set(v) = prefs.edit().putString("device_key", v).apply()
    var deviceId: String? get() = prefs.getString("device_id", null); set(v) = prefs.edit().putString("device_id", v).apply()

    val signedIn get() = refreshToken != null || (viaNova && deviceKey != null)
    val paired get() = deviceKey != null

    class CloudError(message: String, val code: Int = 0) : Exception(message)

    private fun Response.bodyOrThrow(): String {
        val text = body?.string().orEmpty()
        if (!isSuccessful) {
            val msg = runCatching { JSONObject(text).let { it.optString("msg", it.optString("message", it.optString("error_description", it.optString("error", text)))) } }.getOrDefault(text)
            throw CloudError(msg.ifBlank { "Coco Cloud error $code" }, code)
        }
        return text
    }

    private fun saveSession(o: JSONObject) {
        accessToken = o.getString("access_token")
        refreshToken = o.getString("refresh_token")
        expiresAt = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000
        email = o.optJSONObject("user")?.optString("email") ?: email
    }

    fun signOut() { prefs.edit().remove("access").remove("refresh").remove("expires").apply() }
    fun forgetDevice() { prefs.edit().remove("device_key").remove("device_id").apply() }

    /** Keeps the login fresh; called before every request. */
    suspend fun token(): String = withContext(Dispatchers.IO) {
        if (accessToken != null && System.currentTimeMillis() < expiresAt - 60_000) return@withContext accessToken!!
        val rt = refreshToken ?: throw CloudError("Please sign in", 401)
        val body = JSONObject().put("refresh_token", rt).toString().toRequestBody(JSON)
        val r = http.newCall(Request.Builder().url("$URL/auth/v1/token?grant_type=refresh_token").header("apikey", KEY).post(body).build()).execute()
        try { saveSession(JSONObject(r.bodyOrThrow())) } catch (e: CloudError) { if (e.code in 400..401) signOut(); throw e }
        accessToken!!
    }

    private suspend fun request(path: String, method: String = "GET", body: String? = null, prefer: String? = null): String = withContext(Dispatchers.IO) {
        val b = if (viaNova) Request.Builder().url("$NOVA/rest/v1/$path")
                else Request.Builder().url("$URL/rest/v1/$path").header("apikey", KEY).header("Authorization", "Bearer ${token()}")
        deviceKey?.let { b.header("x-device-key", it) }
        prefer?.let { b.header("Prefer", it) }
        when (method) {
            "GET" -> b.get()
            else -> b.method(method, (body ?: "{}").toRequestBody(JSON))
        }
        http.newCall(b.build()).execute().bodyOrThrow()
    }

    suspend fun list(table: String, query: String = "select=*"): JSONArray = JSONArray(request("$table?$query").ifBlank { "[]" })
    suspend fun insert(table: String, row: JSONObject) { request(table, "POST", row.toString(), "return=minimal") }
    suspend fun update(table: String, filter: String, row: JSONObject) { request("$table?$filter", "PATCH", row.toString(), "return=minimal") }
    /** Takes a row only if the filter still matches; true = this device won it (no double runs). */
    suspend fun claim(table: String, filter: String, row: JSONObject): Boolean = JSONArray(request("$table?$filter", "PATCH", row.toString(), "return=representation").ifBlank { "[]" }).length() > 0
    suspend fun rpc(name: String, args: JSONObject): String = request("rpc/$name", "POST", args.toString())

    /**
     * Gets this device back in with a one-time recovery code, for the case the ordinary reset cannot
     * cover: the account password is forgotten and the reset email is unusable. Coco Cloud checks the
     * code server side and hands back a real session plus a fresh device key, so is_founder() and
     * device_ok() keep working exactly as after a normal sign-in. Nothing secret for this lives in the
     * app - the code the founder gives is the whole credential, and it is good once.
     *
     * The device id is sent only when this install still knows it. After a reinstall it does not, and
     * that is the main reason recovery exists, so the code itself names the device it belongs to.
     */
    suspend fun recoverDevice(code: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().put("code", code.trim().uppercase())
            .also { b -> deviceId?.let { b.put("device_id", it) } }
            .toString().toRequestBody(JSON)
        val r = http.newCall(Request.Builder().url("$URL/functions/v1/device-recover")
            .header("apikey", KEY).post(body).build()).execute()
        val o = JSONObject(r.bodyOrThrow())
        accessToken = o.getString("access_token")
        refreshToken = o.getString("refresh_token")
        expiresAt = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000
        email = o.optString("email").ifBlank { email }
        deviceKey = o.getString("device_key")
        deviceId = o.getString("device_id")
        deviceId!!
    }

    /** Pairs this phone with a one-time code. The secret key never leaves the phone; only its hash is stored in the cloud. */
    suspend fun pair(code: String): String {
        val raw = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val key = raw.joinToString("") { "%02x".format(it) }
        val id = rpc("pair_device", JSONObject().put("p_code", code.trim().uppercase()).put("p_device_key", key)).trim().trim('"')
        deviceKey = key; deviceId = id
        return id
    }

    /** Live pulse: any change in Coco Cloud arrives here within a second. Reconnects on its own. */
    /** onPulse is given the pulse row's `topic` - the name of the table that changed - so a caller
     *  can read back just that one table instead of the whole company. A payload we cannot read the
     *  topic out of is reported as "*", which every caller must treat as "something changed". */
    /** Who this device belongs to, from Nova; remembered so the screens have a name without a session. */
    suspend fun me(): JSONObject = withContext(Dispatchers.IO) {
        val b = Request.Builder().url("$NOVA/api/me"); deviceKey?.let { b.header("x-device-key", it) }
        JSONObject(http.newCall(b.get().build()).execute().bodyOrThrow()).also { it.optString("email").takeIf { e -> e.isNotBlank() }?.let { e -> email = e } }
    }

    fun listen(onPulse: (String) -> Unit, onState: (Boolean) -> Unit): () -> Unit {
        var socket: WebSocket? = null
        var closed = false
        if (viaNova) {
            // one tiny signal every 15 s; a changed version names the topic to refresh, nothing else is read
            var version: String? = null
            Thread {
                while (!closed) {
                    try {
                        val b = Request.Builder().url("$NOVA/api/changes"); deviceKey?.let { b.header("x-device-key", it) }
                        val o = JSONObject(http.newCall(b.get().build()).execute().bodyOrThrow())
                        onState(true)
                        val v = o.optString("version"); if (version != null && v != version) onPulse(o.optString("last_topic").ifBlank { "*" }); version = v
                    } catch (_: Exception) { onState(false) }
                    Thread.sleep(15_000)
                }
            }.start()
            return { closed = true }
        }
        var ref = 1
        fun connect() {
            if (closed) return
            val req = Request.Builder().url("${URL.replace("https", "wss")}/realtime/v1/websocket?apikey=$KEY&vsn=1.0.0").build()
            socket = http.newWebSocket(req, object : WebSocketListener() {
                override fun onOpen(ws: WebSocket, response: Response) {
                    val join = JSONObject().put("topic", "realtime:pulse").put("event", "phx_join").put("ref", (ref++).toString())
                        .put("payload", JSONObject()
                            .put("config", JSONObject().put("postgres_changes", JSONArray().put(JSONObject().put("event", "INSERT").put("schema", "public").put("table", "pulse"))))
                            .put("access_token", accessToken))
                    ws.send(join.toString())
                    Thread {
                        while (!closed && socket === ws) {
                            Thread.sleep(25_000)
                            ws.send(JSONObject().put("topic", "phoenix").put("event", "heartbeat").put("payload", JSONObject()).put("ref", (ref++).toString()).toString())
                        }
                    }.start()
                }
                override fun onMessage(ws: WebSocket, text: String) {
                    val m = runCatching { JSONObject(text) }.getOrNull() ?: return
                    when (m.optString("event")) {
                        "phx_reply" -> if (m.optJSONObject("payload")?.optString("status") == "ok" && m.optString("topic") == "realtime:pulse") onState(true)
                        "postgres_changes" -> onPulse(
                            m.optJSONObject("payload")?.optJSONObject("data")?.optJSONObject("record")
                                ?.optString("topic")?.takeIf { it.isNotBlank() } ?: "*")
                    }
                }
                override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) { onState(false); retry() }
                override fun onClosed(ws: WebSocket, code: Int, reason: String) { onState(false); retry() }
            })
        }
        fun retryLater() { Thread { Thread.sleep(3_000); connect() }.start() }
        retry = { if (!closed) retryLater() }
        connect()
        return { closed = true; socket?.close(1000, "bye") }
    }
    private var retry: () -> Unit = {}
}
