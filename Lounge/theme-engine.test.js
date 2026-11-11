// Run: node theme-engine.test.js
// The theme engine: colours, rotation and scheduling. Every rule the founders asked for is a test here:
//   six themes, light and dark; Original Signature untouched; sequential and random rotation (random never repeats); every launch / 5 h / 7 h /
//   daily / weekly / monthly / manual; local time zones and a configurable time; a rotation that fell due while the app was closed applies on open;
//   no switching when merely navigating or focusing; the lock; preferences that survive restarts; two devices that agree.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { file as freshVectors } from './contract/build-vectors.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const themes = read('contract/themes.json'), schemes = read('contract/theme-schemes.json');
const CONTRACT = { ...themes, schemes: schemes.themes };
const SRC = fs.readFileSync(path.join(dir, 'theme-engine.js'), 'utf8');
const sandbox = (extra = {}) => { const win = {}; vm.runInNewContext(SRC, { window: win, Intl, Math, Number, String, Date, Set, Map, Array, Object, JSON, isFinite, parseInt, setInterval: () => 0, ...extra }); return win; };
const E = sandbox().CocoThemeEngine(CONTRACT);

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; process.exitCode = 1; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 4).join('\n     ')); } };
const at = (s) => Date.parse(s);
const HOUR = 3600000, DAY = 86400000;
const P = (patch = {}, rot = {}) => E.normalize({ ...E.defaultPrefs(), themeId: 'signature', ...patch, rotation: { ...E.defaultPrefs().rotation, enabled: true, seed: 'seed1', anchorAt: '2026-01-01T00:00:00.000Z', ...rot } });
const plain = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- colours
t('there are six themes, numbered 1 to 6, Original Signature first and locked', () => {
  assert.deepEqual(E.ids, ['signature', 'cobalt', 'violet', 'emerald', 'tangerine', 'orchid']);
  assert.deepEqual(E.themes.map((x) => x.number), [1, 2, 3, 4, 5, 6]); assert.equal(E.themes[0].name, 'Original Signature'); assert.equal(E.themes[0].locked, true);
  assert.deepEqual(E.themes.slice(1).map((x) => x.name), ['Electric Cobalt', 'Royal Violet', 'Emerald Energy', 'Tangerine Fusion', 'Digital Orchid']);
});
t('every theme, in light and dark, defines every CSS variable for the page and for panels', () => {
  const want = Object.values(E.VAR_MAP);
  for (const id of E.ids) for (const mode of ['light', 'dark']) {
    const css = E.cssFor(id, mode);
    for (const v of want) { assert.ok(v in css, `${id}/${mode} lacks ${v}`); assert.match(css[v], /^(#[0-9A-F]{6}|transparent)$/i, `${id}/${mode} ${v}=${css[v]}`); }
    for (const v of E.PANEL_VARS) { const p = '--p-' + v.slice(2); assert.ok(p in css, `${id}/${mode} lacks ${p}`); }
  }
});
t('Original Signature keeps its brand colours exactly', () => {
  const L = E.cssFor('signature', 'light'), D = E.cssFor('signature', 'dark');
  assert.equal(L['--surface'], '#F0EAF7', 'light background is Soft Lavender'); assert.equal(D['--surface'], '#24152E', 'dark background is Deep Aubergine');
  for (const css of [L, D]) {
    assert.equal(css['--p-surface-1'], '#151313', 'cards are black'); assert.equal(css['--surface-1'], '#151313');
    assert.equal(css['--primary'], '#FF39A8', 'hot pink is the accent'); assert.equal(css['--sel'], '#FF39A8', 'hot pink marks the selected state');
    assert.equal(css['--cta'], '#FFE52E', 'bright yellow is the call to action'); assert.equal(css['--hl'], '#FFE52E', 'bright yellow is the highlight');
    assert.equal(css['--on-cta'], '#151313'); assert.equal(css['--on-sel'], '#151313');
  }
  assert.equal(L['--on-surface'], '#151313', 'black text on the lavender page');
});
t('the other five themes are generated from their seeds and carry the seed colours', () => {
  const seedOf = { cobalt: ['#3563E9', '#35CFC9', '#FF9F43'], violet: ['#7655D9', '#35C6F2', '#FF719A'], emerald: ['#168A5B', '#B5DE55', '#55BCE8'], tangerine: ['#E76F38', '#477BFF', '#FFD166'], orchid: ['#B43ACB', '#43D9B2', '#F4C95D'] };
  for (const [id, seeds] of Object.entries(seedOf)) {
    assert.deepEqual(Object.values(E.byId(id).seeds), seeds, id + ' seeds');
    const d = E.cssFor(id, 'dark');
    // the vivid accent family comes back out of the tonal palette in the same hue (readable nudges allowed), so the theme is recognisably its seeds
    assert.equal(d['--hl'].toUpperCase(), seeds[2], id + ' highlight is the tertiary seed in dark mode');
  }
});
t('light and dark differ for every theme, and themes differ from one another', () => {
  for (const id of E.ids) assert.notEqual(E.cssFor(id, 'light')['--surface'], E.cssFor(id, 'dark')['--surface'], id);
  const prim = new Set(E.ids.map((id) => E.cssFor(id, 'light')['--primary'])); assert.equal(prim.size, 6);
});
t('appearance: light, dark, or follow the system', () => {
  assert.equal(E.resolveMode('light', true), 'light'); assert.equal(E.resolveMode('dark', false), 'dark'); assert.equal(E.resolveMode('system', true), 'dark'); assert.equal(E.resolveMode('system', false), 'light'); assert.equal(E.resolveMode('weird', true), 'dark');
});

// ---------------------------------------------------------------- documents
t('defaults: Original Signature, follow the system, rotation off and unlocked', () => {
  const d = E.defaultPrefs(); assert.equal(d.themeId, 'signature'); assert.equal(d.appearance, 'system'); assert.equal(d.rotation.enabled, false); assert.equal(d.locked, false); assert.equal(d.rotation.frequency, 'daily');
});
t('a broken or hostile document is repaired, never trusted', () => {
  const n = E.normalize({ themeId: 'nope', appearance: 'purple', seq: -5, locked: 'yes', rotation: { enabled: 1, frequency: 'hourly', order: 'shuffle', time: '25:99', weekday: 9, dayOfMonth: 0, tz: 'x'.repeat(200) } });
  assert.equal(n.themeId, 'signature'); assert.equal(n.appearance, 'system'); assert.equal(n.seq, 0); assert.equal(n.locked, true); assert.equal(n.rotation.frequency, 'daily'); assert.equal(n.rotation.order, 'sequential');
  assert.equal(n.rotation.time, '09:00'); assert.equal(n.rotation.weekday, 6); assert.equal(n.rotation.dayOfMonth, 1); assert.ok(n.rotation.tz.length <= 64);
  assert.deepEqual(plain(E.normalize(null)), plain(E.defaultPrefs())); assert.deepEqual(plain(E.normalize('junk')), plain(E.defaultPrefs()));
});

// ---------------------------------------------------------------- order
t('sequential rotation follows 1 to 6 and starts again', () => {
  let p = P({ themeId: 'signature' }, { order: 'sequential', frequency: 'launch' }), seen = [];
  for (let i = 0; i < 13; i++) { const r = E.evaluate(p, { now: at('2026-11-11T10:00:00Z') + i * HOUR, launch: true, rand: 0.5 }); assert.equal(r.changed, true); p = r.prefs; seen.push(p.themeId); }
  assert.deepEqual(seen.slice(0, 7), ['cobalt', 'violet', 'emerald', 'tangerine', 'orchid', 'signature', 'cobalt']);
});
t('random rotation never repeats the theme in use, nor the one before it, and reaches every other theme', () => {
  let p = P({ themeId: 'violet' }, { order: 'random', frequency: 'daily', time: '00:00', tz: 'UTC', seed: 'abc123' }), hit = new Set(), prev = null;
  let now = at('2026-01-02T00:00:00Z');
  for (let i = 0; i < 400; i++) {
    const before = p.themeId, bp = p.previousThemeId, r = E.evaluate(p, { now, launch: false }); assert.equal(r.changed, true, 'due each day'); p = r.prefs;
    assert.notEqual(p.themeId, before, 'repeated the theme in use at step ' + i); if (bp) assert.notEqual(p.themeId, bp, 'went straight back at step ' + i); hit.add(p.themeId); now += DAY;
  }
  assert.equal(hit.size, 6, 'every theme comes up');
});
t('random launch rotation never repeats either, whatever the dice say', () => {
  for (const rand of [0, 0.01, 0.25, 0.5, 0.74, 0.99, 0.999999]) for (const id of E.ids) {
    const p = P({ themeId: id, previousThemeId: E.ids[(E.ids.indexOf(id) + 3) % 6] }, { order: 'random', frequency: 'launch' }); const r = E.evaluate(p, { now: at('2026-11-11T10:00:00Z'), launch: true, rand });
    assert.notEqual(r.prefs.themeId, id); assert.notEqual(r.prefs.themeId, p.previousThemeId);
  }
});
t('two devices holding the same document pick the same "random" theme', () => {
  const a = sandbox().CocoThemeEngine(CONTRACT), b = sandbox().CocoThemeEngine(CONTRACT), p = P({ lastSwitchedAt: '2026-11-10T00:00:00Z', seq: 7 }, { order: 'random', frequency: 'daily', time: '00:00', tz: 'UTC' });
  const ra = a.evaluate(p, { now: at('2026-11-11T00:00:00Z'), launch: false }), rb = b.evaluate(p, { now: at('2026-11-11T00:00:05Z'), launch: false });
  assert.equal(ra.prefs.themeId, rb.prefs.themeId); assert.equal(ra.prefs.seq, rb.prefs.seq);
});

// ---------------------------------------------------------------- when
t('every launch: a new session switches; focusing or waiting does not', () => {
  const p = P({}, { frequency: 'launch' });
  assert.equal(E.evaluate(p, { now: at('2026-11-11T10:00:00Z'), launch: true, rand: 0.2 }).changed, true);
  for (const dt of [0, HOUR, 20 * HOUR, 9 * DAY]) assert.equal(E.evaluate(p, { now: at('2026-11-11T10:00:00Z') + dt, launch: false }).changed, false, 'a session that is merely open or focused is not a launch');
  assert.equal(E.nextDueAt(p, at('2026-11-11T10:00:00Z')), null); assert.equal(E.preview(p).kind, 'exact');
  assert.equal(E.preview(P({}, { frequency: 'launch', order: 'random' })).kind, 'random');
});
t('every 5 and 7 hours: switches exactly when the interval expires, counted from the last switch', () => {
  for (const [f, h] of [['5h', 5], ['7h', 7]]) {
    const p = P({ lastSwitchedAt: '2026-11-11T10:00:00Z' }, { frequency: f, anchorAt: '2026-11-01T00:00:00Z' }), t0 = at('2026-11-11T10:00:00Z');
    assert.equal(E.nextDueAt(p, t0 + HOUR), t0 + h * HOUR);
    assert.equal(E.evaluate(p, { now: t0 + h * HOUR - 1, launch: false }).changed, false, f + ' not yet'); assert.equal(E.evaluate(p, { now: t0 + h * HOUR, launch: false }).changed, true, f + ' due');
    const n = E.evaluate(p, { now: t0 + h * HOUR + 123456, launch: false }).prefs; assert.equal(n.lastSwitchedAt, new Date(t0 + h * HOUR + 123456).toISOString()); assert.equal(E.nextDueAt(n, t0 + h * HOUR + 123456), t0 + 2 * h * HOUR + 123456, 'the next interval counts from the actual switch');
  }
});
t('daily at a configurable time, in the local time zone', () => {
  for (const [tz, time, lastSw, now, due] of [['UTC', '09:00', '2026-11-10T09:30:00Z', '2026-11-11T09:00:00Z', true], ['UTC', '09:00', '2026-11-10T09:30:00Z', '2026-11-11T08:59:59Z', false],
    ['Asia/Kolkata', '09:00', '2026-11-10T04:00:00Z', '2026-11-11T03:30:00Z', true], ['Asia/Kolkata', '09:00', '2026-11-10T04:00:00Z', '2026-11-11T03:29:00Z', false],
    ['America/New_York', '21:30', '2026-11-10T20:00:00Z', '2026-11-11T02:30:00Z', true], ['America/New_York', '21:30', '2026-11-10T20:00:00Z', '2026-11-11T02:29:00Z', false]]) {
    const p = P({ lastSwitchedAt: lastSw }, { frequency: 'daily', time, tz }); assert.equal(E.isDue(p, at(now)), due, `${tz} ${time} at ${now}`);
  }
});
t('weekly on a chosen weekday and time', () => {
  const p = P({ lastSwitchedAt: '2026-11-02T09:05:00Z' }, { frequency: 'weekly', time: '09:00', tz: 'UTC', weekday: 1 });   // Mondays
  assert.equal(E.isDue(p, at('2026-11-08T23:59:00Z')), false, 'Sunday night'); assert.equal(E.isDue(p, at('2026-11-09T08:59:00Z')), false, 'Monday before the time'); assert.equal(E.isDue(p, at('2026-11-09T09:00:00Z')), true, 'Monday at the time');
  assert.equal(new Date(E.nextDueAt(p, at('2026-11-05T00:00:00Z'))).toISOString(), '2026-11-09T09:00:00.000Z');
});
t('monthly on a chosen day: day 31 falls on the last day of shorter months, leap years included', () => {
  const nd = (last, now) => new Date(E.nextDueAt(P({ lastSwitchedAt: last }, { frequency: 'monthly', time: '09:00', tz: 'UTC', dayOfMonth: 31 }), at(now))).toISOString();
  assert.equal(nd('2028-01-31T10:00:00Z', '2028-02-10T00:00:00Z'), '2028-02-29T09:00:00.000Z'); assert.equal(nd('2027-01-31T10:00:00Z', '2027-02-10T00:00:00Z'), '2027-02-28T09:00:00.000Z'); assert.equal(nd('2026-12-31T10:00:00Z', '2027-01-02T00:00:00Z'), '2027-01-31T09:00:00.000Z');
  const p = P({ lastSwitchedAt: '2026-10-01T09:05:00Z' }, { frequency: 'monthly', time: '09:00', tz: 'UTC', dayOfMonth: 1 }); assert.equal(E.isDue(p, at('2026-10-31T23:00:00Z')), false); assert.equal(E.isDue(p, at('2026-11-01T09:00:00Z')), true);
});
t('daylight saving: a time that does not exist moves forward, a time that happens twice uses the first', () => {
  const p1 = P({ lastSwitchedAt: '2026-03-07T12:00:00Z' }, { frequency: 'daily', time: '02:30', tz: 'America/New_York' });
  assert.equal(new Date(E.nextDueAt(p1, at('2026-03-08T00:00:00Z'))).toISOString(), '2026-03-08T07:30:00.000Z', 'spring forward: 02:30 does not exist, so 03:30');
  const p2 = P({ lastSwitchedAt: '2026-10-31T12:00:00Z' }, { frequency: 'daily', time: '01:30', tz: 'America/New_York' });
  assert.equal(new Date(E.nextDueAt(p2, at('2026-11-01T00:00:00Z'))).toISOString(), '2026-11-01T05:30:00.000Z', 'fall back: 01:30 happens twice, the first one counts');
});
t('closed when it fell due: applied on the next open, ONE step however many times were missed', () => {
  for (const f of ['5h', '7h', 'daily', 'weekly', 'monthly']) {
    const p = P({ lastSwitchedAt: '2026-08-01T10:00:00Z', themeId: 'violet' }, { frequency: f, time: '09:00', tz: 'UTC', weekday: 1, dayOfMonth: 1, anchorAt: '2026-07-01T00:00:00Z' });
    const r = E.evaluate(p, { now: at('2026-11-11T14:20:00Z'), launch: true, rand: 0.5 }); assert.equal(r.changed, true, f); assert.equal(r.prefs.themeId, 'emerald', f + ': one step from Royal Violet'); assert.equal(r.prefs.seq, p.seq + 1);
    assert.equal(r.prefs.lastSwitchedAt, '2026-11-11T14:20:00.000Z'); assert.ok(E.nextDueAt(r.prefs, at('2026-11-11T14:20:00Z')) > at('2026-11-11T14:20:00Z'), f + ': next one is in the future');
  }
});
t('locked, switched off and manual-only rotations never switch, on any clock', () => {
  const cases = [P({ locked: true }, { frequency: 'launch' }), P({}, { enabled: false, frequency: 'launch' }), P({}, { frequency: 'manual' }), P({ locked: true }, { frequency: '5h', anchorAt: '2020-01-01T00:00:00Z' }), P({}, { enabled: false, frequency: '7h', anchorAt: '2020-01-01T00:00:00Z' })];
  for (const p of cases) for (const launch of [true, false]) { const r = E.evaluate(p, { now: at('2026-11-11T10:00:00Z'), launch, rand: 0.3 }); assert.equal(r.changed, false); assert.equal(r.prefs, p); assert.equal(E.nextDueAt(p, at('2026-11-11T10:00:00Z')), null); assert.equal(E.preview(p).kind, 'none'); }
});

// ---------------------------------------------------------------- the person's own choices
t('applying a theme by hand switches at once, remembers the previous one and restarts the rotation clock', () => {
  const now = at('2026-11-11T12:00:00Z'), p = P({ lastSwitchedAt: '2026-11-11T01:00:00Z' }, { frequency: '5h', anchorAt: '2026-11-01T00:00:00Z' });
  const n = E.applyManual(p, 'tangerine', now, 'dev1'); assert.equal(n.themeId, 'tangerine'); assert.equal(n.previousThemeId, 'signature'); assert.equal(n.lastSwitchedAt, new Date(now).toISOString()); assert.equal(n.reason, 'manual'); assert.equal(n.updatedBy, 'dev1');
  assert.equal(E.nextDueAt(n, now), now + 5 * HOUR, 'a manual choice is not undone by the very next tick'); assert.equal(E.applyManual(p, 'not-a-theme', now), p);
});
t('"apply next theme now" takes one step in the chosen order', () => {
  const now = at('2026-11-11T12:00:00Z');
  assert.equal(E.advance(P({ themeId: 'orchid' }, { order: 'sequential' }), now, 0.3).themeId, 'signature');
  const r = E.advance(P({ themeId: 'emerald', previousThemeId: 'cobalt' }, { order: 'random' }), now, 0.9); assert.ok(!['emerald', 'cobalt'].includes(r.themeId));
});
t('saving a new schedule restarts its clock, so it can never fire on the spot', () => {
  const now = at('2026-11-11T12:00:00Z'), p = P({ lastSwitchedAt: '2026-01-01T00:00:00Z' }, { enabled: false, anchorAt: null });
  const n = E.setRotation(p, { enabled: true, frequency: 'daily', time: '09:00', tz: 'UTC' }, now, 'dev1'); assert.equal(n.rotation.anchorAt, new Date(now).toISOString()); assert.ok(n.rotation.seed.length >= 4, 'a seed is created the first time rotation is switched on');
  assert.equal(E.evaluate(n, { now, launch: true }).changed, false, 'not on the spot'); assert.ok(E.nextDueAt(n, now) > now);
  assert.equal(E.setRotation(n, { frequency: 'weekly', weekday: 99, time: '7:5' }, now).rotation.weekday, 6, 'bad input is clamped');
});
t('locking freezes the theme; unlocking restarts the clock; reset returns to the default', () => {
  const now = at('2026-11-11T12:00:00Z'), p = P({ themeId: 'orchid' }, { frequency: 'launch' });
  const locked = E.setLocked(p, true, now); assert.equal(E.evaluate(locked, { now, launch: true }).changed, false); const un = E.setLocked(locked, false, now + 1000); assert.equal(un.rotation.anchorAt, new Date(now + 1000).toISOString()); assert.equal(E.evaluate(un, { now, launch: true }).changed, true);
  const r = E.reset(now, 'dev1'); assert.equal(r.themeId, 'signature'); assert.equal(r.rotation.enabled, false); assert.equal(r.locked, false); assert.equal(r.appearance, 'system'); assert.equal(r.reason, 'reset');
  assert.equal(E.setAppearance(p, 'dark', now).appearance, 'dark'); assert.equal(E.setAppearance(p, 'nonsense', now), p);
});
t('the later edit wins when two devices disagree', () => {
  const a = P({ updatedAt: '2026-11-11T10:00:00Z', themeId: 'cobalt' }), b = P({ updatedAt: '2026-11-11T10:00:01Z', themeId: 'violet' }); assert.equal(E.newer(a, b), b); assert.equal(E.newer(b, a), b);
});

// ---------------------------------------------------------------- the browser shell, against stand-in storage and document
function fakeBrowser() {
  const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
  const local = mem(), session = mem(), props = {}, dataset = {}, style = { setProperty: (k, v) => { props[k] = v; }, colorScheme: '' };
  const doc = { documentElement: { style, dataset }, body: { classList: { contains: () => false } }, querySelector: () => null, addEventListener: () => {}, hidden: false };
  const win = { matchMedia: (q) => ({ matches: /dark/.test(q) ? win.__dark : false, addEventListener: () => {} }), __dark: false };
  return { local, session, props, dataset, doc, win };
}
function boot(env, now) {
  const w = {}; const RealDate = Date; const fakeDate = class extends RealDate { constructor(...a) { super(...(a.length ? a : [now.t])); } static now() { return now.t; } };
  vm.runInNewContext(SRC, { window: w, Intl, Math, Number, String, Date: fakeDate, Set, Map, Array, Object, JSON, isFinite, parseInt, setInterval: () => 0, localStorage: env.local, sessionStorage: env.session, document: env.doc, matchMedia: env.win.matchMedia });
  w.matchMedia = env.win.matchMedia; return w;
}
t('shell: the saved theme is painted at boot; a reload in the same session is not a launch; a new session is', () => {
  const env = fakeBrowser(), now = { t: at('2026-11-11T10:00:00Z') };
  let w = boot(env, now); const sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT));
  sh.boot(); assert.equal(env.dataset.palette, 'signature'); assert.equal(env.props['--primary'], '#FF39A8'); assert.equal(env.dataset.mode, 'light');
  sh.setRotation({ enabled: true, frequency: 'launch', order: 'sequential' }); sh.apply('violet'); assert.equal(env.dataset.palette, 'violet');
  // reload in the same session: same theme, no launch switch even though the schedule is "every launch"
  w = boot(env, now); const sh2 = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); const r2 = sh2.boot(); assert.equal(r2.launch, false); assert.equal(sh2.get().themeId, 'violet'); assert.equal(env.dataset.palette, 'violet');
  // the app is closed and opened again: a new session, so "every launch" switches
  env.session.removeItem('gs-theme-session'); w = boot(env, now); const sh3 = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); const r3 = sh3.boot(); assert.equal(r3.launch, true); assert.equal(r3.rotated, 'launch'); assert.equal(sh3.get().themeId, 'emerald'); assert.equal(env.dataset.palette, 'emerald');
});
t('shell: preferences survive a restart, and an old Light / Dark choice is kept', () => {
  const env = fakeBrowser(), now = { t: at('2026-11-11T10:00:00Z') }; env.local.setItem('gs-theme', 'dark');
  let w = boot(env, now); let sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); sh.boot(); assert.equal(sh.get().appearance, 'dark', 'the old gs-theme choice is read'); assert.equal(env.dataset.mode, 'dark'); assert.equal(env.props['--surface'], '#24152E');
  sh.setAppearance('light'); sh.apply('orchid'); sh.setLocked(true);
  env.session.removeItem('gs-theme-session'); w = boot(env, now); sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); sh.boot();
  assert.equal(sh.get().themeId, 'orchid'); assert.equal(sh.get().appearance, 'light'); assert.equal(sh.get().locked, true); assert.equal(env.dataset.palette, 'orchid');
});
t('shell: system appearance follows the operating system', () => {
  const env = fakeBrowser(), now = { t: at('2026-11-11T10:00:00Z') }; env.win.__dark = true;
  const w = boot(env, now); const sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); sh.boot(); assert.equal(env.dataset.mode, 'dark'); sh.setAppearance('light'); assert.equal(env.dataset.mode, 'light');
});
t('shell: preview changes the screen without saving, and cancelling puts the saved theme back', () => {
  const env = fakeBrowser(), now = { t: at('2026-11-11T10:00:00Z') }; const w = boot(env, now); const sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); sh.boot();
  sh.preview('emerald'); assert.equal(env.dataset.palette, 'emerald'); assert.equal(sh.get().themeId, 'signature'); const saved = env.local.getItem('gs-theme-prefs'); assert.ok(!saved || JSON.parse(saved).themeId === 'signature', 'nothing saved');
  sh.cancelPreview(); assert.equal(env.dataset.palette, 'signature');
});
t('shell: a newer document from another device is adopted; an older one is ignored', () => {
  const env = fakeBrowser(), now = { t: at('2026-11-11T10:00:00Z') }; const w = boot(env, now); const sh = w.CocoThemeShell(w.CocoThemeEngine(CONTRACT)); sh.boot(); sh.apply('cobalt');
  const mine = sh.get(); assert.equal(sh.adopt({ ...mine, themeId: 'violet', updatedAt: '2000-01-01T00:00:00Z' }), false); assert.equal(sh.get().themeId, 'cobalt');
  assert.equal(sh.adopt({ ...mine, themeId: 'orchid', updatedAt: '2099-01-01T00:00:00Z', reason: 'manual' }), true); assert.equal(sh.get().themeId, 'orchid'); assert.equal(env.dataset.palette, 'orchid');
});

// ---------------------------------------------------------------- the shared vectors (Android runs the same file)
t('the committed test vectors are exactly what this engine produces', () => {
  const onDisk = read('contract/theme-vectors.json'); assert.deepEqual(plain(freshVectors), onDisk, 'run: node contract/build-vectors.mjs');
  assert.ok(onDisk.vectors.length > 100, 'enough cases: ' + onDisk.vectors.length);
});

console.log(`\ntheme engine: ${pass} passed, ${fail} failed`);
