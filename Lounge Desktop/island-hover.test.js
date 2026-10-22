// Run: node island-hover.test.js   Test: drives Coco Island's real islandPointer() (copied out of main.js) with a fake cursor and clock.
const fs = require('fs'); const assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, 'main.js'), 'utf8');
const block = src.slice(src.indexOf('const BAND_PX'), src.indexOf('setInterval(islandPointer, 40);'));
let cursor = { x: 0, y: 500 }, now = 0, visible = true, sent = [], ignore = [];
const island = { isVisible: () => visible, getBounds: () => ({ x: 730, y: 0, width: 460, height: 310 }), setIgnoreMouseEvents: (v) => ignore.push(v), webContents: { send: (c, v) => sent.push(v) } };
const screen = { getCursorScreenPoint: () => cursor, getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1200 } }) };
const ipcMain = { on: (n, f) => (ipcMain[n] = f) };
const Date_ = { now: () => now };
const run = new Function('island', 'require', 'ipcMain', 'Date', block + '; return { tick: islandPointer };')(island, () => ({ screen }), ipcMain, Date_);
const walk = (x, y, ms) => { cursor = { x, y }; for (let t = 0; t < ms; t += 40) { now += 40; run.tick(); } };
const opened = () => sent.filter((v) => v === true).length, closed = () => sent.filter((v) => v === false).length;

walk(960, 300, 400);                 assert.equal(opened(), 0, 'away from the top: nothing');
walk(960, 2, 120); walk(960, 300, 200); assert.equal(opened(), 0, 'quick pass through the band (<200 ms) does not open');
walk(300, 2, 400);                   assert.equal(opened(), 0, 'top edge but far from the centre does not open');
walk(960, 2, 240);                   assert.equal(opened(), 1, 'resting 240 ms in the top-centre band opens');
ipcMain['island-rect'](null, { w: 440, h: 292 });
walk(1100, 200, 600);                assert.equal(closed(), 0, 'moving down into the open panel keeps it open');
assert.equal(ignore[ignore.length - 1], false, 'panel is clickable under the pointer');
walk(1250, 200, 200); walk(1100, 150, 200); assert.equal(closed(), 0, 'leaving for 200 ms and coming back does not close (no flicker)');
walk(1500, 600, 400);                assert.equal(closed(), 1, 'leaving for 350 ms+ closes');
assert.equal(ignore[ignore.length - 1], true, 'clicks pass through again');
ipcMain['island-rect'](null, { w: 200, h: 32 });
walk(960, 2, 240);                   assert.equal(opened(), 2, 'opens again');
visible = false; walk(960, 2, 80);   assert.equal(closed(), 2, 'full-screen app (island hidden) closes it');
console.log('hover tests: 11 passed');
