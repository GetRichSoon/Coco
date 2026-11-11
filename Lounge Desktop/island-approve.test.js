// Run: node island-approve.test.js   Test: at the office the island gets ONLY approvals (coco='approvals', quiet),
// at home the full modules — drives the real islandModules() copied out of main.js (Boss order 2026-10-26).
const fs = require('fs'); const assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, 'main.js'), 'utf8');
const line = src.split('\n').find((l) => l.startsWith('const islandModules'));
assert.ok(line, 'islandModules found in main.js');
let office = false;
const make = new Function('atOffice', 'islandSettings', line + '; return islandModules;');
const islandModules = make(() => office, () => ({ modules: { coco: true, music: true, control: true, focus: true } }));

let m = islandModules();
assert.equal(m.coco, true, 'home: full Coco module'); assert.ok(!m.quiet, 'home: toasts allowed');
office = true; m = islandModules();
assert.equal(m.coco, 'approvals', 'office: approvals only'); assert.equal(m.quiet, true, 'office: no toasts');

// The island page must treat coco='approvals' as approvals-visible but status-hidden.
const page = fs.readFileSync(require('path').join(__dirname, 'island.html'), 'utf8');
assert.ok(page.includes("modules.coco === 'approvals'"), 'island renders the office approvals-only panel');
assert.ok(page.includes('modules.coco === true && working'), 'island hides the working line at the office');
assert.ok(page.includes("I.act('approve'"), 'island sends YES/NO through the bridge');
assert.ok(src.includes("action === 'approve'"), 'main forwards approve to the Lounge page');
const lounge = fs.readFileSync(require('path').join(__dirname, '..', 'Lounge', 'index.html'), 'utf8');
assert.ok(lounge.includes('function decideApproval'), 'Lounge page has the one decide path');
assert.ok(lounge.includes('id="islandStrip"') && lounge.includes('function renderStrip'), 'in-app island strip exists');
assert.ok(lounge.includes('pollApprovals(); }, 15000)'), '15 s approvals poll armed');   // the poll is conditional now (skips while realtime is live)
// Live feed + chip safety (Boss 2026-10-26, after one accidental click rejected A-001)
assert.ok(page.includes('#pill:not(.open) .abtn { pointer-events: none; }'), 'chips are inert on the compact pill');
assert.ok(page.includes('(d.ayes || d.ano || d.aig) && (!open || Date.now() - openedAt < 400)) return'), 'chip clicks need the opened panel (and 400 ms settle)');
assert.ok(page.includes('live feed ticker') && page.includes('Live team feed'), 'island streams the team feed (pill ticker + panel)');
// The feed is polled (15 s, below) and refreshed by feedSoon on task changes: no realtime subscription on activity/agent_messages (Supabase egress, 2026-11-02).
assert.ok(lounge.includes("table: 'tasks' }, feedSoon"), 'task changes refresh the feed at once');
assert.ok(lounge.includes("from('agent_messages').select('*').order('at', { ascending: false }).limit(40)") && lounge.includes('pollApprovals(); }, 15000)'), '15 s feed poll fallback');
// behaviour: run the real click handler with a fake pill
{ const m = page.match(/pill\.addEventListener\('click', \(e\) => \{[\s\S]*?\n\}\);/)[0]; const sent = [];
  const mk = (isOpen, age) => { const h = { }; const pill = { addEventListener: (n, f) => { if (n === 'click') h.f = f; } };
    new Function('pill', 'I', 'open', 'openedAt', 'Date', 'hiddenApprovals', 'renderCompact', 'renderFull', 'setTimeout', m)(pill, { act: (a, x) => sent.push(a + x.id) }, isOpen, 1000 - age, { now: () => 1000 }, new Set(), () => {}, () => {}, () => {}); return h.f; };
  const chip = { closest: () => ({ dataset: { ayes: '7' } }) };
  mk(false, 9999)({ target: chip }); assert.equal(sent.length, 0, 'closed pill: YES does nothing');
  mk(true, 100)({ target: chip }); assert.equal(sent.length, 0, 'panel just opened: YES does nothing');
  mk(true, 900)({ target: chip }); assert.equal(sent.length, 1, 'settled open panel: YES works'); }
assert.ok(lounge.includes("table: 'tasks' }, feedSoon") && lounge.includes("from('tasks').select('*')") && lounge.includes('doneAct'), 'counters: tasks/houses realtime + poll, done today from tasks + activity');
assert.ok(!lounge.includes('/4</b>'), 'no hardcoded device total');
console.log('approve tests: 21 passed');

// Island ON/OFF (Boss, 2026-10-26): toggle state persists in island.json and islandVisible() obeys it.
const os = require('os'), pth = require('path'); const tmp = fs.mkdtempSync(pth.join(os.tmpdir(), 'isl-'));
const file = pth.join(tmp, 'island.json');
const sl = src.split('\n'); const grab = (p) => sl.find((l) => l.startsWith(p));
const ctx = new Function('fs', 'ISLAND_FILE', grab('const islandSettings') + ';' + grab('const saveIsland') + '; return { islandSettings, saveIsland };')(fs, () => file);
assert.equal(ctx.islandSettings().enabled, true, 'default: island on');
let s = ctx.islandSettings(); s.enabled = false; ctx.saveIsland(s);
assert.equal(ctx.islandSettings().enabled, false, 'OFF survives a restart (re-read from disk)');
assert.equal(ctx.islandSettings().modules.coco, true, 'other island settings kept');
s = ctx.islandSettings(); s.enabled = true; ctx.saveIsland(s); assert.equal(ctx.islandSettings().enabled, true, 'ON restores');
assert.ok(src.includes('function setIslandEnabled') && src.includes("action === 'hide'"), 'main has one toggle + island hide action');
assert.ok(src.includes('click: (i) => setIslandEnabled(i.checked)'), 'tray/dock menus use the toggle');
assert.ok(page.includes('id="hideIsland"') && page.includes("I.act('hide')"), 'island has a Hide island chip');
assert.ok(lounge.includes('id="showIsland"') && lounge.includes('setIsland'), 'Lounge settings has the island switch');
assert.ok(src.includes('islandSettings().enabled && !islandFull'), 'hidden island still runs, approvals keep reaching the app window');
console.log('island toggle tests passed');
assert.ok(src.includes("action === 'module'") && page.includes('data-mod') && page.includes('id="gearIsland"'), 'island has a gear with one switch per module');
assert.ok(page.includes('warnCoco'), 'hiding Coco (approvals) warns first');
office = true; { const m2 = new Function('atOffice', 'islandSettings', line + '; return islandModules;')(() => true, () => ({ modules: { coco: false, music: true } }))(); assert.equal(m2.coco, false, 'office: Coco section off stays off'); }
console.log('module toggle tests passed');
