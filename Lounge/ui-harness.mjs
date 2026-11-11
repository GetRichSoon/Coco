// The shared harness of the browser tests (ui-browser.test.mjs, theme-browser.test.mjs): a static server for this folder, headless Chromium through
// Playwright, and a STAND-IN for Nova so the real index.html runs against SYNTHETIC data. No production service, database or account is touched.
// Without Playwright or a browser the tests SKIP loudly instead of passing quietly.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mjs': 'text/javascript', '.woff2': 'font/woff2' };

// the bridge the desktop app exposes: built from the real preload.js, so a method the page calls but the bridge lacks is caught
export const preloadKeys = (() => { const s = fs.readFileSync(path.join(here, '..', 'Lounge Desktop', 'preload.js'), 'utf8'); const i = s.indexOf('exposeInMainWorld'); return [...s.slice(i).matchAll(/^\s{2}([A-Za-z]+):/gm)].map((x) => x[1]); })();
const bridgeStub = `window.cocoDesktop = new Proxy({ platform: 'windows' }, { get(t, k) { if (k in t) return t[k]; return (...a) => { window.__bridgeCalls = (window.__bridgeCalls || []).concat(String(k)); return Promise.resolve(/^(get|is)/.test(String(k)) ? false : { error: 'stub' }); }; } });`;

// ---------------------------------------------------------------- the stand-in for Nova (PostgREST subset: eq / in / neq filters, select, PATCH and POST that change state)
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
    if (/^\/rest\/v1\/rpc\//.test(p)) return json(null);
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
      if (m === 'POST') {
        const list = (Array.isArray(body) ? body : [body]).map((r) => ({ ...(t[1] === 'controls' ? { updated_at: new Date().toISOString() } : {}), ...r }));
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
    if (DESKTOP) await ctx.addInitScript(bridgeStub);
    return { ctx, calls, errors: [], clock };
  }
  async function pageIn(c, { hash = 'home' } = {}) {
    const page = await c.ctx.newPage();
    page.on('pageerror', (e) => c.errors.push('pageerror: ' + e.message));
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
    return { ctx: c.ctx, page, errors: c.errors, calls: c.calls, c };
  }
  const finish = async (name) => {
    await browser.close(); server.close();
    console.log(`\n${name}${DESKTOP ? ' (desktop bridge stub)' : ''}: ${results.filter((r) => r[0] === 'PASS').length} passed, ${failed} failed`);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `results-${name}${DESKTOP ? '-desktop' : ''}.json`), JSON.stringify(results, null, 1));
    process.exit(failed ? 1 : 0);
  };
  return { here, BASE, browser, SHOTS, DESKTOP, results, check, eq, ok, settle, text, bad, goHash, shot, context, pageIn, open, finish, current: () => cur };
}
