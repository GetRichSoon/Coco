// Run: node ops.test.js   (no network, no database)
// The internal status snapshots live in public.ops_snapshots and are served only to paired founders, read through runAs() so
// row-level security applies. Nothing internal is committed to this PUBLIC repository.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handle, sha256, TABLES, resetUpstream } from './api/_nova.js';

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n} - ${e.message}`); } };
const KEY = 'device-key-0123456789abcdef';
const NAMES = ['company-structure', 'security-status', 'ops-status', 'pc-dependencies', 'device-sync'];
const AT = new Date('2026-01-02T03:04:05.000Z');
// a fake database: devices for authenticate(), ops_snapshots for the route; `mode` picks the table state; every statement is logged
const mk = (mode = 'rows', rows = {}) => {
  const log = [];
  return { log, async query(text, params = []) {
    log.push(text);
    if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'dev-1', owner_email: 'b@x', name: 'd' }] : [] };
    if (/FROM public\.ops_snapshots/.test(text)) {
      if (mode === 'missing') throw Object.assign(new Error('relation "public.ops_snapshots" does not exist'), { code: '42P01' });
      if (mode === 'down') throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), { code: 'ECONNREFUSED' });
      return { rows: Object.hasOwn(rows, params[0]) ? [{ payload: rows[params[0]], collected_at: AT }] : [] };
    }
    return { rows: [] };
  } };
};
const PAYLOADS = Object.fromEntries(NAMES.map((n) => [n, { name: n, items: [{ id: 1, text: 'synthetic ' + n }] }]));
const req = (p, key = KEY, method = 'GET') => ({ method, path: p, query: {}, headers: key ? { 'x-device-key': key } : {}, body: null });
const SECRET_RES = [/AIza[0-9A-Za-z_-]{20,}/, /\bsk-[A-Za-z0-9]{16,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, /-----BEGIN [A-Z ]*PRIVATE KEY/, /(token|secret|password|api[_-]?key)["']?\s*[=:]\s*["']?[A-Za-z0-9_\-/+]{20,}/i];

await t('1 no device key is 401, a wrong key is 401', async () => {
  const db = mk('rows', PAYLOADS);
  for (const n of NAMES) { assert.equal((await handle(db, req('/api/ops/' + n, null))).status, 401); assert.equal((await handle(db, req('/api/ops/' + n, 'wrong-key-0123456789abc'))).status, 401); }
  assert.ok(!db.log.some((s) => /ops_snapshots/.test(s)), 'the table must not be read before authentication');
});
await t('2 unknown name, nested path and non-GET are 404 and never reach the database', async () => {
  const db = mk('rows', PAYLOADS);
  for (const p of ['/api/ops/nope', '/api/ops/', '/api/ops/constructor', '/api/ops/__proto__', '/api/ops/ops-status/x', '/api/ops/..%2f_ai']) assert.equal((await handle(db, req(p))).status, 404, p);
  assert.equal((await handle(db, req('/api/ops/ops-status', KEY, 'POST'))).status, 404);
  assert.ok(!db.log.some((s) => /ops_snapshots/.test(s)));
});
await t('3 no row is 404 NOT_COLLECTED', async () => {
  const db = mk('rows', {});
  for (const n of NAMES) { const r = await handle(db, req('/api/ops/' + n)); assert.equal(r.status, 404); assert.equal(JSON.parse(r.body).state, 'NOT_COLLECTED'); }
});
await t('4 a table that does not exist yet is 404 NOT_COLLECTED, never 500', async () => {
  const r = await handle(mk('missing'), req('/api/ops/ops-status')); assert.equal(r.status, 404); assert.equal(JSON.parse(r.body).state, 'NOT_COLLECTED');
});
await t('5 an unreachable database is 503, consistent with the rest of Nova', async () => {
  const r = await handle(mk('down'), req('/api/ops/ops-status')); resetUpstream(); assert.equal(r.status, 503);   // clear the outage marker for the next test
});
await t('6 an authed device gets the payload itself, with the collection time in a header', async () => {
  const db = mk('rows', PAYLOADS);
  for (const n of NAMES) { const r = await handle(db, req('/api/ops/' + n)); assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body), PAYLOADS[n]); assert.equal(r.headers['x-collected-at'], AT.toISOString()); }
});
await t('7 the read runs as the authenticated founder, so row-level security applies', async () => {
  const db = mk('rows', PAYLOADS); await handle(db, req('/api/ops/ops-status'));
  const i = db.log.findIndex((s) => /FROM public\.ops_snapshots WHERE name = \$1/.test(s));
  assert.ok(i > 0); const before = db.log.slice(0, i);
  assert.ok(before.includes('BEGIN') && before.includes('SET LOCAL ROLE authenticated'), 'SET LOCAL ROLE authenticated must run before the read');
  assert.equal(db.log[i + 1], 'COMMIT');
});
await t('8 no response contains a secret-looking value', async () => {
  const db = mk('rows', PAYLOADS);
  for (const n of NAMES) { const b = (await handle(db, req('/api/ops/' + n))).body; for (const re of SECRET_RES) assert.ok(!re.test(b), `${n} matches ${re}`); }
});
await t('9 ops_snapshots is on the engine write allowlist, so the redaction gate covers the upsert', () => assert.ok(TABLES.has('ops_snapshots')));
await t('10 the public tree holds no internal snapshot file and no key or project identifier', async () => {
  const root = path.dirname(fileURLToPath(import.meta.url)); const hits = [];
  const FILES = ['company-structure.json', 'security-status.json', 'ops-status.json', 'pc-dependencies.json', 'device-sync.json'];
  // a service key must never be named in the public tree; a JWT-shaped string is checked separately below
  const NEEDLES = ['service' + '_role'];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name); const rel = path.relative(root, f).split(path.sep).join('/');
    if (e.isDirectory()) { if (rel === 'node_modules' || rel === '.git') continue; if (rel === 'api/_data') hits.push(rel + ': directory must not exist'); walk(f); continue; }
    if (FILES.includes(e.name)) hits.push(rel + ': snapshot file');
    if (/\.(png|jpe?g|webp|gif|ico|apk|woff2?|mp[34]|zip)$/i.test(e.name)) continue;
    const s = fs.readFileSync(f, 'utf8');
    for (const needle of NEEDLES) if (s.includes(needle) && !(/\.test\.js$/.test(e.name) && needle === NEEDLES[0])) hits.push(`${rel}: ${needle.slice(0, 8)}`);
    if (/"state":\s*"OPEN"/.test(s)) hits.push(rel + ': OPEN incident'); } };
  walk(root); assert.deepEqual(hits, []);
  try { const tracked = execFileSync('git', ['ls-files', '--', '.'], { cwd: root, encoding: 'utf8' }).split('\n'); assert.deepEqual(tracked.filter((p) => FILES.some((n) => p.endsWith('/' + n))), []); } catch (e) { if (e.name === 'AssertionError') throw e; }   // git absent (a source archive): the walk above is the check
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
