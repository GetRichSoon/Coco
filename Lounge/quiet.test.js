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
function device({ hidden = true, awake = { ok: true, warm: false }, at = 10 * SLOT + 1000 } = {}) {
  const clock = { t: at }, ran = [], beats = { n: 0 }, doc = { hidden }, net = { awake, calls: 0 };
  const FakeDate = { now: () => clock.t };
  const fetch = async () => { net.calls++; if (net.awake === 'down') throw new Error('offline'); return { ok: net.awake.ok, status: net.awake.ok ? 200 : 404, json: async () => ({ warm: net.awake.warm }) }; };
  const reader = (name) => async () => { ran.push(name); };
  const api = new Function('NOVA', 'document', 'fetch', 'window', 'Date', 'heartbeat', 'pollChanges', 'pollApprovals', 'runMyCommands', 'healQueue', 'pushLive',
    block + '; return { quiet, sleeping, quietSend, quietTick, wake, slotOf: quietSlotOf };')(
    'https://nova.example', doc, fetch, { cocoDesktop: { beat: () => beats.n++, liveSnapshot: () => ({}) } }, FakeDate,
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
assert.equal(d.api.sleeping(), true, 'the timers skip their reads'); assert.deepEqual(d.ran, [], 'the slot the page opened in is not read twice');
assert.equal(d.beats.n, 1, 'Nova answered, so the desktop watchdog hears a beat and does not reload the page');
d.clock.t = 11 * SLOT + 5000; await d.api.quietTick();
assert.deepEqual(d.ran.sort(), ['approvals', 'changes', 'commands', 'heartbeat', 'live', 'sweep'], 'a new slot runs every reader once, together');
d.ran.length = 0; d.clock.t += 60e3; await d.api.quietTick();
assert.deepEqual(d.ran, [], 'and not again in the same slot');

// 3. quiet but the database is awake anyway (a founder or a cloud job is using it): the normal timers may read
d = device({ awake: { ok: true, warm: true } });
await d.api.quietTick();
assert.equal(d.api.sleeping(), false); assert.deepEqual(d.ran, [], 'the timers read, the tick itself adds nothing');
assert.equal(d.api.quietSend(), true, 'those reads carry x-coco-quiet so they never keep the database awake themselves');

// 4. an older Nova without /api/awake: slot reads only, and the header is never sent (that Nova would refuse it in CORS)
d = device({ awake: { ok: false } });
await d.api.quietTick();
assert.equal(d.api.sleeping(), true); assert.equal(d.api.quietSend(), false); assert.equal(d.beats.n, 1, 'a 404 still proves the page is connected');
d.net.awake = 'down'; d.clock.t = 11 * SLOT; await d.api.quietTick();
assert.equal(d.beats.n, 1, 'no answer at all is no beat: the watchdog may reload a page that lost its link');

// 5. coming back reads at once
d = device(); await d.api.quietTick(); d.doc.hidden = false; d.api.wake(true);
assert.deepEqual(d.ran.sort(), ['changes', 'heartbeat']); assert.equal(d.api.sleeping(), false);

// 6. devices that opened at different moments share the same slot boundaries (one wake-up for all of them)
assert.equal(d.api.slotOf(10 * SLOT + 1), d.api.slotOf(11 * SLOT - 1)); assert.notEqual(d.api.slotOf(11 * SLOT - 1), d.api.slotOf(11 * SLOT));

// 7. every periodic reader in boot() and listen() is gated; none is scheduled bare any more
for (const g of ['if (!sleeping()) heartbeat();', 'if (sleeping()) return; if ((!isLive', 'if (!sleeping()) healQueue();', 'if (!sleeping()) pushLive();', 'if (sleeping()) return; if (!document.hidden || Date.now() - lastPoll > 60000) pollChanges();', 'if (!sleeping()) runMyCommands();', 'setInterval(quietTick, 30000)'])
  assert.ok(src.includes(g), `missing gate: ${g}`);
for (const bare of ['setInterval(heartbeat,', 'setInterval(healQueue,', 'setInterval(pushLive,', 'setInterval(runMyCommands, 5000); return;'])
  assert.ok(!src.includes(bare), `an ungated reader is back: ${bare}`);
assert.ok(/fetch: quietFetch/.test(src) && /const novaFetch = \(path, init = \{\}\) => quietFetch\(/.test(src), 'both ways to Nova carry the quiet header');

console.log('quiet.test: ok (screens in use unchanged, quiet reads only while awake or once per shared 30-minute slot, older Nova safe, every timer gated)');
