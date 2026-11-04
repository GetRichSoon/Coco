// The single redaction gate for everything any team, agent or worker writes to Coco Cloud through Nova.
//
// Every table write (activity, ai_calls, outputs, brain_items, task notes, results) already passes through Nova, so
// this is the one place to stop a credential on its way into the database. It mirrors the detector in the engine repo
// (nova-db/secrets.mjs RULES, including the name-boundary fix of 2026-11-04) and must be kept in step with it.
// Over-redaction is acceptable; letting a known secret shape through is not. A value is replaced by a placeholder and
// never echoed: callers get the TYPES found, not the text.
export const PLACEHOLDER = '[REDACTED]';

const RULES = [
  { type: 'private_key', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g },
  { type: 'connection_string', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s'"<>]*:[^\s'"<>@]+@[^\s'"<>]+/gi },
  { type: 'bearer_token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { type: 'api_key', re: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { type: 'supabase_secret', re: /\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{16,}/g },
  { type: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{30,}/g },
  { type: 'google_oauth_secret', re: /\bGOCSPX-[A-Za-z0-9_-]{16,}/g },
  { type: 'github_token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g },
  { type: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'slack_token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { type: 'assigned_secret', keep: true,
    re: /((?<![A-Za-z0-9])(?:password|passwd|pwd|pin|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|session[_-]?token|auth[_-]?token|token)["']?\s*[:=]\s*)(['"]?)([^\s'",;]{4,})\2/gi },
];

export function redactText(text) {
  let out = String(text); const findings = [];
  for (const r of RULES) {
    out = out.replace(r.re, (m, ...args) => {
      if (!r.keep) { findings.push(r.type); return PLACEHOLDER; }
      const g = args.slice(0, -2);
      // a number or a flag under a key named like a secret is a setting ("daily_token": 5000), not a credential: leave it alone
      if (g[2] === PLACEHOLDER || /^(\d[\d.,]*|true|false|null)$/i.test(g[2])) return m;
      findings.push(r.type); return g[0] + g[1] + PLACEHOLDER + g[1];
    });
  }
  return { text: out, findings };
}

export function redactDeep(value) {
  const findings = [];
  const walk = (v) => {
    if (typeof v === 'string') { const r = redactText(v); findings.push(...r.findings); return r.text; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, c]) => [k, walk(c)]));
    return v;
  };
  return { value: walk(value), findings };
}
