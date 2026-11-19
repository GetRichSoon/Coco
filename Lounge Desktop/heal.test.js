// Run: node heal.test.js   Checks the command auto-heal (Nono, 2026-10-26): error classes from the real failed rows,
// the one smart retry, the queue sweep, the new phrase rules and the update restart-loop guard.
const fs = require('fs'), path = require('path'), assert = require('assert');
const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), page = fs.readFileSync(path.join(__dirname, '..', 'Lounge', 'index.html'), 'utf8');

// classes (real result texts from Coco Cloud)
// heal.js is a browser script (the parent folder is ES-module typed), so load it the way the page does
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'Lounge', 'heal.js'), 'utf8'))(win); const H = win.CocoHeal;
assert.equal(H.classify('Opened chrome'), 'ok');
assert.equal(H.classify('data:image/jpeg;base64,AAAA'), 'ok');
assert.equal(H.classify('Not understood: "hi". Try: kesariya chalao'), 'not_understood');
assert.equal(H.classify('No browser window is open'), 'no_browser');
assert.equal(H.classify('No app called "zzz" on this PC'), 'app_missing');
assert.equal(H.classify('failed: took longer than 30 seconds'), 'timeout');
assert.equal(H.classify('failed: fetch failed'), 'transient');
assert.equal(H.classify('failed: office-mode.exe not found'), 'failed_other');
assert.equal(H.classify(''), 'failed_other');
assert.equal(H.classify('Q is not running'), 'ok', 'closing what is not running is not an error');

// one smart retry, never twice, never for actions that could double
assert.ok(H.canRetry('status', {}, 'timeout'));
assert.ok(!H.canRetry('status', { _retried: 1 }, 'timeout'), 'never a second retry');
assert.ok(!H.canRetry('volume', {}, 'timeout') && !H.canRetry('lock', {}, 'transient') && !H.canRetry('say', {}, 'timeout'), 'unsafe actions are not retried');
assert.ok(H.canRetry('key', { combo: 'ctrl+t' }, 'no_browser'));
assert.deepEqual(H.prep('no_browser').map((s) => s.action), ['open_app', 'wait'], 'browser missing -> open it first');
assert.ok(!H.canRetry('open_app', {}, 'app_missing') && !H.canRetry('say', {}, 'not_understood'), 'unknown classes are reported, not retried');

// age limits: late is fine for harmless, never for lock
assert.equal(H.ageLimitMs('play_youtube'), 120000); assert.equal(H.ageLimitMs('say'), 120000, 'voice intents expire after 2 min');
assert.equal(H.ageLimitMs('lock'), 600000); assert.equal(H.ageLimitMs('status'), 7200000);

// sweep
const now = Date.parse('2026-10-26T12:00:00Z'), ago = (m) => new Date(now - m * 60000).toISOString();
assert.equal(H.sweepVerdict({ status: 'queued', created_at: ago(5), action: 'status' }, now), null, 'fresh queued stays');
assert.match(H.sweepVerdict({ status: 'queued', created_at: ago(40), action: 'lock' }, now, '2026-10-23T09:57:00Z').result, /^stale: target device offline \(last seen 2026-10-23 09:57 UTC\)/);
assert.match(H.sweepVerdict({ status: 'failed', created_at: ago(1500), result: 'Too old' }, now).result, /^stale: Too old/);
assert.equal(H.sweepVerdict({ status: 'failed', created_at: ago(1500), result: 'stale: x' }, now), null, 'already stale: not touched twice');
assert.equal(H.sweepVerdict({ status: 'failed', created_at: ago(60), result: 'x' }, now), null, 'young failures stay visible');
assert.deepEqual(H.sweepVerdict({ status: 'running', created_at: ago(5), action: 'status', args: {} }, now), { status: 'queued', args: { _retried: 1 } }, 'interrupted + safe -> once more');
assert.equal(H.sweepVerdict({ status: 'running', created_at: ago(5), action: 'lock', args: {} }, now).status, 'failed', 'interrupted + unsafe -> closed');
assert.equal(H.sweepVerdict({ status: 'running', created_at: ago(5), action: 'status', args: { _retried: 1 } }, now).status, 'failed', 'second interruption -> closed');

// YES-3 follow-up: a resting device keeps its commands; only a device that missed its promised check-in for 30 min loses them, with the reason
const quietDev = (beatMin) => ({ last_seen: ago(beatMin), info: { presence: H.presenceInfo('quiet', now - beatMin * 60000) } });
assert.equal(H.presence(quietDev(25), now).state, 'resting');
assert.equal(H.sweepVerdict({ status: 'queued', created_at: ago(40), action: 'lock' }, now, quietDev(25)), null, 'queued 40 min for a RESTING PC: it waits');
assert.equal(H.sweepVerdict({ status: 'queued', created_at: ago(80), action: 'lock' }, now, quietDev(60)), null, 'offline 25 min (missed the promise by less than 30): it waits');
assert.match(H.sweepVerdict({ status: 'queued', created_at: ago(120), action: 'lock' }, now, quietDev(90)).result, /^stale: target device offline \(last seen 2026-10-26 10:30 UTC\)/, 'offline over 30 min: closed with the reason');
// the runner: waited only because it rested -> runs (spoken ones never late); sent while asleep -> the safety limit, with the reason
assert.deepEqual(H.runVerdict({ action: 'lock', created_at: ago(25) }, now, now - 3600e3), { run: true, late: true });
assert.match(H.runVerdict({ action: 'say', created_at: ago(25) }, now, now - 3600e3).result, /^expired: arrived 25 min after it was sent; spoken requests are never run late/);
assert.match(H.runVerdict({ action: 'lock', created_at: ago(25) }, now, now - 60000).result, /^expired: this device was off or asleep when it was sent \(25 min ago\); commands older than 10 min/);
assert.deepEqual(H.runVerdict({ action: 'update', created_at: ago(9000) }, now, now), { run: true }, 'an update never expires');
assert.deepEqual(H.runVerdict({ action: 'say', created_at: ago(1) }, now, now), { run: true });
// what the sender sees
assert.equal(H.commandState({ status: 'queued' }, quietDev(1), now).state, 'waiting'); assert.equal(H.commandState({ status: 'running' }, null, now).state, 'acked');
assert.equal(H.commandState({ status: 'failed', result: 'stale: target device offline' }, null, now).state, 'expired'); assert.equal(H.commandState({ status: 'failed', result: 'cancelled: by Boss' }, null, now).state, 'cancelled');
assert.ok(H.isDuplicate({ code: '23505' }) && !H.isDuplicate({ code: '42501' }) && /^[0-9a-f-]{36}$/.test(H.newCommandId()));
for (const s of ['H.runVerdict(c, Date.now(), aliveSince)', 'id: H.newCommandId()', 'H.isDuplicate(error)', "within(sb.from('devices').select('id,last_seen,info')", 'presence: H.presenceInfo(', 'data-cmdcancel']) assert.ok(page.includes(s), 'page has ' + s);

// phrases that failed as "Not understood" in the cloud log now have a rule
const a = main.indexOf('const APP_WORDS'), b = main.indexOf('// ---------- AI planner');
const { plan } = new Function(main.slice(a, b) + '; return { plan };')();
const first = (s) => (plan(s, 'pc')[0] || {}).action;
for (const s of ["I'm bro gana Laga De Bhai koi to YouTube per", 'bhai YouTube per gana Laga De', 'bhai gana laga dena Koi se YouTube per', 'koi motivational gaana bajao yaar!']) assert.equal(first(s), 'play_youtube', s);
for (const s of ['hi', 'hiee pupuuuu', 'hello kya chal raha hai', 'yes']) assert.equal(first(s), 'status', s);
assert.equal(first('Jo screen chal rahi hai na vah dikhao'), 'screenshot');
assert.equal(first('hello open chrome'), 'open_app', 'a greeting never swallows a real command');
assert.equal(plan('kesariya chalao', 'pc')[0].args.q, 'kesariya', 'named songs unchanged');

// Boss 2026-10-26: heal must never replay or create a spoken wish (say / song / media / volume)
for (const a of ['say', 'play_youtube', 'media', 'volume']) {
  assert.ok(!H.RETRY_SAFE.has(a) && !H.canRetry(a, {}, 'timeout') && !H.canRetry(a, {}, 'transient'), a + ' is never retried');
  assert.equal(H.sweepVerdict({ status: 'running', created_at: ago(5), action: a, args: {} }, now).status, 'failed', a + ' interrupted -> closed, never re-queued');
}
const healSrc = page.slice(page.indexOf('async function runMyCommands'), page.indexOf('async function loadAll'));
assert.ok(!/from\('commands'\)\.insert|\.insert\(\{\s*target_device/.test(healSrc), 'the runner and sweeper never insert commands');
assert.ok(!/created_by: 'Nono'/.test(healSrc + main), 'no test payloads in app code. Tests in the cloud use inert text like "[Nono selftest]" via notify, never real utterances');

// the page: watchdog, always-poll, retry, daily note, sweep, report-with-retries
for (const s of ['runStarted > 180000', 'setInterval(runMyCommands, 5000)', 'H.canRetry', 'function needsNono', "'gs-nono-'", 'function healQueue', 'if (!sleeping()) healQueue(); }, 300000)', '|| runningCmds)) continue', 'setTimeout(healQueue, 20000)', 'async function report', "<script src=\"heal.js\">"]) assert.ok(page.includes(s), 'page has ' + s);
assert.ok(!/if \(!isLive\) runMyCommands/.test(page), 'commands no longer depend on the live link');
// update: restart-loop guard
for (const s of ['startHead', 'last-update-restart.txt', '10 * 60 * 1000', 'after === startHead']) assert.ok(main.includes(s), 'update has ' + s);
console.log('heal tests: all passed');
