// Vendored from GetRichSoon/CocoMaison@c6bbeea815e00d6b75a7f47a621d285e2e87c4ec scripts/brains/board.mjs. Every line below this one is byte-identical to that file (Lounge/door-board.test.js checks it).
// The company-wide task board, computed on read from the tables every surface already uses (public.tasks + the agent_messages handoff rows): one source for Desktop, Android and PWA.
// No spreadsheet, no second store. Ownership comes from the task's own lines (front door tasks), else from the handoff meta, else from the legacy `Team:` line mapped through the registry.
//   node scripts/brains/board.mjs   (needs cloud credentials; prints the board as JSON)
import { buildCanonical, canonicalIdOf, ancestorsOf } from './canonical.mjs';
import { STATES } from './lifecycle.mjs';
import { normTitle } from './route.mjs';
import { parseHandoff } from './handoff-core.mjs';

const line = (d, k) => (String(d || '').match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || null;
const none = (v) => (!v || v === 'undecided' || v === 'none' || v === 'unassigned' ? null : v);
const DONE = new Set(['done', 'cancelled', 'closed', 'completed']);

export async function board({ call, canon = buildCanonical(), now = new Date(), soonDays = 3 }) {
  const tasks = (await call('tasks?select=id,title,details,status,error,created_at&order=created_at.desc&limit=1000')) || [];
  const rows = ((await call('agent_messages?kind=eq.handoff&select=id,at,from_agent,to_agent,task,text&limit=5000')) || []).map(parseHandoff).filter(Boolean);
  const by = new Map(); for (const r of rows) (by.get(r.task) || by.set(r.task, []).get(r.task)).push(r);
  const out = tasks.map((t) => {
    const hs = by.get(t.id) || [], meta = hs.map((h) => h.meta).find((m) => m && m.owning_team) || null, life = hs.filter((h) => /^lifecycle\./.test(h.stage || '')).sort((a, b) => String(a.at).localeCompare(String(b.at)) || a.id - b.id);
    const legacy = (line(t.details, 'Team') || '').split(/[ (]/)[0], mapped = legacy && legacy !== 'unassigned' ? canonicalIdOf(canon, `team:${legacy}`) : null;
    const owner = none(line(t.details, 'Owner')) || (meta && meta.owning_team) || mapped || null, c = (id) => (id && canon.brains.has(id) ? id : null);
    const sub = none(line(t.details, 'Subteam')) || (meta && meta.owning_subteam) || null, category = none(line(t.details, 'Category')) || (meta && meta.category) || null, product = none(line(t.details, 'Product')) || (meta && meta.product) || null;
    const last = life.at(-1), lstate = last ? (last.evidence && last.evidence.state) || String(last.stage).slice(10) : null;
    const state = lstate === 'BLOCKED' || t.status === 'blocked' ? 'BLOCKED' : lstate || (STATES.includes(line(t.details, 'Status')) ? line(t.details, 'Status') : null);
    const b = last && last.evidence && last.evidence.blocked, blocked = state === 'BLOCKED' ? { reason: (b && b.reason) || line(t.details, 'Blocked') || t.error || 'no reason recorded', owner: (b && b.responsible_owner) || owner || 'brain:coco', recovery_action: (b && b.recovery_action) || line(t.details, 'Recovery') || null } : null;
    const root = c(owner), house = root ? [root, ...ancestorsOf(canon.brains, root)].map((x) => canon.brains.get(x)).find((x) => x.kind === 'house') : null;
    const missing = [!owner && 'owning Team', !sub && 'responsible Subteam', !category && 'category', ...(blocked && !blocked.recovery_action ? ['recovery action'] : [])].filter(Boolean);
    return { id: t.id, title: t.title, status: t.status, state, house: house ? house.id : null, owner, subteam: sub, category, product, key: line(t.details, 'Task key'), norm: normTitle(t.title), deadline: line(t.details, 'Deadline'), priority: line(t.details, 'Priority'), blocked, missing, handoffs: hs.length };
  });
  const open = out.filter((t) => !DONE.has(t.status) && t.state !== 'CLOSED');
  const group = (k) => Object.fromEntries([...open.reduce((m, t) => m.set(t[k] || 'UNASSIGNED', (m.get(t[k] || 'UNASSIGNED') || 0) + 1), new Map())]);
  const dupBy = (f) => [...open.reduce((m, t) => { const k = f(t); if (k) (m.get(k) || m.set(k, []).get(k)).push(t.id); return m; }, new Map())].filter(([, ids]) => ids.length > 1).map(([k, ids]) => ({ match: k, tasks: ids }));
  const ms = (t) => (t.deadline ? Date.parse(t.deadline) : NaN), soon = now.getTime() + soonDays * 864e5;
  return { generated_at: now.toISOString(), total: out.length, open: open.length, by_house: group('house'), by_owner: group('owner'), by_subteam: group('subteam'), by_category: group('category'),
    missing_assignments: open.filter((t) => t.missing.length).map((t) => ({ task: t.id, title: t.title, missing: t.missing })),
    duplicates: [...dupBy((t) => t.key).map((d) => ({ ...d, by: 'key' })), ...dupBy((t) => t.owner && `${t.norm}|${t.owner}`).map((d) => ({ ...d, by: 'title+owner' }))],
    blocked: open.filter((t) => t.blocked).map((t) => ({ task: t.id, title: t.title, ...t.blocked })),
    overdue: open.filter((t) => ms(t) < now.getTime()).map((t) => ({ task: t.id, title: t.title, deadline: t.deadline, owner: t.owner })),
    due_soon: open.filter((t) => ms(t) >= now.getTime() && ms(t) <= soon).map((t) => ({ task: t.id, title: t.title, deadline: t.deadline, owner: t.owner })), tasks: out };
}

if (process.argv[1] && import.meta.url.endsWith('/board.mjs') && process.argv[1].endsWith('board.mjs')) {
  const { credentials } = await import('../lib/cloud-creds.mjs'), { url, headers } = credentials();
  if (!headers) { console.error('board: no credentials'); process.exit(1); }
  const call = async (p) => { const r = await fetch(`${url}/rest/v1/${p}`, { headers }); if (!r.ok) throw new Error(`GET ${p.split('?')[0]}: ${r.status}`); return r.json(); };
  console.log(JSON.stringify(await board({ call }), null, 1));
}
