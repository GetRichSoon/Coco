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
const build = (D, RELEASE, CLOUD_RELEASE) => new Function('D', 'RELEASE', 'CLOUD_RELEASE', 'esc', 'online',
  block + '; return releaseDevices;')(D, RELEASE, CLOUD_RELEASE,
    (x) => String(x == null ? '' : x),
    (d) => d.last_seen && (Date.now() - new Date(d.last_seen)) < 150000);

const devices = [
  { id: 'mangesh-pc', name: 'Boss PC', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: fresh() },
  { id: 'shreya-pc', name: 'Big Boss PC', kind: 'pc', app_version: 'lounge-2', last_seen: fresh() },
  { id: 'mangesh-phone', name: 'Boss phone', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh() },
  { id: 'shreya-phone', name: 'Big Boss phone', kind: 'phone', app_version: 'android-2.8.1', last_seen: stale() },
];

// today's real situation: one desktop current, one behind, one phone behind, one phone not reporting
let html = build({ devices }, { version: '2.9.0' }, { release_id: 'coco-2.9.0', version: '2.9.0', status: 'blocked' })();
assert.ok(/Boss PC[\s\S]*?2\.9\.0/.test(html), 'the current desktop shows its version');
assert.ok(html.includes('Updated'), 'a device on the latest reads Updated');
assert.ok(html.includes('Update available'), 'a device behind reads Update available');
assert.ok(html.includes('Offline'), 'a device that stopped reporting reads Offline, not Updated');
assert.ok(html.includes('3 of 4 not yet on 2.9.0'), 'it counts how many are behind, including the offline one');
assert.ok(html.includes('cloud release coco-2.9.0, blocked'), 'it names the cloud release and its status');

// a device that is offline must never be called updated, whatever version it last reported
const offlineOnLatest = [{ id: 'x', name: 'Asleep', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: stale() }];
html = build({ devices: offlineOnLatest }, { version: '2.9.0' }, null)();
assert.ok(html.includes('Offline') && !html.includes('Updated'), 'offline beats a stale version match');

// the cloud wins over release.json when the two disagree
html = build({ devices }, { version: '2.9.0' }, { release_id: 'coco-3.0.0', version: '3.0.0', status: 'published' })();
assert.ok(html.includes('/ 3.0.0'), 'the cloud release is what devices are measured against');
assert.ok(html.includes('4 of 4 not yet on 3.0.0'), 'with a newer cloud release every device is behind');

// a device mid-update shows what it is doing rather than a guess
const updating = [{ id: 'y', name: 'Busy', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh(), update_state: 'downloading' }];
html = build({ devices: updating }, { version: '2.9.0' }, null)();
assert.ok(html.includes('downloading'), 'a reported update state is shown instead of Update available');

// no release anywhere: say so rather than invent one
html = build({ devices }, null, null)();
assert.ok(html.includes('no release to compare against'), 'with no release it says so');

// all four agreeing is the state we are aiming at
const allGood = devices.map((d) => ({ ...d, app_version: (d.kind === 'pc' ? 'desktop-' : 'android-') + '2.9.0', last_seen: fresh() }));
html = build({ devices: allGood }, { version: '2.9.0' }, null)();
assert.ok(html.includes('all 4 on 2.9.0') && !html.includes('Update available'), 'all four on the same release reads cleanly');

console.log('release center: 4 devices, versions read from their own heartbeats, cloud release wins — all checks pass');
