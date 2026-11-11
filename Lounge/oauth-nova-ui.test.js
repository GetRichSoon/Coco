// Run: node oauth-nova-ui.test.js
//
// When the app talks to Nova, connecting and verifying an account go through Nova's own OAuth routes (no database function, no
// edge function). The real functions are lifted out of index.html, as oauth-ui.test.js does. Without Nova they must still use the
// old path unchanged (that is what oauth-ui.test.js proves).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
const lift = (startRe, endRe) => { const i = src.search(startRe); assert.ok(i > 0, `could not find ${startRe}`); const j = src.indexOf(endRe, i); assert.ok(j > i); return src.slice(i, j + endRe.length); };
const timeoutSrc = lift(/const TIMEOUT_MS = /, '\n}'), connectSrc = lift(/async function oauthConnect\(provider, connection = null\) \{/, '\n}');
const verifySrc = lift(/async function connectionVerify\(connection\) \{/, '\n}'), novaOauthSrc = lift(/async function novaOauth\(op, body\) \{/, '\n}');
const verifyMapSrc = lift(/const CLOUD_VERIFY = /, '};'), saidSrc = lift(/const VERIFY_SAID = \{/, '};');
const platformsSrc = lift(/const OAUTH_PLATFORMS = \{/, '};');

let pass = 0;
const ok = async (name, fn) => { await fn(); pass++; console.log(`  ok  ${name}`); };

function build({ NOVA = 'https://nova.example', fetchImpl, conns = [], confirmed = true }) {
  const log = [], opened = [], toasts = [];
  const sb = { rpc: async (fn) => { log.push({ rpc: fn }); return { data: null, error: { message: 'the database function must not be used' } }; },
    functions: { invoke: async (r) => { log.push({ invoke: r }); return { data: null, error: { message: 'the edge function must not be used' } }; } } };
  const fn = new Function('NOVA', 'novaFetch', 'store', 'sb', 'toast', 'render', 'confirm', 'window', 'CONNS', 'loadAll', 'inFlight',
    `let connConnecting = null, connConnectingAt = 0; ${timeoutSrc}\n${platformsSrc}\n${verifyMapSrc}\n${saidSrc}\n${novaOauthSrc}\n${connectSrc}\n${verifySrc}\nreturn { oauthConnect, connectionVerify, peek: () => ({ connConnecting }) };`);
  const api = fn(NOVA, async (p, init) => { log.push({ nova: p, body: init && init.body ? JSON.parse(init.body) : null }); return fetchImpl(p, init); }, { get: () => 'device-key' },
    sb, (m) => toasts.push(m), () => {}, () => confirmed, { open: (u) => opened.push(u), COCO_TIMEOUT_MS: 200 }, conns, async () => {}, new Set());
  return { api, log, opened, toasts };
}
const reply = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

await ok('connecting asks Nova (not the database) and sends the founder to the platform with the one-time link', async () => {
  const { api, log, opened } = build({ fetchImpl: reply(200, { ok: true, state: 's', authorize_url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }), conns: [{ connection_id: 'yt-food', external_name: 'Food' }] });
  const r = await api.oauthConnect('youtube', 'yt-food');
  assert.equal(r.started, true); assert.deepEqual(opened, ['https://accounts.google.com/o/oauth2/v2/auth?x=1']);
  assert.deepEqual(log.filter((l) => l.nova).map((l) => [l.nova, l.body.provider, l.body.connection_id]), [['/api/oauth/begin', 'youtube', 'yt-food']]);
  assert.ok(!log.some((l) => l.rpc || l.invoke), 'no database function and no edge function');
});

await ok("Nova's refusal is shown as it came back and nothing opens", async () => {
  const { api, opened, toasts } = build({ fetchImpl: reply(403, { reason: 'a cloud worker cannot start a connection; a founder does that from Coco' }) });
  const r = await api.oauthConnect('youtube', 'yt-food');
  assert.equal(r.started, false); assert.equal(opened.length, 0); assert.ok(toasts.join(' ').includes('cloud worker cannot start'));
});

await ok('Nova unreachable: said plainly, nothing opens', async () => {
  const { api, opened, toasts } = build({ fetchImpl: async () => { throw new Error('network down'); } });
  const r = await api.oauthConnect('youtube', 'yt-food');
  assert.equal(r.started, false); assert.equal(opened.length, 0); assert.ok(toasts.join(' ').includes('network down'));
});

await ok('verify goes to Nova for YouTube and for Gumroad, and shows the platform\'s own answer', async () => {
  for (const [conn, provider] of [['yt-food', 'youtube'], ['poppy', 'gumroad']]) {
    const { api, log, toasts } = build({ fetchImpl: reply(200, { status: 'CONNECTED_VERIFIED', detail: `${provider} answered from the cloud` }), conns: [{ connection_id: conn, provider }] });
    const r = await api.connectionVerify(conn);
    assert.equal(r.status, 'CONNECTED_VERIFIED');
    assert.deepEqual(log.filter((l) => l.nova).map((l) => [l.nova, l.body.connection_id]), [['/api/oauth/verify', conn]]);
    assert.ok(!log.some((l) => l.rpc || l.invoke)); assert.ok(toasts.join(' ').includes('answered from the cloud'));
  }
});

await ok('a platform with no cloud check says so and changes nothing', async () => {
  const { api, log, toasts } = build({ fetchImpl: reply(200, {}), conns: [{ connection_id: 'gh-main', provider: 'github' }] });
  assert.equal(await api.connectionVerify('gh-main'), null);
  assert.equal(log.length, 0); assert.ok(toasts.join(' ').includes('cannot check'));
});

await ok('without Nova the old path is used unchanged (database function and edge function)', async () => {
  const { api, log } = build({ NOVA: null, fetchImpl: reply(200, {}), conns: [{ connection_id: 'yt-food', provider: 'youtube', external_name: 'Food' }] });
  await api.oauthConnect('youtube', 'yt-food'); await api.connectionVerify('yt-food');
  assert.deepEqual(log.map((l) => l.rpc || l.invoke), ['coco_oauth_begin', 'youtube-oauth/verify']);
  assert.ok(!log.some((l) => l.nova));
});

console.log(`oauth nova ui: ${pass}/6 passed`);
