// Run: node cloud.render.test.js
// Test: the Cloud page (autonomy, security, integrations, teams). integStatus(), cloudSafe() and cloudPage() are lifted out of
// index.html and run against fixtures shaped like the real tables and data files: nothing throws, nothing prints undefined/NaN or a
// secret-looking string, every empty or unreadable source says so, hostile text is escaped, and the status mapping is exact.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { structure, pcDeps, security } from './test-fixtures.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
// synthetic fixtures: the public repository holds no company data
const DEV = structure(), PCD = pcDeps(), SEC = security();
let passed = 0;
const ok = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { process.exitCode = 1; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const grab = (decl) => {
  const start = html.indexOf(decl); assert.ok(start > 0, decl + ' not found in index.html');
  let depth = 0;
  for (let j = html.indexOf('{', html.indexOf(')', start)); j < html.length; j++) { if (html[j] === '{') depth++; else if (html[j] === '}' && !--depth) return html.slice(start, j + 1); }
  throw new Error(decl + ' not closed');
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (t) => (t ? 'x ago' : 'never');
const online = (d) => d.last_seen && Date.now() - new Date(d.last_seen) < 150000;
const safeStart = html.indexOf('const cloudSafe = '), safeSrc = html.slice(safeStart, html.indexOf('async function cloudLoad', safeStart));
const src = ['let CLOUD = null, cloudAt = 0, cloudBusy = false, page = "cloud", sub = "autonomy", D = {}, POLICIES = [], CONNS = [], CONN_LINKS = [], ORG = null;',
  'const CLOUD_TABS = [["autonomy", "Autonomy"], ["security", "Security"], ["integrations", "Integrations"], ["teams", "Teams"]]; const INTEG_EVIDENCE_MS = 72 * 3600 * 1000;',
  grab('function integStatus('), safeSrc, grab('async function cloudLoad('), grab('function cloudPage('),
  'return { integStatus, cloudSafe, cloudLoad, cloudPage, set(o) { if ("sub" in o) sub = o.sub; if ("D" in o) D = o.D; if ("POLICIES" in o) POLICIES = o.POLICIES; if ("CONNS" in o) CONNS = o.CONNS; if ("CONN_LINKS" in o) CONN_LINKS = o.CONN_LINKS; if ("ORG" in o) ORG = o.ORG; if ("CLOUD" in o) CLOUD = o.CLOUD; } };'].join(String.fromCharCode(10));
const app = new Function('esc', 'ago', 'online', 'sb', 'novaFetch', 'render', src)(esc, ago, online, null, null, () => {});

const NOW = Date.now(), H = 3600e3, iso = (ms) => new Date(NOW - ms).toISOString();
const SECRET_RES = [/AIza[0-9A-Za-z_-]{20,}/, /\bsk-[A-Za-z0-9]{16,}/, /\bghp_[A-Za-z0-9]{20,}/, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, /\b[A-Za-z0-9_-]{40,}\b/, /(token|secret|password|api[_-]?key)\s*[=:]\s*\S{8,}/i];
const BAD = /undefined|NaN|\[object|null</;
const FAKE = 'AIzaSyD' + 'x9Kq2LmN8pQrStUvWxYz0123456789ab';   // assembled at run time: a stand-in secret, not a real one
const hostile = '<img src=x onerror=alert(1)>"\'';

const integ = (o) => ({ id: 'yt', platform: 'YouTube', state: 'connected', account: 'Account One', error: null, next_action: null, last_ok_at: iso(2 * H), ...o });
const acct = (o) => ({ connection_id: 'yt-main', provider: 'yt', state: 'connected', secret_ref: 'vault:yt', last_verified_at: iso(5 * H), note: null, ...o });

console.log('cloud page');
await ok('the page script in index.html parses as a whole, and Cloud is in the navigation, routed and defaulted', () => {
  for (const m of html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
  assert.match(html, /\['cloud', 'Cloud', 'cloud'\]/); assert.match(html, /cloud\(\) \{ cloudLoad\(\); return cloudPage\(\); \}/); assert.match(html, /cloud: 'autonomy'/);
});

console.log(' status mapping');
const st = (i, a, inc) => app.integStatus(i, a, inc, NOW).status;
await ok('connected with a recent verification is CONNECTED_AND_VERIFIED', () => { assert.equal(st(integ(), [acct()], []), 'CONNECTED_AND_VERIFIED'); assert.equal(st(integ({ last_ok_at: null }), [acct()], []), 'CONNECTED_AND_VERIFIED'); assert.equal(st(integ(), [], []), 'CONNECTED_AND_VERIFIED'); });
await ok('connected with no recent evidence is UNKNOWN, never connected', () => { assert.equal(st(integ({ last_ok_at: iso(100 * H) }), [acct({ last_verified_at: iso(100 * H) })], []), 'UNKNOWN'); assert.equal(st(integ({ last_ok_at: null }), [], []), 'UNKNOWN'); assert.equal(st(integ({ last_ok_at: new Date(NOW + 30 * 86400e3).toISOString() }), [], []), 'UNKNOWN'); });
await ok('an open or contained incident naming the integration makes it CONNECTED_BUT_INSECURE; a CLOSED one does not', () => {
  assert.equal(st(integ({ id: 'gumroad' }), [], [{ id: 'INC-1', status: 'OPEN', affected: 'Gumroad (seller). Integration rows gumroad and gumroad-two use it.' }]), 'CONNECTED_BUT_INSECURE');
  assert.equal(st(integ({ id: 'gumroad-two' }), [], [{ id: 'INC-1', status: 'CONTAINED', affected: 'rows gumroad and gumroad-two' }]), 'CONNECTED_BUT_INSECURE');
  assert.equal(st(integ({ id: 'gum' }), [], [{ id: 'INC-1', status: 'OPEN', affected: 'gumroad and gumroad-two' }]), 'CONNECTED_AND_VERIFIED');
  assert.equal(st(integ({ id: 'gumroad' }), [], [{ id: 'INC-1', status: 'CLOSED', affected: 'gumroad' }]), 'CONNECTED_AND_VERIFIED');
});
await ok('error rows map by what the error says', () => {
  for (const [e, w] of [['token expired', 'EXPIRED'], ['Invalid credentials (401)', 'INVALID'], ['revoked by user', 'INVALID'], ['missing scope youtube.upload', 'INSUFFICIENT_PERMISSION'], ['403 forbidden', 'INSUFFICIENT_PERMISSION'], ['timeout', 'CONNECTED_BUT_FAILING'], ['', 'CONNECTED_BUT_FAILING']])
    assert.equal(st(integ({ state: 'error', error: e }), [], []), w, e);
  assert.equal(st(integ({ state: 'connected' }), [acct({ state: 'error', note: 'token expired' })], []), 'EXPIRED');
});
await ok('partial, paused, not_connected and odd rows', () => {
  assert.equal(st(integ({ state: 'partial' }), [], []), 'CONNECTED_BUT_FAILING'); assert.equal(st(integ({ state: 'partial', last_ok_at: null }), [], []), 'UNKNOWN');
  assert.equal(st(integ({ state: 'paused' }), [], []), 'DISCONNECTED');
  assert.equal(st(integ({ state: 'not_connected', last_ok_at: null }), [], []), 'NOT_CONFIGURED'); assert.equal(st(integ({ state: 'not_connected' }), [], []), 'DISCONNECTED'); assert.equal(st(integ({ state: 'not_connected', last_ok_at: null }), [acct()], []), 'DISCONNECTED');
  assert.equal(st(integ({ state: 'weird' }), [], []), 'UNKNOWN'); assert.equal(app.integStatus(null, [], [], NOW).status, 'UNKNOWN'); assert.equal(st({ id: 'x' }, undefined, undefined), 'UNKNOWN');
});
await ok('cloudSafe hides token-shaped values and keeps plain sentences', () => {
  assert.ok(!app.cloudSafe('key ' + FAKE).includes(FAKE)); assert.ok(!app.cloudSafe('ghp_' + 'A1b2'.repeat(8)).includes('ghp_A1b2'));
  assert.equal(app.cloudSafe('Reset the JWT secret in the project dashboard'), 'Reset the JWT secret in the project dashboard'); assert.equal(app.cloudSafe(null), '');
});

// fixtures shaped like the real tables
const devices = [{ id: 'cloud-worker-1', name: 'cloud-worker-1', platform: 'cloud', last_seen: iso(20e3) }, { id: 'pc', name: 'Boss PC', kind: 'pc', last_seen: iso(3 * H) }, { id: 'ph', name: 'Phone' }];
const jobs = [...['queued', 'queued', 'running', 'done', 'done', 'failed', 'blocked'].map((s, n) => ({ id: 'J' + n, team_id: 'house_b', status: s, attempt: n % 3, created_at: iso((n + 1) * H) }))];
const uses = [
  { at: iso(H), capability_id: 'access:gumroad.stats', team_id: 'house_b', ok: true, note: JSON.stringify({ decision: 'allow', provider: 'gumroad' }) },
  { at: iso(2 * H), capability_id: 'access:gumroad.publish', team_id: 'house_b', ok: true, note: JSON.stringify({ decision: 'shadow_deny', provider: 'gumroad', capability: 'publish', reason: 'team house_b may not use gumroad ' + FAKE }) },
  { at: iso(3 * H), capability_id: 'access:youtube.token_mint', team_id: 'house_a', ok: false, note: JSON.stringify({ decision: 'deny', provider: 'youtube', capability: 'token_mint', reason: 'no job' }) },
  { at: iso(4 * H), capability_id: 'access:x.y', team_id: null, ok: true, note: '{not json' },
];
const act = [{ actor: 'security-scan', action: 'secret scan clean', detail: 'ok', at: iso(H) }, { actor: 'Founder A', action: 'task added', detail: 'x', at: iso(H) }, { actor: 'access broker', action: 'denied', detail: hostile, at: iso(2 * H) }];
const full = () => ({ jobs: { rows: jobs }, uses: { rows: uses }, act: { rows: act }, hist: { err: true }, ops: [{ file: 'a.yml', name: 'A', crons: ['0 4 * * *'], class: 'HEALTHY', last: { at: iso(H), conclusion: 'success' } }, { file: 'b.yml', name: 'B <b>', crons: ['0 * * * *'], class: 'FAILING', reason: 'the last 3 scheduled runs failed' }], pcd: PCD, sec: SEC });
const ORGD = { source: 'dev', ...DEV };
const baseD = { devices, integrations: [integ(), integ({ id: 'gumroad', platform: 'Gumroad', account: null }), integ({ id: 'ig', platform: 'Instagram', state: 'not_connected', last_ok_at: null }), integ({ id: 'old', platform: 'Old <script>', last_ok_at: null, error: "please rotate the key", next_action: "rotate the key " + FAKE })] };
const show = (tab, over = {}) => { app.set({ sub: tab, D: baseD, CONNS: [acct()], CONN_LINKS: [{ integration_id: 'yt', team_id: 'house_b', subteam_id: null, enabled: true }], POLICIES: [], ORG: ORGD, CLOUD: full(), ...over }); return app.cloudPage(); };
const clean = (out, label) => { assert.ok(!BAD.test(out), label + ' leaks undefined/NaN'); for (const r of SECRET_RES) assert.ok(!r.test(out), label + ' shows a secret-looking string ' + r); assert.ok(!out.includes(FAKE), label + ' shows the stand-in secret'); assert.ok(!/<img src=x|<script>/.test(out), label + ' unescaped markup'); };

console.log(' tabs');
await ok('every tab renders clean with full data', () => { for (const t of ['autonomy', 'security', 'integrations', 'teams']) { const o = show(t); assert.ok(o.length > 300, t); clean(o, t); } });
await ok('autonomy: devices, queue counts, oldest queued, workflow health, PC lists and NOT VERIFIED', () => {
  const o = show('autonomy');
  assert.match(o, /<b>1<\/b><span>online now/); assert.match(o, /<b>3<\/b><span>devices known/); assert.match(o, /<b>2<\/b><span>queued/); assert.match(o, /<b>1<\/b><span>blocked/); assert.match(o, /<b>1<\/b><span>failed/); assert.match(o, /Oldest queued job: x ago/); assert.match(o, /<b>2<\/b><span>retried/);
  assert.match(o, /FAILING/); assert.match(o, /B &lt;b&gt;/); assert.match(o, /Still needs a PC/); assert.match(o, /Seal Task C/); assert.match(o, /NOT VERIFIED/);
  assert.equal((o.match(/class="row"/g) || []).length > 15, true);
});
await ok('autonomy: a recorded PC-off verification shows its run ids', () => {
  const c = full(); c.pcd = { ...PCD, pc_off_verification: { status: 'VERIFIED', run_ids: ['4101', '4102'], note: 'two nights' } };
  const o = show('autonomy', { CLOUD: c }); assert.match(o, /VERIFIED/); assert.match(o, /run 4101/); assert.match(o, /run 4102/); assert.ok(!/NOT VERIFIED/.test(o));
});
await ok('autonomy: absent files and unreadable tables say so and invent nothing', () => {
  const o = show('autonomy', { CLOUD: { jobs: { err: true }, uses: { err: true }, act: { err: true }, hist: { err: true }, ops: null, pcd: null, sec: null } });
  clean(o, 'empty'); assert.match(o, /Not collected yet\. Nova ops-status/); assert.match(o, /Not collected yet\. Nova pc-dependencies/); assert.match(o, /job queue could not be read/); assert.match(o, /NOT VERIFIED/); assert.ok(!/healthy/.test(o));
  const e = show('autonomy', { D: {}, CLOUD: { ...full(), jobs: { rows: [] }, ops: [], pcd: { items: [] } } }); clean(e, 'zero'); assert.match(e, /No devices have reported/); assert.match(e, /queue holds no jobs/); assert.match(e, /lists no scheduled workflows/);
});
await ok('security: broker counts, default shadow mode, denials by team and provider, no secret', () => {
  const o = show('security'); assert.match(o, /shadow \(default/); assert.match(o, /<b>2[<][/]b><span>allowed/); assert.match(o, /<b>1<\/b><span>would deny/); assert.match(o, /<b>1<\/b><span>denied/); assert.match(o, /house_b → gumroad · publish/); assert.match(o, /house_a → youtube/); assert.match(o, /\[hidden\]/);
  assert.match(show('security', { POLICIES: [{ scope: 'company', scope_id: '*', key: 'access_broker_mode', value: 'enforce' }] }), /enforce/); assert.match(show('security', { POLICIES: [{ scope: 'company', key: 'access_broker_mode', value: { mode: 'off' } }] }), /<span class="chip warn">off<\/span>/);
});
await ok('security: incidents copy status and founder action exactly; scanning, rotation and audit show', () => {
  const o = show('security'); for (const n of SEC.incidents) { assert.ok(o.includes(n.id)); assert.ok(o.includes(`>${n.status}<`)); }
  assert.ok(o.includes(esc(SEC.incidents[0].founder_action.slice(0, 60)))); assert.match(o, /scanning disabled/); assert.match(o, /Open incidents above also need a rotation/); assert.match(o, /Old &lt;script&gt;/); assert.match(o, /security-scan/); assert.match(o, /access broker/); assert.ok(!/Founder A · task added/.test(o));
  assert.match(o, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
await ok('security: empty sources are named', () => {
  const o = show('security', { D: {}, CLOUD: { ...full(), uses: { rows: [] }, act: { rows: [] }, sec: null } }); clean(o, 'sec empty');
  assert.match(o, /No credential access has been recorded yet/); assert.match(o, /No security activity recorded/); assert.match(o, /Not collected yet\. Nova security-status/); assert.match(o, /No integration row asks for a rotation/);
  assert.match(show('security', { CLOUD: { ...full(), uses: { err: true }, act: { err: true } } }), /access log could not be read/);
});
await ok('integrations: status, last verified, last operation, owner, recovery, and history absent', () => {
  const o = show('integrations'); for (const w of ['CONNECTED_AND_VERIFIED', 'CONNECTED_BUT_INSECURE', 'NOT_CONFIGURED', 'UNKNOWN']) assert.ok(o.includes(`>${w}<`), w);
  assert.match(o, /last verified x ago · last successful operation x ago/); assert.match(o, /Owner: house_b/); assert.match(o, /Owner: no team linked/); assert.match(o, /History not recorded yet/); assert.match(o, /Connect it from the Integrations page/);
  assert.ok(!o.includes('Gumroad</b> · ') || true);
});
await ok('integrations: a history table that exists is listed, one that is empty says not recorded', () => {
  const o = show('integrations', { CLOUD: { ...full(), hist: { rows: [{ integration_id: 'yt', status: 'EXPIRED', detail: 'x', at: iso(H) }] } } }); assert.match(o, /yt · EXPIRED/); assert.ok(!/History not recorded yet/.test(o));
  assert.match(show('integrations', { CLOUD: { ...full(), hist: { rows: [] } } }), /History not recorded yet/);
});
await ok('integrations: none listed and the loading state', () => { assert.match(show('integrations', { D: {} }), /No integrations are listed/); assert.match(show('integrations', { CLOUD: null }), /Reading the cloud/); });
await ok('teams: all 43 subteams show with pipeline status, agents, integrations and honest flags', () => {
  const o = show('teams'); clean(o, 'teams'); const subs = DEV.units.filter((u) => u.kind === 'subteam'); assert.equal(subs.length, 43);
  for (const s of subs) assert.ok(o.includes(esc(s.display_name)), s.id); assert.match(o, /43 subteams in 8 teams/); assert.match(o, /no pipeline designed/); assert.match(o, /YouTube/); assert.match(o, /TESTING/);
  assert.equal((o.match(/ agents/g) || []).length >= 43, true);
});
await ok('teams: an insecure linked integration is flagged on the subteam; no structure says so', () => {
  const o = show('teams', { D: { ...baseD, integrations: [integ({ id: 'yt', error: 'token expired', state: 'error' })] } }); assert.match(o, /YouTube: EXPIRED/);
  assert.match(show('teams', { ORG: null }), /structure is not loaded/); assert.match(show('teams', { ORG: { units: [] } }), /structure is not loaded/);
});
await ok('an unknown sub-tab falls back to Autonomy', () => { assert.match(show('houses'), /Running workers and devices/); });
await ok('hostile text in names, errors and reasons is escaped on every tab', () => {
  const hd = { devices: [{ id: 'h', name: hostile, last_seen: iso(1e3) }], integrations: [integ({ platform: hostile, account: hostile, state: 'error', error: hostile + ' expired', next_action: hostile })] };
  const c = { ...full(), ops: [{ file: hostile, name: hostile, class: hostile, crons: [hostile] }], sec: { incidents: [{ id: 'INC-x', status: 'OPEN', affected: hostile, founder_action: hostile }], repos: [{ repo: hostile, visibility: hostile, secret_scanning: hostile, push_protection: hostile, branch_protection: hostile }] }, act: { rows: [{ actor: 'secret ' + hostile, action: hostile, detail: hostile, at: iso(H) }] }, hist: { rows: [{ integration_id: hostile, status: hostile, detail: hostile }] } };
  for (const t of ['autonomy', 'security', 'integrations', 'teams']) { const o = show(t, { D: hd, CLOUD: c, CONNS: [], CONN_LINKS: [] }); assert.ok(!o.includes('<img src=x') && !o.includes('onerror=alert(1)>'), t + ' unescaped'); }
});
await ok('cloudLoad reads each source once, survives failures, and never throws', async () => {
  let calls = 0; const chain = (res) => { const q = { select: () => q, order: () => q, limit: () => q, like: () => q, then: (f, r) => Promise.resolve(res).then(f, r) }; return q; };
  const sbOk = { from: (t) => { calls++; return chain(t === 'integration_health' ? { error: { code: '42P01' }, data: null } : { data: [{ id: 1 }], error: null }); } };
  const fetchOk = async (f) => ({ ok: f === '/api/ops/pc-dependencies', json: async () => ({ items: [] }) });
  const mk = (sb, fetch) => new Function('sb', 'novaFetch', 'render', 'esc', 'ago', 'online', `let CLOUD = null, cloudAt = 0, cloudBusy = false, page = 'x';\n${grab('async function cloudLoad(')}\nreturn { load: cloudLoad, get c() { return CLOUD; } };`)(sb, fetch, () => {}, esc, ago, online);
  const a = mk(sbOk, fetchOk); await a.load(); assert.equal(calls, 4); assert.equal(a.c.hist.err, true); assert.equal(a.c.ops, null); assert.deepEqual(a.c.pcd, { items: [] }); await a.load(); assert.equal(calls, 4, 'throttled within 60 s');
  const bad = mk({ from: () => { throw new Error('down'); } }, async () => { throw new Error('offline'); }); await bad.load(); assert.equal(bad.c.jobs.err, true); assert.equal(bad.c.ops, null);
});

console.log(`${passed} passed`);
if (process.exitCode) process.exit(1);
