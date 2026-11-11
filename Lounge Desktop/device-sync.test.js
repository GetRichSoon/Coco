// Run: node device-sync.test.js (from Lounge Desktop)   Scenarios from Boss's 4-device sync order (2026-11-04), driven through the real planCycle().
const assert = require('assert'), fs = require('fs'), path = require('path');
const mod = { exports: {} }; new Function('module', fs.readFileSync(path.join(__dirname, '..', 'Lounge', 'device-sync.js'), 'utf8')).call({}, mod); const S = mod.exports;   // browser script, loaded the way heal.test.js loads heal.js
const MIN = 60000, now0 = Date.parse('2026-11-04T12:00:00Z');
const iso = (t) => new Date(t).toISOString();
const NAMES = { 'boss-pc': 'Boss PC (Lenovo)', 'boss-phone': 'Boss phone', 'bigboss-pc': 'Big Boss PC', 'bigboss-phone': 'Big Boss phone' };
const dev = (id, kind, v, o = {}) => ({ id, kind, name: NAMES[id] || id, active: true, app_version: v, last_seen: iso(now0 - 30000), update_state: null, ...o });
const four = (o = {}) => [dev('boss-pc', 'pc', 'desktop-2.10.0', o.pc), dev('boss-phone', 'phone', 'android-2.10.0', o.mp), dev('bigboss-pc', 'pc', 'desktop-2.10.0', o.sp), dev('bigboss-phone', 'phone', 'android-2.10.0', o.sf),
  { id: 'cloud-worker-1', kind: 'pc', active: true, info: { cloud: true }, app_version: null, last_seen: iso(now0 - 1000) }];
const fresh = (t) => ({ last_seen: iso(t - 30000) });
const cyc = (devices, state, now = now0, extra = {}) => S.planCycle({ devices, latest: '2.10.0', now, state, rand: () => 0.5, ...extra });

// registry: exactly the four app devices, the cloud runner is never counted
let r = cyc(four());
assert.equal(r.total, 4); assert.ok(r.registryOk, 'four authorized devices'); assert.ok(!r.rows.some((x) => x.id === 'cloud-worker-1'), 'runner is not a device');

// 1. all four current: zero update signals, minimum calls, nothing "sent" to anyone
assert.equal(r.current, 4); assert.equal(r.signals.length, 0, 'current devices get no update signal');
assert.deepEqual(r.calls, { reads: 3, writes: 1, batches: 0, total: 4 }, 'idle cycle = 3 reads + 1 audit write'); assert.ok(r.budget.ok);
assert.ok(r.rows.every((x) => x.lastSync === now0), 'last sync recorded from the device\'s own report');

// interval 10-20 min, jittered, enforced
for (const u of [0, 0.25, 0.5, 0.75, 1]) { const d = S.planCycle({ devices: four(), latest: '2.10.0', now: now0, state: null, rand: () => u }).nextCheckAt - now0; assert.ok(d >= 10 * MIN && d <= 20 * MIN, 'interval ' + d / MIN); }
assert.equal(r.nextCheckAt - now0, 15 * MIN, 'target 15 min');
assert.ok(!S.due(r.nextState, now0 + 5 * MIN), 'a trigger 5 min later does nothing (no extra calls)'); assert.ok(S.due(r.nextState, now0 + 15 * MIN), 'due at 15 min'); assert.ok(S.due(null, now0), 'first run is due');

// 2. one outdated: only that one is signalled
r = cyc(four({ sp: { app_version: 'desktop-2.9.0' } }));
assert.deepEqual(r.signals.map((x) => x.id), ['bigboss-pc']); assert.equal(r.rows.find((x) => x.id === 'bigboss-pc').status, 'OUTDATED'); assert.equal(r.current, 3);
assert.deepEqual(r.calls, { reads: 3, writes: 2, batches: 1, total: 5 });
// already told (cloud has set UPDATE_REQUIRED) or already working -> no repeat request
for (const st of ['UPDATE_REQUIRED', 'DOWNLOADING', 'INSTALLING', 'RESTART_REQUIRED']) { r = cyc(four({ sp: { app_version: 'desktop-2.9.0', update_state: st } })); assert.equal(r.signals.length, 0, 'no repeat while ' + st); }

// 3. one offline: nothing sent, status kept honest, last good time preserved, other three unaffected
let s1 = cyc(four()).nextState;
const t2 = now0 + 15 * MIN; r = cyc(four({ pc: fresh(t2), mp: fresh(t2), sf: fresh(t2), sp: { last_seen: iso(t2 - 6 * 60 * MIN) } }), s1, t2);
const off = r.rows.find((x) => x.id === 'bigboss-pc'); assert.equal(off.status, 'OFFLINE'); assert.equal(off.lastSync, now0, 'offline device keeps its last verified time'); assert.equal(r.signals.length, 0);
assert.equal(r.current, 3, 'offline is never counted as updated');

// 4. failed update: retried with exponential backoff, no retry storm, other devices unaffected
const failed = (n) => four({ mp: { app_version: 'android-2.9.2', update_state: 'FAILED', update_result: 'install: Too many active sessions for UID 10406' }, ...n });
let st = null, t = now0, sent = [];
for (let i = 0; i < 16; i++) { const x = cyc(failed({ pc: fresh(t), sp: fresh(t), sf: fresh(t), mp: { ...fresh(t), app_version: 'android-2.9.2', update_state: 'FAILED', update_result: 'install: Too many active sessions for UID 10406' } }), st, t); if (x.signals.length) sent.push([Math.round((t - now0) / MIN), x.signals[0].reason]); st = x.nextState; t += 15 * MIN; assert.equal(x.rows.find((y) => y.id === 'boss-phone').status, 'ERROR'); assert.equal(x.current, 3, 'one failure never blocks the other three'); }
assert.deepEqual(sent.map((a) => a[0]), [0, 15, 45, 105, 225], 'retries at 0, +15, +30, +60, +120 min gaps (exponential)'); assert.ok(sent.length < 16, 'no retry storm');
assert.match(cyc(failed(), null).rows.find((y) => y.id === 'boss-phone').lastError, /Too many active sessions/, 'last error is the real one');
assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(S.backoff).map((m) => m / MIN), [15, 30, 60, 120, 240, 360, 360], 'backoff capped at 6 h');

// 5. device reconnects after being offline: seen again and behind -> signalled on the very next cycle, not before
const offline = four({ sp: { app_version: 'desktop-2.9.0', last_seen: iso(now0 - 3 * 60 * MIN) } });
let a = cyc(offline); assert.equal(a.signals.length, 0, 'offline: nothing sent'); assert.equal(a.rows.find((x) => x.id === 'bigboss-pc').status, 'OFFLINE');
const t3 = now0 + 15 * MIN, back = four({ pc: fresh(t3), mp: fresh(t3), sf: fresh(t3), sp: { app_version: 'desktop-2.9.0', last_seen: iso(t3 - 20000) } });
a = cyc(back, a.nextState, now0 + 15 * MIN); assert.deepEqual(a.signals.map((x) => x.id), ['bigboss-pc'], 'reconnected + outdated -> signalled');
// and verified current only after its OWN report catches up
const t4 = now0 + 30 * MIN; a = cyc(four({ pc: fresh(t4), mp: fresh(t4), sf: fresh(t4), sp: fresh(t4) }), a.nextState, t4); assert.equal(a.rows.find((x) => x.id === 'bigboss-pc').status, 'CURRENT'); assert.equal(a.rows.find((x) => x.id === 'bigboss-pc').lastSync, now0 + 30 * MIN);

// 6. duplicate scheduler prevention
let L = S.acquireLease(null, 'runner-A', now0); assert.ok(L.ok);
assert.ok(!S.acquireLease(L.state, 'runner-B', now0 + MIN).ok, 'second scheduler refused while the lease is held'); assert.ok(S.acquireLease(L.state, 'runner-A', now0 + MIN).ok, 'holder can renew');
assert.ok(S.acquireLease(L.state, 'runner-B', now0 + 6 * MIN).ok, 'a dead scheduler\'s lease expires, a new one takes over');
assert.equal(cyc(four(), L.state).nextState.lease, null, 'lease released at the end of a cycle');

// 7. server version changes during the cycle: nothing is marked verified, re-check at the shortest interval
r = S.planCycle({ devices: four(), latest: '2.10.0', latestNow: '2.11.0', now: now0, state: null, rand: () => 0.5 });
assert.ok(r.stale); assert.equal(r.current, 0, 'nothing verified against a moving target'); assert.ok(r.rows.every((x) => x.lastSync === null)); assert.equal(r.nextCheckAt - now0, 10 * MIN);

// 8. partial update / rollback: a device that took the update but reports the old version is NOT current; rollback = it simply stays behind and is retried
r = cyc(four({ mp: { app_version: 'android-2.9.2', update_state: 'INSTALLED_UNVERIFIED' } }));
assert.equal(r.rows.find((x) => x.id === 'boss-phone').status, 'OUTDATED', 'claimed state is ignored, only the reported version counts'); assert.equal(r.rows.find((x) => x.id === 'boss-phone').lastSync, null);
assert.equal(S.cmp('2.10.0', '2.9.9'), 1, 'versions compare numerically (2.10 > 2.9)'); assert.equal(S.cmp('android-2.9.2', '2.10.0'), -1); assert.equal(S.cmp('lounge-x', '2.10.0'), null);
assert.equal(cyc(four({ mp: { app_version: 'weird' } })).rows.find((x) => x.id === 'boss-phone').status, 'UNKNOWN', 'unparseable version is UNKNOWN, never assumed');

// 9. restart recovery: state survives JSON round trip and keeps backoff + last good
const roundtrip = JSON.parse(JSON.stringify(cyc(failed(), null).nextState)); const t5 = now0 + 15 * MIN; r = cyc(failed({ pc: fresh(t5), sp: fresh(t5), sf: fresh(t5), mp: { ...fresh(t5), app_version: 'android-2.9.2', update_state: 'FAILED', update_result: 'x' } }), roundtrip, t5);
assert.equal(r.signals.length, 1, 'after a restart the backoff schedule continues (15 min after the first failure)'); const t6 = now0 + 5 * MIN; assert.equal(cyc(failed({ pc: fresh(t6), sp: fresh(t6), sf: fresh(t6), mp: { ...fresh(t6), app_version: 'android-2.9.2', update_state: 'FAILED', update_result: 'x' } }), roundtrip, t6).signals.length, 0, 'still inside backoff after a restart');

// 10. call budget enforced even if everything is behind
const all = four({ pc: { app_version: 'desktop-2.0.0' }, mp: { app_version: 'android-2.0.0' }, sp: { app_version: 'desktop-2.0.0' }, sf: { app_version: 'android-2.0.0' } });
r = cyc(all); assert.ok(r.budget.ok && r.calls.total <= S.BUDGET.max, 'worst case ' + r.calls.total + ' calls <= ' + S.BUDGET.max); assert.equal(r.signals.length, 4);
assert.deepEqual(r.calls, { reads: 3, writes: 2, batches: 1, total: 5 }, 'four signals travel in ONE batched write: 3 reads + 1 batch + 1 audit');

// 11. scheduler health: silence is detected
assert.ok(!S.health(null, now0).ok); assert.ok(S.health({ lastCycleAt: now0 }, now0 + 30 * MIN).ok); assert.ok(!S.health({ lastCycleAt: now0 }, now0 + 41 * MIN).ok, 'stalled scheduler is reported');

// privacy: only the four generic labels ever come out, never a person's name
const labels = S.registry(four()).map(S.label); assert.deepEqual(labels, ['Boss PC', 'Boss Phone', 'Big Boss PC', 'Big Boss Phone']);
assert.equal(S.label({ name: 'Coco cloud worker', kind: 'pc' }), 'Coco cloud worker'); const PN = [['mange', 'sh'].join(''), ['shre', 'ya'].join('')], pn = new RegExp(PN.join('|'), 'i'); assert.ok(!pn.test(S.label({ name: PN[1] + ' laptop', kind: 'pc' })), 'a personal name is masked even on an unexpected legacy label');
{ const out = JSON.stringify(cyc(failed(), null).rows.map((x) => [x.label, x.lastError])); assert.ok(!pn.test(out), 'plan output never contains a personal name'); }
// retries and first signals are different batches: worst case 3 reads + 2 batches + 1 audit = 6 <= 7
{ const mix = four({ pc: { app_version: 'desktop-2.0.0' }, mp: { app_version: 'android-2.9.2', update_state: 'FAILED', update_result: 'x' } }); const w = cyc(mix); assert.equal(w.calls.batches, 2); assert.ok(w.calls.total <= 7, 'worst case ' + w.calls.total); }
// the real registry today (read from Coco Cloud 2026-11-04): four devices + one runner
const real = [{ id: 'cloud-worker-1', kind: 'pc', active: true, info: { cloud: true } }, { id: 'boss-pc', kind: 'pc', active: true }, { id: 'boss-phone', kind: 'phone', active: true }, { id: 'bigboss-pc', kind: 'pc', active: true }, { id: 'bigboss-phone', kind: 'phone', active: true }];
assert.deepEqual(S.registry(real).map((d) => d.id), ['boss-pc', 'boss-phone', 'bigboss-pc', 'bigboss-phone']);
console.log('device-sync tests passed');
