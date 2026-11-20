// Run: node quiet.test.js
//
// Neon Free plan (YES-3). The database suspends after 5 idle minutes and the plan pays for 100 compute-hours
// a month; every app reader that touched it more often kept it awake all day. A screen in use keeps its
// cadence; a quiet one (hidden, or untouched for 10 minutes) reads only while the database is awake anyway
// or once per shared 30-minute wall-clock slot. These checks pin that, and that every timer obeys it.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
const from = src.indexOf('// ---------- Neon Free plan (YES-3)');
const to = src.indexOf('let novaVersion = null', from);
assert.ok(from > 0 && to > from, 'the quiet block was found in index.html');
const block = src.slice(from, to);

const SLOT = 30 * 60e3;
function device({ hidden = true, awake = { ok: true, warm: false }, at = 10 * SLOT + 1000, kept = {} } = {}) {
  const clock = { t: at }, ran = [], beats = { n: 0 }, doc = { hidden }, net = { awake, calls: 0, urls: [] };
  const FakeDate = { now: () => clock.t, parse: (s) => Date.parse(s) };
  const fetch = async (u) => { net.calls++; net.urls.push(u); if (net.awake === 'down') throw new Error('offline'); const status = net.awake.status || (net.awake.ok ? 200 : 404);
    return { ok: status < 300, status, json: async () => (net.awake.body || { warm: net.awake.warm, mail_at: net.awake.mail_at || null, now: new Date(clock.t).toISOString() }) }; };
  const store = { get: (k) => (k in kept ? kept[k] : null), set: (k, v) => { kept[k] = v; } };   // localStorage: survives a reload of the page
  const reader = (name) => async () => { ran.push(name); };
  const api = new Function('NOVA', 'document', 'fetch', 'window', 'Date', 'store', 'deviceId', 'heartbeat', 'pollChanges', 'pollApprovals', 'runMyCommands', 'healQueue', 'pushLive',
    block + '; return { quiet, sleeping, quietSend, quietTick, wake, noteAlive, slotOf: quietSlotOf, get aliveSince() { return aliveSince; } };')(
    'https://nova.example', doc, fetch, { cocoDesktop: { beat: () => beats.n++, liveSnapshot: () => ({}) } }, FakeDate, store, 'boss-pc',
    reader('heartbeat'), reader('changes'), reader('approvals'), reader('commands'), reader('sweep'), reader('live'));
  return { api, clock, ran, beats, doc, net };
}

// 1. a screen in use is never quiet and never asks Nova anything extra
let d = device({ hidden: false });
assert.equal(d.api.quiet(), false); await d.api.quietTick();
assert.equal(d.net.calls, 0, 'a screen in use does not ping /api/awake'); assert.equal(d.api.sleeping(), false);
d.clock.t += 11 * 60e3; assert.equal(d.api.quiet(), true, 'untouched for 10 minutes is quiet even on screen');

// 2. quiet and the database asleep: nothing reads until the next shared slot
d = device();
await d.api.quietTick();
assert.equal(d.api.sleeping(), true, 'the timers skip their reads'); assert.deepEqual(d.ran, ['heartbeat'], 'one beat says "resting"; the slot the page opened in is not read twice');
assert.match(d.net.urls[0], /\/api\/awake\?d=boss-pc$/, 'the ping names this device, so Nova can say a command waits for it');
d.ran.length = 0; d.clock.t += 30e3; await d.api.quietTick(); assert.deepEqual(d.ran, [], 'resting is said once, not every tick');
assert.equal(d.beats.n, 2, 'Nova answered both pings, so the desktop watchdog hears a beat each time and does not reload the page');
d.clock.t = 11 * SLOT + 5000; await d.api.quietTick();
assert.deepEqual(d.ran.sort(), ['approvals', 'changes', 'commands', 'heartbeat', 'live', 'sweep'], 'a new slot runs every reader once, together');
d.ran.length = 0; d.clock.t += 60e3; await d.api.quietTick();
assert.deepEqual(d.ran, [], 'and not again in the same slot');

// 3. quiet but the database is awake anyway (a founder or a cloud job is using it): the normal timers may read
d = device({ awake: { ok: true, warm: true } });
await d.api.quietTick();
assert.equal(d.api.sleeping(), false); assert.deepEqual(d.ran, ['heartbeat'], 'the timers read, the tick itself adds only the one "resting" beat');
assert.equal(d.api.quietSend(), true, 'those reads carry x-coco-quiet so they never keep the database awake themselves');

// 4. an older Nova without /api/awake: slot reads only, and the header is never sent (that Nova would refuse it in CORS)
d = device({ awake: { ok: false } });
await d.api.quietTick();
assert.equal(d.api.sleeping(), true); assert.equal(d.api.quietSend(), false); assert.equal(d.beats.n, 1, 'a 404 still proves the page is connected');
d.clock.t += 60e3; await d.api.quietTick();
assert.equal(d.net.calls, 1, 'that Nova is not asked again'); assert.equal(d.beats.n, 2, 'the page still ticks, so the watchdog still hears it');
d = device({ awake: { ok: true, warm: false } }); await d.api.quietTick(); d.net.awake = 'down'; d.clock.t += 60e3; await d.api.quietTick();
assert.equal(d.beats.n, 1, 'no answer at all is no beat: the watchdog may reload a page that lost its link');

// 4b. old Nova without /api/awake: at most 1 ping per 6 hours (production c2d52a0 answers 401 'no device key'; a 200 of another shape
// counts the same), across page reloads, and the slot reads go on exactly as before
for (const old of [{ status: 401 }, { status: 404 }, { status: 200, body: { ok: true } }]) {
  const kept = {};
  d = device({ awake: old, at: 20 * SLOT + 5000, kept }); const s0 = d.clock.t;
  for (; d.clock.t < s0 + 24 * 3600e3; d.clock.t += 60e3) await d.api.quietTick();
  assert.equal(d.net.calls, 4, `old Nova (${JSON.stringify(old)}): 4 pings a day, one per 6 hours`);
  assert.equal(d.ran.filter((x) => x === 'changes').length, 47, 'the shared slot reads are unchanged');
  assert.equal(d.api.quietSend(), false, 'and the quiet header is never sent to it');
  const again = device({ awake: old, at: s0 + 20 * 3600e3, kept });   // reloaded 2 h after the last ping await again.api.quietTick();
  assert.equal(again.net.calls, 0, 'a reloaded page remembers that this Nova has no wake board');
}

// 4c. a Nova with the wake board that stops answering: after 10 failed pings in a row, one every 5 minutes; an answer resets it
d = device(); d.net.awake = 'down';
for (let i = 0; i < 10; i++) { await d.api.quietTick(); d.clock.t += 60e3; }
assert.equal(d.net.calls, 10);
for (let i = 0; i < 4; i++) { await d.api.quietTick(); d.clock.t += 60e3; }
assert.equal(d.net.calls, 10, 'backing off: nothing in the next 4 minutes');
await d.api.quietTick(); assert.equal(d.net.calls, 11, 'then one ping 5 minutes after the last');
d.net.awake = { status: 503 }; d.clock.t += 5 * 60e3; await d.api.quietTick(); assert.equal(d.net.calls, 12, 'a 5xx is a failure too, not an older Nova');
d.net.awake = { ok: true, warm: false }; d.clock.t += 5 * 60e3; await d.api.quietTick(); d.clock.t += 60e3; await d.api.quietTick();
assert.equal(d.net.calls, 14, 'answering again: back to one a minute');

// 5. coming back reads at once
d = device(); await d.api.quietTick(); d.ran.length = 0; d.doc.hidden = false; d.api.wake(true);
assert.deepEqual(d.ran.sort(), ['changes', 'heartbeat']); assert.equal(d.api.sleeping(), false);

// 5b. a command waits for this device (Nova's wake board): the queue is read at once, even while the database sleeps; once per command
d = device(); await d.api.quietTick(); d.ran.length = 0;
d.net.awake = { ok: true, warm: false, mail_at: new Date(d.clock.t - 3 * 3600e3).toISOString() }; d.clock.t += 30e3; await d.api.quietTick();
assert.deepEqual(d.ran, [], 'mail from before this page started is old: the start-up read covered it');
d.net.awake = { ok: true, warm: false, mail_at: new Date(d.clock.t + 1000).toISOString() }; d.clock.t += 30e3; await d.api.quietTick();
assert.deepEqual(d.ran, ['commands'], 'new mail: the commands are read now, nothing else');
d.clock.t += 30e3; await d.api.quietTick(); assert.deepEqual(d.ran, ['commands'], 'the same mail is not read twice');
d = device(); d.net.awake = { ok: true, warm: false, mail_at: new Date(d.clock.t - 60e3).toISOString() }; await d.api.quietTick();
assert.ok(d.ran.includes('commands'), 'mail a minute old at the first ping (sent while this page was starting) is read');

// 5c. a system sleep is a gap: commands sent before it are judged with the safety limits (heal.js runVerdict)
d = device(); const born = d.api.aliveSince; d.clock.t += 30e3; d.api.noteAlive(); assert.equal(d.api.aliveSince, born, 'ticks 30 s apart: still alive since start');
d.clock.t += 40 * 60e3; d.api.noteAlive(); assert.equal(d.api.aliveSince, d.clock.t, 'a 40-minute gap: alive only since now');

// 5d. budget: a day behind something with the database asleep and no command: 48 slot reads, no more, and 48 + 1 beats
d = device({ at: 20 * SLOT + 5000 }); const t0 = d.clock.t;
for (; d.clock.t < t0 + 24 * 3600e3; d.clock.t += 60e3) await d.api.quietTick();
const runs = (n) => d.ran.filter((x) => x === n).length;
assert.equal(runs('changes'), 47, 'one read per new shared slot: 47 in the 24 h after the start-up read, 48 a day'); assert.equal(runs('commands'), 47); assert.equal(runs('heartbeat'), 48, '47 slot beats and the one "resting" beat');
assert.equal(d.net.calls, 1440, 'one database-free ping a minute (2880 at the old 30 s)');

// 6. devices that opened at different moments share the same slot boundaries (one wake-up for all of them)
assert.equal(d.api.slotOf(10 * SLOT + 1), d.api.slotOf(11 * SLOT - 1)); assert.notEqual(d.api.slotOf(11 * SLOT - 1), d.api.slotOf(11 * SLOT));

// 7. every periodic reader in boot() and listen() is gated; none is scheduled bare any more
for (const g of ['if (!sleeping()) heartbeat();', 'if (sleeping()) return; if ((!isLive', 'if (!sleeping()) healQueue();', 'if (!sleeping()) pushLive();', 'if (sleeping()) return; if (!document.hidden || Date.now() - lastPoll > 60000) pollChanges();', 'if (!sleeping()) runMyCommands();', 'setTimeout(() => quietTick().finally(next), AWAKE_EVERY_MS * (0.9 + Math.random() * 0.2))'])
  assert.ok(src.includes(g), `missing gate: ${g}`);
for (const bare of ['setInterval(heartbeat,', 'setInterval(healQueue,', 'setInterval(pushLive,', 'setInterval(runMyCommands, 5000); return;'])
  assert.ok(!src.includes(bare), `an ungated reader is back: ${bare}`);
assert.ok(/fetch: quietFetch/.test(src) && /const novaFetch = \(path, init = \{\}\) => quietFetch\(/.test(src), 'both ways to Nova carry the quiet header');

console.log('quiet.test: ok (screens in use unchanged, quiet reads only while awake or once per shared 30-minute slot, older Nova asked at most once per 6 h, failures back off to 5 min, every timer gated)');
