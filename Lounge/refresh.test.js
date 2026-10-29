// Run: node refresh.test.js
//
// How a change on one device reaches the other three. A pulse row's only payload is the name of the
// table that changed, so most changes do not need the whole company read back - loadAllNow() is
// thirty-one queries and four fetches, and four devices beating every five minutes used to spend
// about fifteen hundred queries an hour on each client redrawing an unchanged screen.
//
// The saving is not the risky part. policies, structure, the two integration tables and releases have
// no pulse trigger of their own yet (migration 0023), so their changes reach the other devices only
// by riding on somebody else's pulse and its full read. Route by topic without a safety net and a
// company stop would stop propagating altogether. These checks exist to make sure that net stays.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const from = src.indexOf('let loading = null, loadAgain = false, lastFull = 0;');
assert.ok(from > 0, 'the refresh block was found in index.html');
const end = src.indexOf('\n}', src.indexOf('async function refreshFor(', from));
assert.ok(end > from, 'refreshFor was found in index.html');
const block = src.slice(from, end + 2);

// A Coco Cloud that counts what is asked of it, so "how many queries did that cost" is measurable.
function world({ fail = null } = {}) {
  const reads = [];
  const D = { devices: ['old'], approvals: ['old'], tasks: ['old'], activity: ['old'], houses: ['old'] };
  const drew = { render: 0, notify: 0, island: 0, full: 0 };
  const sb = {
    from(table) {
      reads.push(table);
      const res = fail === table ? { error: { message: 'row-level security' }, data: null } : { data: ['fresh:' + table], error: null };
      const api = { select: () => api, order: () => api, limit: () => api, eq: () => api,
                    then: (f, g) => Promise.resolve(res).then(f, g) };
      return api;
    },
  };
  const api = new Function('sb', 'D', 'document', 'render', 'diffAndNotify', 'pushIsland', 'loadAllNow',
    block + '; return { loadAll, refreshFor, SLICE, now: () => lastFull };')(
      sb, D, { hidden: false },
      () => drew.render++, () => drew.notify++, () => drew.island++,
      async () => { drew.full++; reads.push('FULL'); });
  return { api, reads, D, drew };
}

// ---------------------------------------------------------------- a hot topic costs one query
let w = world();
await w.api.loadAll();                      // the first load, which also starts the safety-net clock
assert.equal(w.drew.full, 1, 'the first load is a full read');
w.reads.length = 0;
await w.api.refreshFor(['devices']);
assert.deepEqual(w.reads, ['devices'], 'a device heartbeat reads devices and nothing else');
assert.equal(w.drew.full, 1, 'and does not trigger the full read');
assert.deepEqual(w.D.devices, ['fresh:devices'], 'the slice is actually replaced with cloud rows');
assert.deepEqual(w.D.approvals, ['old'], 'and nothing else is touched');
assert.equal(w.drew.render, 1, 'the screen is redrawn');
assert.equal(w.drew.notify, 1, 'notifications still run, or an approval would arrive silently');
assert.equal(w.drew.island, 1, 'and the island still gets it');

// ---------------------------------------------------------------- several topics at once, still slices
w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor(['devices', 'approvals']);
assert.deepEqual(w.reads.sort(), ['approvals', 'devices'], 'two topics, two queries');
assert.equal(w.drew.full, 1, 'still no full read');

// ---------------------------------------------------------------- an approval is a hot topic
// This is the one that has to be quick: a YES on one device must reach the other three almost at once.
w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor(['approvals']);
assert.deepEqual(w.reads, ['approvals'], 'an approval decision costs one query on every other device');
assert.deepEqual(w.D.approvals, ['fresh:approvals'], 'and the decision is what they then show');

// ---------------------------------------------------------------- THE SAFETY NET
// policies does not pulse yet, so it is not a slice. Anything unknown must take the full read, or a
// company stop made on a phone would never reach the PCs.
w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor(['policies']);
assert.deepEqual(w.reads, ['FULL'], 'an unknown topic takes the full read');
assert.ok(!w.api.SLICE.policies && !w.api.SLICE.structure && !w.api.SLICE.releases
  && !w.api.SLICE.integration_accounts && !w.api.SLICE.integration_links,
  'the five tables that do not pulse yet must NOT be slices - that is what keeps them propagating');

// a pulse with no topic is "something changed", not "nothing changed"
w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor(['*']);
assert.deepEqual(w.reads, ['FULL'], 'a pulse whose topic we cannot read takes the full read');

w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor([]);
assert.deepEqual(w.reads, ['FULL'], 'and so does an empty burst, rather than doing nothing');

// a hot topic mixed with an unknown one takes the full read: the unknown one decides
w = world();
await w.api.loadAll(); w.reads.length = 0;
await w.api.refreshFor(['devices', 'structure']);
assert.deepEqual(w.reads, ['FULL'], 'one unknown topic in the burst is enough to read everything');

// ---------------------------------------------------------------- the clock, which bounds staleness
// Whatever pulses, a full read runs at least once a minute, so the five unpulsed tables can never be
// more than a minute behind. Today that is unbounded: it depends on whether anything pulsed at all.
w = world();
await w.api.loadAll();
assert.ok(/FULL_EVERY\s*=\s*60000/.test(block), 'the net is one minute');
assert.ok(/Date\.now\(\) - lastFull > FULL_EVERY/.test(block), 'and it is checked on every refresh');
w.reads.length = 0;
// pretend the last full read was two minutes ago
const stale = new Function('sb', 'D', 'document', 'render', 'diffAndNotify', 'pushIsland', 'loadAllNow',
  block.replace('lastFull = 0;', 'lastFull = Date.now() - 120000;') + '; return { refreshFor };')(
    { from: (t) => { const api = { select: () => api, order: () => api, limit: () => api, then: (f) => Promise.resolve({ data: [t], error: null }).then(f) }; return api; } },
    {}, { hidden: false }, () => {}, () => {}, () => {}, async () => { throw new Error('FULL'); });
await assert.rejects(() => stale.refreshFor(['devices']), /FULL/, 'a hot topic still takes the full read once the minute is up');

// ---------------------------------------------------------------- a failed read never leaves old rows
w = world({ fail: 'devices' });
await w.api.loadAll(); w.reads.length = 0; w.drew.full = 0;
await w.api.refreshFor(['devices']);
assert.equal(w.drew.full, 1, 'a refused slice read falls back to the full read, which can refresh the login');
assert.deepEqual(w.D.devices, ['old'], 'and never writes an error over the rows it had');

// ---------------------------------------------------------------- a manual load resets the clock
w = world();
await w.api.loadAll();
const t1 = w.api.now();
assert.ok(t1 > 0, 'loadAll records when the last full read happened');

console.log('refresh: hot topics cost one query, the five unpulsed tables still force a full read — all checks pass');
