// Run: node theme-schemes.test.js
// The colour contract of the six themes: what themes.json promises, what the generator produced, and that nothing in the app drifted from it.
//   - the six themes, their names and seed colours exactly as the founders specified; Original Signature's five brand values untouched
//   - every Material 3 role present for every theme, light and dark, page and panel
//   - WCAG AA measured independently of the generator; warning, error and success keep their meaning (amber, red, green) in every theme
//   - the generated files, the generated CSS blocks and the committed palette agree with each other
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadEngine, fallbackBlock, panelsBlock, FALLBACK, PANELS } from './contract/theme-css.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const themes = read('contract/themes.json'), schemes = read('contract/theme-schemes.json');
const { contract, E } = loadEngine();
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; process.exitCode = 1; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 5).join('\n     ')); } };

// ---------------------------------------------------------------- WCAG, written again here so the generator is not marking its own homework
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hue = (h) => { const n = parseInt(h.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; x *= 60; return x < 0 ? x + 360 : x; };
const HEX = /^#[0-9A-F]{6}$/;

t('the six themes are exactly as specified: names, order and seed colours', () => {
  assert.deepEqual(themes.themes.map((x) => x.id), ['signature', 'cobalt', 'violet', 'emerald', 'tangerine', 'orchid']);
  assert.deepEqual(themes.themes.map((x) => x.name), ['Original Signature', 'Electric Cobalt', 'Royal Violet', 'Emerald Energy', 'Tangerine Fusion', 'Digital Orchid']);
  assert.deepEqual(themes.themes.map((x) => x.number), [1, 2, 3, 4, 5, 6]);
  const want = { signature: ['#FF39A8', '#B76FD6', '#FFE52E'], cobalt: ['#3563E9', '#35CFC9', '#FF9F43'], violet: ['#7655D9', '#35C6F2', '#FF719A'], emerald: ['#168A5B', '#B5DE55', '#55BCE8'], tangerine: ['#E76F38', '#477BFF', '#FFD166'], orchid: ['#B43ACB', '#43D9B2', '#F4C95D'] };
  for (const th of themes.themes) assert.deepEqual([th.seeds.primary, th.seeds.secondary, th.seeds.tertiary].map((x) => x.toUpperCase()), want[th.id], th.id);
});
t('Original Signature is LOCKED: black, hot pink, bright yellow, deep aubergine and soft lavender, byte for byte', () => {
  const b = themes.themes[0].brand; assert.equal(themes.themes[0].locked, true);
  assert.deepEqual({ ...b }, { black: '#151313', hotPink: '#FF39A8', brightYellow: '#FFE52E', darkBackground: '#24152E', lightBackground: '#F0EAF7' });
  for (const mode of ['light', 'dark']) { const p = schemes.themes.signature[mode].page, q = schemes.themes.signature[mode].panel; assert.equal(p.cardSurface, '#151313'); assert.equal(q.cardSurface, '#151313'); assert.equal(p.accent, '#FF39A8'); assert.equal(p.selected, '#FF39A8'); assert.equal(p.cta, '#FFE52E'); assert.equal(p.highlight, '#FFE52E'); assert.equal(q.accent, '#FF39A8'); assert.equal(q.cta, '#FFE52E'); }
  assert.equal(schemes.themes.signature.light.page.background, '#F0EAF7'); assert.equal(schemes.themes.signature.dark.page.background, '#24152E');
  assert.equal(schemes.themes.signature.light.page.surface, '#F0EAF7'); assert.equal(schemes.themes.signature.dark.page.surface, '#24152E');
});
t('every theme has every Material 3 colour role in light and dark, for the page and for panels', () => {
  const required = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer', 'tertiary', 'onTertiary', 'tertiaryContainer', 'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'outline', 'outlineVariant', 'error', 'success', 'warning'];
  for (const r of required) assert.ok(schemes.roles.includes(r), 'role list lacks ' + r);
  assert.equal(schemes.roles.length, new Set(schemes.roles).size);
  for (const id of themes.themes.map((x) => x.id)) for (const mode of ['light', 'dark']) for (const scope of ['page', 'panel']) for (const r of schemes.roles) { const v = schemes.themes[id][mode][scope][r]; assert.ok(v, `${id}/${mode}/${scope} lacks ${r}`); assert.match(v, /^(#[0-9A-F]{6}|transparent)$/, `${id}/${mode}/${scope}/${r}=${v}`); }
});
t('text reaches WCAG AA everywhere: body, muted, link and status text on the page, cards and fields; button and chip text on their fills', () => {
  const bad = [];
  for (const id of Object.keys(schemes.themes)) for (const mode of ['light', 'dark']) for (const scope of ['page', 'panel']) {
    const s = schemes.themes[id][mode][scope], opposite = id === 'signature' && mode === 'light' && scope === 'page';
    const hosts = scope === 'page' ? ['background', 'fieldSurface', 'fieldSurface2'].concat(opposite ? [] : ['cardSurface']) : ['cardSurface', 'fieldSurface', 'fieldSurface2'];
    for (const h of hosts) for (const fg of ['onSurface', 'onSurfaceVariant', 'link', 'error', 'success', 'warning']) if (ratio(s[fg], s[h]) < 4.5) bad.push(`${id}/${mode}/${scope} ${fg} on ${h} ${ratio(s[fg], s[h]).toFixed(2)}`);
    for (const h of hosts) if (ratio(s.outline, s[h]) < 3) bad.push(`${id}/${mode}/${scope} outline on ${h}`);
    for (const [fg, bg] of [['onPrimary', 'primary'], ['onPrimaryContainer', 'primaryContainer'], ['onSecondary', 'secondary'], ['onSecondaryContainer', 'secondaryContainer'], ['onTertiary', 'tertiary'], ['onTertiaryContainer', 'tertiaryContainer'], ['onError', 'error'], ['onErrorContainer', 'errorContainer'], ['onSuccess', 'success'], ['onSuccessContainer', 'successContainer'], ['onWarning', 'warning'], ['onWarningContainer', 'warningContainer'], ['onSelected', 'selected'], ['onCta', 'cta'], ['onAccent', 'accent'], ['onHighlight', 'highlight'], ['inverseOnSurface', 'inverseSurface']]) if (ratio(s[fg], s[bg]) < 4.5) bad.push(`${id}/${mode}/${scope} ${fg} on ${bg} ${ratio(s[fg], s[bg]).toFixed(2)}`);
  }
  assert.deepEqual(bad, []);
});
t('warning, error and success keep their meaning in every theme: amber, red, green', () => {
  for (const id of Object.keys(schemes.themes)) for (const mode of ['light', 'dark']) { const s = schemes.themes[id][mode].page;
    const e = hue(s.error), g = hue(s.success), w = hue(s.warning);
    assert.ok(e >= 340 || e <= 22, `${id}/${mode} error hue ${e.toFixed(0)} must be red`); assert.ok(g >= 95 && g <= 165, `${id}/${mode} success hue ${g.toFixed(0)} must be green`); assert.ok(w >= 28 && w <= 62, `${id}/${mode} warning hue ${w.toFixed(0)} must be amber`);
    for (const c of ['errorContainer', 'successContainer', 'warningContainer']) assert.ok(lum(s[c]) > (mode === 'light' ? 0.5 : 0) && true, c); }
  const same = (r) => new Set(Object.keys(schemes.themes).map((id) => schemes.themes[id].light.page[r])).size; assert.equal(same('errorContainer'), 1, 'the error container is the same red everywhere'); assert.equal(same('successContainer'), 1, 'the success container is the same green everywhere');
});
t('the other themes really use their seeds: vivid accent, highlight and chart colours come from the three seed colours', () => {
  for (const th of themes.themes.slice(1)) { const d = schemes.themes[th.id].dark.page; assert.equal(d.highlight, th.seeds.tertiary.toUpperCase(), th.id + ' highlight'); assert.equal(d.chart2, th.seeds.secondary.toUpperCase(), th.id + ' chart 2'); assert.equal(d.chart3, th.seeds.tertiary.toUpperCase(), th.id + ' chart 3'); }
  // the tonal palettes are derived, not copied: containers and surfaces are not any seed value
  for (const th of themes.themes.slice(1)) { const l = schemes.themes[th.id].light.page; for (const seed of Object.values(th.seeds)) for (const r of ['background', 'surface', 'primaryContainer', 'secondaryContainer', 'cardSurface']) assert.notEqual(l[r], seed.toUpperCase(), `${th.id} ${r} must be a generated tone`); }
  // light and dark are really different palettes with the same hue family
  for (const id of Object.keys(schemes.themes)) assert.notEqual(schemes.themes[id].light.page.background, schemes.themes[id].dark.page.background);
});
t('themes are distinct: no two share an accent, a page colour or a selected colour', () => {
  for (const mode of ['light', 'dark']) for (const r of ['accent', 'background', 'selected', 'link']) assert.equal(new Set(Object.keys(schemes.themes).map((id) => schemes.themes[id][mode].page[r])).size, 6, `${mode}/${r}`);
});
t('rotation options: seven frequencies and two orders, with sane defaults', () => {
  assert.deepEqual(themes.frequencies.map((f) => f.id), ['launch', '5h', '7h', 'daily', 'weekly', 'monthly', 'manual']); assert.deepEqual(themes.orders.map((o) => o.id), ['sequential', 'random']);
  assert.equal(themes.frequencies.find((f) => f.id === '5h').hours, 5); assert.equal(themes.frequencies.find((f) => f.id === '7h').hours, 7);
  assert.equal(themes.defaults.themeId, 'signature'); assert.equal(themes.defaults.appearance, 'system'); assert.equal(themes.defaults.rotation.enabled, false); assert.equal(themes.font.family, 'Space Grotesk');
});

// ---------------------------------------------------------------- the generated files agree with each other
t('theme-contract.js and nav-contract.js are exactly what the JSON sources generate', () => {
  const body = (f, name) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => l.startsWith('window.' + name))[0].replace('window.' + name + ' = ', '').replace(/;$/, ''));
  assert.deepEqual(body('contract/theme-contract.js', 'COCO_THEMES'), JSON.parse(JSON.stringify(contract)), 'run: node contract/build.mjs');
  assert.deepEqual(body('contract/nav-contract.js', 'COCO_NAV'), read('contract/nav-contract.json'), 'run: node contract/build.mjs');
});
t('index.html holds exactly the generated theme blocks (fallback palette and panel remap), nothing hand-edited', () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const cut = (m) => html.slice(html.indexOf(m.start), html.indexOf(m.end) + m.end.length);
  assert.equal(cut(FALLBACK), fallbackBlock(E), 'the fallback block is stale: run node contract/build.mjs'); assert.equal(cut(PANELS), panelsBlock(E), 'the panel block is stale: run node contract/build.mjs');
});
t('every surface that re-declares its colours does so for every variable, and the page loads the engine before first paint', () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), head = html.slice(0, html.indexOf('<style>'));
  assert.ok(head.indexOf('contract/theme-contract.js') > 0 && head.indexOf('theme-engine.js') > head.indexOf('theme-contract.js') && head.indexOf('theme-mock.js') > 0 && head.indexOf('CocoTheme.boot()') > head.indexOf('theme-engine.js'), 'the theme is applied in <head>, before the first paint');
  assert.ok(html.includes("--p-scheme"), 'native controls follow the panel'); for (const v of E.PANEL_VARS) assert.ok(html.includes(`${v}: var(--p-${v.slice(2)});`), v + ' missing from the panel block');
});
t('no stray colour literals: index.html writes colours only in the generated fallback block (and a short, named list of exceptions)', () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), a = html.indexOf(FALLBACK.start), b = html.indexOf(FALLBACK.end), rest = html.slice(0, a) + html.slice(b);
  const hex = [...new Set([...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()))].sort();
  // #151313: the browser-bar colour before the engine runs; #fff: the glyph on a House tile and the gloss on a mark; #c0392b and #2f55c4: last-resort fallbacks that the engine always overrides
  assert.deepEqual(hex, ['#151313', '#2f55c4', '#c0392b', '#fff'], 'a colour was hardcoded: ' + hex.join(' '));
  assert.ok(!/rgba?\(\s*(?!0[ ,]+0[ ,]+0)\d/.test(rest.replace(/rgb\(0 0 0[^)]*\)/g, '')) , 'a raw rgb colour that is not a neutral shadow');
});
t('the typeface is Space Grotesk everywhere, vendored with its licence', () => {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(/--body: "Space Grotesk"/.test(html) && /--display: "Space Grotesk"/.test(html)); assert.ok(!/Fraunces|Figtree|Bagel Fat|Inter:wght/.test(html), 'an old typeface is still referenced');
  for (const f of ['SpaceGrotesk-latin.woff2', 'SpaceGrotesk-latin-ext.woff2', 'SpaceGrotesk-vietnamese.woff2', 'OFL Space Grotesk.txt']) assert.ok(fs.existsSync(path.join(dir, 'fonts', f)), f);
  assert.ok(/SIL OPEN FONT LICENSE/i.test(fs.readFileSync(path.join(dir, 'fonts', 'OFL Space Grotesk.txt'), 'utf8')));
});
t('the committed palette is exactly what the seeds generate (when the generator dependency is installed)', () => {
  if (!fs.existsSync(path.join(dir, 'node_modules', '@material', 'material-color-utilities'))) { console.log('     (skipped: npm install the dev dependency to check)'); return; }
  const r = spawnSync(process.execPath, [path.join(dir, 'contract', 'build-themes.mjs'), '--check'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr);
});

console.log(`\ntheme schemes: ${pass} passed, ${fail} failed`);
