// Run: node automation.schedule.test.js
//
// Production targets: planned slots in the template's timezone, weekly/monthly spreading and caps, the backlog limit, operating days,
// start/end dates, and reconciliation that only ever changes unstarted work (history is untouched; nothing is deleted).
import assert from 'node:assert/strict';
import { defaults, mergeLayers } from './api/_template_schema.js';
import { planSlots, reconcile, localDate, localToUtc, isoWeekday } from './api/_template_schedule.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} — ${e.message}`); } };
const S = (p = {}) => mergeLayers([{ label: 'defaults', settings: defaults() }, { label: 'x', settings: p }]).settings;
const NOW = new Date('2026-11-11T07:00:00Z');   // Wednesday 11 Nov 2026, 12:30 in Asia/Kolkata
const dates = (slots) => [...new Set(slots.map((s) => s.local_date))];
const count = (slots, dv) => slots.filter((s) => s.deliverable === dv).length;

t('time: local dates and instants follow the template timezone, across daylight saving', () => {
  assert.equal(localDate(new Date('2026-11-11T20:00:00Z'), 'Asia/Kolkata'), '2026-11-12', 'already tomorrow in India');
  assert.equal(localDate(new Date('2026-11-11T20:00:00Z'), 'UTC'), '2026-11-11');
  assert.equal(localToUtc('2026-11-11', '09:00', 'Asia/Kolkata').toISOString(), '2026-11-11T03:30:00.000Z');
  assert.equal(localToUtc('2026-07-01', '09:00', 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z', 'summer time');
  assert.equal(localToUtc('2026-12-01', '09:00', 'America/New_York').toISOString(), '2026-12-01T14:00:00.000Z', 'winter time');
  assert.equal(isoWeekday('2026-11-11'), 3); assert.equal(isoWeekday('2026-11-15'), 7);
});

t('daily target: 2 Shorts a day over the horizon, at the configured times, in order', () => {
  const s = S({ basics: { timezone: 'Asia/Kolkata' }, targets: { horizon_days: 3, times: ['09:00', '15:00'], deliverables: { short: { daily: 2 } } } });
  const slots = planSlots(s, NOW);
  assert.equal(slots.length, 6); assert.deepEqual(dates(slots), ['2026-11-11', '2026-11-12', '2026-11-13']);
  assert.deepEqual(slots.filter((x) => x.local_date === '2026-11-12').map((x) => x.planned_for.toISOString()), ['2026-11-12T03:30:00.000Z', '2026-11-12T09:30:00.000Z']);
  assert.deepEqual(slots.map((x) => x.seq), [1, 2, 1, 2, 1, 2]);
});

t('weekly and monthly targets are spread over operating days; remainders go to the earliest days', () => {
  const w = planSlots(S({ targets: { horizon_days: 7, operating_days: [1, 3, 5], deliverables: { long_form: { weekly: 4 } } } }), new Date('2026-11-09T01:00:00Z'));   // Monday
  assert.deepEqual(w.map((x) => [x.local_date, x.seq]), [['2026-11-09', 1], ['2026-11-09', 2], ['2026-11-11', 1], ['2026-11-13', 1]], '4 over Mon/Wed/Fri = 2,1,1');
  const m = planSlots(S({ targets: { horizon_days: 30, deliverables: { ebook: { monthly: 3 } } } }), new Date('2026-11-01T01:00:00Z'));
  assert.equal(count(m, 'ebook'), 3);
});

t('a weekly cap limits a daily target, and work already done this week counts against it', () => {
  const s = S({ targets: { horizon_days: 7, deliverables: { short: { daily: 2, weekly: 5 } } } });
  assert.equal(count(planSlots(s, new Date('2026-11-09T01:00:00Z')), 'short'), 5);
  const done = [{ deliverable: 'short', local_date: '2026-11-09', seq: 1, status: 'done' }, { deliverable: 'short', local_date: '2026-11-09', seq: 2, status: 'done' }];
  const rest = S({ targets: { horizon_days: 6, deliverables: { short: { daily: 2, weekly: 5 } } } });   // Tue 10 to Sun 15: the rest of that ISO week only
  assert.equal(count(planSlots(rest, new Date('2026-11-10T01:00:00Z'), done), 'short'), 3, '5 per week, 2 already done');
  assert.equal(count(planSlots(s, new Date('2026-11-10T01:00:00Z'), done), 'short'), 5, 'a 7-day horizon from Tuesday reaches Monday, a new week with a fresh cap: 3 + 2');
});

t('operating days, start and end dates, and the backlog limit', () => {
  const sat = S({ targets: { horizon_days: 14, operating_days: [1, 2, 3, 4, 5], deliverables: { short: { daily: 1 } } } });
  assert.ok(planSlots(sat, NOW).every((x) => isoWeekday(x.local_date) <= 5), 'no weekend work');
  const win = S({ targets: { horizon_days: 30, start_date: '2026-11-15', end_date: '2026-11-17', deliverables: { short: { daily: 1 } } } });
  assert.deepEqual(dates(planSlots(win, NOW)), ['2026-11-15', '2026-11-16', '2026-11-17']);
  const cap = S({ targets: { horizon_days: 30, backlog_limit: 4, deliverables: { short: { daily: 3 } } } });
  const slots = planSlots(cap, NOW); assert.equal(slots.length, 4); assert.equal(slots[0].local_date, '2026-11-11', 'the earliest ones are kept');
  assert.equal(planSlots(S({ targets: { deliverables: {} } }), NOW).length, 0, 'no target, no work');
  assert.equal(planSlots(S({ targets: { deliverables: { short: { daily: 0 } } } }), NOW).length, 0, 'a zero target is no work');
});

t('reconcile: lowering 2 Shorts/day to 1 cancels only the extra unstarted slots; running and finished work is untouched; nothing is deleted', () => {
  const before = S({ targets: { horizon_days: 4, deliverables: { short: { daily: 2 } } } }), after = S({ targets: { horizon_days: 4, deliverables: { short: { daily: 1 } } } });
  const planned = planSlots(before, NOW).map((s, i) => ({ id: i + 1, status: 'planned', job_id: null, ...s }));
  planned[0].status = 'running'; planned[1].status = 'done';            // 11 Nov slots 1 and 2 are already started or finished
  const r = reconcile(planned, planSlots(after, NOW, planned));
  assert.deepEqual(r.cancel.map((c) => c.id), [4, 6, 8], 'the second slot of each unstarted day');
  assert.equal(r.insert.length, 0); assert.equal(r.untouched >= 1, true); assert.ok(!r.cancel.some((c) => [1, 2].includes(c.id)), 'history is never cancelled');
  assert.equal(r.keep, 3, 'the first slot of each remaining day stays');
});

t('reconcile: raising a target adds slots, a cancelled slot comes back when wanted again, a moved time is updated', () => {
  const low = S({ targets: { horizon_days: 2, deliverables: { short: { daily: 1 } } } }), high = S({ targets: { horizon_days: 2, deliverables: { short: { daily: 2 } } } });
  const rows = planSlots(low, NOW).map((s, i) => ({ id: i + 1, status: 'planned', ...s }));
  const up = reconcile(rows, planSlots(high, NOW, rows)); assert.equal(up.insert.length, 2); assert.equal(up.keep, 2);
  const withCancelled = [...rows, { id: 9, deliverable: 'short', local_date: '2026-11-11', seq: 2, status: 'cancelled', planned_for: new Date() }];
  assert.deepEqual(reconcile(withCancelled, planSlots(high, NOW, withCancelled)).reactivate.map((x) => x.id), [9]);
  const moved = S({ targets: { horizon_days: 2, times: ['18:00'], deliverables: { short: { daily: 1 } } } });
  assert.equal(reconcile(rows, planSlots(moved, NOW, rows)).update.length, 2);
});

t('reconcile: a queued slot that is no longer wanted is cancelled together with its job id; a started one is never offered for cancellation', () => {
  const rows = [{ id: 1, deliverable: 'short', local_date: '2026-11-12', seq: 1, status: 'queued', job_id: 'JOB-1', planned_for: new Date() },
    { id: 2, deliverable: 'short', local_date: '2026-11-12', seq: 2, status: 'running', job_id: 'JOB-2', planned_for: new Date() }];
  const r = reconcile(rows, []);
  assert.deepEqual(r.cancel, [{ id: 1, status: 'queued', job_id: 'JOB-1' }]); assert.equal(r.untouched, 1);
});

console.log(`\nautomation.schedule: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
