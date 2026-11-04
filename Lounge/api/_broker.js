// Access broker: decides whether THIS caller, running THIS job, may use THIS provider credential for THIS capability.
//
// Identity is read from the database, never from the request body: the device was verified by Nova's device-key check,
// the job must exist in public.jobs, be `running`, and its lease must belong to the caller; the job's own team_id /
// channel_id (not anything the caller says) decide the rights. Policy is data (api/_access_policy.js), default deny.
// There is no override parameter: a founder cannot bypass credential isolation through a request.
//
// Mode (public.policies company/access_broker_mode): 'off' | 'shadow' (default: record would-be denials, allow) | 'enforce'.
// Every decision is written to public.capability_uses through the redaction gate. Reasons never contain a secret.
import { ACCESS_POLICY } from './_access_policy.js';
import { redactDeep } from './_redact.js';

export const MODES = ['off', 'shadow', 'enforce'];
const RUN_LABEL = /^gha-\d+$/;
const WORKFLOW = /^[a-z0-9._-]+\.ya?ml$/i;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// the pure rule: identity {team, channel} + request -> {allow, reason}
export function evaluate(policy, identity, { provider, capability, connectionId, via, env }) {
  if (!policy.environments.includes(env)) return { allow: false, reason: `environment ${env} is not allowed` };
  if (policy.gateway_only.includes(provider)) return via === 'ai_gateway' ? { allow: true, reason: 'AI gateway' } : { allow: false, reason: `${provider} is reachable only through the AI gateway` };
  const team = policy.teams[identity.team];
  if (!team) return { allow: false, reason: `team ${identity.team} has no access policy (default deny)` };
  const caps = team.providers[provider];
  if (!caps) return { allow: false, reason: `team ${identity.team} may not use ${provider}` };
  if (!caps.includes(capability)) return { allow: false, reason: `team ${identity.team} may not ${capability} on ${provider}` };
  if (connectionId) {
    const ch = team.channels?.[provider];
    if (ch !== '*' && !(Array.isArray(ch) && ch.includes(connectionId))) return { allow: false, reason: `team ${identity.team} may not use connection ${connectionId}` };
    if (identity.channel && connectionId !== identity.channel && connectionId !== `yt-${identity.channel}`) return { allow: false, reason: `this job belongs to channel ${identity.channel}, not ${connectionId}` };
  }
  return { allow: true, reason: 'policy allows' };
}

// who is calling: a queue job (verified in public.jobs) or a workflow run (paired cloud worker only)
export async function identify(db, policy, who, r) {
  const device = who.device_id;
  if (r.jobId) {
    const row = (await db.query('SELECT id, status, lease_owner, team_id, subteam_id, channel_id FROM public.jobs WHERE id = $1', [r.jobId])).rows[0];
    if (!row) return { error: 'the job does not exist' };
    if (row.status !== 'running') return { error: 'the job is not running' };
    // the queue stores the worker label as lease_owner; the caller must hold that lease (its label, or its device id)
    if (!row.lease_owner || (row.lease_owner !== device && row.lease_owner !== r.worker)) return { error: 'the job lease belongs to another worker' };
    return { kind: 'job', device, job: row.id, team: row.team_id, subteam: row.subteam_id || null, channel: row.channel_id || null };
  }
  if (r.workflow || r.runId) {
    if (!RUN_LABEL.test(r.runId || '') || !WORKFLOW.test(r.workflow || '')) return { error: 'a workflow identity needs workflow (file name) and run_id (gha-<number>)' };
    if (!policy.workflow_devices.includes(device)) return { error: 'only the paired cloud worker may speak for a workflow run' };
    const team = policy.workflows[r.workflow.toLowerCase()];
    if (!team) return { error: `workflow ${r.workflow} is not mapped to a team` };
    return { kind: 'workflow', device, workflow: r.workflow, run: r.runId, team, subteam: null, channel: null };
  }
  return { error: 'no job_id or workflow identity was given' };
}

export async function readMode(db) {
  try {
    const row = (await db.query("SELECT value FROM public.policies WHERE key = 'access_broker_mode' AND scope = 'company' ORDER BY updated_at DESC LIMIT 1")).rows[0];
    if (!row) return 'shadow';
    const v = typeof row.value === 'string' ? row.value : row.value?.mode;
    return MODES.includes(v) ? v : 'enforce'; // a policy that is present but unreadable fails closed
  } catch { return 'enforce'; }
}

export async function decide(db, who, req, { policy = ACCESS_POLICY } = {}) {
  try {
    const identity = await identify(db, policy, who, req);
    if (identity.error) return { allow: false, reason: identity.error, identity: { kind: 'unknown', device: who.device_id } };
    return { ...evaluate(policy, identity, req), identity };
  } catch { return { allow: false, reason: 'the access decision could not be made', identity: { kind: 'unknown', device: who.device_id } }; }
}

// Build the request from the HTTP request. These fields only NAME which job / run the caller is; none can raise rights.
export function requestOf(httpReq, extra) {
  const h = httpReq.headers || {}; const b = httpReq.body && typeof httpReq.body === 'object' ? httpReq.body : {};
  const run = str(b.run_label || h['x-run-label']) || (RUN_LABEL.test(str(b.run_id)) ? str(b.run_id) : '');
  return { jobId: str(b.job_id || h['x-job-id']), worker: str(b.worker || h['x-job-worker']), workflow: str(b.workflow || h['x-workflow']), runId: run,
    env: process.env.VERCEL_ENV || 'production', ...extra };
}

// decide + record + apply the mode. Returns null to continue, or { status, body } to refuse.
export async function guard(db, who, req, log = () => {}) {
  const mode = await readMode(db);
  if (mode === 'off') return null;
  const d = await decide(db, who, req);
  const decision = d.allow ? 'allow' : mode === 'enforce' ? 'deny' : 'shadow_deny';
  const note = redactDeep({ decision, mode, reason: d.reason, provider: req.provider, capability: req.capability, connection: req.connectionId || null, env: req.env, identity: d.identity }).value;
  try {
    await db.query(`INSERT INTO public.capability_uses (id, at, capability_id, where_run, run_id, team_id, agent_id, tokens, cost, ok, note) VALUES ($1, now(), $2, 'cloud', $3, $4, NULL, 0, 0, $5, $6)`,
      [`CU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, `access:${req.provider}.${req.capability}`, d.identity.job || d.identity.run || null, d.identity.team || null, decision !== 'deny', JSON.stringify(note)]);
  } catch (e) {
    log(500, { broker: 'record_failed', why: String(e.message).slice(0, 100) });
    if (mode === 'enforce') return { status: 403, body: { ok: false, state: 'ACCESS_DENIED', reason: 'the access decision could not be recorded' } };
  }
  if (decision === 'deny') return { status: 403, body: { ok: false, state: 'ACCESS_DENIED', reason: redactDeep(d.reason).value } };
  return null;
}
