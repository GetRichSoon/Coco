// Run: node structure.render.test.js
// Test: the Structure page. The real loadOrg() and orgPage() are lifted out of index.html (like control-center.render.test.js)
// and every unit in the company is opened through them with the generated development data: nothing throws, nothing leaks
// "undefined" or "NaN", every link leads somewhere, and the approved names, counts and honest placeholders are on screen.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { structure } from './test-fixtures.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const DEV = structure();   // synthetic: the public repository holds no company data
let passed = 0;
const ok = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { process.exitCode = 1; console.log('  FAIL ' + name + '\n       ' + e.message); } };

const grab = (decl) => {
  const start = html.indexOf(decl); assert.ok(start > 0, decl + ' not found in index.html');
  let depth = 0;
  for (let j = html.indexOf('{', html.indexOf(')', start)); j < html.length; j++) {
    if (html[j] === '{') depth++; else if (html[j] === '}' && !--depth) return html.slice(start, j + 1);
  }
  throw new Error(decl + ' not closed');
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chip = (s) => `<span class="chip">${esc(s)}</span>`;
const mark = (kind, name, id) => `<i data-mark="${kind}:${id}"></i>`;
const make = (sb, fetchFn) => new Function('esc', 'chip', 'mark', 'sb', 'novaFetch',
  `let ORG = null, sub = 'org:coco', D = {}, plTab = 'overview';\n${grab('async function loadOrg(')}\n${grab('function orgPage(')}\nreturn { loadOrg, orgPage, set(o, s, d) { ORG = o; sub = s; D = d; }, tab(t) { plTab = t; } };`)(esc, chip, mark, sb, fetchFn);

// what the cloud would hold (synthetic houses and tasks)
const D = {
  houses: [['house_a', 'House A', 'working'], ['house_b', 'House B', 'working'], ['house_c', 'House C', 'working'], ['house_d', 'House D', 'next'], ['house_e', 'House E', 'later'], ['house_f', 'House F', 'later'], ['house_g', 'House G', 'later']]
    .map(([id, name, state]) => ({ id, name, state, doing: `${name} doing text`, next: `${name} next text` })),
  tasks: [{ id: 1, house_id: 'house_a', title: 'House A queued task', status: 'queued' }, { id: 2, house_id: 'house_b', title: 'House B paused task', status: 'paused' }, { id: 3, house_id: null, title: 'untagged', status: 'queued' }],
  approvals: [{ state: 'waiting' }, { state: 'approved' }], offerings: [{ house_id: 'house_a' }, { house_id: 'house_a' }, { house_id: 'house_b' }],
};
const ORG = { source: 'dev', metrics: [], refs: [], ...DEV };
const app = make(null, null);
const view = (id) => { app.set(ORG, 'org:' + id, D); return app.orgPage(); };

console.log('structure page');
await ok('the page script in index.html parses as a whole', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length); for (const s of scripts) new vm.Script(s);
});
await ok('Structure is in the navigation and routed', () => {
  assert.match(html, /\['structure', 'Structure', 'schema'\]/); assert.match(html, /structure\(\) \{[\s\S]{0,2500}?return bar \+ orgPage\(\);/);   // the page is a tab bar since the unified organisation: Tree (orgPage) plus Readiness, Decisions and Brains assert.match(html, /structure: 'org:coco'/);
});
await ok('all 127 units open without throwing, leaking undefined/NaN, or an empty page', () => {
  for (const u of DEV.units) { const out = view(u.id); assert.ok(out.length > 200, u.id + ' empty'); assert.ok(!/undefined|NaN|\[object|null</.test(out), u.id + ' leaks'); assert.ok(out.includes(esc(u.display_name)), u.id + ' lacks its name'); }
});
await ok('every link on every page leads to a unit that exists', () => {
  const ids = new Set(DEV.units.map((u) => u.id)); let links = 0;
  for (const u of DEV.units) for (const m of view(u.id).matchAll(/data-sub="org:([^"]+)"/g)) { links++; assert.ok(ids.has(m[1].replace(/&#39;/g, "'")), `${u.id} links to ${m[1]}`); }
  assert.ok(links > 500);
});
await ok('COCO at the top shows Core House and the seven Team Houses, and says it is development data', () => {
  const out = view('coco');
  for (const n of ['Company Root', 'Core House — Operations', 'House A — Domain A', 'House B — Tools &amp; Ops', 'House C — Domain C', 'House D — Domain D', 'House E — Domain E', 'House F — Domain F', 'House G — Domain G'])
    assert.ok(out.includes(n), 'missing ' + n);
  assert.match(out, /Development data/); assert.match(out, /1 approvals wait for a YES/); assert.match(out, /founder-a \(owner\)/);
});
await ok('a House opens to its subteams, live status and its own queue', () => {
  const out = view('house_a');
  assert.equal((out.match(/class="card2 orgcard"/g) || []).length, 6);
  for (const n of ['A01', 'A02', 'A03', 'A04', 'A05', 'A06']) assert.ok(out.includes(`Subteam ${n} — Focus ${n}`), n);
  assert.match(out, /House A doing text/); assert.match(out, /House A queued task/); assert.match(out, /2 existing offerings/); assert.match(out, /Approvals are not tagged by House/);
});
await ok('a subteam opens to its categories, head and agents', () => {
  const out = view('house_a.s01');
  for (const n of ['Category A01-1', 'Category A01-2', 'Category A01-3']) assert.ok(out.includes(n));
  assert.match(out, /agent-house-a-s01/); assert.match(out, /Proposed/);
});
await ok('duplicate names stay apart: the first subteam of House G and of House A are separate units', () => {
  const t = view('house_g.s01'), l = view('house_a.s01');
  assert.match(t, /Subteam G01 — Focus G01/); assert.match(t, /Category G01-1/); assert.ok(!t.includes('Subteam A01')); assert.ok(!l.includes('Category G01-1'));
});
await ok('the channel subteam lists its 16 channels and says their category is still to be chosen', () => {
  const out = view('house_b.s01');
  assert.equal((out.match(/category to be chosen/g) || []).length, 16); assert.match(out, /Products and channels \(16\)/); assert.match(out, /Channel 16/); assert.match(out, /Placeholder/);
});
await ok('Core House shows eight subteams, unassigned heads as placeholders and the six repositories as proposed mappings', () => {
  const out = view('core');
  assert.equal((out.match(/class="card2 orgcard"/g) || []).length, 8); assert.match(out, /Head not assigned/);
  for (const r of ['Org/platform', 'Org/engine', 'Org/workspace-one', 'Org/workspace-two', 'Org/org-page', 'Org/legacy']) assert.ok(out.includes(r), r);
  assert.match(out, /Proposed mapping/);
});
await ok('performance and Reference Intelligence say "nothing yet" and never show an estimate', () => {
  const out = view('house_a'); assert.match(out, /Nothing is estimated/); assert.match(out, /No Brain items are linked/);
});
await ok('real metrics and references show when they exist', () => {
  app.set({ ...ORG, metrics: [{ unit_id: 'house_a.s01', metric: 'revenue', period: '2026-11-01', value: 5, unit: 'INR', source: 'test' }], refs: [{ unit_id: 'house_a', brain_item_id: 'ref-1', note: 'n' }] }, 'org:house_a', D);
  const out = app.orgPage(); assert.match(out, /revenue/); assert.match(out, /5 INR/); assert.match(out, /ref-1/); assert.ok(!/Nothing is estimated/.test(out));
});
await ok('cloud data hides the development banner; a hostile name is escaped', () => {
  const units = DEV.units.map((u) => u.id === 'house_a' ? { ...u, display_name: '<img src=x onerror=alert(1)>' } : u);
  app.set({ ...ORG, source: 'cloud', units }, 'org:house_a', D); const out = app.orgPage();
  assert.ok(!/Development data/.test(out)); assert.ok(!out.includes('<img src=x')); assert.ok(out.includes('&lt;img src=x'));
});
await ok('an unknown unit falls back to COCO instead of a blank page', () => assert.match(view('does.not.exist'), /Company Root/));
await ok('no data at all says so', () => { app.set({ source: 'none', units: [], products: [], agents: [], repos: [], workflows: [], access: [], metrics: [], refs: [] }, 'org:coco', D); assert.match(app.orgPage(), /No company structure yet/); });
await ok('loading: cloud tables win, then the development file, then an honest empty', async () => {
  const rows = (t) => ({ data: t === 'org_units' ? [{ id: 'coco' }] : [], error: null });
  const sb = (fail) => ({ from: (t) => ({ select: async () => fail ? { data: null, error: { message: 'relation does not exist' } } : rows(t) }) });
  assert.equal((await make(sb(false), null).loadOrg()).source, 'cloud');
  const dev = await make(sb(true), async () => ({ ok: true, json: async () => DEV })).loadOrg(); assert.equal(dev.source, 'dev'); assert.equal(dev.units.length, 127);
  assert.equal((await make(sb(true), async () => ({ ok: false })).loadOrg()).source, 'none');
  assert.equal((await make({ from: () => { throw new Error('offline'); } }, async () => { throw new Error('offline'); }).loadOrg()).source, 'none');
});
await ok('cards read cleanly: no dangling separator, no "head" line on categories', () => {
  for (const id of ['coco', 'core', 'lulu', 'lulu.pearl', 'house_b.s01']) assert.ok(!/·\s*<\/span>/.test(view(id)) && !/· +·/.test(view(id)), id + ' has a dangling dot');
  assert.ok(!/No head recorded/.test(view('house_a.s01')), 'category cards must not say "No head recorded"');
  assert.match(view('coco'), /8 subteams<\/span>/);
});

console.log('pipeline workspaces');
const TABS = ['Pipeline Overview', 'Pipeline Builder', 'Stages &amp; Workflow', 'Agents &amp; Responsibilities', 'Tools &amp; AI Models', 'Inputs &amp; Outputs', 'Approval Gates', 'Scheduling', 'Execution History', 'Analytics &amp; Costs', 'Version History'];
const KEYS = ['overview', 'builder', 'stages', 'agents', 'tools', 'io', 'gates', 'schedule', 'history', 'analytics', 'versions'];
const viewTab = (id, tab, org = ORG) => { app.set(org, 'org:' + id, D); app.tab(tab); const o = app.orgPage(); app.tab('overview'); return o; };
const SUBS = DEV.units.filter((u) => u.kind === 'subteam');

await ok('exactly 43 subteams (Core included) each show one Pipeline workspace with the 11 tabs; houses and categories show none', () => {
  assert.equal(SUBS.length, 43);
  for (const u of SUBS) { const out = view(u.id); assert.equal((out.match(/Pipeline workspace/g) || []).length, 1, u.id); for (const t of TABS) assert.ok(out.includes('>' + t + '</button>'), u.id + ' lacks tab ' + t); assert.equal((out.match(/data-pltab=/g) || []).length, 11); }
  for (const u of DEV.units.filter((x) => x.kind !== 'subteam')) assert.ok(!view(u.id).includes('Pipeline workspace'), u.id + ' must not have one');
});
await ok('all 11 tabs render for all 43 subteams without throwing or leaking undefined/NaN', () => {
  for (const u of SUBS) for (const k of KEYS) { const out = viewTab(u.id, k); assert.ok(out.length > 500, u.id + ' ' + k); assert.ok(!/undefined|NaN|\[object|null</.test(out), u.id + ' ' + k + ' leaks'); }
});
await ok('a subteam with no design shows an empty PLANNED workspace: no stages, nothing invented, nothing scheduled', () => {
  const empties = SUBS.filter((u) => !['house_b.s01', 'house_c.s01'].includes(u.id)); assert.equal(empties.length, 41);
  for (const u of empties) { const o = viewTab(u.id, 'overview'); assert.match(o, />PLANNED</); assert.match(o, /Not designed/); assert.match(o, /Nothing is assumed or invented/); assert.ok(!/BLOCKED<|LIVE<|TESTING</.test(o.split('Pipeline workspace')[1].split('class="grid"')[0])); assert.match(viewTab(u.id, 'stages'), /Nothing designed yet/); assert.match(viewTab(u.id, 'schedule'), /No schedule is activated/); }
});
await ok('Designed pipeline A: 13 stages in the unified order, TESTING overall, nothing LIVE', () => {
  const o = viewTab('house_b.s01', 'overview'), s = viewTab('house_b.s01', 'stages');
  assert.match(o, />TESTING</); assert.ok(!/>LIVE</.test(o)); assert.match(o, /This one is TESTING/);
  const names = ['Discover', 'Select', 'Brief', 'Draft', 'Verify', 'Plan', 'Build assets', 'Render', 'Quality check', 'Founder approval', 'Publish', 'Measure', 'Feedback'];
  let at = -1; names.forEach((n, i) => { const k = s.indexOf(`${i + 1}. ${n}`); assert.ok(k > at, n); at = k; });
  assert.ok(!/>LIVE</.test(s)); assert.match(s, />BLOCKED</);
});
await ok('pipeline A shows the free-tier-only policy, all 16 channels and the unconfirmed category mapping', () => {
  assert.match(viewTab('house_b.s01', 'tools'), /free tier only/); assert.match(viewTab('house_b.s01', 'overview'), /unconfirmed/);
  assert.match(viewTab('house_b.s01', 'overview'), /channel-01, channel-02/); assert.match(view('house_b.s01'), /Channel 02/);
});
await ok('pipeline A scheduling is honest: registered but not proven, the old file obsolete, nothing activated', () => {
  const s = viewTab('house_b.s01', 'schedule'); assert.match(s, /No schedule is activated/); assert.match(s, /Registered, not proven/); assert.match(s, /Obsolete on main/); assert.match(s, /Manual only/);
});
await ok('execution history links runs to GitHub and labels itself evidence, not a live log', () => {
  const h = viewTab('house_b.s01', 'history'); assert.match(h, /github\.com\/GetRichSoon\/CocoMaison\/actions\/runs\/1000000001/); assert.match(h, /not a live log/);
});
await ok('Designed pipeline B: monitoring tested, publishing paused after one approved publish, cover and stats blocked', () => {
  const s = viewTab('house_c.s01', 'stages'), o = viewTab('house_c.s01', 'overview');
  assert.match(o, />TESTING</); assert.match(s, /Public publishing after approval/); assert.match(s, />PAUSED</); assert.match(s, /media direct upload returned 403/); assert.match(s, /stats_read/);
  assert.match(viewTab('house_c.s01', 'tools'), /draft only until a named founder approves/); assert.match(o, /old chain/i);
  assert.ok(!/>LIVE</.test(s));
});
await ok('the Builder tab says a design is a file, not an operation, and lists the validator rules', () => {
  const b = viewTab('house_b.s01', 'builder'); assert.match(b, /does not run it/); assert.match(b, /pipelines\/house_b\.s01\.json/); assert.match(b, /LIVE needs a successful production run/);
});
await ok('cloud-sourced structure without pipeline rows still shows empty PLANNED workspaces, and hostile text is escaped', () => {
  const cloud = { ...ORG, source: 'cloud' }; delete cloud.pipelines;
  assert.match(viewTab('house_b.s01', 'overview', cloud), /Nothing is assumed or invented/);
  const evil = { ...ORG, pipelines: [{ ...DEV.pipelines.find((p) => p.unit_id === 'house_c.s01'), summary: '<img src=x onerror=alert(1)>' }] };
  const out = viewTab('house_c.s01', 'overview', evil); assert.ok(!out.includes('<img src=x')); assert.match(out, /&lt;img src=x/);
});
await ok('switching to another unit returns the workspace to its overview tab, and the tab bar wraps on a phone', () => {
  assert.match(html, /if \(ds\.pltab\) \{ plTab = ds\.pltab; render\(\); \}/); assert.match(html, /if \(ds\.sub\) \{ sub = ds\.sub; plTab = 'overview'; render\(\); \}/);
  assert.match(html, /\.tabs \{ display: flex; gap: 8px; flex-wrap: wrap;/);
});

console.log(`\n${process.exitCode ? 'FAILED' : 'PASSED'} (${passed} checks passed)`);
