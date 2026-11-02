// Nova: the control API the Coco apps talk to instead of the database gateway.
//
//   app (x-device-key) -> Nova -> cache -> Postgres (direct, through the pooler) -> small JSON back
//
// It speaks the PostgREST subset the apps already use, so a client changes its base URL and nothing
// else. Security is the database's own: Nova verifies the device key hash against `devices`, then
// runs every statement as role `authenticated` with the same request.jwt.claims and request.headers
// PostgREST would have set, so RLS, is_founder() and device_ok() decide exactly as before. The
// database password lives only in Nova's environment; the apps never see it.
//
// Env: DATABASE_URL (pooler connection string, transaction mode), NOVA_CACHE_SECONDS (15),
//      NOVA_RATE_PER_MINUTE (120), NOVA_STATEMENT_TIMEOUT_MS (5000)
import { createHash } from 'node:crypto';
import { handlePublish } from './_publish.js';
// test seams: a stand-in fetch and provider hosts for the publishing layer
export const deps = { fetch: (...a) => globalThis.fetch(...a), publishUrls: {} };

const IDENT = /^[a-z_][a-z0-9_]*$/;
export const TABLES = new Set(['houses', 'categories', 'offerings', 'platforms', 'members', 'member_houses', 'tools', 'member_tools', 'tasks', 'task_notes', 'approvals', 'devices',
  'decisions', 'activity', 'founders', 'rules', 'commands', 'integrations', 'agent_messages', 'notes', 'releases', 'runs', 'run_events', 'ai_calls', 'brain_items', 'policies',
  'control_ops', 'structure', 'integration_accounts', 'integration_links', 'outputs', 'pairing_codes', 'chat', 'controls', 'pipelines', 'pulse', 'jobs',
  'events', 'templates', 'template_uses', 'capabilities', 'capability_uses', 'run_requests', 'yt_stats']);   // every public table except engine_keys and oauth_states
export const RPCS = new Set(['pair_device', 'submit_task', 'coco_brain', 'coco_request_run', 'coco_structure', 'coco_oauth_begin', 'coco_control', 'coco_connection', 'claim_task', 'similar_open_tasks', 'coco_job_status',
  // the cloud runtime's own functions: each one re-checks the engine key itself (private.engine_ok), so a paired device without that header is refused by Postgres, not trusted by Nova
  'coco_job_submit', 'coco_job_claim', 'coco_job_heartbeat', 'coco_job_done', 'coco_job_fail', 'coco_job_recover', 'coco_job_cancel', 'coco_job_block', 'coco_claim_output', 'coco_approval', 'pair_cloud_worker',
  // the publisher asks the company which channel a video belongs to; it never asks Nova for a credential (coco_publish_secret stays off this list)
  'coco_publish_target']);
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };
const CACHE_S = Number(process.env.NOVA_CACHE_SECONDS || 15);
const RATE = Number(process.env.NOVA_RATE_PER_MINUTE || 120);
const TIMEOUT = Number(process.env.NOVA_STATEMENT_TIMEOUT_MS || 5000);

export class NovaError extends Error { constructor(status, message) { super(message); this.status = status; } }
const q = (id) => { if (!IDENT.test(id)) throw new NovaError(400, `bad identifier ${id}`); return `"${id}"`; };
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

// ---------------------------------------------------------------- PostgREST subset -> SQL
// value literal: PostgREST sends raw text; `null`, `true`, `false` and numbers keep their type
const lit = (params, v) => { params.push(v === 'null' ? null : v); return `$${params.length}`; };
function where(params, key, raw) {
  let neg = false, spec = String(raw);
  if (spec.startsWith('not.')) { neg = true; spec = spec.slice(4); }
  const dot = spec.indexOf('.'); if (dot < 0) throw new NovaError(400, `bad filter ${key}=${raw}`);
  const op = spec.slice(0, dot), val = spec.slice(dot + 1);
  let sql;
  if (op in OPS) sql = `${q(key)} ${OPS[op]} ${lit(params, val)}`;
  else if (op === 'is') { if (!['null', 'true', 'false'].includes(val)) throw new NovaError(400, 'is. takes null/true/false'); sql = `${q(key)} IS ${val.toUpperCase()}`; }
  else if (op === 'in') { const items = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')); sql = `${q(key)} IN (${items.map((i) => lit(params, i)).join(', ')})`; }
  else throw new NovaError(400, `unsupported operator ${op}`);
  return neg ? `NOT (${sql})` : sql;
}
function orGroup(params, raw) {
  // or=(a.eq.1,b.is.null) -> (a = $1 OR b IS NULL); nested groups are not supported, the apps do not use them
  const body = String(raw).replace(/^\(|\)$/g, '');
  const parts = []; let depth = 0, cur = '';
  for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  if (cur) parts.push(cur);
  return '(' + parts.map((p) => { const i = p.indexOf('.'); return where(params, p.slice(0, i), p.slice(i + 1)); }).join(' OR ') + ')';
}
export function buildSelect(table, query) {
  const params = [], conds = [];
  const cols = (query.select && query.select !== '*') ? query.select.split(',').map((c) => q(c.trim())).join(', ') : '*';
  for (const [k, v] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (k === 'or') conds.push(orGroup(params, v)); else conds.push(where(params, k, v));
  }
  let sql = `SELECT ${cols} FROM public.${q(table)}`;
  if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
  if (query.order) sql += ' ORDER BY ' + String(query.order).split(',').map((o) => { const [c, d = 'asc', n] = o.split('.'); if (!['asc', 'desc'].includes(d) || (n && !['nullsfirst', 'nullslast'].includes(n))) throw new NovaError(400, `bad order ${o}`); return `${q(c)} ${d.toUpperCase()}${n === 'nullsfirst' ? ' NULLS FIRST' : n === 'nullslast' ? ' NULLS LAST' : ''}`; }).join(', ');
  if (query.limit) sql += ` LIMIT ${Math.max(0, Math.min(1000, parseInt(query.limit, 10) || 0))}`;
  if (query.offset) sql += ` OFFSET ${Math.max(0, parseInt(query.offset, 10) || 0)}`;
  return { sql, params };
}
export function buildWrite(table, method, query, body, prefer = '') {
  const params = [], conds = [];
  for (const [k, v] of Object.entries(query)) { if (['select', 'order', 'limit', 'offset'].includes(k)) continue; if (k === 'or') conds.push(orGroup(params, v)); else conds.push(where(params, k, v)); }
  const returning = /return=representation/.test(prefer) ? ' RETURNING *' : '';
  if (method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length || typeof rows[0] !== 'object') throw new NovaError(400, 'insert needs an object or an array of objects');
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const values = rows.map((r) => '(' + keys.map((k) => { params.push(r[k] === undefined ? null : typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : r[k]); return `$${params.length}`; }).join(', ') + ')').join(', ');
    return { sql: `INSERT INTO public.${q(table)} (${keys.map(q).join(', ')}) VALUES ${values}${returning}`, params };
  }
  if (method === 'PATCH') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NovaError(400, 'update needs an object');
    if (!conds.length) throw new NovaError(400, 'an update needs a filter');
    const sets = Object.entries(body).map(([k, v]) => { params.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v); return `${q(k)} = $${params.length}`; });
    return { sql: `UPDATE public.${q(table)} SET ${sets.join(', ')} WHERE ${conds.join(' AND ')}${returning}`, params };
  }
  if (method === 'DELETE') { if (!conds.length) throw new NovaError(400, 'a delete needs a filter'); return { sql: `DELETE FROM public.${q(table)} WHERE ${conds.join(' AND ')}${returning}`, params }; }
  throw new NovaError(405, `${method} is not supported`);
}
export function buildRpc(name, args = {}) {
  if (!RPCS.has(name)) throw new NovaError(404, `no such function ${name}`);
  const params = [];
  // an array of scalars is a Postgres array (text[] for the queue's type lists); any other object is jsonb
  const named = Object.entries(args || {}).map(([k, v]) => { const arr = Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object'); params.push(v !== null && typeof v === 'object' && !arr ? JSON.stringify(v) : v); return `${q(k)} => $${params.length}${v !== null && typeof v === 'object' && !arr ? '::jsonb' : ''}`; });
  return { sql: `SELECT to_jsonb(r) AS value FROM public.${q(name)}(${named.join(', ')}) AS r`, params };
}

// ---------------------------------------------------------------- the per-request work
const cache = new Map();                      // key -> { at, status, body }
const buckets = new Map();                    // device id -> { tokens, at }
const authCache = new Map();                  // key hash -> { at, who }
export const stats = { requests: 0, cache_hits: 0, cache_misses: 0, db_calls: 0, bytes_out: 0, errors: 0, started: Date.now() };
// what the last 200 requests cost, so the slow ones can be named without the platform's logs
const recent = [];
export function observe(path, ms, extra = {}) { recent.push({ path, ms, ...extra }); if (recent.length > 200) recent.shift(); }
export function timings() {
  const ms = recent.map((r) => r.ms).sort((a, b) => a - b); const q = (p) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : null;
  return { sample: ms.length, p50_ms: q(0.5), p95_ms: q(0.95), max_ms: ms.at(-1) ?? null, slow: recent.filter((r) => r.ms >= 2000).slice(-10), by_path: Object.entries(recent.reduce((m, r) => { (m[r.path] ||= []).push(r.ms); return m; }, {})).map(([p, l]) => ({ path: p, n: l.length, avg_ms: Math.round(l.reduce((a, b) => a + b, 0) / l.length) })).sort((a, b) => b.n - a.n).slice(0, 12) };
}

export function rateOk(id, now = Date.now()) {
  const b = buckets.get(id) || { tokens: RATE, at: now };
  b.tokens = Math.min(RATE, b.tokens + ((now - b.at) / 60000) * RATE); b.at = now;
  if (b.tokens < 1) { buckets.set(id, b); return false; }
  b.tokens -= 1; buckets.set(id, b); return true;
}

// Who is calling: the device key hash must match an active device whose owner is a founder.
export async function authenticate(db, deviceKey, now = Date.now()) {
  if (!deviceKey || String(deviceKey).length < 16) throw new NovaError(401, 'no device key');
  const h = sha256(deviceKey);
  const hit = authCache.get(h); if (hit && now - hit.at < 60000) return hit.who;
  const r = await db.query(`SELECT d.id, d.owner_email, d.name FROM public.devices d JOIN public.founders f ON lower(f.email) = lower(d.owner_email) WHERE d.active AND d.key_hash = $1 LIMIT 1`, [h]);
  if (!r.rows.length) throw new NovaError(401, 'this device is not paired or is switched off');
  const who = { device_id: r.rows[0].id, email: r.rows[0].owner_email, name: r.rows[0].name, key_hash: h };
  authCache.set(h, { at: now, who }); return who;
}

// Run one statement the way PostgREST would have: as `authenticated`, with the founder's claims
// and the device header visible to the SQL functions, inside one transaction (pooler-safe).
export async function runAs(db, who, deviceKey, { sql, params }, engineKey = null) {
  stats.db_calls++;
  const claims = JSON.stringify({ email: who.email, role: 'authenticated', sub: who.email });
  // the engine key rides along when the caller sent one: the queue and policy RLS read it from request.headers exactly as PostgREST would have set it
  const headers = JSON.stringify(engineKey ? { 'x-device-key': deviceKey, 'x-engine-key': engineKey } : { 'x-device-key': deviceKey });
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true), set_config('statement_timeout', $3, true)`, [claims, headers, String(TIMEOUT)]);
    await db.query('SET LOCAL ROLE authenticated');
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r.rows;
  } catch (e) { try { await db.query('ROLLBACK'); } catch {} throw e; }
}

// The whole request. `req` = { method, path, query, headers, body }, returns { status, headers, body }.
export async function handle(db, req, now = Date.now()) {
  stats.requests++;
  const t0 = now;
  const log = (status, extra = {}) => { const ms = Date.now() - t0; observe(req.path, ms, { status, cache: extra.cache || null, device: extra.device || null }); console.log(JSON.stringify({ t: new Date(now).toISOString(), method: req.method, path: req.path, status, ms, ...extra })); };
  try {
    if (req.method === 'OPTIONS') return { status: 204, headers: cors(), body: null };
    if (req.path === '/api/health') {
      let dbOk = false; try { dbOk = (await db.query('SELECT 1 AS ok')).rows[0].ok === 1; } catch {}
      return json(200, { ok: true, db: dbOk ? 'ok' : 'unavailable', cache_entries: cache.size, uptime_s: Math.round((now - stats.started) / 1000), stats, timings: timings() });
    }
    const deviceKey = req.headers['x-device-key'];
    // Pairing is the one call made before a device has a key: pair_device checks the code itself
    // (hashed, single use, expiring) and runs as plain `authenticated` with no claims, like PostgREST.
    if (req.path.endsWith('/rest/rpc/pair_device') || req.path.endsWith('/rest/v1/rpc/pair_device')) {
      if (req.method !== 'POST') return json(405, { message: 'rpc is POST' });
      if (!rateOk('pair:' + (req.headers['x-forwarded-for'] || 'unknown'), now)) return json(429, { message: 'too many pairing attempts' });
      const code = String(req.body?.p_code || '').trim(), newKey = String(req.body?.p_device_key || '');
      if (!code || newKey.length < 16) return json(400, { message: 'pairing needs p_code and p_device_key' });
      // The code is the credential. It names one device, whose owner is the founder pair_device() must
      // see; the function then checks the hash, the expiry and single use itself, exactly as before.
      const owner = await db.query(`SELECT d.owner_email FROM public.pairing_codes c JOIN public.devices d ON d.id = c.device_id WHERE c.code_hash = encode(extensions.digest($1, 'sha256'), 'hex') AND c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > now() LIMIT 1`, [code]);
      if (!owner.rows.length) { log(400, { rpc: 'pair_device', why: 'code wrong or expired' }); return json(400, { message: 'code wrong or expired' }); }
      let rows;
      try { rows = await runAs(db, { email: owner.rows[0].owner_email }, newKey, buildRpc('pair_device', { p_code: code, p_device_key: newKey })); }
      catch (e) { log(400, { rpc: 'pair_device', why: e.message.slice(0, 120) }); return json(400, { message: e.message.replace(/postgres(ql)?:\/\/\S+/g, '<conn>').slice(0, 200) }); }
      invalidate('devices'); log(200, { rpc: 'pair_device' });
      return json(200, rows.length === 1 ? rows[0].value : rows.map((r) => r.value));
    }
    // The cloud worker pairs itself: no code, because a founder switching it on in Coco Lounge is the
    // authorisation and the engine key is the proof it is the runtime. pair_cloud_worker checks both.
    if (req.path.endsWith('/rest/v1/rpc/pair_cloud_worker')) {
      if (req.method !== 'POST') return json(405, { message: 'rpc is POST' });
      if (!rateOk('pair:' + (req.headers['x-forwarded-for'] || 'unknown'), now)) return json(429, { message: 'too many pairing attempts' });
      const engineKey = String(req.headers['x-engine-key'] || ''), id = String(req.body?.p_device_id || ''), newKey = String(req.body?.p_device_key || '');
      if (!engineKey || !id || newKey.length < 16) return json(400, { message: 'pairing a cloud worker needs x-engine-key, p_device_id and p_device_key' });
      let rows;
      try { rows = await runAs(db, { email: '' }, newKey, buildRpc('pair_cloud_worker', { p_device_id: id, p_device_key: newKey }), engineKey); }
      catch (e) { log(400, { rpc: 'pair_cloud_worker', why: e.message.slice(0, 120) }); return json(400, { message: e.message.replace(/postgres(ql)?:\/\/\S+/g, '<conn>').slice(0, 200) }); }
      invalidate('devices'); authCache.clear(); log(200, { rpc: 'pair_cloud_worker', device: id });
      return json(200, rows.length === 1 ? rows[0].value : rows.map((r) => r.value));
    }
    const who = await authenticate(db, deviceKey, now);
    if (!rateOk(who.device_id, now)) { log(429, { device: who.device_id }); return json(429, { message: 'too many requests from this device; slow down' }); }
    if (req.path === '/api/me') { log(200, { device: who.device_id }); return json(200, { email: who.email, device_id: who.device_id, name: who.name }); }
    // the universal publishing layer: COCO app -> cloud worker -> Nova -> platform adapter -> provider
    if (req.path === '/api/publish' || req.path.startsWith('/api/publish/')) return handlePublish(db, req, who, deviceKey, { runAs, json, log, fetch: deps.fetch, urls: deps.publishUrls });
    if (req.path === '/api/apk/latest') {
      // The newest cloud build is the latest GitHub release of the (public) Coco repository:
      // tag android-<version>-<code>, the APK as its asset, the sha256 in its notes.
      const c = cache.get('apk'); if (c && now - c.at < 60000) { log(200, { device: who.device_id, cache: 'hit' }); return json(200, c.body, { 'x-nova-cache': 'hit' }); }
      const r = await fetch('https://api.github.com/repos/GetRichSoon/Coco/releases?per_page=10', { headers: { accept: 'application/vnd.github+json', 'user-agent': 'coco-nova' } });
      if (!r.ok) return json(503, { message: `releases unavailable (${r.status})` });
      const rel = (await r.json()).find((x) => /^android-\d+\.\d+\.\d+-\d+$/.test(x.tag_name) && !x.draft);
      const asset = rel?.assets?.find((a) => a.name.endsWith('.apk'));
      if (!rel || !asset) return json(404, { message: 'no build announced yet' });
      const [, versionName, code] = rel.tag_name.match(/^android-(\d+\.\d+\.\d+)-(\d+)$/);
      const sha256 = (rel.body || '').match(/sha256\s+([0-9a-f]{64})/)?.[1] || null;
      const body = { versionCode: Number(code), versionName, file: asset.name, sha256, bytes: asset.size, url: asset.browser_download_url, at: rel.published_at };
      cache.set('apk', { at: now, body }); log(200, { device: who.device_id, apk: code, cache: 'miss' }); return json(200, body);
    }
    if (req.path === '/api/changes') {
      // one tiny signal: the newest moment anything the screens show changed. Apps poll this, not tables.
      const key = 'changes';
      const c = cache.get(key); if (c && now - c.at < 5000) { stats.cache_hits++; log(200, { device: who.device_id, cache: 'hit' }); return json(200, c.body, { 'x-nova-cache': 'hit' }); }
      // Every table the screens show pulses on change (tasks and activity included), so the newest
      // pulse row IS the version. Read by primary key: the three max() scans cost 2.2 s each call.
      const rows = await runAs(db, who, deviceKey, { sql: `SELECT at AS version, topic AS last_topic FROM public.pulse ORDER BY id DESC LIMIT 1`, params: [] });
      const body = { version: rows[0]?.version || null, last_topic: rows[0]?.last_topic || null };
      cache.set(key, { at: now, body }); stats.cache_misses++; log(200, { device: who.device_id, cache: 'miss' }); return json(200, body, { 'x-nova-cache': 'miss' });
    }
    const m = req.path.match(/^\/(?:api\/rest|rest\/v1)\/(rpc\/)?([a-z_]+)$/);
    if (!m) return json(404, { message: 'not found' });
    const [, isRpc, name] = m;
    if (isRpc) {
      if (req.method !== 'POST') return json(405, { message: 'rpc is POST' });
      const rows = await runAs(db, who, deviceKey, buildRpc(name, req.body || {}), req.headers['x-engine-key'] || null);
      invalidate(); log(200, { device: who.device_id, rpc: name });
      const value = rows.length === 1 ? rows[0].value : rows.map((r) => r.value);
      return json(200, value);
    }
    if (!TABLES.has(name)) return json(404, { message: `no such table ${name}` });
    if (req.method === 'GET') {
      const key = `${who.email}|${name}|${JSON.stringify(req.query)}`;
      const c = cache.get(key);
      if (c && now - c.at < CACHE_S * 1000) { stats.cache_hits++; log(200, { device: who.device_id, table: name, cache: 'hit' }); return json(200, c.body, { 'x-nova-cache': 'hit' }); }
      const rows = await runAs(db, who, deviceKey, buildSelect(name, req.query), req.headers['x-engine-key'] || null);
      cache.set(key, { at: now, body: rows }); stats.cache_misses++;
      log(200, { device: who.device_id, table: name, cache: 'miss', rows: rows.length });
      return json(200, rows, { 'x-nova-cache': 'miss' });
    }
    const rows = await runAs(db, who, deviceKey, buildWrite(name, req.method, req.query, req.body, req.headers.prefer || ''), req.headers['x-engine-key'] || null);
    invalidate(name); log(200, { device: who.device_id, table: name, write: req.method, rows: rows.length });
    return json(/return=representation/.test(req.headers.prefer || '') ? 200 : 201, /return=representation/.test(req.headers.prefer || '') ? rows : null);
  } catch (e) {
    stats.errors++;
    const status = e instanceof NovaError ? e.status : /statement timeout/i.test(e.message) ? 504 : /permission denied|row-level security|violates row-level/i.test(e.message) ? 403 : 500;
    log(status, { error: String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '<conn>').slice(0, 200) });
    return json(status, { message: status === 500 ? 'Nova could not complete that' : e.message, hint: status === 500 ? 'check the Nova logs' : undefined });
  }
}
export function invalidate(table = null) { for (const k of cache.keys()) if (!table || k.split('|')[1] === table || k === 'changes') cache.delete(k); }
const cors = () => ({ 'access-control-allow-origin': '*', 'access-control-allow-headers': 'x-device-key, x-engine-key, apikey, authorization, content-type, prefer', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' });
// a null result is the JSON text `null`, never an empty body: a caller parsing a 200 must always get JSON. Only a write with return=minimal (201) sends nothing.
function json(status, body, extra = {}) { const text = body === null && status === 201 ? '' : JSON.stringify(body ?? null); stats.bytes_out += text.length; return { status, headers: { ...cors(), 'content-type': 'application/json', 'x-nova-bytes': String(text.length), ...extra }, body: text }; }

// ---------------------------------------------------------------- Vercel adapter
let pgModule = null, pool = null;
// A small pool per warm instance: connections stay open between requests, and two requests served by
// the same instance at once never share a connection (a BEGIN / SET LOCAL ROLE must stay its own).
export async function connect() {
  if (!process.env.DATABASE_URL) throw new NovaError(503, 'Nova has no DATABASE_URL');
  pgModule ||= await import('pg');
  pool ||= new pgModule.default.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000, max: 4, idleTimeoutMillis: 60000 });
  pool.on?.('error', () => {});
  return pool.connect();
}
export async function vercel(req, res) {
  const url = new URL(req.url, 'http://nova');
  const query = Object.fromEntries(url.searchParams.entries());
  // the rewrite in vercel.json carries the caller's path here; without it, the path is the URL's own
  const path = query.__path ? '/' + String(query.__path).replace(/^\/+/, '') : url.pathname;
  // Vercel also injects the rewrite's named segment (`path=...`) into the query; neither is a filter
  delete query.__path; delete query.path;
  let body = req.body; if (typeof body === 'string' && body) { try { body = JSON.parse(body); } catch { body = null; } }
  let db = null;
  try {
    try { db = await connect(); } catch (e) { if (path === '/api/health') db = { query: async () => { throw e; } }; else { res.status(503).json({ message: 'Nova cannot reach the database', hint: e.message.replace(/postgres(ql)?:\/\/\S+/g, '<conn>').slice(0, 120) }); return; } }
    const out = await handle(db, { method: req.method, path, query, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])), body });
    res.status(out.status); for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
    res.send(out.body ?? '');
  } finally { try { db?.release?.(); } catch {} }
}
