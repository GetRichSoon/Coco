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
const connectSrc = lift(/async function oauthConnect\(provider\) \{/, '\n}', 'oauthConnect');
const stateSrc = lift(/const connState = \(c\) => \{/, '};', 'connState');
const chipSrc = lift(/const CONN_CHIP = \{/, '};', 'CONN_CHIP');

// ---------------------------------------------------------------- the five states
function states({ connecting = null, at = 0 } = {}) {
  const scope = { connConnecting: connecting, connConnectingAt: at, OAUTH_PLATFORMS: {} };
  const fn = new Function('connConnecting', 'connConnectingAt',
    `${stateSrc}\n${chipSrc}\nreturn { connState, CONN_CHIP };`);
  return fn(scope.connConnecting, scope.connConnectingAt);
}

ok('a never-connected account reads as Not connected', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'not_connected' }), 'not_connected');
});

ok('a connected and verified account reads as Connected', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'connected', last_verified_at: '2026-10-28T00:00:00Z' }), 'connected');
});

ok('connected but never checked is NOT reported as Connected', () => {
  const { connState } = states();
  const s = connState({ provider: 'gumroad', state: 'connected', last_verified_at: null });
  assert.equal(s, 'connected_unverified');
  assert.notEqual(s, 'connected', 'an unverified connection must not read as verified');
});

ok('an errored account reads as Verification failed', () => {
  const { connState } = states();
  assert.equal(connState({ provider: 'gumroad', state: 'error' }), 'verification_failed');
});

ok('an account that HAS a credential reference but is not connected needs reconnecting', () => {
  const { connState } = states();
  // This is the distinction that matters: it was authorised once, so the answer is re-authorise,
  // not add an account again.
  assert.equal(connState({ provider: 'gumroad', state: 'not_connected', secret_ref: 'gumroad_access_token_poppy' }),
    'reauth_required');
});

ok('a flow just started reads as Connecting, and only for ten minutes', () => {
  const fresh = states({ connecting: 'gumroad', at: Date.now() });
  assert.equal(fresh.connState({ provider: 'gumroad', state: 'not_connected' }), 'connecting');
  const stale = states({ connecting: 'gumroad', at: Date.now() - 11 * 60_000 });
  assert.equal(stale.connState({ provider: 'gumroad', state: 'not_connected' }), 'not_connected',
    'a stale Connecting must not stick: the founder would be told a flow is open when it has expired');
});

ok('the cloud beats the Connecting flag, which is only this page remembering', () => {
  const { connState } = states({ connecting: 'gumroad', at: Date.now() });
  // The flag is this page's memory of the last ten minutes; the account row is the authority.
  // Letting the flag win would tell a founder a flow is still open about an account that is
  // already connected and verified.
  assert.equal(connState({ provider: 'gumroad', state: 'connected', last_verified_at: '2026-10-28T00:00:00Z' }),
    'connected');
  assert.equal(connState({ provider: 'gumroad', state: 'error' }), 'verification_failed');
  // and it still applies to an account that genuinely has nothing yet
  assert.equal(connState({ provider: 'gumroad', state: 'not_connected' }), 'connecting');
});

ok('every state has a label a founder can read', () => {
  const { CONN_CHIP } = states();
  for (const s of ['connecting', 'connected', 'connected_unverified', 'verification_failed', 'reauth_required', 'not_connected']) {
    assert.ok(CONN_CHIP[s], `no label for ${s}`);
    assert.ok(CONN_CHIP[s][1] && CONN_CHIP[s][1].length > 2, `empty label for ${s}`);
  }
});

// ---------------------------------------------------------------- which platforms are offered
ok('only a platform that can really be published to is offered a Connect button', () => {
  const PLAT = new Function(`${platformsSrc}\nreturn OAUTH_PLATFORMS;`)();
  assert.deepEqual(Object.keys(PLAT), ['gumroad'],
    'the other five destinations have no publishing API; offering Connect would promise what cannot happen');
  assert.equal(PLAT.gumroad.team, 'ebooks');
  assert.ok(PLAT.gumroad.subteam.startsWith('ebooks/'), PLAT.gumroad.subteam);
  assert.ok(/^[a-z0-9][a-z0-9._-]{1,60}$/.test(PLAT.gumroad.connection), PLAT.gumroad.connection);
});

// ---------------------------------------------------------------- driving the button
function run({ rpc, confirmed = true }) {
  const log = [];
  const opened = [];
  const PLAT = new Function(`${platformsSrc}\nreturn OAUTH_PLATFORMS;`)();
  const scope = {
    OAUTH_PLATFORMS: PLAT,
    sb: { rpc: async (fn, args) => { log.push({ fn, args }); return rpc(fn, args); } },
    toast: (m) => log.push({ toast: m }),
    render: () => log.push({ render: true }),
    confirm: () => confirmed,
    window: { open: (u) => opened.push(u) },
    connConnecting: null, connConnectingAt: 0,
  };
  const fn = new Function('OAUTH_PLATFORMS', 'sb', 'toast', 'render', 'confirm', 'window',
    `let connConnecting = null, connConnectingAt = 0;
     ${connectSrc}
     return { oauthConnect, peek: () => ({ connConnecting, connConnectingAt }) };`);
  const api = fn(scope.OAUTH_PLATFORMS, scope.sb, scope.toast, scope.render, scope.confirm, scope.window);
  return { api, log, opened };
}

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
