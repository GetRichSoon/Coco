// Vendored from GetRichSoon/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec scripts/lib/scrub.mjs. Every line below this one is byte-identical to that file (Lounge/door-board.test.js checks it).
// The one secret scrubber: every text that people or logs can read goes through it first.
export const scrub = (s) => String(s ?? '')
  .replace(/https?:\/\/\S*(?:X-Amz-|Signature=|[?&]sig=|[?&]token=|access_token|[?&]key=)\S*/gi, '[signed link]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer [redacted]')
  .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[token]')
  .replace(/\b(?:sb_secret_[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,})/g, '[secret]');
