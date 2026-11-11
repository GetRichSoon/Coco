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
    fmtNum, fmtMoney, fmtPct, ago, lineChart, barChart, targetChart, sectionOf, reachableIds, houseById, houseUnit, belongsTo };
})(typeof window !== 'undefined' ? window : globalThis);
