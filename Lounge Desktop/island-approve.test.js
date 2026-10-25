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
assert.ok(lounge.includes('setInterval(pollApprovals, 15000)'), '15 s approvals poll armed');
console.log('approve tests: 11 passed');
