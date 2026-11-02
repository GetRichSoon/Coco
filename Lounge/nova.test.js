// Run: node nova.test.js   (no network, no database: a scripted stand-in records every statement)
//
// What Nova must hold: nobody without a paired device key gets in; every statement runs as
// `authenticated` with the founder's claims and the device header set, inside one transaction;
// identifiers that are not plain names are refused before they reach SQL; reads are cached and a
// write to a table empties that table's cache; a device is rate limited; no error ever echoes a
// connection string.
import assert from 'node:assert/strict';
import { handle, buildSelect, buildWrite, buildRpc, sha256, invalidate, rateOk, NovaError } from './api/_nova.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} — ${e.message}`); } };

const KEY = 'device-key-0123456789abcdef';
const fakeDb = (rows = []) => { const sql = []; return { sql, async query(text, params = []) { sql.push({ text, params });
  if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'boss-pc', owner_email: 'boss@example.com', name: 'Boss PC' }] : [] };
  if (/^SELECT 1 AS ok/.test(text)) return { rows: [{ ok: 1 }] };
  if (/FROM public\.pulse ORDER BY id DESC/.test(text)) return { rows: [{ version: '2026-11-02T08:00:00Z', last_topic: 'tasks' }] };
  return { rows: Array.isArray(rows) ? rows : [] }; } }; };
const req = (method, path, { query = {}, body = null, key = KEY, prefer = '' } = {}) => ({ method, path, query, headers: { 'x-device-key': key, prefer }, body });

await t('1 auth: no key, a wrong key and an unpaired device are 401; a paired founder device gets in', async () => {
  const db = fakeDb();
  assert.equal((await handle(db, req('GET', '/api/me', { key: '' }))).status, 401);
  assert.equal((await handle(db, req('GET', '/api/me', { key: 'wrong-key-xxxxxxxxxxxxxxx' }))).status, 401);
  const me = await handle(db, req('GET', '/api/me')); assert.equal(me.status, 200); assert.deepEqual(JSON.parse(me.body), { email: 'boss@example.com', device_id: 'boss-pc', name: 'Boss PC' });
});

await t('2 every statement runs as authenticated with the claims and the device header, in one transaction', async () => {
  const db = fakeDb([{ id: 'h1' }]); invalidate();
  const r = await handle(db, req('GET', '/rest/v1/houses', { query: { select: '*', order: 'sort.asc' } }));
  assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body), [{ id: 'h1' }]);
  const seq = db.sql.slice(-5).map((s) => s.text);
  assert.ok(seq[0] === 'BEGIN' && seq[1].startsWith("SELECT set_config('request.jwt.claims'") && seq[2] === 'SET LOCAL ROLE authenticated' && seq[3].startsWith('SELECT * FROM') && seq[4] === 'COMMIT', `sequence was ${seq.map((x) => x.slice(0, 30)).join(' | ')}`);
  const cfg = db.sql.find((s) => /set_config/.test(s.text)); assert.match(cfg.params[0], /"email":"boss@example.com"/); assert.match(cfg.params[1], /x-device-key/);
});

await t('3 the PostgREST subset the apps use becomes parameterised SQL; bad identifiers never reach SQL', async () => {
  const s = buildSelect('commands', { select: '*', target_device: 'eq.boss-pc', status: 'eq.queued', order: 'created_at.asc' });
  assert.equal(s.sql, 'SELECT * FROM public."commands" WHERE "target_device" = $1 AND "status" = $2 ORDER BY "created_at" ASC'); assert.deepEqual(s.params, ['boss-pc', 'queued']);
  const o = buildSelect('commands', { or: '(target_device.eq.x,created_device.eq.x)', status: 'in.(queued,running)', created_at: 'lt.2026-11-01', limit: '200', result: 'not.ilike.stale%' });
  assert.match(o.sql, /\("target_device" = \$1 OR "created_device" = \$2\) AND "status" IN \(\$3, \$4\) AND "created_at" < \$5 AND NOT \("result" ILIKE \$6\) LIMIT 200/);
  assert.throws(() => buildSelect('houses', { 'id; drop table houses': 'eq.1' }), /bad identifier/);
  assert.throws(() => buildSelect('houses', { select: 'id, (select 1)' }), /bad identifier/);
  assert.throws(() => buildSelect('houses', { id: 'eq.1', order: 'id.asc; drop' }), /bad order/);
  const u = buildWrite('commands', 'PATCH', { id: 'eq.c1', status: 'eq.queued' }, { status: 'running' }, 'return=representation');
  assert.equal(u.sql, 'UPDATE public."commands" SET "status" = $3 WHERE "id" = $1 AND "status" = $2 RETURNING *'); assert.deepEqual(u.params, ['c1', 'queued', 'running']);
  assert.throws(() => buildWrite('commands', 'PATCH', {}, { status: 'x' }), /needs a filter/);
  assert.throws(() => buildWrite('commands', 'DELETE', {}, null), /needs a filter/);
  const i = buildWrite('activity', 'POST', {}, { actor: 'Boss', action: 'x', detail: { a: 1 } });
  // rows are typed by the table's own row type (PostgREST's way), still as ONE bound parameter
  assert.equal(i.sql, 'INSERT INTO public."activity" ("actor", "action", "detail") SELECT "actor", "action", "detail" FROM jsonb_populate_recordset(NULL::public."activity", $1::jsonb)');
  assert.deepEqual(JSON.parse(i.params[0]), [{ actor: 'Boss', action: 'x', detail: { a: 1 } }]);
  // a JSON list stays a list, so a text[] column receives an array (the cloud cycle's registries do this)
  const up = buildWrite('capabilities', 'POST', { on_conflict: 'id' }, [{ id: 'x', teams: ['core', 'keeper'] }], 'resolution=merge-duplicates');
  assert.ok(/ON CONFLICT \("id"\) DO UPDATE SET "teams" = EXCLUDED\."teams"/.test(up.sql) && JSON.parse(up.params[0])[0].teams.length === 2, up.sql);
  assert.throws(() => buildWrite('activity', 'POST', {}, { 'bad key': 1 }), /bad identifier/);
  const rpc = buildRpc('submit_task', { p_title: 'T', p_details: null, p_house: 'gigi', p_needs: 'cloud', p_device: 'boss-pc', p_by: 'Boss' });
  assert.match(rpc.sql, /SELECT to_jsonb\(r\) AS value FROM public\."submit_task"\("p_title" => \$1/);
  assert.throws(() => buildRpc('pg_sleep', { a: 1 }), /no such function/);
  assert.equal((await handle(fakeDb(), req('GET', '/rest/v1/pg_shadow'))).status, 404);
});

await t('4 cache: a repeated read is served without the database; a write to that table empties it; other tables keep theirs', async () => {
  const db = fakeDb([{ id: 't1' }]); invalidate();
  const a = await handle(db, req('GET', '/rest/v1/tasks', { query: { select: '*' } })); const n = db.sql.length;
  const b = await handle(db, req('GET', '/rest/v1/tasks', { query: { select: '*' } }));
  assert.equal(b.headers['x-nova-cache'], 'hit'); assert.equal(db.sql.length, n, 'no statement for the cached read'); assert.equal(a.body, b.body);
  await handle(db, req('GET', '/rest/v1/houses', { query: { select: '*' } }));
  await handle(db, req('PATCH', '/rest/v1/tasks', { query: { id: 'eq.t1' }, body: { status: 'done' } }));
  assert.equal((await handle(db, req('GET', '/rest/v1/tasks', { query: { select: '*' } }))).headers['x-nova-cache'], 'miss', 'tasks was invalidated by the write');
  assert.equal((await handle(db, req('GET', '/rest/v1/houses', { query: { select: '*' } }))).headers['x-nova-cache'], 'hit', 'houses was not');
});

await t('5 /api/changes is one tiny signal, cached 5 s', async () => {
  const db = fakeDb(); invalidate();
  const a = await handle(db, req('GET', '/api/changes')); assert.deepEqual(JSON.parse(a.body), { version: '2026-11-02T08:00:00Z', last_topic: 'tasks' });
  assert.equal((await handle(db, req('GET', '/api/changes'))).headers['x-nova-cache'], 'hit');
});

await t('6 rate limit per device: the 121st request in a minute is refused, and refills with time', async () => {
  for (let i = 0; i < 120; i++) assert.equal(rateOk('d1', 1000), true);
  assert.equal(rateOk('d1', 1000), false);
  assert.equal(rateOk('d1', 1000 + 30000), true, 'half a minute later half the bucket is back');
});

await t('7 errors: RLS refusals are 403, timeouts 504, anything else 500 without the connection string; health reports the database state', async () => {
  const rls = { query: async (text, params) => { if (/devices d JOIN/.test(text)) return { rows: [{ id: 'd', owner_email: 'boss@example.com', name: 'x' }] }; if (/SELECT \* FROM/.test(text)) throw new Error('new row violates row-level security policy'); return { rows: [] }; } };
  invalidate(); assert.equal((await handle(rls, req('GET', '/rest/v1/founders', { query: { select: '*' } }))).status, 403);
  const boom = { query: async (text) => { if (/devices d JOIN/.test(text)) return { rows: [{ id: 'd', owner_email: 'boss@example.com', name: 'x' }] }; if (/SELECT \* FROM/.test(text)) throw new Error('connect ECONNREFUSED postgresql://example:not-a-password@h/db'); return { rows: [] }; } };
  invalidate(); const r = await handle(boom, req('GET', '/rest/v1/tasks', { query: { select: '*' } })); assert.equal(r.status, 500); assert.ok(!/not-a-password/.test(r.body));
  const h = await handle(fakeDb(), req('GET', '/api/health', { key: '' })); assert.equal(h.status, 200); assert.equal(JSON.parse(h.body).db, 'ok');
  const down = { query: async () => { throw new Error('nope'); } }; assert.equal(JSON.parse((await handle(down, req('GET', '/api/health', { key: '' }))).body).db, 'unavailable');
});

await t('8 pairing is the only call allowed without a device key, and it runs with no claims', async () => {
  const base = fakeDb([{ value: 'phone-1' }]); const db = { sql: base.sql, query: async (t, p) => /FROM public\.pairing_codes c JOIN/.test(t) ? { rows: p[0] === '123456' ? [{ owner_email: 'boss@example.com' }] : [] } : base.query(t, p) }; invalidate();
  const r = await handle(db, req('POST', '/rest/v1/rpc/pair_device', { key: '', body: { p_code: '123456', p_device_key: 'new-key-0123456789abcdef' } }));
  assert.equal(r.status, 200, r.body); assert.equal(JSON.parse(r.body), 'phone-1');
  const cfg = db.sql.find((x) => /set_config/.test(x.text)); assert.match(cfg.params[0], /"email":"boss@example.com"/, 'the code names the device, the device names the founder');
  assert.equal((await handle(db, req('POST', '/rest/v1/rpc/pair_device', { key: '', body: { p_code: '000000', p_device_key: 'new-key-0123456789abcdef' } }))).status, 400, 'a wrong code is a 400, not a founder lookup');
  assert.equal((await handle(db, req('POST', '/rest/v1/rpc/submit_task', { key: '', body: {} }))).status, 401, 'every other rpc still needs the device key');
});

console.log(`\nnova.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
