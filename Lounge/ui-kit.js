/* Coco UI kit: the pure helpers behind the unified Home, House workspaces and Insights.
   No DOM, no network, no globals read: everything comes in as arguments, so node can test it (ui-kit.test.js) and the page,
   the desktop app and the phone all compute the same numbers.  Loaded as a classic script before index.html's own script,
   it publishes window.CocoUI.

   The one rule it enforces everywhere: a number is either a recorded fact with a source, or it is "unavailable".
   Missing data is never turned into a zero, and an estimate is never shown as an actual. */
(function (root) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------- periods
  // Every period is a [from, to] pair of YYYY-MM-DD days (UTC, inclusive) plus the equivalent period just before it.
  const DAY = 86400000;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
  const PERIODS = [['today', 'Today'], ['7d', '7 days'], ['28d', '28 days'], ['90d', '90 days'], ['month', 'This month'], ['custom', 'Custom']];
  function periodRange(key, now, custom) {
    const today = new Date(iso(now || new Date()) + 'T00:00:00Z');
    let from, to = today, label;
    if (key === 'today') { from = today; label = 'Today'; }
    else if (key === '7d') { from = addDays(today, -6); label = 'Last 7 days'; }
    else if (key === '90d') { from = addDays(today, -89); label = 'Last 90 days'; }
    else if (key === 'month') { from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); label = 'This month'; }
    else if (key === 'custom' && custom && /^\d{4}-\d{2}-\d{2}$/.test(custom.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(custom.to || '') && custom.from <= custom.to) {
      from = new Date(custom.from + 'T00:00:00Z'); to = new Date(custom.to + 'T00:00:00Z'); label = `${custom.from} to ${custom.to}`;
    } else { from = addDays(today, -27); label = 'Last 28 days'; key = '28d'; }
    const days = Math.round((to - from) / DAY) + 1;
    const prevTo = addDays(from, -1), prevFrom = addDays(prevTo, -(days - 1));
    return { key, label, from: iso(from), to: iso(to), days, prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
  }
  const within = (day, a, b) => !!day && String(day).slice(0, 10) >= a && String(day).slice(0, 10) <= b;

  // ---------------------------------------------------------------- the organisation tree
  // Everything is "under" a unit through parent_id; the id prefix ("gigi.youtube") is only a fallback for rows without a parent.
  function descendants(units, rootId) {
    const out = new Set([rootId]);
    let grew = true;
    while (grew) { grew = false; for (const u of units || []) if (!out.has(u.id) && (out.has(u.parent_id) || String(u.id).startsWith(rootId + '.'))) { out.add(u.id); grew = true; } }
    return out;
  }
  // The set of unit ids a filter selects: the most specific choice wins; "all" selects everything (null = no restriction).
  function scopeUnits(units, f) {
    f = f || {};
    const pick = f.category || f.team || (f.house && f.house !== 'all' ? f.house : null);
    return pick ? descendants(units, pick) : null;
  }
  // outputs/jobs are tagged with the registry team name ("youtube"), not a unit id: match on the unit id's last segment too.
  function scopeNames(units, set) {
    if (!set) return null;
    const names = new Set();
    for (const id of set) { names.add(id); names.add(String(id).split('.').pop()); }
    return names;
  }

  // ---------------------------------------------------------------- metrics (org_metrics rows: metric, period, value, unit, source, unit_id, product_id)
  const KINDS = {
    revenue: ['revenue'],
    views: ['views'],
    sales: ['sales', 'orders', 'purchases', 'downloads'],
    audience: ['subscribers', 'followers', 'audience', 'players', 'users'],
    installs: ['installs'],
  };
  function selectMetrics(rows, o) {
    o = o || {};
    return (rows || []).filter((m) => {
      if (m.value == null || m.value === '' || !Number.isFinite(Number(m.value))) return false;   // no value recorded is not a value of 0
      if (o.kind && !KINDS[o.kind].includes(String(m.metric).toLowerCase())) return false;
      if (o.names && !o.names.includes(String(m.metric).toLowerCase())) return false;
      if (o.productIds && !o.productIds.has(m.product_id)) return false;
      if (o.units && !o.units.has(m.unit_id)) return false;
      if (o.productId && m.product_id !== o.productId) return false;
      if (o.currency && o.currency !== 'all' && String(m.unit) !== o.currency) return false;
      if (o.from && !within(m.period, o.from, o.to)) return false;
      return true;
    });
  }
  const isEstimate = (m) => /estimat|forecast|project|target|plan/i.test(String(m.source || ''));
  // Totals per unit of measure. Currencies are never added together: no reliable exchange rate exists in Coco.
  function totals(rows) {
    const by = new Map();
    for (const m of rows) {
      const key = String(m.unit || '');
      const t = by.get(key) || { unit: key, total: 0, n: 0, actual: 0, estimated: 0, sources: new Set(), latest: null };
      const v = Number(m.value); if (!Number.isFinite(v)) continue;
      t.total += v; t.n++; (isEstimate(m) ? (t.estimated += v) : (t.actual += v));
      t.sources.add(String(m.source || 'unknown'));
      const at = m.recorded_at || m.period; if (at && (!t.latest || String(at) > String(t.latest))) t.latest = at;
      by.set(key, t);
    }
    // `total` is the figure to SHOW: the actual amount whenever any actual exists (estimates are reported beside it, never inside it), else the estimate.
    return [...by.values()].map((t) => { const basis = t.estimated && t.actual ? 'mixed' : t.estimated ? 'estimated' : 'actual'; return { ...t, sources: [...t.sources], basis, all: t.total, total: basis === 'estimated' ? t.estimated : t.actual }; });
  }
  // A headline number with its provenance. `state` is one of: unavailable | none_in_period | actual | estimated | mixed.
  function headline(allRows, kind, range, o) {
    o = o || {};
    const base = { units: o.units, productId: o.productId, productIds: o.productIds, currency: o.currency, kind, names: o.names };
    const everRows = selectMetrics(allRows, base);            // anything ever recorded for this scope
    if (!everRows.length) return { state: 'unavailable', totals: [], prev: [], delta: null, sources: [], latest: null, coverage: 0 };
    const cur = selectMetrics(allRows, { ...base, from: range.from, to: range.to });
    const prev = selectMetrics(allRows, { ...base, from: range.prevFrom, to: range.prevTo });
    const t = totals(cur), pt = totals(prev);
    if (!t.length) return { state: 'none_in_period', totals: [], prev: pt, delta: null, sources: [...new Set(everRows.map((m) => String(m.source || 'unknown')))], latest: everRows.map((m) => m.recorded_at || m.period).sort().pop(), coverage: everRows.length };
    // change vs the preceding equivalent period, only where both periods have the same unit and a non-zero base
    const delta = t.map((x) => { const p = pt.find((y) => y.unit === x.unit); return p && p.total !== 0 && p.basis === x.basis ? { unit: x.unit, pct: ((x.total - p.total) / Math.abs(p.total)) * 100 } : null; }).filter(Boolean);
    const basis = t.every((x) => x.basis === 'actual') ? 'actual' : t.every((x) => x.basis === 'estimated') ? 'estimated' : 'mixed';
    return { state: basis, totals: t, prev: pt, delta, sources: [...new Set(cur.map((m) => String(m.source || 'unknown')))], latest: cur.map((m) => m.recorded_at || m.period).sort().pop(), coverage: cur.length };
  }
  // Net change of a cumulative metric (subscribers, followers) between the first and last record in the period, per unit of measure.
  function growth(allRows, range, o) {
    o = o || {};
    const rows = selectMetrics(allRows, { units: o.units, productId: o.productId, kind: 'audience', from: range.from, to: range.to })
      .filter((m) => Number.isFinite(Number(m.value))).sort((a, b) => String(a.period).localeCompare(String(b.period)));
    if (rows.length < 2) return rows.length ? { state: 'single', value: Number(rows[0].value), unit: rows[0].unit, source: rows[0].source } : { state: 'unavailable' };
    // per product so two channels are not subtracted from each other
    const per = new Map();
    for (const m of rows) { const k = (m.product_id || m.unit_id) + '|' + m.metric; (per.get(k) || per.set(k, []).get(k)).push(m); }
    let net = 0, n = 0, unit = rows[0].unit;
    for (const list of per.values()) if (list.length > 1) { net += Number(list[list.length - 1].value) - Number(list[0].value); n++; }
    return n ? { state: 'delta', value: net, unit, series: n, source: [...new Set(rows.map((m) => m.source))].join(', ') } : { state: 'single', value: Number(rows[rows.length - 1].value), unit, source: rows[rows.length - 1].source };
  }
  // The audience over time: on every day any channel reported, the sum of each channel's latest known count (a cumulative metric,
  // so channels reporting on different days are carried forward, never added twice or dropped).
  function audienceSeries(rows, range, unit) {
    const list = selectMetrics(rows, { kind: 'audience', from: range.from, to: range.to }).filter((m) => String(m.unit) === unit && Number.isFinite(Number(m.value)));
    const days = [...new Set(list.map((m) => String(m.period).slice(0, 10)))].sort();
    const last = new Map(); const out = [];
    for (const d of days) { for (const m of list) if (String(m.period).slice(0, 10) === d) last.set((m.product_id || m.unit_id) + '|' + m.metric, Number(m.value)); out.push({ x: d, y: [...last.values()].reduce((a, b) => a + b, 0) }); }
    return out;
  }
  // A day-by-day series for a chart (sums rows that share a day).
  function seriesByDay(rows, range, unit) {
    const sum = new Map();
    for (const m of rows) if (String(m.unit) === unit && within(m.period, range.from, range.to)) sum.set(String(m.period).slice(0, 10), (sum.get(String(m.period).slice(0, 10)) || 0) + Number(m.value));
    return [...sum.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
  }

  // ---------------------------------------------------------------- formatting
  function fmtNum(n) { const v = Number(n); if (!Number.isFinite(v)) return '—'; return Math.abs(v) >= 100000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : v.toLocaleString('en'); }
  function fmtMoney(n, cur) {
    const v = Number(n); if (!Number.isFinite(v)) return '—';
    if (/^[A-Z]{3}$/.test(String(cur))) { try { return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: cur, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v); } catch (e) { /* fall through */ } }
    return `${esc(cur || '')} ${fmtNum(v)}`.trim();
  }
  const fmtPct = (p) => (p == null || !Number.isFinite(p)) ? '' : `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(Math.abs(p) >= 10 ? 0 : 1)}%`;
  function ago(iso0, now) { if (!iso0) return 'never'; const s = ((now || Date.now()) - new Date(iso0)) / 1000; if (!Number.isFinite(s)) return 'unknown'; return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; }

  // ---------------------------------------------------------------- charts (inline SVG, theme colours through CSS variables)
  const nice = (max) => { if (!(max > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const r = max / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; };
  // series: [{x:'YYYY-MM-DD', y:number}]. Returns '' when there is nothing to draw: the caller shows an honest empty state instead of an empty axis.
  function lineChart(series, o) {
    o = o || {};
    if (!series || !series.length) return '';
    const W = o.w || 640, H = o.h || 220, L = 52, R = 14, T = 12, B = 30, cw = W - L - R, ch = H - T - B;
    const col = o.color || 'var(--chart-1)', top = nice(Math.max(...series.map((p) => p.y), 0)), n = series.length;
    const X = (i) => L + (n === 1 ? cw / 2 : (i / (n - 1)) * cw), Y = (v) => T + ch - (v / top) * ch;
    const pts = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`);
    const area = n > 1 ? `<path d="M${X(0).toFixed(1)},${(T + ch).toFixed(1)} L${pts.join(' L')} L${X(n - 1).toFixed(1)},${(T + ch).toFixed(1)} Z" fill="${col}" opacity=".14"/>` : '';
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${(T + ch - f * ch).toFixed(1)}" y2="${(T + ch - f * ch).toFixed(1)}" stroke="var(--outline)" stroke-width="1"/><text x="${L - 8}" y="${(T + ch - f * ch + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${esc((o.fmt || fmtNum)(top * f))}</text>`).join('');
    const dots = n <= 40 ? series.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${col}"><title>${esc(p.x)}: ${esc((o.fmt || fmtNum)(p.y))}</title></circle>`).join('') : '';
    const xl = n > 1 ? `<text x="${L}" y="${H - 8}" font-size="11" fill="var(--muted)">${esc(series[0].x)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--muted)">${esc(series[n - 1].x)}</text>` : `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(series[0].x)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Trend')}" preserveAspectRatio="xMidYMid meet"><title>${esc(o.label || 'Trend')}</title>${grid}${area}${n > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}${dots}${xl}</svg>`;
  }
  // items: [{label, value, color?, note?}] drawn as horizontal bars with the value at the end.
  function barChart(items, o) {
    o = o || {};
    items = (items || []).filter((i) => Number.isFinite(Number(i.value)));
    if (!items.length) return '';
    const fmt = o.fmt || fmtNum, max = Math.max(...items.map((i) => Number(i.value)), 0) || 1;
    return `<div class="bars" role="img" aria-label="${esc(o.label || 'Comparison')}">${items.map((i) => `<div class="barrow"><span class="barlabel" title="${esc(i.label)}">${esc(i.label)}</span><span class="bartrack"><span class="barfill" style="width:${Math.max(2, (Number(i.value) / max) * 100).toFixed(1)}%;background:${esc(i.color || 'var(--chart-1)')}"></span></span><span class="barval">${esc(fmt(i.value))}${i.note ? `<small>${esc(i.note)}</small>` : ''}</span></div>`).join('')}</div>`;
  }
  // rows: [{label, planned, actual}] target against actual, side by side.
  function targetChart(rows, o) {
    o = o || {};
    rows = (rows || []).filter((r) => Number.isFinite(Number(r.planned)) && Number.isFinite(Number(r.actual)));
    if (!rows.length) return '';
    const max = Math.max(...rows.flatMap((r) => [r.planned, r.actual]), 1);
    return `<div class="bars" role="img" aria-label="${esc(o.label || 'Target against actual')}">${rows.map((r) => `<div class="tgtrow"><span class="barlabel" title="${esc(r.label)}">${esc(r.label)}</span><span class="tgtbars"><span class="bartrack"><span class="barfill" style="width:${Math.max(r.planned ? 2 : 0, (r.planned / max) * 100).toFixed(1)}%;background:var(--outline)"></span></span><span class="bartrack"><span class="barfill" style="width:${Math.max(r.actual ? 2 : 0, (r.actual / max) * 100).toFixed(1)}%;background:var(--chart-1)"></span></span></span><span class="barval">${esc(r.actual)} / ${esc(r.planned)}</span></div>`).join('')}<div class="legend"><i style="background:var(--outline)"></i>Target (planned)<i style="background:var(--chart-1)"></i>Actual (created)</div></div>`;
  }

  // ---------------------------------------------------------------- operations: tasks, jobs, approvals, the worker, what needs the founder
  // Everything below reads the ORIGINAL tables (tasks, jobs, run_requests, approvals, devices, policies, integrations, integration_accounts, yt_stats and the
  // revenue tables) as plain arrays. No org_* table is needed and nothing here touches the network or the page.
  // Task status words in production: planned, queued, working, need_approval, blocked, failed, verifying, done, paused, cancelled, running, waiting_pc, needs_yes, stopped.
  // working and running are RUNNING; verifying is "finished, needs a check" (not running); blocked, needs_yes and need_approval need the founder; cancelled and stopped are stopped.
  const T_OPEN = ['planned', 'queued', 'running', 'working', 'verifying', 'need_approval', 'needs_yes', 'waiting_pc', 'blocked', 'paused'];
  const T_RUNNING = ['running', 'working'];
  const T_ENDED = ['done', 'stopped', 'cancelled'];
  const taskGroup = (s) => (s === 'done' ? 'done' : s === 'failed' ? 'failed' : T_ENDED.includes(s) ? 'stopped' : 'open');
  const PRIORITIES = [[1, 'High'], [2, 'Normal'], [3, 'Low']];
  const priorityName = (p) => (PRIORITIES.find((x) => x[0] === Number(p)) || [0, 'Normal'])[1];
  // The state machine of tasks.status. Start asks for a run (planned or queued -> queued, with the request noted); "running" is never set here, only a worker's claim sets it.
  const FROM = {
    start: ['planned', 'queued'], pause: ['queued', 'running', 'working', 'waiting_pc'], resume: ['paused'], retry: ['failed'], done: ['verifying'],
    cancel: T_OPEN.concat('failed'), assign: T_OPEN.concat('failed'),
  };
  const ACTION_NAME = { start: 'started', pause: 'paused', resume: 'resumed', retry: 'retried', done: 'closed', cancel: 'stopped', assign: 'assigned', priority: 'changed' };
  // ---- the real path from a task to cloud work today: a run request for the House's team workflow, picked up by the next cloud run
  const HOUSE_TEAM = { gigi: 'youtube', lulu: 'software', poppy: 'ebooks', fifi: 'courses', zaza: 'games', mochi: 'comics', tilly: 'commerce' };
  const teamLine = (houseId) => (HOUSE_TEAM[houseId] ? `Team: ${HOUSE_TEAM[houseId]}` : '');
  // the team a task is for: its own first "Team: x" line wins, else the team of its House
  function teamOfTask(t) { const m = /^\s*Team:\s*([a-z0-9][a-z0-9._-]*)/im.exec(String((t && t.details) || '')); return (m && m[1].toLowerCase()) || (t && HOUSE_TEAM[t.house_id]) || null; }
  const requestNote = (t) => `coco-task:${t.id} · ${String(t.title || '').slice(0, 160)}`;
  const requestsOf = (reqs, taskId) => (reqs || []).filter((r) => String(r.note || '').startsWith('coco-task:' + taskId)).sort((a, b) => Number(b.id) - Number(a.id));
  const openRequest = (reqs, taskId) => requestsOf(reqs, taskId).find((r) => ['pending', 'claimed'].includes(r.state)) || null;
  const REQ_NAME = { pending: 'Waiting for the next cloud run', claimed: 'Picked up by the cloud run, waiting for its result', failed: 'The cloud run failed', refused: 'The cloud run was refused', done: 'The cloud run finished' };
  const requestWords = (r) => `${REQ_NAME[r.state] || 'Cloud run ' + r.state} (request #${r.id})${r.reason && ['failed', 'refused'].includes(r.state) ? ': ' + String(r.reason).slice(0, 220) : ''}`;
  // the actions a task offers in its status, main one first. Start is offered while no cloud run is already requested for it.
  function taskActions(task, o) {
    o = o || {}; const out = [];
    if (task.status === 'planned' || (task.status === 'queued' && (task.needs || 'any') !== 'pc' && !o.hasOpenRequest)) out.push('start');   // a PC task is claimed by a PC; there is no cloud run to ask for
    if (task.status === 'paused') out.push('resume');
    if (task.status === 'failed') out.push('retry');
    if (task.status === 'verifying') out.push('done');
    if (FROM.pause.includes(task.status)) out.push('pause');
    if (FROM.cancel.includes(task.status)) out.push('cancel');
    return out;
  }
  // The one write for an action: { ok, patch, guard } or { ok:false, why }. `guard` is the set of statuses the row must still be in, so a
  // second device (or a stale screen) changes nothing and is told so. A claim is cleared when work goes back to the queue, otherwise
  // claim_task (which wants claimed_by_device to be empty) could never pick it up again.
  function taskChange(action, task, o, now) {
    o = o || {};
    const at = new Date(now || Date.now()).toISOString(), word = String(task.status || '').replace(/_/g, ' ');
    if (FROM[action] && !FROM[action].includes(task.status)) return { ok: false, why: `A ${word} task cannot be ${ACTION_NAME[action]}` };
    const free = { claimed_by_device: null, claimed_at: null, heartbeat_at: null, stale: false };
    if (action === 'start') return { ok: true, patch: { status: 'queued', ...(o.request ? { result: `Waiting for the next cloud run (request #${o.request.id})` } : {}), updated_at: at }, guard: FROM.start };
    if (action === 'pause') return { ok: true, patch: { status: 'paused', updated_at: at }, guard: FROM.pause };
    if (action === 'resume') return { ok: true, patch: { status: 'queued', ...free, updated_at: at }, guard: FROM.resume };
    if (action === 'done') return { ok: true, patch: { status: 'done', updated_at: at }, guard: FROM.done };   // the database insists on a result or evidence
    if (action === 'retry') {
      const n = (Number(task.retry_count) || 0) + 1;
      return { ok: true, patch: { status: 'queued', retry_count: n, error: null, ...free, updated_at: at }, guard: FROM.retry, note: `Retry ${n}.${task.error ? ' Previous error: ' + String(task.error).slice(0, 300) : ''}` };
    }
    if (action === 'cancel') return { ok: true, patch: { status: 'stopped', updated_at: at }, guard: FROM.cancel };
    if (action === 'priority') {
      const p = Number(o.priority);
      return [1, 2, 3].includes(p) ? { ok: true, patch: { priority: p, updated_at: at }, guard: null } : { ok: false, why: 'Priority is High, Normal or Low' };
    }
    if (action === 'assign') {
      const patch = { updated_at: at };
      if ('member_id' in o) patch.member_id = o.member_id || null;
      if ('house_id' in o) patch.house_id = o.house_id || null;
      if ('pipeline_id' in o) { patch.pipeline_id = o.pipeline_id || null; if (!o.pipeline_id) patch.step = null; }
      return Object.keys(patch).length > 1 ? { ok: true, patch, guard: FROM.assign } : { ok: false, why: 'Choose who or what to assign' };
    }
    return { ok: false, why: 'Unknown action' };
  }
  // pipeline progress: "step 3 of 6" only when the worker has recorded a step; otherwise "not started" (never an invented percentage)
  function taskProgress(task, pipelines) {
    if (!task.pipeline_id) return null;
    const p = (pipelines || []).find((x) => x.id === task.pipeline_id), of = p && Array.isArray(p.steps) ? p.steps.length : null;
    const has = task.step !== null && task.step !== undefined && Number.isFinite(Number(task.step));
    const step = has ? Number(task.step) : null;
    return { pipeline: p ? p.name : task.pipeline_id, step, of, label: step === null ? 'not started' : of ? `step ${step} of ${of}` : `step ${step}`, ratio: step !== null && of ? Math.min(1, step / of) : null };
  }
  // Who can run work. The cloud worker runs on a schedule (a few times a day), so a cloud device is judged by that: "active" means it checked in within 12 hours,
  // and a longer silence is said as "last run X ago", never as "offline". PCs are online on a heartbeat of a couple of minutes. `jobs` adds the latest job activity.
  const WORKER_FRESH_MS = 12 * 3600 * 1000;
  function workerStatus(devices, now, jobs) {
    now = now || Date.now();
    const list = (devices || []).filter((d) => d.active !== false), seen = (d) => (d && d.last_seen ? new Date(d.last_seen).getTime() : null);
    const fresh = (d, ms) => seen(d) !== null && now - seen(d) <= ms;
    const cw = list.find((d) => /cloud-worker/.test(String(d.id)) || (d.info && d.info.cloud === true)) || null;
    const lastJob = (jobs || []).map((j) => j.completed_at).filter(Boolean).sort().pop() || null;
    return { cloud: cw ? { id: cw.id, name: cw.name, lastSeen: cw.last_seen || null, online: fresh(cw, WORKER_FRESH_MS), lastJob } : null, pcOnline: list.some((d) => d !== cw && d.kind === 'pc' && fresh(d, 150000)) };
  }
  // why a queued task is not moving, in words; null when it is not waiting at all. Cloud work only moves when a cloud run was asked for (Start) and then waits for the next
  // scheduled cloud run (a few times a day); it is never "running" until a worker claims it.
  function taskWait(task, w, now, o) {
    if (!['queued', 'waiting_pc'].includes(task.status)) return null;
    o = o || {};
    const needs = task.needs || 'any', pc = w && w.pcOnline, cw = w && w.cloud;
    const last = cw && cw.lastSeen ? ` (the cloud last ran ${ago(cw.lastSeen, now)})` : '';
    if (needs === 'pc') return pc ? 'Queued: an online PC can claim it' : 'Waiting for a PC: no PC is online';
    if (o.hasOpenRequest) return `Waiting for the next cloud run${last}`;
    if (needs === 'any' && pc) return 'Queued: an online PC can claim it';
    if (!cw) return 'Not running: no cloud worker is paired, so nothing can run it in the cloud';
    return `Not asked to run yet: press Start to ask the cloud for a run${last}`;
  }
  // runtime team ids (youtube, ebooks, software ...), platform ids and House ids all map to a House through the navigation contract
  function houseOfTeam(nav, id) {
    const t = String(id || '').toLowerCase().split(/[/.]/)[0].trim(), hs = (nav && nav.houses) || [];
    if (!t) return null;
    const h = hs.find((x) => x.id === t) || hs.find((x) => String(x.domain).toLowerCase() === t) || hs.find((x) => (x.platforms || []).includes(t));
    return h ? h.id : null;
  }
  // free text such as "Social Media" or "YouTube" (approvals.team): any word that is a House id, domain or platform
  function houseOfText(nav, text) {
    for (const w of String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) { const h = houseOfTeam(nav, w); if (h) return h; }
    return null;
  }
  // a pipeline step is { do, tools, where, member }
  const stepsOf = (p) => (p && Array.isArray(p.steps) ? p.steps : []);
  const jobProblem = (j) => (j.error && typeof j.error === 'object' ? j.error.message || j.error.kind || '' : String(j.error || ''));
  // policies: a row { scope, scope_id, key, value } where value is jsonb ("denied", "blocked", "on_demand" ...)
  const policyWord = (p) => String(p && p.value != null ? p.value : '').replace(/^"|"$/g, '');
  const claudeBlocks = (policies) => (policies || []).filter((p) => p.key === 'claude' && ['denied', 'blocked'].includes(policyWord(p)));
  // The Needs-attention list: each item says what it is, how bad, and which actions it offers (approve/reject, retry/cancel, reconnect, open).
  function attention(S, now) {
    now = now || Date.now();
    const out = [], rank = { bad: 0, warn: 1, info: 2 };
    for (const a of S.approvals || []) if (a.state === 'waiting') out.push({ kind: 'approval', id: a.id, tone: 'warn', title: `${a.code}: ${a.what}`, sub: [a.team, a.raised_on].filter(Boolean).join(' · '), actions: ['approve', 'reject'], href: '#approvals:' + a.id });
    for (const t of S.tasks || []) {
      const why = t.error ? ': ' + String(t.error).slice(0, 140) : '';
      if (t.status === 'failed') out.push({ kind: 'task', id: t.id, tone: 'bad', title: t.title, sub: 'Task failed' + why, actions: ['retry', 'cancel'], href: '#tasks:' + t.id });
      else if (t.status === 'blocked') out.push({ kind: 'task', id: t.id, tone: 'warn', title: t.title, sub: 'Task blocked' + why, actions: ['cancel'], href: '#tasks:' + t.id });
      else if (t.status === 'needs_yes' || t.status === 'need_approval') out.push({ kind: 'task', id: t.id, tone: 'warn', title: t.title, sub: 'Needs your YES before it can go on', actions: ['cancel'], href: '#tasks:' + t.id });
      else if (t.status === 'verifying') out.push({ kind: 'task', id: t.id, tone: 'warn', title: t.title, sub: 'Finished: needs your check' + (t.result ? ' · ' + String(t.result).slice(0, 100) : ''), actions: ['done', 'cancel'], href: '#tasks:' + t.id });
    }
    for (const j of S.jobs || []) {
      if (j.status === 'failed') out.push({ kind: 'job', id: j.id, tone: 'bad', title: `Job ${j.type} failed`, sub: [j.team_id, jobProblem(j)].filter(Boolean).join(' · ').slice(0, 160), actions: ['retry'], href: '#tasks' });
      else if (j.status === 'blocked') out.push({ kind: 'job', id: j.id, tone: 'warn', title: `Job ${j.type} is blocked`, sub: [j.team_id, jobProblem(j)].filter(Boolean).join(' · ').slice(0, 160), actions: ['cancel'], href: '#tasks' });
    }
    // cloud run requests that failed or were refused: the reason is the cloud's own (AI credit, monthly agent limit, policy, company stop)
    const reqs = (S.runRequests || []).filter((r) => ['failed', 'refused'].includes(r.state) && now - new Date(r.finished_at || r.created_at).getTime() < 14 * 864e5).sort((a, b) => Number(b.id) - Number(a.id));
    if (reqs.length) out.push({ kind: 'runreq', id: String(reqs[0].id), tone: now - new Date(reqs[0].finished_at || reqs[0].created_at).getTime() < 3 * 864e5 ? 'bad' : 'warn', title: `${reqs.length} cloud run request${reqs.length === 1 ? '' : 's'} failed`, sub: `latest #${reqs[0].id} (${reqs[0].workflow_id}): ${String(reqs[0].reason || 'no reason recorded').slice(0, 170)}`, actions: [], href: '#tasks' });
    // Claude denied or blocked for an agent: its AI step is refused, so its tasks fail at once
    const blocks = claudeBlocks(S.policies);
    for (const p of blocks.slice(0, 3)) out.push({ kind: 'policy', id: p.scope_id, tone: 'warn', title: `Claude is ${policyWord(p)} for ${p.scope} ${p.scope_id}`, sub: 'Policy: this agent’s AI step is refused, so a task that needs it fails at once', actions: [], href: '#agents' });
    if (blocks.length > 3) out.push({ kind: 'policy', id: 'more', tone: 'info', title: `${blocks.length - 3} more Claude policy blocks`, sub: 'See Agents', actions: [], href: '#agents' });
    for (const a of S.accounts || []) if (a.state === 'error') out.push({ kind: 'integration', id: a.connection_id, provider: a.provider, tone: 'bad', title: `${a.provider}: ${a.external_name || a.connection_id} needs reconnecting`, sub: 'The connection reports an error', actions: ['reconnect'], href: '#connections:' + a.connection_id });
    for (const i of S.integrations || []) if (i.state === 'error') out.push({ kind: 'integration', id: i.id, provider: i.id, tone: 'bad', title: `${i.platform || i.id} connection problem`, sub: String(i.error || i.next_action || 'The connection reports an error').slice(0, 160), actions: ['reconnect'], href: '#connections:' + i.id });
    const w = workerStatus(S.devices, now, S.jobs), waiting = (S.tasks || []).filter((t) => ['queued', 'waiting_pc'].includes(t.status)).length;
    if (!w.cloud) out.push({ kind: 'worker', id: 'worker', tone: waiting ? 'warn' : 'info', title: 'No cloud worker is paired', sub: waiting ? `${waiting} queued task${waiting === 1 ? '' : 's'} cannot run in the cloud` : 'Nothing is waiting for it', actions: [], href: '#cloud' });
    else if (!w.cloud.online) out.push({ kind: 'worker', id: 'worker', tone: waiting ? 'warn' : 'info', title: `Cloud worker: last run ${ago(w.cloud.lastSeen, now)}`, sub: `${waiting ? `${waiting} queued task${waiting === 1 ? ' waits' : 's wait'} for the next cloud run` : 'nothing is waiting for it'}${w.cloud.lastJob ? ' · latest job finished ' + ago(w.cloud.lastJob, now) : ''}. It runs on a schedule and checks in only when it runs.`, actions: [], href: '#cloud' });
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }
  // the four tiles of Home
  function homeTiles(S) {
    const tasks = S.tasks || [], jobs = S.jobs || [];
    const open = tasks.filter((t) => taskGroup(t.status) === 'open'), failed = tasks.filter((t) => t.status === 'failed').length;
    const running = tasks.filter((t) => T_RUNNING.includes(t.status)).length + jobs.filter((j) => j.status === 'running').length;
    const yes = (S.approvals || []).filter((a) => a.state === 'waiting').length;
    const alerts = attention({ ...S, approvals: [] }, S.now).filter((a) => a.tone !== 'info').length;
    return { open: open.length, failed, running, yes, alerts };
  }

  // ---------------------------------------------------------------- YouTube numbers (yt_stats) and revenue (revenue_events, revenue_sync)
  // The latest data_api channel row of each connection carries lifetime views, subscribers and videos; "last synced" is the newest row.
  function ytSummary(rows, accounts) {
    const by = new Map();
    for (const r of rows || []) {
      if (r.kind !== 'channel' || r.source !== 'data_api' || !r.metrics) continue;
      const cur = by.get(r.connection_id);
      if (!cur || String(r.day + r.at) > String(cur.day + cur.at)) by.set(r.connection_id, r);
    }
    const name = (id) => { const a = (accounts || []).find((x) => x.connection_id === id); return a ? a.external_name || id : id; };
    const channels = [...by.values()].map((r) => ({ connection_id: r.connection_id, name: name(r.connection_id), views: Number(r.metrics.views), subscribers: Number(r.metrics.subscribers), videos: Number(r.metrics.videos), at: r.at, day: r.day }))
      .map((c) => ({ ...c, views: Number.isFinite(c.views) ? c.views : null, subscribers: Number.isFinite(c.subscribers) ? c.subscribers : null, videos: Number.isFinite(c.videos) ? c.videos : null })).sort((a, b) => (b.views || 0) - (a.views || 0));
    const sum = (k) => { const v = channels.map((c) => c[k]).filter((x) => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
    const at = (rows || []).map((r) => r.at).filter(Boolean).sort().pop() || null;
    return { channels, views: sum('views'), subscribers: sum('subscribers'), videos: sum('videos'), lastSync: at };
  }
  const PROVIDER_CURRENCY = { gumroad: 'USD' };   // Gumroad prices are USD cents, even for a product listed in rupees
  const SALE_KINDS = ['sale', 'purchase', 'order', 'payment', 'charge', 'revenue', 'subscription', 'renewal', 'download'];
  // Revenue per source. A connected source with a successful sync and no sales is a verified zero ("INR 0"); a source that is not connected is
  // "not connected" (never a zero); a sync that failed says so. `tables` is false when the revenue tables are not served at all.
  function revenueSummary(events, sync, accounts, o) {
    o = o || {};
    const ev = events || [], sy = sync || [], ac = accounts || [];
    const names = new Set([...ev.map((e) => e.source), ...sy.map((s) => s.provider), ...ac.filter((a) => (o.providers || []).includes(a.provider) || a.provider === 'gumroad').map((a) => a.provider), ...(o.always || [])].filter(Boolean));
    const sources = [...names].sort().map((src) => {
      const accts = ac.filter((a) => a.provider === src), ids = new Set(accts.map((a) => a.connection_id));
      const rows = sy.filter((s) => s.provider === src || ids.has(s.connection_id)), mine = ev.filter((e) => e.source === src);
      const connected = accts.some((a) => a.state === 'connected');
      const lastOk = rows.map((r) => r.last_ok_at).filter(Boolean).sort().pop() || null, lastSynced = rows.map((r) => r.last_synced_at).filter(Boolean).sort().pop() || null;
      const failing = rows.find((r) => r.state === 'error' || (r.error && String(r.error).trim()));
      const by = new Map();
      for (const e of mine) {
        const v = Number(e.amount), kind = String(e.kind || 'sale').toLowerCase(), refund = kind === 'refund' || kind === 'chargeback';
        if (!Number.isFinite(v) || (!refund && !SALE_KINDS.includes(kind))) continue;   // fees, payouts and adjustments are not sales
        const c = String(e.currency || PROVIDER_CURRENCY[src] || o.currency || ''), t = by.get(c) || { currency: c, total: 0, count: 0 };
        t.total += refund ? -Math.abs(v) : v; t.count += refund ? 0 : 1; by.set(c, t);
      }
      const totals = [...by.values()], zc = (mine.find((e) => e.currency) || {}).currency || PROVIDER_CURRENCY[src] || o.currency || null;
      let state;
      if (totals.length) state = 'amount';
      else if (failing && !lastOk) state = 'error';
      else if ((connected || rows.length) && lastOk) state = 'zero';
      else if (connected || rows.length) state = 'never_synced';
      else state = 'not_connected';
      return { source: src, state, totals, zeroCurrency: zc, lastOk, lastSynced, error: failing ? String(failing.error || 'the last sync failed') : null, connection_ids: [...new Set([...ids, ...rows.map((r) => r.connection_id).filter(Boolean)])], records: rows.reduce((n, r) => n + (Number(r.records) || 0), 0) || mine.length, connected };
    });
    return { sources };
  }

  // ---------------------------------------------------------------- navigation contract helpers
  const sectionOf = (nav, pageId) => (nav.sections.find((s) => s.pages.some((p) => p.id === pageId)) || null);
  // every route the contract can reach: section pages, the two global actions and the House workspace
  const reachableIds = (nav) => new Set([...nav.sections.flatMap((s) => s.pages.map((p) => p.id)), ...nav.global.map((g) => g.id), 'house']);
  const houseById = (nav, id) => (nav.houses || []).find((h) => h.id === id) || null;
  // the registry unit for a House id (unit id or house_id equal to it)
  const houseUnit = (units, id) => (units || []).find((u) => u.kind === 'house' && (u.id === id || u.house_id === id)) || null;
  // anything that carries a team name / unit id belongs to a House when it is that unit or sits under it
  const belongsTo = (names, value) => !names || names.has(String(value || ''));

  root.CocoUI = { esc, PERIODS, periodRange, within, descendants, scopeUnits, scopeNames, KINDS, selectMetrics, totals, headline, growth, seriesByDay, audienceSeries, isEstimate,
    fmtNum, fmtMoney, fmtPct, ago, lineChart, barChart, targetChart, sectionOf, reachableIds, houseById, houseUnit, belongsTo,
    T_OPEN, T_RUNNING, taskGroup, PRIORITIES, priorityName, taskActions, taskChange, taskProgress, WORKER_FRESH_MS, workerStatus, taskWait, houseOfTeam, houseOfText, stepsOf, jobProblem,
    HOUSE_TEAM, teamLine, teamOfTask, requestNote, requestsOf, openRequest, requestWords, policyWord, claudeBlocks,
    attention, homeTiles, ytSummary, revenueSummary };
})(typeof window !== 'undefined' ? window : globalThis);
