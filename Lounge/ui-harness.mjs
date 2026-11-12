// The shared harness of the browser tests (ui-browser.test.mjs, theme-browser.test.mjs): a static server for this folder, headless Chromium through
// Playwright, and a STAND-IN for Nova so the real index.html runs against SYNTHETIC data. No production service, database or account is touched.
// Without Playwright or a browser the tests SKIP loudly instead of passing quietly.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
// the RPC names the REAL Nova serves (parsed from api/_nova.js with comments stripped), so a call to a function Nova does not expose fails here as it does in production
export const NOVA_RPCS = (() => { try { const t = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'api', '_nova.js'), 'utf8'); const i = t.indexOf('export const RPCS = new Set(['), j = t.indexOf(']);', i); return new Set([...t.slice(i, j).replace(/\/\/.*$/gm, '').matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1])); } catch { return new Set(); } })();
export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };

// the bridge the desktop app exposes: built from the real preload.js, so a method the page calls but the bridge lacks is caught
export const preloadKeys = (() => { const s = fs.readFileSync(path.join(here, '..', 'Lounge Desktop', 'preload.js'), 'utf8'); const i = s.indexOf('exposeInMainWorld'); return [...s.slice(i).matchAll(/^\s{2}([A-Za-z]+):/gm)].map((x) => x[1]); })();
const bridgeStub = `window.cocoDesktop = new Proxy({ platform: 'windows' }, { get(t, k) { if (k in t) return t[k]; return (...a) => { window.__bridgeCalls = (window.__bridgeCalls || []).concat(String(k)); return Promise.resolve(/^(get|is)/.test(String(k)) ? false : { error: 'stub' }); }; } });`;

// The functions the stand-in implements (the real ones live in Coco Cloud). submit_task merges a same-titled open task in the same House, like the real one.
const DEFAULT_RPC = {
  submit_task: (a, fx) => {
    const twin = fx.tables.tasks.find((t) => ['queued', 'running', 'waiting_pc', 'needs_yes'].includes(t.status) && (t.house_id === a.p_house || !a.p_house) && String(t.title).toLowerCase() === String(a.p_title).toLowerCase());
    if (twin) { fx.tables.task_notes.push({ id: fx.tables.task_notes.length + 100, task_id: twin.id, note: `Same request from ${a.p_by}: ${a.p_title}`, by_email: a.p_by, device_id: a.p_device, at: new Date().toISOString() }); return { merged: true, task_id: twin.id, title: twin.title, status: twin.status, device: twin.claimed_by_device, by: twin.created_by }; }
    const id = `00000000-0000-4000-8000-${String(900000 + fx.tables.tasks.length).padStart(12, '0')}`;
    fx.tables.tasks.unshift({ id, title: a.p_title, details: a.p_details || null, house_id: a.p_house || null, needs: a.p_needs || 'any', status: 'queued', priority: 2, created_by: a.p_by, created_device: a.p_device, claimed_by_device: null, claimed_at: null, heartbeat_at: null, result: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), merged_into: null, ai_checked: false, pipeline_id: null, step: null, member_id: null, retry_count: 0, error: null, evidence: null, stale: false, category: null, platform_id: null });
    return { merged: false, task_id: id };
  },
  coco_job_cancel: (a, fx) => {
    const j = fx.tables.jobs.find((x) => x.id === a.p_id && ['queued', 'running', 'blocked'].includes(x.status));
    if (!j) return { ok: false, reason: 'no open job with that id' };
    Object.assign(j, { status: 'cancelled', lease_owner: null, lease_until: null, error: { kind: 'cancelled', message: a.p_reason || 'cancelled' }, updated_at: new Date().toISOString() });
    return { ok: true, job: j };
  },
  // a founder's Retry (migration 20261112 on the real Nova); rpcDeny removes it to show the Nova that does not have it yet
  coco_job_retry: (a, fx) => {
    if (Object.keys(a).some((k) => k !== 'p_id')) return { __status: 404, body: { message: 'function coco_job_retry does not take those arguments' } };
    const j = fx.tables.jobs.find((x) => x.id === a.p_id && ['failed', 'cancelled'].includes(x.status));
    if (!j) return { ok: false, reason: 'no failed or cancelled job with that id' };
    Object.assign(j, { status: 'queued', error: {}, lease_owner: null, lease_until: null, run_after: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { ok: true, job: j };
  },
  // the real run path: a request for the team workflow, refused with a reason when the company is stopped, the workflow is off or one is already waiting
  coco_request_run: (a, fx) => {
    const rows = fx.tables.run_requests, now = new Date().toISOString();
    if (fx.requestRefusal) return { ok: false, reason: fx.requestRefusal };
    if (rows.some((r) => r.workflow_id === a.p_workflow && ['pending', 'claimed'].includes(r.state))) return { ok: false, reason: `${a.p_workflow} is already waiting to run` };
    const id = Math.max(0, ...rows.map((r) => r.id)) + 1;
    rows.unshift({ id, workflow_id: a.p_workflow, state: 'pending', requested_by: 'boss@example.com', device_id: 'boss-pc', note: a.p_note, run_id: null, result: null, reason: null, created_at: now, claimed_at: null, claimed_by: null, finished_at: null });
    return { ok: true, request_id: id, workflow: a.p_workflow, note: 'queued; the next cloud cycle picks it up' };
  },
  // proposed (migration not applied): withdraw a run request that has not started
  coco_run_request_cancel: (a, fx) => { const r = fx.tables.run_requests.find((x) => x.id === a.p_id && x.state === 'pending'); if (!r) return { ok: false, reason: 'no waiting request with that id' }; Object.assign(r, { state: 'cancelled', reason: 'cancelled by a founder', finished_at: new Date().toISOString() }); return { ok: true }; },
  // proposed (migration not applied): one queued zero-AI job for a task
  coco_task_enqueue: (a, fx) => {
    const t = fx.tables.tasks.find((x) => x.id === a.p_task); if (!t) return { ok: false, reason: 'no such task' };
    const job = { id: 'JOB-T' + (fx.tables.jobs.length + 1), idempotency_key: `coco-task:${a.p_task}:${a.p_job_type}`, type: a.p_job_type, company_id: 'good-space', team_id: a.p_team, subteam_id: null, category_id: null, channel_id: null, agent_id: null, workflow_id: null, run_id: null, payload: { ...a.p_payload, coco_task_id: a.p_task }, priority: 2, status: 'queued', attempt: 0, max_attempts: 3, run_after: new Date().toISOString(), lease_owner: null, lease_until: null, created_at: new Date().toISOString(), started_at: null, completed_at: null, failed_at: null, result: {}, error: {}, errors: [], updated_at: new Date().toISOString() };
    fx.tables.jobs.unshift(job); Object.assign(t, { status: 'queued', result: `Waiting for a worker: cloud job ${job.id}` }); return { ok: true, job };
  },
  coco_structure: (a, fx) => {
    if (a.p_op === 'create') { if (fx.tables.structure.some((r) => r.id === a.p_id)) return { __status: 400, body: { message: 'that id exists' } }; fx.tables.structure.push({ id: a.p_id, kind: a.p_kind, parent_id: a.p_parent, name: a.p_name, description: a.p_description || null, head_agent_id: null, template: null, config: {}, state: 'paused', created_at: new Date().toISOString(), created_by: 'test', updated_at: new Date().toISOString(), updated_by: 'test' }); }
    return { ok: true, id: a.p_id };
  },
};

// ---------------------------------------------------------------- the stand-in for Nova (PostgREST subset: eq / in / neq filters, select, PATCH, POST and DELETE that change state)
function match(row, params) {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k)) continue;
    let m;
    if ((m = /^eq\.(.*)$/.exec(v))) { if (String(row[k]) !== m[1]) return false; }
    else if ((m = /^neq\.(.*)$/.exec(v))) { if (String(row[k]) === m[1]) return false; }
    else if ((m = /^in\.\((.*)\)$/.exec(v))) { if (!m[1].split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(row[k]))) return false; }
  }
  return true;
}
const project = (rows, select) => (select && select !== '*' ? rows.map((r) => Object.fromEntries(select.split(',').map((c) => [c.trim(), r[c.trim()]]))) : rows);
export function novaStandIn(fx, calls) {
  return async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let body = null; try { body = req.postDataJSON(); } catch { /* none */ }
    if (m !== 'GET') calls.push({ m, p, q: u.search, body });
    // a fixture can serve (or refuse) any /api route; the default for a route nobody serves is 404, which is what production answers for a route that is not deployed yet
    const custom = fx.routes && fx.routes[`${m} ${p}`];
    if (custom) { const r = await custom(body, u); return json(r.body, r.status || 200); }
    if (p === '/api/me') return json({ email: 'boss@example.com', device_id: 'boss-pc', name: 'Boss PC' });
    if (p === '/api/changes') return json({ version: 'v1', last_topic: null });
    if (p === '/api/youtube/latest') return json({ stale: false, label: 'Fresh', collected_at: new Date(Date.now() - 36e5).toISOString(), channel: { title: 'Channel A', views: 123456, subscribers: 7890 } });
    if (p === '/api/chat' && m === 'POST') return json({ founder: { id: 9001, role: 'founder', author: 'Boss', body }, reply: { id: 9002, role: 'coco', body: 'Mock reply: all clear.', meta: { state: 'Completed' } } });
    if (p === '/api/automation/stats') return json({ target: {}, range: {}, production: { source: 'COCO planned work', rows: [{ deliverable: 'short', planned: 10, created: 6, pending: 3, failed: 1, cancelled: 0 }, { deliverable: 'chapter', planned: 4, created: 4, pending: 0, failed: 0, cancelled: 0 }] } });
    if (p === '/api/automation/schema') return json({ presets: [], product_types: [], creatable: { house: { units: ['team', 'subteam'], product_types: [] } }, platforms: [], sections: [] });
    if (p === '/api/automation/org') return json({ units: fx.tables.org_units, products: fx.tables.org_products });
    if (p === '/api/automation/templates') return json({ templates: [{ id: 'tpl1', name: 'Short template', kind: 'channel', status: 'active', current_version: 2, assignments: 1, owner_unit_id: 'gigi.s1', owner_product_id: null }] });
    if (p === '/api/automation/prompts') return json({ prompts: [{ id: 'pr1', name: 'Short script prompt', kind: 'template', template_id: 'tpl1', status: 'active', active_version: 2, current_version: 2 }] });
    if (p.startsWith('/api/automation/')) return json({});
    if (p.startsWith('/api/')) return json({ message: 'not in the stand-in' }, 404);
    const rpc = p.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
    if (rpc) {
      const name = rpc[1], allow = new Set([...NOVA_RPCS, ...(fx.rpcAllow || [])]); for (const d of fx.rpcDeny || []) allow.delete(d);   // rpcDeny: Nova without that function (production before it was added)
      if (!allow.has(name)) return json({ message: `no such function ${name}` }, 404);
      const impl = (fx.rpc && fx.rpc[name]) || DEFAULT_RPC[name];
      if (!impl) return json(null);
      const out = impl(body || {}, fx);
      return out && out.__status ? json(out.body, out.__status) : json(out);
    }
    const t = p.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (t) {
      const rows = fx.tables[t[1]], sel = u.searchParams.get('select');
      if (!rows) return json({ message: `no table ${t[1]}`, code: '42P01' }, 404);
      if (fx.deny && fx.deny.includes(t[1]) && m !== 'GET') return json({ message: 'permission denied', code: '42501' }, 403);
      if (m === 'GET') return json(project(rows.filter((r) => match(r, u.searchParams)), sel));
      if (m === 'PATCH') {
        const hit = rows.filter((r) => match(r, u.searchParams));
        for (const r of hit) { Object.assign(r, body || {}); if (t[1] === 'controls' && !(body && body.updated_at)) r.updated_at = new Date().toISOString(); }
        return json(project(hit, sel || 'id'));
      }
      if (m === 'DELETE') {
        const hit = rows.filter((r) => match(r, u.searchParams));
        for (const r of hit) rows.splice(rows.indexOf(r), 1);
        return json(project(hit, sel || '*'));
      }
      if (m === 'POST') {
        const list = (Array.isArray(body) ? body : [body]).map((r) => ({ ...(t[1] === 'controls' ? { updated_at: new Date().toISOString() } : {}), ...(['categories', 'offerings', 'decisions'].includes(t[1]) && !r.id ? { id: `00000000-0000-4000-8000-${String(800000 + rows.length + Math.floor(Math.random() * 99999)).padStart(12, '0')}` } : {}), ...r }));
        if (t[1] === 'controls' && list.some((r) => rows.some((x) => x.id === r.id))) return json({ message: 'duplicate key value violates unique constraint', code: '23505' }, 409);
        rows.push(...list); return json(project(list, sel || '*'), 201);
      }
      return json([], 200);
    }
    return json({}, 404);
  };
}

// ---------------------------------------------------------------- the harness
export async function createHarness(label) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { console.log(`${label} tests SKIPPED: playwright is not installed`); process.exit(0); }
  const SHOTS = process.env.SHOTS || '', DESKTOP = process.env.DESKTOP === '1';
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', file = path.join(here, rel);
    if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('no'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try { browser = await chromium.launch({ headless: true }); } catch (e) { console.log(`${label} tests SKIPPED: no browser (${String(e.message).split('\n')[0]})`); server.close(); process.exit(0); }

  const results = []; let failed = 0, cur = null;
  const where = async () => { try { return cur ? await cur.evaluate(() => `hash=${location.hash} title=${(document.getElementById('title') || {}).textContent} palette=${document.documentElement.dataset.palette}/${document.documentElement.dataset.mode}`) : ''; } catch { return ''; } };
  const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;   // ONLY=<regex> runs just the matching checks (for working on one thing)
  const check = async (name, fn) => { if (only && !only.test(name)) return; const t0 = Date.now(); try { await fn(); results.push(['PASS', name]); console.log('PASS ' + name + '  (' + Math.round((Date.now() - t0) / 1000) + 's)'); } catch (e) { failed++; results.push(['FAIL', name, e.message]); console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').filter((l) => !/^\s*$/.test(l)).slice(0, 7).join('\n     ') + '\n     [page] ' + await where()); } };
  const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const ok = (v, m = 'expected truthy') => { if (!v) throw new Error(m); };
  const settle = (page, ms = 350) => page.waitForTimeout(ms);
  const text = (page, sel) => page.locator(sel).first().innerText();
  const bad = (s) => /undefined|NaN|\[object/.test(s);
  const goHash = async (page, h) => { await page.evaluate((x) => { location.hash = x; }, h); await settle(page, 250); };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };

  // A browser context holds one person's storage (localStorage is shared by every page opened in it; each page is a new session).
  async function context(fx, { width = 1440, height = 900, reduced = false, local = {}, calls = [], dark = false, clock = null } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
    await ctx.route('**/nova.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"http://nova.test"}' }));
    await ctx.route('http://nova.test/**', novaStandIn(fx, calls));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
    const seed = { 'gs-device-key': 'test-device-key-0123456789', 'gs-device-id': 'boss-pc', ...local };
    // seeds are written once per context (not on every page load), so a reload sees what the app itself saved
    await ctx.addInitScript(`try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); const s = ${JSON.stringify(seed)}; for (const k in s) localStorage.setItem(k, typeof s[k] === 'string' ? s[k] : JSON.stringify(s[k])); localStorage.removeItem('gs-home-filters'); } } catch (e) {}`);
    await ctx.addInitScript(`window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };`);
    if (DESKTOP) await ctx.addInitScript(bridgeStub);
    return { ctx, calls, errors: [], dialogs: [], clock };
  }
  async function pageIn(c, { hash = 'home' } = {}) {
    const page = await c.ctx.newPage();
    page.on('pageerror', (e) => c.errors.push('pageerror: ' + e.message));
    page.on('dialog', (d) => { c.dialogs.push(d.message()); d.accept().catch(() => {}); });
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) c.errors.push('console: ' + m.text()); });
    if (c.clock) await page.clock.install({ time: new Date(c.clock) });
    await page.goto(`${BASE}index.html#${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const a = document.getElementById('app'); const v = document.getElementById('view'); return a && !a.hidden && v && v.children.length > 0; }, null, { timeout: 30000 });
    await page.waitForTimeout(400); cur = page; return page;
  }
  // the original one-call opener
  async function open(fx, opts = {}) {
    const local = opts.theme ? { 'gs-theme': opts.theme } : {};
    const c = await context(fx, { ...opts, local: { ...local, ...(opts.local || {}) } });
    const page = await pageIn(c, { hash: opts.hash || 'home' });
    return { ctx: c.ctx, page, errors: c.errors, calls: c.calls, dialogs: c.dialogs, c };
  }
  const finish = async (name) => {
    await browser.close(); server.close();
    console.log(`\n${name}${DESKTOP ? ' (desktop bridge stub)' : ''}: ${results.filter((r) => r[0] === 'PASS').length} passed, ${failed} failed`);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `results-${name}${DESKTOP ? '-desktop' : ''}.json`), JSON.stringify(results, null, 1));
    process.exit(failed ? 1 : 0);
  };
  return { here, BASE, browser, SHOTS, DESKTOP, results, check, eq, ok, settle, text, bad, goHash, shot, context, pageIn, open, finish, current: () => cur };
}
