// Run: node chat-org.test.js
// "Ask Coco" organisation commands on the cloud path every device uses (Nova /api/chat -> api/_chat.js engineFor -> the engine
// lifted out of index.html). The org summary is computed from org-unified.fixture.json (the dry-run organisation) exactly the way
// _chat.js ORG_SQL computes it in Postgres.
import assert from 'node:assert';
import fs from 'node:fs';
import { engineFor, forgetWorlds } from './api/_chat.js';

const fx = JSON.parse(fs.readFileSync(new URL('./org-unified.fixture.json', import.meta.url), 'utf8'));
const live = (p) => !['merged', 'retired'].includes(p.status), rd = new Map(fx.ready.map((r) => [r.entity + ':' + r.id, r]));
const within = (h, unitId) => unitId === h.id || unitId.startsWith(h.id + '.');
const ORG = {
  houses: fx.units.filter((u) => u.kind === 'house').map((h) => { const ps = fx.products.filter((p) => live(p) && within(h, p.unit_id));
    return { id: h.id, name: h.display_name, products: ps.length, ready: ps.filter((p) => (rd.get('product:' + p.id) || {}).readiness === 'CLOUD_READY').length }; }),
  readiness: fx.ready.reduce((a, r) => ((a[r.readiness] = (a[r.readiness] || 0) + 1), a), {}),
  brains: fx.brains.filter((b) => b.state !== 'retired').length,
  not_ready_count: fx.ready.filter((r) => r.readiness !== 'CLOUD_READY').length,
  not_ready: fx.ready.filter((r) => r.readiness !== 'CLOUD_READY').slice(0, 8),
  open_decisions: fx.recon.filter((q) => q.status === 'open').length };
const WORLD = { approvals: [{ id: 7, code: 'A-777', team: 'youtube', what: 'Publish the Short', state: 'waiting' }], devices: [], integrations: [], policies: [], structure: [], conns: [], links: [],
  outputs: [], tasks: [], jobs: [], run_requests: [], activity: [], brain: [], runs: [], release: null, founders: [{ email: 'boss@example.com', name: 'Mangesh', call_me: 'Boss' }] };
let mode = 'applied';
const run = async ({ sql }) => {
  if (/^SELECT\s+\(SELECT coalesce/.test(sql)) return [JSON.parse(JSON.stringify(WORLD))];
  if (/to_regclass\('public\.org_readiness'\)/.test(sql)) { if (mode === 'throws') throw new Error('relation does not exist'); return [{ ok: mode === 'applied' }]; }
  if (/'open_decisions'/.test(sql)) return [{ org: ORG }];
  throw new Error('unexpected SQL ' + sql.slice(0, 60));
};
const ask = async (text) => { forgetWorlds(); const { E } = await engineFor({ run, rpc: async () => ({}), email: 'boss@example.com', device: 'boss-phone' }); return { a: await E.chatSend(text), it: E.chatIntentOf(text) }; };
let n = 0; const ok = (m) => console.log(`ok ${++n} - ${m}`);

let r = await ask('show all seven houses readiness');
assert.equal(r.it.intent, 'organisation'); assert.match(r.a.text, /8 Houses, 288 brains\. 67 of 288 units and products are ready for cloud work \(connected, not yet tested\)\. 33 organisation decisions are open\./);
assert.ok(r.a.cards.some((c) => /Lulu/.test(c.t) && /\/\d+ products ready/.test(c.v) && c.go === '#structure'));
ok(`readiness: "${r.a.text}"`);
r = await ask('show every disconnected brain'); assert.equal(r.it.intent, 'organisation'); assert.match(r.a.text, /^221 of 288 units and products cannot take cloud work yet\. /);
ok('"show every disconnected brain" lists what cannot take work and why (not the Brain memory search, not Integrations)');
r = await ask('pending organisation decisions'); assert.equal(r.it.intent, 'organisation'); assert.match(r.a.text, /^33 organisation questions wait for your decision/);
ok('"pending organisation decisions" is an organisation question, not the approvals list');
r = await ask('show pending approvals'); assert.equal(r.it.intent, 'approvals'); ok('approvals still go to approvals');
mode = 'missing'; r = await ask('show all seven houses readiness'); assert.match(r.a.text, /not applied in Coco Cloud yet/);
mode = 'throws'; r = await ask('organisation readiness'); assert.match(r.a.text, /not applied in Coco Cloud yet/);
ok('before the migration (tables missing, or the probe failing) Coco says it is not applied; chat keeps working');
console.log(`\n${n} checks passed`);
