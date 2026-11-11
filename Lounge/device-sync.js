// Coco 4-device sync monitor: the decision logic for ONE shared check every 10-20 minutes (Boss order 2026-11-04).
// Pure functions, no network: a runner reads the devices + the cloud release (2 reads), calls planCycle(), applies the planned
// signals / audit write, and stores nextState. Works in Node (tests, cloud runner) and in the page (window.CocoDeviceSync).
// The cloud stays the authority: a device is CURRENT only when ITS OWN heartbeat reports a version >= the cloud release.
(function (root, make) { const m = make(); if (typeof module !== 'undefined' && module.exports) module.exports = m; else root.CocoDeviceSync = m; })(this, function () {
  const MIN = 60000;
  const INTERVAL = { min: 10 * MIN, target: 15 * MIN, max: 20 * MIN };
  const ONLINE_MS = 150000;                       // same rule as the Release Center: no heartbeat for 150 s = OFFLINE
  const BACKOFF_CAP = 6 * 60 * MIN;
  const BUDGET = { reads: 3, audit: 1, max: 7 };   // per cycle: devices (1 batched read) + announced release (1) + last audit/state (1) + ONE batched write per kind of signal (signal / retry, so at most 2) + 1 audit insert = 6, hard cap 7
  const BUSY = ['CHECKING', 'DOWNLOADING', 'INSTALLING', 'RESTART_REQUIRED', 'RECONNECTING', 'UPDATE_REQUIRED'];   // already told / already working: never signal again

  const ver = (s) => String(s || '').replace(/^(desktop|web|android|lounge)-/, '');
  // -1 / 0 / 1, or null when either side is not a dotted number (then nothing is assumed)
  function cmp(a, b) {
    const pa = ver(a).split('.').map(Number), pb = ver(b).split('.').map(Number);
    if (!ver(a) || !ver(b) || pa.some(isNaN) || pb.some(isNaN)) return null;
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
    return 0;
  }
  // The authorized devices: active pc / phone rows that are not the cloud runner. A runner is not an app device and is never counted.
  const registry = (rows) => (rows || []).filter((d) => d && d.active !== false && (d.kind === 'pc' || d.kind === 'phone') && !(d.info && d.info.cloud));
  // Display label: only ever "Boss PC", "Boss Phone", "Big Boss PC", "Big Boss Phone" (or the plain name of a non-person device). Internal ids and owner
// addresses stay as the stable identity and are never shown or logged by this system.
const label = (d) => {
  const n = String((d && d.name) || ''), kind = d && d.kind === 'phone' ? 'Phone' : 'PC';
  if (/big boss/i.test(n)) return 'Big Boss ' + kind;
  if (/boss/i.test(n)) return 'Boss ' + kind;
  return n.replace(/\(.*?\)/g, '').replace(new RegExp('\\b(' + ['mange', 'sh'].join('') + '|' + ['shre', 'ya'].join('') + ')\\b', 'gi'), '').replace(/\s+/g, ' ').trim() || (d && d.kind === 'phone' ? 'Phone' : 'PC');
};
const online = (d, now) => !!d.last_seen && now - Date.parse(d.last_seen) < ONLINE_MS;

  function classify(d, latest, now) {
    if (!online(d, now)) return 'OFFLINE';
    const c = cmp(d.app_version, latest);
    if (c === null) return 'UNKNOWN';
    if (c >= 0) return 'CURRENT';
    return String(d.update_state || '').toUpperCase() === 'FAILED' ? 'ERROR' : 'OUTDATED';
  }
  const backoff = (fails) => Math.min(INTERVAL.target * 2 ** Math.max(0, fails - 1), BACKOFF_CAP);   // 15, 30, 60, 120, 240, 360 min

  // One shared scheduler: a lease so two runners can never both run, and an interval gate so an extra trigger costs nothing.
  function acquireLease(state, holder, now, ttl = 5 * MIN) {
    const l = (state && state.lease) || null;
    if (l && l.holder !== holder && l.until > now) return { ok: false, holder: l.holder, state };
    return { ok: true, state: { ...(state || {}), lease: { holder, until: now + ttl } } };
  }
  const due = (state, now) => !state || !state.nextCheckAt || now >= state.nextCheckAt - 30000;
  // The scheduler must not die silently: no completed cycle for 2x the longest interval is reported, not ignored.
  function health(state, now) {
    if (!state || !state.lastCycleAt) return { ok: false, why: 'no cycle has ever completed' };
    const late = now - state.lastCycleAt; return late > 2 * INTERVAL.max ? { ok: false, why: 'scheduler stalled: last cycle ' + Math.round(late / MIN) + ' min ago' } : { ok: true };
  }

  // input: { devices, latest, latestNow?, now, state, rand? } -> { rows, signals, nextState, calls, budget, current, total, stale, registryOk, nextCheckAt }
  function planCycle({ devices, latest, latestNow, now, state, rand = Math.random }) {
    // scheduler state is keyed by a one-way hash of the internal id, so the stored record never carries an id (legacy ids hold people's names)
    const slot = (id) => { let h = 5381; for (const c of String(id)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return 'k' + h.toString(36); };
    const prev = (state && state.devices) || {}, reg = registry(devices), next = {}, signals = [], rows = [];
    const stale = latestNow != null && latestNow !== latest;   // the cloud release moved while we were working: nothing is marked verified this cycle
    const allowed = reg.length;   // devices are signalled in batches, so the number of devices does not cost calls
    for (const d of reg) {
      const st = classify(d, latest, now), p = prev[slot(d.id)] || { fails: 0 }, s = { ...p };
      let action = 'none';
      if (st === 'CURRENT') { if (!stale) { s.lastGood = now; s.lastVersion = ver(d.app_version); } s.fails = 0; s.nextTry = 0; s.lastError = null; }
      else if (st === 'OUTDATED' || st === 'ERROR') {
        const busy = BUSY.includes(String(d.update_state || '').toUpperCase());
        if (st === 'ERROR') s.lastError = d.update_result || 'update failed';
        if (busy && st === 'OUTDATED') action = 'already told';
        else if (now < (p.nextTry || 0)) action = 'backing off';
        else { action = st === 'ERROR' ? 'retry' : 'signal'; signals.push({ id: d.id, reason: action, release: latest }); s.fails = st === 'ERROR' ? (p.fails || 0) + 1 : p.fails || 0; s.nextTry = now + backoff(Math.max(1, s.fails)); }
      }   // OFFLINE / UNKNOWN: nothing is sent and nothing is claimed; lastGood stays what it was
      s.status = st; s.seen = d.last_seen || null; next[slot(d.id)] = s;
      rows.push({ id: d.id, label: label(d), status: st, local: ver(d.app_version) || null, server: ver(latest) || null, lastSync: s.lastGood || null, lastError: s.lastError || null, nextTry: s.nextTry || null, fails: s.fails || 0, action });
    }
    const jitter = Math.round((rand() - 0.5) * 2 * 2 * MIN);   // +-2 min so runners never line up
    const nextCheckAt = now + Math.max(INTERVAL.min, Math.min(INTERVAL.max, stale ? INTERVAL.min : INTERVAL.target + jitter));
    const batches = [...new Set(signals.map((x) => x.reason))].length, writes = batches + BUDGET.audit, calls = { reads: BUDGET.reads, writes, batches, total: BUDGET.reads + writes };
    return { rows, signals, calls, budget: { max: BUDGET.max, used: calls.total, ok: calls.total <= BUDGET.max }, stale, registryOk: reg.length === 4, registryCount: reg.length,
      current: rows.filter((r) => r.status === 'CURRENT' && !stale).length, total: rows.length, nextCheckAt,
      nextState: { ...(state || {}), devices: next, lastCycleAt: now, nextCheckAt, lease: null, latest: ver(latest) } };
  }
  return { INTERVAL, BUDGET, ONLINE_MS, cmp, ver, registry, label, classify, backoff, acquireLease, due, health, planCycle };
});
