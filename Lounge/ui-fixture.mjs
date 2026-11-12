// SYNTHETIC data for the browser tests of the unified UI. Nothing here is real company data (the public repository must hold none): the tables have
// the REAL production shapes (columns, status words, proportions: 7 Houses, 17-ish tasks mostly queued, jobs mostly done, no waiting approval
// unless a test adds one, a worker that was last seen days ago) but every name, title and number is made up for the test.
// Like production today there is NO org_* table and NO revenue table unless an option asks for them (the stand-in then answers 404).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const NAV = JSON.parse(fs.readFileSync(path.join(dir, 'contract', 'nav-contract.json'), 'utf8'));
const iso = (n) => new Date(Date.now() - n * 864e5).toISOString();
const day = (n) => iso(n).slice(0, 10);
const uuid = (p, n) => `${String(p).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const TID = { verifying: uuid(1, 106), pc: uuid(1, 107), running: uuid(1, 101), failed: uuid(1, 102), planned: uuid(1, 103), paused: uuid(1, 104), done: uuid(1, 105), queued: uuid(1, 1), stopped: uuid(1, 201) };
export const AID = { waiting1: uuid(2, 1), waiting2: uuid(2, 2), hold: uuid(2, 3), approved: uuid(2, 4), rejected: uuid(2, 5) };

// revenue: 'missing' (tables not served, like production today) | 'empty' (served, nothing yet) | 'zero' (Gumroad synced fine, no sale) | 'some' (INR and USD sales) | 'failing' (last sync failed)
// org: true adds the optional org_* registry (it does not exist in production; the pages must work without it)
export function fixture({ revenue = 'missing', org = false, workerOnline = false, withRevenue = false, gumroadConnected = true, rpcDeny = [], rpcAllow = [] } = {}) {
  if (withRevenue && revenue === 'missing') revenue = 'some';
  const houses = NAV.houses.map((h, i) => ({ id: h.id, name: h.name, role: `${h.domain} House`, state: i < 3 ? 'working' : i === 3 ? 'next' : 'later', cadence: i < 3 ? 'daily' : 'when started', publish_rule: 'Founder YES before anything public', doing: i < 3 ? `Working on ${h.domain.toLowerCase()}` : null, recent: i === 0 ? 'Posted one Short' : null, blocked: i === 2 ? 'Waiting for a cover review' : null, next: 'Next step', sort: i + 1, updated_at: iso(1) }));
  const platforms = [...new Set(NAV.houses.flatMap((h) => h.platforms))].map((p, i) => ({ id: p, name: p.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), sort: i }));
  const catCount = { gigi: 14, lulu: 10, fifi: 8, zaza: 7, poppy: 0, mochi: 0, tilly: 0 };
  const categories = [], offerings = [];
  let cn = 0;
  for (const h of NAV.houses) for (let i = 1; i <= catCount[h.id]; i++) categories.push({ id: uuid(3, ++cn), house_id: h.id, code: i, name: `${h.name} category ${i}`, linked_to: i === 2 ? 'category 1' : null });
  const offCount = { gigi: 15, lulu: 39, fifi: 1, zaza: 4 }, status = ['built', 'connected, ready to produce', 'in progress', 'live'];
  let on = 0;
  for (const h of NAV.houses) for (let i = 1; i <= (offCount[h.id] || 0); i++) {
    const cats = categories.filter((c) => c.house_id === h.id);
    offerings.push({ id: uuid(4, ++on), house_id: h.id, category_id: cats.length && i % 5 ? cats[i % cats.length].id : null, platform_id: h.platforms[i % h.platforms.length], kind: h.id === 'gigi' ? 'channel' : h.id === 'lulu' ? (i % 7 ? 'extension' : 'app') : h.id === 'zaza' ? 'game' : 'download', name: `${h.name} ${h.id === 'gigi' ? 'channel' : 'item'} ${i}`, status: status[i % 4], repo: null, url: i % 3 ? `https://example.com/${h.id}/${i}` : null, notes: null, updated_at: iso(2), connected: i % 2 === 0, last_post_at: h.id === 'gigi' && i < 4 ? iso(i) : null, last_post_title: h.id === 'gigi' && i < 4 ? `Post ${i}` : null, last_post_url: null, next_post_at: null, next_post_title: null });
  }
  const members = [['m-think-1', 'Think One', 'Think'], ['m-think-2', 'Think Two', 'Think'], ['m-make-1', 'Make One', 'Make'], ['m-make-2', 'Make Two', 'Make'], ['m-make-3', 'Make Three', 'Make'], ['m-make-4', 'Make Four', 'Make'], ['m-care-1', 'Care One', 'Care'], ['m-care-2', 'Care Two', 'Care'], ['m-care-3', 'Care Three', 'Care'], ['m-care-4', 'Care Four', 'Care']]
    .map(([id, name, grp], i) => ({ id, name, grp, job: `${grp} work ${i + 1}`, model: i < 2 ? 'opus' : 'sonnet', agent_file: `${id}.md`, is_new: false, sort: i + 1, doing: i === 2 ? 'Drafting a script' : null }));
  const member_houses = [];
  for (const m of members) for (const h of NAV.houses.slice(0, m.grp === 'Think' ? 7 : m.id.endsWith('1') || m.id.endsWith('2') ? 4 : 3)) member_houses.push({ member_id: m.id, house_id: h.id });
  const pipelines = [['gigi-daily-short', 'gigi', 'Daily Short', 'every day at the first PC start', true, 6], ['gigi-weekly-long', 'gigi', 'Weekly long video', 'once a week', true, 6], ['lulu-weekly-extension', 'lulu', 'One extension a week', 'ideas Mon to Thu, shortlist Friday', true, 10], ['fifi-new-download', 'fifi', 'New download', 'when a topic is chosen', true, 6], ['zaza-new-game', 'zaza', 'New game', 'when Zaza starts', false, 5]]
    .map(([id, house_id, name, trigger, active, n]) => ({ id, house_id, name, trigger, active, steps: [...Array(n)].map((_, i) => ({ do: `${name} step ${i + 1}`, tools: ['Tool A'], where: i % 3 ? 'cloud' : 'pc', member: members[i % members.length].id })), updated_at: iso(3) }));
  const brain_items = [...Array(24)].map((_, i) => ({ id: `BR-${i}`, kind: ['knowledge', 'decision', 'lesson', 'reference', 'rule'][i % 5], company_id: 'good-space', team_id: i < 4 ? 'youtube' : i < 11 ? 'ebooks' : i < 13 ? 'software' : null, subteam_id: null, category_id: null, channel_id: null, agent_id: null, visibility: 'team', title: `Brain note ${i}`, text: `A synthetic note number ${i} for the test.`, tags: ['t'], approved: true, confidence: 0.8, source: 'test', run_id: null, task_id: null, fingerprint: 'f' + i, seen: 1, last_seen_at: iso(i), last_run_id: null, created_at: iso(i), created_by: 'test', expires_at: null, retired: false, retired_at: null, retired_by: null, retired_reason: null, meta: {}, workflow_id: null }));
  // the live structure table: sub-teams and categories hang under the runtime team "ebooks" (it comes from the bundled company snapshot), plus one unassigned team
  const structure = [
    { id: 'ebooks/demo-skills', kind: 'subteam', parent_id: 'ebooks', name: 'Demo skills', description: null, head_agent_id: 'ebooks.ebooks-head', template: 'ebook-howto', config: { priority: 1 }, state: 'paused', created_at: iso(9), created_by: 'test', updated_at: iso(9), updated_by: 'test' },
    { id: 'ebooks/demo-skills/demo-topic', kind: 'category', parent_id: 'ebooks/demo-skills', name: 'Demo topic', description: null, head_agent_id: null, template: null, config: {}, state: 'paused', created_at: iso(9), created_by: 'test', updated_at: iso(9), updated_by: 'test' },
    { id: 'demo-team', kind: 'team', parent_id: null, name: 'Demo team', description: null, head_agent_id: 'demo-team.head', template: null, config: { made_by: 'coco-chat' }, state: 'paused', created_at: iso(9), created_by: 'test', updated_at: iso(9), updated_by: 'test' },
    { id: 'demo-team/research', kind: 'subteam', parent_id: 'demo-team', name: 'Demo research', description: null, head_agent_id: 'demo-team.research', template: null, config: {}, state: 'paused', created_at: iso(9), created_by: 'test', updated_at: iso(9), updated_by: 'test' },
    { id: 'demo-team.head', kind: 'agent', parent_id: 'demo-team', name: 'Demo head', description: null, head_agent_id: null, template: null, config: {}, state: 'paused', created_at: iso(9), created_by: 'test', updated_at: iso(9), updated_by: 'test' },
  ];
  const integrations = [['youtube', 'gigi', 'YouTube', 'Channel A', 'connected', 'OAuth 2.0 per channel; refresh token in the vault', null, null], ['gumroad', 'poppy', 'Gumroad', null, 'connected', 'OAuth, token in the vault', null, null], ['gumroad-poppy', 'poppy', 'Gumroad (Poppy shop)', 'demo-shop', 'error', 'OAuth token kept in the vault', 'The access token was leaked into a public repository and must be replaced', 'Press Reconnect and approve the new token'],
    ['github', null, 'GitHub', 'org', 'connected', 'GitHub app', null, null], ['supabase', null, 'Cloud database', 'main', 'connected', 'session jwt + anon key', null, null], ['cloudflare', null, 'Cloudflare', 'acct', 'connected', 'Account API token in the vault', null, null], ['chrome_store', 'lulu', 'Chrome Web Store', 'dev', 'connected', 'publish script login', null, null],
    ['google-drive-pc', null, 'Google Drive (PC)', 'G:', 'connected', 'Drive for desktop', null, null], ['roblox', 'zaza', 'Roblox', 'studio', 'partial', 'Open Cloud API key on the PC', null, 'Add the Open Cloud key'], ['meta', 'gigi', 'Meta', null, 'paused', null, null, 'Resume when Gigi starts on Instagram'],
    ['play_console', 'lulu', 'Google Play Console', null, 'not_connected', 'Update REST API v1.1: Client ID + API key from the Publish API page', null, 'Create the API key in Partner Center, then press Add key'], ['udemy', 'fifi', 'Udemy', null, 'not_connected', null, null, 'Apply for the instructor API'], ['coursera', 'fifi', 'Coursera', null, 'not_connected', null, null, null], ['edge_addons', 'lulu', 'Edge Add-ons', null, 'not_connected', null, null, null]]
    .map(([id, house_id, platform, account, state, auth_method, error, next_action]) => ({ id, house_id, platform, account, state, auth_method, capabilities: state === 'connected' ? ['read'] : [], last_check_at: state === 'not_connected' ? null : iso(1), last_ok_at: state === 'connected' ? iso(1) : null, error, next_action, updated_at: iso(1) }));
  const acct = (connection_id, provider, external_name, state, extra = {}) => ({ connection_id, provider, external_id: extra.external_id || null, external_name, external_handle: null, avatar_url: null, account_label: 'owner', secret_ref: state === 'connected' ? `vault:${connection_id}` : null, state, permissions: ['read'], connected_at: state === 'connected' ? iso(10) : null, last_verified_at: state === 'connected' ? iso(1) : null, note: null, created_at: iso(30), created_by: 'test', updated_at: iso(1), updated_by: 'test', ...extra });
  const integration_accounts = [acct('poppy', 'gumroad', 'Demo shop', gumroadConnected ? 'connected' : 'not_connected'), acct('yt-a', 'youtube', 'Channel A', 'connected', { external_id: 'ext-a' }), acct('yt-b', 'youtube', 'Channel B', 'connected', { external_id: 'ext-b' }), acct('yt-c', 'youtube', 'Channel C', 'not_connected'), acct('yt-d', 'youtube', 'Channel D', 'not_connected'), acct('yt-app-web', 'youtube', 'PickTheory channel', 'not_connected')];
  const integration_links = [{ id: 1, integration_id: 'youtube', team_id: 'youtube', subteam_id: null, permissions: ['read'], enabled: true, note: null, created_at: iso(5), created_by: 'test', updated_at: iso(5), updated_by: 'test', connection_id: 'yt-a', category_id: null, channel_id: null }];
  const yt = (id, c, d, views, subs, videos) => ({ id, at: iso(d + 0.4), day: day(d), connection_id: c, channel_id: 'ext-' + c.slice(-1), video_id: null, title: null, published_at: null, duration_s: null, kind: 'channel', privacy: null, source: 'data_api', window_days: null, metrics: { basis: 'MEASURED', views, subscribers: subs, videos }, run_id: null });
  const yt_stats = [yt(1, 'yt-a', 3, 5100, 38, 14), yt(2, 'yt-a', 0, 5230, 41, 15), yt(3, 'yt-b', 0, 920, 7, 3), { ...yt(4, 'yt-a', 0, 0, 0, 0), kind: 'short', source: 'analytics_api', video_id: 'v1', title: 'A Short', metrics: { views: 12 } }];
  const jobRow = (id, type, team, st, extra = {}) => ({ id, idempotency_key: 'k-' + id, type, company_id: 'good-space', team_id: team, subteam_id: null, category_id: null, channel_id: null, agent_id: null, workflow_id: null, run_id: null, payload: {}, priority: 2, status: st, attempt: st === 'queued' ? 0 : 1, max_attempts: 3, run_after: iso(1), lease_owner: null, lease_until: null, created_at: iso(2), started_at: iso(2), completed_at: st === 'done' ? iso(2) : null, failed_at: null, result: {}, error: {}, errors: [], updated_at: iso(1.5), ...extra });
  const jobs = [...[...Array(8)].map((_, i) => jobRow('JOB-D' + i, i % 2 ? 'ebook-build' : 'video-render', i % 2 ? 'ebooks' : 'youtube', 'done')), jobRow('JOB-B1', 'publish', 'comics', 'blocked', { error: { kind: 'unsupported', message: 'no handler for job type publish' } }),
    jobRow('JOB-R1', 'video-render', 'youtube', 'running', { lease_owner: 'cloud-worker-1', lease_until: new Date(Date.now() + 36e5).toISOString(), run_id: 'RUN-1' }), jobRow('JOB-F1', 'upload', 'youtube', 'failed', { attempt: 3, failed_at: iso(0.5), error: { kind: 'handler', message: 'upload quota exceeded (synthetic)' }, run_id: 'RUN-1' }), jobRow('JOB-Q1', 'ebook-build', 'ebooks', 'queued')];
  const runs = [{ run_id: 'RUN-1', parent_run_id: null, root_run_id: 'RUN-1', depth: 0, company_id: 'good-space', team_id: 'youtube', subteam_id: null, category_id: null, channel_id: null, agent_id: null, kind: 'task', title: 'Write the next Short script', status: 'open', task_id: TID.running, automation_id: null, project: null, goal: null, opened_at: iso(0.2), opened_by: 'test', closed_at: null, result: null, tokens: 0, cost: 0 }];
  const outputs = [{ id: 'OUT-1', at: iso(0.1), company_id: 'good-space', team_id: 'youtube', subteam_id: null, category_id: null, channel_id: null, agent_id: null, run_id: 'RUN-1', kind: 'short', title: 'Draft script', status: 'created', external_id: null, url: 'https://example.com/o/1', cost: 0, tokens: 0, meta: {}, created_by: 'test', updated_at: iso(0.1), workflow_id: null },
    { id: 'OUT-2', at: iso(3), company_id: 'good-space', team_id: 'ebooks', subteam_id: null, category_id: null, channel_id: null, agent_id: null, run_id: null, kind: 'chapter', title: 'Chapter 1', status: 'published', external_id: null, url: null, cost: 0, tokens: 0, meta: {}, created_by: 'test', updated_at: iso(3), workflow_id: null }];
  const T = (id, title, st, extra = {}) => ({ id, title, details: null, house_id: null, needs: 'cloud', status: st, priority: 2, created_by: 'Boss', created_device: 'boss-pc', claimed_by_device: null, claimed_at: null, heartbeat_at: null, result: null, created_at: iso(3), updated_at: iso(2), merged_into: null, ai_checked: false, pipeline_id: null, step: null, member_id: null, retry_count: 0, error: null, evidence: null, stale: false, category: null, platform_id: null, ...extra });
  const tasks = [
    ...[...Array(10)].map((_, i) => T(uuid(1, i + 1), `Queued task ${i + 1}`, 'queued', { house_id: i < 4 ? 'lulu' : i < 6 ? 'gigi' : null, created_at: iso(i + 1), stale: i < 5, details: i === 0 ? 'Write the details here.' : null })),
    ...[...Array(4)].map((_, i) => T(uuid(1, 201 + i), `Stopped task ${i + 1}`, 'stopped')),
    T(TID.failed, 'Failed upload task', 'failed', { house_id: 'gigi', error: 'Upload failed: quota exceeded (synthetic)', claimed_by_device: 'cloud-worker-1', claimed_at: iso(2), retry_count: 1, stale: true }),
    T(TID.planned, 'Planned task', 'planned', { house_id: 'poppy', details: 'Plan the next book.' }), T(TID.paused, 'Paused task', 'paused', { house_id: 'lulu' }),
    T(TID.running, 'Write the next Short script', 'running', { house_id: 'gigi', claimed_by_device: 'boss-pc', claimed_at: iso(0.2), heartbeat_at: iso(0.01), pipeline_id: 'gigi-daily-short', step: 3, member_id: 'm-make-1', created_at: iso(0.3) }),
    T(TID.done, 'Fix the install bug', 'done', { house_id: 'lulu', result: 'Fixed and released (synthetic)', evidence: 'build 123', created_at: iso(4) }),
    T(TID.verifying, 'Review the cover', 'verifying', { house_id: 'poppy', result: 'Cover draft is ready for a check (synthetic)', created_at: iso(1) }),
  ];
  // run requests as production has them: failed with the cloud's own reason (AI gate, monthly agent limit)
  const run_requests = [
    { id: 2, workflow_id: 'youtube-pick', state: 'failed', requested_by: 'boss@example.com', device_id: 'boss-pc', note: `coco-task:${TID.failed} \u00b7 Failed upload task`, run_id: 'RUN-9', result: null, reason: 'this month would pass the agent monthly limit (344313+1000 > 300000, set on agent youtube.marquee)', created_at: iso(0.4), claimed_at: iso(0.4), claimed_by: 'cloud-worker-1', finished_at: iso(0.39) },
    { id: 1, workflow_id: 'ebooks-pick', state: 'failed', requested_by: 'boss@example.com', device_id: 'boss-pc', note: 'coco-task:aaaaaaaa-0000-4000-8000-0000000000aa \u00b7 Older book task', run_id: 'RUN-3', result: null, reason: 'provider_error: provider 400: Your credit balance is too low to access the Anthropic API.', created_at: iso(9), claimed_at: iso(9), claimed_by: 'cloud-worker-1', finished_at: iso(9) },
  ];
  const policies = [
    { scope: 'company', scope_id: '*', key: 'paused', value: false }, { scope: 'agent', scope_id: 'youtube.marquee', key: 'claude', value: 'denied' }, { scope: 'agent', scope_id: 'ebooks.ebooks-head', key: 'claude', value: 'blocked' }, { scope: 'agent', scope_id: 'core.nova', key: 'claude', value: 'on_demand' },
  ];
  const task_notes = [{ id: 1, task_id: TID.running, note: 'Use the house style.', by_email: 'Boss', device_id: 'boss-pc', at: iso(0.25) }];
  const approvals = [
    { id: AID.waiting1, code: 'A-101', team: 'YouTube', what: 'Publish the weekly Short', files: 'short-007.mp4', state: 'waiting', decided_by: null, decided_at: null, raised_on: day(1), run_id: 'RUN-1', release_id: null, action: { type: 'publish', channel: 'yt-a', title: 'Weekly Short', private: false }, device_id: null, result: null, executed_at: null, executed_by_run: null, requested_by: 'cloud-worker-1', requested_at: iso(1) },
    { id: AID.waiting2, code: 'A-102', team: 'Social Media', what: 'Price change for Book 3', files: null, state: 'waiting', decided_by: null, decided_at: null, raised_on: day(2), run_id: null, release_id: null, action: null, device_id: null, result: null, executed_at: null, executed_by_run: null, requested_by: 'Boss', requested_at: iso(2) },
    { id: AID.hold, code: 'A-103', team: null, what: 'Parked idea', files: null, state: 'on-hold', decided_by: 'Boss', decided_at: iso(5), raised_on: day(6), run_id: null, release_id: null, action: null, device_id: null, result: null, executed_at: null, executed_by_run: null, requested_by: null, requested_at: null },
    { id: AID.approved, code: 'A-099', team: 'Build', what: 'Release 5.8', files: null, state: 'approved', decided_by: 'Boss', decided_at: iso(8), raised_on: day(9), run_id: null, release_id: null, action: null, device_id: null, result: 'executed', executed_at: null, executed_by_run: null, requested_by: null, requested_at: null },
    { id: AID.rejected, code: 'A-098', team: 'Ops', what: 'Rename the repo', files: null, state: 'rejected', decided_by: 'Boss', decided_at: iso(10), raised_on: day(11), run_id: null, release_id: null, action: null, device_id: null, result: null, executed_at: null, executed_by_run: null, requested_by: null, requested_at: null },
  ];
  const devices = [
    { id: 'boss-pc', owner_email: 'boss@example.com', name: 'Boss PC', kind: 'pc', platform: 'windows', app_version: 'desktop-1.1.0', active: true, last_seen: iso(0.0001), update_state: null, info: {} },
    { id: 'boss-phone', owner_email: 'boss@example.com', name: 'Boss phone', kind: 'phone', platform: 'android', app_version: 'android-2.11.0', active: true, last_seen: iso(0.0002), update_state: null, info: {} },
    { id: 'big-pc', owner_email: 'big@example.com', name: 'Big Boss PC', kind: 'pc', platform: 'windows', app_version: 'desktop-1.0.5', active: true, last_seen: iso(20), update_state: null, info: {} },
    { id: 'cloud-worker-1', owner_email: 'boss@example.com', name: 'Cloud worker', kind: 'pc', platform: 'cloud', app_version: 'worker-1', active: true, last_seen: workerOnline ? iso(0.001) : iso(10), update_state: null, info: {} },
  ];
  const founders = [{ email: 'boss@example.com', name: 'Boss', call_me: 'Boss' }];
  const activity = [{ id: 1, at: iso(0.2), actor: 'Boss', action: 'approved', detail: 'A-099', device_id: 'boss-pc' }, { id: 2, at: iso(0.4), actor: 'Boss', action: 'task added', detail: 'Write the next Short script', device_id: 'boss-phone' }];
  const tables = {
    houses, categories, offerings, platforms, members, member_houses, tools: [], member_tools: [], tasks, task_notes, approvals, devices, decisions: [], activity, founders, rules: [], commands: [], integrations,
    agent_messages: [], notes: [], runs, run_events: [], ai_calls: [], brain_items, policies, control_ops: [], structure, integration_accounts, integration_links, outputs, jobs, releases: [], chat: [], controls: [], pipelines, pulse: [], pairing_codes: [], yt_stats,
    brain_records_latest: [], cloud_providers: [], provider_switches: [], capabilities: [], capability_uses: [], integration_health: [], device_sync_audit: [], run_requests,
  };
  if (org) {
    const units = [{ id: 'getrichsoon', kind: 'organisation', parent_id: null, house_id: null, display_name: 'Organisation', short_name: 'Organisation', state: 'active', sort: 0 }, { id: 'coco', kind: 'company', parent_id: 'getrichsoon', house_id: null, display_name: 'COCO', short_name: 'COCO', state: 'active', sort: 0 }];
    NAV.houses.forEach((h, i) => { units.push({ id: h.id, kind: 'house', parent_id: 'coco', house_id: h.id, display_name: `${h.name} House`, short_name: h.name, state: 'active', sort: i + 1 }, { id: `${h.id}.s1`, kind: 'subteam', parent_id: h.id, house_id: h.id, display_name: `${h.name} registry subteam`, short_name: 'Registry subteam', state: 'active', sort: 1 }); });
    Object.assign(tables, { org_units: units, org_products: [], org_agents: [], org_repos: [], org_workflows: [], org_access: [], org_metrics: [], org_refs: [], org_brains: [], org_readiness: [], org_reconciliation_view: [] });
  }
  if (revenue !== 'missing') {
    const sync = { connection_id: 'poppy', provider: 'gumroad', last_synced_at: iso(0.05), last_ok_at: iso(0.05), state: 'ok', error: null, records: 0 };
    tables.revenue_events = [];
    tables.revenue_sync = revenue === 'empty' ? [] : [revenue === 'failing' ? { ...sync, last_ok_at: null, state: 'error', error: 'Gumroad refused the token (401)' } : sync];
    if (revenue === 'some') {
      let n = 0;
      for (const [amount, k] of [[4.99, 1], [4.99, 3], [3.99, 9]]) tables.revenue_events.push({ id: uuid(5, ++n), source: 'gumroad', connection_id: 'poppy', house_id: 'poppy', product_id: null, occurred_at: iso(k), amount, currency: 'USD', kind: 'sale', external_id: 'ord-' + n, meta: {} });
      tables.revenue_events.push({ id: uuid(5, ++n), source: 'gumroad', connection_id: 'poppy', house_id: 'poppy', product_id: null, occurred_at: iso(2), amount: 1, currency: 'USD', kind: 'refund', external_id: 'ref-1', meta: {} });
      tables.revenue_events.push({ id: uuid(5, ++n), source: 'razorpay', connection_id: 'rzp-main', house_id: 'poppy', product_id: null, occurred_at: iso(5), amount: 1500, currency: 'INR', kind: 'sale', external_id: 'rzp-1', meta: {} });
      tables.revenue_sync[0].records = n;
    }
  }
  // routes of the stand-in beyond the REST tables; a test can replace any of them. 404 is what production answers for a route that is not deployed yet.
  const routes = {
    'POST /api/oauth/begin': (b) => ({ status: 200, body: { authorize_url: `https://accounts.example.test/authorize?connection=${encodeURIComponent(b && b.connection_id)}`, expires_in: 600 } }),
    'POST /api/oauth/verify': () => ({ status: 200, body: { status: 'CONNECTED_VERIFIED', detail: 'Verified from the cloud' } }),
  };
  return { tables, routes, rpcDeny, rpcAllow, expect: { houses: NAV.houses.length, revenue } };
}
