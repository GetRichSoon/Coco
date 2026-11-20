// Vendored from GetRichSoon/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec scripts/ai/job-door.mjs. Every line below this one is byte-identical to that file (Lounge/door-board.test.js checks it).
// The job door: how a free cloud host takes AI work without ever holding a long-lived secret.
//
//   trusted side (holds the engine key: this repo's runner, or Nova)          worker host (holds ONLY a short-lived token)
//   mintToken({ engineKey, worker, ttl }) ------------ token ------------>    AI_JOB_TOKEN + AI_JOB_DOOR (an https address)
//   door({ queue, engineKey })  <----- claim | heartbeat | done | fail -----   doorClient({ url, token })
//
// The token says "worker W may take ai.generate jobs until T", signed with a key derived from the engine key (never the engine key itself). There is no
// database and nothing to revoke: it expires, by default in an hour and never in more than six. Through the door a worker can do four things, only for
// ai.generate jobs, only as the worker named in its token, and the queue's own lease rules still apply. It cannot read, list or cancel anything.
//
// The door is a plain function (handle) so it can be mounted where the engine key already lives, for example as a Nova route; `serve` wraps it in a
// small HTTP server for a trusted machine. Nothing in this repo deploys it: that is a founder decision, together with the choice of worker host.
//
//   node scripts/ai/job-door.mjs mint --worker ai-worker-1 [--ttl 3600]      prints the token (needs SUPABASE_ENGINE_KEY); give it to the host, nothing else
//   node scripts/ai/job-door.mjs serve [--port 8787] [--host 127.0.0.1]      runs the door in front of the real queue
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SCOPE = 'ai.generate';
export const DEFAULT_TTL_S = 3600, MAX_TTL_S = 6 * 3600, MAX_CHAIN_S = 7 * 86400, MAX_BODY = 128 * 1024, MAX_RESULT = 60000;
const WORKER = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const b64 = (x) => Buffer.from(x).toString('base64url');
const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest();
const signingKey = (engineKey) => hmac(String(engineKey), 'good-space/ai-job-door/v1');
const SHAPE = /^v1\.([\w-]+)\.([\w-]+)$/;

export function mintToken({ engineKey, worker, ttlSeconds = DEFAULT_TTL_S, now = Date.now() }) {
  if (!engineKey) throw new Error('minting a job token needs the engine key');
  if (!WORKER.test(worker || '')) throw new Error('a worker id is 3 to 64 characters of a-z 0-9 . _ -');
  const ttl = Math.floor(Number(ttlSeconds));
  if (!(ttl >= 60 && ttl <= MAX_TTL_S)) throw new Error(`a job token lives 60 seconds to ${MAX_TTL_S / 3600} hours`);
  const iat = Math.floor(now / 1000), body = b64(JSON.stringify({ sub: worker, scp: SCOPE, iat, cst: iat, exp: iat + ttl, jti: crypto.randomBytes(8).toString('hex') }));
  return `v1.${body}.${b64(hmac(signingKey(engineKey), `v1.${body}`))}`;
}
// An UNVERIFIED look inside a token: the worker uses it to learn its own name and when it ends. Only the door's check (verifyToken) means anything.
export function readToken(token) {
  const m = SHAPE.exec(String(token || '')); if (!m) return null;
  try { const p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); return p && typeof p === 'object' ? p : null; } catch { return null; }
}
export function verifyToken(token, { engineKey, now = Date.now() }) {
  const m = SHAPE.exec(String(token || '')); if (!m) return { ok: false, reason: 'malformed' };
  const want = hmac(signingKey(engineKey), `v1.${m[1]}`), got = Buffer.from(m[2], 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, reason: 'bad signature' };
  const p = readToken(token), t = Math.floor(now / 1000);
  if (!p || p.scp !== SCOPE || !WORKER.test(p.sub || '') || !Number.isInteger(p.exp) || !Number.isInteger(p.iat)) return { ok: false, reason: 'wrong scope' };
  if (p.exp - p.iat > MAX_TTL_S) return { ok: false, reason: 'lives too long' };
  if (t >= p.exp) return { ok: false, reason: 'expired' };
  if (t < p.iat - 120) return { ok: false, reason: 'not valid yet' };
  return { ok: true, worker: p.sub, iat: p.iat, exp: p.exp, cst: Number.isInteger(p.cst) ? p.cst : p.iat };
}

// The door itself: ({ method, path, authorization, body }) -> { status, json }. `queue` is the real one (cloudQueue) or the in-memory one.
// `registry` (optional, scripts/lib/worker-registry.mjs) adds: revocation (a revoked or paused worker is refused at once), /register and /report (facts), /renew.
export function door({ queue, engineKey, registry = null, now = () => Date.now() }) {
  // A missing or short key would sign tokens anyone can forge, so the door refuses to exist without a real one.
  if (typeof engineKey !== 'string' || engineKey.length < 16) throw new Error('the job door needs an engine key of at least 16 characters');
  const no = (status, error) => ({ status, json: { ok: false, error } });
  const claimed = new Map();                         // job id -> { at, models } for the jobs this door handed out (minutes used, and the model check)
  const MAX_LEASE_MIN = 30;
  const minutes = (id) => { const c = claimed.get(id); claimed.delete(id); return c ? Math.min(MAX_LEASE_MIN, Math.max(0, (now() - c.at) / 60000)) : 0; };   // real lease time, from claim to done or fail
  return async function handle({ method = 'POST', path: p = '', authorization = '', body = null } = {}) {
    const m = /^Bearer\s+(\S+)$/i.exec(String(authorization)), v = m ? verifyToken(m[1], { engineKey, now: now() }) : { ok: false };
    if (!v.ok) return no(401, 'the job token is not accepted');                       // one answer for every reason: nothing to probe
    let reg = null;
    if (registry) { let w = null; try { w = await registry.get(v.worker); } catch { return no(502, 'the registry did not answer'); }
      // unknown, paused and revoked look the same from outside; so does a token whose chain began before the worker's revoked_before (a stolen chain dies, a fresh mint works)
      if (!w || w.status !== 'active' || v.cst <= (Number(w.revoked_before) || 0)) return no(401, 'the job token is not accepted');
      reg = w; }
    if (method === 'GET' && p === '/me') return { status: 200, json: { ok: true, worker: v.worker, scope: SCOPE, expires_at: new Date(v.exp * 1000).toISOString() } };
    if (method !== 'POST') return no(405, 'POST only');
    const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {}, lease = Math.min(1800, Math.max(30, Math.floor(Number(b.lease_seconds)) || 600));
    try {
      if (registry && (p === '/register' || p === '/report')) {
        const f = b.facts; if (!f || typeof f !== 'object' || Array.isArray(f) || JSON.stringify(f).length > 16384) return no(400, 'a facts object under 16384 bytes is needed');
        return { status: 200, json: await registry.report(v.worker, f) };         // facts only: kind, capabilities, terms and quota are COCO's to set, never the worker's
      }
      if (p === '/renew') {                                                 // a still-valid token buys the next one, for at most 7 days from the first; then a human mints again
        const t = Math.floor(now() / 1000); if (t - v.cst > MAX_CHAIN_S) return no(401, 'the job token chain is over: mint a new one');
        const ttl = Math.min(MAX_TTL_S, Math.max(60, Math.floor(Number(b.ttl_seconds)) || DEFAULT_TTL_S)), iat = t;
        const body64 = b64(JSON.stringify({ sub: v.worker, scp: SCOPE, iat, cst: v.cst, exp: iat + ttl, jti: crypto.randomBytes(8).toString('hex') }));
        return { status: 200, json: { ok: true, token: `v1.${body64}.${b64(hmac(signingKey(engineKey), `v1.${body64}`))}`, expires_at: new Date((iat + ttl) * 1000).toISOString() } };
      }
      if (p === '/claim') {
        // the registry's own row decides what this worker may take: kind and capabilities are COCO's, not the token's
        if (reg && !(reg.kind === 'ai' && Array.isArray(reg.capabilities) && reg.capabilities.includes(SCOPE))) return no(403, 'this worker is not registered for ai.generate');
        if (registry) await registry.report(v.worker, {});                    // a claim is a sign of life
        const c = await queue.claim({ worker: v.worker, leaseSeconds: lease, types: [SCOPE] });   // the type is fixed here, not by the caller
        if (c && c.ok && c.job) claimed.set(c.job.id, { at: now(), models: c.job.payload && Array.isArray(c.job.payload.models) ? c.job.payload.models : null });
        return { status: 200, json: c };
      }
      const id = String(b.id || '');
      if (!['/heartbeat', '/done', '/fail'].includes(p)) return no(404, 'no such door');
      if (!/^[\w:.-]{3,80}$/.test(id)) return no(400, 'a job id is needed');
      if (p === '/heartbeat') { if (registry) await registry.report(v.worker, {}); return { status: 200, json: await queue.heartbeat(id, v.worker, lease) }; }   // last_seen is what keeps a worker selectable
      if (p === '/done') {
        if (!b.result || typeof b.result !== 'object' || Array.isArray(b.result) || JSON.stringify(b.result).length > MAX_RESULT) return no(400, `a result object under ${MAX_RESULT} bytes is needed`);
        const c = claimed.get(id);          // a result from a model nobody asked for is a defect, not an answer
        if (c && c.models && !c.models.includes(b.result.model)) { const m = minutes(id); if (registry) await registry.addUsage(v.worker, m).catch(() => {}); return { status: 200, json: await queue.fail(id, v.worker, 'permanent', 'result: the model reported was not one of the requested models') }; }
        const r = await queue.done(id, v.worker, b.result), m = minutes(id); if (registry && r && r.ok) await registry.addUsage(v.worker, m).catch(() => {});
        return { status: 200, json: r };
      }
      if (!['transient', 'permanent'].includes(b.kind)) return no(400, 'kind must be transient or permanent');
      const r = await queue.fail(id, v.worker, b.kind, String(b.message || '').slice(0, 2000)), m = minutes(id); if (registry && r && r.ok) await registry.addUsage(v.worker, m).catch(() => {});
      return { status: 200, json: r };
    } catch { return no(502, 'the queue did not answer'); }                           // never echo the queue's own words
  };
}

// The worker's side: the same four calls as the queue contract (scripts/lib/queue.mjs), over HTTPS. The worker id is the token's, never the caller's.
export function doorClient({ url, token, fetchImpl = globalThis.fetch }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/.test(base)) throw new Error('the job door must be an https address (http only on this host, for tests)');
  if (!SHAPE.test(String(token || ''))) throw new Error('no job token: set AI_JOB_TOKEN to a token from `job-door.mjs mint`');
  let tok = token;
  const call = async (p, body) => {
    const r = await fetchImpl(`${base}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw Object.assign(new Error(`the job door answered ${r.status}`), { status: r.status });
    return j;
  };
  return { how: 'door', me: () => call('/me'), token: () => tok, report: (facts) => call('/report', { facts }),
    renew: async (ttlSeconds = DEFAULT_TTL_S) => { const j = await call('/renew', { ttl_seconds: ttlSeconds }); tok = j.token; return j; },
    claim: ({ leaseSeconds = 600 } = {}) => call('/claim', { lease_seconds: leaseSeconds }),
    heartbeat: (id, _worker, leaseSeconds = 600) => call('/heartbeat', { id, lease_seconds: leaseSeconds }),
    done: (id, _worker, result = {}) => call('/done', { id, result }),
    fail: (id, _worker, kind, message) => call('/fail', { id, kind, message: String(message || '') }) };
}

// The same door as a Fetch handler, for a route that runs where the engine key lives (a Nova route on Vercel): (Request) -> Response. `prefix` is the route's
// mount path ("/api/ai-door"), stripped before the door sees the path. Every failure becomes an answer; nothing is logged.
export function fetchHandler(handle, { prefix = '' } = {}) {
  return async (req) => {
    const json = (status, o) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    try {
      const u = new URL(req.url); let pathname = u.pathname; if (prefix && pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length) || '/';
      const text = req.method === 'POST' ? await req.text() : ''; if (text.length > MAX_BODY) return json(413, { ok: false, error: 'too large' });
      let body = null; try { body = text ? JSON.parse(text) : null; } catch { return json(400, { ok: false, error: 'not JSON' }); }
      const r = await handle({ method: req.method, path: pathname, authorization: req.headers.get('authorization') || '', body });
      return json(r.status, r.json);
    } catch { return json(500, { ok: false, error: 'the door could not answer' }); }
  };
}

// An HTTP server around the door, for a trusted machine. The body is capped and parsed here; nothing is logged.
export function serve({ handle, port = 0, host = '127.0.0.1' }) {
  const server = http.createServer((req, res) => {
    const chunks = []; let n = 0, dead = false;
    const send = (status, json) => { if (dead) return; dead = true; res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { send(413, { ok: false, error: 'too large' }); req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      let body = null;
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null; } catch { return send(400, { ok: false, error: 'not JSON' }); }
      // An unhandled throw here would kill the whole process (a raw `GET //` has an invalid URL), so every failure becomes an answer.
      try {
        let pathname; try { pathname = new URL(req.url, 'http://x').pathname; } catch { return send(400, { ok: false, error: 'bad request' }); }
        const r = await handle({ method: req.method, path: pathname, authorization: req.headers.authorization || '', body });
        send(r.status, r.json);
      } catch { send(500, { ok: false, error: 'the door could not answer' }); }
    });
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d = null) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
  const { credentials } = await import('../lib/cloud-creds.mjs');
  const engineKey = credentials().headers?.['x-engine-key'];
  if (!engineKey) { console.error('no engine key in this runtime (SUPABASE_ENGINE_KEY): only the trusted side can mint a token or run the door'); process.exit(1); }
  if (a[0] === 'mint') {
    try { process.stdout.write(`${mintToken({ engineKey, worker: opt('worker'), ttlSeconds: Number(opt('ttl', DEFAULT_TTL_S)) })}\n`); } catch (e) { console.error(e.message); process.exit(2); }
  } else if (a[0] === 'serve') {
    const { cloudQueue } = await import('../lib/queue.mjs');
    const { cloudRegistry } = await import('../lib/worker-registry.mjs');
    // The registry is what makes revocation, pausing, /register and /report work, so the served door always has it.
    const s = await serve({ handle: door({ queue: cloudQueue(), engineKey, registry: cloudRegistry() }), port: Number(opt('port', 8787)), host: opt('host', '127.0.0.1') });
    console.log(`job door listening on ${s.address().address}:${s.address().port}`);
  } else { console.error('usage: job-door.mjs mint --worker <id> [--ttl seconds] | serve [--port N] [--host H]'); process.exit(2); }
}
