// The job door, the worker-token mint and the company task board, mounted in Nova (docs/NOVA_DOOR_ROUTE_SPEC.md in GetRichSoon/CocoMaison).
//
//   /api/ai-door/*          worker token only (Authorization: Bearer v1....): the door of CocoMaison scripts/ai/job-door.mjs, vendored byte-identical
//   POST /api/workers/token  a founder's paired device: mints a short-lived token for a registered, active ai worker (no PC needed)
//   GET  /api/board          a founder's paired device: CocoMaison scripts/brains/board.mjs over Nova's own database connection
//
// Database: Nova's direct Postgres connection and runAs, like every other route. The door's queue and registry calls run as `authenticated` with the
// engine key in request.headers, so private.engine_ok() and the worker_registry RLS decide, exactly as through the old gateway. No new client.
// Env: SUPABASE_ENGINE_KEY (at least 16 characters; signs worker tokens and proves the runtime to Postgres). Without it these routes answer 503.
// Nothing here logs a token, a request body or a result: the caller logs status and path only.
import { AsyncLocalStorage } from 'node:async_hooks';
import { door, fetchHandler, mintToken, verifyToken, DEFAULT_TTL_S, SCOPE } from '../vendor/cocomaison/scripts/ai/job-door.mjs';
import { cloudRegistry } from '../vendor/cocomaison/scripts/lib/worker-registry.mjs';
import { board } from '../vendor/cocomaison/scripts/brains/board.mjs';

export const PREFIX = '/api/ai-door';
const DOOR_RATE = 60;                               // requests per minute per worker id (the spec's limit)
const engineKey = () => { const k = process.env.SUPABASE_ENGINE_KEY; return typeof k === 'string' && k.length >= 16 ? k : null; };
const plain = (status, o) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });   // no CORS: the worker is not a browser
const ctx = new AsyncLocalStorage();                // the request's database connection, so one door (and its claimed-jobs map) serves every request of a warm instance

// cloudQueue's four worker calls (CocoMaison scripts/lib/queue.mjs, same RPCs and argument names), through Nova's buildRpc instead of the REST gateway
const novaQueue = (rpc) => ({
  claim: ({ worker, leaseSeconds = 600, types = null }) => rpc('coco_job_claim', { p_worker: worker, p_lease_seconds: leaseSeconds, p_types: types }),
  heartbeat: (id, worker, leaseSeconds = 600) => rpc('coco_job_heartbeat', { p_id: id, p_worker: worker, p_lease_seconds: leaseSeconds }),
  done: (id, worker, result = {}) => rpc('coco_job_done', { p_id: id, p_worker: worker, p_result: result }),
  fail: (id, worker, kind, message) => rpc('coco_job_fail', { p_id: id, p_worker: worker, p_kind: kind, p_message: String(message || '') }),
});
// the vendored cloudRegistry unchanged: its PostgREST calls on worker_registry are answered by Nova's own PostgREST-subset builders
const novaRegistry = (run, n) => cloudRegistry({
  credsImpl: () => ({ url: 'https://nova.internal', headers: {} }),
  fetchImpl: async (u, { method = 'GET', headers = {}, body } = {}) => {
    const query = Object.fromEntries(new URL(u).searchParams);
    const rows = await run(method === 'GET' ? n.buildSelect('worker_registry', query) : n.buildWrite('worker_registry', method, query, body ? JSON.parse(body) : null, headers.prefer || ''));
    return { ok: true, status: 200, json: async () => rows };
  },
});
function tools(n, key, asWho = { email: '' }, deviceKey = '') {
  const run = (stmt) => n.runAs(ctx.getStore(), asWho, deviceKey, stmt, key);
  const rpc = async (fn, args) => { const rows = await run(n.buildRpc(fn, args)); return rows.length === 1 ? rows[0].value : rows.map((r) => r.value); };
  return { run, rpc, registry: novaRegistry(run, n) };
}

let inst = null;   // { key, fetch }: rebuilt only if the key changes
export async function handleDoor(db, req, n, now = Date.now()) {
  const key = engineKey(); if (!key) return plain(503, { ok: false, error: 'the job door is not configured' });
  if (req.headers['x-forwarded-proto'] !== 'https') return plain(400, { ok: false, error: 'https only' });
  const m = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || '')), v = m ? verifyToken(m[1], { engineKey: key, now }) : { ok: false };
  if (v.ok && !n.rateOk(`door:${v.worker}`, now, DOOR_RATE)) return plain(429, { ok: false, error: 'too many requests for this worker; slow down' });
  if (!inst || inst.key !== key) { const t = tools(n, key); inst = { key, fetch: fetchHandler(door({ queue: novaQueue(t.rpc), engineKey: key, registry: t.registry }), { prefix: PREFIX }) }; }
  // Vercel has parsed the JSON already (bad JSON is its own 400); the door re-measures the body and caps it at 128 KB
  const body = req.method === 'POST' && req.body != null ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined;
  const res = await ctx.run(db, () => inst.fetch(new Request(`https://nova${req.path}`, { method: req.method, headers: { authorization: String(req.headers.authorization || '') }, body })));
  return { status: res.status, headers: { 'content-type': 'application/json' }, body: await res.text() };
}

// POST /api/workers/token { worker_id, ttl_seconds? }: `who` is already a founder's active paired device (Nova's authenticate). The token is in this one answer only.
export async function handleWorkerToken(db, req, who, deviceKey, n) {
  if (req.method !== 'POST') return n.json(405, { message: 'POST only' });
  const key = engineKey(); if (!key) return n.json(503, { message: 'worker tokens are not configured on Nova' });
  const id = String(req.body?.worker_id || ''), ttl = req.body?.ttl_seconds ?? DEFAULT_TTL_S;
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(id)) return n.json(400, { message: 'a worker id is 3 to 64 characters of a-z 0-9 . _ -' });
  const w = await ctx.run(db, () => tools(n, key, who, deviceKey).registry.get(id));
  if (!w || w.status !== 'active') return n.json(404, { message: 'no active worker with that id in the registry' });
  if (!(w.kind === 'ai' && Array.isArray(w.capabilities) && w.capabilities.includes(SCOPE))) return n.json(409, { message: `this worker is not registered for ${SCOPE}` });
  let token; try { token = mintToken({ engineKey: key, worker: id, ttlSeconds: ttl }); } catch (e) { return n.json(400, { message: e.message }); }
  return n.json(200, { ok: true, worker: id, scope: SCOPE, token, expires_at: new Date(verifyToken(token, { engineKey: key }).exp * 1000).toISOString() });
}

// GET /api/board: one read-only board for Desktop, Android and PWA, read as the founder (RLS decides, as for every other read)
export async function handleBoard(db, req, who, deviceKey, n) {
  if (req.method !== 'GET') return n.json(405, { message: 'the board is GET' });
  const call = async (p) => {
    const [table, qs = ''] = p.split('?'), { limit, ...query } = Object.fromEntries(new URLSearchParams(qs)), stmt = n.buildSelect(table, query);
    // board.mjs asks for up to 5000 handoff rows; Nova's table door caps a page at 1000, so the limit is set here
    return n.runAs(db, who, deviceKey, { sql: `${stmt.sql} LIMIT ${Math.max(0, Math.min(5000, parseInt(limit, 10) || 1000))}`, params: stmt.params });
  };
  return n.json(200, await board({ call }));
}
