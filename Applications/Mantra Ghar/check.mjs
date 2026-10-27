// Data self-check for Mantra Ghar. Run: node check.mjs
// Catches the one thing that can really break this app: a bad line in mantras.js.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, 'mantras.js'), 'utf8');
const json = raw.replace(/^\s*window\.MANTRAS\s*=/, '').replace(/;\s*$/, '');

let list;
try {
  list = JSON.parse(json);
} catch (e) {
  console.error('FAIL mantras.js is not valid JSON after the wrapper:', e.message);
  process.exit(1);
}

const errors = [];
const need = ['id', 'deity', 'deityHi', 'group', 'title', 'mantra', 'roman', 'meaning', 'when'];
const seen = new Set();

if (!Array.isArray(list) || list.length === 0) errors.push('list is empty');

for (const [i, m] of list.entries()) {
  const where = `#${i} (${m && m.id ? m.id : 'no id'})`;
  for (const k of need) if (!m[k] || String(m[k]).trim() === '') errors.push(`${where}: missing ${k}`);
  if (seen.has(m.id)) errors.push(`${where}: duplicate id`);
  seen.add(m.id);
  if (!Number.isInteger(m.count) || m.count < 1) errors.push(`${where}: count must be a positive whole number`);
  if (typeof m.top !== 'boolean') errors.push(`${where}: top must be true or false`);
  if (!/[ऀ-ॿ]/.test(m.mantra)) errors.push(`${where}: mantra has no Devanagari text`);
  if (m.image && !existsSync(join(here, 'images', m.image))) errors.push(`${where}: images/${m.image} not found`);
}

if (!list.some(m => m.top)) errors.push('no mantra is marked top — the Top Mantras section would be empty');

if (errors.length) {
  console.error(`FAIL ${errors.length} problem(s):`);
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

const groups = [...new Set(list.map(m => m.group))];
console.log(`OK ${list.length} mantras, ${new Set(list.map(m => m.deity)).size} deities, ${list.filter(m => m.top).length} top, ${groups.length} sections: ${groups.join(', ')}`);
