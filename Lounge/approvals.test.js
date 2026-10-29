// Run: node approvals.test.js
//
// One approval lives in Coco Cloud for all four devices. The thing that makes that true is not the
// screen, it is that the decision can only be taken once: whichever founder device gets there first
// owns it, and the other three are told whose decision it was instead of quietly overwriting it.
//
// Before this, both Lounge and the phone wrote `state` by id alone. Two devices answering the same
// card - or one device answering a card ten seconds stale - both landed, the later write replaced the
// record of who really pressed YES, and a request someone had rejected could come back approved from
// another phone. This drives the real decideApproval() lifted out of index.html against a fake Coco
// Cloud that behaves like PostgREST: a filtered PATCH that matches nothing changes nothing.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const from = src.indexOf('async function decideApproval(');
assert.ok(from > 0, 'decideApproval found in index.html');
const block = src.slice(from, src.indexOf('\n}', from) + 2);

// A Coco Cloud that applies filters the way PostgREST does, and records everything written to it.
function cloud(rows) {
  const db = { approvals: rows.map((r) => ({ ...r })), decisions: [], activity: [] };
  const sb = {
    from: (table) => ({
      update(patch) {
        const q = { table, patch, eqs: [], ins: [] };
        const api = {
          eq(c, v) { q.eqs.push([c, v]); return api; },
          in(c, vs) { q.ins.push([c, vs]); return api; },
          select() {
            const hit = db[q.table].filter((row) => q.eqs.every(([c, v]) => String(row[c]) === String(v))
              && q.ins.every(([c, vs]) => vs.includes(row[c])));
            hit.forEach((row) => Object.assign(row, q.patch));
            return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
          },
        };
        return api;
      },
      insert(row) { db[table].push(row); return Promise.resolve({ error: null }); },
    }),
  };
  return { db, sb };
}

// `local` is what this device currently has on screen, which is not always what the cloud holds -
// that gap is the whole point. Left out, the device is up to date. `world` shares one Coco Cloud
// between several devices, which is how two founders pressing at once is tested at all.
function run(rows, { who = 'Mangesh', device = 'mangesh-pc', local = null, world = null } = {}) {
  const { db, sb } = world || cloud(rows);
  const said = [];
  const D = { approvals: local || db.approvals, activity: db.activity };
  const decide = new Function('D', 'sb', 'founderName', 'toast', 'loadAll', 'log',
    block + '; return decideApproval;')(
      D, sb, () => who, (m) => said.push(m),
      // loadAll re-reads the cloud, exactly as the real one does
      async () => { D.approvals = db.approvals; },
      async (action, detail) => { db.activity.push({ actor: who, device_id: device, action, detail }); });
  return { decide, db, sb, said };
}

const waiting = () => [{ id: 'a1', code: 'A-019', what: 'Publish Orbi 2.9.1 to the Chrome Web Store', state: 'waiting' }];

// ---------------------------------------------------------------- the first device wins
let t = run(waiting());
await t.decide('a1', true);
assert.equal(t.db.approvals[0].state, 'approved', 'a YES moves the one cloud row');
assert.equal(t.db.approvals[0].decided_by, 'Mangesh', 'the cloud records who decided it');
assert.ok(t.db.approvals[0].decided_at, 'and when');
assert.equal(t.db.decisions.length, 1, 'the decision is written to the company record');
assert.equal(t.db.activity.length, 1, 'and audited');
assert.equal(t.db.activity[0].device_id, 'mangesh-pc', 'the audit line names the device that decided');
assert.deepEqual(t.said, [], 'nothing to explain when it worked');

// ---------------------------------------------------------------- the second device changes nothing
// Boss PC has already said No. Big Boss phone is holding a card that still reads PENDING, and taps
// YES on it. This is the exact case that used to turn a rejected request into an approved one.
const decidedInCloud = [{ id: 'a1', code: 'A-019', what: 'Publish Orbi 2.9.1 to the Chrome Web Store',
  state: 'rejected', decided_by: 'Mangesh', decided_at: '2026-10-29T08:00:00Z' }];
const second = run(decidedInCloud, { who: 'Shreya', device: 'shreya-phone', local: waiting() });
await second.decide('a1', true);
assert.equal(second.db.approvals[0].state, 'rejected', 'a rejected request stays rejected');
assert.equal(second.db.approvals[0].decided_by, 'Mangesh', 'and keeps the name of whoever decided it');
assert.equal(second.db.approvals[0].decided_at, '2026-10-29T08:00:00Z', 'and its timestamp');
assert.equal(second.db.decisions.length, 0, 'no second decision is recorded');
assert.equal(second.db.activity.length, 0, 'and nothing is audited as a decision that did not happen');
assert.ok(/already rejected by Mangesh/.test(second.said.join(' ')), 'the phone is told whose decision it was: ' + second.said);

// Two devices on ONE cloud, racing on a request that really is still open: one write lands, one does
// not, and neither device is the one that decides which.
const shared = cloud(waiting());
const bossPc = run(null, { world: shared, who: 'Mangesh', device: 'mangesh-pc' });
const bigBossPc = run(null, { world: shared, who: 'Shreya', device: 'shreya-pc', local: waiting() });
await bossPc.decide('a1', true);                 // Boss PC gets there first
await bigBossPc.decide('a1', false);             // Big Boss PC, a moment later, on a card gone stale
assert.equal(shared.db.approvals[0].state, 'approved', 'the first answer is the one that stands');
assert.equal(shared.db.approvals[0].decided_by, 'Mangesh', 'and the first approver is who the cloud names');
assert.equal(shared.db.decisions.length, 1, 'exactly one decision for one approval, not one per device');
assert.equal(shared.db.activity.length, 1, 'and exactly one audited decision');
assert.ok(/already approved by Mangesh/.test(bigBossPc.said.join(' ')), 'the second device is told, not ignored');

// ---------------------------------------------------------------- an approved request cannot be re-approved
t = run([{ id: 'a2', code: 'A-020', what: 'Spend money', state: 'approved', decided_by: 'Shreya', decided_at: '2026-10-29T08:00:00Z' }]);
await t.decide('a2', true);
assert.equal(t.db.decisions.length, 0, 'approving an approved request does nothing');
assert.equal(t.db.approvals[0].decided_by, 'Shreya', 'the original approver stands');

// ---------------------------------------------------------------- on-hold is still answerable
t = run([{ id: 'a3', code: 'A-021', what: 'Something parked', state: 'on-hold' }]);
await t.decide('a3', true);
assert.equal(t.db.approvals[0].state, 'approved', 'a parked request can still be answered');

// ---------------------------------------------------------------- a refusal from the cloud is reported, not swallowed
{
  const { db } = cloud(waiting());
  const said = [];
  const sb = { from: () => ({ update: () => ({ eq() { return this; }, in() { return this; }, select: () => Promise.resolve({ data: null, error: { message: 'row-level security' } }) }) }) };
  const decide = new Function('D', 'sb', 'founderName', 'toast', 'loadAll', 'log',
    block + '; return decideApproval;')({ approvals: db.approvals, activity: [] }, sb, () => 'Mangesh', (m) => said.push(m), async () => {}, async () => {});
  await decide('a1', true);
  assert.ok(/row-level security/.test(said.join(' ')), 'a device gate or RLS refusal is shown, never treated as a YES');
  assert.equal(db.decisions.length, 0, 'and no decision is recorded for a write that was refused');
}

// ---------------------------------------------------------------- the decision is never invented locally
assert.ok(/\.in\(['"]state['"]/.test(block), 'the write is filtered on the current state - this is what makes it final');
assert.ok(/decided_by: *founderName\(\)/.test(block), 'the approver is the signed-in founder, never typed');
assert.ok(!/service|anon_key|engine/i.test(block), 'no key or engine path anywhere near a founder decision');

console.log('approvals: one cloud record, first founder device wins, the other three are told — all checks pass');
