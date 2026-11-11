// Run: node contract/build-vectors.mjs
// Generates contract/theme-vectors.json: inputs and expected outputs of the theme engine (theme-engine.js), computed BY that engine.
// The Android app runs the very same file against its Kotlin port, so both platforms provably make the same decisions (same next theme, same
// due time, same "random" pick). theme-engine.test.js fails if this file is not what the engine produces today.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const themes = read('themes.json'), schemes = read('theme-schemes.json');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(dir, '..', 'theme-engine.js'), 'utf8'), { window: win, Intl, Math, Number, String, Date, Set, Map, Array, Object, JSON, isFinite, parseInt, setInterval: () => 0, document: undefined });
const E = win.CocoThemeEngine({ ...themes, schemes: schemes.themes });
const plain = (x) => JSON.parse(JSON.stringify(x));
const at = (s) => Date.parse(s);
const P = (patch = {}, rot = {}) => E.normalize({ ...E.defaultPrefs(), themeId: 'signature', ...patch, rotation: { ...E.defaultPrefs().rotation, enabled: true, seed: 'seed1', anchorAt: '2026-01-01T00:00:00.000Z', ...rot } });

export const vectors = [];
const add = (v) => vectors.push(v);

// FNV-1a: the one hash the "random" scheduled pick is built on
for (const s of ['', 'a', 'coco', 'seed1|0|signature', 'seed1|12|cobalt', 'x7y|3|orchid']) add({ name: 'fnv1a32 of ' + JSON.stringify(s), op: 'fnv1a32', input: s, expect: E.fnv1a32(s) });

// choosing the next theme
for (const id of E.ids) add({ name: 'sequential after ' + id, op: 'pickNext', prefs: P({ themeId: id }, { order: 'sequential' }), expect: E.pickNext(P({ themeId: id }, { order: 'sequential' })) });
for (let seq = 0; seq < 8; seq++) for (const id of ['signature', 'violet', 'orchid']) { const p = P({ themeId: id, seq, previousThemeId: id === 'signature' ? 'cobalt' : null }, { order: 'random' }); add({ name: `random scheduled pick seq ${seq} from ${id}`, op: 'pickNext', prefs: p, expect: E.pickNext(p) }); }
for (const rand of [0, 0.2, 0.5, 0.74, 0.999]) { const p = P({ themeId: 'emerald', previousThemeId: 'tangerine' }, { order: 'random', frequency: 'launch' }); add({ name: 'random launch pick rand ' + rand, op: 'pickNext', prefs: p, rand, expect: E.pickNext(p, rand) }); }

// when is the next switch
const zones = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Sydney'];
const fixedNow = at('2026-11-11T14:20:00Z');
for (const f of ['5h', '7h']) for (const anchor of ['2026-11-11T10:00:00Z', '2026-11-10T22:30:00Z']) { const p = P({ lastSwitchedAt: anchor }, { frequency: f }); add({ name: `${f} interval from ${anchor}`, op: 'nextDueAt', prefs: p, now: fixedNow, expect: E.nextDueAt(p, fixedNow) }); }
for (const tz of zones) for (const time of ['00:00', '09:00', '23:30']) {
  const pd = P({ lastSwitchedAt: '2026-11-09T12:00:00Z' }, { frequency: 'daily', time, tz }); add({ name: `daily ${time} ${tz}`, op: 'nextDueAt', prefs: pd, now: fixedNow, expect: E.nextDueAt(pd, fixedNow) });
  const pw = P({ lastSwitchedAt: '2026-11-01T12:00:00Z' }, { frequency: 'weekly', time, tz, weekday: 3 }); add({ name: `weekly Wed ${time} ${tz}`, op: 'nextDueAt', prefs: pw, now: fixedNow, expect: E.nextDueAt(pw, fixedNow) });
  const pm = P({ lastSwitchedAt: '2026-09-20T12:00:00Z' }, { frequency: 'monthly', time, tz, dayOfMonth: 31 }); add({ name: `monthly day 31 ${time} ${tz}`, op: 'nextDueAt', prefs: pm, now: fixedNow, expect: E.nextDueAt(pm, fixedNow) });
}
// daylight saving: a daily switch at a wall-clock time that does not exist on the spring-forward day, and one that happens twice on the fall-back day
for (const [label, lastSw, now] of [['spring forward', '2026-03-07T12:00:00Z', '2026-03-08T20:00:00Z'], ['fall back', '2026-10-31T12:00:00Z', '2026-11-01T20:00:00Z']]) {
  const p = P({ lastSwitchedAt: lastSw }, { frequency: 'daily', time: '02:30', tz: 'America/New_York' }); add({ name: `daily 02:30 New York, ${label}`, op: 'nextDueAt', prefs: p, now: at(now), expect: E.nextDueAt(p, at(now)) });
}
{ const p = P({ lastSwitchedAt: '2026-10-31T12:00:00Z' }, { frequency: 'daily', time: '01:30', tz: 'America/New_York' }); add({ name: 'daily 01:30 New York, the hour that happens twice (first one wins)', op: 'nextDueAt', prefs: p, now: at('2026-11-01T03:00:00Z'), expect: E.nextDueAt(p, at('2026-11-01T03:00:00Z')) }); }
for (const [label, lastSw, now] of [['leap February', '2028-01-31T10:00:00Z', '2028-02-10T10:00:00Z'], ['plain February', '2027-01-31T10:00:00Z', '2027-02-10T10:00:00Z'], ['December into January', '2026-12-31T10:00:00Z', '2027-01-02T10:00:00Z']]) {
  const p = P({ lastSwitchedAt: lastSw }, { frequency: 'monthly', time: '09:00', tz: 'UTC', dayOfMonth: 31 }); add({ name: `monthly day 31, ${label}`, op: 'nextDueAt', prefs: p, now: at(now), expect: E.nextDueAt(p, at(now)) });
}
add({ name: 'nothing is scheduled when rotation is off', op: 'nextDueAt', prefs: P({}, { enabled: false }), now: fixedNow, expect: null });
add({ name: 'nothing is scheduled when the theme is locked', op: 'nextDueAt', prefs: P({ locked: true }), now: fixedNow, expect: null });
add({ name: 'nothing is scheduled for manual only', op: 'nextDueAt', prefs: P({}, { frequency: 'manual' }), now: fixedNow, expect: null });
add({ name: 'nothing is scheduled for every launch', op: 'nextDueAt', prefs: P({}, { frequency: 'launch' }), now: fixedNow, expect: null });

// the decision
const ev = (name, prefs, now, launch, rand) => { const r = E.evaluate(prefs, { now, launch, rand, by: 'dev1' }); add({ name, op: 'evaluate', prefs, now, launch, rand: rand === undefined ? null : rand, by: 'dev1', expect: plain(r) }); };
ev('every launch: a new session switches', P({}, { frequency: 'launch' }), fixedNow, true, 0.1);
ev('every launch: focusing an existing session does not', P({}, { frequency: 'launch' }), fixedNow, false, 0.1);
ev('every launch, random: never the theme in use', P({ themeId: 'cobalt', previousThemeId: 'violet' }, { frequency: 'launch', order: 'random' }), fixedNow, true, 0);
ev('5 hours: not yet', P({ lastSwitchedAt: '2026-11-11T10:00:00Z' }, { frequency: '5h' }), at('2026-11-11T14:59:59Z'), false);
ev('5 hours: due', P({ lastSwitchedAt: '2026-11-11T10:00:00Z' }, { frequency: '5h' }), at('2026-11-11T15:00:00Z'), false);
ev('7 hours, app was closed for days: one step only', P({ lastSwitchedAt: '2026-11-01T10:00:00Z' }, { frequency: '7h', order: 'sequential' }), fixedNow, true);
ev('daily 09:00 UTC: before the time', P({ lastSwitchedAt: '2026-11-10T09:30:00Z' }, { frequency: 'daily', time: '09:00', tz: 'UTC' }), at('2026-11-11T08:59:00Z'), false);
ev('daily 09:00 UTC: at the time', P({ lastSwitchedAt: '2026-11-10T09:30:00Z' }, { frequency: 'daily', time: '09:00', tz: 'UTC' }), at('2026-11-11T09:00:00Z'), false);
ev('daily 09:00 Kolkata: closed over the boundary, applied on open', P({ lastSwitchedAt: '2026-11-10T04:00:00Z' }, { frequency: 'daily', time: '09:00', tz: 'Asia/Kolkata' }), at('2026-11-11T14:20:00Z'), true);
ev('weekly Monday 09:00 UTC: Sunday is not due', P({ lastSwitchedAt: '2026-11-02T09:05:00Z' }, { frequency: 'weekly', time: '09:00', tz: 'UTC', weekday: 1 }), at('2026-11-08T23:00:00Z'), false);
ev('weekly Monday 09:00 UTC: Monday is due', P({ lastSwitchedAt: '2026-11-02T09:05:00Z' }, { frequency: 'weekly', time: '09:00', tz: 'UTC', weekday: 1 }), at('2026-11-09T09:00:00Z'), false);
ev('monthly day 1 09:00 UTC: due on the 1st', P({ lastSwitchedAt: '2026-10-01T09:05:00Z' }, { frequency: 'monthly', time: '09:00', tz: 'UTC', dayOfMonth: 1 }), at('2026-11-01T09:00:00Z'), false);
ev('manual only never switches, even on launch', P({}, { frequency: 'manual' }), fixedNow, true);
ev('a locked theme never switches', P({ locked: true }, { frequency: 'launch' }), fixedNow, true);
ev('rotation off never switches', P({}, { enabled: false, frequency: 'launch' }), fixedNow, true);
// two devices holding the same document reach the same random theme
ev('random scheduled switch is deterministic', P({ lastSwitchedAt: '2026-11-10T00:00:00Z', seq: 4 }, { frequency: 'daily', time: '00:00', tz: 'UTC', order: 'random' }), at('2026-11-11T00:00:00Z'), false);

// the person's own actions
const now0 = at('2026-11-11T12:00:00Z');
const act = (name, op, prefs, args, result) => add({ name, op, prefs, now: now0, args, by: 'dev1', expect: plain(result) });
act('applying a theme by hand', 'applyManual', P({}, { frequency: '5h' }), { themeId: 'tangerine' }, E.applyManual(P({}, { frequency: '5h' }), 'tangerine', now0, 'dev1'));
act('applying the theme already in use changes nothing but the clock', 'applyManual', P({ themeId: 'violet' }), { themeId: 'violet' }, E.applyManual(P({ themeId: 'violet' }), 'violet', now0, 'dev1'));
act('apply next theme now (sequential)', 'advance', P({ themeId: 'orchid' }, { order: 'sequential' }), { rand: 0.3 }, E.advance(P({ themeId: 'orchid' }, { order: 'sequential' }), now0, 0.3, 'dev1'));
act('apply next theme now (random)', 'advance', P({ themeId: 'emerald', previousThemeId: 'cobalt' }, { order: 'random' }), { rand: 0.9 }, E.advance(P({ themeId: 'emerald', previousThemeId: 'cobalt' }, { order: 'random' }), now0, 0.9, 'dev1'));
act('saving a new schedule restarts its clock', 'setRotation', P({}, { enabled: false }), { patch: { enabled: true, frequency: 'weekly', weekday: 5, time: '18:45', tz: 'Europe/London' } }, E.setRotation(P({}, { enabled: false }), { enabled: true, frequency: 'weekly', weekday: 5, time: '18:45', tz: 'Europe/London' }, now0, 'dev1'));
act('locking a theme', 'setLocked', P({}, {}), { locked: true }, E.setLocked(P({}, {}), true, now0, 'dev1'));
act('unlocking restarts the clock', 'setLocked', P({ locked: true }, {}), { locked: false }, E.setLocked(P({ locked: true }, {}), false, now0, 'dev1'));
act('reset to the default theme', 'reset', P({ themeId: 'orchid', locked: true }, {}), {}, E.reset(now0, 'dev1'));
// untrusted documents come out valid
add({ name: 'a broken document is repaired', op: 'normalize', input: { themeId: 'nope', appearance: 'purple', seq: -5, locked: 'yes', rotation: { enabled: 1, frequency: 'hourly', order: 'shuffle', time: '25:99', weekday: 9, dayOfMonth: 0 } }, expect: plain(E.normalize({ themeId: 'nope', appearance: 'purple', seq: -5, locked: 'yes', rotation: { enabled: 1, frequency: 'hourly', order: 'shuffle', time: '25:99', weekday: 9, dayOfMonth: 0 } })) });

export const file = { about: 'Generated by contract/build-vectors.mjs from theme-engine.js. Do not edit. Android runs every case against its Kotlin port.', count: vectors.length, vectors };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { fs.writeFileSync(path.join(dir, 'theme-vectors.json'), JSON.stringify(file, null, 1) + '\n'); console.log(`theme-vectors.json written: ${vectors.length} cases`); }
