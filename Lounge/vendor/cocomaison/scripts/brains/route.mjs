// SHIM, not the CocoMaison file: board.mjs needs only normTitle, copied verbatim from GetRichSoon/CocoMaison@c6bbeea scripts/brains/route.mjs.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const normTitle = norm;
