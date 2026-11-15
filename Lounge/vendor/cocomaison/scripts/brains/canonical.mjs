// SHIM, not the CocoMaison file. board.mjs imports buildCanonical, canonicalIdOf and ancestorsOf from './canonical.mjs'; the real one reads the CocoMaison
// repo tree at run time (company structure, registry, job capabilities), which a Vercel function does not have. This shim serves the same three names
// from canonical.snapshot.mjs. canonicalIdOf and ancestorsOf are copied verbatim from GetRichSoon/CocoMaison@c6bbeea scripts/brains/canonical.mjs.
// Regenerate the snapshot (in a CocoMaison checkout, then copy the file here): node Lounge/vendor/cocomaison/snapshot.mjs <cocomaison dir> <out file> <commit>
import { BRAINS, MAPPING } from './canonical.snapshot.mjs';

let canon = null;
export function buildCanonical() {
  canon ||= { brains: new Map(BRAINS.map(([id, kind, parent]) => [id, { id, kind, parent }])), mapping: MAPPING.map(([legacy, canonical]) => ({ legacy, canonical })) };
  return canon;
}
export function canonicalIdOf(c, id) { if (c.brains.has(id)) return id; const r = c.mapping.find((x) => x.legacy === id); return r && r.canonical ? r.canonical : null; }
export const ancestorsOf = (brains, id) => { const a = []; for (let p = brains.get(id)?.parent; p; p = brains.get(p)?.parent) a.push(p); return a; };
