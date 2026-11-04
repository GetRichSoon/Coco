import { createHash } from 'node:crypto';
// Nova's AI door for routine cloud work that must not use Claude (Boss, 2026-11-03): today, Gemini.
//
// The key stays in the vault and is read here, used for one request and dropped. Generation is LOCKED by
// default: it runs only when a founder has set the company policy `gemini_generate` to true in Coco, after
// confirming the key's project is on the free tier (no billing). Exceeding the free tier returns 429 from
// Google; it never charges automatically, and no paid model is on the allowlist.
//
//   GET  /api/ai/gemini/models    the models this key can call (free: no tokens)
//   POST /api/ai/generate         { provider: 'gemini', model, system?, prompt, max_output_tokens?, purpose, task?,
//                                   run_id?, team?, agent? } -> { ok, text, usage, model, ai_call_id }
//
// Every generation is booked in ai_calls with the provider's own usage numbers (measured_by 'provider').
export const GEMINI_MODELS = new Set(['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-lite']);
export const DAILY_CAP = 40, MAX_OUTPUT = 8192, MAX_PROMPT_CHARS = 40000;
const API = 'https://generativelanguage.googleapis.com/v1beta';
const strip = (text, key) => String(text ?? '').split(key || '\u0000').join('[redacted]').replace(/key=[A-Za-z0-9_-]{10,}/g, 'key=[redacted]');

export async function handleAi(db, req, who, { json, log, fetch: f = globalThis.fetch, api = API }) {
  const engineKey = String(req.headers['x-engine-key'] || '');
  const ok = await db.query("SELECT EXISTS (SELECT 1 FROM public.engine_keys k WHERE k.active AND k.key_hash = encode(extensions.digest($1, 'sha256'), 'hex')) AS ok", [engineKey]).then((r) => r.rows[0]?.ok === true).catch(() => false);
  if (!engineKey || !ok) return json(403, { ok: false, state: 'AUTH_REQUIRED', reason: 'the AI door needs the cloud runtime (a live engine key) on a paired device' });
  let key = (await db.query("SELECT public.coco_secret('gemini_api_key') AS v")).rows[0]?.v || null;
  if (!key) return json(503, { ok: false, state: 'NOT_CONNECTED', reason: 'no Gemini key in the vault' });
  try {
    if (req.path === '/api/ai/gemini/models' && req.method === 'GET') {
      const r = await f(`${api}/models?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if (!r.ok) return json(r.status === 400 || r.status === 403 ? 409 : 502, { ok: false, state: 'PROVIDER_ERROR', status: r.status, reason: strip(text, key).slice(0, 300) });
      const models = (JSON.parse(text).models || []).map((m) => ({ name: String(m.name).replace(/^models\//, ''), generate: (m.supportedGenerationMethods || []).includes('generateContent'), input_limit: m.inputTokenLimit, output_limit: m.outputTokenLimit }));
      log(200, { device: who.device_id, ai: 'gemini models', n: models.length });
      return json(200, { ok: true, provider: 'gemini', models, allowlist: [...GEMINI_MODELS], allowlisted_available: models.filter((m) => GEMINI_MODELS.has(m.name) && m.generate).map((m) => m.name) });
    }
    if (req.path !== '/api/ai/generate' || req.method !== 'POST') return json(404, { message: 'not found' });
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (b.provider !== 'gemini') return json(400, { ok: false, state: 'ERROR', reason: 'provider must be gemini' });
    const pol = (await db.query("SELECT value FROM public.policies WHERE scope = 'company' AND key = 'gemini_generate' ORDER BY updated_at DESC LIMIT 1")).rows[0]?.value;
    if (pol !== true && pol?.enabled !== true) return json(403, { ok: false, state: 'LOCKED', reason: 'Gemini generation is locked until a founder confirms the key is on the free tier and sets the company policy gemini_generate to true in Coco' });
    if (!GEMINI_MODELS.has(b.model)) return json(400, { ok: false, state: 'ERROR', reason: `model must be one of ${[...GEMINI_MODELS].join(', ')}` });
    const prompt = String(b.prompt || ''); if (!prompt || prompt.length > MAX_PROMPT_CHARS) return json(400, { ok: false, state: 'ERROR', reason: `prompt must be 1-${MAX_PROMPT_CHARS} characters` });
    if (!String(b.purpose || '').trim()) return json(400, { ok: false, state: 'ERROR', reason: 'a generation needs a purpose' });
    const today = (await db.query("SELECT count(*)::int AS n FROM public.ai_calls WHERE provider = 'google' AND at >= date_trunc('day', now())")).rows[0]?.n || 0;
    if (today >= DAILY_CAP) return json(429, { ok: false, state: 'CAPPED', reason: `the daily cap of ${DAILY_CAP} Gemini calls is reached` });
    const maxOut = Math.min(MAX_OUTPUT, Math.max(256, Number(b.max_output_tokens) || 4096));
    const t0 = Date.now();
    const r = await f(`${api}/models/${encodeURIComponent(b.model)}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, signal: AbortSignal.timeout(110000),
      body: JSON.stringify({ ...(b.system ? { systemInstruction: { parts: [{ text: String(b.system).slice(0, 8000) }] } } : {}), contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxOut, temperature: 0.7, ...(b.json ? { responseMimeType: 'application/json' } : {}) } }) });
    const text = await r.text();
    const j = (() => { try { return JSON.parse(text); } catch { return null; } })();
    const u = j?.usageMetadata || {};
    const id = `AI-${new Date().toISOString().slice(0, 10)}-G${Date.now().toString(36)}`;
    const status = r.ok && j ? 'done' : 'failed';
    // ai_calls.run_id must be a known run: an unknown label (a GitHub run) is kept in the task text instead,
    // so the call is ALWAYS booked. A booking that fails is logged, never swallowed in silence.
    const known = b.run_id ? (await db.query('SELECT 1 FROM public.runs WHERE run_id = $1', [b.run_id]).then((x) => x.rows.length > 0).catch(() => false)) : false;
    if (b.run_id && !known) b.task = `${String(b.task || '')} [run ${b.run_id}]`;
    if (!known) b.run_id = null;
    const out = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    await db.query(`INSERT INTO public.ai_calls (id, at, status, run_id, team_id, agent_id, provider, model, purpose, expected_output, claude_required, max_tokens, input_tokens, output_tokens, reasoning_tokens, cache_read_tokens, total_tokens, cost, duration_ms, over_budget, measured_by, unverified, result_summary, done_at, requested_by, fingerprint)
      VALUES ($1, now(), $2, $3, $4, $5, 'google', $6, $7, $8, 'routine cloud writing: Gemini, not Claude (Boss 2026-11-03)', $9, $10, $11, $12, $13, $14, 0, $15, false, 'provider', false, $16, now(), $17, $18)`,
      [id, status, b.run_id || null, b.team || null, b.agent || null, b.model, String(b.purpose).slice(0, 60), String(b.task || '').slice(0, 300), maxOut, u.promptTokenCount || 0, u.candidatesTokenCount || 0, u.thoughtsTokenCount || 0, u.cachedContentTokenCount || 0, u.totalTokenCount || 0, Date.now() - t0, status === 'done' ? out.slice(0, 300) : strip(text, key).slice(0, 300), who.device_id,
        // the ledger's fingerprint is required: what was asked, of which model, for which purpose
        createHash('sha256').update(`${b.model}|${b.purpose}|${prompt}`).digest('hex').slice(0, 16)]).catch((e) => log(500, { ai: 'gemini', booking_failed: String(e.message).slice(0, 160) }));
    if (!r.ok || !j) { log(r.status, { device: who.device_id, ai: 'gemini', model: b.model, status: r.status }); return json(r.status === 429 ? 429 : 502, { ok: false, state: r.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_ERROR', status: r.status, reason: strip(text, key).slice(0, 300), ai_call_id: id }); }
    log(200, { device: who.device_id, ai: 'gemini', model: b.model, tokens: u.totalTokenCount || 0 });
    return json(200, { ok: true, provider: 'gemini', model: b.model, text: out, finish: j.candidates?.[0]?.finishReason || null, usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0, reasoning_tokens: u.thoughtsTokenCount || 0, cached_tokens: u.cachedContentTokenCount || 0, total_tokens: u.totalTokenCount || 0, measured_by: 'provider' }, ai_call_id: id, duration_ms: Date.now() - t0 });
  } catch (e) {
    return json(502, { ok: false, state: 'PROVIDER_ERROR', reason: strip(e?.message, key).slice(0, 300) });
  } finally { key = null; }
}
