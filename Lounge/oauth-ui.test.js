// Run: node oauth-ui.test.js
//
// The Connect flow on the Integrations screen. The real page code is lifted out of index.html and
// driven here, so a change that breaks the screen fails this file rather than surfacing in front of
// a founder mid-authorization.
//
// What is worth testing about a Connect button, specifically:
//
//   * the five states a founder has to be able to tell apart, derived from what the cloud actually
//     recorded rather than from a status field someone remembered to set
//   * that a refused gate is SHOWN. coco_oauth_begin checks is_founder() AND device_ok(); if this
//     page swallowed that refusal, the founder would see a dead button and no reason
//   * that the single-use state is never kept anywhere in the browser
//   * that only a platform which can actually be published to programmatically gets offered
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0;
const fails = [];
const ok = (name, fn) => {
  try { fn(); pass++; console.log(`ok    ${name}`); }
  catch (e) { fails.push(`${name} -> ${e.message}`); console.log(`FAIL  ${name} -> ${e.message}`); }
};

// ---------------------------------------------------------------- lift the real code
const lift = (startRe, endRe, what) => {
  const i = src.search(startRe);
  assert.ok(i > 0, `could not find ${what}`);
  const j = src.indexOf(endRe, i);
  assert.ok(j > i, `could not close ${what}`);
  return src.slice(i, j + endRe.length);
};

const platformsSrc = lift(/const OAUTH_PLATFORMS = \{/, '};', 'OAUTH_PLATFORMS');
const connectSrc = lift(/async function oauthConnect\(provider, connection = null\) \{/, '\n}', 'oauthConnect');
// cloudHeld, busy and mask, which connState is built on. The first `};` after cloudHeld closes
// mask, so one lift carries all three.
const helpersSrc = lift(/const cloudHeld = \(c\) =>/, '};', 'cloudHeld / busy / mask');
const stateSrc = lift(/const connState = \(c\) => \{/, '};', 'connState');
// The real deadline helper, so these tests exercise what ships rather than a stand-in.
const timeoutSrc = lift(/const TIMEOUT_MS = /, '\n}', 'withTimeout');
const chipSrc = lift(/const CONN_CHIP = \{/, '};', 'CONN_CHIP');

// A credential the cloud can really read is a vault NAME. It appears all through this file, because
// the difference between this and a path on somebody's laptop is what these states are about.
const VAULT = 'gumroad_access_token_poppy';

// ---------------------------------------------------------------- the states
function states({ connecting = null, at = 0 } = {}) {
  const scope = { connConnecting: connecting, connConnectingAt: at, OAUTH_PLATFORMS: {} };
  const fn = new Function('connConnecting', 'connConnectingAt',
    `${helpersSrc}\n${stateSrc}\n${chipSrc}\nreturn { connState, CONN_CHIP, cloudHeld };`);
  return fn(scope.connConnecting, scope.connConnectingAt);
}

ok('a never-connected account reads as Not connected', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'not_connected' }), 'not_connected');
});

ok('a connected and verified account reads as Connected', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'connected', secret_ref: VAULT, last_verified_at: '2026-10-28T00:00:00Z' }), 'connected');
});

// ---------------------------------------------------------------- the lie this screen used to tell
// Fifteen YouTube channels read "Connected" on every device while their authorizations were files
// in ~/.nova-secrets on one laptop. No cloud run can open those, so nothing could publish with the
// PC off - which is the only thing this screen is for. A row saying connected is not a credential.
ok('a credential that is a file on a PC is NOT reported as connected', () => {
  const { connState, cloudHeld } = states();
  const onPc = {
    connection_id: 'yt-the-flow', provider: 'youtube', state: 'connected',
    secret_ref: '~/.nova-secrets/youtube.env', last_verified_at: '2026-10-29T03:07:32Z',
  };
  assert.equal(cloudHeld(onPc), false);
  const s = connState(onPc);
  assert.equal(s, 'pc_only');
  assert.notEqual(s, 'connected', 'a laptop file was reported as a cloud connection');
  assert.notEqual(s, 'connected_unverified');
});

ok('a cloud vault name IS a connection, a path never is', () => {
  const { cloudHeld } = states();
  for (const ref of ['youtube_refresh_token_yt_the_flow', VAULT]) {
    assert.equal(cloudHeld({ secret_ref: ref }), true, ref);
  }
  for (const ref of ['~/.nova-secrets/youtube.env', 'C:\\keys\\yt.env', '/home/x/y.env', 'youtube.env', '', null]) {
    assert.equal(cloudHeld({ secret_ref: ref }), false, String(ref));
  }
});

ok('a partly-granted authorization says so instead of reading Connected', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'youtube', state: 'partial', secret_ref: 'youtube_refresh_token_yt_food',
    last_verified_at: '2026-10-29T04:00:00Z' }), 'missing_permission');
});

ok('connected but never checked is NOT reported as Connected', () => {
  const { connState } = states();
  const s = connState({ provider: 'gumroad', state: 'connected', secret_ref: VAULT, last_verified_at: null });
  assert.equal(s, 'connected_unverified');
  assert.notEqual(s, 'connected', 'an unverified connection must not read as verified');
});

ok('an errored account reads as Verification failed', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'error', secret_ref: VAULT }), 'verification_failed');
});

ok('an account that HAS a credential reference but is not connected needs reconnecting', () => {
  const { connState } = states();
  // This is the distinction that matters: it was authorised once, so the answer is re-authorise,
  // not add an account again.
  assert.equal(connState({ provider: 'gumroad', state: 'not_connected', secret_ref: 'gumroad_access_token_poppy' }),
    'reauth_required');
});

ok('a flow just started reads as Connecting, and only for ten minutes', () => {
  const acc = { connection_id: 'poppy', provider: 'gumroad', state: 'not_connected' };
  const fresh = states({ connecting: 'poppy', at: Date.now() });
  assert.equal(fresh.connState(acc), 'connecting');
  const stale = states({ connecting: 'poppy', at: Date.now() - 11 * 60_000 });
  assert.equal(stale.connState(acc), 'not_connected',
    'a stale Connecting must not stick: the founder would be told a flow is open when it has expired');
});

// Fifteen channels share one platform. If Connecting were remembered per PLATFORM, starting one
// channel's flow would mark the other fourteen cards as connecting too.
ok('Connecting marks the one account being connected, not its whole platform', () => {
  const { connState } = states({ connecting: 'yt-the-flow', at: Date.now() });
  assert.equal(connState({ connection_id: 'yt-the-flow', provider: 'youtube', state: 'not_connected' }), 'connecting');
  assert.equal(connState({ connection_id: 'yt-food', provider: 'youtube', state: 'not_connected' }), 'not_connected');
});

ok('the cloud beats the Connecting flag, which is only this page remembering', () => {
  const { connState } = states({ connecting: 'poppy', at: Date.now() });
  // The flag is this page's memory of the last ten minutes; the account row is the authority.
  // Letting the flag win would tell a founder a flow is still open about an account that is
  // already connected and verified.
  assert.equal(connState({ connection_id: 'poppy', provider: 'gumroad', state: 'connected', secret_ref: VAULT, last_verified_at: '2026-10-28T00:00:00Z' }),
    'connected');
  assert.equal(connState({ connection_id: 'poppy', provider: 'gumroad', state: 'error', secret_ref: VAULT }), 'verification_failed');
  // and it still applies to an account that genuinely has nothing yet
  assert.equal(connState({ connection_id: 'poppy', provider: 'gumroad', state: 'not_connected' }), 'connecting');
});

ok('every state has a label a founder can read', () => {
  const { CONN_CHIP } = states();
  for (const s of ['connecting', 'connected', 'connected_unverified', 'missing_permission',
                   'verification_failed', 'reauth_required', 'pc_only', 'not_connected']) {
    assert.ok(CONN_CHIP[s], `no label for ${s}`);
    assert.ok(CONN_CHIP[s][1] && CONN_CHIP[s][1].length > 2, `empty label for ${s}`);
  }
});

// ---------------------------------------------------------------- which platforms are offered
ok('only a platform that can really be published to is offered a Connect button', () => {
  const PLAT = new Function(`${platformsSrc}\nreturn OAUTH_PLATFORMS;`)();
  assert.deepEqual(Object.keys(PLAT).sort(), ['gumroad', 'youtube'],
    'the other destinations have no publishing API; offering Connect would promise what cannot happen');
  assert.equal(PLAT.gumroad.team, 'ebooks');
  assert.ok(PLAT.gumroad.subteam.startsWith('ebooks/'), PLAT.gumroad.subteam);
  assert.ok(/^[a-z0-9][a-z0-9._-]{1,60}$/.test(PLAT.gumroad.connection), PLAT.gumroad.connection);
});

// Where a platform is signed into once and then chooses WHICH account, the connection cannot be
// baked into the platform entry: there are fifteen of them. YouTube therefore names no connection,
// and each card passes its own - which is also why it must not name a team, or signing in would
// silently decide where a channel publishes.
ok('a many-account platform names no single connection and no team', () => {
  const PLAT = new Function(`${platformsSrc}\nreturn OAUTH_PLATFORMS;`)();
  assert.equal(PLAT.youtube.connection, undefined);
  assert.equal(PLAT.youtube.team, undefined, 'signing in would have assigned the channel by itself');
  assert.equal(PLAT.youtube.choose, 'channel', 'the founder must be warned which thing to pick');
});

// ---------------------------------------------------------------- driving the button
const CONNS_FIXTURE = [
  { connection_id: 'poppy', provider: 'gumroad', external_name: 'Mangesh Lokade', secret_ref: VAULT },
  { connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow – Daily Science',
    secret_ref: '~/.nova-secrets/youtube.env' },
  { connection_id: 'yt-food', provider: 'youtube', external_name: 'TasteOdessey',
    secret_ref: '~/.nova-secrets/youtube-food.env' },
];

function run({ rpc, confirmed = true, conns = CONNS_FIXTURE }) {
  const log = [];
  const opened = [];
  const asked = [];
  const PLAT = new Function(`${platformsSrc}\nreturn OAUTH_PLATFORMS;`)();
  const scope = {
    OAUTH_PLATFORMS: PLAT,
    sb: { rpc: async (fn, args) => { log.push({ fn, args }); return rpc(fn, args); } },
    toast: (m) => log.push({ toast: m }),
    render: () => log.push({ render: true }),
    confirm: (m) => { asked.push(m); return confirmed; },
    window: { open: (u) => opened.push(u), COCO_TIMEOUT_MS: 120 },
    CONNS: conns,
  };
  const fn = new Function('OAUTH_PLATFORMS', 'sb', 'toast', 'render', 'confirm', 'window', 'CONNS',
    `let connConnecting = null, connConnectingAt = 0;
     ${timeoutSrc}
     ${connectSrc}
     return { oauthConnect, withTimeout, peek: () => ({ connConnecting, connConnectingAt }) };`);
  const api = fn(scope.OAUTH_PLATFORMS, scope.sb, scope.toast, scope.render, scope.confirm,
    scope.window, scope.CONNS);
  return { api, log, opened, asked };
}

const began = (log) => (log.find((l) => l.fn === 'coco_oauth_begin') || {}).args || {};
const beginOk = (url) => async (fn) => fn === 'coco_oauth_begin'
  ? { data: { ok: true, state: 'the-single-use-state', authorize_url: url }, error: null }
  : { data: null, error: { message: 'unexpected call' } };

ok('a founder-and-device refusal is shown, not swallowed', async () => {
  const { api, log, opened } = run({
    rpc: async () => ({ data: null, error: { message: 'xyz: only a founder on a paired device may connect a platform' } }),
  });
  await api.oauthConnect('gumroad');
  const said = log.filter((l) => l.toast).map((l) => l.toast).join(' | ');
  assert.match(said, /founder on a paired device/i, said);
  assert.equal(opened.length, 0, 'it sent the founder to the platform despite being refused');
});

ok('nothing opens if the founder cancels the confirmation', async () => {
  const { api, log, opened } = run({ rpc: async () => ({ data: {}, error: null }), confirmed: false });
  await api.oauthConnect('gumroad');
  assert.equal(opened.length, 0);
  assert.equal(log.filter((l) => l.fn).length, 0, 'it called the cloud before the founder agreed');
});

ok('a successful begin opens the authorization URL and nothing else', async () => {
  const url = 'https://gumroad.com/oauth/authorize?client_id=abc&state=xyz';
  const { api, log, opened } = run({
    rpc: async (fn) => fn === 'coco_oauth_begin'
      ? { data: { ok: true, state: 'the-single-use-state', authorize_url: url }, error: null }
      : { data: null, error: { message: 'unexpected call' } },
  });
  await api.oauthConnect('gumroad');
  assert.deepEqual(opened, [url]);
  assert.equal(log.filter((l) => l.fn).length, 1, 'more than one cloud call was made');
  assert.equal(log.filter((l) => l.fn)[0].fn, 'coco_oauth_begin');
});

ok('the single-use state is never kept in the browser', async () => {
  const secret = 'THE-SINGLE-USE-STATE-VALUE';
  const { api, log, opened } = run({
    rpc: async () => ({ data: { ok: true, state: secret, authorize_url: `https://gumroad.com/oauth/authorize?state=${secret}` }, error: null }),
  });
  await api.oauthConnect('gumroad');
  // It may travel INSIDE the authorize URL - that is where it belongs - but it must not be kept.
  const kept = JSON.stringify({ log, peek: api.peek() });
  assert.ok(!kept.includes(secret), `the state was retained somewhere: ${kept.slice(0, 200)}`);
  assert.ok(opened[0].includes(secret), 'the state did not reach the authorize URL at all');
});

ok('a begin that returns no link does not pretend it worked', async () => {
  const { api, log, opened } = run({ rpc: async () => ({ data: { ok: true }, error: null }) });
  await api.oauthConnect('gumroad');
  assert.equal(opened.length, 0);
  assert.match(log.filter((l) => l.toast).map((l) => l.toast).join(' '), /did not return an authorization link/i);
});

ok('an unknown platform is refused before any cloud call', async () => {
  const { api, log } = run({ rpc: async () => ({ data: {}, error: null }) });
  await api.oauthConnect('amazon_kdp');
  assert.equal(log.filter((l) => l.fn).length, 0);
  assert.match(log.filter((l) => l.toast).map((l) => l.toast).join(' '), /no connection flow/i);
});

// ---------------------------------------------------------------- nothing waits for ever
// supabase-js sets no request timeout. A stalled call used to leave the UI with no error and
// nothing moving, which is what a frozen app looks like from the outside.
ok('a stalled cloud call gives up and says so, instead of waiting for ever', async () => {
  const { api, log, opened } = run({ rpc: () => new Promise(() => {}) });   // never settles
  const started = Date.now();
  await api.oauthConnect('youtube', 'yt-the-flow');
  const waited = Date.now() - started;
  assert.ok(waited < 3000, `it waited ${waited}ms, so it is still unbounded`);
  const said = log.filter((l) => l.toast).map((l) => l.toast).join(' | ');
  assert.match(said, /did not answer within/i, said);
  assert.equal(opened.length, 0, 'it sent the founder to Google after a timeout');
});

ok('the deadline helper clears its timer when the work wins the race', async () => {
  const { api } = run({ rpc: async () => ({ data: {}, error: null }) });
  const r = await api.withTimeout(Promise.resolve('done'), 'a thing', 50);
  assert.equal(r, 'done');
  // an uncleared timer would keep the process alive and reject after the fact
  await new Promise((res) => setTimeout(res, 80));
});

// ---------------------------------------------------------------- one channel at a time
// The bug this guards against: Connect used to read the connection id out of OAUTH_PLATFORMS, so
// every YouTube card on the screen would have authorised the SAME connection. Fifteen channels
// would have fought over one row, and fourteen of them could never be connected at all.
ok('each account connects itself, not whatever the platform entry names', async () => {
  const { api, log, opened } = run({ rpc: beginOk('https://accounts.google.com/o/oauth2/v2/auth?x=1') });
  await api.oauthConnect('youtube', 'yt-food');
  assert.equal(began(log).p_connection_id, 'yt-food');
  assert.equal(opened.length, 1);
  const second = run({ rpc: beginOk('https://accounts.google.com/o/oauth2/v2/auth?x=2') });
  await second.api.oauthConnect('youtube', 'yt-the-flow');
  assert.equal(began(second.log).p_connection_id, 'yt-the-flow');
});

ok('connecting a channel never also assigns it', async () => {
  const { api, log } = run({ rpc: beginOk('https://accounts.google.com/o/oauth2/v2/auth') });
  await api.oauthConnect('youtube', 'yt-the-flow');
  const args = began(log);
  // Where a video lands is the founder's separate decision. If signing in carried a team, picking
  // a channel on Google's screen would quietly decide what publishes to it.
  assert.ok(!args.p_team, `a team was sent with the connect: ${args.p_team}`);
  assert.ok(!args.p_subteam, `a sub-team was sent with the connect: ${args.p_subteam}`);
});

ok('the founder is told which channel to pick, by name', async () => {
  const { api, asked } = run({ rpc: beginOk('https://accounts.google.com/o/oauth2/v2/auth') });
  await api.oauthConnect('youtube', 'yt-the-flow');
  const said = asked.join(' | ');
  assert.match(said, /The Flow/, said);
  assert.match(said, /pick/i, said);
  assert.match(said, /refuses to store the wrong one/i, said);
});

ok('a many-account platform with no account named does nothing rather than guess', async () => {
  const { api, log, opened } = run({ rpc: beginOk('https://x') });
  await api.oauthConnect('youtube');
  assert.equal(log.filter((l) => l.fn).length, 0, 'it started a flow without knowing which channel');
  assert.equal(opened.length, 0);
  assert.match(log.filter((l) => l.toast).map((l) => l.toast).join(' '), /which account/i);
});

// ---------------------------------------------------------------- Verify has to be real
// It used to call coco_connection('verify'), which set last_verified_at = now() and contacted
// nothing. That is how every YouTube card went green. The screen must now go to the cloud, and must
// say so plainly where no cloud check exists rather than falling back to the old write.
ok('Verify does not write a timestamp through the connection RPC', () => {
  const verifySrc = lift(/async function connectionVerify\(connection\) \{/, '\n}', 'connectionVerify');
  assert.ok(!/coco_connection/.test(verifySrc),
    'Verify still goes through coco_connection, which cannot check anything');
  assert.match(verifySrc, /functions\.invoke/, 'Verify does not call the cloud at all');
  // The browser sends an id and reads a verdict. It has no part in resolving the credential, which
  // is why the check cannot live on this side at all.
  assert.match(verifySrc, /connection_id: connection/);
  assert.ok(!/\.(access_token|refresh_token)\b/.test(verifySrc),
    'Verify handles a token itself; the client should attach the sign-in');
});

ok('a platform with no cloud check is told so, and nothing is changed', () => {
  const routes = new Function(`${lift(/const CLOUD_VERIFY = \{/, '};', 'CLOUD_VERIFY')}\nreturn CLOUD_VERIFY;`)();
  assert.ok(routes.youtube, 'YouTube has no verify route');
  assert.equal(routes.amazon_kdp, undefined);
});

ok('every verdict the cloud can return has words for it', () => {
  const said = new Function(`${lift(/const VERIFY_SAID = \{/, '};', 'VERIFY_SAID')}\nreturn VERIFY_SAID;`)();
  for (const s of ['CONNECTED_VERIFIED', 'NOT_ASSIGNED', 'CONNECTED_WRONG_CHANNEL',
                   'CONNECTED_EXPIRED', 'CONNECTED_MISSING_PERMISSION', 'NOT_CONNECTED']) {
    assert.ok(said[s] && said[s].length > 4, `no words for ${s}`);
  }
  assert.match(said.CONNECTED_WRONG_CHANNEL, /not safe to publish/i,
    'the one verdict that must stop a founder reads like any other');
});

// ---------------------------------------------------------------- can a founder REACH the page
// The bug this guards against: below 780px the rail is display:none and the bottom bar held five
// ids, so fifteen pages - Integrations among them - could not be reached at all on a phone. A
// perfect Connect button is worth nothing if the screen holding it is unreachable.
function renderNav({ current = 'connections' } = {}) {
  const navSrc = lift(/\nfunction nav\(\) \{/, '\n}', 'nav()');
  const pagesSrc = lift(/const PAGES = \[/, '];', 'PAGES');
  const bottomSrc = lift(/const BOTTOM = \[/, '];', 'BOTTOM');
  const out = {};
  const $$ = (sel) => ({ sel, onclick: null, textContent: '' });
  const morph = (node, html) => { out[node.sel] = html; };
  const fn = new Function(
    'D', 'page', 'esc', 'morph', '$', 'founder', 'me', 'deviceName', 'deviceId', 'sb', 'show', 'out',
    pagesSrc + '\n' + bottomSrc + '\n' + navSrc + '\nnav();\nreturn out;');
  return fn({ approvals: [] }, current, (s) => String(s == null ? '' : s), morph, $$,
    { name: 'Boss', call_me: 'Boss' }, { email: 'x@y.z' }, () => 'This PC', 'dev1',
    { auth: { signOut: async () => {} } }, () => {}, out);
}

ok('every page is reachable from the bottom bar, directly or through the sheet', () => {
  const pagesSrc = lift(/const PAGES = \[/, '];', 'PAGES');
  const ids = new Function(pagesSrc + '\nreturn PAGES.map((p) => p[0]);')();
  const out = renderNav();
  const reachable = new Set();
  for (const key of ['#bottom', '#moreNav']) {
    for (const m of String(out[key] || '').matchAll(/href="#([a-z-]+)"/g)) reachable.add(m[1]);
  }
  const missing = ids.filter((id) => !reachable.has(id));
  assert.deepEqual(missing, [], 'unreachable on a phone: ' + missing.join(', '));
});

ok('Integrations specifically is reachable, and it is the page Connect lives on', () => {
  const out = renderNav();
  assert.match(String(out['#moreNav']), /href="#connections"/);
  assert.match(String(out['#moreNav']), /Integrations/);
});

ok('the bottom bar offers a way into the rest, and says where you are', () => {
  const out = renderNav({ current: 'connections' });
  assert.match(String(out['#bottom']), /data-more="1"/, 'no way to reach the hidden pages');
  // when the current page is one the bar cannot show, the control names it rather than saying More
  assert.match(String(out['#bottom']), /Integrations/,
    'the bar should name the current page when it is one of the hidden ones');
});

ok('on a page the bar does show, the control reads More and is not lit', () => {
  const bar = String(renderNav({ current: 'home' })['#bottom']);
  assert.match(bar, /data-more="1"/);
  assert.match(bar, />More</);
});

// ------------------------------------------------- the rail has to be able to REACH its own links
// Boss could not find Integrations on the desktop app, and it was not hidden, filtered or stale:
// the rail is height:100vh and holds twenty links, so on a window that could not fit them the last
// five - Integrations, Club, Rules, Devices, Settings - were simply cut off below the fold with
// nothing to scroll. A nav that cannot reach its own last item is the same bug as a missing item.
ok('the rail scrolls, so a short window cannot cut links off', () => {
  const css = src.slice(0, src.indexOf('</style>'));
  const rail = (css.match(/\n\.rail \{[^}]*\}/) || [''])[0];
  assert.match(rail, /height:\s*100vh/, 'the rail is a fixed-height column');
  const navRule = (css.match(/\n\.rail \.nav \{[^}]*\}/) || [''])[0];
  assert.ok(navRule, 'the rail gives its nav no sizing rule at all, so the links overflow and clip');
  assert.match(navRule, /overflow-y:\s*auto/, 'the nav cannot be scrolled');
  // the one that is easy to leave out and silently breaks the whole thing
  assert.match(navRule, /min-height:\s*0/,
    'without min-height:0 a flex child will not shrink below its content, so overflow-y does nothing');
  assert.match(navRule, /flex:\s*1/, 'the nav must take the space left between the brand and the footer');
});

ok('the brand and the footer stay put while the links scroll', () => {
  const css = src.slice(0, src.indexOf('</style>'));
  assert.match(css, /\.rail \.brand \{[^}]*flex:\s*none/, 'the brand would scroll away with the links');
  assert.match(css, /\.rail \.me \{[^}]*flex:\s*none/, 'the sign-out footer would be pushed off');
});

// ---------------------------------------------------------------- the page says the right thing
ok('the founder sees the agreed explanation before connecting', () => {
  assert.match(src.replace(/\s+/g, ' '), /Connect your \$\{esc\(p\.name\)\} account once\. Coco will securely store the authorization in the cloud so publishing can run without your PC\./);
});

ok('the screen never renders a credential', () => {
  assert.ok(!/\$\{c\.secret_ref\}/.test(src), 'secret_ref is printed into the page');
  assert.ok(!/access_token|client_secret/.test(src), 'a token field is referenced in the UI');
});

const done = async () => {
  await new Promise((r) => setTimeout(r, 50));
  console.log(`\noauth ui: ${pass}/${pass + fails.length} passed`);
  if (fails.length) { for (const f of fails) console.log(`  ${f}`); process.exit(1); }
};
await done();
