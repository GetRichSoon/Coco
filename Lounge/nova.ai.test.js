// Run: node nova.ai.test.js   (no network, no database)
//
// What the AI door must hold: the cloud runtime only; generation locked until a founder policy enables it;
// only free-tier models; a daily cap; the provider's usage booked in ai_calls; the key never in a reply.
import assert from 'node:assert/strict';
import { handle, sha256, deps } from './api/_nova.js';

let pass = 0, fail = 0;
const t = async (n, f) => { try { await f(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n} — ${e.message}`); } };
const KEY = 'device-key-0123456789abcdef', ENGINE = 'engine-key-abcdefghijklmnop', GKEY = 'AIzaSECRET-gemini-key-123456';
function fakeDb({ engine = true, policy = null, today = 0 } = {}) {
  const calls = [];
  return { calls, async query(text, params = []) {
    if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'cloud-worker-1', owner_email: 'b@x', name: 'w' }] : [] };
    if (/FROM public\.engine_keys/.test(text)) return { rows: [{ ok: engine && params[0] === ENGINE }] };
    if (/coco_secret\('gemini_api_key'\)/.test(text)) return { rows: [{ v: GKEY }] };
    if (/FROM public\.policies WHERE scope = 'company' AND key = 'gemini_generate'/.test(text)) return { rows: policy === null ? [] : [{ value: policy }] };
    if (/count\(\*\)::int AS n FROM public\.ai_calls/.test(text)) return { rows: [{ n: today }] };
    if (/INSERT INTO public\.ai_calls/.test(text)) { calls.push(params); return { rows: [] }; }
    return { rows: [] };
  } };
}
const req = (method, path, body = null, engine = ENGINE) => ({ method, path, query: {}, headers: { 'x-device-key': KEY, ...(engine ? { 'x-engine-key': engine } : {}) }, body });
const res = (status, body) => ({ ok: status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const noKey = (s) => assert.ok(!String(s).includes(GKEY), 'the Gemini key leaked');

await t('1 only the cloud runtime: no engine key is 403', async () => {
  assert.equal((await handle(fakeDb(), req('GET', '/api/ai/gemini/models', null, ''))).status, 403);
  assert.equal((await handle(fakeDb({ engine: false }), req('GET', '/api/ai/gemini/models'))).status, 403);
});
await t('2 the model list costs nothing and never shows the key, even in an error', async () => {
  deps.fetch = async (url, init) => { assert.equal(init.headers['x-goog-api-key'], GKEY); return res(200, { models: [{ name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-4-argon', supportedGenerationMethods: ['generateContent'] }] }); };
  const r = await handle(fakeDb(), req('GET', '/api/ai/gemini/models')); assert.equal(r.status, 200); noKey(r.body);
  assert.deepEqual(JSON.parse(r.body).allowlisted_available, ['gemini-3.1-flash-lite']);
  deps.fetch = async () => res(400, `API key not valid. key=${GKEY}`);
  const e = await handle(fakeDb(), req('GET', '/api/ai/gemini/models')); noKey(e.body);
});
await t('3 generation is LOCKED until a founder sets the policy', async () => {
  let called = false; deps.fetch = async () => { called = true; return res(200, {}); };
  const r = await handle(fakeDb({ policy: null }), req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'x', purpose: 'test' }));
  assert.equal(r.status, 403); assert.equal(JSON.parse(r.body).state, 'LOCKED'); assert.equal(called, false);
});
await t('4 only free-tier models; a daily cap; a prompt and a purpose are required', async () => {
  deps.fetch = async () => res(200, {});
  assert.equal((await handle(fakeDb({ policy: true }), req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-4-argon', prompt: 'x', purpose: 'p' }))).status, 400);
  assert.equal((await handle(fakeDb({ policy: true, today: 40 }), req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'x', purpose: 'p' }))).status, 429);
  assert.equal((await handle(fakeDb({ policy: true }), req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'x' }))).status, 400);
});
await t('5 a generation books the provider usage and returns the text, never the key', async () => {
  deps.fetch = async (url) => { assert.match(url, /gemini-3\.1-flash-lite:generateContent$/); return res(200, { candidates: [{ content: { parts: [{ text: 'a script' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, thoughtsTokenCount: 5, totalTokenCount: 205 } }); };
  const db = fakeDb({ policy: true });
  const r = await handle(db, req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'write', purpose: 'creative_write', team: 'youtube' }));
  assert.equal(r.status, 200); const b = JSON.parse(r.body); assert.equal(b.text, 'a script'); assert.equal(b.usage.total_tokens, 205); noKey(r.body);
  assert.equal(db.calls.length, 1); assert.equal(db.calls[0][1], 'done'); assert.equal(db.calls[0][13], 205);
  deps.fetch = async () => res(429, `quota exceeded for key ${GKEY}`);
  const q = await handle(fakeDb({ policy: true }), req('POST', '/api/ai/generate', { provider: 'gemini', model: 'gemini-3.1-flash-lite', prompt: 'write', purpose: 'p' }));
  assert.equal(q.status, 429); assert.equal(JSON.parse(q.body).state, 'RATE_LIMITED'); noKey(q.body);
});

console.log(`\nnova.ai.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
