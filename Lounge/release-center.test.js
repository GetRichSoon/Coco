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
const build = (D, RELEASE, CLOUD_RELEASE, audit = null, auditErr = false) => new Function('D', 'RELEASE', 'CLOUD_RELEASE', 'SYNC_AUDIT', 'SYNC_AUDIT_ERR', 'SYNC_AT', 'sb', 'page', 'render', 'esc', 'online', 'ago',
  block + '; return releaseDevices;')(D, RELEASE, CLOUD_RELEASE, audit, auditErr, Date.now(), null, 'control', () => {},
    (x) => String(x == null ? '' : x),
    (d) => d.last_seen && (Date.now() - new Date(d.last_seen)) < 150000,
    () => 'just now');

const devices = [
  { id: 'boss-pc', name: 'Boss PC', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: fresh() },
  { id: 'bigboss-pc', name: 'Big Boss PC', kind: 'pc', app_version: 'lounge-2', last_seen: fresh() },
  { id: 'boss-phone', name: 'Boss phone', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh() },
  { id: 'bigboss-phone', name: 'Big Boss phone', kind: 'phone', app_version: 'android-2.8.1', last_seen: stale() },
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

// ---- Sync monitor panel: real audit row in, real numbers out; no row, no numbers; generic labels only ----
{
  { const mod = { exports: {} }; new Function('module', fs.readFileSync(path.join(here, 'device-sync.js'), 'utf8')).call({}, mod); globalThis.window = { CocoDeviceSync: mod.exports }; }   // the page loads the same file with a script tag
  const none = build({ devices }, { version: '2.10.0' }, null)(); assert.ok(/Sync monitor/.test(none) && /No sync cycle has been recorded yet/.test(none), 'no audit row: says so, shows no numbers');
  const noTable = build({ devices }, { version: '2.10.0' }, null, null, true)(); assert.ok(/Audit storage is not set up yet/.test(noTable), 'missing audit storage is named');
  const now = Date.now(), audit = { at: new Date(now - 4 * 60000).toISOString(), next_check_at: new Date(now + 11 * 60000).toISOString(), current_count: 3, total: 4, calls_total: 6, budget_ok: true, stale: false,
    state: { lastCycleAt: now - 4 * 60000 }, devices: [{ label: 'Boss PC', status: 'CURRENT', local: '2.10.0', server: '2.10.0', lastSync: now - 4 * 60000, fails: 0 },
      { label: 'Boss Phone', status: 'ERROR', local: '2.9.2', server: '2.10.0', lastSync: null, lastError: 'install: too many sessions', fails: 2, nextTry: now + 30 * 60000 },
      { label: 'Big Boss PC', status: 'OFFLINE', local: '2.9.0', server: '2.10.0', lastSync: null, fails: 0 }, { label: 'Big Boss Phone', status: 'CURRENT', local: '2.10.0', server: '2.10.0', lastSync: now - 4 * 60000, fails: 0 }] };
  const h = build({ devices }, { version: '2.10.0' }, null, audit)();
  assert.ok(/<b>3\/4<\/b> devices verified current/.test(h), 'verified count comes from the audit row'); assert.ok(/<b>6<\/b> of 7 calls last cycle/.test(h) && /within budget/.test(h), 'actual calls vs the cycle budget');
  assert.ok(/failed updates: 1/.test(h) && /retry attempts so far: 2/.test(h), 'failed updates and recovery attempts are counted from the rows'); assert.ok(/Scheduler: healthy/.test(h));
  assert.ok(/install: too many sessions/.test(h) && /never verified/.test(h), 'the real failure and an honest "never verified"');
  const stalled = build({ devices }, { version: '2.10.0' }, null, { ...audit, state: { lastCycleAt: now - 50 * 60000 } })(); assert.ok(/scheduler stalled/.test(stalled), 'a stalled scheduler is shown, not hidden');
  const over = build({ devices }, { version: '2.10.0' }, null, { ...audit, calls_total: 9, budget_ok: false })(); assert.ok(/OVER BUDGET/.test(over));
  // privacy: legacy names on the device rows never reach the screen, only the generic labels
  const legacy = [{ id: 'a', kind: 'pc', name: ['Boss PC (', 'Len', 'ovo)'].join(''), app_version: 'desktop-2.10.0', last_seen: fresh() }, { id: 'b', kind: 'phone', name: [['mange', 'sh'].join('').slice(0,1).toUpperCase() + ['mange', 'sh'].join('').slice(1), "'s phone"].join(''), app_version: 'android-2.9.2', last_seen: fresh() }];
  const lh = build({ devices: legacy }, { version: '2.10.0' }, null)(); assert.ok(!new RegExp(['mange', 'sh'].join('') + '|' + ['shre', 'ya'].join(''), 'i').test(lh), 'no personal name on the Release Center'); assert.ok(/Boss PC/.test(lh));
  console.log('sync monitor panel: 11 checks passed');
}
console.log('release center: 4 devices, versions read from their own heartbeats, cloud release wins, platform blocks named — all checks pass');
