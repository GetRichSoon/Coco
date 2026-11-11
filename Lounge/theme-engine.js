/* Coco theme engine: six themes, light and dark, one engine for the desktop app, the phone and the PWA.
   It is two things in one file:

     1. A PURE core (no DOM, no clock of its own, no randomness of its own): what colours a theme has, which theme is next, when a rotation is
        due. Everything that decides a switch is computed from timestamps, so an app restart, a sleeping laptop or a second device reaches the
        same answer. node tests it directly (theme-engine.test.js), and the Android app implements the same rules against the same test vectors.
     2. A thin browser SHELL: applies a theme as CSS variables (with a view transition when motion is allowed), persists the choice, and
        watches the schedule.

   It does not generate colours. The tonal palettes are generated once, at build time, by contract/build-themes.mjs from the seed colours and
   committed as contract/theme-schemes.json; this file only reads those tables. One palette source, so no screen can drift from another. */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- role -> CSS variable (the names every stylesheet already uses)
  // `accent` is the vivid fill (buttons, switches, badges); `link` is the accessible text colour of the same family.
  const VAR_MAP = {
    accent: '--primary', onAccent: '--on-primary', primaryContainer: '--primary-c', onPrimaryContainer: '--on-primary-c', link: '--link',
    secondary: '--secondary', onSecondary: '--on-secondary', secondaryContainer: '--secondary-c', onSecondaryContainer: '--on-secondary-c',
    tertiary: '--tertiary', onTertiary: '--on-tertiary', tertiaryContainer: '--tertiary-c', onTertiaryContainer: '--on-tertiary-c',
    background: '--surface', cardSurface: '--surface-1', fieldSurface: '--surface-2', fieldSurface2: '--surface-3',
    onSurface: '--on-surface', onSurfaceVariant: '--muted', outlineVariant: '--outline', outline: '--outline-strong',
    success: '--good', onSuccess: '--on-good', successContainer: '--good-c', onSuccessContainer: '--on-good-c',
    warning: '--warn', onWarning: '--on-warn', warningContainer: '--warn-c', onWarningContainer: '--on-warn-c',
    error: '--bad', onError: '--on-bad', errorContainer: '--bad-c', onErrorContainer: '--on-bad-c',
    selected: '--sel', onSelected: '--on-sel', cta: '--cta', onCta: '--on-cta', ctaEdge: '--cta-edge', highlight: '--hl', onHighlight: '--on-hl',
    chart1: '--chart-1', chart2: '--chart-2', chart3: '--chart-3', inverseSurface: '--inverse', inverseOnSurface: '--on-inverse', scrim: '--scrim',
    // older names that still exist in places: they follow the same roles, so nothing keeps its own colour
    secondary_gold: '--gold', secondaryContainer_gold: '--gold-soft', tertiaryContainer_sage: '--sage', onTertiaryContainer_sage: '--on-sage',
  };
  const ALIASES = { secondary_gold: 'secondary', secondaryContainer_gold: 'secondaryContainer', tertiaryContainer_sage: 'tertiaryContainer', onTertiaryContainer_sage: 'onTertiaryContainer' };
  // The dark floating surfaces (the approvals strip, the Brain capsule) are always dark, in either mode, but they take their colours from the active
  // theme's DARK panel palette, so they belong to the theme instead of keeping greys of their own.
  const ISLAND_MAP = { '--d-bg': 'cardSurface', '--d-field': 'fieldSurface', '--d-field2': 'fieldSurface2', '--d-on': 'onSurface', '--d-muted': 'onSurfaceVariant', '--d-link': 'link', '--d-accent': 'accent', '--d-good': 'success', '--d-warn': 'warning', '--d-bad': 'error', '--d-good-c': 'successContainer', '--d-on-good-c': 'onSuccessContainer', '--d-warn-c': 'warningContainer', '--d-on-warn-c': 'onWarningContainer' };
  // the variables that panels (cards, the sidebar, the top bar, sheets, dialogs) re-declare from their own `--p-*` copies: how a theme can have
  // black cards on a lavender page without any card knowing about it
  const PANEL_VARS = Object.entries(VAR_MAP).filter(([role]) => role !== 'background').map(([, v]) => v);

  // ---------------------------------------------------------------- tiny helpers
  const FNV_OFFSET = 0x811c9dc5, FNV_PRIME = 0x01000193;
  // 32-bit FNV-1a. Integer maths only, so the Kotlin port gives the same number on every device.
  function fnv1a32(str) { let h = FNV_OFFSET; const s = String(str); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) & 0xff; h = Math.imul(h, FNV_PRIME); } return h >>> 0; }
  const HOUR = 3600000, DAY = 86400000;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
  const ms = (v) => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };

  // ---------------------------------------------------------------- time zones: the local clock, without trusting the machine's own arithmetic
  const fmtCache = {};
  function partsInZone(t, tz) {
    const key = tz || '';
    const f = fmtCache[key] || (fmtCache[key] = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }));
    const o = {}; for (const p of f.formatToParts(new Date(t))) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
  }
  // The offset of `tz` from UTC at the instant t, in ms (what a clock there would add to UTC).
  function offsetAt(t, tz) { const p = partsInZone(t, tz); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - (t - (((t % 1000) + 1000) % 1000)); }
  // The instant at which the wall clock of `tz` reads y-m-d hh:mm (month 1-12; day or month overflow is normalised by Date.UTC).
  // Daylight saving, decided exactly like java.time (so the Android port agrees to the millisecond): a wall time that happens TWICE (clocks go
  // back) means the first, earlier one; a wall time that does NOT EXIST (clocks go forward) is moved later by the length of the gap.
  function zonedToUtc(y, m, d, hh, mm, tz) {
    const target = Date.UTC(y, m - 1, d, hh, mm);
    const before = offsetAt(target - DAY, tz), after = offsetAt(target + DAY, tz);
    if (before === after) return target - before;
    const t1 = target - before, t2 = target - after, ok1 = offsetAt(t1, tz) === before, ok2 = offsetAt(t2, tz) === after;
    if (ok1 && ok2) return Math.min(t1, t2);      // the wall time happens twice: the earlier instant
    if (ok1) return t1; if (ok2) return t2;
    return t1;                                    // it does not exist: shifted forward by the gap
  }
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  // ---------------------------------------------------------------- the engine, built over one contract (themes.json + theme-schemes.json)
  function create(contract) {
    const C = contract || {};
    const THEMES = C.themes || [];
    const IDS = THEMES.map((t) => t.id);
    const FREQ = Object.fromEntries((C.frequencies || []).map((f) => [f.id, f]));
    const DEF = C.defaults || {};
    const byId = (id) => THEMES.find((t) => t.id === id) || null;
    const SCHEMES = C.schemes || {};

    // ------------------------------------------------ colours
    const cssCache = {};
    function cssFor(themeId, mode) {
      const key = themeId + '|' + mode; if (cssCache[key]) return cssCache[key];
      const sc = (SCHEMES[themeId] || SCHEMES[IDS[0]])[mode === 'dark' ? 'dark' : 'light'];
      const out = {};
      for (const scope of ['page', 'panel']) {
        const roles = sc[scope];
        for (const [role, cssVar] of Object.entries(VAR_MAP)) { const v = roles[ALIASES[role] || role]; if (v != null) out[scope === 'page' ? cssVar : '--p-' + cssVar.slice(2)] = v; }
      }
      const lumOf = (h) => { const n = parseInt(String(h).slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
      out['--scheme'] = lumOf(sc.page.background) < 0.18 ? 'dark' : 'light'; out['--p-scheme'] = lumOf(sc.panel.cardSurface) < 0.18 ? 'dark' : 'light';
      const dark = (SCHEMES[themeId] || SCHEMES[IDS[0]]).dark.panel;
      for (const [cssVar, role] of Object.entries(ISLAND_MAP)) out[cssVar] = dark[role];
      return (cssCache[key] = out);
    }
    const rolesOf = (themeId, mode, scope) => (SCHEMES[themeId] || {})[mode === 'dark' ? 'dark' : 'light'][scope || 'page'];
    const resolveMode = (appearance, systemDark) => (appearance === 'light' ? 'light' : appearance === 'dark' ? 'dark' : systemDark ? 'dark' : 'light');

    // ------------------------------------------------ preferences (one small JSON document, the same on every device)
    function defaultPrefs() {
      const r = DEF.rotation || {};
      return { v: 1, appearance: DEF.appearance || 'system', themeId: DEF.themeId || IDS[0], previousThemeId: null, lastSwitchedAt: null, seq: 0, locked: !!DEF.locked, reason: 'default',
        rotation: { enabled: !!r.enabled, frequency: r.frequency || 'daily', order: r.order || 'sequential', time: r.time || '09:00', weekday: num(r.weekday, 1), dayOfMonth: num(r.dayOfMonth, 1), tz: '', seed: '', anchorAt: null },
        updatedAt: null, updatedBy: null };
    }
    // whatever arrives (an older file, a cloud row, a hand edit) comes out as a valid document
    function normalize(raw) {
      const d = defaultPrefs(), r = (raw && typeof raw === 'object') ? raw : {}, rr = (r.rotation && typeof r.rotation === 'object') ? r.rotation : {};
      const themeId = IDS.includes(r.themeId) ? r.themeId : d.themeId;
      return {
        v: 1, appearance: ['system', 'light', 'dark'].includes(r.appearance) ? r.appearance : d.appearance, themeId,
        previousThemeId: IDS.includes(r.previousThemeId) && r.previousThemeId !== themeId ? r.previousThemeId : null,
        lastSwitchedAt: iso(ms(r.lastSwitchedAt)), seq: Math.max(0, Math.floor(num(r.seq, 0))), locked: !!r.locked, reason: String(r.reason || 'default').slice(0, 24),
        rotation: {
          enabled: !!rr.enabled, frequency: FREQ[rr.frequency] ? rr.frequency : d.rotation.frequency, order: ['sequential', 'random'].includes(rr.order) ? rr.order : d.rotation.order,
          time: isTime(rr.time) ? rr.time : d.rotation.time, weekday: clamp(Math.floor(num(rr.weekday, d.rotation.weekday)), 0, 6), dayOfMonth: clamp(Math.floor(num(rr.dayOfMonth, d.rotation.dayOfMonth)), 1, 31),
          tz: typeof rr.tz === 'string' ? rr.tz.slice(0, 64) : '', seed: typeof rr.seed === 'string' ? rr.seed.slice(0, 32) : '', anchorAt: iso(ms(rr.anchorAt)),
        },
        updatedAt: iso(ms(r.updatedAt)), updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy.slice(0, 64) : null,
      };
    }

    // ------------------------------------------------ the schedule
    const rotating = (p) => p.rotation.enabled && !p.locked && FREQ[p.rotation.frequency] && FREQ[p.rotation.frequency].kind !== 'manual';
    // The rotation clock: the later of the last switch and the last time the schedule itself was edited (so saving a new schedule never fires it).
    const anchorOf = (p) => Math.max(ms(p.lastSwitchedAt) || 0, ms(p.rotation.anchorAt) || 0);
    function localParts(t, p) { return partsInZone(t, p.rotation.tz || undefined); }
    // the most recent scheduled instant at or before `now` (daily, weekly, monthly)
    function lastBoundary(now, p) {
      const kind = FREQ[p.rotation.frequency].kind, tz = p.rotation.tz || undefined, [hh, mm] = p.rotation.time.split(':').map(Number), L = partsInZone(now, tz);
      if (kind === 'daily') { let b = zonedToUtc(L.y, L.m, L.d, hh, mm, tz); if (b > now) b = zonedToUtc(L.y, L.m, L.d - 1, hh, mm, tz); return b; }
      if (kind === 'weekly') { const back = (L.wd - p.rotation.weekday + 7) % 7; let b = zonedToUtc(L.y, L.m, L.d - back, hh, mm, tz); if (b > now) b = zonedToUtc(L.y, L.m, L.d - back - 7, hh, mm, tz); return b; }
      if (kind === 'monthly') {
        const at = (y, m) => { const yy = y + Math.floor((m - 1) / 12), mo = ((m - 1) % 12 + 12) % 12 + 1; return zonedToUtc(yy, mo, Math.min(p.rotation.dayOfMonth, daysInMonth(yy, mo)), hh, mm, tz); };
        let b = at(L.y, L.m); if (b > now) b = at(L.y, L.m - 1); return b;
      }
      return null;
    }
    // the first scheduled instant strictly after `t`
    function boundaryAfter(t, p) {
      const kind = FREQ[p.rotation.frequency].kind, tz = p.rotation.tz || undefined, [hh, mm] = p.rotation.time.split(':').map(Number);
      const b = lastBoundary(t, p);       // at or before t
      const L = partsInZone(b, tz);
      if (kind === 'daily') return zonedToUtc(L.y, L.m, L.d + 1, hh, mm, tz);
      if (kind === 'weekly') return zonedToUtc(L.y, L.m, L.d + 7, hh, mm, tz);
      const y = L.y + Math.floor(L.m / 12), m = (L.m % 12) + 1; return zonedToUtc(y, m, Math.min(p.rotation.dayOfMonth, daysInMonth(y, m)), hh, mm, tz);
    }
    // When is the next automatic switch? null when nothing is scheduled (off, locked, manual only, or "every launch").
    function nextDueAt(p, now) {
      if (!rotating(p)) return null;
      const f = FREQ[p.rotation.frequency];
      if (f.kind === 'launch') return null;
      const a = anchorOf(p) || now;
      if (f.kind === 'interval') return a + f.hours * HOUR;
      return boundaryAfter(a, p);
    }
    const isDue = (p, now) => { const t = nextDueAt(p, now); return t != null && now >= t; };

    // ------------------------------------------------ choosing the next theme
    function candidates(p) {
      const avoid = new Set([p.themeId, p.previousThemeId]);
      let c = IDS.filter((id) => !avoid.has(id));
      if (c.length < 2) c = IDS.filter((id) => id !== p.themeId);
      return c;
    }
    // sequential: the next theme in order. random: never the one in use (nor the one before it); drawn from `rand` (a fresh launch) or, for scheduled
    // switches, from a hash of the shared seed, so every device computes the very same "random" theme.
    function pickNext(p, rand) {
      if (p.rotation.order === 'sequential') { const i = IDS.indexOf(p.themeId); return IDS[(i + 1) % IDS.length]; }
      const c = candidates(p);
      const idx = typeof rand === 'number' ? Math.min(c.length - 1, Math.floor(rand * c.length)) : fnv1a32(`${p.rotation.seed || 'coco'}|${p.seq}|${p.themeId}`) % c.length;
      return c[idx];
    }
    // what the settings screen may promise about the next switch
    function preview(p) {
      const f = FREQ[p.rotation.frequency];
      if (!rotating(p)) return { kind: 'none', themeId: null };
      if (f.kind === 'launch') return p.rotation.order === 'sequential' ? { kind: 'exact', themeId: pickNext(p) } : { kind: 'random', themeId: null, candidates: candidates(p) };
      return { kind: 'exact', themeId: pickNext(p) };
    }

    // ------------------------------------------------ transitions between states (each returns a NEW prefs document)
    function switchTo(p, themeId, now, reason, by) {
      if (themeId === p.themeId) return { ...p, rotation: { ...p.rotation }, reason, updatedAt: iso(now), updatedBy: by || p.updatedBy };
      return { ...p, themeId, previousThemeId: p.themeId, lastSwitchedAt: iso(now), seq: p.seq + 1, reason, updatedAt: iso(now), updatedBy: by || p.updatedBy, rotation: { ...p.rotation } };
    }
    // the person picked a theme: it applies now, and the rotation clock starts again from here
    function applyManual(p, themeId, now, by) {
      if (!IDS.includes(themeId)) return p;
      const n = switchTo(p, themeId, now, 'manual', by); n.rotation = { ...n.rotation, anchorAt: iso(now) }; return n;
    }
    // "Apply the next theme now": one step in the chosen order, and the clock starts again
    function advance(p, now, rand, by) { const n = switchTo(p, pickNext(p, rand), now, 'next', by); n.rotation = { ...n.rotation, anchorAt: iso(now) }; return n; }
    function setRotation(p, patch, now, by) {
      const merged = normalize({ ...p, rotation: { ...p.rotation, ...patch } }).rotation;
      // a fresh schedule restarts its own clock and gets a seed the first time it is switched on
      merged.anchorAt = iso(now); if (merged.enabled && !merged.seed) merged.seed = patch && patch.seed ? String(patch.seed).slice(0, 32) : fnv1a32(iso(now) + '|' + p.themeId).toString(16).padStart(8, '0');
      return { ...p, rotation: merged, reason: 'settings', updatedAt: iso(now), updatedBy: by || p.updatedBy };
    }
    const setLocked = (p, locked, now, by) => ({ ...p, locked: !!locked, rotation: { ...p.rotation, anchorAt: locked ? p.rotation.anchorAt : iso(now) }, reason: locked ? 'locked' : 'unlocked', updatedAt: iso(now), updatedBy: by || p.updatedBy });
    const setAppearance = (p, appearance, now, by) => (['system', 'light', 'dark'].includes(appearance) ? { ...p, appearance, reason: 'appearance', updatedAt: iso(now), updatedBy: by || p.updatedBy } : p);
    function reset(now, by) { const d = defaultPrefs(); d.reason = 'reset'; d.updatedAt = iso(now); d.updatedBy = by || null; return d; }

    // THE decision. Called when the app opens (launch = true), on a timer and when the app wakes up. It only ever looks at timestamps.
    //   launch -> a new session: "every launch" switches; so does any other schedule that fell due while the app was closed
    //   due    -> one step, however many scheduled times were missed
    // A locked theme, a switched-off rotation and "manual only" never change.
    function evaluate(p, o) {
      const now = o.now, f = rotating(p) ? FREQ[p.rotation.frequency] : null;
      if (!f) return { prefs: p, changed: false, reason: null };
      if (f.kind === 'launch') {
        if (!o.launch) return { prefs: p, changed: false, reason: null };
        const n = switchTo(p, pickNext(p, o.rand), now, 'launch', o.by); n.rotation = { ...n.rotation, anchorAt: iso(now) };
        return { prefs: n, changed: n.themeId !== p.themeId, reason: 'launch' };
      }
      if (isDue(p, now)) { const n = switchTo(p, pickNext(p, undefined), now, 'schedule', o.by); return { prefs: n, changed: n.themeId !== p.themeId, reason: 'schedule' }; }
      return { prefs: p, changed: false, reason: null };
    }
    // two copies of the document (this device, the cloud): the later edit wins
    const newer = (a, b) => ((ms(a && a.updatedAt) || 0) >= (ms(b && b.updatedAt) || 0) ? a : b);

    return { VAR_MAP, PANEL_VARS, themes: THEMES, ids: IDS, frequencies: C.frequencies || [], orders: C.orders || [], byId, cssFor, rolesOf, resolveMode, defaultPrefs, normalize, rotating, anchorOf, nextDueAt, isDue,
      candidates, pickNext, preview, applyManual, advance, setRotation, setLocked, setAppearance, reset, evaluate, newer, fnv1a32, lastBoundary, boundaryAfter, localParts, zonedToUtc, partsInZone };
  }

  // ---------------------------------------------------------------- the browser shell
  function shell(engine) {
    const KEY = 'gs-theme-prefs', SESSION = 'gs-theme-session', LEGACY = 'gs-theme';
    const doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' && root === window ? window : null;
    const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
      sget: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, sset: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
    const listeners = new Set(); let prefs = engine.defaultPrefs(), previewing = null, timer = null, byDevice = null;
    const systemDark = () => !!(win && win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches);
    const reduced = () => !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(doc && doc.body && doc.body.classList.contains('calm'));
    const effective = () => ({ themeId: previewing || prefs.themeId, mode: engine.resolveMode(prefs.appearance, systemDark()) });

    function paint() {
      if (!doc) return;
      const { themeId, mode } = effective(), el = doc.documentElement, css = engine.cssFor(themeId, mode);
      for (const k in css) el.style.setProperty(k, css[k]);
      el.dataset.palette = themeId; el.dataset.mode = mode; el.dataset.theme = mode; el.style.colorScheme = mode;
      const meta = doc.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', css['--p-surface-1'] || css['--surface-1']);
    }
    // A view transition cross-fades the whole page in one compositor step (no per-element transitions, no layout work). Not under reduced motion.
    function apply(animate) {
      if (!doc) return;
      // Only while the page is on screen: a hidden window (the desktop app lives in the tray) never produces a frame, so a transition would never run its
      // update and the theme would not change until somebody opened the window.
      // A window that was never shown (the desktop app starts hidden) still reports "visible" but never runs the transition either, so the theme is also
      // painted by a short fallback if the transition has not done it; painting twice is harmless and always uses the latest choice.
      if (animate && !reduced() && doc.startViewTransition && doc.visibilityState === 'visible') {
        let painted = false; const run = () => { painted = true; paint(); };
        try { doc.startViewTransition(run); setTimeout(() => { if (!painted) paint(); }, 200); } catch (e) { run(); }
      } else paint();
    }
    const tell = (meta) => listeners.forEach((f) => { try { f(snapshot(), meta || {}); } catch (e) { /* a listener must never break a theme switch */ } });
    function snapshot() { const e = effective(); return { prefs, themeId: e.themeId, mode: e.mode, previewing, next: engine.preview(prefs), nextDueAt: engine.nextDueAt(prefs, Date.now()) }; }
    function save(next, o) {
      prefs = engine.normalize(next); store.set(KEY, JSON.stringify(prefs));
      if (!o || !o.silent) apply(!(o && o.animate === false));
      tell({ origin: o && o.local ? 'remote' : 'local' });
      return prefs;
    }
    function load() {
      let raw = null; try { raw = JSON.parse(store.get(KEY) || 'null'); } catch (e) { raw = null; }
      if (!raw) { raw = engine.defaultPrefs(); const legacy = store.get(LEGACY); if (['light', 'dark', 'system'].includes(legacy)) raw.appearance = legacy; }   // keep the Light/Dark/System choice people already made
      prefs = engine.normalize(raw); return prefs;
    }
    const newSession = () => { if (store.sget(SESSION)) return false; store.sset(SESSION, '1'); return true; };
    const step = (launch) => { const r = engine.evaluate(prefs, { now: Date.now(), launch, rand: Math.random(), by: byDevice }); if (r.reason) { prefs = r.prefs; store.set(KEY, JSON.stringify(prefs)); if (r.changed) apply(!launch); tell({ origin: 'rotation', rotated: r.reason }); } return r; };

    return {
      engine,
      // runs in <head> before the first paint: the saved theme is on screen before anything else is
      boot() { load(); const launch = newSession(); const r = engine.evaluate(prefs, { now: Date.now(), launch, rand: Math.random(), by: byDevice }); if (r.reason) { prefs = r.prefs; store.set(KEY, JSON.stringify(prefs)); } paint(); return { launch, rotated: r.reason }; },
      // after first paint: follow the system's light/dark setting, and look at the schedule once a minute and whenever the app wakes up
      watch() {
        if (win && win.matchMedia) { const mq = win.matchMedia('(prefers-color-scheme: dark)'); const f = () => { if (prefs.appearance === 'system') apply(true); }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }
        if (doc) doc.addEventListener('visibilitychange', () => { if (!doc.hidden) step(false); });   // a focused, existing session is NOT a new launch
        if (!timer) timer = setInterval(() => step(false), 60000);
      },
      get: () => prefs, snapshot, onChange(f) { listeners.add(f); return () => listeners.delete(f); },
      setDevice(id) { byDevice = id || null; },
      // adopt a document from another device (or the cloud); a theme another device chose by hand follows at once, a scheduled change waits for the next launch
      adopt(remote) { const r = engine.normalize(remote); if ((Date.parse(r.updatedAt) || 0) <= (Date.parse(prefs.updatedAt) || 0)) return false; save(r, { local: true }); return true; },
      apply: (themeId) => save(engine.applyManual(prefs, themeId, Date.now(), byDevice)),
      next: () => save(engine.advance(prefs, Date.now(), Math.random(), byDevice)),
      setAppearance: (a) => save(engine.setAppearance(prefs, a, Date.now(), byDevice)),
      setRotation: (patch) => save(engine.setRotation(prefs, patch, Date.now(), byDevice), { animate: false }),
      setLocked: (v) => save(engine.setLocked(prefs, v, Date.now(), byDevice), { animate: false }),
      reset: () => save(engine.reset(Date.now(), byDevice)),
      preview(themeId) { previewing = engine.ids.includes(themeId) ? themeId : null; apply(true); tell({ origin: 'preview' }); },
      commitPreview() { const id = previewing; previewing = null; if (id) save(engine.applyManual(prefs, id, Date.now(), byDevice)); },
      cancelPreview() { if (previewing) { previewing = null; apply(true); tell({ origin: 'preview' }); } },
      isPreviewing: () => previewing,
      evaluateNow: () => step(false),
    };
  }

  root.CocoThemeEngine = create;
  create.ISLAND_MAP = ISLAND_MAP;
  root.CocoThemeShell = shell;
  if (root.COCO_THEMES) { root.CocoThemeCore = create(root.COCO_THEMES); root.CocoTheme = shell(root.CocoThemeCore); }
})(typeof window !== 'undefined' ? window : globalThis);
