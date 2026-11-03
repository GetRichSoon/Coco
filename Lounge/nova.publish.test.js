// Run: node nova.publish.test.js   (no network, no database: a scripted stand-in plays Postgres, Google and Gumroad)
//
// What the universal publishing layer must hold, per platform: a caller needs a paired device AND a live
// engine key; the account is the one the company assigns, never a guess; the credential is read from
// the vault functions and never appears in a reply or a log; a provider success is read back, a provider
// error becomes a named state, an empty or malformed provider body cannot crash the route; the same
// idempotency key never creates a second product; a YouTube token is issued only for the channel the
// company recorded.
import assert from 'node:assert/strict';
import { handle, sha256, deps, invalidate } from './api/_nova.js';
import { redact, wantsPublic, productPayload } from './api/_publish.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} — ${e.message}`); } };
const KEY = 'device-key-0123456789abcdef', ENGINE = 'engine-key-abcdefghijklmnop';
const REFRESH = 'refresh-token-SECRET-1234567890', ACCESS = 'ya29.access-SECRET-0987654321', GUM = 'gumroad-token-SECRET-555555';

const accounts = {
  'yt-the-flow': { connection_id: 'yt-the-flow', provider: 'youtube', external_id: 'UCflow', external_name: 'The Flow', external_handle: '@theflow', account_label: 'a@b', secret_ref: 'youtube_refresh_token_yt_the_flow', state: 'connected', permissions: [] },
  poppy: { connection_id: 'poppy', provider: 'gumroad', external_id: 'g1', external_name: 'Poppy', external_handle: 'https://lokade.gumroad.com', account_label: 'a@b', secret_ref: 'gumroad_access_token_poppy', state: 'connected', permissions: [] },
};
function fakeDb({ engine = true, vault = { youtube_refresh_token_yt_the_flow: REFRESH, gumroad_access_token_poppy: GUM }, existing = null, stopped = false } = {}) {
  const sql = [], outputs = [], activity = [];
  return { sql, outputs, activity, async query(text, params = []) {
    sql.push({ text, params });
    if (/FROM public\.devices d JOIN/.test(text)) return { rows: params[0] === sha256(KEY) ? [{ id: 'cloud-worker-1', owner_email: 'boss@example.com', name: 'worker' }] : [] };
    if (/coco_engine_ok/.test(text)) return { rows: [{ ok: engine }] };
    if (/FROM public.policies WHERE scope = 'company'/.test(text)) return { rows: stopped ? [{ value: true }] : [] };
    if (/FROM public\.integration_accounts WHERE connection_id/.test(text)) return { rows: accounts[params[0]] ? [accounts[params[0]]] : [] };
    if (/coco_publish_target/.test(text)) return { rows: [{ v: params[0] === 'youtube' && params[1] === 'youtube' ? { connection_id: 'yt-the-flow' } : params[0] === 'gumroad' && params[1] === 'ebooks' ? { connection_id: 'poppy' } : null }] };
    if (/coco_publish_secret/.test(text)) return { rows: [{ v: vault[params[0]] ?? null }] };
    if (/coco_oauth_client/.test(text)) return { rows: [{ v: { client_id: 'cid', client_secret: 'csecret-SECRET-xyz' } }] };
    if (/FROM public\.outputs WHERE meta/.test(text)) return { rows: existing && existing.key === params[0] ? [existing.row] : [] };
    if (/INSERT INTO public\.outputs/.test(text)) { outputs.push(params); return { rows: [] }; }
    if (/INSERT INTO public\.activity/.test(text)) { activity.push(params); return { rows: [] }; }
    if (/UPDATE public\.integration_accounts/.test(text)) return { rows: [] };
    return { rows: [] };
  } };
}
const req = (method, path, { body = null, key = KEY, engine = ENGINE } = {}) => ({ method, path, query: {}, headers: { 'x-device-key': key, ...(engine ? { 'x-engine-key': engine } : {}) }, body });
const res = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => typeof body === 'string' ? body : JSON.stringify(body), arrayBuffer: async () => Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)), json: async () => JSON.parse(typeof body === 'string' ? body : JSON.stringify(body)) });
// a scripted provider: a map from "METHOD url-fragment" to a response (or a function of the request)
const provider = (script) => { const calls = []; deps.fetch = async (url, init = {}) => { const m = (init.method || 'GET').toUpperCase(); calls.push({ m, url: String(url), init }); for (const [k, v] of Object.entries(script)) { const [km, kf] = k.split(' '); if (km === m && String(url).includes(kf)) return typeof v === 'function' ? v(url, init) : v; } if (m === 'GET' && String(url).endsWith('/v2/products')) return res(200, { success: true, products: [] }); return res(404, { message: `unscripted ${m} ${url}` }); }; return calls; };
const noSecret = (s) => { for (const k of [REFRESH, ACCESS, GUM, 'csecret-SECRET-xyz']) assert.ok(!String(s).includes(k), `a secret leaked: ${k.slice(0, 12)}…`); };
deps.publishUrls = { youtube: { token: 'https://google.test/token', api: 'https://yt.test/v3' }, gumroad: 'https://gumroad.test' };

await t('1 authentication: no device key is 401; a paired device without a live engine key is 403; both together get in', async () => {
  const db = fakeDb(); invalidate();
  assert.equal((await handle(db, req('GET', '/api/publish/platforms', { key: '' }))).status, 401);
  assert.equal((await handle(fakeDb({ engine: false }), req('POST', '/api/publish', { body: { platform: 'gumroad' } }))).status, 403);
  assert.equal((await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad' }, engine: '' }))).status, 403);
  const p = await handle(db, req('GET', '/api/publish/platforms')); assert.equal(p.status, 200); assert.deepEqual(Object.keys(JSON.parse(p.body).platforms), ['youtube', 'gumroad']);
});

await t('2 authorization: an unknown platform, an unassigned team and a missing idempotency key are refused; public needs a named approver', async () => {
  const db = fakeDb();
  assert.equal((await handle(db, req('POST', '/api/publish', { body: { platform: 'etsy' } }))).status, 400);
  const r = await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'games', idempotency_key: 'k' } })); assert.equal(r.status, 404); assert.equal(JSON.parse(r.body).state, 'NOT_ASSIGNED');
  assert.equal((await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks' } }))).status, 400);
  assert.equal(wantsPublic({ mode: 'PUBLISH_WITH_APPROVAL' }), false); assert.equal(wantsPublic({ mode: 'PUBLISH_WITH_APPROVAL', approvedBy: 'mangesh' }), true); assert.equal(wantsPublic({ mode: 'DRAFT', approvedBy: 'mangesh' }), false);
  assert.equal(productPayload({ title: 'T', slug: 't', price_usd: 9.99, price_by_platform: { gumroad: 29 } }, { mode: 'DRAFT' }).price, 2900);
  const w = await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks', idempotency_key: 'k', mode: 'PUBLISH_WITH_APPROVAL', listing: { title: 'T', slug: 't', price_usd: 9 }, artifact: { url: 'https://b2.test/x.epub' } } }));
  assert.equal(w.status, 409); assert.equal(JSON.parse(w.body).needs_approval, true);
});

await t('3 credential lookup: the account the company assigns is used; an empty vault is NOT_CONNECTED, not a crash', async () => {
  const db = fakeDb({ vault: {} });
  provider({});
  const r = await handle(db, req('POST', '/api/publish/token', { body: { platform: 'youtube', team: 'youtube', channel: 'the-flow' } }));
  assert.equal(r.status, 409); assert.equal(JSON.parse(r.body).state, 'NOT_CONNECTED');
  assert.ok(db.sql.some((s) => /coco_publish_secret/.test(s.text) && s.params[0] === 'youtube_refresh_token_yt_the_flow'), 'the vault was asked by the recorded secret name');
});

await t('4 youtube token: Google refreshes, the channel identity is checked, a token for the right channel is issued and no secret leaks', async () => {
  const db = fakeDb();
  const calls = provider({ 'POST /token': res(200, { access_token: ACCESS, scope: 'https://www.googleapis.com/auth/youtube' }), 'GET /v3/channels': res(200, { items: [{ id: 'UCflow', snippet: { title: 'The Flow', customUrl: '@theflow' } }] }) });
  const r = await handle(db, req('POST', '/api/publish/token', { body: { platform: 'youtube', connection_id: 'yt-the-flow' } }));
  assert.equal(r.status, 200); const b = JSON.parse(r.body); assert.equal(b.state, 'OK'); assert.equal(b.channel_id, 'UCflow'); assert.equal(b.access_token, ACCESS);
  assert.ok(calls[0].init.body.toString().includes('grant_type=refresh_token'));
  noSecret(JSON.stringify(db.activity)); assert.ok(!JSON.stringify(db.activity).includes(ACCESS));
});

await t('5 youtube token: the wrong channel, a revoked grant and a malformed Google body are named states, never tokens', async () => {
  provider({ 'POST /token': res(200, { access_token: ACCESS, scope: 'https://www.googleapis.com/auth/youtube' }), 'GET /v3/channels': res(200, { items: [{ id: 'UCother', snippet: { title: 'Other' } }] }) });
  let r = await handle(fakeDb(), req('POST', '/api/publish/token', { body: { platform: 'youtube', connection_id: 'yt-the-flow' } })); assert.equal(JSON.parse(r.body).state, 'WRONG_CHANNEL'); assert.ok(!r.body.includes(ACCESS));
  provider({ 'POST /token': res(400, { error: 'invalid_grant' }) });
  r = await handle(fakeDb(), req('POST', '/api/publish/token', { body: { platform: 'youtube', connection_id: 'yt-the-flow' } })); assert.equal(JSON.parse(r.body).state, 'EXPIRED');
  provider({ 'POST /token': res(200, '') });
  r = await handle(fakeDb(), req('POST', '/api/publish/token', { body: { platform: 'youtube', connection_id: 'yt-the-flow' } })); assert.equal(r.status, 502); assert.equal(JSON.parse(r.body).state, 'PROVIDER_ERROR');
  provider({ 'POST /token': res(500, `boom refresh_token=${REFRESH} client_secret=csecret-SECRET-xyz`) });
  r = await handle(fakeDb(), req('POST', '/api/publish/token', { body: { platform: 'youtube', connection_id: 'yt-the-flow' } })); noSecret(r.body);
});

await t('6 gumroad publish: the file goes up first, the product is created, the provider answer is recorded as an output, nothing secret leaks', async () => {
  const db = fakeDb();
  const calls = provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(200, { upload_id: 'u1', key: 'k1', parts: [{ part_number: 1, presigned_url: 'https://s3.test/p1' }] }), 'PUT https://s3.test/p1': res(200, '', { etag: '"e1"' }),
    'POST /v2/files/complete': res(200, { file_url: 'https://files.test/book.epub' }), 'POST /v2/products': res(200, { success: true, product: { id: 'prod1', short_url: 'https://lokade.gumroad.com/l/retake', published: false } }) });
  const r = await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks', idempotency_key: 'retake:1', mode: 'DRAFT', run_id: 'R1', artifact: { url: 'https://b2.test/book.epub', name: 'retake.epub' }, listing: { title: 'The Retake Method', slug: 'retake', price_usd: 7.99, price_by_platform: { gumroad: 29 }, keywords: ['exam technique'] } } }));
  assert.equal(r.status, 200); const b = JSON.parse(r.body); assert.equal(b.state, 'READY'); assert.equal(b.external_id, 'prod1'); assert.equal(b.published, false); assert.ok(b.output_id);
  const order = calls.map((c) => `${c.m} ${c.url}`); assert.ok(order.findIndex((x) => x.includes('/files/presign')) < order.findIndex((x) => x === 'POST https://gumroad.test/v2/products'), 'file before product');
  const created = JSON.parse(calls.find((c) => c.m === 'POST' && c.url.endsWith('/v2/products')).init.body); assert.equal(created.draft, true); assert.equal(created.price, 2900); assert.deepEqual(created.files, [{ url: 'https://files.test/book.epub' }]);
  assert.equal(db.outputs.length, 1); assert.equal(db.outputs[0][9], 'prod1'); assert.ok(JSON.parse(db.outputs[0][12]).idempotency_key === 'retake:1');
  noSecret(r.body); noSecret(JSON.stringify(db.outputs)); noSecret(JSON.stringify(db.activity));
});

await t('7 gumroad publish: a provider error, a refusal with success:false and an empty body are named states; a half upload is aborted', async () => {
  provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(200, { upload_id: 'u1', key: 'k1', parts: [{ part_number: 1, presigned_url: 'https://s3.test/p1' }] }), 'PUT https://s3.test/p1': res(500, '') });
  const body = { platform: 'gumroad', connection_id: 'poppy', team: 'ebooks', idempotency_key: 'retake:2', mode: 'DRAFT', artifact: { url: 'https://b2.test/book.epub' }, listing: { title: 'T', slug: 't', price_usd: 9 } };
  let calls = provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(200, { upload_id: 'u1', key: 'k1', parts: [{ part_number: 1, presigned_url: 'https://s3.test/p1' }] }), 'PUT https://s3.test/p1': res(500, ''), 'POST /v2/files/abort': res(200, {}) });
  let r = await handle(fakeDb(), req('POST', '/api/publish', { body })); assert.equal(JSON.parse(r.body).state, 'UPLOAD_FAILED'); assert.ok(calls.some((c) => c.url.includes('/files/abort')), 'the half upload was aborted');
  provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(200, { success: false, message: `no: token ${GUM}` }) });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body })); assert.equal(JSON.parse(r.body).state, 'PUBLISH_FAILED'); noSecret(r.body);
  provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(200, '') });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body })); assert.equal(r.status, 502); assert.equal(JSON.parse(r.body).state, 'UPLOAD_FAILED');
  provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES'), 'POST /v2/files/presign': res(401, 'nope') });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body })); assert.equal(JSON.parse(r.body).state, 'REAUTH_REQUIRED');
});

await t('8 idempotency: a key that already produced a product sends nothing to the provider and returns the existing ids', async () => {
  const db = fakeDb({ existing: { key: 'retake:1', row: { id: 'OUT-1', status: 'draft', external_id: 'prod1', url: 'https://lokade.gumroad.com/l/retake' } } });
  const calls = provider({});
  const r = await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks', idempotency_key: 'retake:1', mode: 'DRAFT', artifact: { url: 'https://b2.test/book.epub' }, listing: { title: 'T', slug: 't', price_usd: 9 } } }));
  assert.equal(r.status, 200); const b = JSON.parse(r.body); assert.equal(b.state, 'DUPLICATE'); assert.equal(b.external_id, 'prod1'); assert.equal(calls.length, 0);
});

await t('9 the artifact hash is checked when given, and a worker-transport platform is pointed at the token route', async () => {
  provider({ 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES') });
  let r = await handle(fakeDb(), req('POST', '/api/publish', { body: { platform: 'gumroad', connection_id: 'poppy', idempotency_key: 'x', mode: 'DRAFT', artifact: { url: 'https://b2.test/book.epub', sha256: 'deadbeef' }, listing: { title: 'T', slug: 't', price_usd: 9 } } }));
  assert.equal(JSON.parse(r.body).state, 'UPLOAD_FAILED'); assert.match(JSON.parse(r.body).reason, /sha256/);
  r = await handle(fakeDb(), req('POST', '/api/publish', { body: { platform: 'youtube', connection_id: 'yt-the-flow', idempotency_key: 'y' } })); assert.equal(r.status, 400); assert.match(JSON.parse(r.body).reason, /token/);
  assert.equal(redact(`Bearer ${ACCESS} refresh_token=${REFRESH}`), 'Bearer [redacted] refresh_token=[redacted]');
});

await t('10 duplicates: a product with this link or title already in the store is never created again, and nothing is uploaded', async () => {
  const db = fakeDb();
  const calls = provider({ 'GET https://gumroad.test/v2/products': res(200, { success: true, products: [{ id: 'old1', name: 'Something else', custom_permalink: 'retake', published: true, short_url: 'https://lokade.gumroad.com/l/retake' }] }), 'GET https://b2.test/book.epub': res(200, 'EPUBBYTES') });
  const r = await handle(db, req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks', idempotency_key: 'retake:new', mode: 'DRAFT', artifact: { url: 'https://b2.test/book.epub' }, listing: { title: 'The Retake Method', slug: 'retake', price_usd: 9 } } }));
  const b = JSON.parse(r.body); assert.equal(b.state, 'DUPLICATE'); assert.equal(b.duplicate_of_product, 'old1');
  assert.ok(!calls.some((c) => c.m === 'POST'), 'nothing was uploaded or created'); assert.equal(db.outputs.length, 0); noSecret(r.body);
});

await t('11 a product is never created public: approved or not, the create path makes drafts only', async () => {
  const calls = provider({});
  const r = await handle(fakeDb(), req('POST', '/api/publish', { body: { platform: 'gumroad', team: 'ebooks', idempotency_key: 'k2', mode: 'PUBLISH_WITH_APPROVAL', approved_by: 'Mangesh', artifact: { url: 'https://b2.test/x.epub' }, listing: { title: 'T', slug: 't', price_usd: 9 } } }));
  assert.equal(r.status, 409); assert.match(JSON.parse(r.body).reason, /drafts.*publish_existing/); assert.equal(calls.length, 0);
});

await t('12 publish_existing: approver, stop, then the copy on Gumroad must have file, title, price, cover AND thumbnail; one enable; Gumroad asked again', async () => {
  const listing = { title: 'Knife Care', slug: 'knife-care', price_usd: 6.99 };
  const body = (over = {}) => ({ platform: 'gumroad', team: 'ebooks', action: 'publish_existing', external_id: 'p9', idempotency_key: 'ebook:knife-care:public', approved_by: 'Mangesh (standing permission 2026-10-30)', listing, ...over });
  const live = { id: 'p9', name: 'Knife Care', price: 699, published: false, files: [{ id: 'f' }], covers: [{ id: 'c' }], thumbnail_url: 'https://public-files.gumroad.com/t.jpg', short_url: 'https://lokade.gumroad.com/l/knife-care' };
  let calls = provider({});
  let r = await handle(fakeDb(), req('POST', '/api/publish', { body: body({ approved_by: null }) }));
  assert.equal(JSON.parse(r.body).needs_approval, true); assert.equal(calls.length, 0);
  r = await handle(fakeDb({ stopped: true }), req('POST', '/api/publish', { body: body() }));
  assert.match(JSON.parse(r.body).reason, /emergency stop/); assert.equal(calls.length, 0);
  calls = provider({ 'GET https://gumroad.test/v2/products/p9': res(200, { success: true, product: { ...live, thumbnail_url: null } }) });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body: body() }));
  assert.match(JSON.parse(r.body).reason, /no dedicated thumbnail/); assert.ok(!calls.some((c) => c.m === 'PUT'), 'no enable without the thumbnail');
  calls = provider({ 'GET https://gumroad.test/v2/products/p9': res(200, { success: true, product: { ...live, price: 999 } }) });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body: body() }));
  assert.match(JSON.parse(r.body).reason, /price/); assert.ok(!calls.some((c) => c.m === 'PUT'));
  let reads = 0; const db = fakeDb();
  calls = provider({ 'GET https://gumroad.test/v2/products/p9': () => res(200, { success: true, product: { ...live, published: reads++ > 0 } }), 'PUT https://gumroad.test/v2/products/p9/enable': res(200, { success: true }) });
  r = await handle(db, req('POST', '/api/publish', { body: body() }));
  const b = JSON.parse(r.body); assert.equal(b.state, 'PUBLISHED'); assert.equal(b.published, true); assert.equal(b.external_id, 'p9');
  assert.equal(calls.filter((c) => c.m === 'PUT').length, 1); assert.equal(reads, 2, 'Gumroad was asked again after the enable');
  assert.equal(db.outputs.length, 1); assert.equal(db.outputs[0][8], 'published'); noSecret(r.body); noSecret(JSON.stringify(db.activity));
  calls = provider({ 'GET https://gumroad.test/v2/products/p9': res(200, { success: true, product: { ...live, published: true } }) });
  r = await handle(fakeDb(), req('POST', '/api/publish', { body: body({ idempotency_key: 'ebook:knife-care:public:2' }) }));
  assert.equal(JSON.parse(r.body).state, 'ALREADY_PUBLISHED'); assert.ok(!calls.some((c) => c.m === 'PUT'), 'a retry never enables twice');
});

console.log(`\nnova.publish.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
