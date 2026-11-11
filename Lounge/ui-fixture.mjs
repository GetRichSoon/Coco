// SYNTHETIC data for the browser test of the unified UI. Nothing here is real company data (the public repository must hold none): House
// ids and platforms come from the navigation contract, every name is generic, every number is made up for the test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const NAV = JSON.parse(fs.readFileSync(path.join(dir, 'contract', 'nav-contract.json'), 'utf8'));
const iso = (n) => new Date(Date.now() - n * 864e5).toISOString();
const day = (n) => iso(n).slice(0, 10);

// withRevenue: false = no revenue record exists anywhere (the honest "Unavailable" case). true = actual INR and USD from a connected
// account, plus an estimate for one House that must never be added to the actuals.
export function fixture({ withRevenue = false, metricsReadable = true } = {}) {
  const houses = NAV.houses.map((h, i) => ({ id: h.id, name: h.name, role: `${h.domain} House`, state: i === 6 ? 'planned' : 'working', doing: `Working on ${h.domain.toLowerCase()}`, next: 'Next step', sort: i + 1 }));
  const units = [{ id: 'getrichsoon', kind: 'organisation', parent_id: null, house_id: null, display_name: 'Organisation', short_name: 'Organisation', state: 'active', sort: 0 },
    { id: 'coco', kind: 'company', parent_id: 'getrichsoon', house_id: null, display_name: 'COCO', short_name: 'COCO', state: 'active', sort: 0 },
    { id: 'core', kind: 'house', parent_id: 'coco', house_id: null, display_name: 'Core House', short_name: 'Core House', state: 'active', sort: 1 },
    { id: 'team_houses', kind: 'group', parent_id: 'coco', house_id: null, display_name: 'Team Houses', short_name: 'Team Houses', state: 'active', sort: 2 }];
  const products = [], agents = [], brains = [{ id: 'brain.coco', level: 'global', unit_id: 'coco', product_id: null, parent_brain_id: null, state: 'active', health: 'ok', last_activity_at: iso(0.1), objectives: ['Grow the company'], kpis: [], tools: [], policies: {} }];
  NAV.houses.forEach((h, i) => {
    units.push({ id: h.id, kind: 'house', parent_id: 'team_houses', house_id: h.id, display_name: `${h.name} ${h.domain} House`, short_name: h.name, focus: `${h.domain} focus`, purpose: `Runs ${h.domain.toLowerCase()} for the company.`, state: 'active', sort: i + 1 });
    for (const s of [1, 2]) {
      units.push({ id: `${h.id}.s${s}`, kind: 'subteam', parent_id: h.id, house_id: h.id, display_name: `${h.name} Subteam ${s}`, short_name: `Subteam ${s}`, state: 'active', sort: s });
      units.push({ id: `${h.id}.s${s}.c1`, kind: 'category', parent_id: `${h.id}.s${s}`, house_id: h.id, display_name: `Category ${s}`, short_name: `Category ${s}`, state: 'active', sort: 1 });
      agents.push({ id: `agent.${h.id}.s${s}.head`, unit_id: `${h.id}.s${s}`, role: 'head', name: `${h.name} head ${s}`, registry_agent: s === 1 ? `agent-${h.id}-1` : null, status: s === 1 ? 'active' : 'placeholder' });
    }
    products.push({ id: `${h.id}-p1`, unit_id: `${h.id}.s1.c1`, kind: i % 2 ? 'product' : 'channel', name: `${h.name} Channel A`, platform_id: h.platforms[0], external_ref: `ext-${h.id}`, status: 'connected', source: 'existing', meta: {} });
    products.push({ id: `${h.id}-p2`, unit_id: `${h.id}.s2.c1`, kind: 'product', name: `${h.name} Product B`, platform_id: h.platforms[1] || h.platforms[0], external_ref: null, status: 'planned', source: 'placeholder', meta: {} });
    brains.push({ id: `brain.${h.id}`, level: 'house', unit_id: h.id, product_id: null, parent_brain_id: 'brain.coco', state: 'active', health: i === 2 ? 'degraded' : 'ok', last_activity_at: iso(0.5), objectives: [`Grow ${h.domain}`, 'Keep quality high'], kpis: [], tools: [], policies: {} });
    brains.push({ id: `brain.${h.id}.s1`, level: 'subteam', unit_id: `${h.id}.s1`, product_id: null, parent_brain_id: `brain.${h.id}`, state: 'configured', health: 'idle', last_activity_at: null, objectives: [], kpis: [], tools: [], policies: {} });
  });
  const metrics = []; let id = 1;
  const m = (unit_id, product_id, metric, n, value, unit, source) => metrics.push({ id: id++, unit_id, product_id, metric, period: day(n), value, unit, source, recorded_at: iso(n) });
  for (let n = 0; n < 56; n++) { m('gigi.s1', 'gigi-p1', 'views', n, 100 + (56 - n) * 3, 'views', 'youtube analytics'); if (n % 7 === 0) m('gigi.s1', 'gigi-p1', 'subscribers', n, 1400 - n * 8, 'count', 'youtube analytics'); if (n < 30) m('lulu.s1', 'lulu-p1', 'installs', n, 5 + (n % 9), 'count', 'chrome web store'); if (n % 2 === 0) m('poppy.s1', 'poppy-p1', 'sales', n, 2 + (n % 3), 'count', 'gumroad'); }
  if (withRevenue) {
    for (let n = 0; n < 56; n += 3) { m('poppy.s1', 'poppy-p1', 'revenue', n, n < 28 ? 499 : 399, 'INR', 'gumroad'); if (n % 6 === 0) m('poppy.s1', 'poppy-p1', 'revenue', n, 5, 'USD', 'gumroad'); }
    for (let n = 0; n < 20; n += 5) m('tilly.s1', 'tilly-p1', 'revenue', n, 1000, 'INR', 'forecast model (estimate)');
  }
  const integration_accounts = [
    { connection_id: 'gumroad-main', provider: 'gumroad', external_id: null, external_name: 'Main shop', external_handle: null, account_label: 'owner', secret_ref: 'vault:gumroad-main', state: 'connected', permissions: ['read'], connected_at: iso(10), last_verified_at: iso(1) },
    { connection_id: 'youtube-a', provider: 'youtube', external_id: 'ext-gigi', external_name: 'Channel A', external_handle: '@a', account_label: 'owner', secret_ref: 'vault:youtube-a', state: 'connected', permissions: ['read', 'publish'], connected_at: iso(20), last_verified_at: iso(1) },
    { connection_id: 'youtube-b', provider: 'youtube', external_id: 'ext-b', external_name: 'Channel B', external_handle: '@b', account_label: 'owner', secret_ref: null, state: 'error', permissions: ['read'], connected_at: null, last_verified_at: iso(5) },
  ];
  const integrations = [{ id: 'youtube', platform: 'YouTube', state: 'connected', account: 'Channel A', capabilities: ['read'], last_ok_at: iso(1) }, { id: 'gumroad', platform: 'Gumroad', state: 'connected', account: 'Main shop', capabilities: ['read'], last_ok_at: iso(1) }];
  const jobs = [
    { id: 'JOB-1', type: 'video-render', team_id: 'gigi', subteam_id: 'gigi.s1', category_id: null, channel_id: null, status: 'running', attempt: 1, max_attempts: 3, created_at: iso(0.1), updated_at: iso(0.05) },
    { id: 'JOB-2', type: 'ebook-build', team_id: 'poppy', subteam_id: null, category_id: null, channel_id: null, status: 'queued', attempt: 0, max_attempts: 3, created_at: iso(0.2), updated_at: iso(0.2) },
    { id: 'JOB-3', type: 'upload', team_id: 'gigi', subteam_id: null, category_id: null, channel_id: null, status: 'failed', attempt: 3, max_attempts: 3, created_at: iso(1), updated_at: iso(0.9) },
    { id: 'JOB-4', type: 'publish', team_id: 'lulu', subteam_id: null, category_id: null, channel_id: null, status: 'blocked', attempt: 1, max_attempts: 3, created_at: iso(1), updated_at: iso(0.9) },
  ];
  const outputs = Array.from({ length: 12 }, (_, i) => ({ id: `OUT-${i}`, at: iso(i * 1.5), team_id: i % 3 ? 'gigi' : 'poppy', kind: i % 3 ? 'short' : 'chapter', title: `Output ${i}`, status: i === 4 ? 'failed' : i === 5 ? 'scheduled' : 'published', url: i % 2 ? `https://example.com/o/${i}` : null }));
  const devices = [
    { id: 'boss-pc', name: 'Boss PC', kind: 'pc', platform: 'Windows', app_version: 'desktop-1.1.0', active: true, last_seen: iso(0.0001), update_state: null },
    { id: 'boss-phone', name: 'Boss phone', kind: 'phone', platform: 'Android', app_version: 'android-2.11.0', active: true, last_seen: iso(0.0002), update_state: null },
    { id: 'big-pc', name: 'Big Boss PC', kind: 'pc', platform: 'Windows', app_version: 'desktop-1.0.5', active: true, last_seen: iso(20), update_state: null },
    { id: 'cloud-worker-1', name: 'Cloud worker', kind: 'cloud', platform: 'Cloud', app_version: 'worker-1', active: true, last_seen: iso(0.001), update_state: null },
  ];
  const approvals = [
    { id: 1, code: 'A-101', team: 'gigi', what: 'Publish the weekly Short', state: 'waiting', raised_on: day(1), files: null, decided_by: null },
    { id: 2, code: 'A-102', team: 'poppy', what: 'Price change for Book 3', state: 'waiting', raised_on: day(2), files: null, decided_by: null },
    { id: 3, code: 'A-099', team: 'lulu', what: 'Release 5.8', state: 'approved', raised_on: day(9), files: null, decided_by: 'Boss' },
  ];
  const tasks = [
    { id: 't1', title: 'Write the next Short script', status: 'running', house_id: 'gigi', created_at: iso(1) },
    { id: 't2', title: 'Design the cover', status: 'queued', house_id: 'poppy', created_at: iso(2) },
    { id: 't3', title: 'Fix the install bug', status: 'done', house_id: 'lulu', created_at: iso(4) },
  ];
  const founders = [{ email: 'boss@example.com', name: 'Boss', call_me: 'Boss' }];
  const platforms = [...new Set(NAV.houses.flatMap((h) => h.platforms))].map((p, i) => ({ id: p, name: p.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), sort: i }));
  const offerings = NAV.houses.map((h) => ({ id: `o-${h.id}`, house_id: h.id, name: `${h.name} earlier offering`, platform_id: h.platforms[0], status: 'live' }));
  const activity = [{ id: 1, at: iso(0.2), actor: 'Boss', action: 'approved', detail: 'A-099 for lulu', device_id: 'boss-pc' }, { id: 2, at: iso(0.4), actor: 'Boss', action: 'task created', detail: 'Write the next Short script (gigi)', device_id: 'boss-phone' }];
  const tables = {
    houses, categories: [], offerings, platforms, members: [], member_houses: [], tools: [], member_tools: [], tasks, task_notes: [], approvals, devices, decisions: [], activity, founders, rules: [], commands: [], integrations,
    agent_messages: [], notes: [], runs: [], run_events: [], ai_calls: [], brain_items: [], policies: [], control_ops: [], structure: [], integration_accounts, integration_links: [{ id: 1, integration_id: 'youtube', team_id: 'gigi', subteam_id: null, enabled: true, permissions: ['read'] }],
    outputs, jobs, releases: [], chat: [], controls: [], pipelines: [], pulse: [], pairing_codes: [],
    org_units: units, org_products: products, org_agents: agents, org_repos: [], org_workflows: [{ repo: 'Org/engine', file: 'cycle.yml', branch: 'main', schedule: '15 2 * * *', unit_id: 'gigi.s1', state: 'observed' }], org_access: [], org_metrics: metrics, org_refs: [{ id: 1, unit_id: 'gigi.s1', title: 'Style guide', kind: 'document' }],
    org_brains: brains, org_readiness: [], org_reconciliation_view: [], cloud_providers: [], provider_switches: [], integration_registry: [], credential_audit: [], capabilities: [], capability_uses: [], integration_health: [], device_sync_audit: [],
  };
  if (!metricsReadable) delete tables.org_metrics;   // like production today: Nova does not expose the table, so the page gets a 404
  return { tables, expect: { houses: NAV.houses.length, revenue: withRevenue } };
}
