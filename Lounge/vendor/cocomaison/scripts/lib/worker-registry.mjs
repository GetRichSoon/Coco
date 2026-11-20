// Vendored from GetRichSoon/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec scripts/lib/worker-registry.mjs. Every line below this one is byte-identical to that file (Lounge/door-board.test.js checks it).
// The unified worker registry: what the Global Brain knows about every worker, and how it picks one. Workers execute, COCO owns: a worker reports facts
// (arch, RAM, GPU, free storage, utilisation, network, models with digests) and never decides what it runs.
//   memoryRegistry()            in memory, for tests and dry runs      cloudRegistry()   the worker_registry table (os/cloud/migrations/0037, NOT applied yet)
//   selectWorker({workers, job})  -> { ok:true, worker, ranked } | { ok:false, exit:20|30, reason }     20 = nobody eligible now (transient), 30 = free quota spent (pause, never pay)
// Kinds: ai (ai.generate) | animation | render | storage. Nothing here starts, buys or switches anything, and every switch defaults OFF.
import os from 'node:os';

export const STALE_MS = 30 * 60e3;                                  // no heartbeat for 30 minutes: stale, its leases are reclaimed
export const KINDS = Object.freeze(['ai', 'animation', 'render', 'storage']);
export const KIND_OF_JOB = Object.freeze({ 'ai.generate': 'ai', 'animation.render': 'animation', 'render.video': 'render', 'storage.put': 'storage' });
const HOSTED_MODEL_PROVIDERS = /^(gemini|claude|anthropic|google|openai)/i;   // never chosen for kind ai when the Ollama backend is on
const MAX_UTILISATION = 0.9;

// what this host reports about itself (the worker calls it; `models` comes from Ollama's tags with digests)
export function hostFacts({ models = [], gpu = null, storageFreeGb = null, network = 'ok', utilisation = null } = {}) {
  const cpus = (os.cpus() || []).length || 1;
  return { arch: os.arch(), cpus, ram_total_mb: Math.round(os.totalmem() / 1048576), ram_free_mb: Math.round(os.freemem() / 1048576), gpu, storage_free_gb: storageFreeGb, network,
    utilisation: utilisation ?? Math.min(1, Math.round((os.loadavg()[0] / cpus) * 100) / 100), models: models.map((m) => ({ name: m.name, digest: m.digest || null })) };
}

// Facts come from a host we do not control: only these keys, only these types, clamped to sane ranges; everything else is dropped. Never throws.
export const MAX_FACTS_BYTES = 16384;
const str = (v, n) => (typeof v === 'string' && v.length <= n ? v : undefined), num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
export function cleanFacts(f, total = null) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return {};
  const o = { arch: str(f.arch, 32), cpus: num(f.cpus, 1, 4096), ram_total_mb: num(f.ram_total_mb, 0, 1e7), ram_free_mb: num(f.ram_free_mb, 0, 1e7), storage_free_gb: num(f.storage_free_gb, 0, 1e6),
    utilisation: num(f.utilisation, 0, 1), network: str(f.network, 16), gpu: f.gpu === null ? null : str(f.gpu, 64),
    models: Array.isArray(f.models) ? f.models.slice(0, 32).filter((m) => m && str(m.name, 100)).map((m) => ({ name: m.name, digest: str(m.digest, 100) ?? null })) : undefined };
  const t = o.ram_total_mb ?? total; if (o.ram_free_mb !== undefined && t != null) o.ram_free_mb = Math.min(o.ram_free_mb, t);      // free RAM cannot exceed the declared total
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
// the new facts laid over the old ones: { facts } or { error }
function mergeFacts(old, add) {
  const o = cleanFacts(old), facts = { ...o, ...cleanFacts(add, o.ram_total_mb ?? null) };
  return JSON.stringify(facts).length > MAX_FACTS_BYTES ? { error: 'facts too large' } : { facts };
}
const quotaLeft = (w, now = Date.now()) => { const q = w.quota && typeof w.quota === 'object' ? w.quota : {}, used = q.resets_at && now >= Date.parse(q.resets_at) ? 0 : Number(q.used) || 0; return Number.isFinite(q.limit) ? Math.max(0, q.limit - used) : Infinity; };
// the reasons a worker cannot take this job right now ([] = eligible); quota is judged apart so "nobody eligible" and "free quota spent" stay different answers
function problems(w, job, now, ollamaOn) {
  const f = cleanFacts(w.facts), need = job.needs || {}, kind = KIND_OF_JOB[job.type] || job.kind, out = [];
  if (w.status !== 'active') out.push(`status ${w.status}`);
  if (kind && w.kind !== kind) out.push(`kind ${w.kind} is not ${kind}`);
  if (!(Array.isArray(w.capabilities) && w.capabilities.includes(job.type))) out.push(`no capability ${job.type}`);
  if (!w.last_seen || now - Date.parse(w.last_seen) > STALE_MS) out.push('stale: no heartbeat for 30 minutes');
  if (need.arch && f.arch !== need.arch) out.push(`arch ${f.arch} is not ${need.arch}`);
  if (need.ram_mb && !(f.ram_free_mb >= need.ram_mb)) out.push(`free RAM ${f.ram_free_mb ?? '?'} MB is under ${need.ram_mb} MB`);
  if (need.gpu && !f.gpu) out.push('no GPU');
  if (need.storage_gb && !(f.storage_free_gb >= need.storage_gb)) out.push(`free storage is under ${need.storage_gb} GB`);
  if (f.utilisation > MAX_UTILISATION) out.push(`busy: utilisation ${f.utilisation}`);
  if (f.network && f.network !== 'ok') out.push(`network ${f.network}`);
  if ((w.terms && w.terms.commercial_ok) !== true) out.push('provider terms do not allow commercial use');
  if (kind === 'ai') {
    if (ollamaOn && HOSTED_MODEL_PROVIDERS.test(w.provider || '')) out.push(`hosted provider ${w.provider} is shut out by the Ollama backend`);
    const have = new Set((f.models || []).map((m) => m.name)), want = (job.models || []).filter(Boolean);
    if (want.length && !want.some((m) => have.has(m))) out.push('none of the requested models is on this worker');
  }
  return out;
}

export function selectWorker({ workers, job, now = Date.now(), ollamaOn = true }) {
  const all = Array.isArray(workers) ? workers : [], rejected = {}, passed = [];
  for (const w of all) {
    const id = w && typeof w.worker_id === 'string' ? w.worker_id : '?';
    try { const p = problems(w, job, now, ollamaOn); if (p.length) rejected[id] = p; else passed.push(w); } catch { rejected[id] = ['malformed row']; }     // one poisoned row never stops the others
  }
  const ranked = passed.filter((w) => quotaLeft(w, now) > 0);
  if (!ranked.length) {
    if (passed.length) return { ok: false, exit: 30, reason: `the free quota of every eligible worker is spent (${passed.map((w) => w.worker_id).join(', ')}); pause until it returns, nothing paid is switched on`, rejected };
    return { ok: false, exit: 20, reason: all.length ? 'no eligible worker right now' : 'no worker is registered', rejected };
  }
  // urgent jobs (priority 0-1) go to the most free RAM; the rest to the least used worker with the most free quota left
  const urgent = (job.priority ?? 2) <= 1, F = (w) => cleanFacts(w.facts), score = (w) => urgent ? -(F(w).ram_free_mb || 0) : (F(w).utilisation || 0) * 1e6 - Math.min(quotaLeft(w, now), 1e5);
  ranked.sort((a, b) => score(a) - score(b) || a.worker_id.localeCompare(b.worker_id));
  return { ok: true, worker: ranked[0], ranked: ranked.map((w) => w.worker_id), rejected };
}

// ---- stores. One contract: get(id) | list() | upsert(row) | report(id, facts) | setStatus(id, status) | addUsage(id, minutes) | revokeTokens(id, atSeconds)
// revoked_before (epoch seconds): the door refuses any token whose chain started at or before it, so a stolen chain dies at once and a fresh mint works.
const usage = (q, minutes, now) => { const reset = q && q.resets_at && now >= Date.parse(q.resets_at); return { ...(q || {}), used: Math.round(((reset ? 0 : Number(q && q.used) || 0) + minutes) * 100) / 100 }; };
export function memoryRegistry({ now = () => Date.now() } = {}) {
  const rows = new Map();
  return { how: 'memory', rows,
    async get(id) { return rows.has(id) ? { ...rows.get(id) } : null; },
    async list() { return [...rows.values()].map((r) => ({ ...r })); },
    async upsert(r) { const old = rows.get(r.worker_id) || {}; rows.set(r.worker_id, { status: 'active', capabilities: [], facts: {}, terms: {}, quota: {}, revoked_before: 0, ...old, ...r, updated_at: new Date(now()).toISOString() }); return { ok: true }; },
    async report(id, facts) { const r = rows.get(id); if (!r) return { ok: false, reason: 'not registered' }; if (r.status === 'revoked') return { ok: false, reason: 'revoked' };
      const m = mergeFacts(r.facts, facts); if (m.error) return { ok: false, reason: m.error }; Object.assign(r, { facts: m.facts, last_seen: new Date(now()).toISOString() }); return { ok: true }; },
    async setStatus(id, status) { const r = rows.get(id); if (!r) return { ok: false }; r.status = status; return { ok: true }; },
    async addUsage(id, minutes) { const r = rows.get(id); if (!r) return { ok: false }; r.quota = usage(r.quota, minutes, now()); return { ok: true, used: r.quota.used }; },
    async revokeTokens(id, at = Math.floor(now() / 1000)) { const r = rows.get(id); if (!r) return { ok: false }; r.revoked_before = at; return { ok: true }; } };
}
export function cloudRegistry({ credsImpl, fetchImpl = fetch } = {}) {
  const call = async (method, q, body) => {
    const { url, headers } = (credsImpl || (await import('./cloud-creds.mjs')).credentials)(); if (!headers) throw new Error('registry: no Coco Cloud credential in the environment');
    const r = await fetchImpl(`${url}/rest/v1/worker_registry${q}`, { method, headers: { ...headers, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=representation' }, body: body && JSON.stringify(body) });
    if (!r.ok) throw Object.assign(new Error(`registry: ${method} ${r.status}`), { status: r.status });
    return r.json();
  };
  const id = (x) => `?worker_id=eq.${encodeURIComponent(x)}`;
  return { how: 'cloud',
    async get(x) { return (await call('GET', `${id(x)}&limit=1`))[0] || null; },
    list: () => call('GET', '?select=*&limit=200'),
    async upsert(r) { await call('POST', '?on_conflict=worker_id', { ...r, updated_at: new Date().toISOString() }); return { ok: true }; },
    async report(x, facts) { const r = await this.get(x); if (!r) return { ok: false, reason: 'not registered' }; if (r.status === 'revoked') return { ok: false, reason: 'revoked' };
      const m = mergeFacts(r.facts, facts); if (m.error) return { ok: false, reason: m.error }; await call('PATCH', id(x), { facts: m.facts, last_seen: new Date().toISOString() }); return { ok: true }; },
    async setStatus(x, status) { await call('PATCH', id(x), { status }); return { ok: true }; },
    // shortcut: read-modify-write, two door calls at the same instant can lose one increment; fine for a daily minutes meter, upgrade to an rpc if the quota gets tight
    async addUsage(x, minutes) { const r = await this.get(x); if (!r) return { ok: false }; const quota = usage(r.quota, minutes, Date.now()); await call('PATCH', id(x), { quota }); return { ok: true, used: quota.used }; },
    async revokeTokens(x, at = Math.floor(Date.now() / 1000)) { await call('PATCH', id(x), { revoked_before: at }); return { ok: true }; } };
}

// Stale-lease reclaim: the door caps every lease at 30 minutes and each heartbeat renews it, so a job whose worker went silent comes back through the queue's
// own recover(). The answer also names the silent workers; their status is untouched, they become eligible again with their next report.
export async function reclaimStale({ registry, queue, now = Date.now }) {
  const rec = await queue.recover(); let workers = [], registry_error;
  if (registry) { try { workers = await registry.list(); } catch (e) { registry_error = String((e && e.message) || e).slice(0, 120); } }      // the jobs are back already; a missing table only costs the names
  const stale = workers.filter((w) => w && w.status === 'active' && (!w.last_seen || now() - Date.parse(w.last_seen) > STALE_MS)).map((w) => w.worker_id);
  return { recovered: rec.recovered, ids: rec.ids || [], stale_workers: stale, ...(registry_error ? { registry_error } : {}) };
}
