// Run: node "Cloud/Device Sync.test.mjs"   The runner against a fake Coco Cloud: real call counting, budget, interval, backoff, privacy.
import assert from 'node:assert';
import { runCycle, loadModule } from './Device Sync.mjs';

const S = loadModule(), MIN = 60000, t0 = Date.parse('2026-11-04T12:00:00Z');
// personal names are built from pieces so this file itself holds none (the test proves they never come out)
const PERSON = [['ma', 'ngesh'], ['shre', 'ya']].map((p) => p.join(''));
const personal = new RegExp(PERSON.join('|'), 'i');

// ---- a fake cloud: devices, announced version, audit table ----
function cloud({ versions = {}, auditTable = true, announce = '2.10.0', offline = [], states = {}, results = {} } = {}) {
  const log = [], audit = [];
  const ids = [PERSON[0] + '-pc', PERSON[0] + '-phone', PERSON[1] + '-pc', PERSON[1] + '-phone'];   // legacy ids, deliberately carrying names
  const names = ['Boss PC (Lenovo)', 'Boss phone', 'Big Boss PC', 'Big Boss phone'], kinds = ['pc', 'phone', 'pc', 'phone'];
  const devices = (now) => ids.map((id, i) => ({ id, kind: kinds[i], name: names[i], active: true, app_version: versions[id] || (kinds[i] === 'pc' ? 'desktop-2.10.0' : 'android-2.10.0'),
    last_seen: new Date(offline.includes(id) ? now - 5 * 24 * 60 * MIN : now - 20000).toISOString(), update_state: states[id] || null, update_result: results[id] || null, info: {} }));
  const request = (now) => async (method, p, body) => {
    log.push([method, p.split('?')[0], body]);
    if (p.startsWith('device_sync_audit')) {
      if (!auditTable) return { status: 404, json: { code: 'PGRST205' } };
      if (method === 'GET') return { status: 200, json: audit.length ? [{ state: audit[audit.length - 1].state, at: audit[audit.length - 1].at }] : [] };
      audit.push({ ...body, at: new Date(now).toISOString() }); return { status: 201, json: null };
    }
    if (p.startsWith('devices?id=in.')) { const want = decodeURIComponent(/in\.\((.*)\)$/.exec(p)[1]).split(','); for (const id of want) states[id] = body.update_state; return { status: 204, json: null }; }
    if (p.startsWith('devices')) return { status: 200, json: devices(now) };
    if (p.startsWith('@nova/api/apk/latest')) return announce ? { status: 200, json: { versionName: announce, versionCode: 21 } } : { status: 503, json: null };
    return { status: 404, json: null };
  };
  return { request, log, audit, states, versions, devices };
}
const cycle = (c, now, o = {}) => runCycle({ request: c.request(now), now, S, rand: () => 0.5, ...o });
const total = (r) => r.calls.reads + r.calls.writes;
const patches = (c) => c.log.filter((l) => l[0] === 'PATCH');

// 1. all four current: minimum calls, nothing sent, audit row records it
{ const c = cloud(); const r = await cycle(c, t0, { apply: true });
  assert.equal(total(r), 4, 'idle cycle = 3 reads + 1 audit insert'); assert.equal(patches(c).length, 0, 'no update signal for current devices');
  assert.equal(r.plan.current, 4); assert.ok(r.auditStored); const row = c.audit[0]; assert.equal(row.calls_total, 4); assert.ok(row.budget_ok); assert.equal(row.devices.length, 4);
  assert.deepEqual(row.devices.map((d) => d.label), ['Boss PC', 'Boss Phone', 'Big Boss PC', 'Big Boss Phone'], 'generic labels only');
  assert.ok(!personal.test(JSON.stringify(c.audit)), 'no personal name or internal id reaches the database record'); assert.ok(!row.devices.some((d) => 'id' in d), 'no internal ids stored'); }

// 2. one outdated: ONE batched write for that device; dry run writes nothing at all
{ const c = cloud({ versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } });
  let r = await cycle(c, t0, { apply: false }); assert.equal(r.calls.writes, 0, 'dry run: zero writes'); assert.equal(patches(c).length, 0); assert.equal(c.audit.length, 0);
  r = await cycle(c, t0, { apply: true }); assert.equal(patches(c).length, 1); assert.match(patches(c)[0][1] + '', /devices/); assert.deepEqual(r.applied, [{ reason: 'signal', devices: 1 }]); assert.equal(total(r), 5);
  assert.equal(patches(c)[0][2].update_state, 'UPDATE_REQUIRED'); assert.equal(patches(c)[0][2].update_release_id, 'coco-2.10.0'); }

// 3. one shared scheduler: a trigger inside the interval costs one read and does nothing; at 15 min it runs
{ const c = cloud(); await cycle(c, t0, { apply: true });
  const early = await cycle(c, t0 + 5 * MIN, { apply: true }); assert.ok(/not due/.test(early.skipped)); assert.equal(total(early), 1, 'extra trigger = one cheap read'); assert.equal(c.audit.length, 1);
  const on = await cycle(c, t0 + 15 * MIN, { apply: true }); assert.equal(on.skipped, null); assert.equal(c.audit.length, 2);
  const nxt = new Date(c.audit[1].next_check_at).getTime() - (t0 + 15 * MIN); assert.equal(nxt, 15 * MIN); }

// 4. two runners at the same moment: the second one arrives after the first has written and stands down
{ const c = cloud(); const a = await cycle(c, t0, { apply: true, runner: 'A' }); const b = await cycle(c, t0 + 1000, { apply: true, runner: 'B' });
  assert.ok(a.auditStored); assert.ok(/not due/.test(b.skipped), 'duplicate scheduler does not run a second cycle'); assert.equal(c.audit.length, 1); }

// 5. offline device: nothing sent, still reported OFFLINE, never counted current
{ const c = cloud({ offline: [PERSON[1] + '-pc'], versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } }); const r = await cycle(c, t0, { apply: true });
  assert.equal(patches(c).length, 0); const row = c.audit[0].devices.find((d) => d.label === 'Big Boss PC'); assert.equal(row.status, 'OFFLINE'); assert.equal(r.plan.current, 3);
  assert.equal(row.lastSync, null, 'never verified, so no last sync'); }

// 6. phone update failure: retried with backoff across cycles (state persists in the audit rows), no storm, other devices unaffected
{ const bp = PERSON[0] + '-phone'; const c = cloud({ versions: { [bp]: 'android-2.9.2' }, states: { [bp]: 'FAILED' }, results: { [bp]: 'install: too many sessions' } });
  const sent = []; for (let i = 0; i < 16; i++) { const now = t0 + i * 15 * MIN; c.states[bp] = 'FAILED'; const r = await cycle(c, now, { apply: true }); if (patches(c).length > sent.length) sent.push(i * 15); assert.equal(r.plan.current, 3, 'other three unaffected'); assert.ok(total(r) <= 7); }
  assert.deepEqual(sent, [0, 15, 45, 105, 225], 'retries at 0, 15, 45, 105, 225 min: exponential, not every cycle'); }

// 7. update applied -> device reports the new version -> verified current with a last-sync time (and no repeat signal while told)
{ const dp = PERSON[1] + '-pc'; const c = cloud({ versions: { [dp]: 'desktop-2.9.0' } });
  await cycle(c, t0, { apply: true }); assert.equal(c.states[dp], 'UPDATE_REQUIRED'); assert.equal(patches(c).length, 1);
  await cycle(c, t0 + 15 * MIN, { apply: true }); assert.equal(patches(c).length, 1, 'already told: no repeat request');
  c.versions[dp] = 'desktop-2.10.0'; c.states[dp] = null; const r = await cycle(c, t0 + 30 * MIN, { apply: true });
  const row = c.audit[c.audit.length - 1].devices.find((d) => d.label === 'Big Boss PC'); assert.equal(row.status, 'CURRENT'); assert.equal(row.lastSync, t0 + 30 * MIN, 'last sync only after the device itself reported the new version'); assert.equal(r.plan.current, 4); }

// 8. call budget is enforced for real: the cap stops the cycle before the extra call
{ const c = cloud({ versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } }); const r = await cycle(c, t0, { apply: true, cap: 4 });
  assert.ok(/call budget/.test(r.error), 'budget stop is reported'); assert.ok(total(r) <= 4, 'never more than the cap: ' + total(r)); assert.equal(c.audit.length, 0, 'no audit after a budget stop'); }
{ let worst = 0; const c = cloud({ versions: { [PERSON[1] + '-pc']: 'desktop-1.0.0', [PERSON[0] + '-phone']: 'android-1.0.0' }, states: { [PERSON[0] + '-phone']: 'FAILED' } });
  for (let i = 0; i < 200; i++) { const r = await cycle(c, t0 + i * 15 * MIN, { apply: true }); worst = Math.max(worst, total(r)); } assert.ok(worst <= 7, 'worst measured cycle ' + worst + ' calls'); }

// 9. announced version unavailable: nothing is compared, nothing is sent
{ const c = cloud({ announce: null, versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } }); const r = await cycle(c, t0, { apply: true }); assert.equal(patches(c).length, 0); assert.ok(/no release announced/.test(r.skipped)); }

// 10. audit storage not applied yet: the cycle still reads and plans, writes no audit, says so
{ const c = cloud({ auditTable: false, versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } }); const logs = []; const r = await cycle(c, t0, { apply: true, log: (m) => logs.push(m) });
  assert.equal(r.auditTable, false); assert.equal(r.auditStored, false); assert.ok(logs.some((m) => /not applied/.test(m))); assert.ok(!personal.test(logs.join('\n')), 'logs carry labels, never names'); }

// 11. a signal write that fails does not stop the audit or the other devices; the failure is not hidden
{ const c = cloud({ versions: { [PERSON[1] + '-pc']: 'desktop-2.9.0' } }); const base = c.request(t0); const bad = async (m, p, b) => (m === 'PATCH' ? { status: 500, json: null } : base(m, p, b)); const logs = [];
  const r = await runCycle({ request: bad, now: t0, S, apply: true, rand: () => 0.5, log: (m) => logs.push(m) }); assert.ok(logs.some((m) => /signal write failed: 500/.test(m))); assert.ok(r.auditStored); assert.deepEqual(r.applied, []); }

console.log('device sync runner tests passed');
