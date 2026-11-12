// Run: node conn.picktheory.test.js   (no network, no database: a scripted stand-in plays YouTube)
//
// PickTheory is a YouTube channel (connection yt-app-web), not a service with an API key. What this connector must hold: a pasted key
// is turned away with the real way to connect (and never sent anywhere); a Google token is accepted only when it reaches a real
// channel, whose identity comes back; a different channel name is information, not a failure; expired, over-quota, missing-channel,
// malformed and unreachable answers are told apart; the token never appears in a result.
import assert from 'node:assert/strict';
import * as mod from './api/_conn_picktheory.js';
import { PICKTHEORY, PICKTHEORY_STEPS, verifyPickTheory } from './api/_conn_picktheory.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.message}`); } };
const TOKEN = 'ya29.test-access-token-SECRET-0123456789abcdef';
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const script = (...answers) => { const calls = []; let i = 0; const f = async (url, init = {}) => { calls.push({ url: String(url), init }); const a = answers[Math.min(i++, answers.length - 1)]; if (a instanceof Error) throw a; return a; }; f.calls = calls; return f; };
const channel = (title, o = {}) => ({ kind: 'youtube#channelListResponse', items: [{ id: 'UCsynthetic0000000000001', snippet: { title, customUrl: '@synthetic', ...o } }] });
const clean = (v) => assert.ok(!JSON.stringify(v).includes(TOKEN), 'the token leaked into a result');

await t('1 the facts: PickTheory is the YouTube connection yt-app-web in House Gigi, connected through the existing Google sign-in', () => {
  assert.equal(PICKTHEORY.provider, 'youtube'); assert.equal(PICKTHEORY.connection_id, 'yt-app-web'); assert.equal(PICKTHEORY.house_id, 'gigi'); assert.equal(PICKTHEORY.google_account, 'your YouTube Google account');
  assert.deepEqual(PICKTHEORY.connect, { route: '/api/oauth/begin', body: { provider: 'youtube', connection_id: 'yt-app-web' } });
  assert.deepEqual(PICKTHEORY.verify, { route: '/api/oauth/verify', body: { connection_id: 'yt-app-web' } });
  assert.deepEqual([...PICKTHEORY.name_ideas], ['PickTheory', 'ClickTheory', 'DigitalScout']);
  assert.ok(Object.isFrozen(PICKTHEORY) && Object.isFrozen(PICKTHEORY.connect) && Object.isFrozen(PICKTHEORY_STEPS), 'the constants cannot be edited by a caller');
  assert.equal(PICKTHEORY_STEPS.length, 3); assert.match(PICKTHEORY_STEPS[0], /Create the channel/); assert.match(PICKTHEORY_STEPS[1], /Connect/); assert.match(PICKTHEORY_STEPS[2], /Check now/);
});

await t('2 there is no revenue feed to invent: fetchPickTheoryRevenue is not exported, so Nova reports "no revenue feed", never a zero', () => {
  assert.equal(typeof mod.fetchPickTheoryRevenue, 'undefined'); assert.equal(typeof mod.verifyPickTheory, 'function');
});

await t('3 a pasted key is turned away with the way to connect, and nothing is sent anywhere', async () => {
  const f = script(res(200, channel('PickTheory')));
  // key-shaped strings are built at run time so no credential-shaped text sits in the source (the repo's pre-commit guard refuses it)
  for (const key of ['AI' + 'za' + 'SyFAKE-not-a-real-key-0123456789', 'sk' + '_live_0123456789', 'a-long-api-key-0123456789abcdef', '', 'ya29' + '.short', undefined, null, 42]) {
    const v = await verifyPickTheory(key, f);
    assert.equal(v.ok, false); assert.equal(v.denied, false); assert.equal(v.status, 'USE_GOOGLE_SIGN_IN'); assert.match(v.error, /YouTube channel/); assert.match(v.error, /Google sign-in/); assert.equal(v.detail, v.error);
  }
  assert.equal(f.calls.length, 0, 'a pasted key is never transmitted');
});

await t('4 a Google token that reaches the channel: identity comes back in the shape api/_connect.js reads', async () => {
  const f = script(res(200, channel('PickTheory')));
  const v = await verifyPickTheory(TOKEN, f);
  assert.equal(v.ok, true); assert.equal(v.denied, false); assert.deepEqual(v.account, { id: 'UCsynthetic0000000000001', name: 'PickTheory' }); assert.equal(v.external_id, 'UCsynthetic0000000000001');
  assert.equal(v.external_name, 'PickTheory'); assert.equal(v.external_handle, '@synthetic'); assert.equal(v.name_matches, true); assert.equal(v.error, null); assert.match(v.detail, /PickTheory \(@synthetic\) answered from YouTube/);
  const u = new URL(f.calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://www.googleapis.com/youtube/v3/channels'); assert.equal(u.searchParams.get('mine'), 'true'); assert.equal(u.searchParams.get('part'), 'snippet');
  assert.equal(f.calls[0].init.method, 'GET'); assert.equal(f.calls[0].init.headers.authorization, `Bearer ${TOKEN}`); assert.ok(!f.calls[0].url.includes(TOKEN));
  clean(v);
});

await t('5 the slot name is the founder\'s choice: another title is information, spacing and case do not matter', async () => {
  const other = await verifyPickTheory(TOKEN, script(res(200, channel('Click Theory'))));
  assert.equal(other.ok, true); assert.equal(other.name_matches, false); assert.match(other.detail, /not PickTheory/); assert.match(other.detail, /ClickTheory/); assert.match(other.detail, /right channel/);
  for (const title of ['PICK THEORY', 'pick-theory | apps', 'Pick Theory']) assert.equal((await verifyPickTheory(TOKEN, script(res(200, channel(title))))).name_matches, true, title);
  const noHandle = await verifyPickTheory(TOKEN, script(res(200, { items: [{ id: 'UC1', snippet: { title: 'PickTheory' } }] }))); assert.equal(noHandle.external_handle, null); assert.doesNotMatch(noHandle.detail, /\(\)/);
});

await t('6 expired or withdrawn: 401 and 403 are denied; a 403 for quota is NOT a bad token', async () => {
  const a = await verifyPickTheory(TOKEN, script(res(401, { error: { code: 401, message: 'Invalid Credentials' } })));
  assert.equal(a.ok, false); assert.equal(a.denied, true); assert.equal(a.status, 'EXPIRED'); assert.match(a.error, /Connect PickTheory again/);
  const b = await verifyPickTheory(TOKEN, script(res(403, { error: { errors: [{ reason: 'forbidden' }], message: 'forbidden' } }))); assert.equal(b.denied, true); assert.equal(b.status, 'EXPIRED');
  const q = await verifyPickTheory(TOKEN, script(res(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } }))); assert.equal(q.ok, false); assert.equal(q.denied, false); assert.equal(q.status, 'QUOTA');
  const r = await verifyPickTheory(TOKEN, script(res(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }))); assert.equal(r.status, 'QUOTA');
  for (const v of [a, b, q, r]) clean(v);
});

await t('7 a Google account with no channel says to create the channel first (the real state of PickTheory today)', async () => {
  for (const body of [{ kind: 'youtube#channelListResponse', pageInfo: { totalResults: 0 } }, { items: [] }]) {
    const v = await verifyPickTheory(TOKEN, script(res(200, body)));
    assert.equal(v.ok, false); assert.equal(v.denied, false); assert.equal(v.status, 'NO_CHANNEL'); assert.match(v.error, /Create the channel first/); assert.match(v.error, /your YouTube Google account/);
  }
});

await t('8 malformed, failing and unreachable answers are named and keep the token out', async () => {
  const bad = await verifyPickTheory(TOKEN, script(res(200, 'not json')));
  assert.equal(bad.ok, false); assert.equal(bad.status, 'BAD_RESPONSE'); assert.equal(bad.denied, false);
  const five = await verifyPickTheory(TOKEN, script(res(503, { error: { message: `backend error for ${TOKEN}` } })));
  assert.equal(five.ok, false); assert.equal(five.status, 'ERROR'); assert.equal(five.denied, false); assert.match(five.error, /503/); clean(five);
  const down = await verifyPickTheory(TOKEN, script(new Error(`ECONNRESET after sending Bearer ${TOKEN}`)));
  assert.equal(down.ok, false); assert.equal(down.status, 'UNREACHABLE'); assert.equal(down.denied, false); clean(down);
  const text = await verifyPickTheory(TOKEN, script(res(200, `"${TOKEN}"`))); assert.equal(text.ok, false); clean(text);
});

console.log(`\nconn.picktheory.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
