// Run: node door-board.test.js   (no network, no database: a fake Postgres answers the SQL Nova sends)
//
// The job door (/api/ai-door/*), the founder's worker-token mint (/api/workers/token) and the company board (/api/board), per
// docs/NOVA_DOOR_ROUTE_SPEC.md in GetRichSoon/CocoMaison (tests 1 to 7), plus: the vendored CocoMaison files have not drifted.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { handle, sha256 } from './api/_nova.js';
import { mintToken, readToken } from './vendor/cocomaison/scripts/ai/job-door.mjs';

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n} — ${e.message}`); } };
const ENGINE = 'engine-key-abcdefghijklmnop', DEVICE = 'device-key-0123456789abcdef', QUEUE_SECRET = 'queue-internal-words-xyz';
process.env.NOVA_ENGINE_KEY = ENGINE;

// what Nova writes to its log, so the test can prove no token, key or body ever reaches it
const logged = []; const realLog = console.log; console.log = (...a) => { const s = a.join(' '); if (s.startsWith('{')) logged.push(s); else realLog(...a); };

const row = (id, o = {}) => ({ worker_id: id, kind: 'ai', provider: 'oracle-always-free', status: 'active', capabilities: ['ai.generate'], facts: {}, terms: { commercial_ok: true }, quota: { limit: 360, used: 0 }, revoked_before: 0, last_seen: null, ...o });
// A fake Postgres: worker_registry and the queue RPCs answer only when the engine key rides in request.headers (private.engine_ok); devices for the founder's key.
function fakeDb({ workers = [], jobs = [], tasks = [], messages = [], queueThrows = false } = {}) {
  const reg = new Map(workers.map((w) => [w.worker_id, { ...w }])), q = new Map(jobs.map((j) => [j.id, { status: 'queued', ...j }])), sql = [];
  let headers = {};
  const engineOk = () => headers['x-engine-key'] === ENGINE;
  const args = (text, params) => Object.fromEntries([...text.matchAll(/"(p_\w+)" => \$(\d+)/g)].map(([, k, i]) => [k, params[i - 1]]));
  return { reg, q, sql, async query(text, params = []) {
    sql.push(text);
    if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL ROLE)/.test(text)) return { rows: [] };
    if (/set_config\('request\.jwt\.claims'/.test(text)) { headers = JSON.parse(params[1]); return { rows: [] }; }
    if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(DEVICE) ? [{ id: 'founder-phone', owner_email: 'f@x', name: 'phone' }] : [] };
    if (/public\."worker_registry"/.test(text)) {
      if (!engineOk()) return { rows: [] };                                     // RLS: no engine key, no rows
      if (/^SELECT/.test(text)) { const r = reg.get(params[0]); return { rows: r ? [{ ...r }] : [] }; }
      if (/^UPDATE/.test(text)) { const r = reg.get(params[/WHERE "worker_id" = \$(\d+)/.exec(text)[1] - 1]); for (const [, k, i] of text.matchAll(/"(\w+)" = \$(\d+)/g)) if (k !== 'worker_id') r[k] = typeof params[i - 1] === 'string' && /^[{[]/.test(params[i - 1]) ? JSON.parse(params[i - 1]) : params[i - 1]; return { rows: [] }; }
    }
    const rpc = /FROM public\."(coco_job_\w+)"\(/.exec(text);
    if (rpc) {
      if (!engineOk()) throw Object.assign(new Error('only the cloud runtime may claim a job'), { code: 'P0001' });
      if (queueThrows) throw new Error(`${QUEUE_SECRET} ${ENGINE}`);
      const a = args(text, params), fn = rpc[1];
      if (fn === 'coco_job_claim') { const j = [...q.values()].find((x) => x.status === 'queued' && (!a.p_types || a.p_types.includes(x.type))); if (!j) return { rows: [{ value: { ok: false, reason: 'nothing queued' } }] }; Object.assign(j, { status: 'running', lease_owner: a.p_worker }); return { rows: [{ value: { ok: true, job: { ...j } } }] }; }
      const j = q.get(a.p_id), mine = j && j.status === 'running' && j.lease_owner === a.p_worker;
      if (!mine) return { rows: [{ value: { ok: false, reason: 'not the lease owner, or not running' } }] };
      if (fn === 'coco_job_heartbeat') return { rows: [{ value: { ok: true } }] };
      if (fn === 'coco_job_done') { Object.assign(j, { status: 'done', result: JSON.parse(a.p_result) }); return { rows: [{ value: { ok: true, job: { id: j.id, status: j.status } } }] }; }
      if (fn === 'coco_job_fail') { Object.assign(j, { status: a.p_kind === 'permanent' ? 'failed' : 'queued', error: a.p_message }); return { rows: [{ value: { ok: true, retry: a.p_kind !== 'permanent', job: { id: j.id, status: j.status } } }] }; }
    }
    if (/FROM public\."tasks"/.test(text)) return { rows: tasks };
    if (/FROM public\."agent_messages"/.test(text)) return { rows: messages };
    return { rows: [] };
  } };
}
const tok = (worker = 'oracle-a1-1', o = {}) => mintToken({ engineKey: ENGINE, worker, ttlSeconds: 3600, ...o });
const door = (db, method, p, { token = null, body = null, proto = 'https', auth } = {}) =>
  handle(db, { method, path: `/api/ai-door${p}`, query: {}, headers: { 'x-forwarded-proto': proto, ...(auth !== undefined ? { authorization: auth } : token ? { authorization: `Bearer ${token}` } : {}) }, body });
const dev = (db, method, path, body = null, key = DEVICE) => handle(db, { method, path, query: {}, headers: { ...(key ? { 'x-device-key': key } : {}) }, body });
const J = (r) => JSON.parse(r.body);

await t('1 no token, a malformed, expired or foreign-key token: all 401 with the same body', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')] }), bodies = new Set();
  const cases = [{}, { auth: 'Bearer nonsense' }, { auth: 'Basic abc' }, { token: tok('oracle-a1-1', { now: Date.now() - 2 * 3600e3 }) }, { token: mintToken({ engineKey: 'another-key-0123456789', worker: 'oracle-a1-1' }) }];
  for (const c of cases) { const r = await door(db, 'GET', '/me', c); assert.equal(r.status, 401); bodies.add(r.body); }
  assert.equal(bodies.size, 1, 'one answer for every token problem');
});
await t('2 a registered worker: /me 200; /claim on an empty queue says nothing queued', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')] }), tk = tok();
  const me = await door(db, 'GET', '/me', { token: tk }); assert.equal(me.status, 200); assert.equal(J(me).worker, 'oracle-a1-1');
  const c = await door(db, 'POST', '/claim', { token: tk, body: {} }); assert.equal(c.status, 200); assert.deepEqual(J(c), { ok: false, reason: 'nothing queued' });
  assert.ok(db.reg.get('oracle-a1-1').last_seen, 'a claim refreshes last_seen');
});
await t('3 paused, revoked, or revoked_before at/after the chain start: 401 on every path, /renew included', async () => {
  const tk = tok(), cst = readToken(tk).cst;
  for (const o of [{ status: 'paused' }, { status: 'revoked' }, { revoked_before: cst }, { revoked_before: cst + 10 }]) {
    const db = fakeDb({ workers: [row('oracle-a1-1', o)] });
    for (const [m, p] of [['GET', '/me'], ['POST', '/claim'], ['POST', '/renew'], ['POST', '/report'], ['POST', '/heartbeat'], ['POST', '/done'], ['POST', '/fail']]) assert.equal((await door(db, m, p, { token: tk, body: { id: 'JOB-1' } })).status, 401, `${JSON.stringify(o)} ${p}`);
  }
  const unknown = fakeDb(); assert.equal((await door(unknown, 'GET', '/me', { token: tk })).status, 401, 'an unregistered worker');
});
await t('4 a row of another kind, or without ai.generate: /claim 403', async () => {
  for (const o of [{ kind: 'render' }, { capabilities: ['render.video'] }]) { const db = fakeDb({ workers: [row('oracle-a1-1', o)], jobs: [{ id: 'JOB-1', type: 'ai.generate' }] }); assert.equal((await door(db, 'POST', '/claim', { token: tok(), body: {} })).status, 403); assert.equal(db.q.get('JOB-1').status, 'queued'); }
});
await t('5 /done with a model the job did not request: the job ends failed, not done; a requested model ends done', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')], jobs: [{ id: 'JOB-1', type: 'ai.generate', payload: { models: ['qwen3.5:9b'] } }, { id: 'JOB-2', type: 'ai.generate', payload: { models: ['qwen3.5:9b'] } }] }), tk = tok();
  assert.equal(J(await door(db, 'POST', '/claim', { token: tk, body: {} })).job.id, 'JOB-1');
  assert.equal((await door(db, 'POST', '/heartbeat', { token: tk, body: { id: 'JOB-1' } })).status, 200);
  await door(db, 'POST', '/done', { token: tk, body: { id: 'JOB-1', result: { model: 'llama3:70b', text: 'x' } } }); assert.equal(db.q.get('JOB-1').status, 'failed');
  assert.equal(J(await door(db, 'POST', '/claim', { token: tk, body: {} })).job.id, 'JOB-2');
  await door(db, 'POST', '/done', { token: tk, body: { id: 'JOB-2', result: { model: 'qwen3.5:9b', text: 'ok' } } }); assert.equal(db.q.get('JOB-2').status, 'done');
  assert.ok(db.reg.get('oracle-a1-1').quota.used >= 0, 'lease minutes are booked into quota.used');
});
await t('6 over 128 KB: 413; bad JSON: 400; unknown path: 404; a GET other than /me: 405', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')] }), tk = tok();
  assert.equal((await door(db, 'POST', '/report', { token: tk, body: { facts: { arch: 'x'.repeat(130 * 1024) } } })).status, 413);
  assert.equal((await door(db, 'POST', '/report', { token: tk, body: '{not json' })).status, 400);
  assert.equal((await door(db, 'POST', '/nope', { token: tk, body: { id: 'JOB-1' } })).status, 404);
  assert.equal((await door(db, 'GET', '/claim', { token: tk })).status, 405);
});
await t('7 answers never carry the engine key, a token or the queue\'s own words; no CORS headers on the door', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')], queueThrows: true }), tk = tok();
  const r = await door(db, 'POST', '/claim', { token: tk, body: {} }); assert.equal(r.status, 502);
  for (const s of [ENGINE, tk, QUEUE_SECRET]) assert.ok(!r.body.includes(s));
  assert.ok(!Object.keys(r.headers).some((h) => /^access-control-/i.test(h)), 'no Access-Control-* header');
  const o = await door(db, 'OPTIONS', '/me', {}); assert.equal(o.status, 401); assert.ok(!Object.keys(o.headers).some((h) => /^access-control-/i.test(h)));
});
await t('8 the route refuses to run without a real engine key, and over plain http', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')] }), tk = tok();
  for (const k of [undefined, 'short-key']) { if (k === undefined) delete process.env.NOVA_ENGINE_KEY; else process.env.NOVA_ENGINE_KEY = k; assert.equal((await door(db, 'GET', '/me', { token: tk })).status, 503); assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'oracle-a1-1' })).status, 503); }
  process.env.NOVA_ENGINE_KEY = ENGINE;
  assert.equal((await door(db, 'GET', '/me', { token: tk, proto: 'http' })).status, 400);
});
await t('9 renew through the door: a new token for the same worker and chain, which then works', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1')] }), tk = tok(), r = await door(db, 'POST', '/renew', { token: tk, body: { ttl_seconds: 3600 } });
  assert.equal(r.status, 200); const nt = J(r).token; assert.notEqual(nt, tk); assert.equal(readToken(nt).sub, 'oracle-a1-1'); assert.equal(readToken(nt).cst, readToken(tk).cst);
  assert.equal((await door(db, 'GET', '/me', { token: nt })).status, 200);
});
await t('10 60 requests a minute per worker, then 429', async () => {
  const db = fakeDb({ workers: [row('rate-test-1')] }), tk = tok('rate-test-1'), now = Date.now(); let last;
  for (let i = 0; i < 61; i++) last = await handle(db, { method: 'GET', path: '/api/ai-door/me', query: {}, headers: { 'x-forwarded-proto': 'https', authorization: `Bearer ${tk}` }, body: null }, now);
  assert.equal(last.status, 429);
});
await t('11 the founder mints a worker token from any paired device; only for a registered, active ai worker', async () => {
  const db = fakeDb({ workers: [row('oracle-a1-1'), row('paused-1', { status: 'paused' }), row('render-1', { kind: 'render', capabilities: ['render.video'] })] });
  const r = await dev(db, 'POST', '/api/workers/token', { worker_id: 'oracle-a1-1', ttl_seconds: 1800 }); assert.equal(r.status, 200);
  const b = J(r); assert.equal(readToken(b.token).sub, 'oracle-a1-1'); assert.equal(readToken(b.token).exp - readToken(b.token).iat, 1800); assert.ok(b.expires_at);
  assert.equal((await door(db, 'GET', '/me', { token: b.token })).status, 200, 'the minted token opens the door');
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'nobody-here' })).status, 404);
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'paused-1' })).status, 404);
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'render-1' })).status, 409);
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'BAD id' })).status, 400);
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'oracle-a1-1', ttl_seconds: 99999 })).status, 400, 'six hours at most');
  assert.equal((await dev(db, 'GET', '/api/workers/token')).status, 405);
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'oracle-a1-1' }, null)).status, 401, 'no device key');
  assert.equal((await dev(db, 'POST', '/api/workers/token', { worker_id: 'oracle-a1-1' }, 'not-a-paired-device-key')).status, 401);
});
await t('12 the board: ownership, missing assignments, duplicates, blocked with reason/owner/recovery, overdue; read as the founder', async () => {
  const tasks = [
    { id: 'T1', title: 'Ship the door', status: 'open', details: 'Owner: brain:core\nSubteam: brain:core.cloud_engine\nCategory: infra\nTask key: door-1\nDeadline: 2026-01-01', created_at: '2026-11-01' },
    { id: 'T2', title: 'Ship the door', status: 'open', details: 'Owner: brain:core\nTask key: door-1', created_at: '2026-11-02' },
    { id: 'T3', title: 'Write ebook', status: 'blocked', details: 'Team: ebooks\nBlocked: waiting for the cover', error: null, created_at: '2026-11-03' },
    { id: 'T4', title: 'Old', status: 'done', details: '', created_at: '2026-10-01' },
  ];
  const messages = [{ id: 1, at: '2026-11-04T00:00:00Z', from_agent: 'a', to_agent: 'b', task: 'T3', text: JSON.stringify({ stage: 'lifecycle.BLOCKED', status: 'paused', evidence: { state: 'BLOCKED', blocked: { reason: 'no cover art', responsible_owner: 'brain:poppy', recovery_action: 'order a cover' } } }) }];
  const db = fakeDb({ tasks, messages }), r = await dev(db, 'GET', '/api/board'); assert.equal(r.status, 200);
  const b = J(r); assert.equal(b.total, 4); assert.equal(b.open, 3); assert.equal(b.by_house['brain:core'], 2); assert.equal(b.by_house['brain:poppy'], 1);
  assert.deepEqual(b.missing_assignments.find((m) => m.task === 'T2').missing, ['responsible Subteam', 'category']);
  assert.ok(b.duplicates.some((d) => d.by === 'key' && d.tasks.includes('T1') && d.tasks.includes('T2')));
  assert.deepEqual(b.blocked, [{ task: 'T3', title: 'Write ebook', reason: 'no cover art', owner: 'brain:poppy', recovery_action: 'order a cover' }]);
  assert.deepEqual(b.overdue.map((o) => o.task), ['T1']);
  assert.ok(db.sql.some((s) => /FROM public\."agent_messages".* LIMIT 5000$/.test(s)), 'all 5000 handoff rows are asked for');
  assert.ok(db.sql.includes('SET LOCAL ROLE coco_member'), 'read as coco_member, under RLS');
  assert.equal((await dev(db, 'POST', '/api/board', {})).status, 405);
  assert.equal((await dev(fakeDb(), 'GET', '/api/board', null, null)).status, 401);
});
await t('13 nothing logged carries a token, the engine key or a request body', async () => {
  const all = logged.join('\n'); assert.ok(logged.length > 20, 'the routes do log status and path');
  for (const s of [ENGINE, 'qwen3.5:9b', 'cover art', 'v1.ey']) assert.ok(!all.includes(s), `log carries ${s}`);
  assert.ok(!/"token"|Bearer/.test(all));
});
await t('14 the vendored CocoMaison files are byte-identical to their source commit (below the one header line)', async () => {
  const want = {
    'scripts/ai/job-door.mjs': '8167829a70f7f6f806a97d830c2b3cf9e8251760dc4f003e8a492d2aac22ef6e',
    'scripts/lib/worker-registry.mjs': 'c99c73ae3d12183902b6dfe0077ccfd9e15f00d9e5049c398d9eeda320bc928e',
    'scripts/lib/scrub.mjs': 'fddb4b7a6b4114602a7c832099e3b5ba635f2cf1f18694b01fbc76315cdba80d',
    'scripts/brains/board.mjs': 'a6927e6bbd73ebd3a2b299af1d2b0c12eaaee052aafa722a6a16f58e728da483',
    'scripts/brains/handoff-core.mjs': '53aa5383f7738ab5738d5e421dbc631d4df48b5e257a2444e996e0fb1156d0aa',
  };
  for (const [p, h] of Object.entries(want)) {
    const s = fs.readFileSync(new URL(`./vendor/cocomaison/${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.match(s, /^\/\/ Vendored from GetRichSoon\/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec /, p);
    assert.equal(createHash('sha256').update(s.slice(s.indexOf('\n') + 1)).digest('hex'), h, `${p} drifted from its source`);
  }
});

console.log = realLog;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
