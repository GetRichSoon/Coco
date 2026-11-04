// Coco four-device sync runner (Boss order 2026-11-04). ONE shared scheduler: a single cloud job runs this every 15 minutes.
// The decisions live in Lounge/device-sync.js (tested); this file only does the calls, counts every one, and refuses the 8th.
//
//   node "Cloud/Device Sync.mjs"            dry run: reads, plans, prints, writes nothing
//   node "Cloud/Device Sync.mjs" --apply    applies the signals and records the audit row
//
// Env (cloud secrets, never printed): COCO_URL, COCO_SERVICE_KEY.  Nova's address comes from Lounge/nova.json.
// Calls per cycle: 3 reads (devices, the version Nova announces, last audit row = scheduler state) + at most 2 batched
// signal writes + 1 audit insert = 6, hard cap 7. A cycle that is not due costs 1 read. No AI/model calls, no downloads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// device-sync.js is a browser script (the folder is ES-module typed), loaded the way the tests load it
export function loadModule() {
  const mod = { exports: {} };
  new Function('module', fs.readFileSync(path.join(here, '..', 'Lounge', 'device-sync.js'), 'utf8')).call({}, mod);
  return mod.exports;
}

const missingTable = (r) => r.status === 404 || (r.json && /PGRST20[45]|does not exist|schema cache/i.test(JSON.stringify(r.json)));

/** One cycle. `request(method, path, body)` -> { status, json }. Pure of the network apart from that. */
export async function runCycle({ request, now = Date.now(), S = loadModule(), apply = false, runner = 'cloud-runner', cap = S.BUDGET.max, rand = Math.random, log = () => {} }) {
  const calls = { reads: 0, writes: 0 };
  const call = (kind, ...args) => {
    if (calls.reads + calls.writes >= cap) throw new Error('call budget of ' + cap + ' reached, stopping before another call');
    calls[kind]++; return request(...args);
  };
  const out = { calls, applied: [], skipped: null, error: null, auditStored: false, plan: null };
  try {
    // 1. scheduler state = the last audit row (1 read). A missing table means audit storage is not applied yet.
    const last = await call('reads', 'GET', 'device_sync_audit?select=state,at&order=at.desc&limit=1');
    out.auditTable = !missingTable(last);
    const state = out.auditTable && Array.isArray(last.json) && last.json[0] ? last.json[0].state : null;
    if (!S.due(state, now)) { out.skipped = 'not due until ' + new Date(state.nextCheckAt).toISOString(); return out; }   // one cheap read, nothing else
    const lease = S.acquireLease(state, runner, now); if (!lease.ok) { out.skipped = 'another scheduler holds the lease'; return out; }

    // 2. the devices, one batched read; 3. the version Nova actually announces to devices
    const dv = await call('reads', 'GET', 'devices?select=id,kind,name,active,last_seen,app_version,update_state,update_result,info&order=id');
    if (dv.status >= 300 || !Array.isArray(dv.json)) throw new Error('device read failed (' + dv.status + ')');
    const rel = await call('reads', 'GET', '@nova/api/apk/latest');
    const latest = rel.status < 300 && rel.json ? rel.json.versionName || null : null;
    if (!latest) { out.skipped = 'no release announced: nothing to compare against, no update action taken'; }

    const plan = S.planCycle({ devices: dv.json, latest, now, state: lease.state, rand });
    out.plan = { ...plan, rows: plan.rows.map((r) => ({ ...r })) };
    for (const r of plan.rows) log(`${r.label}: ${r.status}${r.action !== 'none' ? ' (' + r.action + ')' : ''}${r.lastError ? ' - ' + r.lastError : ''}`);   // labels only

    // 4. signals, batched: one PATCH per kind of signal (first signal / retry), never for a current, offline or already-told device
    if (latest && apply) {
      for (const reason of [...new Set(plan.signals.map((x) => x.reason))]) {
        const ids = plan.signals.filter((x) => x.reason === reason).map((x) => x.id);
        const r = await call('writes', 'PATCH', 'devices?id=in.(' + ids.map(encodeURIComponent).join(',') + ')', { update_state: 'UPDATE_REQUIRED', update_release_id: 'coco-' + latest, update_attempt_at: new Date(now).toISOString() });
        if (r.status >= 300) log('signal write failed: ' + r.status); else out.applied.push({ reason, devices: ids.length });
      }
    }
    // 5. the audit row (generic labels only, no internal ids, no emails), carrying the next scheduler state
    if (apply && out.auditTable) {
      const total = calls.reads + calls.writes + 1;
      const row = { runner, latest_version: latest, calls_reads: calls.reads, calls_writes: calls.writes + 1, calls_total: total, budget_ok: total <= cap, stale: plan.stale,
        devices: plan.rows.map(({ id, ...rest }) => rest), state: plan.nextState, next_check_at: new Date(plan.nextCheckAt).toISOString(), current_count: plan.current, total: plan.total };
      const w = await call('writes', 'POST', 'device_sync_audit', row);
      out.auditStored = w.status < 300; if (!out.auditStored) log('audit write failed: ' + w.status);
    } else if (apply) log('audit storage is not applied yet: state cannot persist, so this cycle is not repeatable until the migration is applied');
  } catch (e) { out.error = String(e.message || e); }
  return out;
}

// ---- command line ----
// Cloud runs go through Nova (the REST gateway is restricted): NOVA_DEVICE_KEY (+ NOVA_ENGINE_KEY for writes) are the cloud worker's own secrets.
// A direct COCO_URL + COCO_SERVICE_KEY works too. Neither key is ever printed.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes('--apply'), env = process.env, nova = (JSON.parse(fs.readFileSync(path.join(here, '..', 'Lounge', 'nova.json'), 'utf8')).url || '').replace(/\/$/, '');
  const viaNova = !!env.NOVA_DEVICE_KEY;
  if (!viaNova && !(env.COCO_URL && env.COCO_SERVICE_KEY)) { console.error('Set NOVA_DEVICE_KEY (+ NOVA_ENGINE_KEY) or COCO_URL + COCO_SERVICE_KEY. Nothing was called.'); process.exit(2); }
  const request = async (method, p, body) => {
    const isNova = p.startsWith('@nova');
    const url = isNova ? nova + p.slice(5) : (viaNova ? nova + '/rest/v1/' : env.COCO_URL.replace(/\/$/, '') + '/rest/v1/') + p;
    const headers = viaNova ? { 'x-device-key': env.NOVA_DEVICE_KEY, ...(env.NOVA_ENGINE_KEY ? { 'x-engine-key': env.NOVA_ENGINE_KEY } : {}), 'content-type': 'application/json', prefer: 'return=minimal' }
      : isNova ? {} : { apikey: env.COCO_SERVICE_KEY, authorization: 'Bearer ' + env.COCO_SERVICE_KEY, 'content-type': 'application/json', prefer: 'return=minimal' };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
  const res = await runCycle({ request, apply, runner: env.GITHUB_RUN_ID ? 'gh-' + env.GITHUB_RUN_ID : 'local', log: (m) => console.log(m) });
  console.log(JSON.stringify({ calls: res.calls, total: res.calls.reads + res.calls.writes, applied: res.applied, skipped: res.skipped, error: res.error, auditStored: res.auditStored, devices: res.plan && res.plan.current + '/' + res.plan.total + ' current' }));
  process.exit(res.error ? 1 : 0);
}
