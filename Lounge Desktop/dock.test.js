// Run: node dock.test.js   Dock auto-hide (Boss 2026-11-04: hide when the mouse is not on it, mouse wheel at the bottom edge shows it), the adaptive
// pointer timer, and the Dock fixes. Drives the real functions copied out of main.js, with a fake pointer and clock.
const fs = require('fs'), assert = require('assert'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), page = fs.readFileSync(path.join(__dirname, 'dock.html'), 'utf8');
const pre = fs.readFileSync(path.join(__dirname, 'dock-preload.js'), 'utf8'), cs = fs.readFileSync(path.join(__dirname, 'CocoIslandHelper.cs'), 'utf8') + fs.readFileSync(path.join(__dirname, 'CocoIslandHelperExtras.cs'), 'utf8');
const between = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, 'block ' + a); return src.slice(i, j); };

// ---- the decision: dockNext ----
const code = between('const DOCK_EDGE_PX', 'let dockSentShown');
const mk = () => new Function('islandSettings', code + '; return { dockNext, dockAH, DOCK_DWELL_MS, DOCK_HIDE_MS };')(() => ({}));
const D = { x: 0, y: 0, width: 1920, height: 1080 }, B = { x: 0, y: 780, width: 1920, height: 300 };   // the Dock window: bottom 300 px
const BAR = [{ x: 700, y: 220, w: 520, h: 60 }];                                                          // the bar inside that window
const OVER_BAR = { x: 900, y: 780 + 250 }, AWAY = { x: 900, y: 300 }, EDGE = { x: 900, y: 1079 };
let T = mk(), st = () => T.dockAH;
const step = (p, ms, rects = BAR, auto = true) => { let shown; for (let t = 0; t < ms; t += 40) { now += 40; shown = T.dockNext(st(), now, p, D, rects, B, auto); } return shown; };
let now = 1000;

// auto-hide off: always shown, state cleared
assert.equal(T.dockNext(st(), now, AWAY, D, BAR, B, false), true, 'auto-hide off: always shown');
// shown + pointer on the bar: stays, however long
assert.equal(step(OVER_BAR, 5000), true, 'the pointer on the bar keeps it shown');
// pointer leaves: still shown at 600 ms, hidden by 700 ms
assert.equal(step(AWAY, 600), true, 'not hidden before 700 ms');
assert.equal(step(AWAY, 160), false, 'hidden after the pointer has been away 700 ms');
// coming back to the bar before 700 ms cancels (no flicker)
T = mk(); now = 1000; step(AWAY, 400); assert.equal(step(OVER_BAR, 40), true); assert.equal(step(AWAY, 600), true, 'the away timer restarted when the pointer came back');
// the preview above the bar counts as "on it"
const withPreview = [...BAR, { x: 600, y: 20, w: 700, h: 190 }];
T = mk(); now = 1000; assert.equal(step({ x: 900, y: 780 + 100 }, 3000, withPreview), true, 'the open preview keeps the Dock shown');
assert.equal(step({ x: 900, y: 780 + 100 }, 3000, BAR), false, 'without the preview the same spot is "away"');

// hidden: the bottom edge for 120 ms shows it; less does not; leaving the edge resets
T = mk(); now = 1000; step(AWAY, 800); assert.equal(st().shown, false);
assert.equal(step(EDGE, 80), false, 'less than 120 ms at the edge: still hidden'); step(AWAY, 80); assert.equal(step(EDGE, 80), false, 'the dwell restarts after leaving the edge');
assert.equal(step(EDGE, 160), true, 'resting on the bottom edge shows it');
// at the edge it stays shown (does not hide again while the pointer rests there)
assert.equal(step(EDGE, 3000), true, 'resting at the edge keeps it shown');

// mouse wheel: shows at once at the edge; ignored elsewhere; ignored when stale
T = mk(); now = 1000; step(AWAY, 800);
st().wheelAt = now; assert.equal(T.dockNext(st(), now, AWAY, D, BAR, B, true), false, 'a wheel turn away from the bottom edge does nothing');
st().wheelAt = now - 900; assert.equal(T.dockNext(st(), now, EDGE, D, BAR, B, true), false, 'a stale wheel turn (>500 ms) is ignored');
st().wheelAt = now; assert.equal(T.dockNext(st(), now, EDGE, D, BAR, B, true), true, 'a wheel turn at the bottom edge shows it immediately (no 120 ms wait)');
assert.equal(st().wheelAt, 0, 'the wheel signal is used once');

// the edge must be the bottom of the screen
T = mk(); now = 1000; step(AWAY, 800); assert.equal(step({ x: 900, y: 1070 }, 1000), false, '10 px above the bottom is not the edge'); assert.equal(step({ x: 2500, y: 1079 }, 1000), false, 'off the display is not the edge');

// ---- the adaptive pointer timer: one loop, fast only when near ----
const loop = between('function pointerLoop()', 'app.whenReady().then(pointerLoop);');
const delays = []; let nearA = false, nearB = false, boom = false;
const run = new Function('islandPointer', 'dockPointer', 'setTimeout', 'logLine', loop + '; return pointerLoop;')(() => { if (boom) throw new Error('x'); return nearA; }, () => nearB, (f, ms) => delays.push(ms), () => {});
run(); nearA = true; run(); nearA = false; nearB = true; run(); nearB = false; boom = true; run();
assert.deepEqual(delays, [120, 40, 40, 120], 'far = 120 ms (about 8 checks a second), near either the island or the Dock = 40 ms; an error never stops the loop');
assert.ok(!/setInterval\(islandPointer/.test(src), 'no fixed 40 ms island timer any more');
assert.ok(!/let dockHot = false;\nsetInterval/.test(src), 'no fixed 40 ms Dock timer any more');

// ---- structure of the fixes ----
assert.ok(src.includes("dockWatch = fs.watch(PINNED") && src.includes('clearTimeout(dockWatchTimer)') && /dock\.on\('closed'[^\n]*dockWatch\.close\(\)/.test(src), 'one pinned-apps watcher, debounced, closed with the Dock');
assert.ok(src.includes('key !== lastDockPayload'), 'the Dock page is only told when what it shows changed');
assert.ok(src.includes("'wheelhook off\\n'") && src.includes("'wheelhook on\\n'") && src.includes("if (m.t === 'wheel')"), 'wheel hook is switched on and off with the Dock and its signal is handled');
assert.ok(/onVisible/.test(pre) && page.includes("D.onVisible((v) => { dock.classList.toggle('away'") && page.includes('#dock.away') && page.includes('prefers-reduced-motion: reduce) { #dock { transition: none; } }'), 'Dock page slides away, passes clicks through, honours reduced motion');
assert.ok(page.includes("dock.classList.contains('away') ? [] :"), 'a hidden Dock reports no clickable area');
assert.ok(cs.includes('SetWindowsHookEx(14') && cs.includes('0x020A') && cs.includes('"wheelhook on"') && cs.includes('Emit("{\\"t\\":\\"wheel\\"}")'), 'helper: WH_MOUSE_LL hook, wheel only, bare signal');
assert.ok(!/MouseLL s[\s\S]{0,400}Emit\([^)]*(s\.pt|s\.data)/.test(cs), 'the wheel line carries no position or amount');
assert.ok(!cs.includes('static void Procs()') && cs.includes('names2.Add(info[0])'), 'the process list comes from the window list, not a second pass over every process');
assert.ok(cs.includes('new Thread(() => { while (true) { try { Net(); Bright(); }'), 'netsh and WMI run on their own thread, never blocking the loop');
assert.ok(src.includes('dockAH.shown = true; dockAH.awaySince = dockAH.edgeSince = 0; dockSentShown = null;'), 'after sleep / wake the Dock starts shown again');
console.log('dock tests passed');
