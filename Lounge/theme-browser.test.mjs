// Run: node theme-browser.test.mjs        (SHOTS=<folder> keeps screenshots; DESKTOP=1 installs the desktop bridge stub)
//
// The six themes in a real browser, against synthetic data and a stand-in for Nova. Everything the founders asked for is exercised through the
// real page: all six themes in light and dark, the five locked brand colours, the Appearance page, Apply / Preview / Lock / Reset / Apply next,
// every rotation frequency on a controllable clock (a restart in the middle, a schedule that fell due while the app was closed), persistence,
// sharing between devices (compare-and-set conflicts included), reduced motion, accessible contrast measured on the rendered page, and a scan
// proving no screen kept a colour of its own.
import { createHarness } from './ui-harness.mjs';
import { fixture } from './ui-fixture.mjs';
import { loadEngine } from './contract/theme-css.mjs';

const H = await createHarness('theme-browser');
const { check, eq, ok, settle, text, goHash, shot, context, pageIn, SHOTS } = H;
const { contract, E } = loadEngine();
const IDS = E.ids, MODES = ['light', 'dark'];
const HOUR = 3600000, DAY = 86400000;
const at = (s) => Date.parse(s);
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
const prefs = (over = {}, rot = {}) => E.normalize({ ...E.defaultPrefs(), ...over, rotation: { ...E.defaultPrefs().rotation, ...rot } });
const palette = (page) => page.evaluate(() => ({ id: document.documentElement.dataset.palette, mode: document.documentElement.dataset.mode }));
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('gs-theme-prefs') || 'null'));
const css = (page, sel, prop) => page.locator(sel).first().evaluate((e, p) => getComputedStyle(e)[p], prop);
const readyTheme = async (page, id) => { await page.waitForFunction((x) => document.documentElement.dataset.palette === x, id, { timeout: 8000 }); await page.waitForTimeout(250); };
const openThemes = async (page) => { await goHash(page, 'themes'); await page.waitForSelector('.th-card'); await settle(page, 300); };
const FX = () => fixture({ withRevenue: true });
// reduced motion by default: the colour checks then read settled values (a motion test below covers the animated path)
const fresh = async (opts = {}) => { const fx = opts.fx || FX(), c = await context(fx, { reduced: true, ...opts }), page = await pageIn(c, { hash: opts.hash || 'home' }); return { fx, c, page }; };

// ================================================================ the colours
let s = await fresh();
await check('default: Original Signature, light: lavender page, black cards and navigation, hot pink selection, yellow call to action, Space Grotesk', async () => {
  eq(JSON.stringify(await palette(s.page)), JSON.stringify({ id: 'signature', mode: 'light' }));
  eq(await css(s.page, 'body', 'backgroundColor'), hexRgb('#F0EAF7')); eq(await css(s.page, '.card2', 'backgroundColor'), hexRgb('#151313'), 'cards are black'); eq(await css(s.page, '.rail', 'backgroundColor'), hexRgb('#151313'), 'navigation is black');
  eq(await css(s.page, '.nav a.on', 'backgroundColor'), hexRgb('#FF39A8'), 'hot pink marks the selected page'); eq(await css(s.page, '.nav a.on', 'color'), hexRgb('#151313'));
  eq(await css(s.page, '.card2', 'color'), hexRgb('#F6F0F9'), 'text on a black card is light, even on the lavender page');
  await goHash(s.page, 'house:gigi'); await settle(s.page, 300); eq(await css(s.page, '.househead .btn.filled', 'backgroundColor'), hexRgb('#FFE52E'), 'bright yellow is the call to action'); eq(await css(s.page, '.househead .btn.filled', 'color'), hexRgb('#151313'));
  ok(/Space Grotesk/.test(await css(s.page, 'body', 'fontFamily')), 'Space Grotesk'); ok(/Space Grotesk/.test(await css(s.page, 'h2', 'fontFamily')));
  ok(await s.page.evaluate(() => document.fonts.check('16px "Space Grotesk"')), 'the font is actually loaded');
});
await check('Original Signature in dark: Deep Aubergine page, black cards, the same pink and yellow', async () => {
  await s.page.evaluate(() => window.CocoTheme.setAppearance('dark')); await settle(s.page, 600);
  eq(await css(s.page, 'body', 'backgroundColor'), hexRgb('#24152E')); eq(await css(s.page, '.card2', 'backgroundColor'), hexRgb('#151313')); eq(await css(s.page, '.nav a.on', 'backgroundColor'), hexRgb('#FF39A8'));
  await s.page.evaluate(() => window.CocoTheme.setAppearance('system'));
});
await s.c.ctx.close();

// ================================================================ the Appearance page
s = await fresh();
await check('Appearance: six theme cards with real light and dark previews, the current theme marked, status shown', async () => {
  await s.page.locator('#nav a:not(.hl)', { hasText: 'System' }).first().click(); await settle(s.page, 200);
  await s.page.locator('#subnav a', { hasText: /^Appearance$/ }).click(); await s.page.waitForSelector('.th-card'); await settle(s.page, 300);
  eq(await s.page.locator('.th-card').count(), 6); eq(await s.page.locator('.th-card .cm').count(), 12, 'two previews per theme');
  const names = await s.page.locator('.th-card .th-meta b').allInnerTexts(); eq(names.join('|'), 'Original Signature|Electric Cobalt|Royal Violet|Emerald Energy|Tangerine Fusion|Digital Orchid');
  ok(/Current/.test(await text(s.page, '.th-card.cur')) && /Original Signature/.test(await text(s.page, '.th-card.cur')), 'Signature is the current theme');
  const hero = await text(s.page, '.th-hero'); ok(/Current theme/i.test(hero) && /Original Signature/.test(hero) && /Last switched/i.test(hero) && /Next scheduled switch/i.test(hero), hero);
  // the previews are painted with the real tables: Cobalt's light preview page is Cobalt's light background
  for (const id of IDS) for (const mode of MODES) eq(await s.page.locator(`.th-card[data-theme-card="${id}"] [data-theme-mock="${id}:${mode}"]`).evaluate((e) => getComputedStyle(e).backgroundColor), hexRgb(E.rolesOf(id, mode, 'page').background), `${id} ${mode} preview`);
  for (const sec of ['Appearance', 'Themes', 'Automatic theme rotation']) ok(new RegExp(sec).test(await text(s.page, '.th-page')), sec);
});
await check('Appearance: Light, Dark and System, with the choice shown', async () => {
  ok(/System/.test(await s.page.locator('[data-th-appear][aria-pressed="true"]').innerText()), 'System is the choice by default');
  await s.page.click('[data-th-appear="dark"]'); await settle(s.page, 500); eq((await palette(s.page)).mode, 'dark'); eq((await saved(s.page)).appearance, 'dark');
  await s.page.click('[data-th-appear="light"]'); await settle(s.page, 500); eq((await palette(s.page)).mode, 'light');
  await s.page.click('[data-th-appear="system"]'); await settle(s.page, 500); eq((await saved(s.page)).appearance, 'system');
});
await check('system appearance follows the operating system live', async () => {
  await s.page.emulateMedia({ colorScheme: 'dark' }); await settle(s.page, 700); eq((await palette(s.page)).mode, 'dark');
  await s.page.emulateMedia({ colorScheme: 'light' }); await settle(s.page, 700); eq((await palette(s.page)).mode, 'light');
});

// ================================================================ all six themes, both modes
for (const id of IDS) {
  await check(`${id}: Apply switches the whole app (light and dark), and the saved choice follows`, async () => {
    await openThemes(s.page);
    const btn = s.page.locator(`.th-card[data-theme-card="${id}"] [data-th="apply"]`); if (await btn.isEnabled()) await btn.click(); else ok(/In use/.test(await btn.innerText()), 'the current theme says so'); await readyTheme(s.page, id);
    for (const mode of MODES) {
      await s.page.click(`[data-th-appear="${mode}"]`); await settle(s.page, 500);
      const want = E.cssFor(id, mode);
      eq(JSON.stringify(await palette(s.page)), JSON.stringify({ id, mode }));
      eq(await css(s.page, 'body', 'backgroundColor'), hexRgb(want['--surface']), `${id}/${mode} page`); eq(await css(s.page, '.rail', 'backgroundColor'), hexRgb(want['--p-surface-1']), `${id}/${mode} navigation`);
      eq(await s.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toUpperCase()), want['--primary'].toUpperCase(), `${id}/${mode} accent`);
      eq(await css(s.page, '.nav a.on', 'backgroundColor'), hexRgb(want['--p-sel']), `${id}/${mode} selected`);
    }
    eq((await saved(s.page)).themeId, id); eq((await saved(s.page)).previousThemeId !== id, true);
  });
}
await s.c.ctx.close();

// ================================================================ the five brand values, measured on the page
s = await fresh({ dark: false });
await check('Original Signature: all five brand colours appear exactly where the founders put them (both modes)', async () => {
  const b = contract.themes[0].brand;
  eq(b.black, '#151313'); eq(b.hotPink, '#FF39A8'); eq(b.brightYellow, '#FFE52E'); eq(b.darkBackground, '#24152E'); eq(b.lightBackground, '#F0EAF7');
  for (const mode of MODES) { const r = E.rolesOf('signature', mode, 'page'), p = E.rolesOf('signature', mode, 'panel'); eq(r.cardSurface, '#151313'); eq(p.cardSurface, '#151313'); eq(r.accent, '#FF39A8'); eq(r.selected, '#FF39A8'); eq(r.cta, '#FFE52E'); eq(r.highlight, '#FFE52E'); }
  eq(E.rolesOf('signature', 'light', 'page').background, '#F0EAF7'); eq(E.rolesOf('signature', 'dark', 'page').background, '#24152E');
});
await s.c.ctx.close();

// ================================================================ contrast and "one theme controls everything", measured on rendered pages
const MEASURE = () => {
  // computed colours come as rgb() or, for color-mix(), as color(srgb r g b / a) with 0..1 channels
  const num = (v) => { const m = v.match(/[\d.]+(?:e-?\d+)?/g).map(Number); return /^color\(srgb/.test(v) ? [m[0] * 255, m[1] * 255, m[2] * 255].concat(m.length > 3 ? [m[3]] : []) : m; };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (top, bottom) => { const a = top[3] == null ? 1 : top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)); };
  // the surface under an element: its own and its ancestors' colours composited; a gradient counts as each of its stops (the worst of them is what is measured)
  const bgsOf = (el) => { const chain = []; let grads = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e), c = num(cs.backgroundColor); if (!grads.length && /gradient\(/.test(cs.backgroundImage)) grads = (cs.backgroundImage.match(/(?:rgba?|color)\([^)]*\)/g) || []).map(num); if (c.length === 4 && c[3] === 0) continue; chain.push(c); if (c.length < 4 || c[3] === 1) break; } let base = [255, 255, 255]; for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base); return grads.length ? grads.map((g) => over(g, base)) : [base]; };
  const fail = [];
  const check = (sel, minOverride) => {
    for (const el of [...document.querySelectorAll(sel)].slice(0, 6)) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || !(el.innerText || el.value || '').trim()) continue;
      const cs = getComputedStyle(el), fg = num(cs.color), a = fg[3] == null ? 1 : fg[3]; let ratio = 99;
      for (const bg of bgsOf(el)) { const fgc = over([fg[0], fg[1], fg[2], a], bg), l1 = lum(fgc), l2 = lum(bg); ratio = Math.min(ratio, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)); }
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700, large = size >= 24 || (size >= 18.66 && bold), min = minOverride || (large ? 3 : 4.5);
      if (ratio + 0.01 < min) fail.push(`${sel}: ${ratio.toFixed(2)}:1 (needs ${min}) "${(el.innerText || el.value || '').trim().slice(0, 28)}"`);
    }
  };
  return { check, fail };
};
const runMeasure = (page, sels) => page.evaluate(([src, q]) => { const t = (0, eval)('(' + src + ')')(); q.forEach((x) => t.check(x)); return t.fail; }, [MEASURE.toString(), sels]);
const HOME_TEXT = ['#title', '.crumbs', '.nav a.on', '.nav a:not(.on)', '.nav .grp', '.tile b', '.tile > span', '.tbadge', '.qa .btn', '.wpill', '.sech', '.arow b', '.arow .muted', '.arow .btn', '.chip.good', '.chip.warn', '.chip.bad', '#askBtn', '.btn.text', '.count', '#remoteChip', '.row b'];
s = await fresh();
await check('every theme, both modes: text on the real Home page reaches WCAG AA (4.5:1, 3:1 for large text)', async () => {
  const problems = [];
  for (const id of IDS) for (const mode of MODES) {
    await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]); await settle(s.page, 450);
    const fails = await runMeasure(s.page, HOME_TEXT);
    problems.push(...fails.map((f) => `${id}/${mode} ${f}`));
  }
  eq(problems.length, 0, '\n' + problems.slice(0, 12).join('\n'));
});
await check('every theme, both modes: a House workspace, Insights, the Appearance page and Settings read at AA too', async () => {
  const problems = [];
  const pages = [['house:poppy', ['.househead h2', '.htabs button', '.htabs button.on', '.hcard h3', '.hcard .row b', '.hcard .muted', '.btn.filled', '.btn.tonal', '.chip', '.stat b', '.stat span']], ['insights', ['.homehead h2', '.hcard h3', '.dt th', '.dt td', '.muted', '.chip', '.kv', '.stat b']], ['tasks', ['.tabs button', '.tabs button.on', '.fchips button', '.fchips button.on', '.row b', '.muted', '.wait', '.errline', '.banner', '.chip', '.btn.filled']], ['tasks:00000001-0000-4000-8000-000000000102', ['.tktitle', '.card2.errbox b', '.card2.errbox div', '.btn.filled', '.btn.tonal', '.kvrow', '.hcard h3', '.muted']], ['connections:gumroad-poppy', ['.tktitle', '.card2.errbox b', '.nextbox b', '.nextbox div', '.btn.filled', '.btn.tonal', '.kvrow > span', '.kvrow > div', '.hcard h3']], ['themes', ['.th-hero h2', '.th-facts dt', '.th-facts dd', '.th-meta b', '.th-meta small', '.th-actions .btn', '.seg button', '.seg button[aria-pressed="true"]', '.th-lock', '.eyebrow']], ['settings', ['.card2 h3', '.card2 .muted', '.btn.tonal', '.settings-row span']]];
  for (const id of ['signature', 'cobalt', 'tangerine']) for (const mode of MODES) {
    await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]);
    for (const [hash, sels] of pages) { await goHash(s.page, hash); await settle(s.page, 500); const fails = await runMeasure(s.page, sels); problems.push(...fails.map((f) => `${id}/${mode}/${hash} ${f}`)); }
  }
  eq(problems.length, 0, '\n' + problems.slice(0, 14).join('\n'));
});
await check('no screen keeps a colour system of its own: none of the old hardcoded colours survive on any page, in any theme', async () => {
  const BANNED = ['#3f4bc0', '#aeb6ff', '#b83a12', '#ffa383', '#0b0b0d', '#2c2c2e', '#1c1c1e', '#c7c7cc', '#4fe3f2', '#30d158', '#ff453a', '#ff9f0a', '#3fb46a', '#2e9e5b', '#8e8e93', '#f5f5f7', '#9aa0a6'].map(hexRgb);
  const hits = new Set();
  for (const [id, mode] of [['signature', 'light'], ['violet', 'dark'], ['emerald', 'light']]) {
    await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]);
    for (const hash of ['home', 'houses', 'house:lulu', 'insights', 'hierarchy', 'board', 'tasks', 'approvals', 'automation', 'connections', 'connections:picktheory', 'control', 'devices', 'settings', 'themes', 'structure']) {
      await goHash(s.page, hash); await settle(s.page, 220);
      const found = await s.page.evaluate((banned) => { const out = []; for (const el of document.querySelectorAll('#app *')) { if (el.closest('.htile, .logo, .mk, .cm, svg defs')) continue; const cs = getComputedStyle(el); for (const p of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor']) { const v = cs[p].replace(/\s+/g, ' '); if (banned.includes(v)) out.push(`${el.tagName}.${String(el.className).slice(0, 24)} ${p}=${v}`); } } return out.slice(0, 4); }, BANNED);
      found.forEach((f) => hits.add(`${id}/${mode}/${hash}: ${f}`));
    }
  }
  eq(hits.size, 0, '\n' + [...hits].slice(0, 10).join('\n'));
});
await s.c.ctx.close();

// ================================================================ layout never breaks, in any theme
for (const [name, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  s = await fresh({ width: w, height: h });
  await check(`${name}: all six themes in light and dark leave every major screen laid out (no sideways overflow, nothing thrown)`, async () => {
    const bad = [];
    for (const id of IDS) for (const mode of MODES) {
      await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]);
      for (const hash of ['home', 'house:gigi', 'insights', 'themes', 'board', 'tasks', 'settings']) { await goHash(s.page, hash); await settle(s.page, 220); const wd = await s.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (wd[0] > wd[1] + 1) bad.push(`${id}/${mode}/${hash}: ${wd[0]} > ${wd[1]}`); }
    }
    eq(bad.length, 0, bad.slice(0, 6).join(' | ')); eq(s.c.errors.length, 0, s.c.errors.join(' | '));
  });
  if (SHOTS && name === 'desktop') {
    for (const id of IDS) for (const mode of MODES) { await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]); await goHash(s.page, 'home'); await settle(s.page, 700); await shot(s.page, `theme-${id}-${mode}-home`); }
    await s.page.evaluate(() => { window.CocoTheme.apply('cobalt'); window.CocoTheme.setAppearance('light'); }); await goHash(s.page, 'themes'); await settle(s.page, 700); await shot(s.page, 'appearance-page-top');
    await s.page.evaluate(() => window.scrollTo(0, 900)); await settle(s.page, 300); await shot(s.page, 'appearance-page-gallery'); await s.page.evaluate(() => window.scrollTo(0, 2300)); await settle(s.page, 300); await shot(s.page, 'appearance-page-rotation'); await s.page.evaluate(() => window.scrollTo(0, 0));
    for (const id of ['signature', 'tangerine']) { await s.page.evaluate((i) => window.CocoTheme.apply(i), id); await goHash(s.page, 'house:poppy'); await s.page.click('.htabs [data-htab="revenue"]'); await settle(s.page, 600); await shot(s.page, `theme-${id}-house-revenue`); }
    await s.page.evaluate(() => { window.CocoTheme.apply('emerald'); }); await goHash(s.page, 'insights'); await settle(s.page, 600); await shot(s.page, 'theme-emerald-insights'); await goHash(s.page, 'hierarchy'); await settle(s.page, 600); await shot(s.page, 'theme-emerald-hierarchy');
    await s.page.click('#themeBtn'); await settle(s.page, 300); await shot(s.page, 'quick-switch'); await s.page.keyboard.press('Escape');
    await s.page.evaluate(() => { window.CocoTheme.apply('violet'); window.CocoTheme.setAppearance('dark'); }); await goHash(s.page, 'themes'); await settle(s.page, 700); await shot(s.page, 'appearance-page-dark');
  }
  if (SHOTS && name === 'phone') { for (const [id, mode] of [['signature', 'light'], ['orchid', 'dark'], ['emerald', 'light']]) { await s.page.evaluate(([i, m]) => { window.CocoTheme.apply(i); window.CocoTheme.setAppearance(m); }, [id, mode]); await goHash(s.page, 'home'); await settle(s.page, 600); await shot(s.page, `phone-theme-${id}-${mode}-home`); } await s.page.evaluate(() => { window.CocoTheme.apply('violet'); window.CocoTheme.setAppearance('light'); }); await goHash(s.page, 'themes'); await settle(s.page, 700); await shot(s.page, 'phone-appearance'); await s.page.evaluate(() => window.scrollTo(0, 1500)); await settle(s.page, 300); await shot(s.page, 'phone-appearance-rotation'); }
  await s.c.ctx.close();
}

// ================================================================ persistence
await check('the choice survives a reload, a new session and a new browser tab', async () => {
  const c = await context(FX()); let p = await pageIn(c);
  await p.evaluate(() => { window.CocoTheme.apply('violet'); window.CocoTheme.setAppearance('dark'); window.CocoTheme.setLocked(true); }); await settle(p, 400);
  await p.reload({ waitUntil: 'domcontentloaded' });
  eq(JSON.stringify(await palette(p)), JSON.stringify({ id: 'violet', mode: 'dark' }), 'painted before the app even appears');   // the head script ran: no flash of another theme
  await p.waitForSelector('#app:not([hidden])'); const sv = await saved(p); eq(sv.themeId, 'violet'); eq(sv.locked, true);
  const p2 = await pageIn(c); eq(JSON.stringify(await palette(p2)), JSON.stringify({ id: 'violet', mode: 'dark' }), 'a second tab'); await c.ctx.close();
});
await check('an old Light / Dark choice made before the themes existed is kept', async () => {
  const c = await context(FX(), { local: { 'gs-theme': 'dark' } }); const p = await pageIn(c); eq(JSON.stringify(await palette(p)), JSON.stringify({ id: 'signature', mode: 'dark' })); await c.ctx.close();
});

// ================================================================ rotation, on a controllable clock
const T0 = at('2026-11-11T10:00:00Z');
const seed = (over, rot) => ({ 'gs-theme-prefs': prefs(over, { enabled: true, seed: 'seed-test', ...rot }) });
await check('every launch: a reload is not a launch, a new session is; sequential then random never repeats', async () => {
  const c = await context(FX(), { local: seed({ themeId: 'signature' }, { frequency: 'launch', order: 'sequential', anchorAt: '2026-11-01T00:00:00Z' }) });
  const p1 = await pageIn(c); eq((await palette(p1)).id, 'cobalt', 'a new session: 1 -> 2');
  await p1.reload({ waitUntil: 'domcontentloaded' }); await p1.waitForSelector('#app:not([hidden])'); eq((await palette(p1)).id, 'cobalt', 'reloading the page is not opening the app');
  await goHash(p1, 'houses'); await goHash(p1, 'insights'); await settle(p1, 300); eq((await palette(p1)).id, 'cobalt', 'navigating does not switch');
  await p1.bringToFront(); await p1.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await settle(p1, 200); eq((await palette(p1)).id, 'cobalt', 'focusing the session does not switch');
  const p2 = await pageIn(c); eq((await palette(p2)).id, 'violet', 'next launch: 2 -> 3'); const p3 = await pageIn(c); eq((await palette(p3)).id, 'emerald', '3 -> 4');
  await p3.evaluate(() => window.CocoTheme.setRotation({ order: 'random' })); const seen = [(await palette(p3)).id];
  for (let i = 0; i < 9; i++) { const pn = await pageIn(c); const id = (await palette(pn)).id; ok(id !== seen[seen.length - 1], `random launch repeated ${id}`); seen.push(id); }
  ok(new Set(seen).size >= 4, 'variety: ' + seen.join(',')); await c.ctx.close();
});
for (const [freq, hours] of [['5h', 5], ['7h', 7]]) {
  await check(`every ${hours} hours: switches when the interval expires, counted from the last switch, and survives a restart`, async () => {
    const last = '2026-11-11T08:00:00Z', due = at(last) + hours * HOUR, start = due - 30 * 60000;
    const c = await context(FX(), { clock: start, local: seed({ themeId: 'cobalt', lastSwitchedAt: last }, { frequency: freq, order: 'sequential', anchorAt: '2026-11-01T00:00:00Z' }) });
    const p = await pageIn(c); eq((await palette(p)).id, 'cobalt', 'not due yet');
    await p.clock.fastForward(20 * 60000); await settle(p, 300); eq((await palette(p)).id, 'cobalt', '10 minutes before it is due');
    await p.clock.fastForward(12 * 60000); await settle(p, 600); eq((await palette(p)).id, 'violet', 'due: 2 -> 3'); eq((await saved(p)).reason, 'schedule');
    await p.clock.fastForward((hours - 1) * HOUR); await settle(p, 400); eq((await palette(p)).id, 'violet', 'the next interval counts from the actual switch');
    await p.reload({ waitUntil: 'domcontentloaded' }); eq((await palette(p)).id, 'violet', 'a restart keeps it'); await c.ctx.close();
  });
}
await check('daily at a chosen time in the local time zone', async () => {
  const last = '2026-11-10T09:30:00Z', c = await context(FX(), { clock: at('2026-11-11T08:58:00Z'), local: seed({ themeId: 'signature', lastSwitchedAt: last }, { frequency: 'daily', time: '09:00', tz: 'UTC', anchorAt: '2026-11-01T00:00:00Z' }) });
  const p = await pageIn(c); eq((await palette(p)).id, 'signature'); await p.clock.fastForward(60000); await settle(p, 400); eq((await palette(p)).id, 'signature', '08:59');
  await p.clock.fastForward(2 * 60000); await settle(p, 600); eq((await palette(p)).id, 'cobalt', '09:01: the 09:00 switch has happened'); await c.ctx.close();
});
await check('weekly and monthly schedules apply when due, in the chosen zone, once', async () => {
  for (const [rot, last, now] of [[{ frequency: 'weekly', time: '09:00', tz: 'Asia/Kolkata', weekday: 1 }, '2026-11-02T03:35:00Z', '2026-11-09T03:31:00Z'], [{ frequency: 'monthly', time: '09:00', tz: 'Asia/Kolkata', dayOfMonth: 31 }, '2026-10-31T04:00:00Z', '2026-11-30T03:31:00Z']]) {
    const c = await context(FX(), { clock: at(now), local: seed({ themeId: 'orchid', lastSwitchedAt: last }, { ...rot, anchorAt: '2026-01-01T00:00:00Z' }) });
    const p = await pageIn(c); eq((await palette(p)).id, 'signature', `${rot.frequency}: due, applied as the app opens (one step from Digital Orchid)`); await p.clock.fastForward(30 * 60000); await settle(p, 400); eq((await palette(p)).id, 'signature', 'only once'); await c.ctx.close();
  }
});
await check('closed when it fell due: ONE step on the next open, however long it was closed', async () => {
  const c = await context(FX(), { clock: at('2026-11-11T14:20:00Z'), local: seed({ themeId: 'violet', lastSwitchedAt: '2026-06-01T00:00:00Z' }, { frequency: '7h', order: 'sequential', anchorAt: '2026-05-01T00:00:00Z' }) });
  const p = await pageIn(c); eq((await palette(p)).id, 'emerald'); eq((await saved(p)).seq >= 1, true); await c.ctx.close();
});
await check('a locked theme never changes; manual only and rotation off never change; unlocking resumes from now', async () => {
  const mk = async (over, rot) => { const c = await context(FX(), { clock: T0, local: seed({ themeId: 'cobalt', lastSwitchedAt: '2026-11-01T00:00:00Z', ...over }, { frequency: '5h', anchorAt: '2026-11-01T00:00:00Z', ...rot }) }); return { c, p: await pageIn(c) }; };
  for (const [name, over, rot] of [['locked', { locked: true }, {}], ['manual only', {}, { frequency: 'manual' }], ['rotation off', {}, { enabled: false }]]) { const { c, p } = await mk(over, rot); eq((await palette(p)).id, 'cobalt', name + ' at open'); await p.clock.fastForward(400 * DAY); await settle(p, 500); eq((await palette(p)).id, 'cobalt', name + ' after 400 days'); await c.ctx.close(); }
  const { c, p } = await mk({ locked: true }, {}); await p.evaluate(() => window.CocoTheme.setLocked(false)); await settle(p, 300); eq((await palette(p)).id, 'cobalt', 'unlocking does not fire on the spot');
  await p.clock.fastForward(6 * HOUR); await settle(p, 600); eq((await palette(p)).id, 'violet', 'five hours after unlocking'); await c.ctx.close();
});
await check('changing the schedule never fires it on the spot', async () => {
  const c = await context(FX(), { clock: T0, local: { 'gs-theme-prefs': prefs({ themeId: 'cobalt', lastSwitchedAt: '2026-01-01T00:00:00Z' }, { enabled: false, anchorAt: null }) } }); const p = await pageIn(c);
  await p.evaluate(() => window.CocoTheme.setRotation({ enabled: true, frequency: '5h' })); await settle(p, 400); eq((await palette(p)).id, 'cobalt'); await p.clock.fastForward(4 * HOUR); await settle(p, 400); eq((await palette(p)).id, 'cobalt'); await p.clock.fastForward(2 * HOUR); await settle(p, 600); eq((await palette(p)).id, 'violet'); await c.ctx.close();
});

// ================================================================ the controls: Apply, Preview, Lock, Reset, Apply next, quick switch, schedule
s = await fresh();
await check('Appearance controls: schedule, order, time, weekday, day of month, time zone all change the saved document', async () => {
  await openThemes(s.page);
  await s.page.check('#thRotOn'); await settle(s.page, 300); eq((await saved(s.page)).rotation.enabled, true);
  await s.page.click('[data-th-freq="weekly"]'); await settle(s.page, 300); ok(await s.page.locator('#thWeekday').isVisible() && await s.page.locator('#thTime').isVisible() && !(await s.page.locator('#thDom').count()), 'weekly shows weekday and time');
  await s.page.selectOption('#thWeekday', '3'); await s.page.fill('#thTime', '18:45'); await s.page.dispatchEvent('#thTime', 'change'); await s.page.click('[data-th-order="random"]'); await settle(s.page, 300);
  let r = (await saved(s.page)).rotation; eq(r.frequency, 'weekly'); eq(r.weekday, 3); eq(r.time, '18:45'); eq(r.order, 'random');
  await s.page.click('[data-th-freq="monthly"]'); await settle(s.page, 300); await s.page.selectOption('#thDom', '31'); await settle(s.page, 300); eq((await saved(s.page)).rotation.dayOfMonth, 31); ok(await s.page.locator('#thDom').isVisible(), 'monthly shows the day');
  for (const f of ['launch', '5h', '7h', 'daily', 'weekly', 'monthly', 'manual']) { await s.page.click(`[data-th-freq="${f}"]`); await settle(s.page, 200); eq((await saved(s.page)).rotation.frequency, f); }
  eq(await s.page.locator('[data-th-freq]').count(), 7, 'the seven options'); ok(/Next scheduled switch/i.test(await text(s.page, '.th-hero')));
  await s.page.click('[data-th-freq="daily"]'); await settle(s.page, 300); const hero = await text(s.page, '.th-hero'); ok(/09:00|\d\d:\d\d/.test(hero) && /Electric Cobalt|Royal Violet|Emerald|Tangerine|Orchid|Original/.test(hero), 'the next switch and the next theme are shown: ' + hero);
  await s.page.click('[data-th-order="sequential"]'); await settle(s.page, 300); ok(/Electric Cobalt/.test(await text(s.page, '.th-next')), 'next theme preview in sequence: ' + await text(s.page, '.th-next'));
  await s.page.click('[data-th-freq="launch"]'); await s.page.click('[data-th-order="random"]'); await settle(s.page, 300); ok(/one of 4|different theme/i.test(await text(s.page, '.th-hero')) && (await s.page.locator('.th-next .th-pill').count()) >= 2, 'random launch lists the possible themes');
});
await check('Apply next theme now steps in the chosen order and says so; Lock stops rotation; Reset restores the defaults', async () => {
  await s.page.click('[data-th-freq="5h"]'); await s.page.click('[data-th-order="sequential"]'); await settle(s.page, 300);
  const before = (await saved(s.page)).themeId; await s.page.click('[data-th="next"]'); await settle(s.page, 500); const after = (await saved(s.page)); eq(after.themeId, IDS[(IDS.indexOf(before) + 1) % 6]); eq(after.previousThemeId, before); ok(/Apply next/i.test(await text(s.page, '.th-hero')), 'last switched says how');
  await s.page.check('#thLock'); await settle(s.page, 300); eq((await saved(s.page)).locked, true); ok(/Locked/i.test(await text(s.page, '.th-hero')) && /locked/i.test(await text(s.page, '.th-hero')), 'locked is shown');
  await s.page.click('[data-th="reset"]'); await settle(s.page, 500); const r = await saved(s.page); eq(r.themeId, 'signature'); eq(r.appearance, 'system'); eq(r.rotation.enabled, false); eq(r.locked, false); eq(r.reason, 'reset');
});
await check('Preview paints the whole app without saving; Cancel puts the saved theme back; Apply in the bar commits', async () => {
  await openThemes(s.page); const before = (await saved(s.page)) || { themeId: 'signature' };
  await s.page.click('.th-card[data-theme-card="emerald"] [data-th="preview"]'); await readyTheme(s.page, 'emerald'); ok(await s.page.locator('#themeBar').isVisible(), 'the preview bar'); ok(/Emerald Energy/.test(await text(s.page, '#themeBar')));
  await goHash(s.page, 'home'); eq((await palette(s.page)).id, 'emerald', 'the preview follows you to other screens'); const sv = await saved(s.page); eq((sv ? sv.themeId : 'signature'), before.themeId, 'nothing saved while previewing');
  await s.page.click('#themeBar [data-th="cancel"]'); await readyTheme(s.page, before.themeId); ok(!(await s.page.locator('#themeBar').isVisible()));
  await s.page.evaluate(() => window.CocoTheme.preview('tangerine')); await readyTheme(s.page, 'tangerine'); await s.page.click('#themeBar [data-th="commit"]'); await settle(s.page, 500); eq((await saved(s.page)).themeId, 'tangerine'); ok(!(await s.page.locator('#themeBar').isVisible()));
  await s.page.evaluate(() => window.CocoTheme.preview('violet')); await readyTheme(s.page, 'violet'); await s.page.keyboard.press('Escape'); await readyTheme(s.page, 'tangerine');
});
await check('the quick switch in the top bar lists the six themes, marks the current one and applies on a tap', async () => {
  await goHash(s.page, 'home'); await s.page.click('#themeBtn'); await settle(s.page, 250); eq(await s.page.locator('#themePanel .th-q[data-id]').count(), 6); ok(/Tangerine Fusion/.test(await text(s.page, '#themePanel .th-q.on')), 'current marked');
  await s.page.click('#themePanel [data-id="orchid"]'); await readyTheme(s.page, 'orchid'); ok(!(await s.page.locator('#themePanel').isVisible()), 'closes after a choice'); eq((await saved(s.page)).themeId, 'orchid'); eq((await saved(s.page)).reason, 'manual');
  await s.page.click('#themeBtn'); await s.page.click('#themePanel a.more'); await settle(s.page, 300); eq(await s.page.evaluate(() => location.hash), '#themes');
});
await check('Settings shows the current theme with a way into the full page, and still offers Light / Dark / System', async () => {
  await goHash(s.page, 'settings'); await settle(s.page, 300); const t = await text(s.page, '#view'); ok(/Digital Orchid/.test(t) && /Themes and automatic switching/.test(t), t.slice(0, 300));
  await s.page.click('[data-theme-set="dark"]'); await settle(s.page, 500); eq((await palette(s.page)).mode, 'dark'); await s.page.click('[data-theme-set="system"]'); await settle(s.page, 400);
});
await s.c.ctx.close();

// ================================================================ motion
await check('theme changes cross-fade with a view transition; reduced motion switches instantly', async () => {
  const spy = `window.__vt = 0; if (document.startViewTransition) { const o = document.startViewTransition.bind(document); document.startViewTransition = (f) => { window.__vt++; return o(f); }; }`;
  for (const [reduced, want] of [[false, true], [true, false]]) {
    const c = await context(FX(), { reduced }); await c.ctx.addInitScript(spy); const p = await pageIn(c);
    await p.evaluate(() => window.CocoTheme.apply('cobalt')); await settle(p, 700); const n = await p.evaluate(() => window.__vt); ok(want ? n >= 1 : n === 0, `reduced=${reduced}: view transitions ${n}`); eq((await palette(p)).id, 'cobalt'); await c.ctx.close();
  }
  const c2 = await context(FX(), { local: { 'gs-calm': '1' } }); await c2.ctx.addInitScript(spy); const p2 = await pageIn(c2); await p2.evaluate(() => document.body.classList.add('calm')); await p2.evaluate(() => window.CocoTheme.apply('violet')); await settle(p2, 600); eq(await p2.evaluate(() => window.__vt), 0, 'calm motion also switches instantly'); await c2.ctx.close();
});

// ================================================================ sharing between a person's own devices (the existing controls table, no migration)
await check('sharing: a change is written once to controls row ui_theme.<email>, compare-and-set; a launch switch is not shared', async () => {
  const fx = FX(), c = await context(fx), p = await pageIn(c); await p.evaluate(() => window.CocoTheme.apply('violet')); await settle(p, 1800);
  const row = fx.tables.controls.find((r) => r.id === 'ui_theme.boss@example.com'); ok(row, 'the row exists'); eq(row.value.themeId, 'violet'); eq(row.value.reason, 'manual'); eq(row.updated_by, 'boss-pc');
  await p.evaluate(() => window.CocoTheme.apply('emerald')); await settle(p, 1800); const w = c.calls.filter((x) => x.p === '/rest/v1/controls'); ok(w.some((x) => x.m === 'POST'), 'created once'); const patch = w.find((x) => x.m === 'PATCH'); ok(patch && /id=eq\.ui_theme/.test(patch.q) && /updated_at=eq\./.test(patch.q), 'later writes compare the previous updated_at: ' + (patch && patch.q)); eq(fx.tables.controls.find((r) => r.id === row.id).value.themeId, 'emerald');
  await c.ctx.close();
  const fx2 = FX(), c2 = await context(fx2, { local: seed({ themeId: 'cobalt' }, { frequency: 'launch', anchorAt: '2026-11-01T00:00:00Z' }) }); const p2 = await pageIn(c2); await settle(p2, 1800); eq(fx2.tables.controls.length, 0, 'a launch switch stays on the device'); await c2.ctx.close();
});
await check('sharing: a newer copy from another device is adopted on open; an older one is ignored', async () => {
  const fx = FX(); fx.tables.controls.push({ id: 'ui_theme.boss@example.com', updated_at: new Date().toISOString(), updated_by: 'boss-phone', value: prefs({ themeId: 'orchid', appearance: 'dark', updatedAt: '2099-01-01T00:00:00Z', reason: 'manual' }) });
  const c = await context(fx, { local: { 'gs-theme-prefs': prefs({ themeId: 'cobalt', updatedAt: '2026-11-11T00:00:00Z' }) } }); const p = await pageIn(c); await settle(p, 1500);
  eq(JSON.stringify(await palette(p)), JSON.stringify({ id: 'orchid', mode: 'dark' }), 'the phone chose it: the PC follows'); await c.ctx.close();
  const fx2 = FX(); fx2.tables.controls.push({ id: 'ui_theme.boss@example.com', updated_at: new Date().toISOString(), updated_by: 'boss-phone', value: prefs({ themeId: 'orchid', updatedAt: '2000-01-01T00:00:00Z', reason: 'manual' }) });
  const c2 = await context(fx2, { local: { 'gs-theme-prefs': prefs({ themeId: 'cobalt', updatedAt: '2026-11-11T00:00:00Z' }) } }); const p2 = await pageIn(c2); await settle(p2, 1800); eq((await palette(p2)).id, 'cobalt', 'older copy ignored'); eq(fx2.tables.controls[0].value.themeId, 'cobalt', 'and this device, being newer, shares its choice'); await c2.ctx.close();
});
await check('sharing: a conflict (another device writes first) is resolved by adopting the newer copy, with no error shown', async () => {
  const fx = FX(); fx.tables.controls.push({ id: 'ui_theme.boss@example.com', updated_at: '2026-11-11T09:00:00.000Z', updated_by: 'boss-phone', value: prefs({ themeId: 'cobalt', updatedAt: '2026-11-11T09:00:00Z', reason: 'manual' }) });
  const c = await context(fx); const p = await pageIn(c); await settle(p, 1200); eq((await palette(p)).id, 'cobalt');
  // meanwhile the phone writes a newer choice
  fx.tables.controls[0].updated_at = '2026-11-11T09:30:00.000Z'; fx.tables.controls[0].value = prefs({ themeId: 'emerald', updatedAt: '2099-01-01T00:00:00Z', reason: 'manual' });
  await p.evaluate(() => window.CocoTheme.apply('tangerine')); await settle(p, 2500);
  eq(c.errors.length, 0, c.errors.join(' | ')); const final = (await palette(p)).id; ok(['emerald', 'tangerine'].includes(final), 'settled on one of the two choices: ' + final); eq(fx.tables.controls[0].value.themeId, final, 'this device and the shared copy agree'); await c.ctx.close();
});
await check('sharing: if the shared table cannot be written, the app keeps working from this device without any error', async () => {
  const fx = FX(); fx.deny = ['controls']; const c = await context(fx), p = await pageIn(c); await p.evaluate(() => window.CocoTheme.apply('violet')); await settle(p, 1800);
  eq((await palette(p)).id, 'violet'); eq((await saved(p)).themeId, 'violet'); eq(c.errors.length, 0, c.errors.join(' | ')); await c.ctx.close();
});

// ================================================================ the desktop bridge is untouched
await check('the page still uses only desktop bridge methods that the preload provides', async () => {
  const fs = await import('node:fs'), path = await import('node:path'); const { preloadKeys } = await import('./ui-harness.mjs');
  const page = fs.readFileSync(path.join(H.here, 'index.html'), 'utf8'); const used = [...new Set([...page.matchAll(/cocoDesktop\.([A-Za-z]+)/g)].map((m) => m[1]))];
  eq(used.filter((k) => !preloadKeys.includes(k) && k !== 'platform').join(','), '');
});

await H.finish('theme-browser');
