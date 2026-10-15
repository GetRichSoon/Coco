#!/usr/bin/env node
// Theme builder. One tokens.json per theme -> CSS vars, Flutter colors, Compose colors, SVG shapes.
// Usage: node company/design/themes/build.mjs [themeId]   (default: every theme in themes.json)
//        node company/design/themes/build.mjs --check     (contrast check only, exit 1 on failure)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const registry = JSON.parse(readFileSync(join(ROOT, 'themes.json'), 'utf8'));
const ids = args.filter(a => !a.startsWith('--'));
const targets = ids.length ? ids : registry.themes.map(t => t.id);

// ---- colour math -----------------------------------------------------------
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = h => {
  const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function check(t) {
  const fails = [];
  for (const mode of ['light', 'dark']) {
    for (const [bg, fg, min] of t.contrastPairs) {
      const c = contrast(t[mode][bg], t[mode][fg]);
      if (c < min) fails.push(`${mode} ${bg}/${fg} ${c.toFixed(2)} < ${min}`);
    }
  }
  for (const d of t.duos) {
    const c = contrast(t.palette[d.bg].hex, t.palette[d.fg].hex);
    if (c < t.duoMinContrast) fails.push(`duo ${d.id} ${c.toFixed(2)} < ${t.duoMinContrast}`);
  }
  return fails;
}

// ---- shapes: every shape is 96 points on a polar curve, so any two can morph ----
const N = 96;
// Union of round lobes (petals/leaves): distance to the far edge of the nearest lobe along angle a.
const lobes = (n, dc, rc, rot = 0) => a => {
  let best = 0;
  for (let i = 0; i < n; i++) {
    const d = a - (rot + (i / n) * Math.PI * 2), s = dc * Math.sin(d);
    if (rc >= Math.abs(s)) best = Math.max(best, dc * Math.cos(d) + Math.sqrt(rc * rc - s * s));
  }
  return best || dc;
};
const SHAPES = {
  circle:        () => 1,
  cookie:        a => 1 + 0.07 * Math.cos(9 * a),
  flower:        lobes(6, 0.5, 0.42),
  clover:        lobes(4, 0.42, 0.5, Math.PI / 4),
  sunny:         a => 1 + 0.11 * Math.cos(8 * a) ** 3,
  burst:         a => 1 + 0.2 * Math.cos(12 * a),
  'soft-burst':  a => 1 + 0.12 * Math.cos(10 * a),
  'pill-blob':   a => 1 / Math.sqrt((Math.cos(a) / 1) ** 2 + (Math.sin(a) / 0.62) ** 2) * 0.92,
  'wavy-circle': a => 1 + 0.045 * Math.cos(14 * a),
};
function points(fn, r = 30, cx = 32, cy = 32) {
  const raw = Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2 - Math.PI / 2; return [a, fn(a)]; });
  const max = Math.max(...raw.map(p => p[1]));
  return raw.map(([a, k]) => [cx + Math.cos(a) * r * k / max, cy + Math.sin(a) * r * k / max]);
}
// Closed Catmull-Rom -> cubic Bezier, same command count for every shape.
export function shapePath(name, r, cx, cy) {
  const p = points(SHAPES[name], r, cx, cy), f = v => +v.toFixed(2);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = p[(i - 1 + N) % N], p1 = p[i], p2 = p[(i + 1) % N], p3 = p[(i + 2) % N];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

function shapeRadii(t) {
  const out = {};
  for (const name of t.shape.library) {
    const raw = Array.from({ length: N }, (_, i) => SHAPES[name]((i / N) * Math.PI * 2 - Math.PI / 2));
    const max = Math.max(...raw);
    out[name] = raw.map(v => +(v / max).toFixed(4));
  }
  return out;
}
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---- generators --------------------------------------------------------------
const kebab = s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
const dartHex = h => '0xFF' + h.slice(1).toUpperCase();

function css(t) {
  const P = 'mu';
  const role = mode => Object.entries(t[mode]).map(([k, v]) => `  --${P}-${kebab(k)}: ${v};`).join('\n');
  const pal = Object.entries(t.palette).map(([k, v]) => `  --${P}-c-${kebab(k)}: ${v.hex};`).join('\n');
  const ty = t.typography;
  const fam = k => `'${ty[k].family}', ${ty[k].fallback}`;
  const scale = Object.entries(ty.scale).map(([k, s]) =>
    `  --${P}-type-${kebab(k)}: ${s.weight} ${s.size}px/${s.line} var(--${P}-font-${s.font});\n  --${P}-tracking-${kebab(k)}: ${s.tracking}em;`).join('\n');
  const sh = Object.entries(t.shape).filter(([, v]) => typeof v === 'number').map(([k, v]) => `  --${P}-radius-${k}: ${v}px;`).join('\n');
  const sp = t.spacing.map((v, i) => `  --${P}-space-${i}: ${v}px;`).join('\n');
  const el = t.elevation.light.map((v, i) => `  --${P}-elev-${i}: ${v};`).join('\n');
  const md = t.motion;
  const mo = [
    ...Object.entries(md.duration).map(([k, v]) => `  --${P}-dur-${kebab(k)}: ${v}ms;`),
    ...Object.entries(md.easing).map(([k, v]) => `  --${P}-ease-${kebab(k)}: ${v};`),
    ...Object.entries(md.loops).map(([k, v]) => `  --${P}-loop-${k}: ${v.period}ms;`),
  ].join('\n');
  const duos = t.duos.map(d => `.${P}-duo-${d.id} { --${P}-duo-bg: var(--${P}-c-${kebab(d.bg)}); --${P}-duo-fg: var(--${P}-c-${kebab(d.fg)}); background: var(--${P}-duo-bg); color: var(--${P}-duo-fg); }`).join('\n');
  const faces = ['display', 'fun', 'body'].map(k => `@font-face {
  font-family: '${ty[k].family}';
  src: url('../fonts/${ty[k].file}') format('woff2');
  font-weight: ${k === 'fun' ? '400' : '100 900'};
  font-style: normal;
  font-display: swap;
}`).join('\n');
  return `/* GENERATED by company/design/themes/build.mjs from ${t.id}/tokens.json — do not edit by hand. */
/* ${t.name} v${t.version} */
${faces}

:root {
  color-scheme: light dark;
${pal}
${role('light')}
  --${P}-font-display: ${fam('display')};
  --${P}-font-fun: ${fam('fun')};
  --${P}-font-body: ${fam('body')};
  --${P}-font-mono: ${ty.mono.family}, ${ty.mono.fallback};
  --${P}-display-settings: ${ty.display.settings};
${scale}
${sh}
${sp}
${el}
  --${P}-elev-sticker: ${t.elevation.sticker};
${mo}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${role('dark').replace(/^/gm, '  ')}
  }
}
:root[data-theme="dark"] {
${role('dark')}
}
${duos}
`;
}

function dart(t) {
  const cls = 'MaterialYouTokens';
  const scheme = mode => `  static const ColorScheme ${mode} = ColorScheme(
    brightness: Brightness.${mode},
${['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
   'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'error', 'onError', 'errorContainer', 'onErrorContainer',
   'surface', 'onSurface', 'onSurfaceVariant', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
   'surfaceContainerHigh', 'surfaceContainerHighest', 'outline', 'outlineVariant', 'inverseSurface', 'inversePrimary', 'scrim', 'shadow']
    .map(k => `    ${k === 'inverseSurface' ? 'inverseSurface' : k}: Color(${dartHex(t[mode][k])}),`).join('\n')}
    onInverseSurface: Color(${dartHex(t[mode].inverseOnSurface)}),
  );`;
  return `// GENERATED by company/design/themes/build.mjs from ${t.id}/tokens.json — do not edit by hand.
// ${t.name} v${t.version}
import 'package:flutter/material.dart';

class ${cls} {
  ${cls}._();

  // Brand palette
${Object.entries(t.palette).map(([k, v]) => `  static const Color ${k} = Color(${dartHex(v.hex)});`).join('\n')}

  // Extra roles (not in ColorScheme)
  static const Color successLight = Color(${dartHex(t.light.success)});
  static const Color successDark = Color(${dartHex(t.dark.success)});
  static const Color warningContainerLight = Color(${dartHex(t.light.warningContainer)});

  // Duo blocks: [background, foreground]
${t.duos.map(d => `  static const List<Color> duo${d.id.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')} = [${d.bg}, ${d.fg}];`).join('\n')}
  static const List<List<Color>> duos = [${t.duos.map(d => `duo${d.id.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')}`).join(', ')}];

${scheme('light')}

${scheme('dark')}

  // Shape radii (dp)
${Object.entries(t.shape).filter(([, v]) => typeof v === 'number').map(([k, v]) => `  static const double radius${k[0].toUpperCase() + k.slice(1)} = ${v};`).join('\n')}

  // Motion (ms)
${Object.entries(t.motion.duration).map(([k, v]) => `  static const Duration ${k} = Duration(milliseconds: ${v});`).join('\n')}
${Object.entries(t.motion.loops).map(([k, v]) => `  static const Duration loop${k[0].toUpperCase() + k.slice(1)} = Duration(milliseconds: ${v.period});`).join('\n')}
  static const Curve standard = Cubic(0.2, 0, 0, 1);
  static const Curve emphasizedDecelerate = Cubic(0.05, 0.7, 0.1, 1);
  static const Curve emphasizedAccelerate = Cubic(0.3, 0, 0.8, 0.15);
  static const Curve loop = Cubic(0.45, 0, 0.55, 1);

  // Shape library: N polar radii (0..1) starting at 12 o'clock, clockwise. Same N for all, so any two morph.
  static const Map<String, List<double>> shapes = {
${Object.entries(shapeRadii(t)).map(([k, v]) => `    '${k}': [${v.join(', ')}],`).join('\n')}
  };

  static const String fontDisplay = '${t.typography.display.family}';
  static const String fontFun = '${t.typography.fun.family}';
  static const String fontBody = '${t.typography.body.family}';
}
`;
}

function kotlin(t) {
  const kc = h => '0xFF' + h.slice(1).toUpperCase();
  const keys = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
    'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'error', 'onError', 'errorContainer', 'onErrorContainer',
    'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceContainerLowest', 'surfaceContainerLow',
    'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest', 'outline', 'outlineVariant', 'inverseSurface', 'inversePrimary', 'scrim'];
  const scheme = (fn, mode) => `val MaterialYou${mode === 'light' ? 'Light' : 'Dark'}Colors = ${fn}(
${keys.map(k => `    ${k} = Color(${kc(t[mode][k])}),`).join('\n')}
    inverseOnSurface = Color(${kc(t[mode].inverseOnSurface)}),
)`;
  return `// GENERATED by company/design/themes/build.mjs from ${t.id}/tokens.json — do not edit by hand.
// ${t.name} v${t.version}. Copy into your app's ui/theme package and change the package line.
package com.getrichsoon.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

object MuPalette {
${Object.entries(t.palette).map(([k, v]) => `    val ${k} = Color(${kc(v.hex)})`).join('\n')}
    /** Duo blocks: background to foreground. */
    val duos: List<Pair<Color, Color>> = listOf(
${t.duos.map(d => `        ${d.bg} to ${d.fg},`).join('\n')}
    )
}

${scheme('lightColorScheme', 'light')}

${scheme('darkColorScheme', 'dark')}

object MuShapes {
    /** N polar radii (0..1) from 12 o'clock clockwise; same N for all shapes so any two can morph. */
${Object.entries(shapeRadii(t)).map(([k, v]) => `    val ${camel(k)} = floatArrayOf(${v.map(x => x + 'f').join(', ')})`).join('\n')}
    val all: Map<String, FloatArray> = mapOf(${Object.keys(shapeRadii(t)).map(k => `"${k}" to ${camel(k)}`).join(', ')})
}

object MuMotion {
${Object.entries(t.motion.duration).map(([k, v]) => `    const val ${k} = ${v}`).join('\n')}
${Object.entries(t.motion.loops).map(([k, v]) => `    const val loop${k[0].toUpperCase() + k.slice(1)} = ${v.period}`).join('\n')}
}
`;
}

function svgShapes(t, dir) {
  mkdirSync(dir, { recursive: true });
  for (const name of t.shape.library) {
    writeFileSync(join(dir, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="currentColor" d="${shapePath(name, 30)}"/></svg>\n`);
  }
  // Looping morph (SMIL works in every browser incl. Safari, and in <img>).
  const seq = ['cookie', 'flower', 'clover', 'sunny', 'circle', 'cookie'].map(n => shapePath(n, 30)).join(';');
  const fill = t.palette.tomato.hex;
  writeFileSync(join(dir, 'morph-loop.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g><animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="${t.motion.loops.spin.period / 1000}s" repeatCount="indefinite"/><path fill="${fill}" d="${shapePath('cookie', 30)}"><animate attributeName="d" dur="${t.motion.loops.morph.period / 1000}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.2;0.4;0.6;0.8;1" keySplines="${Array(5).fill('0.45 0 0.55 1').join(';')}" values="${seq}"/></path></g></svg>\n`);
  // JSON for JS/Flutter/Compose morphing (normalized 0..1 polar radii, N samples).
  const radii = shapeRadii(t);
  writeFileSync(join(dir, 'shapes.json'), JSON.stringify({ samples: N, startAngle: '-90deg', radii }, null, 0) + '\n');
}

// ---- run -------------------------------------------------------------------------
let failed = false;
for (const id of targets) {
  const dir = join(ROOT, id);
  if (!existsSync(join(dir, 'tokens.json'))) { console.error(`no tokens.json for ${id}`); failed = true; continue; }
  const t = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
  const fails = check(t);
  if (fails.length) { failed = true; console.error(`${id}: contrast FAIL\n  ` + fails.join('\n  ')); }
  else console.log(`${id}: contrast OK (${t.contrastPairs.length * 2} role pairs, ${t.duos.length} duos)`);
  if (checkOnly) continue;
  const out = join(dir, 'dist');
  mkdirSync(join(out, 'flutter'), { recursive: true });
  mkdirSync(join(out, 'compose'), { recursive: true });
  writeFileSync(join(out, 'tokens.css'), css(t));
  writeFileSync(join(out, 'flutter', 'material_you_tokens.dart'), dart(t));
  writeFileSync(join(out, 'compose', 'MaterialYouColors.kt'), kotlin(t));
  svgShapes(t, join(out, 'shapes'));
  console.log(`${id}: built dist/ (tokens.css, flutter, compose, shapes)`);
}
process.exit(failed ? 1 : 0);
