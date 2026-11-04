// Run: node island2.test.js   Island 2.0 (2026-11-04): drives the real placement / prefs / pointer / shortcut code copied out of main.js.
const fs = require('fs'), assert = require('assert'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, 'island.html'), 'utf8'), lounge = fs.readFileSync(path.join(__dirname, '..', 'Lounge', 'index.html'), 'utf8');
const between = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, 'block ' + a); return src.slice(i, j); };

// ---- placement, saved prefs, multi-monitor ----
const block = between('const ISLAND_W', 'function sendPrefs');
let saved = {}, bounds = null;
const displays = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }, { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 } }];
const screen = { getAllDisplays: () => displays, getPrimaryDisplay: () => displays[0] };
const island = { setBounds: (b) => { bounds = b; } };
const mk = () => new Function('island', 'islandSettings', 'require', block + '; return { placeIsland, islandPrefs, islandDisplay, ISLAND_W, ISLAND_H };')(island, () => ({ prefs: saved }), () => ({ screen }));
let m = mk(); m.placeIsland();
assert.deepEqual([bounds.x, bounds.y, bounds.width, bounds.height], [660, 0, 600, 480], 'default: centred at the top of the main screen');
saved = { align: 'left' }; m.placeIsland(); assert.equal(bounds.x, 24, 'left side of the main screen');
saved = { align: 'right' }; m.placeIsland(); assert.equal(bounds.x, 1920 - 600 - 24, 'right side of the main screen');
saved = { screen: 2 }; m.placeIsland(); assert.deepEqual([bounds.x, bounds.y], [1920 + (2560 - 600) / 2, 0], 'saved second monitor, centred on it');
saved = { screen: 99 }; m.placeIsland(); assert.equal(bounds.x, 660, 'a saved monitor that was unplugged falls back to the main screen');
assert.equal(m.islandPrefs().theme, 'coco', 'theme defaults to Coco');
saved = { theme: 'mafia' }; assert.equal(m.islandPrefs().theme, 'mafia', 'Mafia theme is kept'); for (const old of ['dark', 'light', 'auto', 'zzz']) { saved = { theme: old }; assert.equal(m.islandPrefs().theme, 'coco', 'old / unknown saved theme ' + old + ' falls back to Coco'); } saved = {};

// ---- pref action only accepts known values (nothing arbitrary reaches island.json) ----
assert.ok(/action === 'pref'/.test(src) && /\['coco', 'mafia'\]\.includes\(v\)/.test(src) && /\['left', 'center', 'right'\]\.includes\(v\)/.test(src) && /getAllDisplays\(\)\.some\(\(d\) => d\.id === v\)/.test(src), 'pref values are validated against fixed lists');

// ---- CPU / RAM ----
const sysSrc = src.slice(src.indexOf('let cpuPrev'), src.indexOf('\n}', src.indexOf("return { cpu, ram:")) + 2);
const sys = new Function('require', sysSrc + '; return sysInfo;')(require);
const a = sys(); assert.equal(a.cpu, null, 'first sample has no CPU yet (honest: no fake number)'); assert.ok(a.ram >= 0 && a.ram <= 100, 'RAM is a real percentage');
const t0 = Date.now(); while (Date.now() - t0 < 120); const b = sys(); assert.ok(b.cpu === null || (b.cpu >= 0 && b.cpu <= 100), 'CPU is a real percentage');

// ---- pointer: pinned island keeps its clicks over a maximised app; band follows the island's own position ----
const hover = between('const BAND_PX', '// One pointer timer for the island and the Dock.');
let cursor = { x: 0, y: 500 }, now = 0, sent = [], ignore = [], islandBounds = { x: 1920 + 980, y: 0, width: 600, height: 480 };
const isl = { isVisible: () => true, getBounds: () => islandBounds, setIgnoreMouseEvents: (v) => ignore.push(v), webContents: { send: (c, v) => sent.push(v) } };
const ipc = { on: (n, f) => (ipc[n] = f) };
const run = new Function('island', 'require', 'ipcMain', 'Date', 'let islandMax = true;' + hover + '; return islandPointer;')(isl, () => ({ screen: { getCursorScreenPoint: () => cursor } }), ipc, { now: () => now });
const walk = (x, y, ms) => { cursor = { x, y }; for (let t = 0; t < ms; t += 40) { now += 40; run(); } };
walk(1920 + 1280, 2, 240); assert.equal(sent.filter((v) => v === true).length, 1, 'band on the second monitor (island there) opens it');
walk(100, 2, 400); assert.equal(sent.filter((v) => v === true).length, 1, 'the main screen top edge does not open an island that lives on the other monitor');
ipc['island-rect'](null, { w: 580, h: 464, pin: true });
walk(1920 + 1280, 200, 800); assert.equal(ignore[ignore.length - 1], false, 'pinned: clicks stay on the island even over a maximised app');
ipc['island-rect'](null, { w: 580, h: 464, pin: false }); sent.length = 0; walk(1000, 600, 400); walk(1920 + 1280, 200, 40);
assert.equal(ignore[ignore.length - 1], true, 'not pinned + maximised app: clicks pass through again');

// ---- shortcut, shutdown, crash recovery ----
assert.ok(src.includes("globalShortcut.register('Control+Alt+I'") && src.includes('globalShortcut.unregisterAll()') && src.includes("app.on('will-quit'"), 'Ctrl+Alt+I registered and released on quit');
assert.ok(src.includes("island.webContents.on('render-process-gone'") && src.includes('island.reload()'), 'a crashed island page reloads itself');
assert.ok(src.includes("screen.on(ev, () => { placeIsland(); placeDock(); sendPrefs(); })"), 'monitor plug / unplug re-places the island');
assert.ok(src.includes('islandSettings().enabled && !islandFull'), 'hide / show setting and full-screen hiding still obeyed');
assert.ok(/ISLAND_W, height: ISLAND_H/.test(src), 'window created at the new size');

// ---- data feed: extra fields are additive, the old ones are untouched ----
for (const f of ['approvals:', 'tasks:', 'doneToday:', 'recentDone:', 'hq: cocoHQ(D)', 'talk: teamTalk(D)', '...islandExtras(D)']) assert.ok(lounge.includes(f), 'push keeps ' + f);
const ex = new Function('isLive', 'founder', lounge.match(/function islandExtras\(D\) \{[\s\S]*?\n\}/)[0] + '; return islandExtras;');
const D = { members: [{ id: 'm1', name: 'Nono' }], tasks: [
  { id: 1, title: 'ok', status: 'done', member_id: 'm1', updated_at: '2026-11-04T10:00:00Z' }, { id: 2, title: 'bad', status: 'failed', member_id: 'm1', updated_at: '2026-11-04T11:00:00Z', error: 'zip rejected' },
  { id: 3, title: 'wait', status: 'blocked', updated_at: '2026-11-04T09:00:00Z' }, { id: 4, title: 'q', status: 'queued', updated_at: '2026-11-04T12:00:00Z' }] };
const x = ex(true, { name: 'Founder B' })(D);
assert.deepEqual(x.issues.map((t) => t.id), [2, 3], 'only blocked / failed / error tasks are issues'); assert.equal(x.issues[0].why, 'zip rejected', 'recorded reason passes through'); assert.equal(x.issues[1].why, '', 'no reason recorded stays empty (not invented)');
assert.deepEqual(x.history.map((t) => t.id), [2, 1, 3], 'history newest first, queued work left out'); assert.equal(x.issues[0].who, 'Nono'); assert.equal(x.live, true); assert.equal(x.me, 'Founder B');
assert.equal(ex(false, null)({ tasks: [] }).me, null, 'no founder yet -> null'); assert.ok(typeof x.at === 'number');

// ---- island page: identity, three states, cleanup ----
assert.ok(page.includes("'BOSS'") && page.includes("'BIG BOSS'") && page.includes('NM_A') && page.includes('NM_B') && page.includes("'BIG BOSS'"), 'founders are shown by role: BOSS and BIG BOSS');
for (const s of ['compact: [', 'open: [', 'detail: [', "mode(v ? 'detail' : 'open')", "window.addEventListener('blur'", "data-theme=mafia", "RADIUS_K", 'REAL = {']) assert.ok(page.includes(s), 'page has ' + s);
console.log('island 2.0 tests passed');
