// Run: node contract/build-themes.mjs
//
// Generates contract/theme-schemes.json: the complete Material 3 colour roles of the six Coco themes, light and dark, from the seed colours in
// themes.json. Desktop, phone and Android all read the SAME generated tables, so no client ever computes (or drifts from) another's palette.
//
// The tonal palettes come from Google's own Material Color Utilities (HCT colour space), the reference implementation of Material You. It is a
// DEV dependency used only here: the apps ship the generated numbers, not the library.
//
// Every text pair is checked against WCAG AA while generating (4.5:1 for text, 3:1 for graphics and boundaries); the build FAILS rather than
// shipping a theme that is hard to read. Theme 1 (Original Signature) keeps its five brand values exactly; only its supporting roles are generated.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
// the library ships ES modules with extensionless imports, which Node refuses: resolve them the way a bundler would
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(spec, ctx, next) { try { return await next(spec, ctx); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && /^[./]/.test(spec)) { for (const s of ['.js', '/index.js']) { try { return await next(spec + s, ctx); } catch {} } } throw e; } }`), import.meta.url);
const libDir = path.join(dir, '..', 'node_modules', '@material', 'material-color-utilities');
const M = await import(pathToFileURL(path.join(libDir, 'index.js')).href);
const { TonalPalette, Hct, argbFromHex, hexFromArgb } = M;
const LIB_VERSION = JSON.parse(fs.readFileSync(path.join(libDir, 'package.json'), 'utf8')).version;

const src = JSON.parse(fs.readFileSync(path.join(dir, 'themes.json'), 'utf8'));
const hex = (argb) => hexFromArgb(argb).toUpperCase();
const norm = (h) => String(h).toUpperCase();

// ---------------------------------------------------------------- WCAG
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------------------------------------------------------------- the role list (also the Android ColorScheme + CSS variable contract)
export const ROLES = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'error', 'onError', 'errorContainer', 'onErrorContainer',
  'success', 'onSuccess', 'successContainer', 'onSuccessContainer', 'warning', 'onWarning', 'warningContainer', 'onWarningContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'outline', 'outlineVariant',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary', 'scrim', 'shadow',
  'accent', 'onAccent', 'link', 'selected', 'onSelected', 'cta', 'onCta', 'ctaEdge', 'highlight', 'onHighlight', 'cardSurface', 'fieldSurface', 'fieldSurface2', 'chart1', 'chart2', 'chart3'];

// ---------------------------------------------------------------- palettes from seeds
function palettesFor(theme) {
  const p = argbFromHex(theme.seeds.primary), hue = Hct.fromInt(p).hue;
  return {
    a1: TonalPalette.fromInt(p), a2: TonalPalette.fromInt(argbFromHex(theme.seeds.secondary)), a3: TonalPalette.fromInt(argbFromHex(theme.seeds.tertiary)),
    n1: TonalPalette.fromHueAndChroma(hue, 6), n2: TonalPalette.fromHueAndChroma(hue, 10),
    // meaning never changes between themes: error is always red, success always green, warning always amber
    err: TonalPalette.fromHueAndChroma(25, 84), suc: TonalPalette.fromHueAndChroma(146, 52), war: TonalPalette.fromHueAndChroma(78, 62),
  };
}
const T = (pal, tone) => hex(pal.tone(tone));
const bestOn = (fill) => (contrast(fill, '#FFFFFF') >= contrast(fill, '#000000') ? '#FFFFFF' : '#000000');
// a seed colour used as a graphic (chart line, switch track): the seed itself when it reads on every host at 3:1, otherwise the same hue and chroma at the nearest tone that does
function graphic(seed, pal, hosts, light) {
  if (hosts.every((h) => contrast(seed, h) >= 3)) return seed;
  for (let t = 60, i = 0; i < 60; i++, t += light ? -1 : 1) { const c = T(pal, Math.max(0, Math.min(100, t))); if (hosts.every((h) => contrast(c, h) >= 3)) return c; }
  throw new Error('no tone reads as a graphic on the hosts');
}

// A tone that reads on every host surface: starts where Material starts and walks toward more contrast until it passes.
function readable(pal, start, step, hosts, min) {
  for (let t = start, i = 0; i < 40; i++, t += step) { const h = T(pal, Math.max(0, Math.min(100, t))); if (hosts.every((b) => contrast(h, b) >= min)) return h; }
  throw new Error(`no tone of the palette reaches ${min}:1 on ${hosts.join(', ')}`);
}

function generated(P, mode, neutralOverride, theme) {
  const L = mode === 'light', n1 = neutralOverride ? neutralOverride.n1 : P.n1, n2 = neutralOverride ? neutralOverride.n2 : P.n2;
  const tone = L ? { m: 40, on: 100, c: 90, onc: 10 } : { m: 80, on: 20, c: 30, onc: 90 };
  const fam = (pal) => [T(pal, tone.m), T(pal, tone.on), T(pal, tone.c), T(pal, tone.onc)];
  const [pr, onpr, prc, onprc] = fam(P.a1), [se, onse, sec, onsec] = fam(P.a2), [te, onte, tec, ontec] = fam(P.a3);
  const [er, oner, erc, onerc] = fam(P.err), [su, onsu, suc, onsuc] = fam(P.suc), [wa, onwa, wac, onwac] = fam(P.war);
  const bg = T(n1, L ? 96 : 6), card = T(n1, L ? 100 : 12), field = T(n1, L ? 94 : 17), field2 = T(n1, L ? 90 : 22);
  // status text must read on the page, the card and both field surfaces
  const hosts = [bg, card, field, field2];
  const accent = norm(theme.seeds.primary), hl = norm(theme.seeds.tertiary), gh = [bg, card, field];
  return {
    primary: pr, onPrimary: onpr, primaryContainer: prc, onPrimaryContainer: onprc,
    secondary: se, onSecondary: onse, secondaryContainer: sec, onSecondaryContainer: onsec,
    tertiary: te, onTertiary: onte, tertiaryContainer: tec, onTertiaryContainer: ontec,
    error: readable(P.err, tone.m, L ? -2 : 2, hosts, 4.5), onError: oner, errorContainer: erc, onErrorContainer: onerc,
    success: readable(P.suc, tone.m, L ? -2 : 2, hosts, 4.5), onSuccess: onsu, successContainer: suc, onSuccessContainer: onsuc,
    warning: readable(P.war, tone.m, L ? -2 : 2, hosts, 4.5), onWarning: onwa, warningContainer: wac, onWarningContainer: onwac,
    background: bg, onBackground: T(n1, L ? 10 : 90), surface: bg, onSurface: T(n1, L ? 10 : 90), surfaceVariant: T(n2, L ? 90 : 30), onSurfaceVariant: T(n2, L ? 30 : 80),
    outline: T(n2, L ? 50 : 60), outlineVariant: T(n2, L ? 80 : 30),
    surfaceContainerLowest: T(n1, L ? 100 : 4), surfaceContainerLow: T(n1, L ? 98 : 10), surfaceContainer: T(n1, L ? 94 : 12), surfaceContainerHigh: T(n1, L ? 92 : 17), surfaceContainerHighest: T(n1, L ? 90 : 22),
    inverseSurface: T(n1, L ? 20 : 90), inverseOnSurface: T(n1, L ? 95 : 20), inversePrimary: T(P.a1, L ? 80 : 40), scrim: '#000000', shadow: '#000000',
    // the vivid seed colours, used exactly where a fill should be vivid: buttons, switches, highlights, chart lines
    accent: graphic(accent, P.a1, gh, L), onAccent: bestOn(graphic(accent, P.a1, gh, L)),
    link: readable(P.a1, tone.m, L ? -2 : 2, hosts, 4.5), selected: prc, onSelected: onprc, cta: graphic(accent, P.a1, gh, L), onCta: bestOn(graphic(accent, P.a1, gh, L)), ctaEdge: 'transparent', highlight: hl, onHighlight: bestOn(hl),
    cardSurface: card, fieldSurface: field, fieldSurface2: field2,
    chart1: graphic(accent, P.a1, gh, L), chart2: graphic(norm(theme.seeds.secondary), P.a2, gh, L), chart3: graphic(hl, P.a3, gh, L),
  };
}

// ---------------------------------------------------------------- Theme 1: the locked signature
function signature(theme) {
  const b = theme.brand, P = palettesFor(theme);
  for (const k of Object.keys(b)) b[k] = norm(b[k]);
  const hAub = Hct.fromInt(argbFromHex(b.darkBackground)), hLav = Hct.fromInt(argbFromHex(b.lightBackground));
  const neutralDark = { n1: TonalPalette.fromHueAndChroma(hAub.hue, Math.max(hAub.chroma, 8)), n2: TonalPalette.fromHueAndChroma(hAub.hue, Math.max(hAub.chroma, 8) + 4) };
  const neutralLight = { n1: TonalPalette.fromHueAndChroma(hLav.hue, Math.max(hLav.chroma, 6)), n2: TonalPalette.fromHueAndChroma(hLav.hue, Math.max(hLav.chroma, 6) + 4) };
  const lightGen = generated(P, 'light', neutralLight, theme), darkGen = generated(P, 'dark', neutralDark, theme);
  const BLACK = b.black, PINK = b.hotPink, YELLOW = b.brightYellow, ON_BLACK = '#F6F0F9', MUTED_ON_BLACK = '#CDBFD7';
  // the brand colours exactly where the founders put them: black cards and navigation, pink for selection and accents, yellow for highlights and calls to action
  const brand = (cta, edge) => ({ primary: PINK, onPrimary: BLACK, accent: PINK, onAccent: BLACK, tertiary: YELLOW, onTertiary: BLACK, selected: PINK, onSelected: BLACK, cta: YELLOW, onCta: BLACK, ctaEdge: edge, highlight: YELLOW, onHighlight: BLACK, chart1: PINK, chart2: YELLOW });
  const onBlack = {   // everything that lives on a black card or the black navigation, in either mode
    ...darkGen, ...brand(YELLOW, 'transparent'),
    background: BLACK, surface: BLACK, onBackground: ON_BLACK, onSurface: ON_BLACK, onSurfaceVariant: MUTED_ON_BLACK, outline: '#8E8398', outlineVariant: '#3E3640',
    cardSurface: BLACK, fieldSurface: '#221E21', fieldSurface2: '#2A2529', link: PINK, chart3: T(P.a2, 70),
    surfaceContainerLowest: BLACK, surfaceContainerLow: '#1D1A1C', surfaceContainer: '#221E21', surfaceContainerHigh: '#2A2529', surfaceContainerHighest: '#332D31',
    inverseSurface: b.lightBackground, inverseOnSurface: BLACK,
  };
  const darkPage = {
    ...darkGen, ...brand(YELLOW, 'transparent'),
    background: b.darkBackground, surface: b.darkBackground, onBackground: '#F4EAF8', onSurface: '#F4EAF8', cardSurface: BLACK, link: PINK, chart3: T(P.a2, 70),
    fieldSurface: T(neutralDark.n1, 12), fieldSurface2: T(neutralDark.n1, 15),
    surfaceContainerLowest: BLACK, surfaceContainerLow: T(neutralDark.n1, 10), surfaceContainer: T(neutralDark.n1, 13), surfaceContainerHigh: T(neutralDark.n1, 18), surfaceContainerHighest: T(neutralDark.n1, 23),
    inverseSurface: b.lightBackground, inverseOnSurface: BLACK,
  };
  const lightPage = {
    ...lightGen, ...brand(YELLOW, BLACK),
    background: b.lightBackground, surface: b.lightBackground, onBackground: BLACK, onSurface: BLACK, cardSurface: BLACK,
    // text and links on lavender need a deeper pink than the brand pink, which stays the fill of selected states
    link: readable(P.a1, 40, -2, [b.lightBackground, T(neutralLight.n1, 94), T(neutralLight.n1, 90)], 4.5), chart3: T(P.a2, 70),
    fieldSurface: T(neutralLight.n1, 92), fieldSurface2: T(neutralLight.n1, 88),
    surfaceContainerLowest: T(neutralLight.n1, 98), surfaceContainerLow: T(neutralLight.n1, 95), surfaceContainer: T(neutralLight.n1, 91), surfaceContainerHigh: T(neutralLight.n1, 89), surfaceContainerHighest: T(neutralLight.n1, 86),
    inverseSurface: BLACK, inverseOnSurface: b.lightBackground,
  };
  return { light: { page: lightPage, panel: onBlack }, dark: { page: darkPage, panel: { ...onBlack, ...{ background: BLACK } } } };
}

// ---------------------------------------------------------------- build + verify
const out = { generator: `@material/material-color-utilities ${LIB_VERSION} (HCT)`, roles: ROLES, themes: {} };
const problems = [];
const check = (theme, mode, scope, s, hosts, cardIsOpposite) => {
  const need = (fg, bg, min, what) => { const c = contrast(s[fg], s[bg]); if (c < min) problems.push(`${theme}/${mode}/${scope}: ${what || fg + ' on ' + bg} is ${c.toFixed(2)}:1, needs ${min}`); return c; };
  for (const h of hosts) {
    need('onSurface', h, 4.5); need('onSurfaceVariant', h, 4.5); need('link', h, 4.5, `link on ${h}`); need('error', h, 4.5); need('success', h, 4.5); need('warning', h, 4.5);
    need('outline', h, 3, `outline (boundaries) on ${h}`);
    if (!cardIsOpposite && h !== 'fieldSurface2') need('accent', h, 3, `accent (graphics) on ${h}`);
    if (!cardIsOpposite && h !== 'fieldSurface2') for (const c of ['chart1', 'chart2', 'chart3']) need(c, h, 3, `${c} (graphics) on ${h}`);
  }
  // charts are drawn inside cards: where the card is the opposite polarity of the page, that is the surface they must read on
  if (cardIsOpposite) for (const c of ['chart1', 'chart2', 'chart3']) need(c, 'cardSurface', 3, `${c} (graphics) on the card`);
  for (const [fg, bg] of [['onPrimary', 'primary'], ['onPrimaryContainer', 'primaryContainer'], ['onSecondary', 'secondary'], ['onSecondaryContainer', 'secondaryContainer'], ['onTertiary', 'tertiary'], ['onTertiaryContainer', 'tertiaryContainer'],
    ['onError', 'error'], ['onErrorContainer', 'errorContainer'], ['onSuccess', 'success'], ['onSuccessContainer', 'successContainer'], ['onWarning', 'warning'], ['onWarningContainer', 'warningContainer'],
    ['onSelected', 'selected'], ['onCta', 'cta'], ['onAccent', 'accent'], ['onHighlight', 'highlight'], ['inverseOnSurface', 'inverseSurface']]) need(fg, bg, 4.5);
  // status colours must also read as text on their own containers
  need('onSuccessContainer', 'successContainer', 4.5); need('onWarningContainer', 'warningContainer', 4.5);
};
for (const theme of src.themes) {
  let schemes;
  if (theme.id === 'signature') schemes = signature(theme);
  else { const P = palettesFor(theme), light = generated(P, 'light', null, theme), dark = generated(P, 'dark', null, theme); schemes = { light: { page: light, panel: light }, dark: { page: dark, panel: dark } }; }
  for (const mode of ['light', 'dark']) for (const scope of ['page', 'panel']) {
    const s = schemes[mode][scope];
    for (const r of ROLES) if (!s[r]) problems.push(`${theme.id}/${mode}/${scope}: role ${r} is missing`);
    // text sits on the page and on field surfaces everywhere; on the card too unless the card is deliberately the opposite polarity (Signature, light page)
    const cardIsOpposite = theme.id === 'signature' && mode === 'light' && scope === 'page';
    const hosts = scope === 'page' ? ['background', 'fieldSurface', 'fieldSurface2'].concat(cardIsOpposite ? [] : ['cardSurface']) : ['cardSurface', 'fieldSurface', 'fieldSurface2'];
    check(theme.id, mode, scope, s, hosts, cardIsOpposite);
  }
  out.themes[theme.id] = schemes;
}
if (problems.length) { console.error('AA contrast / completeness problems:\n  ' + problems.join('\n  ')); process.exit(1); }
const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {   // regenerate in memory and compare: does the committed file still match the seeds?
  const same = fs.readFileSync(path.join(dir, 'theme-schemes.json'), 'utf8') === text;
  console.log(same ? 'theme-schemes.json is exactly what the seeds generate' : 'theme-schemes.json is OUT OF DATE: run node contract/build-themes.mjs'); process.exit(same ? 0 : 1);
}
fs.writeFileSync(path.join(dir, 'theme-schemes.json'), text);
console.log(`theme-schemes.json written: ${src.themes.length} themes x light/dark x page/panel, ${ROLES.length} roles each, all text pairs >= 4.5:1`);
