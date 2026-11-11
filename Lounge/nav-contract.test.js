// Run: node nav-contract.test.js
// The one navigation of Coco: eight sections, two global actions, seven Houses with twenty tabs each, and every original page still reachable.
// Android reads contract/nav-contract.json; the web page loads the generated contract/nav-contract.js; both must be the same thing.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const nav = JSON.parse(fs.readFileSync(path.join(dir, 'contract', 'nav-contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; process.exitCode = 1; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 5).join('\n     ')); } };
const allPages = nav.sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.id })));

t('eight main sections in the agreed order, with Ask COCO and Remote Control as the two global actions', () => {
  assert.deepEqual(nav.sections.map((s) => s.label), ['Home', 'Houses', 'Work', 'Automation', 'Brains & Agents', 'Insights', 'Connections', 'System']);
  assert.deepEqual(nav.sections.map((s) => s.id), ['home', 'houses', 'work', 'automation', 'brains', 'insights', 'connections', 'system']);
  assert.deepEqual(nav.global.map((g) => g.label), ['Ask COCO', 'Remote Control']); assert.deepEqual(nav.phone_bottom, ['home', 'houses', 'work', 'more']);
});
t('seven business Houses, each with its own identity, and twenty tabs in the same order for every House', () => {
  assert.deepEqual(nav.houses.map((h) => h.label), ['Gigi Social', 'Lulu Software', 'Poppy Ebooks', 'Mochi Comics', 'Fifi Courses', 'Zaza Games', 'Tilly Commerce']);
  assert.equal(new Set(nav.houses.map((h) => h.color)).size, 7); assert.equal(new Set(nav.houses.map((h) => h.icon)).size, 7);
  assert.equal(nav.house_tabs.length, 20); assert.deepEqual(nav.house_tabs.map((x) => x[1]), ['Overview', 'Organization', 'Teams & Subteams', 'Categories', 'Channels & Products', 'Brains', 'Agents', 'Automation', 'Templates', 'Prompt Instructions', 'Connections', 'Reference Assets', 'Production', 'Outputs', 'Scheduler', 'Approvals', 'Analytics', 'Revenue', 'Activity History', 'Settings']);
  for (const h of nav.houses) assert.ok(h.metrics.length && h.platforms.length, h.id + ' needs its own measures and platforms');
});
t('all 20 original pages map to the new navigation exactly as agreed', () => {
  const want = { home: 'home', control: 'system', board: 'work', notes: 'work', approvals: 'work', company: 'houses', teams: 'houses', agents: 'brains', runs: 'work', ai: 'insights', brain: 'brains', workflows: 'automation', system: 'system', connections: 'connections', club: 'houses', rules: 'system', devices: 'system', settings: 'system' };
  for (const [page, sec] of Object.entries(want)) { const p = allPages.find((x) => x.id === page); assert.ok(p, page + ' has no place'); assert.equal(p.section, sec, `${page} should live in ${sec}`); }
  assert.equal(allPages.find((p) => p.id === 'remote').section, 'system', 'Remote Control is also in System'); assert.ok(nav.global.some((g) => g.id === 'remote'), 'and is a global action');
  assert.ok(nav.global.some((g) => g.id === 'chat'), 'Ask COCO is global');
  assert.equal(Object.keys(nav.legacy_pages).filter((k) => ['home', 'control', 'board', 'notes', 'remote', 'approvals', 'company', 'teams', 'agents', 'runs', 'ai', 'brain', 'workflows', 'system', 'chat', 'connections', 'club', 'rules', 'devices', 'settings'].includes(k)).length, 20);
  assert.equal(allPages.find((p) => p.id === 'themes').section, 'system', 'Appearance joins System');
});
t('every page the contract names exists in the app: a route, a title and a render function', () => {
  const ids = [...new Set([...allPages.map((p) => p.id), ...nav.global.map((g) => g.id), 'house'])];
  const pagesLine = html.match(/const PAGES = \[[^\n]*\];/)[0];
  for (const id of ids) { assert.ok(new RegExp(`\\['${id}',`).test(pagesLine), id + ' is missing from PAGES'); assert.ok(new RegExp(`\\n  ${id}\\(\\) \\{|\\b${id}: [A-Za-z]+View\\b|V\\.${id} = `).test(html), id + ' has no render function'); }
});
t('the page builds its navigation from the contract, not from a copy', () => {
  assert.ok(html.includes('contract/nav-contract.js') && html.includes('window.COCO_NAV') && html.includes('phone_bottom') && html.includes('NAV.sections') && html.includes('NAV.houses') && html.includes('NAV.house_tabs'));
});
t('contract hygiene: unique page ids, an icon and a label for every entry', () => {
  const seen = {}; for (const s of nav.sections) { assert.ok(s.label && s.icon && s.pages.length, s.id); for (const p of s.pages) { assert.ok(p.id && p.label && p.icon, JSON.stringify(p)); if (p.id !== 'remote') assert.ok(!seen[p.id], 'duplicate page ' + p.id); seen[p.id] = 1; } }
});
console.log(`\nnav contract: ${pass} passed, ${fail} failed`);
