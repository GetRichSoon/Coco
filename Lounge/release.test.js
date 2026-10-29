// Run: node release.test.js
//
// One Coco version, four clients. This is the thing that keeps them together: if anyone bumps a
// number in one place and forgets the others, this fails, and the drift is caught here rather than
// by a founder noticing their phone says something different from their laptop.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rel = JSON.parse(read('Lounge/release.json'));

assert.ok(/^\d+\.\d+\.\d+$/.test(rel.version), `the Coco version must look like 1.2.3, got ${rel.version}`);
assert.strictEqual(rel.name, `Coco ${rel.version}`, 'the display name must carry the same version');

// the company's own package follows the unified line
assert.strictEqual(JSON.parse(read('package.json')).version, rel.version, 'package.json is on a different Coco version');

// the desktop keeps its own installer build number, but must say which Coco it is
const desk = JSON.parse(read('Lounge Desktop/package.json'));
assert.strictEqual(desk.coco, rel.version, 'the desktop app reports a different Coco version');
assert.strictEqual(desk.version, rel.builds.desktop, 'the desktop build number disagrees with release.json');

// versionName is what a person reads in Android settings, so it is the Coco version
const gradle = read('Lounge Android/app/build.gradle.kts');
const name = gradle.match(/versionName = "([^"]+)"/)[1];
const code = Number(gradle.match(/versionCode = (\d+)/)[1]);
assert.strictEqual(name, rel.version, 'the phone shows a different Coco version');
assert.strictEqual(code, rel.builds.android.versionCode, 'the Android build number disagrees with release.json');
assert.strictEqual(rel.builds.android.versionName, rel.version, 'release.json contradicts itself about Android');

// The whole release history, append-only. It is kept here because while it lived only in git commits,
// versionCode 16 was handed to 2.8.2 and then to 2.9.0, and the phones' own updater skips anything at or
// below the code they run - so the 2.9.0 phone build could never have reached a founder.
assert.ok(Array.isArray(rel.history) && rel.history.length >= 15, `the release history must keep all 15 entries, found ${(rel.history || []).length}`);
const spent = rel.history.filter((h) => h.version !== rel.version).map((h) => h.versionCode);
assert.ok(!spent.includes(code), `versionCode ${code} was already used by ${(rel.history.find((h) => h.versionCode === code) || {}).version}; a spent code can never be reused`);
assert.ok(code > Math.max(...spent), `the Android build number must be higher than every one before it (highest so far ${Math.max(...spent)})`);
const mine = rel.history.find((h) => h.version === rel.version);
assert.ok(mine && mine.versionCode === code, 'the history entry for this release disagrees with build.gradle.kts');

// the canonical identity every client resolves, and the floor below which one must update before use
assert.strictEqual(rel.release_id, `coco-${rel.version}`, 'the release id must be coco-<version>');
assert.ok(/^\d+\.\d+\.\d+$/.test(rel.minimum), 'the release must state a minimum supported version');

// Both artifacts or it is not released. A half release told two of the four clients they were current.
assert.ok(['blocked', 'ready', 'released'].includes(rel.status), 'status must be blocked, ready or released');
const plat = rel.platforms || {};
assert.ok(plat.desktop && plat.android, 'the release must say where each platform stands');
if (rel.status === 'released') for (const [k, p] of Object.entries(plat)) assert.strictEqual(p.state, 'shipped', `${k} is ${p.state}, so this release is not released`);

// the version a client reports must come from this file, never be typed into the app
assert.ok(!/app_version: '[a-z]+-\d/.test(read('Lounge/index.html')), 'the Lounge is reporting a hardcoded version again');

// the Lounge has to be able to read it: it is served from the Lounge folder, next to index.html
assert.ok(fs.existsSync(path.join(here, 'release.json')), 'release.json must sit where the web app can fetch it');
assert.ok(read('Lounge/index.html').includes("fetch('release.json'"), 'the Lounge does not read the release file');

// rollback has to say honestly what it can and cannot do
assert.ok(rel.rollback && rel.rollback.desktop && rel.rollback.android, 'rollback must state both clients');
assert.ok(/blocked|signing/i.test(rel.rollback.android), 'Android rollback must not claim to work while signing is missing');

console.log(`release: Coco ${rel.version} · desktop build ${desk.version} · android ${name} (${code}) — all agree`);
