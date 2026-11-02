// Run: node live-loop.test.js
//
// The live link must never become a loop that reads the whole company. Measured 2026-11-01: one desktop
// read all 31 tables every 2 seconds (59,439 requests in one hour) because the channel subscribed to
// tables that are not in the realtime publication, the server acknowledged and then failed the join,
// and every acknowledgement ran loadAll() and reset the reconnect backoff to 2 s. These checks pin
// the three things that stop it.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');
const block = src.slice(src.indexOf('function connectLive()'), src.indexOf('function listen()'));
assert.ok(block.length > 200, 'connectLive was found');

// 1. only published tables are subscribed (approvals, devices, pulse, task_notes, tasks)
const published = new Set(['approvals', 'devices', 'pulse', 'task_notes', 'tasks']);
const subscribed = [...block.matchAll(/table: '([a-z_]+)'/g)].map((m) => m[1]);
assert.ok(subscribed.length >= 2, 'the channel subscribes to something');
for (const t of subscribed) assert.ok(published.has(t), `${t} is not in the realtime publication: subscribing to it makes the join fail and the client loop`);

// 2. a subscribe does not read the whole company unconditionally, and the backoff is not reset on the spot
const sub = block.slice(block.indexOf("'SUBSCRIBED'"), block.indexOf("'SUBSCRIBED'") + 400);
assert.ok(!/SUBSCRIBED'\) \{ tries = 0;/.test(sub), 'the backoff is not reset the moment the channel joins');
assert.ok(/stableTimer = setTimeout/.test(sub) && /tries = 0/.test(sub), 'the backoff resets only after the link has stayed up');
assert.ok(/Date\.now\(\) - lastFull > FULL_EVERY\) loadAll\(\)/.test(sub), 'a full read on subscribe happens only when the net is due');
assert.ok(/else refreshFor\(/.test(sub), 'otherwise only the hot slices are read');

// 3. the approvals poll is a fallback: every 15 s only while the link is down, once a minute while it is live
assert.ok(/\(!isLive && !document\.hidden\) \|\| Date\.now\(\) - lastPoll > 60000\) pollApprovals\(\)/.test(src), 'the 15 s approvals poll runs only while the live link is down');

console.log('live-loop.test: ok (published tables only, no full read per subscribe, backoff not reset on join, poll gated on the link)');
