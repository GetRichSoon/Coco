// Vendored from GetRichSoon/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec scripts/brains/handoff-core.mjs. Every line below this one is byte-identical to that file (Lounge/door-board.test.js checks it).
// The company-wide handoff recorder: ONE public.agent_messages row per handoff (kind 'handoff', task = the original task id). Reusable by every team;
// scripts/youtube/handoff.mjs is a thin user of it. No second store: the same agent_messages table, the same `call` REST helper.
//
// The row's text is compact JSON { stage, status, result, run, evidence, house } and, when a routing context is given, `meta` (HANDOFF_META_FIELDS):
// original task id, parent task id, subtask id, sending and receiving Brain, owning Team and Subteam, Category, Product Brain, assigned agents/workers,
// status, timestamp and output references. A row is written ONCE per (task, sender, receiver, stage, status[, subtask]).
import { scrub } from '../lib/scrub.mjs';

export const STATUSES = ['accepted', 'assigned', 'started', 'done', 'failed', 'published', 'rehearsed', 'gate_stopped', 'paused'];
export const HOUSE = 'gigi';
// every key must be present on a handoff's meta; the first six must also be non-empty, the rest may be null when the level does not apply to the task
export const HANDOFF_META_FIELDS = ['original_task_id', 'from_brain', 'to_brain', 'owning_team', 'status', 'at', 'parent_task_id', 'subtask_id', 'owning_subteam', 'category', 'product', 'agents', 'outputs'];
const REQUIRED = HANDOFF_META_FIELDS.slice(0, 6);
const enc = encodeURIComponent;

export function validateMeta(m) {
  const e = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['handoff meta must be an object'];
  for (const k of HANDOFF_META_FIELDS) if (!(k in m)) e.push(`meta.${k} is missing`);
  for (const k of REQUIRED) if (k in m && !m[k]) e.push(`meta.${k} is required`);
  if (m.agents != null && !Array.isArray(m.agents)) e.push('meta.agents must be a list');
  if (m.outputs != null && !Array.isArray(m.outputs)) e.push('meta.outputs must be a list');
  if (m.at && Number.isNaN(Date.parse(m.at))) e.push('meta.at is not a timestamp');
  return e;
}

const clip = (v, n = 200) => (typeof v === 'string' ? scrub(v).slice(0, n) : v);
export const compact = (e, depth = 0) => {                  // references and a few facts, never a document: short strings, at most 8 items, 12 keys, 3 levels
  if (e == null) return null;
  if (Array.isArray(e)) return e.slice(0, 8).map((x) => compact(x, depth + 1));
  if (typeof e === 'object') return depth > 2 ? null : Object.fromEntries(Object.entries(e).slice(0, 12).map(([k, v]) => [k, compact(v, depth + 1)]));
  return clip(e);
};

export function parseHandoff(row) {
  try { const p = JSON.parse(row.text); return p && typeof p === 'object' && !Array.isArray(p) ? { id: row.id, at: row.at, from: row.from_agent, to: row.to_agent, task: row.task, house_id: row.house_id, kind: row.kind, ...p } : null; } catch { return null; }
}

// Writes ONE agent_messages row, unless the same task, sender, receiver, stage, status (and subtask) already have one. `call` is the REST helper (path, { method, body, prefer }).
export async function recordHandoff({ call, task_id, run_id = null, from, to, stage, status, result = null, evidence = null, house_id = HOUSE, meta = null }) {
  for (const [k, v] of Object.entries({ call, task_id, from, to, stage })) if (!v) throw new Error(`handoff: ${k} is required`);
  if (!STATUSES.includes(status)) throw new Error(`handoff: status must be one of ${STATUSES.join(', ')}, not "${status}"`);
  if (meta) { const e = validateMeta(meta); if (e.length) throw new Error(`handoff: ${e.join('; ')}`); }
  const rows = (await call(`agent_messages?task=eq.${enc(task_id)}&kind=eq.handoff&from_agent=eq.${enc(from)}&to_agent=eq.${enc(to)}&select=id,text&limit=200`)) || [];
  const same = rows.find((r) => { const p = parseHandoff(r); return p && p.stage === stage && p.status === status && (!meta || (p.meta && p.meta.subtask_id === meta.subtask_id)); });
  if (same) return { written: false, id: same.id };
  const body = { stage, status, result: result == null ? null : clip(String(result), 400), run: run_id, evidence: compact(evidence), house: house_id };
  if (meta) body.meta = Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, compact(v, 1)]));   // every HANDOFF_META_FIELDS key survives (compact() alone keeps only 12 keys)
  const made = await call('agent_messages', { method: 'POST', prefer: 'return=representation', body: { from_agent: from, to_agent: to, house_id, task: String(task_id), kind: 'handoff', text: JSON.stringify(body) } });
  return { written: true, id: made && made[0] ? made[0].id : null };
}

// Runs a promise with a deadline; a recorder must never hang a run.
export const guard = (p, ms) => { let timer; return Promise.race([p, new Promise((_, no) => { timer = setTimeout(() => no(new Error(`no answer after ${ms / 1000} s`)), ms); })]).finally(() => clearTimeout(timer)); };

// A never-throwing writer: three failed writes in a row stop the log for the rest of the pass. Returns put(summary, args).
export function bestEffortWriter({ call, task_id, run_id = null, house_id = HOUSE, warn = () => {}, timeoutMs = 15000 }) {
  let bad = 0;
  return async (s, args) => {
    if (bad >= 3) { s.failed++; return; }
    try { const r = await guard(recordHandoff({ call, task_id, run_id, house_id, ...args }), timeoutMs); bad = 0; if (r.written) s.written++; else s.skipped++; }
    catch (e) { bad++; s.failed++; warn(`${args.from} > ${args.to} (${args.stage}, ${args.status}) was not recorded: ${scrub(e && e.message)}${bad >= 3 ? '; no more handoffs are written in this pass (the run itself is not affected)' : ''}`); }
  };
}
