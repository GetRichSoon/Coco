// Run: node ui-kit.test.js
// The numbers behind the unified Home and Insights. The rule under test: a figure is a recorded fact with a source, or it is
// "unavailable" - missing data is never a zero, an estimate is never an actual, and currencies are never added together.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(dir, 'ui-kit.js'), 'utf8'), { window: sandbox, Intl, Math, Number, String, Date, Set, Map, Array, Object, JSON, isFinite });
const U = sandbox.CocoUI;
const plain = (x) => JSON.parse(JSON.stringify(x));   // values built inside the vm have another realm's prototypes
let pass = 0;
let fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { process.exitCode = 1; fail++; console.log('FAIL ' + name + '\n     ' + e.message); } };

const NOW = new Date('2026-11-11T10:00:00Z');
const units = [
  { id: 'coco', kind: 'company', parent_id: null }, { id: 'gigi', kind: 'house', parent_id: 'coco', house_id: 'gigi' },
  { id: 'gigi.yt', kind: 'subteam', parent_id: 'gigi' }, { id: 'gigi.yt.news', kind: 'category', parent_id: 'gigi.yt' },
  { id: 'poppy', kind: 'house', parent_id: 'coco', house_id: 'poppy' }, { id: 'poppy.kdp', kind: 'subteam', parent_id: 'poppy' },
];
const m = (metric, period, value, unit, source, unit_id, extra = {}) => ({ metric, period, value, unit, source, unit_id, recorded_at: period + 'T06:00:00Z', ...extra });

t('periods: 28 days is the default, the previous period is the equal-length window just before it', () => {
  const r = U.periodRange('28d', NOW);
  assert.equal(r.from, '2026-10-15'); assert.equal(r.to, '2026-11-11'); assert.equal(r.days, 28);
  assert.equal(r.prevTo, '2026-10-14'); assert.equal(r.prevFrom, '2026-09-17');
  assert.equal(U.periodRange('today', NOW).days, 1);
  assert.equal(U.periodRange('7d', NOW).from, '2026-11-05');
  assert.equal(U.periodRange('month', NOW).from, '2026-11-01');
  assert.equal(U.periodRange('nonsense', NOW).key, '28d', 'an unknown key falls back to 28 days');
});

t('periods: a custom range needs two valid ordered dates, otherwise it falls back', () => {
  const ok = U.periodRange('custom', NOW, { from: '2026-10-01', to: '2026-10-10' });
  assert.equal(ok.key, 'custom'); assert.equal(ok.days, 10); assert.equal(ok.prevTo, '2026-09-30');
  assert.equal(U.periodRange('custom', NOW, { from: '2026-10-10', to: '2026-10-01' }).key, '28d');
  assert.equal(U.periodRange('custom', NOW, { from: 'x', to: 'y' }).key, '28d');
});

t('scope: a House selects itself and everything under it; "all" selects nothing restrictive', () => {
  const s = U.scopeUnits(units, { house: 'gigi' });
  assert.deepEqual([...s].sort(), ['gigi', 'gigi.yt', 'gigi.yt.news']);
  assert.equal(U.scopeUnits(units, { house: 'all' }), null);
  assert.deepEqual([...U.scopeUnits(units, { house: 'gigi', team: 'gigi.yt' })].sort(), ['gigi.yt', 'gigi.yt.news'], 'the more specific filter wins');
  assert.ok(U.scopeNames(units, s).has('yt'), 'outputs tagged with the last segment of a unit id match');
  assert.equal(U.scopeNames(units, null), null);
});

t('revenue with no records anywhere is UNAVAILABLE, never zero', () => {
  const h = U.headline([], 'revenue', U.periodRange('28d', NOW));
  assert.equal(h.state, 'unavailable'); assert.deepEqual(plain(h.totals), []);
  // other metrics present do not make revenue exist
  const h2 = U.headline([m('views', '2026-11-01', 100, 'views', 'youtube', 'gigi.yt')], 'revenue', U.periodRange('28d', NOW));
  assert.equal(h2.state, 'unavailable');
});

t('revenue recorded earlier but not in this period says so instead of showing zero', () => {
  const rows = [m('revenue', '2026-06-01', 500, 'INR', 'gumroad', 'poppy.kdp')];
  const h = U.headline(rows, 'revenue', U.periodRange('28d', NOW));
  assert.equal(h.state, 'none_in_period'); assert.deepEqual(plain(h.totals), []); assert.deepEqual(plain(h.sources), ['gumroad']);
});

t('actual vs estimated vs mixed are kept apart, and never summed into one figure', () => {
  const R = U.periodRange('28d', NOW);
  const a = U.headline([m('revenue', '2026-11-01', 100, 'INR', 'gumroad', 'poppy.kdp')], 'revenue', R);
  assert.equal(a.state, 'actual'); assert.equal(a.totals[0].total, 100);
  const e = U.headline([m('revenue', '2026-11-01', 100, 'INR', 'forecast model', 'poppy.kdp')], 'revenue', R);
  assert.equal(e.state, 'estimated');
  const mx = U.headline([m('revenue', '2026-11-01', 100, 'INR', 'gumroad', 'poppy.kdp'), m('revenue', '2026-11-02', 40, 'INR', 'estimated payout', 'poppy.kdp')], 'revenue', R);
  assert.equal(mx.state, 'mixed'); assert.equal(mx.totals[0].actual, 100); assert.equal(mx.totals[0].estimated, 40);
  assert.equal(mx.totals[0].total, 100, 'the headline figure of a mixed set is the actual amount only: the estimate is reported beside it, never inside it');
  assert.equal(e.totals[0].total, 100, 'an all-estimate set shows the estimate, labelled Estimated');
});

t('currencies are never added together; each keeps its own total', () => {
  const R = U.periodRange('28d', NOW);
  const h = U.headline([m('revenue', '2026-11-01', 100, 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-11-02', 5, 'USD', 'g', 'poppy.kdp')], 'revenue', R);
  assert.equal(h.totals.length, 2);
  assert.equal(h.totals.find((x) => x.unit === 'USD').total, 5);
  assert.equal(U.headline([m('revenue', '2026-11-01', 100, 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-11-02', 5, 'USD', 'g', 'poppy.kdp')], 'revenue', R, { currency: 'USD' }).totals.length, 1);
});

t('the comparison with the previous period exists only when both periods have data in the same basis', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('revenue', '2026-11-01', 150, 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-10-01', 100, 'INR', 'g', 'poppy.kdp')];
  const h = U.headline(rows, 'revenue', R);
  assert.equal(h.delta.length, 1); assert.equal(Math.round(h.delta[0].pct), 50);
  assert.deepEqual(plain(U.headline([m('revenue', '2026-11-01', 150, 'INR', 'g', 'poppy.kdp')], 'revenue', R).delta), [], 'no earlier data: no percentage');
  assert.deepEqual(plain(U.headline([m('revenue', '2026-11-01', 150, 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-10-01', 0, 'INR', 'g', 'poppy.kdp')], 'revenue', R).delta), [], 'a zero base gives no percentage');
});

t('the House filter restricts which rows count', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('views', '2026-11-01', 1000, 'views', 'youtube', 'gigi.yt'), m('views', '2026-11-01', 7, 'views', 'other', 'poppy.kdp')];
  assert.equal(U.headline(rows, 'views', R, { units: U.scopeUnits(units, { house: 'gigi' }) }).totals[0].total, 1000);
  assert.equal(U.headline(rows, 'views', R).totals[0].total, 1007);
  assert.equal(U.headline(rows, 'views', R, { units: U.scopeUnits(units, { house: 'tilly' }) }).state, 'unavailable', 'a House with no data is unavailable, not zero');
});

t('audience growth is the net change between first and last record, per channel, and a single record is not a growth', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('subscribers', '2026-10-20', 100, 'count', 'yt', 'gigi.yt', { product_id: 'c1' }), m('subscribers', '2026-11-10', 130, 'count', 'yt', 'gigi.yt', { product_id: 'c1' }),
    m('subscribers', '2026-10-21', 10, 'count', 'yt', 'gigi.yt', { product_id: 'c2' }), m('subscribers', '2026-11-09', 12, 'count', 'yt', 'gigi.yt', { product_id: 'c2' })];
  const g = U.growth(rows, R);
  assert.equal(g.state, 'delta'); assert.equal(g.value, 32);
  assert.equal(U.growth([rows[0]], R).state, 'single');
  assert.equal(U.growth([], R).state, 'unavailable');
});

t('a day series sums rows sharing a day and drops other units', () => {
  const R = U.periodRange('28d', NOW);
  const s = U.seriesByDay([m('revenue', '2026-11-01', 10, 'INR', 'g', 'a'), m('revenue', '2026-11-01', 5, 'INR', 'g', 'b'), m('revenue', '2026-11-03', 2, 'INR', 'g', 'a'), m('revenue', '2026-11-02', 99, 'USD', 'g', 'a')], R, 'INR');
  assert.deepEqual(plain(s), [{ x: '2026-11-01', y: 15 }, { x: '2026-11-03', y: 2 }]);
});

t('audience over time carries each channel forward instead of dropping or double counting it', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('subscribers', '2026-11-01', 100, 'count', 'yt', 'gigi.yt', { product_id: 'c1' }), m('subscribers', '2026-11-02', 10, 'count', 'yt', 'gigi.yt', { product_id: 'c2' }), m('subscribers', '2026-11-03', 110, 'count', 'yt', 'gigi.yt', { product_id: 'c1' })];
  assert.deepEqual(plain(U.audienceSeries(rows, R, 'count')), [{ x: '2026-11-01', y: 100 }, { x: '2026-11-02', y: 110 }, { x: '2026-11-03', y: 120 }]);
  assert.deepEqual(plain(U.audienceSeries([], R, 'count')), []);
});

t('metric names and product sets narrow the rows (the platform filter works through products)', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('installs', '2026-11-01', 5, 'count', 'cws', 'lulu.ext', { product_id: 'p1' }), m('installs', '2026-11-01', 9, 'count', 'cws', 'lulu.ext', { product_id: 'p2' }), m('users', '2026-11-01', 3, 'count', 'cws', 'lulu.ext', { product_id: 'p1' })];
  assert.equal(U.headline(rows, 'installs', R, { names: ['installs'], productIds: new Set(['p1']) }).totals[0].total, 5);
  assert.equal(U.selectMetrics(rows, { names: ['users'] }).length, 1);
});

t('a row with no value is missing data, never a zero (null, empty, not a number)', () => {
  const R = U.periodRange('28d', NOW);
  const rows = [m('revenue', '2026-11-01', null, 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-11-02', '', 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-11-03', 'abc', 'INR', 'g', 'poppy.kdp'), m('revenue', '2026-11-04', undefined, 'INR', 'g', 'poppy.kdp')];
  assert.equal(U.headline(rows, 'revenue', R).state, 'unavailable', 'rows without a value do not make revenue exist');
  const h = U.headline(rows.concat([m('revenue', '2026-11-05', 40, 'INR', 'g', 'poppy.kdp')]), 'revenue', R);
  assert.equal(h.totals[0].total, 40); assert.equal(h.totals[0].n, 1, 'only the real record counts');
  assert.equal(U.headline([m('revenue', '2026-11-05', 0, 'INR', 'g', 'poppy.kdp')], 'revenue', R).totals[0].total, 0, 'a recorded zero is still a zero');
});

t('charts: nothing to draw returns an empty string so the page shows an honest empty state', () => {
  assert.equal(U.lineChart([]), ''); assert.equal(U.barChart([]), ''); assert.equal(U.targetChart([]), '');
  assert.equal(U.barChart([{ label: 'x', value: NaN }]), '');
});

t('charts: a line chart is an accessible svg that escapes labels', () => {
  const svg = U.lineChart([{ x: '2026-11-01', y: 10 }, { x: '2026-11-02', y: 20 }], { label: 'Revenue <b>' });
  assert.match(svg, /^<svg[^>]+role="img"/); assert.ok(!svg.includes('<b>'), 'label must be escaped'); assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
  const one = U.lineChart([{ x: '2026-11-01', y: 0 }]);
  assert.ok(one.includes('<svg') && !one.includes('NaN'), 'a single zero point still renders without NaN');
});

t('charts: bars scale to the largest value and escape their text', () => {
  const html = U.barChart([{ label: 'A<i>', value: 50 }, { label: 'B', value: 100 }]);
  assert.ok(html.includes('width:100.0%') && html.includes('width:50.0%')); assert.ok(!html.includes('<i>'));
  const tgt = U.targetChart([{ label: 'Shorts', planned: 10, actual: 4 }]);
  assert.ok(tgt.includes('4 / 10') && tgt.includes('Target') && !tgt.includes('NaN'));
});

t('formatting: money keeps its own currency, bad input is a dash, never NaN', () => {
  assert.ok(U.fmtMoney(1234, 'INR').includes('1,234')); assert.ok(U.fmtMoney(5, 'USD').includes('$'));
  assert.equal(U.fmtMoney('x', 'USD'), '—'); assert.equal(U.fmtNum(undefined), '—');
  assert.equal(U.fmtPct(null), ''); assert.equal(U.fmtPct(12.34), '+12%'); assert.equal(U.fmtPct(-3.2), '−3.2%');
  assert.ok(U.fmtMoney(5, 'ZZ9').includes('5'), 'an invalid currency code degrades to plain text');
});

t('navigation helpers read the contract', () => {
  const nav = JSON.parse(fs.readFileSync(path.join(dir, 'contract', 'nav-contract.json'), 'utf8'));
  assert.equal(U.sectionOf(nav, 'approvals').id, 'work'); assert.equal(U.sectionOf(nav, 'nope'), null);
  assert.ok(U.reachableIds(nav).has('chat') && U.reachableIds(nav).has('house'));
  assert.equal(U.houseById(nav, 'poppy').label, 'Poppy Ebooks');
  assert.equal(U.houseUnit(units, 'gigi').id, 'gigi'); assert.equal(U.houseUnit(units, 'zzz'), null);
});

// ---------------------------------------------------------------- operations (tasks, worker, attention, YouTube, revenue)
const NAVC = JSON.parse(fs.readFileSync(path.join(dir, 'contract', 'nav-contract.json'), 'utf8'));
const tk = (status, extra = {}) => ({ id: 't-' + status, title: 'T ' + status, status, retry_count: 0, priority: 2, needs: 'cloud', ...extra });
const AT = '2026-11-12T08:00:00.000Z', AT_MS = Date.parse(AT);

t('task state machine: planned -> queued -> running -> done|failed; queued|running -> paused -> queued; any open -> stopped; failed -> queued', () => {
  assert.deepEqual(plain(U.taskActions(tk('planned'))), ['start', 'cancel']);
  assert.deepEqual(plain(U.taskActions(tk('queued'))), ['start', 'pause', 'cancel'], 'a queued task nobody asked a cloud run for can be started');
  assert.deepEqual(plain(U.taskActions(tk('queued'), { hasOpenRequest: true })), ['pause', 'cancel'], 'one with a cloud run already requested cannot be started twice');
  assert.deepEqual(plain(U.taskActions(tk('verifying'))), ['done', 'cancel']);
  assert.deepEqual(plain(U.taskActions(tk('queued', { needs: 'pc' }))), ['pause', 'cancel'], 'a queued PC task has no cloud run to ask for'); assert.deepEqual(plain(U.taskActions(tk('planned', { needs: 'pc' }))), ['start', 'cancel']);
  assert.deepEqual(plain(U.taskActions(tk('running'))), ['pause', 'cancel']);
  assert.deepEqual(plain(U.taskActions(tk('paused'))), ['resume', 'cancel']);
  assert.deepEqual(plain(U.taskActions(tk('failed'))), ['retry', 'cancel']);
  for (const s of ['done', 'stopped', 'cancelled']) assert.deepEqual(plain(U.taskActions(tk(s))), [], s + ' offers no state change');
  assert.deepEqual(plain(U.taskChange('start', tk('planned'), {}, AT_MS).patch), { status: 'queued', updated_at: AT });
  assert.equal(U.taskChange('start', tk('paused'), {}, AT_MS).ok, false, 'Start is for a planned or queued task'); assert.equal(U.taskChange('start', tk('queued'), {}, AT_MS).ok, true);
  assert.deepEqual(plain(U.taskChange('start', tk('planned'), { request: { id: 9 } }, AT_MS).patch), { status: 'queued', result: 'Waiting for the next cloud run (request #9)', updated_at: AT }, 'Start with a requested run says what it waits for');
  assert.deepEqual(plain(U.taskChange('done', tk('verifying'), {}, AT_MS).patch), { status: 'done', updated_at: AT }); assert.equal(U.taskChange('done', tk('running'), {}, AT_MS).ok, false, 'only a task that finished and awaits a check can be closed');
  assert.equal(U.taskChange('pause', tk('paused'), {}, AT_MS).ok, false);
  assert.equal(U.taskChange('cancel', tk('done'), {}, AT_MS).ok, false, 'a finished task cannot be stopped');
  assert.equal(plain(U.taskChange('cancel', tk('failed'), {}, AT_MS).patch).status, 'stopped');
  for (const s of ['planned', 'queued', 'running', 'working', 'verifying', 'need_approval', 'needs_yes', 'waiting_pc', 'blocked', 'paused']) assert.equal(U.taskChange('cancel', tk(s), {}, AT_MS).ok, true, 'cancel from ' + s);
  assert.equal(U.taskChange('start', tk('planned'), {}, AT_MS).patch.status === 'running', false, 'running is only ever set by a worker claim');
});
t('retry puts a failed task back in the queue, counts the attempt, keeps the old error as a note and frees the claim', () => {
  const r = U.taskChange('retry', tk('failed', { retry_count: 1, error: 'upload timed out', claimed_by_device: 'cloud-worker-1', claimed_at: AT, heartbeat_at: AT, stale: true }), {}, AT_MS);
  assert.deepEqual(plain(r.patch), { status: 'queued', retry_count: 2, error: null, claimed_by_device: null, claimed_at: null, heartbeat_at: null, stale: false, updated_at: AT });
  assert.deepEqual(plain(r.guard), ['failed']); assert.match(r.note, /Retry 2\. Previous error: upload timed out/);
  assert.deepEqual(plain(U.taskChange('resume', tk('paused'), {}, AT_MS).patch), { status: 'queued', claimed_by_device: null, claimed_at: null, heartbeat_at: null, stale: false, updated_at: AT });
});
t('priority and assignment writes are validated', () => {
  assert.deepEqual(plain(U.taskChange('priority', tk('queued'), { priority: 1 }, AT_MS).patch), { priority: 1, updated_at: AT });
  assert.equal(U.taskChange('priority', tk('queued'), { priority: 9 }, AT_MS).ok, false); assert.equal(U.priorityName(1), 'High'); assert.equal(U.priorityName(3), 'Low'); assert.equal(U.priorityName(undefined), 'Normal');
  assert.deepEqual(plain(U.taskChange('assign', tk('queued'), { member_id: 'm1', house_id: 'gigi', pipeline_id: 'p1' }, AT_MS).patch), { updated_at: AT, member_id: 'm1', house_id: 'gigi', pipeline_id: 'p1' });
  assert.deepEqual(plain(U.taskChange('assign', tk('queued'), { pipeline_id: '' }, AT_MS).patch), { updated_at: AT, pipeline_id: null, step: null }, 'removing the pipeline also clears the step');
  assert.equal(U.taskChange('assign', tk('queued'), {}, AT_MS).ok, false); assert.equal(U.taskChange('assign', tk('done'), { member_id: 'm' }, AT_MS).ok, false);
});
t('task groups match the filters Open / Failed / Done / Stopped', () => {
  assert.deepEqual(['queued', 'planned', 'paused', 'running', 'failed', 'done', 'stopped', 'cancelled', 'blocked'].map(U.taskGroup), ['open', 'open', 'open', 'open', 'failed', 'done', 'stopped', 'stopped', 'open']);
});
t('progress is the recorded pipeline step, never an invented percentage', () => {
  const pl = [{ id: 'p1', name: 'Daily', steps: [1, 2, 3, 4, 5, 6] }];
  assert.equal(U.taskProgress(tk('running'), pl), null);
  assert.equal(U.taskProgress(tk('running', { pipeline_id: 'p1', step: null }), pl).label, 'not started');
  const p = U.taskProgress(tk('running', { pipeline_id: 'p1', step: 3 }), pl); assert.equal(p.label, 'step 3 of 6'); assert.equal(p.ratio, 0.5);
  assert.equal(U.taskProgress(tk('running', { pipeline_id: 'gone', step: 2 }), pl).label, 'step 2');
});
t('a cloud worker is judged by its schedule (12 hours), a PC by its heartbeat; a queued task says it waits for the next cloud run and is never called running', () => {
  const dev = (id, kind, ageMin) => ({ id, kind, name: id, active: true, last_seen: new Date(AT_MS - ageMin * 60000).toISOString() });
  const off = U.workerStatus([dev('cloud-worker-1', 'phone', 14400), dev('pc1', 'pc', 90)], AT_MS), on = U.workerStatus([dev('cloud-worker-1', 'phone', 3), dev('pc1', 'pc', 90)], AT_MS);
  assert.equal(off.cloud.online, false); assert.equal(on.cloud.online, true); assert.equal(U.workerStatus([dev('cloud-worker-1', 'phone', 11 * 60)], AT_MS).cloud.online, true, '11 hours is still within the schedule'); assert.equal(U.workerStatus([dev('cloud-worker-1', 'phone', 13 * 60)], AT_MS).cloud.online, false);
  assert.equal(U.workerStatus([{ id: 'w2', kind: 'pc', active: true, info: { cloud: true }, last_seen: new Date(AT_MS - 3600e3).toISOString() }], AT_MS).cloud.online, true, 'a device that says info.cloud is judged the same way');
  assert.equal(U.workerStatus([dev('cloud-worker-1', 'phone', 5)], AT_MS, [{ completed_at: '2026-11-02T10:00:00Z' }, { completed_at: '2026-11-10T10:00:00Z' }, { completed_at: null }]).cloud.lastJob, '2026-11-10T10:00:00Z', 'the latest job activity is the newest completed_at'); assert.equal(off.pcOnline, false); assert.equal(U.workerStatus([dev('pc1', 'pc', 1)], AT_MS).pcOnline, true); assert.equal(U.workerStatus([], AT_MS).cloud, null);
  assert.match(U.taskWait(tk('queued'), off, AT_MS, { hasOpenRequest: true }), /^Waiting for the next cloud run \(the cloud last ran 10 d ago\)$/); assert.match(U.taskWait(tk('queued'), on, AT_MS, { hasOpenRequest: true }), /^Waiting for the next cloud run \(the cloud last ran 3 min ago\)$/);
  assert.match(U.taskWait(tk('queued'), off, AT_MS), /^Not asked to run yet: press Start to ask the cloud for a run \(the cloud last ran 10 d ago\)$/, 'with no cloud run requested, nothing is going to run it');
  assert.match(U.taskWait(tk('queued', { needs: 'pc' }), off), /Waiting for a PC/); assert.match(U.taskWait(tk('queued', { needs: 'any' }), off, AT_MS, { hasOpenRequest: true }), /^Waiting for the next cloud run/);
  assert.match(U.taskWait(tk('queued', { needs: 'any' }), U.workerStatus([dev('pc1', 'pc', 1)], AT_MS)), /online PC can claim it/);
  assert.equal(U.taskWait(tk('running'), off), null); assert.equal(U.taskWait(tk('working'), off), null); assert.match(U.taskWait(tk('queued'), U.workerStatus([], AT_MS), AT_MS), /no cloud worker is paired/);
});
t('a House is found from a runtime team id, a platform id or free text', () => {
  assert.equal(U.houseOfTeam(NAVC, 'ebooks'), 'poppy'); assert.equal(U.houseOfTeam(NAVC, 'software'), 'lulu'); assert.equal(U.houseOfTeam(NAVC, 'youtube'), 'gigi'); assert.equal(U.houseOfTeam(NAVC, 'social'), 'gigi');
  assert.equal(U.houseOfTeam(NAVC, 'courses'), 'fifi'); assert.equal(U.houseOfTeam(NAVC, 'games'), 'zaza'); assert.equal(U.houseOfTeam(NAVC, 'comics'), 'mochi'); assert.equal(U.houseOfTeam(NAVC, 'commerce'), 'tilly');
  assert.equal(U.houseOfTeam(NAVC, 'ebooks/practical-skills/x'), 'poppy', 'a structure id maps by its first segment'); assert.equal(U.houseOfTeam(NAVC, 'core'), null); assert.equal(U.houseOfTeam(NAVC, ''), null);
  assert.equal(U.houseOfText(NAVC, 'Social Media'), 'gigi'); assert.equal(U.houseOfText(NAVC, 'YouTube'), 'gigi'); assert.equal(U.houseOfText(NAVC, 'Play Apps'), null); assert.equal(U.houseOfText(NAVC, null), null);
});
const S0 = () => ({ now: AT_MS, devices: [{ id: 'cloud-worker-1', kind: 'phone', active: true, last_seen: new Date(AT_MS - 10 * 864e5).toISOString() }], approvals: [], integrations: [], accounts: [], jobs: [],
  tasks: [...Array(10)].map((_, i) => tk('queued', { id: 'q' + i })).concat([tk('stopped', { id: 's1' }), tk('failed', { id: 'f1', error: 'boom' }), tk('planned', { id: 'p1' }), tk('paused', { id: 'z1' })]) });
t('Home tiles count the production-shaped task mix: open = queued + planned + paused (+ running), failed is a badge', () => {
  const tl = U.homeTiles(S0()); assert.equal(tl.open, 12); assert.equal(tl.failed, 1); assert.equal(tl.running, 0); assert.equal(tl.yes, 0);
  const s = S0(); s.tasks.push(tk('running', { id: 'r1' })); s.jobs.push({ id: 'J1', type: 'x', status: 'running' }, { id: 'J2', type: 'x', status: 'done' }); s.approvals.push({ id: 'a1', code: 'A-1', what: 'w', state: 'waiting' }, { id: 'a2', code: 'A-2', what: 'w', state: 'approved' });
  const tl2 = U.homeTiles(s); assert.equal(tl2.open, 13); assert.equal(tl2.running, 2); assert.equal(tl2.yes, 1);
});
t('Needs attention lists approvals, failed work, integration errors and an offline worker, worst first, each with its actions', () => {
  const s = S0(); s.approvals.push({ id: 'a1', code: 'A-7', what: 'Publish', team: 'YouTube', state: 'waiting', raised_on: '2026-11-11' });
  s.jobs.push({ id: 'J-F', type: 'upload', team_id: 'youtube', status: 'failed', error: { message: 'quota' } }, { id: 'J-B', type: 'publish', team_id: 'ebooks', status: 'blocked', error: {} }, { id: 'J-D', type: 'x', status: 'done' });
  s.integrations.push({ id: 'gumroad-poppy', platform: 'Gumroad', state: 'error', error: 'the access token was leaked' }, { id: 'ok', platform: 'GitHub', state: 'connected' });
  const a = U.attention(s, AT_MS), by = (k, id) => a.find((x) => x.kind === k && x.id === id);
  assert.deepEqual(plain(by('approval', 'a1').actions), ['approve', 'reject']); assert.equal(by('approval', 'a1').href, '#approvals:a1');
  assert.deepEqual(plain(by('task', 'f1').actions), ['retry', 'cancel']); assert.equal(by('task', 'f1').tone, 'bad');
  assert.deepEqual(plain(by('job', 'J-F').actions), ['retry']); assert.match(by('job', 'J-F').sub, /quota/); assert.deepEqual(plain(by('job', 'J-B').actions), ['cancel']); assert.equal(by('job', 'J-D'), undefined);
  assert.deepEqual(plain(by('integration', 'gumroad-poppy').actions), ['reconnect']); assert.equal(by('integration', 'ok'), undefined);
  const w = by('worker', 'worker'); assert.equal(w.tone, 'warn'); assert.match(w.title, /^Cloud worker: last run 10 d ago$/); assert.doesNotMatch(w.title + w.sub, /offline/i, 'a schedule is not an outage'); assert.match(w.sub, /10 queued tasks wait for the next cloud run/);
  const order = plain(a.map((x) => x.tone)); assert.deepEqual(order, [...order].sort((x, y) => ({ bad: 0, warn: 1, info: 2 }[x] - { bad: 0, warn: 1, info: 2 }[y])), 'worst first');
  const quiet = U.attention({ ...S0(), tasks: [] }, AT_MS).find((x) => x.kind === 'worker'); assert.equal(quiet.tone, 'info'); assert.match(quiet.sub, /nothing is waiting/);
  assert.equal(U.attention({ now: AT_MS, devices: [], tasks: [] }, AT_MS)[0].title, 'No cloud worker is paired');
});
t('YouTube numbers: the latest channel row per connection, summed, with the newest sync time', () => {
  const row = (c, day, at, m, extra = {}) => ({ connection_id: c, day, at, kind: 'channel', source: 'data_api', metrics: m, ...extra });
  const y = U.ytSummary([row('yt-a', '2026-11-10', '2026-11-10T04:00:00Z', { views: 100, subscribers: 10, videos: 4 }), row('yt-a', '2026-11-11', '2026-11-11T04:10:00Z', { views: 120, subscribers: 12, videos: 5 }), row('yt-b', '2026-11-11', '2026-11-11T04:11:00Z', { views: 30, subscribers: 3 }),
    row('yt-a', '2026-11-11', '2026-11-11T05:00:00Z', { views: 9 }, { source: 'analytics_api' }), { connection_id: 'yt-c', day: '2026-11-11', at: '2026-11-11T04:12:00Z', kind: 'short', source: 'data_api', metrics: { views: 1 } }], [{ connection_id: 'yt-a', external_name: 'Channel A' }]);
  assert.equal(y.views, 150); assert.equal(y.subscribers, 15); assert.equal(y.videos, 5, 'a channel without a video count adds nothing'); assert.equal(y.lastSync, '2026-11-11T05:00:00Z');
  assert.deepEqual(plain(y.channels.map((c) => [c.name, c.views, c.subscribers])), [['Channel A', 120, 12], ['yt-b', 30, 3]]);
  const none = U.ytSummary([], []); assert.equal(none.views, null); assert.equal(none.lastSync, null); assert.equal(none.channels.length, 0);
});
t('revenue per source: INR 0 only for a connected source with a good sync; not connected is never a zero; failures and amounts are stated', () => {
  const acc = [{ connection_id: 'poppy', provider: 'gumroad', state: 'connected' }, { connection_id: 'old', provider: 'gumroad', state: 'not_connected' }];
  const find = (r, s) => r.sources.find((x) => x.source === s);
  assert.equal(find(U.revenueSummary([], [], [], { always: ['gumroad'] }), 'gumroad').state, 'not_connected');
  assert.equal(find(U.revenueSummary([], [], [acc[1]], {}), 'gumroad').state, 'not_connected', 'a disconnected account is not a zero');
  assert.equal(find(U.revenueSummary([], [], [acc[0]], {}), 'gumroad').state, 'never_synced');
  const z = find(U.revenueSummary([], [{ connection_id: 'poppy', provider: 'gumroad', last_synced_at: AT, last_ok_at: AT, state: 'ok', records: 0 }], [acc[0]], {}), 'gumroad'); assert.equal(z.state, 'zero'); assert.equal(z.zeroCurrency, 'USD', 'Gumroad money is USD, never relabelled as rupees'); assert.equal(z.lastOk, AT);
  const bad = find(U.revenueSummary([], [{ connection_id: 'poppy', provider: 'gumroad', last_synced_at: AT, last_ok_at: null, state: 'error', error: 'token revoked' }], [acc[0]], {}), 'gumroad'); assert.equal(bad.state, 'error'); assert.equal(bad.error, 'token revoked');
  const ev = [{ source: 'gumroad', amount: 499, currency: 'INR', kind: 'sale' }, { source: 'gumroad', amount: '399', currency: 'INR' }, { source: 'gumroad', amount: 5, currency: 'USD', kind: 'sale' }, { source: 'gumroad', amount: 100, currency: 'INR', kind: 'refund' }, { source: 'gumroad', amount: 50, currency: 'INR', kind: 'fee' }, { source: 'gumroad', amount: 'x', currency: 'INR' }];
  const r = find(U.revenueSummary(ev, [], [acc[0]], {}), 'gumroad'); assert.equal(r.state, 'amount');
  assert.deepEqual(plain(r.totals.map((x) => [x.currency, x.total, x.count]).sort()), [['INR', 798, 2], ['USD', 5, 1]], 'currencies are never added together; refunds subtract; fees are not sales');
  assert.equal(U.revenueSummary([], [], [], {}).sources.length, 0, 'no source is invented');
});

t('production status words: working is running, verifying is "finished, needs a check", blocked and needs_yes need the founder', () => {
  assert.equal(U.homeTiles({ ...S0(), tasks: [tk('working'), tk('running'), tk('verifying'), tk('needs_yes')], jobs: [] }).running, 2, 'verifying is not running');
  assert.equal(U.homeTiles({ ...S0(), tasks: [tk('working'), tk('verifying'), tk('needs_yes'), tk('done')], jobs: [] }).open, 3);
  const a = U.attention({ ...S0(), tasks: [tk('verifying', { id: 'v1', result: 'Draft ready' }), tk('needs_yes', { id: 'y1' }), tk('blocked', { id: 'b1' }), tk('working', { id: 'w1' })] }, AT_MS), by = (id) => a.find((x) => x.id === id);
  assert.deepEqual(plain(by('v1').actions), ['done', 'cancel']); assert.match(by('v1').sub, /Finished: needs your check · Draft ready/); assert.match(by('y1').sub, /Needs your YES/); assert.deepEqual(plain(by('b1').actions), ['cancel']); assert.equal(by('w1'), undefined, 'a running task needs nobody');
});
t('a task becomes cloud work through its House team: the Team line, the workflow, the note the cycle looks for, and the requests found by that note', () => {
  assert.deepEqual(plain(U.HOUSE_TEAM), { gigi: 'youtube', lulu: 'software', poppy: 'ebooks', fifi: 'courses', zaza: 'games', mochi: 'comics', tilly: 'commerce' });
  assert.equal(U.teamLine('poppy'), 'Team: ebooks'); assert.equal(U.teamLine('nope'), ''); assert.equal(U.teamLine(null), '');
  assert.equal(U.teamOfTask(tk('queued', { house_id: 'gigi' })), 'youtube'); assert.equal(U.teamOfTask(tk('queued', { house_id: 'gigi', details: 'Team: Software\nwords' })), 'software', 'a Team line in the details wins'); assert.equal(U.teamOfTask(tk('queued', { house_id: null })), null);
  const t1 = tk('queued', { id: 'abc-1', title: 'T'.repeat(300) }); assert.equal(U.requestNote(t1), 'coco-task:abc-1 \u00b7 ' + 'T'.repeat(160));
  const reqs = [{ id: 3, note: 'coco-task:abc-1 \u00b7 x', state: 'failed', reason: 'AI credit too low' }, { id: 5, note: 'coco-task:abc-1 \u00b7 y', state: 'pending' }, { id: 4, note: 'coco-task:zzz \u00b7 other', state: 'pending' }];
  assert.deepEqual(plain(U.requestsOf(reqs, 'abc-1').map((r) => r.id)), [5, 3]); assert.equal(U.openRequest(reqs, 'abc-1').id, 5); assert.equal(U.openRequest(reqs, 'nope'), null);
  assert.equal(U.requestWords(reqs[1]), 'Waiting for the next cloud run (request #5)'); assert.equal(U.requestWords(reqs[0]), 'The cloud run failed (request #3): AI credit too low');
});
t('Alerts include failed cloud run requests with the cloud own reason, and Claude policy blocks', () => {
  const s = S0(); s.runRequests = [{ id: 8, workflow_id: 'youtube-pick', state: 'failed', reason: 'this month would pass the agent monthly limit', created_at: '2026-11-12T05:39:00Z', finished_at: '2026-11-12T05:39:37Z', note: 'coco-task:x' }, { id: 7, workflow_id: 'ebooks-pick', state: 'failed', reason: 'credit balance too low', created_at: '2026-11-03T06:28:00Z', finished_at: '2026-11-03T06:28:17Z' }, { id: 1, workflow_id: 'old', state: 'failed', reason: 'ancient', created_at: '2026-09-01T00:00:00Z', finished_at: '2026-09-01T00:00:01Z' }, { id: 9, workflow_id: 'fine', state: 'done', created_at: AT }];
  s.policies = [{ scope: 'agent', scope_id: 'youtube.marquee', key: 'claude', value: 'denied' }, { scope: 'agent', scope_id: 'ebooks.ebooks-head', key: 'claude', value: '"blocked"' }, { scope: 'agent', scope_id: 'core.nova', key: 'claude', value: 'on_demand' }, { scope: 'team', scope_id: 'x', key: 'paused', value: true }];
  const a = U.attention(s, Date.parse('2026-11-12T08:00:00Z')), rr = a.find((x) => x.kind === 'runreq'), pol = a.filter((x) => x.kind === 'policy');
  assert.equal(rr.title, '2 cloud run requests failed', 'two within 14 days, the ancient one is not an alert'); assert.equal(rr.tone, 'bad'); assert.match(rr.sub, /latest #8 \(youtube-pick\): this month would pass the agent monthly limit/);
  assert.deepEqual(plain(pol.map((p) => p.title)), ['Claude is denied for agent youtube.marquee', 'Claude is blocked for agent ebooks.ebooks-head']); assert.equal(U.policyWord({ value: '"blocked"' }), 'blocked');
  assert.equal(U.attention({ ...S0(), runRequests: [{ id: 4, workflow_id: 'w', state: 'refused', reason: 'the company is stopped (Coco)', created_at: '2026-11-01T00:00:00Z', finished_at: '2026-11-01T00:00:00Z' }] }, Date.parse('2026-11-05T00:00:00Z')).find((x) => x.kind === 'runreq').tone, 'warn', 'an older failure is a warning, a recent one is an error');
});

console.log(`\nui-kit: ${pass} passed`);
