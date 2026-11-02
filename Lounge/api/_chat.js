// Coco Chat in the cloud: the SAME engine the Lounge page carries, run by Nova for every device.
//
//   phone / desktop -> POST /api/chat { scope, body } -> engine (rules, no model) -> coco_* RPCs -> queue
//
// One brain: the engine is lifted out of index.html exactly as chat.test.js lifts it, so the phone,
// the desktop and the tests run one code path and cannot drift. One thread per scope lives in
// public.chat (scope, meta), written as the founder under RLS, so every device shows the same
// conversation, and a pending "yes?" travels with it. Rows are written 'answered', which keeps the
// old wake_coco_chat trigger (an Edge Function) from ever firing for them.
//
// shortcut: the engine is lifted from index.html by its section markers at cold start. Move it into
// its own chat-engine.js (loaded by the page with a <script>) if the markers ever get in the way.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = /^[A-Za-z0-9][A-Za-z0-9_.:/|-]*$/;
const PENDING_MS = 10 * 60 * 1000;          // a yes older than this answers nothing
const WORLD_MS = 15 * 1000;

let factory = null, snapshot = null;
const lift = (src, a, b) => { const i = src.search(a), j = src.search(b); if (i < 0 || j <= i) throw new Error(`chat engine section ${a} not found in index.html`); return src.slice(i, j); };
export function engineFactory() {
  if (factory) return factory;
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const marks = lift(src, /\nlet IDENT = null;/, /\n\/\/ -+ control plane/);
  const struct = lift(src, /\n\/\/ -+ the company's shape\n/, /\n\/\/ -+ Coco Chat/);
  const chat = lift(src, /\n\/\/ -+ Coco Chat: the company's front door\n/, /\n\/\/ 80% warning/);
  factory = new Function(
    'CP', 'LIVE', 'D', 'OUTPUTS', 'CONNS', 'CONN_LINKS', 'STRUCT', 'POLICIES', 'IDENT_IN', 'RELEASE_IN', 'CLOUD_RELEASE_IN',
    'esc', 'ago', 'num', 'online', 'devVersion', 'store', 'sb', 'toast', 'loadAll', 'policyOf', 'effective',
    'control', 'connectionOp', 'structureOp', 'confirm', 'oauthConnect', 'connectionVerify', 'VERIFY_SAID',
    `${marks}\nIDENT = IDENT_IN; RELEASE = RELEASE_IN; CLOUD_RELEASE = CLOUD_RELEASE_IN;\n${struct}\n${chat}\n`
    + 'return { chatSend, chatSetScope, chatScopeKey, chatScopeLabel, chatTree, chatPending, chatResume, setWho: (w) => { CHAT_WHO = w; } };');
  return factory;
}
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };

// Everything the engine reads, in ONE statement, as the founder under RLS. Only the columns chat uses:
// no key hashes, no secret refs.
const WORLD_SQL = `SELECT
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, code, team, what, state, raised_on, decided_by, decided_at FROM public.approvals ORDER BY raised_on DESC NULLS LAST, id DESC LIMIT 60) x) AS approvals,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, name, app_version, last_seen, active FROM public.devices ORDER BY id) x) AS devices,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, platform, state FROM public.integrations) x) AS integrations,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT scope, scope_id, key, value FROM public.policies) x) AS policies,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, kind, parent_id, name, state, description FROM public.structure ORDER BY created_at) x) AS structure,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT connection_id, provider, external_name, external_id, external_handle, state, last_verified_at FROM public.integration_accounts) x) AS conns,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT connection_id, team_id, subteam_id, category_id, channel_id, enabled FROM public.integration_links) x) AS links,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, workflow_id, team_id, status FROM public.outputs ORDER BY at DESC LIMIT 300) x) AS outputs,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT * FROM public.brain_items WHERE NOT retired ORDER BY created_at DESC LIMIT 200) x) AS brain,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT * FROM public.runs ORDER BY opened_at DESC LIMIT 60) x) AS runs,
  (SELECT row_to_json(x) FROM (SELECT * FROM public.releases ORDER BY created_at DESC LIMIT 1) x) AS release,
  (SELECT coalesce(json_agg(x), '[]') FROM (SELECT email, name FROM public.founders) x) AS founders`;
const worlds = new Map();                     // founder email -> { at, w }
async function world(run, email, now) {
  const hit = worlds.get(email); if (hit && now - hit.at < WORLD_MS) return hit.w;
  const [w] = await run({ sql: WORLD_SQL, params: [] });
  worlds.set(email, { at: now, w }); return w;
}
export const forgetWorlds = () => worlds.clear();

const ago = (iso) => { if (!iso) return 'never'; const s = (Date.now() - new Date(iso)) / 1000; return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(iso).toISOString().slice(0, 10); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (m) => String(m || '').replace(/postgres(ql)?:\/\/\S+/g, '<conn>').replace(/^.*?:\s*/, '').slice(0, 200);
const SAID_OK = /^(Done|Saved|Created|Archived|Restored|Assigned|Checked|Disconnected|Reconnected|Account added|Asking the platform…)$/;

// One engine for one request: the company as the founder sees it, and the RPCs Nova may call for them.
// `run` runs one statement as the founder; `rpc` calls one allow-listed function as the founder.
export async function engineFor({ run, rpc, email, device, now = Date.now() }) {
  const w = await world(run, email, now);
  snapshot ||= readJson('control-plane.json') || { teams: [] };
  const CP = { ...snapshot, brain: w.brain || [], runs: (w.runs && w.runs.length) ? w.runs : (snapshot.runs || []) };
  const POLICIES = w.policies || [];
  const policyOf = (scope, id, key) => { const r = POLICIES.find((p) => p.scope === scope && p.scope_id === (id || '*') && p.key === key); return r ? r.value : undefined; };
  const effective = (key, { agent, team, subteam } = {}) => { for (const [s, id] of [['agent', agent], ['subteam', subteam], ['team', team], ['company', '*']]) { if (!id) continue; const v = policyOf(s, id, key); if (v !== undefined) return { value: v, scope: s, id }; } return { value: undefined, scope: null, id: null }; };
  const notes = [];
  const sb = { rpc: async (fn, args) => { try { return { data: await rpc(fn, args), error: null }; } catch (e) { return { data: null, error: { message: clean(e.message) } }; } } };
  const call = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) { notes.push(error.message); return null; } return data; };
  const E = engineFactory()(
    CP, null, { approvals: w.approvals || [], devices: w.devices || [], integrations: w.integrations || [] },
    w.outputs || [], w.conns || [], w.links || [], w.structure || [], POLICIES, readJson('identity.json'), readJson('release.json'), w.release || null,
    esc, ago, (n) => Number(n || 0).toLocaleString('en-IN'),
    (d) => d.last_seen && (Date.now() - new Date(d.last_seen)) < 150000,
    (d) => String(d.app_version || '').replace(/^(desktop|web|android|lounge)-/, '') || '?',
    { get: () => null, set: () => {}, del: () => {} }, sb,
    (m) => { if (m && !SAID_OK.test(String(m))) notes.push(String(m)); }, async () => {}, policyOf, effective,
    (scope, id, key, value, note) => call('coco_control', { p_scope: scope, p_scope_id: id || '*', p_key: key, p_value: value, p_note: note || null }),
    (op, connection, extra = {}) => call('coco_connection', { p_op: op, p_connection: connection, ...extra }),
    (op, id, _confirm, extra = {}) => call('coco_structure', { p_op: op, p_kind: extra.p_kind || 'team', p_id: id, ...extra }),
    () => true,
    // Connecting hands a founder to the platform's own consent screen, which needs a browser in front
    // of them. Checking an account is a platform call the cloud makes from Integrations.
    async () => ({ started: false, why: 'connecting opens the platform\'s own consent screen, so it is done from Integrations on the Lounge' }),
    async () => { notes.push('the account check runs from Integrations on the Lounge'); return null; },
    {});
  const me = (w.founders || []).find((f) => String(f.email).toLowerCase() === String(email).toLowerCase());
  E.setWho({ device, by: (me && me.name) || email });
  return { E, notes };
}

// One turn: the founder's words in, Coco's answer out, both stored in the scope's thread.
export async function chatTurn({ run, rpc, who, body, now = Date.now() }) {
  const text = String((body && body.body) || '').trim();
  const asked = String((body && body.scope) || 'coco');
  if (!text) return { status: 400, body: { message: 'say something' } };
  if (text.length > 4000) return { status: 400, body: { message: 'that is too long for one message (4000 characters)' } };
  if (asked.length > 300 || !SCOPE.test(asked)) return { status: 400, body: { message: 'bad scope' } };

  const { E, notes } = await engineFor({ run, rpc, email: who.email, device: who.device_id, now });
  const scope = E.chatSetScope(asked);             // a part that no longer exists lands one level up
  const [last] = await run({ sql: `SELECT meta, created_at FROM public.chat WHERE scope = $1 AND role = 'coco' ORDER BY id DESC LIMIT 1`, params: [scope] });
  if (last && last.meta && last.meta.pending && now - new Date(last.created_at).getTime() < PENDING_MS) E.chatResume(last.meta.pending);

  const by = (await world(run, who.email, now)).founders?.find((f) => String(f.email).toLowerCase() === String(who.email).toLowerCase())?.name || who.email;
  const [mine] = await run({ sql: `INSERT INTO public.chat (role, author, device_id, body, status, scope) VALUES ('founder', $1, $2, $3, 'answered', $4) RETURNING *`, params: [by, who.device_id, text, scope] });
  let a, status = 'answered';
  try { a = (await E.chatSend(text)) || { text: 'Say a little more and I will take it from there.' }; }
  catch (e) { a = { text: 'I could not finish that, so nothing changed: ' + clean(e.message) }; status = 'failed'; }
  const extra = notes.filter((n) => !String(a.text).includes(n));
  const reply = String(a.text) + (extra.length && !a.acted ? ' (' + extra.join('; ') + ')' : '');
  const meta = { cards: a.cards || [], act: a.act || null, state: a.state || null, approvals: a.approvals || [], pending: E.chatPending() || null, label: E.chatScopeLabel() };
  const [coco] = await run({ sql: `INSERT INTO public.chat (role, author, body, reply_to, status, scope, meta) VALUES ('coco', 'Coco', $1, $2, $3, $4, $5::jsonb) RETURNING *`, params: [reply, mine.id, status, scope, JSON.stringify(meta)] });
  if (a.acted) worlds.delete(who.email);            // a change was made: the next turn reads it fresh
  return { status: 200, body: { scope, label: meta.label, founder: mine, reply: coco } };
}

// The company as a selector walks it: each part with its parent, and the live agents.
export async function chatTree({ run, rpc, who, now = Date.now() }) {
  const { E } = await engineFor({ run, rpc, email: who.email, device: who.device_id, now });
  return { status: 200, body: { tree: E.chatTree() } };
}
