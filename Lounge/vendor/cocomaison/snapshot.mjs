// Writes canonical.snapshot.mjs from a CocoMaison checkout: node snapshot.mjs <cocomaison dir> <out file> <commit sha>. A dev tool, never imported by Nova.
import { pathToFileURL } from 'node:url'; import path from 'node:path'; import fs from 'node:fs';
const [src, out, sha] = process.argv.slice(2);
const { buildCanonical } = await import(pathToFileURL(path.join(src, 'scripts/brains/canonical.mjs')));
const c = buildCanonical(src);
const brains = [...c.brains.values()].map((b) => [b.id, b.kind, b.parent]);
const mapping = c.mapping.map((m) => [m.legacy, m.canonical]);
fs.writeFileSync(out, `// GENERATED from GetRichSoon/CocoMaison@${sha}: buildCanonical() of scripts/brains/canonical.mjs, reduced to what board.mjs reads (id, kind, parent; legacy -> canonical).
// Do not edit by hand. Regenerate when the company structure changes (see canonical.mjs in this folder).
export const SOURCE_COMMIT = '${sha}';
export const BRAINS = ${JSON.stringify(brains)};
export const MAPPING = ${JSON.stringify(mapping)};
`);
console.log(brains.length, mapping.length, fs.statSync(out).size);
