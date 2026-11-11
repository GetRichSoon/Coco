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

console.log(`\nui-kit: ${pass} passed`);
