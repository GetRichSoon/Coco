// Production targets -> planned work. Pure functions: no database, no clock of their own (`now` is passed in).
//
//   planSlots(settings, now, existing)   the slots the settings call for, from today (in the template's timezone) over the planning horizon
//   reconcile(existing, desired, today)  what to insert, update, cancel and leave alone
//
// Rules that matter:
//   * a day's count comes from the daily target; with no daily target the weekly (or monthly) target is spread over the operating days of
//     that week (month), the remainder going to the earliest days; weekly/monthly targets are also CAPS on a daily target
//   * work already started or finished in a period counts against that period's caps, so lowering a target mid-week is honoured
//   * only planned (unstarted) work ever changes: running, finished and failed rows are history and are never touched, and a row that is no
//     longer wanted is CANCELLED, never deleted
import { DELIVERABLES } from './_template_schema.js';

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (now, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const isoWeekday = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w === 0 ? 7 : w; };
const weekStart = (d) => addDays(d, 1 - isoWeekday(d));
const monthKey = (d) => d.slice(0, 7);
const tzOffsetMs = (ms, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
};
// 'YYYY-MM-DD' + 'HH:MM' in a timezone -> the UTC instant (a second pass settles the daylight-saving edge)
export function localToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number), guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}
const spread = (total, days) => { const base = Math.floor(total / days.length), extra = total % days.length; return new Map(days.map((d, i) => [d, base + (i < extra ? 1 : 0)])); };

// existing: rows already in the database for this target, {deliverable, local_date, seq, status}; the started ones count against caps
export function planSlots(settings, now, existing = []) {
  const tz = settings.basics.timezone, t = settings.targets, today = localDate(now, tz);
  const first = t.start_date && t.start_date > today ? t.start_date : today;
  const horizonEnd = addDays(today, t.horizon_days - 1), last = t.end_date && t.end_date < horizonEnd ? t.end_date : horizonEnd;
  const days = []; for (let d = first; d <= last; d = addDays(d, 1)) if (t.operating_days.includes(isoWeekday(d))) days.push(d);
  const started = existing.filter((r) => ['queued', 'running', 'done', 'failed'].includes(r.status));
  const out = [];
  for (const dv of DELIVERABLES) {
    const tg = t.deliverables?.[dv] || {};
    if (![tg.daily, tg.weekly, tg.monthly].some((x) => x != null && x > 0)) continue;
    const counts = new Map();                              // local_date -> how many this deliverable wants that day
    const opInWeek = (d) => { const s = weekStart(d), o = []; for (let i = 0; i < 7; i++) { const x = addDays(s, i); if (t.operating_days.includes(isoWeekday(x))) o.push(x); } return o; };
    const opInMonth = (d) => { const o = []; for (let x = d.slice(0, 7) + '-01'; monthKey(x) === monthKey(d); x = addDays(x, 1)) if (t.operating_days.includes(isoWeekday(x))) o.push(x); return o; };
    const cache = new Map();
    for (const d of days) {
      if (tg.daily != null) { counts.set(d, tg.daily); continue; }
      const key = tg.weekly != null ? 'w' + weekStart(d) : 'm' + monthKey(d);
      if (!cache.has(key)) cache.set(key, spread(tg.weekly != null ? tg.weekly : tg.monthly, tg.weekly != null ? opInWeek(d) : opInMonth(d)));
      counts.set(d, cache.get(key).get(d) || 0);
    }
    // weekly and monthly caps (a cap and a daily target can both be set); work already started in the period counts first
    for (const [per, keyOf, cap] of [['weekly', weekStart, tg.weekly], ['monthly', monthKey, tg.monthly]]) {
      if (cap == null || (per === 'weekly' && tg.daily == null) || (per === 'monthly' && tg.daily == null && tg.weekly == null)) continue;
      const used = new Map();
      for (const r of started) if (r.deliverable === dv) used.set(keyOf(r.local_date), (used.get(keyOf(r.local_date)) || 0) + 1);
      for (const d of days) { const k = keyOf(d), room = Math.max(0, cap - (used.get(k) || 0)), want = Math.min(counts.get(d) || 0, room); counts.set(d, want); used.set(k, (used.get(k) || 0) + want); }
    }
    for (const d of days) for (let seq = 1; seq <= (counts.get(d) || 0); seq++) {
      // a slot that has already started or finished keeps its place: it is history, and a new one is not planned on top of it
      const time = t.times[(seq - 1) % t.times.length];
      out.push({ deliverable: dv, local_date: d, seq, planned_for: localToUtc(d, time, tz) });
    }
  }
  out.sort((a, b) => a.planned_for - b.planned_for || a.deliverable.localeCompare(b.deliverable) || a.seq - b.seq);
  // the backlog limit: only that many unstarted items may wait at once (the earliest ones)
  const occupied = new Set(existing.filter((r) => ['queued', 'running', 'done', 'failed'].includes(r.status)).map((r) => `${r.deliverable}|${r.local_date}|${r.seq}`));
  const fresh = out.filter((s) => !occupied.has(`${s.deliverable}|${s.local_date}|${s.seq}`));
  return fresh.slice(0, t.backlog_limit);
}

const keyOf = (r) => `${r.deliverable}|${typeof r.local_date === 'string' ? r.local_date.slice(0, 10) : new Date(r.local_date).toISOString().slice(0, 10)}|${r.seq}`;
// existing: all rows of this template+target from today on; desired: planSlots(...). History (running/done/failed) is returned as `untouched`.
export function reconcile(existing, desired) {
  const want = new Map(desired.map((s) => [keyOf(s), s])), have = new Map(existing.map((r) => [keyOf(r), r]));
  const r = { insert: [], update: [], reactivate: [], cancel: [], keep: 0, untouched: 0 };
  for (const [k, s] of want) {
    const row = have.get(k);
    if (!row) { r.insert.push(s); continue; }
    if (row.status === 'planned' || row.status === 'queued') { if (+new Date(row.planned_for) !== +s.planned_for) r.update.push({ id: row.id, planned_for: s.planned_for }); else r.keep++; }
    else if (row.status === 'cancelled') r.reactivate.push({ id: row.id, planned_for: s.planned_for });
    else r.untouched++;
  }
  for (const [k, row] of have) {
    if (want.has(k)) continue;
    if (row.status === 'planned' || row.status === 'queued') r.cancel.push({ id: row.id, status: row.status, job_id: row.job_id || null });
    else if (row.status !== 'cancelled') r.untouched++;
  }
  return r;
}
