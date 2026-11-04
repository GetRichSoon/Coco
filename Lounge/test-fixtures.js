// SYNTHETIC fixtures for the dashboard render tests. Nothing here is real company data: the public repository must hold no
// internal snapshot. The shapes match what Nova serves at /api/ops/<name> (rows of org_*, pipelines, security, pc dependencies).
const HOUSES = 'abcdefg'.split('').map((l, i) => ({ id: 'house_' + l, name: 'House ' + l.toUpperCase(), focus: i === 1 ? 'Tools & Ops' : 'Domain ' + l.toUpperCase(), subs: [6, 5, 5, 5, 5, 5, 4][i], letter: l.toUpperCase() }));
const unit = (id, kind, parent_id, display_name, short_name, extra = {}) => ({ id, kind, parent_id, house_id: null, display_name, short_name, focus: null, purpose: null, state: 'planned', github_team: null, sort: 0, ...extra });
const pad = (n) => String(n).padStart(2, '0');

export function structure() {
  const units = [unit('org_root', 'organisation', null, 'Organisation Root', 'Organisation Root', { state: 'active' }),
    unit('coco', 'company', 'org_root', 'Company Root', 'Company Root', { state: 'active', focus: 'Central coordination', github_team: 'company-root' }),
    unit('core', 'house', 'coco', 'Core House — Operations', 'Core House', { state: 'active', sort: 1, purpose: 'Owns shared infrastructure and the registry.', github_team: 'core-house' }),
    unit('team_houses', 'group', 'coco', 'Team Houses — Business', 'Team Houses', { state: 'active', sort: 2 })];
  HOUSES.forEach((h, i) => units.push(unit(h.id, 'house', 'team_houses', `${h.name} — ${h.focus}`, h.name, { house_id: h.id, state: 'active', sort: i + 1, focus: h.focus, github_team: h.id })));
  // 43 subteams: 35 in the seven Team Houses (6+5+5+5+5+5+4) then 8 in Core
  const subs = [];
  HOUSES.forEach((h) => { for (let n = 1; n <= h.subs; n++) subs.push({ parent: h.id, id: `${h.id}.s${pad(n)}`, name: `Subteam ${h.letter}${pad(n)} — Focus ${h.letter}${pad(n)}`, short: `Subteam ${h.letter}${pad(n)}`, house: h.id, tag: h.letter + pad(n) }); });
  for (let n = 1; n <= 8; n++) subs.push({ parent: 'core', id: 'core.s' + pad(n), name: `Core Subteam ${pad(n)}`, short: `Core ${n}`, house: null, tag: 'K' + pad(n) });
  subs.forEach((s) => units.push(unit(s.id, 'subteam', s.parent, s.name, s.short, { house_id: s.house, sort: Number(s.id.slice(-2)), focus: 'Focus ' + s.tag, github_team: s.id.replace(/[._]/g, '-') })));
  // 73 categories under the 35 House subteams only: 3 under the first three, 2 under the other 32 (9 + 64); Core has none
  subs.filter((s) => s.house).forEach((s, i) => { for (let c = 1, n = i < 3 ? 3 : 2; c <= n; c++) units.push(unit(`${s.id}.c${c}`, 'category', s.id, `Category ${s.tag}-${c}`, `Cat ${c}`, { house_id: s.house, sort: c })); });
  const agents = [{ id: 'agent.core.head', unit_id: 'core', role: 'head', name: 'Head of Core House (not assigned)', registry_agent: null, status: 'placeholder' },
    ...subs.map((s) => s.house && s.id !== 'house_b.s01' ? { id: `agent.${s.id}.head`, unit_id: s.id, role: 'head', name: `${s.short} head`, registry_agent: 'agent-' + s.id.replace(/[._]/g, '-'), status: 'proposed' }
      : { id: `agent.${s.id}.head`, unit_id: s.id, role: 'head', name: `Head of ${s.short} (not assigned)`, registry_agent: null, status: 'placeholder' })];
  const products = Array.from({ length: 16 }, (_, i) => ({ id: 'ch.' + pad(i + 1), unit_id: 'house_b.s01', kind: 'channel', name: 'Channel ' + pad(i + 1), platform_id: 'video', external_ref: 'channel-' + pad(i + 1), status: i === 6 || i === 10 ? 'waiting-founder' : 'connected', source: 'existing', meta: { needs_category: true } }));
  const repos = [['Org/platform', 'core.s01', 'platform', 'public'], ['Org/engine', 'core.s02', 'engine', 'private'], ['Org/workspace-one', 'core.s03', 'workspace', 'private'], ['Org/workspace-two', 'core.s03', 'workspace', 'private'], ['Org/org-page', 'core.s03', 'org_page', 'private'], ['Org/legacy', 'core.s04', 'legacy', 'private']]
    .map(([repo, unit_id, kind, visibility]) => ({ repo, unit_id, kind, visibility, state: 'active', mapping_status: 'proposed', notes: 'Synthetic repository note' }));
  const workflows = [{ repo: 'Org/engine', file: 'cycle.yml', branch: 'main', schedule: '15 2 * * *', unit_id: 'core.s02', state: 'observed' }];
  const access = [{ unit_id: 'coco', principal_kind: 'founder', principal: 'founder-a', permission: 'owner' }, { unit_id: 'coco', principal_kind: 'founder', principal: 'founder-b', permission: 'owner' }];
  const empty = (u) => ({ id: 'pl.' + u.id, unit_id: u.id, name: u.display_name + ' pipeline workspace', version: '0.0.0', status: 'PLANNED', designed: false, summary: 'No pipeline has been designed for this subteam yet. Nothing is assumed or invented.', inputs: [], outputs: [], stages: [], agents: [], tools_models: [], approval_gates: [], scheduling: { workflows: [], activated: false }, analytics: { sources: [], costs: [] }, versions: [], evidence_summary: { stages_with_evidence: 0 } });
  const pipelines = units.filter((u) => u.kind === 'subteam').map((u) => u.id === 'house_b.s01' ? pipelineA(u) : u.id === 'house_c.s01' ? pipelineB(u) : empty(u));
  return { note: 'SYNTHETIC TEST DATA. Not real.', units, agents, products, repos, workflows, access, pipelines };
}

const ev = (type, ref, at, result, extra = {}) => ({ type, ref, at, result, ...extra });
const stage = (id, name, kind, status, after, extra = {}) => ({ id, name, kind, runs_on: 'cloud', status, depends_on: after ? [after] : [], workflow: 'flow-a.yml', tools: ['Tool one'], model: null, agent: 'agent-one', evidence: status === 'TESTING' ? [ev('run', '1000000001', '2026-01-02', 'success', { event: 'push' })] : [], ...extra });
const chain = (spec, extras) => spec.map(([id, name, kind, status], i) => stage(id, name, kind, status, i ? spec[i - 1][0] : null, extras[id] || {}));

function pipelineA(u) {
  const stages = chain([['discover', 'Discover', 'research', 'TESTING'], ['select', 'Select', 'selection', 'TESTING'], ['brief', 'Brief', 'brief', 'TESTING'], ['draft', 'Draft', 'generate', 'TESTING'], ['verify', 'Verify', 'check', 'TESTING'], ['plan', 'Plan', 'generate', 'TESTING'],
    ['assets', 'Build assets', 'build', 'BLOCKED'], ['render', 'Render', 'render', 'TESTING'], ['qa', 'Quality check', 'qa', 'TESTING'], ['approval', 'Founder approval', 'approval', 'DESIGNING'], ['publish', 'Publish', 'publish', 'TESTING'], ['measure', 'Measure', 'analytics', 'TESTING'], ['feedback', 'Feedback', 'feedback', 'DESIGNING']],
  { assets: { reason: 'the asset set has no estimate or founder approval yet', approval_needed: 'estimate', model: { provider: 'model-x', name: 'Model X, once per missing item', policy: 'staged founder approval first' } }, discover: { gap: 'the schedule is registered but its first clean run is not proven' } });
  return { id: 'pl.' + u.id, unit_id: u.id, name: 'Pipeline A (one engine, every channel)', version: '1.0.0', status: 'TESTING', designed: true, summary: 'One synthetic pipeline: every stage runs in the cloud. Free tier only; public publishing always needs a founder YES. It has not run end to end in one run, so nothing is LIVE.',
    inputs: ['channel profile', 'daily analytics report'], outputs: ['published item id (after founder YES)', 'analytics snapshot'], stages,
    agents: [{ agent: 'agent-one', does: 'research and scoring', source: 'registry', state: 'existing' }, { agent: 'agent-two', does: 'cloud render', source: 'registry', state: 'existing' }, { agent: `agent.${u.id}.head`, does: 'head of the subteam', source: 'company structure', state: 'placeholder' }],
    tools_models: [{ name: 'Model Y free tier through Nova', use: 'draft and plan', policy: 'free tier only; daily cap; no paid fallback' }],
    approval_gates: [{ id: 'build_gate', what: 'any paid build task, estimate first', who: 'Founder A' }, { id: 'public_publish', what: 'every public upload', who: 'Founder A or Founder B' }],
    scheduling: { activated: false, workflows: [{ repo: 'Org/engine', file: 'flow-a.yml', cron: '10 4 * * *', state: 'registered_unproven', note: 'needs one clean scheduled run as proof' }, { repo: 'Org/engine', file: 'flow-b.yml', cron: '30 3 * * 1', state: 'obsolete_on_main' }, { repo: 'Org/engine', file: 'flow-c.yml', cron: null, state: 'manual_only' }] },
    channels: { engine: 'one shared pipeline; each channel supplies its own profile', category_mapping: 'unconfirmed: which category each channel belongs to is a founder decision', cloud_credentials: ['channel-01', 'channel-02'] },
    retired: [{ item: 'Old chain X', state: 'disabled', evidence: 'audit note' }], analytics: { sources: ['reports folder'], costs: ['model calls'] }, versions: [{ version: '1.0.0', date: '2026-01-01', change: 'first design', rollback: 'revert the commit' }], evidence_summary: { stages_with_evidence: 11 } };
}
function pipelineB(u) {
  const stages = chain([['research', 'Category research', 'research', 'TESTING'], ['monitor', 'Competitor monitoring', 'monitor', 'TESTING'], ['perf', 'Weekly performance', 'analytics', 'BLOCKED'], ['rank', 'Opportunity ranking', 'selection', 'DESIGNING'], ['edition', 'Edition build', 'build', 'DESIGNING'],
    ['cover', 'Cover and image', 'build', 'BLOCKED'], ['check', 'Description check', 'check', 'DESIGNING'], ['draft', 'Draft creation with duplicate protection', 'draft', 'TESTING'], ['approve', 'Founder approval', 'approval', 'DESIGNING'], ['publish', 'Public publishing after approval', 'publish', 'PAUSED'], ['report', 'Reporting', 'analytics', 'DESIGNING']],
  { perf: { reason: 'sales stats need the stats_read scope on the connection; reported as unavailable, never guessed' }, cover: { reason: 'the media direct upload returned 403 in two live runs; a fallback is mock-tested but not verified live' },
    publish: { reason: 'paused after one approved publish', evidence: [ev('run', '1000000002', '2026-01-03', 'success', { event: 'workflow_dispatch' })] }, rank: { gap: 'later phases are gated by approvals' } });
  stages[1].evidence.push(ev('test', 'scripts/monitor.test.mjs', '2026-01-04', 'passed', { note: '11/11' }));
  return { id: 'pl.' + u.id, unit_id: u.id, name: 'Pipeline B (cloud only)', version: '1.0.0', status: 'TESTING', designed: true, summary: 'Maps a synthetic cloud system. Monitoring runs daily in the cloud and is read only. Drafts stay drafts until a named founder approves. The old chain stays retired.',
    inputs: ['watch list file', 'public pages'], outputs: ['daily report', 'draft item (never public without approval)'], stages,
    agents: [{ agent: 'agent-three', does: 'monitoring', source: 'registry', state: 'existing' }], tools_models: [{ name: 'Provider API', use: 'drafts', policy: 'draft only until a named founder approves' }],
    approval_gates: [{ id: 'public_publish', what: 'every public publish', who: 'Founder A' }], scheduling: { activated: false, workflows: [{ repo: 'Org/engine', file: 'flow-d.yml', cron: '0 5 * * *', state: 'registered_unproven' }] },
    retired: [{ item: 'Old chain Y', state: 'retired', evidence: 'control op note' }], analytics: { sources: ['daily snapshots'], costs: [] }, versions: [], evidence_summary: { stages_with_evidence: 3 } };
}

export function pcDeps() {
  const mk = (task, verdict, cls) => ({ task, does: 'Synthetic duty of ' + task, needed_by: 'Synthetic consumer', cloud_answer: 'Synthetic answer for ' + task, verdict, class: cls });
  const built = 'CLOUD-REPLACEABLE (built, untested live)';
  return { source: 'synthetic', items: [mk('Daily Task A', built, 'cloud_built_untested'), mk('Daily Task B', built, 'cloud_built_untested'), mk('Seal Task C', 'GENUINE EXCEPTION (physical device)', 'pc_required'), mk('Keepalive D', 'GENUINE EXCEPTION', 'pc_required'), mk('Playlist Task E', 'GENUINE EXCEPTION', 'pc_required'),
    mk('Status Task F', 'Cloud half = covered; local half = DEV TOOL', 'mixed'), mk('Dev Tool G', 'DEV TOOL', 'dev_tool'), mk('Dev Tool H', 'DEV TOOL', 'dev_tool'), mk('Cloud Done I', 'CLOUD-REPLACED (run 1)', 'cloud_ready'), mk('Cloud Done J', 'CLOUD-REPLACED (run 2)', 'cloud_ready'), mk('Dev Tool K', 'DEV TOOL', 'dev_tool'), mk('Watchdog L', 'GENUINE EXCEPTION', 'pc_required'), mk('Office Task M', 'GENUINE EXCEPTION', 'pc_required'), mk('Cloud Done N', 'CLOUD-REPLACED (run 3)', 'cloud_ready')],
  pc_off_verification: { status: 'NOT VERIFIED', run_ids: [], note: 'No run has shown the company working with every PC off.' } };
}

export function security() {
  return { source: 'synthetic', incidents: [{ id: 'INC-0000-synthetic-open', status: 'OPEN', affected: 'Synthetic service A (test account). Integration rows gumroad and gumroad-two use it.', where: 'A synthetic location.', exposure: 'Synthetic exposure text.', founder_action: '1. In the synthetic provider dashboard reset the synthetic credential. 2. Store the new one in the vault only. 3. Tell the team what stopped working.', verification: 'The old credential must answer 401.' },
    { id: 'INC-0000-synthetic-contained', status: 'CONTAINED', affected: 'Synthetic service B.', where: 'Elsewhere.', exposure: 'None current.', founder_action: 'Confirm the rotation.', verification: 'A run shows success.' }],
  repos: [{ repo: 'Org/platform', visibility: 'public', secret_scanning: 'disabled', push_protection: 'disabled', branch_protection: 'none on main' }, { repo: 'Org/engine', visibility: 'private', secret_scanning: 'enabled', push_protection: 'enabled', branch_protection: 'none on main' }] };
}
