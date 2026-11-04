// Run: node nova.broker.test.js   (no network, no database)
//
// The access broker: identity comes from public.jobs (not the request), policy is default-deny data, shadow records
// without blocking, enforce refuses, every decision lands in capability_uses, no secret appears anywhere.
import assert from 'node:assert/strict';
import { handle, sha256, deps, invalidate } from './api/_nova.js';
import { decide, evaluate, guard, readMode, requestOf } from './api/_broker.js';
import { ACCESS_POLICY } from './api/_access_policy.js';

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n} - ${e.message}`); } };
const KEY = 'device-key-0123456789abcdef', ENGINE = 'engine-key-abcdefghijklmnop';
const REFRESH = 'refresh-token-SECRET-1234567890', GUM = 'gumroad-token-SECRET-555555', GKEY = 'AIzaSECRET-gemini-key-1234567890abcdef';
const accounts = {
  'yt-the-flow': { connection_id: 'yt-the-flow', provider: 'youtube', external_id: 'UCflow', external_name: 'The Flow', external_handle: '@f', secret_ref: 'youtube_refresh_token_yt_the_flow', state: 'connected', permissions: [] },
  'yt-moonveil-audio': { connection_id: 'yt-moonveil-audio', provider: 'youtube', external_id: 'UCmoon', external_name: 'Moonveil', external_handle: '@m', secret_ref: 'youtube_refresh_token_yt_moonveil_audio', state: 'connected', permissions: [] },
  poppy: { connection_id: 'poppy', provider: 'gumroad', external_id: 'g1', external_name: 'Poppy', external_handle: 'https://x.gumroad.com', secret_ref: 'gumroad_access_token_poppy', state: 'connected', permissions: [] },
};
const jobs = {
  'J-yt': { id: 'J-yt', status: 'running', lease_owner: 'gh-1-9', team_id: 'youtube', subteam_id: null, channel_id: 'the-flow' },
  'J-gum': { id: 'J-gum', status: 'running', lease_owner: 'gh-2-9', team_id: 'ebooks', subteam_id: null, channel_id: null },
  'J-new': { id: 'J-new', status: 'running', lease_owner: 'gh-3-9', team_id: 'brand-new-team', subteam_id: null, channel_id: null },
  'J-content': { id: 'J-content', status: 'running', lease_owner: 'gh-4-9', team_id: 'content', subteam_id: null, channel_id: null },
  'J-done': { id: 'J-done', status: 'done', lease_owner: null, team_id: 'youtube', subteam_id: null, channel_id: 'the-flow' },
};
function fakeDb({ mode, brokenJobs = false, brokenInsert = false, device = 'cloud-worker-1' } = {}) {
  const uses = [], vault = [];
  return { uses, vault, async query(text, params = []) {
    if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: device, owner_email: 'b@x', name: 'w' }] : [] };
    if (/coco_engine_ok/.test(text)) return { rows: [{ ok: true }] };
    if (/FROM public\.engine_keys/.test(text)) return { rows: [{ ok: params[0] === ENGINE }] };
    if (/key = 'access_broker_mode'/.test(text)) return { rows: mode === undefined ? [] : [{ value: mode }] };
    if (/FROM public\.jobs WHERE id/.test(text)) { if (brokenJobs) throw new Error('db down'); return { rows: jobs[params[0]] ? [jobs[params[0]]] : [] }; }
    if (/INSERT INTO public\.capability_uses/.test(text)) { if (brokenInsert) throw new Error('insert failed'); uses.push({ capability_id: params[1], run_id: params[2], team_id: params[3], ok: params[4], note: JSON.parse(params[5]) }); return { rows: [] }; }
    if (/FROM public\.integration_accounts WHERE connection_id/.test(text)) return { rows: accounts[params[0]] ? [accounts[params[0]]] : [] };
    if (/coco_publish_secret/.test(text)) { vault.push(params[0]); return { rows: [{ v: params[0].includes('gumroad') ? GUM : REFRESH }] }; }
    if (/coco_secret\('gemini_api_key'\)/.test(text)) return { rows: [{ v: GKEY }] };
    if (/key = 'gemini_generate'/.test(text)) return { rows: [{ value: true }] };
    if (/count\(\*\)::int AS n FROM public\.ai_calls/.test(text)) return { rows: [{ n: 0 }] };
    return { rows: [] };
  } };
}
const post = (path, body) => ({ method: 'POST', path, query: {}, headers: { 'x-device-key': KEY, 'x-engine-key': ENGINE }, body });
const token = (job, worker, connection_id, extra = {}) => post('/api/publish/token', { connection_id, job_id: job, worker, ...extra });
const res = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, text: async () => JSON.stringify(body) });
deps.fetch = async () => res(500, { error: 'provider down' });
deps.publishUrls = { youtube: { token: 'https://g.test/token', api: 'https://yt.test' }, gumroad: 'https://gum.test' };
const body = (r) => JSON.parse(r.body);
const clean = (db, r) => { const all = JSON.stringify(db.uses) + (r?.body || ''); for (const s of [REFRESH, GUM, GKEY, ENGINE, KEY]) assert.ok(!all.includes(s), 'a secret leaked: ' + s.slice(0, 10)); };
const who = { device_id: 'cloud-worker-1' };

await t('1 policy is default deny and team isolated (pure rule)', () => {
  const ev = (team, provider, capability, connectionId, channel) => evaluate(ACCESS_POLICY, { team, channel }, { provider, capability, connectionId, env: 'production' }).allow;
  assert.equal(ev('youtube', 'youtube', 'token_mint', 'yt-the-flow', 'the-flow'), true);
  assert.equal(ev('youtube', 'gumroad', 'token_mint', 'poppy'), false);
  assert.equal(ev('ebooks', 'youtube', 'token_mint', 'yt-the-flow'), false);
  assert.equal(ev('poppy', 'gumroad', 'publish', 'poppy'), true);
  assert.equal(ev('youtube', 'youtube', 'token_mint', 'yt-moonveil-audio', 'the-flow'), false, 'another channel');
  assert.equal(ev('content', 'gemini', 'ai_generate'), true);
  assert.equal(ev('content', 'youtube', 'token_mint', 'yt-the-flow'), false);
  assert.equal(ev('brand-new-team', 'gemini', 'ai_generate'), false, 'a new team inherits nothing');
  assert.equal(ev('youtube', 'anthropic', 'ai_generate'), false, 'anthropic only through the gateway');
  assert.equal(evaluate(ACCESS_POLICY, { team: 'youtube' }, { provider: 'anthropic', capability: 'ai_generate', via: 'ai_gateway', env: 'production' }).allow, true);
  assert.equal(ev('youtube', 'youtube', 'delete', 'yt-the-flow'), false);
  assert.equal(evaluate(ACCESS_POLICY, { team: 'youtube' }, { provider: 'youtube', capability: 'stats', env: 'staging' }).allow, false);
});
await t('2 enforce: a youtube job cannot mint a gumroad token, nor a gumroad job a youtube one; the vault is never read', async () => {
  invalidate();
  for (const [job, worker, conn] of [['J-yt', 'gh-1-9', 'poppy'], ['J-gum', 'gh-2-9', 'yt-the-flow']]) {
    const db = fakeDb({ mode: 'enforce' }); const r = await handle(db, token(job, worker, conn));
    assert.equal(r.status, 403); assert.equal(body(r).state, 'ACCESS_DENIED'); assert.equal(db.vault.length, 0); clean(db, r);
    assert.equal(db.uses.length, 1); assert.equal(db.uses[0].ok, false); assert.equal(db.uses[0].note.decision, 'deny');
  }
});
await t('3 enforce: a youtube channel cannot use another channel; its own channel passes the gate', async () => {
  invalidate();
  const db = fakeDb({ mode: 'enforce' }); const r = await handle(db, token('J-yt', 'gh-1-9', 'yt-moonveil-audio'));
  assert.equal(r.status, 403); assert.match(body(r).reason, /channel the-flow/); assert.equal(db.vault.length, 0);
  const ok = fakeDb({ mode: 'enforce' }); const g = await handle(ok, token('J-yt', 'gh-1-9', 'yt-the-flow'));
  assert.notEqual(body(g).state, 'ACCESS_DENIED'); assert.equal(ok.vault.length, 1); assert.equal(ok.uses[0].ok, true); assert.equal(ok.uses[0].note.decision, 'allow'); assert.equal(ok.uses[0].team_id, 'youtube'); clean(ok, g);
});
await t('4 unknown job, finished job, lease mismatch and no identity are all denied', async () => {
  invalidate();
  for (const [job, worker, why] of [['J-nope', 'gh-1-9', /does not exist/], ['J-done', 'gh-1-9', /not running/], ['J-yt', 'gh-other-1', /another worker/], ['', '', /no job_id/]]) {
    const db = fakeDb({ mode: 'enforce' }); const r = await handle(db, token(job, worker, 'yt-the-flow'));
    assert.equal(r.status, 403, String(job)); assert.match(body(r).reason, why); assert.equal(db.vault.length, 0);
  }
});
await t('5 shadow (the default when no policy row): a would-be denial is recorded as shadow_deny and the call still goes through', async () => {
  invalidate();
  for (const mode of [undefined, 'shadow']) {
    const db = fakeDb({ mode }); const r = await handle(db, post('/api/publish/stats', { connection_id: 'poppy', job_id: 'J-yt', worker: 'gh-1-9' }));
    assert.notEqual(body(r).state, 'ACCESS_DENIED'); assert.equal(db.vault.length, 1, 'the credential path ran');
    assert.equal(db.uses[0].note.decision, 'shadow_deny'); assert.equal(db.uses[0].note.mode, 'shadow'); assert.equal(db.uses[0].ok, true); clean(db, r);
  }
  const off = fakeDb({ mode: 'off' }); await handle(off, token('J-yt', 'gh-1-9', 'poppy')); assert.equal(off.uses.length, 0);
});
await t('6 fail closed: a broken identity lookup, a broken policy row or an unrecordable decision denies in enforce', async () => {
  invalidate();
  const a = fakeDb({ mode: 'enforce', brokenJobs: true }); assert.equal((await handle(a, token('J-yt', 'gh-1-9', 'yt-the-flow'))).status, 403); assert.equal(a.vault.length, 0);
  const b = fakeDb({ mode: 'turbo' }); assert.equal(await readMode(b), 'enforce'); assert.equal((await handle(b, post('/api/publish/stats', { connection_id: 'poppy', job_id: 'J-yt', worker: 'gh-1-9' }))).status, 403);
  const c = fakeDb({ mode: 'enforce', brokenInsert: true }); assert.equal((await handle(c, token('J-yt', 'gh-1-9', 'yt-the-flow'))).status, 403); assert.equal(c.vault.length, 0);
  const d = fakeDb({ mode: 'shadow', brokenInsert: true }); assert.notEqual((await handle(d, token('J-yt', 'gh-1-9', 'yt-the-flow'))).status, 403);
});
await t('7 a new team or agent that is not in the policy is denied (default deny, nothing inherited)', async () => {
  invalidate();
  const db = fakeDb({ mode: 'enforce' }); const r = await handle(db, token('J-new', 'gh-3-9', 'poppy'));
  assert.equal(r.status, 403); assert.match(body(r).reason, /no access policy/); assert.equal(db.uses[0].team_id, 'brand-new-team');
});
await t('8 AI door: a content job may generate with Gemini, a new team may not, and the key never appears', async () => {
  invalidate();
  deps.fetch = async () => res(200, { candidates: [{ content: { parts: [{ text: 'hi' }] } }], usageMetadata: { totalTokenCount: 3 } });
  const gen = (job, worker) => post('/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'x', purpose: 'p', job_id: job, worker });
  const ok = fakeDb({ mode: 'enforce' }); const r = await handle(ok, gen('J-content', 'gh-4-9')); assert.equal(r.status, 200); assert.equal(ok.uses[0].capability_id, 'access:gemini.ai_generate'); clean(ok, r);
  const no = fakeDb({ mode: 'enforce' }); const d = await handle(no, gen('J-new', 'gh-3-9')); assert.equal(d.status, 403); assert.equal(body(d).state, 'ACCESS_DENIED'); clean(no, d);
  deps.fetch = async () => res(500, {});
});
await t('9 workflow identity: only the paired cloud worker, a mapped workflow file and a gha-<id> label', async () => {
  const p = (device, workflow, run) => decide(fakeDb(), { device_id: device }, { workflow, runId: run, provider: 'youtube', capability: 'token_mint', connectionId: 'yt-the-flow', env: 'production' });
  assert.equal((await p('cloud-worker-1', 'youtube-publish.yml', 'gha-123')).allow, true);
  assert.equal((await p('boss-pc', 'youtube-publish.yml', 'gha-123')).allow, false);
  assert.equal((await p('cloud-worker-1', 'unknown.yml', 'gha-123')).allow, false);
  assert.equal((await p('cloud-worker-1', 'youtube-publish.yml', 'run-7')).allow, false);
  assert.equal((await decide(fakeDb(), who, { workflow: 'gumroad-publish.yml', runId: 'gha-5', provider: 'youtube', capability: 'token_mint', connectionId: 'yt-the-flow', env: 'production' })).allow, false, 'a gumroad workflow cannot take youtube');
  const db = fakeDb({ mode: 'enforce' }); const r = await handle(db, post('/api/publish/token', { connection_id: 'yt-the-flow', workflow: 'youtube-publish.yml', run_label: 'gha-99' }));
  assert.notEqual(body(r).state, 'ACCESS_DENIED'); assert.equal(db.uses[0].note.identity.kind, 'workflow');
});
await t('10 there is no override: no body or header field can lift a denial or change the mode', async () => {
  invalidate();
  const r = await handle(fakeDb({ mode: 'enforce' }), token('J-yt', 'gh-1-9', 'poppy', { override: true, force: true, mode: 'off', via: 'ai_gateway', team: 'ebooks', approved_by: 'mangesh', founder: true }));
  assert.equal(r.status, 403);
  const h = post('/api/publish/token', { connection_id: 'poppy', job_id: 'J-yt', worker: 'gh-1-9' }); h.headers['x-override'] = '1'; h.headers['x-access-broker-mode'] = 'off';
  assert.equal((await handle(fakeDb({ mode: 'enforce' }), h)).status, 403);
  assert.equal(requestOf(post('/x', { via: 'ai_gateway' }), {}).via, undefined);
  assert.equal(evaluate(ACCESS_POLICY, { team: 'youtube' }, { provider: 'anthropic', capability: 'ai_generate', env: 'production' }).allow, false);
});
await t('11 a secret in a decision note is redacted before the row is written', async () => {
  const db = fakeDb({ mode: 'enforce' });
  await guard(db, who, { jobId: 'J-yt', worker: 'gh-1-9', provider: 'youtube', capability: 'token_mint', connectionId: `poppy token=${GUM}`, env: 'production' });
  assert.ok(!JSON.stringify(db.uses).includes(GUM)); assert.equal(db.uses.length, 1);
});

console.log(`\nnova.broker.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
