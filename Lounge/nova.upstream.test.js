// Run: node nova.upstream.test.js  (no network: a scripted stand-in database)
import assert from 'node:assert/strict';
import { handle, sha256, invalidate, resetUpstream, stats } from './api/_nova.js';
let pass = 0, fail = 0;
const t = async (name, fn) => { resetUpstream(); invalidate(); try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.message}`); } };
const KEY = 'device-key-0123456789abcdef-up';
const mk = ({ failWith = null, delay = 0 } = {}) => { const o = { selects: 0, failWith, async query(text, params = []) {
  if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'boss-pc', owner_email: 'boss@example.com', name: 'Boss PC' }] : [] };
  if (/^SELECT 1 AS ok/.test(text)) { if (o.failWith) throw o.failWith; return { rows: [{ ok: 1 }] }; }
  if (/^SELECT \* FROM public/.test(text)) { o.selects++; if (delay) await new Promise((r) => setTimeout(r, delay)); if (o.failWith) throw o.failWith; return { rows: [{ id: 'h1' }] }; }
  return { rows: [] }; } }; return o; };
const get = (path = '/rest/v1/houses', key = KEY) => ({ method: 'GET', path, query: {}, headers: { 'x-device-key': key }, body: null });

await t('coalesces identical concurrent reads into one database query', async () => {
  const db = mk({ delay: 20 }), before = stats.coalesced_reads;
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => handle(db, get())));
  assert.ok(rs.every((r) => r.status === 200)); assert.equal(db.selects, 1); assert.equal(stats.coalesced_reads - before, 4);
});
await t('15 s cache still answers repeats and counts hits', async () => {
  const db = mk(), h = stats.cache_hits; await handle(db, get()); await handle(db, get());
  assert.equal(db.selects, 1); assert.equal(stats.cache_hits - h, 1);
});
await t('upstream failure is a clear 503 with Retry-After, no secrets, then a negative cache skips the database', async () => {
  const db = mk({ failWith: new Error('connect ECONNREFUSED postgresql://postgres:hunter2@db.example.com:5432/postgres') }), f = stats.upstream_failures;
  const r = await handle(db, get()); const b = JSON.parse(r.body);
  assert.equal(r.status, 503); assert.equal(b.state, 'UPSTREAM_UNAVAILABLE'); assert.ok(b.reason); assert.ok(r.headers['retry-after']);
  assert.ok(!/hunter2|postgres|ECONNREFUSED|at /.test(r.body));
  assert.equal(stats.upstream_failures - f, 1);
  const n = stats.negative_hits, calls = db.selects; const r2 = await handle(db, get());
  assert.equal(r2.status, 503); assert.equal(db.selects, calls); assert.equal(stats.negative_hits - n, 1);
});
await t('quota error maps to 503 with a quota reason', async () => {
  const r = await handle(mk({ failWith: new Error('402 exceed_egress_quota') }), get());
  assert.equal(r.status, 503); assert.match(JSON.parse(r.body).reason, /quota/);
});
await t('negative cache expires, health still answers during it, stats exposed', async () => {
  const db = mk({ failWith: new Error('ECONNREFUSED') }); const t0 = Date.now(); await handle(db, get(), t0);
  db.failWith = null;
  assert.equal((await handle(db, get(), t0 + 1000)).status, 503);
  const h = JSON.parse((await handle(db, { method: 'GET', path: '/api/health', query: {}, headers: {}, body: null }, t0 + 1000)).body);
  assert.ok('upstream_failures' in h.stats && 'coalesced_reads' in h.stats && 'cache_hits' in h.stats && h.down_for_s > 0);
  assert.equal((await handle(db, get(), t0 + 11000)).status, 200);
});
await t('auth is still required during and outside an outage; non-upstream errors are not 503', async () => {
  assert.equal((await handle(mk(), get('/rest/v1/houses', ''))).status, 401);
  assert.equal((await handle(mk(), get('/rest/v1/houses', 'wrong-key-xxxxxxxxxxxxxxx'))).status, 401);
  assert.equal((await handle(mk({ failWith: new Error('permission denied for table houses') }), get())).status, 403);
});
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
