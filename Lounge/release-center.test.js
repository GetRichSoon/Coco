// Run: node release-center.test.js
//
// The Release Center answers one question - is every one of the four devices actually on the latest
// Coco - and it has to answer it from what each device itself reported. On 29 October the dashboard
// showed a version no desktop was running, because the number was typed into the page instead of
// read. So this drives the real releaseDevices() lifted out of index.html, with made-up devices.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const from = src.indexOf('const devVersion =');
assert.ok(from > 0, 'devVersion found in index.html');
const end = src.indexOf('\n};', src.indexOf('const releaseDevices =', from));
assert.ok(end > from, 'releaseDevices block found in index.html');
const block = src.slice(from, end + 3);

const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - 10 * 60 * 1000).toISOString();

// everything the block leans on, supplied exactly as index.html defines it
const build = (D, RELEASE, CLOUD_RELEASE) => new Function('D', 'RELEASE', 'CLOUD_RELEASE', 'esc', 'online', 'ago',
  block + '; return releaseDevices;')(D, RELEASE, CLOUD_RELEASE,
    (x) => String(x == null ? '' : x),
    (d) => d.last_seen && (Date.now() - new Date(d.last_seen)) < 150000,
    () => 'just now');

const devices = [
  { id: 'mangesh-pc', name: 'Boss PC', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: fresh() },
  { id: 'shreya-pc', name: 'Big Boss PC', kind: 'pc', app_version: 'lounge-2', last_seen: fresh() },
  { id: 'mangesh-phone', name: 'Boss phone', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh() },
  { id: 'shreya-phone', name: 'Big Boss phone', kind: 'phone', app_version: 'android-2.8.1', last_seen: stale() },
];
// mirrors the real row on 29 October: the desktop half done, the Android half not built yet
const rel = { release_id: 'coco-2.9.0', version: '2.9.0', status: 'blocked',
  desktop_artifact: 'git main', desktop_sha256: 'deadbeef', android_version_code: 17 };

// today's real situation: one desktop current, one behind, one phone behind, one phone not reporting
let html = build({ devices }, { version: '2.9.0' }, rel)();
assert.ok(/Boss PC[\s\S]*?2\.9\.0/.test(html), 'the current desktop shows its version');
assert.ok(html.includes('Coco 2.9.0'), 'the release being aimed at is named, large');
assert.ok(html.includes('UPDATED'), 'a device on the latest reads UPDATED');
assert.ok(html.includes('UPDATE REQUIRED'), 'a device behind reads UPDATE REQUIRED');
assert.ok(html.includes('OFFLINE'), 'a device that stopped reporting reads OFFLINE, not UPDATED');
assert.ok(html.includes('1/4 devices updated'), 'it counts the devices actually on the release');
assert.ok(html.includes('cloud release coco-2.9.0, blocked'), 'it names the cloud release and its status');
assert.ok(html.includes('no Android build'), 'it says which half of the release is missing');

// a device that is offline must never be called updated, whatever version it last reported
const offlineOnLatest = [{ id: 'x', name: 'Asleep', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: stale() }];
html = build({ devices: offlineOnLatest }, { version: '2.9.0' }, null)();
assert.ok(html.includes('OFFLINE') && !html.includes('UPDATED'), 'offline beats a stale version match');
assert.ok(html.includes('0/1 devices updated'), 'an offline device is not counted as updated');

// the cloud wins over release.json when the two disagree
html = build({ devices }, { version: '2.9.0' }, { release_id: 'coco-3.0.0', version: '3.0.0', status: 'published' })();
assert.ok(html.includes('Coco 3.0.0') && (html.match(/3\.0\.0/g) || []).length > 4, 'the cloud release is the Latest every device is measured against');
assert.ok(html.includes('0/4 devices updated'), 'with a newer cloud release no device is updated');

// a device mid-update shows what it is doing rather than a guess
const updating = [{ id: 'y', name: 'Busy', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh(), update_state: 'downloading' }];
html = build({ devices: updating }, { version: '2.9.0' }, null)();
assert.ok(html.includes('DOWNLOADING'), 'a reported update state is shown instead of UPDATE REQUIRED');

// no release anywhere: say so rather than invent one
html = build({ devices }, null, null)();
assert.ok(html.includes('nothing to compare against'), 'with no release it says so');

// all four agreeing is the state we are aiming at
const allGood = devices.map((d) => ({ ...d, app_version: (d.kind === 'pc' ? 'desktop-' : 'android-') + '2.9.0', last_seen: fresh() }));
html = build({ devices: allGood }, { version: '2.9.0' }, null)();
assert.ok(html.includes('4/4 devices updated') && !html.includes('UPDATE REQUIRED'), 'all four on the same release reads cleanly');

// A platform that refuses the update must say so. 2.9.0 is the first Android build signed with the real
// release key, and Android will not install it over a debug-signed one, so both phones need one manual
// reinstall. A phone left reading "update available" forever, with no reason, is the lie being fixed.
const step = 'Uninstall Coco Lounge once, then install 2.9.0 from the link: the signing key changed.';
html = build({ devices }, { version: '2.9.0' }, { ...rel, manual_step: step })();
assert.ok(html.includes('NEEDS YOU'), 'a phone that cannot self-update reads NEEDS YOU, not UPDATE REQUIRED');
assert.ok(html.includes(step), 'and the exact reason is shown on the device that is stuck');
assert.ok(/Big Boss PC[\s\S]*?UPDATE REQUIRED/.test(html), 'a desktop still updates itself, so it keeps UPDATE REQUIRED');

// The cloud writes UPDATE_REQUIRED and UPDATED on the device row itself, and this screen shows what it
// was told rather than working it out again. The one exception is OFFLINE: a device that has stopped
// reporting cannot report that it has stopped reporting, so silence is read here and it outranks
// whatever the row still says - including UPDATED.
const reported = (st, ver, seen) => [{ id: 'z', name: 'Device', kind: 'pc', app_version: 'desktop-' + ver, last_seen: seen, update_state: st }];
for (const [st, shown] of [['CHECKING', 'CHECKING'], ['UPDATE_REQUIRED', 'UPDATE REQUIRED'], ['DOWNLOADING', 'DOWNLOADING'],
  ['VERIFYING', 'VERIFYING'], ['INSTALLING', 'INSTALLING'], ['RESTART_REQUIRED', 'RESTART REQUIRED'],
  ['RECONNECTING', 'RECONNECTING'], ['FAILED', 'FAILED'], ['ROLLED_BACK', 'ROLLED BACK']]) {
  html = build({ devices: reported(st, '2.8.2', fresh()) }, { version: '2.9.0' }, rel)();
  assert.ok(html.includes(shown), `the cloud's ${st} is shown as ${shown}`);
}
// the lowercase vocabulary written earlier the same day still reads correctly rather than blankly
html = build({ devices: reported('update_available', '2.8.2', fresh()) }, { version: '2.9.0' }, rel)();
assert.ok(html.includes('UPDATE REQUIRED'), 'the older update_available still reads as UPDATE REQUIRED');

// a row still saying UPDATED, from a device that has gone quiet, must not keep reading UPDATED
html = build({ devices: reported('UPDATED', '2.9.0', stale()) }, { version: '2.9.0' }, rel)();
assert.ok(html.includes('OFFLINE') && !html.includes('UPDATED'), 'silence outranks a stored UPDATED');

// the six columns the founder asked for, in order
html = build({ devices }, { version: '2.9.0' }, rel)();
for (const h of ['Device', 'Platform', 'Installed', 'Latest', 'Status', 'Last seen']) {
  assert.ok(html.includes('>' + h + '<'), 'the table has a ' + h + ' column');
}
// platform comes from the device's own row when it has one, not from a guess about its kind
html = build({ devices: [{ id: 'q', name: 'Tablet', kind: 'phone', platform: 'android', app_version: 'android-2.9.0', last_seen: fresh() }] }, { version: '2.9.0' }, rel)();
assert.ok(html.includes('android'), 'the reported platform is used');

console.log('release center: 4 devices, versions read from their own heartbeats, cloud release wins, platform blocks named — all checks pass');
