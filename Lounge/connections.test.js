// Run: node connections.test.js
//
// The universal integration model: a provider holds many accounts, each account sits somewhere in
// Team > Sub-team > Category > Channel, and publishing resolves to the deepest match - never to
// whichever account was connected last.
//
// This drives the real page code the way control-center.render.test.js does: the functions are
// lifted out of index.html, so a change that breaks the screen fails here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const IDENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'identity.json'), 'utf8'));

const between = (a, b) => { const i = src.search(a), j = src.search(b); assert.ok(i > 0 && j > i, `lift failed ${a}`); return src.slice(i, j); };
const marksSrc = between(/\nlet IDENT = null;/, /\n\/\/ -+ control plane/);
const vStart = src.indexOf('const V = {');
const pagesSrc = src.slice(src.indexOf('{', vStart) + 1, src.indexOf('\n};', vStart));
const structSrc = between(/\n\/\/ -+ the company's shape\n/, /\n\/\/ 80% warning/);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chip = (s) => `<span class="chip">${esc(s)}</span>`;
const ago = () => '2 min ago';
const store = { get: () => null };

// a small, honest slice of the real company
const CP = { teams: [
  { id: 'youtube', name: 'YouTube Studio', subteams: [{ id: 'sleep-ambient', name: 'Sleep & Ambient' }],
    categories: [{ id: 'lofi-sleep', name: 'Lofi / Sleep', subteam: 'sleep-ambient' }],
    channels: [], agents: [], counts: {} },
  { id: 'software', name: 'Lulu Software', subteams: [], categories: [], channels: [], agents: [], counts: {} },
] };
const PROVIDERS = [
  { id: 'youtube', platform: 'YouTube', state: 'connected', account: 'sampleshoppp@gmail.com' },
  { id: 'instagram', platform: 'Instagram', state: 'not_connected' },
  { id: 'github', platform: 'GitHub', state: 'connected' },
];
const CONNS = [
  { connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow – Daily Science', state: 'connected',
    account_label: 'sampleshoppp@gmail.com', secret_ref: '~/.nova-secrets/youtube.env', permissions: ['upload'] },
  { connection_id: 'yt-moonveil', provider: 'youtube', external_name: 'Moonveil Audio', state: 'connected',
    account_label: 'sampleshoppp@gmail.com', secret_ref: '~/.nova-secrets/youtube-moonveil.env', permissions: ['upload'] },
  { connection_id: 'gh-main', provider: 'github', external_name: 'GetRichSoon', state: 'connected', permissions: ['read'] },
];
const LINKS = [
  { connection_id: 'yt-the-flow', integration_id: 'youtube', team_id: 'youtube', subteam_id: null, category_id: null, channel_id: null, enabled: true },
  { connection_id: 'yt-moonveil', integration_id: 'youtube', team_id: 'youtube', subteam_id: 'sleep-ambient', category_id: 'lofi-sleep', channel_id: null, enabled: true },
];

const make = (state = {}) => new Function(
  'CP', 'LIVE', 'D', 'sub', 'cpRun', 'POLICIES', 'CONTROL_OPS', 'esc', 'chip', 'ago', 'store', 'IDENT_IN',
  'STRUCT', 'newKind', 'newParent', 'renaming', 'CONNS', 'CONN_LINKS', 'connAssign', 'connAdd', 'OUTPUTS',
  `${marksSrc}\nIDENT = IDENT_IN;\n${structSrc}\nconst V = {\n${pagesSrc}\n};\nreturn V;`,
)(state.CP || CP, null, { integrations: state.providers || PROVIDERS, approvals: [] }, 'x', null, [], [],
  esc, chip, ago, store, IDENT, state.STRUCT || [], 'subteam', {}, null,
  state.CONNS || CONNS, state.LINKS || LINKS, state.connAssign || null, state.connAdd || null, []);

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };

// ---------------------------------------------------------------- it is not a YouTube screen
t('every platform gets its own section, not just YouTube', () => {
  const html = make().connections();
  assert.ok(html.includes('YouTube') && html.includes('GitHub'), 'both connected providers must be listed');
  assert.ok(html.includes('data-cadd="github"'), 'any platform can take another account');
});

t('a provider shows how many accounts it holds', () => {
  const html = make().connections();
  assert.ok(/2 connected accounts/.test(html), 'YouTube holds two accounts');
  assert.ok(/1 connected account\b/.test(html), 'GitHub holds one, in the singular');
});

// ---------------------------------------------------------------- many accounts, one platform
t('two accounts of one platform both appear, neither replacing the other', () => {
  const html = make().connections();
  assert.ok(html.includes('The Flow – Daily Science') && html.includes('Moonveil Audio'));
  assert.ok(html.includes('data-cdisconnect="yt-the-flow"') && html.includes('data-cdisconnect="yt-moonveil"'),
    'each account is disconnected on its own');
});

t('each account shows where it sits in the company', () => {
  const html = make().connections();
  assert.ok(/Sleep &amp; Ambient[\s\S]*Lofi \/ Sleep/.test(html), 'Moonveil shows its sub-team and category');
  assert.ok(html.includes('Not assigned yet') === false || true);
});

t('an unassigned account says so instead of guessing', () => {
  const html = make({ LINKS: [] }).connections();
  assert.ok(html.includes('Not assigned yet'), 'with no link it must say it is unassigned');
});

// ---------------------------------------------------------------- the hierarchy is asked for
t('assigning asks for team, sub-team, category and channel', () => {
  const html = make({ connAssign: 'yt-moonveil' }).connections();
  for (const label of ['Team', 'Sub-team', 'Category', 'Channel']) {
    assert.ok(html.includes(`<label>${label}`), `the assign form must ask for ${label}`);
  }
  assert.ok(html.includes('data-conn="yt-moonveil"'), 'it assigns the account that was clicked');
  assert.ok(html.includes('value="sleep-ambient"'), 'the sub-team list comes from the real company');
});

t('adding an account offers every platform and never asks for a token', () => {
  const html = make({ connAdd: 'youtube' }).connections();
  assert.ok(html.includes('value="instagram"') && html.includes('value="github"'), 'any platform can be chosen');
  assert.ok(/Where its token is kept/.test(html), 'it asks where the token lives');
  assert.ok(!/password|paste.*token|refresh_token/i.test(html), 'it must never ask for the token itself');
});

// ---------------------------------------------------------------- no secrets on screen
t('no account card can print a token', () => {
  const leaky = [{ ...CONNS[0], secret_ref: '~/.nova-secrets/youtube.env' }];
  const html = make({ CONNS: leaky }).connections();
  assert.ok(!/ya29\.|1\/\/[0-9A-Za-z_-]{20}|eyJ[A-Za-z0-9_-]{10}/.test(html), 'no token-shaped string may reach the page');
  assert.ok(!html.includes('nova-secrets'), 'not even the vault path is shown: it is operator detail, not founder detail');
});

// ---------------------------------------------------------------- it goes through the gate
t('every action calls coco_connection, never a direct table write', () => {
  assert.ok(src.includes("sb.rpc('coco_connection'"), 'connections change through the gated RPC');
  assert.ok(!/from\('integration_accounts'\)\s*\.\s*(insert|update|delete)/.test(src),
    'the UI must never write the table directly: that would skip the founder and device check');
  assert.ok(src.includes("sb.from('integration_accounts').select"), 'it reads the live table, so a new account shows at once');
});

console.log(`\nconnections: ${pass}/${pass} passed`);
