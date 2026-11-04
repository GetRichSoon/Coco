// Run: node nova.redact.test.js   (no network, no database)
//
// The redaction gate: every table write any team makes through Nova is cleaned before it reaches SQL. Synthetic
// credentials are assembled at run time so this file never holds a real-looking secret.
import assert from 'node:assert/strict';
import { handle, sha256, invalidate, RPC_CREDENTIAL_OK } from './api/_nova.js';
import { redactText, redactDeep, PLACEHOLDER } from './api/_redact.js';

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n} - ${e.message}`); } };
const A = (...p) => p.join('');
const GUM = A('Zq9', 'Lm2', 'Xv7', 'Bn4', 'Kd8', 'Wp3', 'Rt6', 'Yh1'), GOOGLE = A('AI', 'za', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'), GH = A('gh', 'p_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8');
const JWT = A('ey', 'Jhbgc', 'iOiJIUzI1NiJ9.', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0.', 'abcDEF123456xyz');
const KEY = 'device-key-0123456789abcdef';
const fakeDb = () => { const sql = []; return { sql, async query(text, params = []) { sql.push({ text, params });
  if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'boss-pc', owner_email: 'b@x', name: 'PC' }] : [] };
  return { rows: [] }; } }; };
const post = (table, body, method = 'POST') => ({ method, path: `/rest/v1/${table}`, query: method === 'PATCH' ? { id: 'eq.1' } : {}, headers: { 'x-device-key': KEY, prefer: '' }, body });
const sentJson = (db) => db.sql.filter((s) => /jsonb_populate_recordset|UPDATE public/.test(s.text)).flatMap((s) => s.params).join(' | ');

await t('1 the shapes that leaked before: an env style name and a JSON key are caught', () => {
  assert.notEqual(redactText(`GUMROAD_ACCESS_TOKEN=${GUM}`).text.includes(GUM), true);
  assert.equal(redactText(`{"access_token": "${GUM}"}`).text.includes(GUM), false);
  assert.equal(redactText(`and today it correctly gets null -> token=${GUM}`).text.includes(GUM), false);
});
await t('2 known credential shapes are replaced and only their TYPES are reported', () => {
  const r = redactDeep({ a: `key ${GOOGLE}`, b: [`x ${GH}`, { c: JWT }], n: 5, ok: 'a harmless sentence' });
  const s = JSON.stringify(r.value); for (const v of [GOOGLE, GH, JWT]) assert.equal(s.includes(v), false);
  assert.ok(r.findings.includes('google_api_key') && r.findings.includes('github_token') && r.findings.includes('jwt'));
  assert.equal(r.value.n, 5); assert.equal(r.value.ok, 'a harmless sentence'); assert.ok(s.includes(PLACEHOLDER));
});
await t('3 a write through Nova reaches SQL already clean (insert and update), for any table', async () => {
  for (const [table, method] of [['activity', 'POST'], ['ai_calls', 'POST'], ['outputs', 'PATCH']]) {
    const db = fakeDb(); invalidate();
    const r = await handle(db, post(table, method === 'POST' ? [{ actor: 'youtube', text: `failed with token=${GUM} and ${GOOGLE}` }] : { result_summary: `Bearer ${GH}abcdef` }, method));
    assert.ok(r.status < 300, `${table} ${r.status} ${r.body}`);
    const sent = sentJson(db); assert.ok(sent.length > 0, table + ' sent nothing');
    for (const v of [GUM, GOOGLE, GH]) assert.equal(sent.includes(v), false, `${table} leaked a value`);
  }
});
await t('4 clean writes pass unchanged and nothing is logged as redacted', async () => {
  const db = fakeDb(); invalidate(); const lines = []; const orig = console.log; console.log = (...a) => lines.push(a.join(' '));
  try { const r = await handle(db, post('activity', [{ actor: 'youtube', text: 'the daily report finished' }])); assert.ok(r.status < 300); } finally { console.log = orig; }
  assert.ok(sentJson(db).includes('the daily report finished')); assert.ok(!lines.join('\n').includes('redacted'));
});
await t('5 RPC bodies are gated too: no Nova-exposed RPC may carry a raw credential, and the exception list is empty', async () => {
  assert.equal(RPC_CREDENTIAL_OK.size, 0);
  const db = fakeDb(); invalidate();
  const r = await handle(db, { method: 'POST', path: '/rest/v1/rpc/coco_connection', query: {}, headers: { 'x-device-key': KEY, prefer: '' }, body: { p_note: `token=${GUM} ${GOOGLE}`, p_name: 'ok' } });
  assert.ok(r.status < 300, r.body);
  const sent = db.sql.flatMap((s) => s.params).map(String).join(' | ');
  assert.equal(sent.includes(GUM) || sent.includes(GOOGLE), false, 'the RPC body reached SQL with a credential');
  assert.ok(sent.includes(PLACEHOLDER));
  const bad = fakeDb(); const body = { p_name: 'x' }; Object.defineProperty(body, 'p_note', { enumerable: true, get() { throw new Error('boom'); } });
  const f = await handle(bad, { method: 'POST', path: '/rest/v1/rpc/coco_connection', query: {}, headers: { 'x-device-key': KEY, prefer: '' }, body });
  assert.equal(f.status, 500); assert.ok(!bad.sql.some((s) => /coco_connection/.test(s.text)), 'fail closed: nothing reaches SQL');
});
await t('6 the gate fails closed: if redaction throws, the write is refused and nothing reaches SQL', async () => {
  const db = fakeDb(); invalidate(); const body = [{ actor: 'x' }]; Object.defineProperty(body[0], 'text', { enumerable: true, get() { throw new Error('boom'); } });
  const r = await handle(db, post('activity', body)); assert.equal(r.status, 500); assert.match(r.body, /could not complete/);
  assert.ok(!db.sql.some((s) => /jsonb_populate_recordset/.test(s.text)));
});

await t('7 settings that look like secrets by name are left alone: a numeric or boolean value is not a credential', () => {
  const body = { daily_token: 5000, max_token: '120000', token_ok: true, secret_flag: 'true', note: 'ok' };
  assert.deepEqual(redactDeep(body).value, body); assert.deepEqual(redactDeep(body).findings, []);
  assert.ok(redactText(`token=${GUM}`).text.includes(PLACEHOLDER)); // a real-looking value is still caught
});

console.log(`\nnova.redact.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
