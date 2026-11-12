// Run: node ui-browser.test.mjs        (SHOTS=<folder> keeps screenshots; DESKTOP=1 runs the same checks with the desktop bridge stub installed; ONLY=<regex> runs matching checks)
//
// The COCO operating screens in a real browser (Chromium through Playwright), against SYNTHETIC data served by a stand-in for Nova: no production
// service, database or account is touched. The data has the REAL production shapes (the original tables, the real status words, no org_* table,
// no revenue table unless a scenario adds one, a cloud worker last seen days ago) so the screens are proven on what production holds.
// It drives the real index.html: Home, Tasks (every action), approvals, the seven House workspaces, connections, revenue, Ask COCO, the phone layout.
// Without Playwright or a browser it SKIPS loudly instead of passing quietly.
import fs from 'node:fs';
import path from 'node:path';
import { createHarness, here, preloadKeys } from './ui-harness.mjs';
import { fixture, NAV, TID, AID } from './ui-fixture.mjs';

const H = await createHarness('ui-browser');
const { check, eq, ok, settle, text, bad, goHash, shot, open, SHOTS } = H;
const q = (c) => decodeURIComponent(c.q || '');
const writes = (calls, m, p) => calls.filter((c) => c.m === m && c.p === p);
const hashOf = (page) => page.evaluate(() => location.hash);
const toastOf = async (page) => (await text(page, '#toast')).replace(/\s+/g, ' ').trim();
const flat = (s) => String(s).replace(/\s+/g, ' ').trim();
const noLeak = (s, what) => ok(!bad(s), `${what} leaked undefined/NaN: ` + ((String(s).match(/.{20}(undefined|NaN|\[object).{20}/s) || [''])[0]));
const click = async (page, sel, ms = 700) => { await page.locator(sel).first().click(); await settle(page, ms); };

// ================================================================ scenario A: production as it is today (worker last seen days ago, no org_* and no revenue table)
const A = fixture({});
let s = await open(A, {});
const callsA = s.calls;

await check('the shell: eight sections, seven Houses, search, device chip, Ask COCO, bell, profile', async () => {
  const links = await s.page.locator('#nav a:not(.hl) .lbl').allInnerTexts();
  eq(links.map((x) => x.trim()).join('|'), NAV.sections.map((x) => x.label).join('|'), 'sections');
  eq((await s.page.locator('#nav a.hl .lbl').allInnerTexts()).join('|'), NAV.houses.map((h) => h.label).join('|'), 'Houses');
  for (const id of ['#q', '#remoteChip', '#askBtn', '#bellBtn', '#meBtn']) ok(await s.page.locator(id).isVisible(), id + ' is missing');
  eq(flat(await text(s.page, '#remoteChip')), 'Remote · 2/4 online', 'the cloud worker last seen days ago is offline');
  ok((await text(s.page, '#nav a[href="#tasks"]')).includes('2'), 'the Work badge shows the 2 waiting approvals');
});

await check('Home is simple: greeting, four tiles, quick actions, Needs attention, Active work - and nothing from the old revenue-first Home', async () => {
  ok(/^Good (morning|afternoon|evening), Boss$/.test(flat(await text(s.page, '#title'))), 'greeting: ' + await text(s.page, '#title'));
  ok(await s.page.locator('#liveDot').count() === 1, 'the live dot is on the page');
  const tiles = (await s.page.locator('.tiles .tile').allInnerTexts()).map(flat);
  eq(tiles.length, 4, 'four tiles');
  ok(/^task_alt 14 Open tasks 1 failed$/.test(tiles[0]), 'Open tasks = queued + planned + paused + running + needs-a-check (14) with a red failed badge: ' + tiles[0]);
  ok(/ 2 Running now/.test(tiles[1]), 'Running now = the running task + the running job (a task that finished and awaits a check is not running): ' + tiles[1]);
  ok(/ 2 Waiting for YES/.test(tiles[2]), 'Waiting for YES: ' + tiles[2]);
  ok(/ 9 Alerts/.test(tiles[3]), 'Alerts: failed task, task to check, failed job, blocked job, integration, failed cloud runs, two Claude blocks, the worker: ' + tiles[3]);
  const qa = flat(await text(s.page, '.qa'));
  ok(/New task/.test(qa) && /Ask COCO/.test(qa) && /Remote/.test(qa), 'quick actions: ' + qa);
  ok(/Cloud worker last run 10 d ago/.test(qa) && !/offline/i.test(qa), 'the worker is described by its schedule, never as offline since a date: ' + qa);
  for (const gone of ['.kpi', '.kpis', '.chartcard', '.housecard', '.opsgrid', '.fwrap', '.filters']) eq(await s.page.locator(gone).count(), 0, gone + ' must not be on Home');
  const t = await text(s.page, '#view');
  for (const w of ['Total revenue', 'Total views', 'House performance', 'Live operations', 'Coco HQ', 'Next up', 'Team talk']) ok(!t.includes(w), 'Home still shows ' + w);
  noLeak(t, 'Home');
});

await check('Home: Needs attention lists each thing with the action it needs, worst first - failed work, checks, cloud run failures, Claude blocks, the token leak, the worker', async () => {
  const rows = (await s.page.locator('#attn + .alist .arow').allInnerTexts()).map(flat), at = (re) => rows.find((r) => re.test(r)) || '';
  ok(rows.length >= 10, 'rows: ' + rows.length);
  ok(/Failed upload task/.test(at(/Failed upload task/)) && /Retry/.test(at(/Failed upload task/)) && /Cancel/.test(at(/Failed upload task/)), 'failed task: Retry and Cancel');
  ok(/Job upload failed/.test(at(/Job upload failed/)) && /quota exceeded/.test(at(/Job upload failed/)) && /Retry/.test(at(/Job upload failed/)), 'failed job with its error and Retry');
  ok(/blocked/i.test(at(/Job publish is blocked/)) && /Cancel/.test(at(/Job publish is blocked/)) && !/Retry/.test(at(/Job publish is blocked/)), 'blocked job: Cancel only (a retry cannot give it a handler): ' + at(/Job publish is blocked/));
  ok(/connection problem/.test(at(/connection problem/)) && /leaked/.test(at(/connection problem/)) && /Reconnect/.test(at(/connection problem/)), 'the Gumroad token leak with Reconnect: ' + at(/connection problem/));
  ok(/A-101/.test(at(/A-101/)) && /Approve/.test(at(/A-101/)) && /Reject/.test(at(/A-101/)), 'approval: Approve and Reject');
  ok(/Review the cover/.test(at(/Review the cover/)) && /Finished: needs your check/.test(at(/Review the cover/)) && /Mark done/.test(at(/Review the cover/)), 'a finished task awaits a check: ' + at(/Review the cover/));
  ok(/2 cloud run requests failed/.test(at(/cloud run request/)) && /monthly limit/.test(at(/cloud run request/)), 'failed cloud run requests with the cloud\'s own reason: ' + at(/cloud run request/));
  ok(/Claude is denied for agent youtube\.marquee/.test(at(/Claude is denied/)) && /Claude is blocked for agent ebooks\.ebooks-head/.test(at(/Claude is blocked/)), 'Claude policy blocks: ' + rows.join(' / ').slice(0, 600));
  const w = at(/Cloud worker: last run/); ok(/Cloud worker: last run 10 d ago/.test(w) && /11 queued tasks wait for the next cloud run|queued tasks? wait/.test(w) && !/offline/i.test(w), 'the worker row says when it last ran, not "offline": ' + w);
  const tones = await s.page.locator('#attn + .alist .arow').evaluateAll((els) => els.map((e) => e.classList.contains('bad') ? 0 : e.classList.contains('warn') ? 1 : 2));
  eq(JSON.stringify(tones), JSON.stringify([...tones].sort()), 'worst first');
  const active = flat(await text(s.page, '.alist:last-of-type'));
  ok(/Write the next Short script/.test(active) && /step 3 of 6/.test(active) && /Job: video-render/.test(active), 'Active work shows the running task with its pipeline step and the running job: ' + active);
  ok(!/Review the cover/.test(active), 'a task that finished and awaits a check is not "active work"');
});

await check('Home: the tiles and rows open the real screens', async () => {
  ok((await s.page.locator('.tiles .tile').nth(0).getAttribute('href')) === '#tasks' && (await s.page.locator('.tiles .tile').nth(2).getAttribute('href')) === '#approvals', 'tile links');
  ok((await s.page.locator('#attn + .alist .arow a').first().getAttribute('href')).startsWith('#'), 'rows are links');
  await s.page.locator('.tiles .tile').nth(1).click(); await settle(s.page, 300);
  eq(await hashOf(s.page), '#tasks'); ok(/Write the next Short script/.test(await text(s.page, '#view')) && !/Queued task 1/.test(await text(s.page, '#view')), 'Running now opens Tasks filtered to running');
  await goHash(s.page, 'home'); await s.page.locator('.tiles .tile').nth(0).click(); await settle(s.page, 300);
  ok(/Queued task 1/.test(await text(s.page, '#view')), 'Open tasks shows the queue');
  await goHash(s.page, 'home'); await s.page.locator('.tiles .tile').nth(2).click(); await settle(s.page, 300); eq(await hashOf(s.page), '#approvals');
  await goHash(s.page, 'home'); await s.page.locator('.qa a', { hasText: 'Remote' }).click(); await settle(s.page, 300); eq(await hashOf(s.page), '#remote');
  await goHash(s.page, 'home'); await s.page.locator('.qa button', { hasText: 'Ask COCO' }).click(); await settle(s.page, 300); ok(await s.page.locator('#askDrawer').isVisible(), 'Ask COCO opens'); await s.page.click('[data-askclose]');
  await goHash(s.page, 'home'); await s.page.locator('.qa a', { hasText: 'New task' }).click(); await settle(s.page, 400);
  eq(await hashOf(s.page), '#tasks'); ok(await s.page.locator('#tkNew').isVisible(), 'New task opens the create form'); await goHash(s.page, 'home');
});

await check('Home: Reconnect starts the real connect flow (POST /api/oauth/begin, then the authorize page is opened)', async () => {
  const before = callsA.length;
  await s.page.locator('#attn + .alist .arow', { hasText: 'connection problem' }).locator('[data-reconnect]').click(); await settle(s.page, 700);
  const b = callsA.slice(before).find((c) => c.m === 'POST' && c.p === '/api/oauth/begin');
  ok(b && b.body.provider === 'gumroad' && b.body.connection_id === 'poppy' && b.body.team === 'ebooks', 'begin: ' + JSON.stringify(b));
  ok(s.dialogs.some((d) => /Connect Demo shop/.test(d)), 'the founder is asked first: ' + s.dialogs.join('|'));
  const opened = await s.page.evaluate(() => window.__opened); ok(opened.length === 1 && /accounts\.example\.test\/authorize\?connection=poppy/.test(opened[0]), 'authorize_url opened: ' + opened);
});

await check('Ask COCO is one tap from every screen and sends through the existing chat path', async () => {
  for (const h of ['home', 'tasks', 'insights', 'house:poppy']) {
    await goHash(s.page, h); await s.page.click('#askBtn'); await settle(s.page, 200);
    ok(await s.page.locator('#askDrawer').isVisible(), 'drawer did not open on ' + h); eq(await s.page.locator('#chatForm').count(), 1, 'exactly one chat form on ' + h);
    await s.page.click('[data-askclose]'); await settle(s.page, 150); ok(!(await s.page.locator('#askDrawer').isVisible()), 'drawer did not close');
  }
  await goHash(s.page, 'home'); await s.page.click('#askBtn'); await s.page.fill('#askBody input[name="q"]', 'status please'); await s.page.press('#askBody input[name="q"]', 'Enter'); await settle(s.page, 700);
  const c = callsA.find((x) => x.p === '/api/chat'); ok(c && c.body && c.body.body === 'status please', 'POST /api/chat: ' + JSON.stringify(c));
  ok(/Mock reply/.test(await text(s.page, '#askBody')), 'the reply is shown in the drawer');
  await s.page.click('#askDrawer a[href="#chat"]'); await settle(s.page, 400);
  ok(!(await s.page.locator('#askDrawer').isVisible()), 'the drawer steps aside on the full Ask COCO page'); eq(await s.page.locator('#chatForm').count(), 1, 'still exactly one chat form'); await goHash(s.page, 'home');
});

await check('Remote Control: the device chip opens it; notifications and search are built from loaded data', async () => {
  await s.page.click('#remoteChip'); await settle(s.page, 400); eq(await hashOf(s.page), '#remote'); ok(/Boss PC|Boss phone/.test(await text(s.page, '#view')), 'Remote shows devices');
  await goHash(s.page, 'home'); await s.page.click('#bellBtn'); await settle(s.page, 150);
  const bell = await text(s.page, '#bellPanel'); ok(/A-101/.test(bell) && /offline/i.test(bell), 'bell lists approvals and the offline device: ' + bell.slice(0, 200)); await s.page.keyboard.press('Escape');
  await s.page.fill('#q', 'failed upload'); await settle(s.page, 150); ok(/Failed upload task/.test(await text(s.page, '#searchResults')), 'search finds a task');
  await s.page.press('#q', 'Enter'); await settle(s.page, 300); ok(/^#tasks:/.test(await hashOf(s.page)), 'search opens the task detail: ' + await hashOf(s.page));
  await goHash(s.page, 'home'); await s.page.fill('#q', 'poppy'); await settle(s.page, 150); ok(/Poppy Ebooks/.test(await text(s.page, '#searchResults')), 'search finds the House'); await s.page.fill('#q', '');
});

await check('every one of the original 20 pages and the new Tasks page is reachable through the navigation (clicks, not hash edits)', async () => {
  const ORIGINAL = ['home', 'control', 'board', 'notes', 'remote', 'approvals', 'company', 'teams', 'agents', 'runs', 'ai', 'brain', 'workflows', 'system', 'chat', 'connections', 'club', 'rules', 'devices', 'settings', 'tasks'];
  for (const id of ORIGINAL) {
    await goHash(s.page, 'home'); await settle(s.page, 120);
    if (id === 'remote') await s.page.click('#remoteChip');
    else if (id === 'chat') { await s.page.click('#askBtn'); await s.page.click('#askDrawer a[href="#chat"]'); }
    else {
      const sec = NAV.sections.find((x) => x.pages.some((p) => p.id === id));
      await s.page.locator('#nav a:not(.hl)', { hasText: sec.label }).first().click(); await settle(s.page, 150);
      if (sec.pages[0].id !== id) await s.page.locator('#subnav a', { hasText: new RegExp('^' + sec.pages.find((p) => p.id === id).label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') + '$') }).click();
    }
    await settle(s.page, 350); eq(await hashOf(s.page), '#' + id, 'navigating to ' + id);
    const view = await text(s.page, '#view'); ok(view.trim().length > 0, id + ' rendered nothing'); noLeak(view, id);
  }
  await goHash(s.page, 'home');
});

await check('the routes render without leaking undefined: houses, hierarchy, insights, structure, automation, cloud', async () => {
  for (const id of ['houses', 'hierarchy', 'insights', 'structure', 'automation', 'cloud']) { await goHash(s.page, id); await settle(s.page, 500); const v = await text(s.page, '#view'); ok(v.trim().length > 20, id + ' is empty'); noLeak(v, id); }
});

await check('Task board (the old Board route) shows the same tasks in columns, each card opens its detail', async () => {
  await goHash(s.page, 'board'); await settle(s.page, 300);
  const cols = (await s.page.locator('.kcol h4').allInnerTexts()).map(flat); eq(cols.join('|'), 'Planned 1|Queued 10|Running 1|Paused 1|Needs you 1|Failed 1|Done 1|Stopped 4');
  await s.page.locator('.kcard', { hasText: 'Failed upload task' }).click(); await settle(s.page, 300); ok(/^#tasks:/.test(await hashOf(s.page)), 'card opens the task');
});

await check('Structure and Hierarchy work on the original tables: the live company tree with its builder, and every House with its registered teams (no org_* table)', async () => {
  await goHash(s.page, 'structure'); await settle(s.page, 500); const st = flat(await text(s.page, '#view'));
  ok(!/No company structure yet/i.test(st) && /Add to the company/i.test(st) && /The company as it stands/i.test(st) && /Demo skills/.test(st) && /Demo team/.test(st), 'Structure: ' + st.slice(0, 300));
  ok(await s.page.locator('#newStruct').count() === 1 && (await s.page.locator('#newStruct select[name="p_team"] option').count()) > 3, 'the builder offers the real teams to put things under');
  await goHash(s.page, 'hierarchy'); await settle(s.page, 600); const hr = flat(await text(s.page, '#view'));
  ok(/The company as it is registered/.test(hr) && /nothing here is estimated/.test(hr), 'Hierarchy says what it shows: ' + hr.slice(0, 200)); eq(await s.page.locator('.btree').count(), 7, 'seven Houses');
  await s.page.locator('.btree summary').nth(2).click(); await settle(s.page, 200); ok(/Poppy Ebooks/.test(await text(s.page, '.btree[open]')) && /teams ·/.test(await text(s.page, '.btree[open]')), 'a House opens its registered tree'); noLeak(hr, 'Hierarchy');
});

// ---------------------------------------------------------------- Tasks
await check('Tasks: the real list with filters Open / Running / Failed / Done / Stopped, search and a House filter', async () => {
  await goHash(s.page, 'tasks'); await settle(s.page, 300);
  eq((await s.page.locator('.fchips button').allInnerTexts()).map(flat).join('|'), 'Open 14|Running 1|Failed 1|Done 1|Stopped 4');
  eq(await s.page.locator('#tk-list .card2 > .row').count(), 14, 'open rows');
  const queued = flat(await text(s.page, '#tk-list .card2')); ok(/Not asked to run yet: press Start to ask the cloud for a run \(the cloud last ran 10 d ago\)/.test(queued), 'a queued task nobody asked a run for says so, instead of pretending to progress: ' + queued.slice(0, 400));
  ok(/Gigi Social · Make One · Daily Short · step 3 of 6/.test(queued), 'assignee and pipeline step on the row'); ok(/Lulu Software · Unassigned/.test(queued), 'House and assignee on the row'); ok(/Needs a check|Finished: needs a check/.test(queued), 'the finished task is marked as needing a check');
  await click(s.page, '.fchips button:has-text("Failed")', 250); eq(await s.page.locator('#tk-list .card2 > .row').count(), 1); const fr = await text(s.page, '#tk-list .card2'); ok(/Failed upload task/.test(fr) && /quota exceeded/.test(fr), 'failed row shows its error'); ok(/The cloud run failed \(request #2\): this month would pass the agent monthly limit/.test(fr), 'and the cloud\'s reason for the run request: ' + fr);
  await click(s.page, '.fchips button:has-text("Done")', 250); ok(/Fix the install bug/.test(await text(s.page, '#tk-list .card2')), 'done'); await click(s.page, '.fchips button:has-text("Stopped")', 250); eq(await s.page.locator('#tk-list .card2 > .row').count(), 4);
  await click(s.page, '.fchips button:has-text("Open")', 250);
  await s.page.fill('#tkq', 'queued task 3'); await settle(s.page, 250); eq(await s.page.locator('#tk-list .card2 > .row').count(), 1, 'search narrows'); await s.page.fill('#tkq', ''); await settle(s.page, 200);
  await s.page.selectOption('#tkhouse', 'gigi'); await settle(s.page, 250); eq(await s.page.locator('#tk-list .card2 > .row').count(), 3, 'House filter: the running task and 2 queued'); await s.page.selectOption('#tkhouse', 'all');
  const worker = await text(s.page, '.banner'); ok(/Cloud worker: last run 10 d ago/.test(worker) && /runs on a schedule/.test(worker) && /nothing here is running right now/.test(worker) && !/offline/i.test(worker), 'worker status is honest and uses its schedule: ' + worker);
});

await check('Tasks: the detail shows details, assignee, pipeline, claim, notes, outputs, related jobs, error and result', async () => {
  await goHash(s.page, 'tasks:' + TID.running); await settle(s.page, 350);
  const t = flat(await text(s.page, '#tk-detail'));
  for (const w of ['Write the next Short script', 'Gigi Social', 'Running', 'Make One', 'Daily Short', 'step 3 of 6', 'Boss PC', 'Use the house style.', 'Draft script', 'video-render', 'upload']) ok(t.includes(w), 'detail misses "' + w + '": ' + t.slice(0, 300));
  await goHash(s.page, 'tasks:' + TID.failed); await settle(s.page, 300);
  const f = flat(await text(s.page, '#tk-detail')); ok(/Upload failed: quota exceeded/.test(f) && /Retried 1 time/.test(f) && /The cloud run failed \(request #2\)/.test(f) && /Cloud runs \(1\)/.test(f), 'failed detail with the cloud\'s reason: ' + f.slice(0, 400));
  await goHash(s.page, 'tasks:' + TID.done); await settle(s.page, 300);
  const d = flat(await text(s.page, '#tk-detail')); ok(/Fixed and released/.test(d) && /build 123/.test(d), 'result and evidence'); eq(await s.page.locator('#tk-detail [data-tk]').count(), 0, 'a done task offers no state change');
  await goHash(s.page, 'tasks:no-such-task'); await settle(s.page, 250); ok(/Task not found/.test(await text(s.page, '#view')), 'unknown task says so');
});

await check('Tasks: the Jobs tab lists the queue with Cancel and Retry', async () => {
  await goHash(s.page, 'tasks'); await click(s.page, '[data-tktab="jobs"]', 300);
  const open = flat(await text(s.page, '#tk-jobs')); ok(/video-render/.test(open) && /publish/.test(open) && /no handler for job type publish/.test(open), 'open jobs with their error: ' + open.slice(0, 300)); ok(/Cloud run requests \(2\)/.test(open) && /#2 · youtube-pick/.test(open) && /monthly limit/.test(open) && /#1 · ebooks-pick/.test(open) && /credit balance is too low/.test(open), 'the cloud run requests with their reasons: ' + open.slice(-500));
  await click(s.page, '[data-jf="failed"]', 250); ok(/upload quota exceeded/.test(await text(s.page, '#tk-jobs')), 'failed jobs'); await click(s.page, '[data-jf="done"]', 250); eq(await s.page.locator('#tk-jobs .jobrow').count(), 8, 'done jobs');
});
const errorsA = s.errors.slice(); await check('no script error on any page of scenario A', async () => { eq(errorsA.length, 0, errorsA.join(' | ')); });
await s.ctx.close();

// ================================================================ scenario T: every task action writes exactly what the state machine says (own data: the checks change it)
const T = fixture({ rpcDeny: ['coco_run_request_cancel', 'coco_task_enqueue'] });   // Nova before those two functions exist
s = await open(T, {});
const callsT = s.calls, tasksT = () => T.tables.tasks;
const taskPatches = (id) => writes(callsT, 'PATCH', '/rest/v1/tasks').filter((c) => q(c).includes('id=eq.' + id));

await check('Tasks: Create (title, details, House, category, assignee, priority, pipeline) goes through submit_task with the team line, then saves the rest on the task', async () => {
  await goHash(s.page, 'tasks'); await click(s.page, '[data-tkn="1"]', 300);
  await s.page.fill('#tkTitle', '[COCO TEST] Make a Short about tides'); await s.page.fill('#tkDetails', 'Keep it under 40 seconds.');
  await s.page.selectOption('#tkHouse', 'gigi'); await s.page.selectOption('#tkCat', { label: 'Gigi category 3' }); await s.page.selectOption('#tkMember', 'm-make-1'); await s.page.selectOption('#tkPrio', '1'); await s.page.selectOption('#tkPipe', 'gigi-daily-short');
  eq(await s.page.inputValue('#tkNeeds'), 'cloud', 'cloud is the default: the intake only takes cloud tasks'); eq(await s.page.inputValue('#tkAfter'), 'queued', 'creating never asks the cloud for a run by itself');
  await s.page.selectOption('#tkAfter', 'planned'); await s.page.click('#tkNew button[type="submit"]'); await settle(s.page, 900);
  const r = writes(callsT, 'POST', '/rest/v1/rpc/submit_task').pop(); ok(r && r.body.p_title === '[COCO TEST] Make a Short about tides' && r.body.p_house === 'gigi' && r.body.p_needs === 'cloud' && r.body.p_details === 'Team: youtube\nKeep it under 40 seconds.' && r.body.p_by === 'Boss' && r.body.p_device === 'boss-pc', 'submit_task: ' + JSON.stringify(r && r.body));
  const made = tasksT().find((t) => t.title.startsWith('[COCO TEST]')); ok(made, 'the task exists');
  const p = taskPatches(made.id).pop(); ok(p && p.body.priority === 1 && p.body.member_id === 'm-make-1' && p.body.category === 'Gigi category 3' && p.body.pipeline_id === 'gigi-daily-short' && p.body.status === 'planned', 'follow-up PATCH: ' + JSON.stringify(p && p.body));
  ok(/^#tasks:/.test(await hashOf(s.page)), 'the new task opens'); const t = flat(await text(s.page, '#tk-detail')); ok(/Planned/.test(t) && /High priority/.test(t) && /Make One/.test(t) && /team youtube/.test(t), 'detail of the new task: ' + t.slice(0, 260));
  s.made = made.id;
});
await check('Tasks: Start asks the cloud for a run (coco_request_run for the House team workflow), then the task waits for the next cloud run and is never called running', async () => {
  await click(s.page, '[data-tk="start"]', 1000);
  const r = writes(callsT, 'POST', '/rest/v1/rpc/coco_request_run').pop(); ok(r && r.body.p_workflow === 'youtube-pick' && r.body.p_note === 'coco-task:' + s.made + ' \u00b7 [COCO TEST] Make a Short about tides', 'RPC: ' + JSON.stringify(r && r.body));
  const p = taskPatches(s.made).pop(); const req = T.tables.run_requests.find((x) => x.note && x.note.startsWith('coco-task:' + s.made));
  ok(req && req.state === 'pending', 'a pending run request exists'); ok(p.body.status === 'queued' && p.body.result === 'Waiting for the next cloud run (request #' + req.id + ')' && /status=in\.\(planned,queued\)/.test(q(p)), 'Start PATCH is guarded and notes the request: ' + q(p) + ' ' + JSON.stringify(p.body));
  ok(!taskPatches(s.made).some((c) => c.body.status === 'running' || c.body.status === 'working'), 'the screen never sets running');
  const head = flat(await text(s.page, '#tk-detail .tkhead')); ok(/Queued/.test(head) && /Waiting for the next cloud run \(request #\d+\) \(the cloud last ran 10 d ago\)/.test(head) && !/Running/.test(head), 'queued and waiting for the next cloud run: ' + head);
  eq(await s.page.locator('#tk-detail [data-tk="start"]').count(), 0, 'it cannot be started twice'); ok(/Cloud runs \(1\)/.test(await text(s.page, '#tk-detail')) && /Waiting for the next cloud run \(request #/.test(await text(s.page, '#tk-detail')), 'the Cloud runs card shows the request');
  ok(/Asked the cloud to run it \(request #\d+\)/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page));
});
await check('Tasks: when the cloud refuses the run (company stopped, workflow off, already waiting) its reason is shown and nothing changes', async () => {
  T.requestRefusal = 'the company is stopped (Coco); lift the emergency stop first';
  await goHash(s.page, 'tasks:' + TID.planned); await settle(s.page, 300); const before = taskPatches(TID.planned).length; await click(s.page, '[data-tk="start"]', 900);
  ok(/Not started: the company is stopped \(Coco\); lift the emergency stop first/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page)); eq(taskPatches(TID.planned).length, before, 'the task was not touched'); eq(T.tables.tasks.find((x) => x.id === TID.planned).status, 'planned');
  T.requestRefusal = null;
  await goHash(s.page, 'tasks:00000001-0000-4000-8000-000000000008'); await settle(s.page, 400);
  const noHouse = flat(await text(s.page, '#tk-detail')); ok(/Cloud runs \(0\)/.test(noHouse) && /Give the task a House so the cloud knows which team should do it/.test(noHouse), 'a task without a House has no cloud run and says why'); await click(s.page, '[data-tk="start"]', 700);
  ok(/Choose a House for this task first/.test(await toastOf(s.page)), 'no House means no team: ' + await toastOf(s.page));
});
await check('Tasks: a finished task awaiting a check can be marked done (the database insists on a result); a PC-only task starts without asking the cloud', async () => {
  await goHash(s.page, 'tasks:' + TID.verifying); await settle(s.page, 300);
  const v = flat(await text(s.page, '#tk-detail .tkhead')); ok(/Finished: needs a check/.test(v) && !/Running/.test(v), 'verifying is not running: ' + v);
  await click(s.page, '[data-tk="done"]', 900); const p = taskPatches(TID.verifying).pop(); ok(p.body.status === 'done' && /status=in\.\(verifying\)/.test(q(p)), 'Mark done is guarded on verifying: ' + q(p) + JSON.stringify(p.body)); ok(/Done/.test(await text(s.page, '#tk-detail .tkhead')), 'done');
  await goHash(s.page, 'tasks'); await click(s.page, '[data-tkn="1"]', 300); await s.page.fill('#tkTitle', '[COCO TEST] Render on the PC'); await s.page.selectOption('#tkNeeds', 'pc'); await s.page.selectOption('#tkAfter', 'planned'); await click(s.page, '#tkNew button[type="submit"]', 900);
  const pcTask = tasksT().find((t) => t.title === '[COCO TEST] Render on the PC'); ok(pcTask && pcTask.needs === 'pc' && pcTask.status === 'planned', 'a planned PC task exists');
  const n0 = writes(callsT, 'POST', '/rest/v1/rpc/coco_request_run').length; await click(s.page, '[data-tk="start"]', 900); eq(writes(callsT, 'POST', '/rest/v1/rpc/coco_request_run').length, n0, 'no cloud run is requested for a PC task'); eq(pcTask.status, 'queued', 'it is queued for a PC to claim'); eq(await s.page.locator('#tk-detail [data-tk="start"]').count(), 0, 'a queued PC task has nothing to start');
});
await check('Tasks: Pause, Resume, priority, Assign and Add note each write one guarded change', async () => {
  await goHash(s.page, 'tasks:' + s.made); await settle(s.page, 300); await click(s.page, '[data-tk="pause"]', 800); let p = taskPatches(s.made).pop();
  ok(p.body.status === 'paused' && /status=in\.\(queued,running,working,waiting_pc\)/.test(q(p)), 'Pause: ' + q(p)); ok(/Paused/.test(await text(s.page, '#tk-detail .tkhead')), 'now paused');
  await click(s.page, '[data-tk="resume"]', 800); p = taskPatches(s.made).pop();
  ok(p.body.status === 'queued' && p.body.claimed_by_device === null && p.body.claimed_at === null && p.body.heartbeat_at === null && p.body.stale === false && /status=in\.\(paused\)/.test(q(p)), 'Resume frees the claim so a worker can take it: ' + JSON.stringify(p.body));
  await s.page.selectOption('[data-tkprio]', '3'); await settle(s.page, 800); p = taskPatches(s.made).pop(); ok(p.body.priority === 3, 'priority: ' + JSON.stringify(p.body)); ok(/Low priority/.test(await text(s.page, '#tk-detail .tkhead')), 'priority chip');
  await s.page.selectOption('[data-opform="tk-assign"] select[name="member_id"]', 'm-care-2'); await s.page.selectOption('[data-opform="tk-assign"] select[name="house_id"]', 'poppy'); await s.page.selectOption('[data-opform="tk-assign"] select[name="pipeline_id"]', ''); await click(s.page, '[data-opform="tk-assign"] button[type="submit"]', 800);
  p = taskPatches(s.made).pop(); ok(p.body.member_id === 'm-care-2' && p.body.house_id === 'poppy' && p.body.pipeline_id === null && p.body.step === null, 'Assign: ' + JSON.stringify(p.body)); ok(/Care Two/.test(await text(s.page, '#tk-detail')) && /Poppy Ebooks/.test(await text(s.page, '#tk-detail .tkhead')), 'assignee and House shown');
  await s.page.fill('[data-opform="tk-note"] textarea', 'Check the thumbnail too.'); await click(s.page, '[data-opform="tk-note"] button[type="submit"]', 800);
  const n = writes(callsT, 'POST', '/rest/v1/task_notes').pop(); ok(n && n.body.task_id === s.made && n.body.note === 'Check the thumbnail too.' && n.body.by_email === 'Boss' && n.body.device_id === 'boss-pc', 'note insert: ' + JSON.stringify(n && n.body)); ok(/Check the thumbnail too\./.test(await text(s.page, '#tk-detail')), 'the note is shown');
});
await check('Tasks: Retry puts a failed task back in the queue (retry_count + 1, claim freed) and keeps the old error as a note; Cancel stops it', async () => {
  await goHash(s.page, 'tasks:' + TID.failed); await settle(s.page, 300);
  await click(s.page, '[data-tk="retry"]', 900); const p = taskPatches(TID.failed).pop();
  ok(p.body.status === 'queued' && p.body.retry_count === 2 && p.body.error === null && p.body.claimed_by_device === null && /status=in\.\(failed\)/.test(q(p)), 'Retry: ' + JSON.stringify(p.body) + ' ' + q(p));
  const n = writes(callsT, 'POST', '/rest/v1/task_notes').find((c) => c.body.task_id === TID.failed); ok(n && /Retry 2\. Previous error: Upload failed/.test(n.body.note), 'the old error is kept as a note: ' + JSON.stringify(n && n.body));
  ok(/Queued/.test(await text(s.page, '#tk-detail .tkhead')), 'queued again'); eq(await s.page.locator('#tk-detail .errbox').count(), 0, 'the error box is gone once it is queued again');
  await click(s.page, '[data-tk="cancel"]', 900); const c = taskPatches(TID.failed).pop(); ok(c.body.status === 'stopped' && /status=in\.\(planned,queued,running,working,verifying,need_approval,needs_yes,waiting_pc,blocked,paused,failed\)/.test(q(c)), 'Cancel: ' + q(c));
  ok(/Stopped/.test(await text(s.page, '#tk-detail .tkhead')), 'stopped'); eq(await s.page.locator('#tk-detail [data-tk]').count(), 0, 'a stopped task offers no further change');
});
await check('Tasks: Cancel on a task with a waiting cloud run says plainly when the request cannot be withdrawn yet (the RPC is not there), and never claims it was', async () => {
  await goHash(s.page, 'tasks:' + s.made); await settle(s.page, 300); await click(s.page, '[data-tk="cancel"]', 1000);
  const p = taskPatches(s.made).pop(); ok(p.body.status === 'stopped', 'stopped'); const req = T.tables.run_requests.find((x) => x.note && x.note.startsWith('coco-task:' + s.made));
  ok(new RegExp('cannot be withdrawn yet, so it may still run at the next cloud run').test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page)); eq(req.state, 'pending', 'the request is still pending: nothing pretended to cancel it');
  ok(!writes(callsT, 'POST', '/rest/v1/rpc/coco_run_request_cancel').some((c) => c.body.p_id !== req.id), 'the withdrawal was attempted for exactly that request');
});
await check('Tasks: a task that another device already changed is not overwritten, and the founder is told', async () => {
  await goHash(s.page, 'tasks:' + TID.paused); await settle(s.page, 300);
  T.tables.tasks.find((t) => t.id === TID.paused).status = 'done';     // another device finished it a moment ago; this screen still shows it paused
  const before = taskPatches(TID.paused).length; await click(s.page, '[data-tk="resume"]', 900);
  ok(/changed on another device first, so nothing was changed/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page));
  eq(T.tables.tasks.find((t) => t.id === TID.paused).status, 'done', 'the other device\'s result stands'); ok(taskPatches(TID.paused).length === before + 1, 'one guarded attempt was made');
});
await check('Tasks: creating work that already exists merges into it and says so (nothing runs twice)', async () => {
  await goHash(s.page, 'tasks'); await click(s.page, '[data-tkn="1"]', 300);
  await s.page.fill('#tkTitle', 'queued task 7'); await s.page.selectOption('#tkHouse', ''); await click(s.page, '#tkNew button[type="submit"]', 900);
  ok(/already queued/.test(await toastOf(s.page)) && /Queued task 7/.test(await toastOf(s.page)), 'merge is said: ' + await toastOf(s.page));
  ok(/^#tasks:/.test(await hashOf(s.page)) && /Queued task 7/.test(await text(s.page, '#tk-detail')), 'the existing task opens'); eq(tasksT().filter((t) => /queued task 7/i.test(t.title)).length, 1, 'no duplicate task');
});
await check('Tasks: "Run as a cloud job" tries coco_task_enqueue and, when Nova answers 404 (the function is not there yet), says so and hides itself', async () => {
  await goHash(s.page, 'tasks:' + TID.queued); await settle(s.page, 300);
  ok(await s.page.locator('[data-opform="tk-enqueue"]').count() === 1, 'offered on an open task with a team');
  await s.page.selectOption('[data-opform="tk-enqueue"] select[name="type"]', 'validate-output'); await click(s.page, '[data-opform="tk-enqueue"] button[type="submit"]', 800);
  const c = writes(callsT, 'POST', '/rest/v1/rpc/coco_task_enqueue').pop(); ok(c && c.body.p_task === TID.queued && c.body.p_job_type === 'validate-output' && c.body.p_team === 'software' && JSON.stringify(c.body.p_payload) === '{}', 'call: ' + JSON.stringify(c && c.body));
  ok(/Not available yet: no such function coco_task_enqueue/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page)); eq(await s.page.locator('[data-opform="tk-enqueue"]').count(), 0, 'the action hides itself');
});
await check('Home: Retry on a failed job acts from the Needs-attention list through coco_job_retry (one argument, the job id)', async () => {
  await goHash(s.page, 'home'); await settle(s.page, 300);
  const row = s.page.locator('#attn + .alist .arow', { hasText: 'Job upload failed' }); await row.locator('[data-job="retry"]').click(); await settle(s.page, 900);
  const r = writes(callsT, 'POST', '/rest/v1/rpc/coco_job_retry').pop(); ok(r && JSON.stringify(r.body) === JSON.stringify({ p_id: 'JOB-F1' }), 'RPC: ' + JSON.stringify(r && r.body)); eq(T.tables.jobs.find((j) => j.id === 'JOB-F1').status, 'queued'); ok(/back in the queue/.test(await toastOf(s.page)), 'toast');
  eq(await s.page.locator('#attn + .alist .arow', { hasText: 'Job upload failed' }).count(), 0, 'it left the list');
});
await check('Jobs: Cancel goes through coco_job_cancel; a cancelled job can be retried; a blocked one only cancelled', async () => {
  await goHash(s.page, 'tasks'); await click(s.page, '[data-tktab="jobs"]', 300);
  const blocked = s.page.locator('#tk-jobs .jobrow', { hasText: 'publish' }); eq(await blocked.locator('[data-job="retry"]').count(), 0, 'no Retry on a blocked job');
  await blocked.locator('[data-job="cancel"]').click(); await settle(s.page, 900);
  const r = writes(callsT, 'POST', '/rest/v1/rpc/coco_job_cancel').pop(); ok(r && r.body.p_id === 'JOB-B1' && r.body.p_by === 'Boss' && /Cancelled from the app/.test(r.body.p_reason), 'RPC: ' + JSON.stringify(r && r.body));
  eq(T.tables.jobs.find((j) => j.id === 'JOB-B1').status, 'cancelled'); ok(/Job cancelled/.test(await toastOf(s.page)), 'toast');
  await click(s.page, '[data-jf="all"]', 250); const again = s.page.locator('#tk-jobs .jobrow', { hasText: 'publish' }); eq(await again.locator('[data-job="cancel"]').count(), 0, 'a cancelled job cannot be cancelled again'); eq(await again.locator('[data-job="retry"]').count(), 1, 'but it can be retried');
  await again.locator('[data-job="retry"]').click(); await settle(s.page, 900); eq(T.tables.jobs.find((j) => j.id === 'JOB-B1').status, 'queued', 'retried');
});
const errorsT = s.errors.slice(); await check('no script error while changing tasks', async () => { eq(errorsT.length, 0, errorsT.join(' | ')); });
await s.ctx.close();

// ---------------------------------------------------------------- job retry when Nova serves coco_job_retry
{
  const R = fixture({ rpcDeny: ['coco_job_retry'] });     // a Nova that does not serve the function yet
  s = await open(R, {});
  await check('Jobs: on a Nova without coco_job_retry, Retry says "Not available yet" and changes nothing (never a fake success)', async () => {
    await goHash(s.page, 'tasks'); await click(s.page, '[data-tktab="jobs"]', 300); await click(s.page, '[data-jf="failed"]', 250);
    await s.page.locator('#tk-jobs .jobrow').locator('[data-job="retry"]').click(); await settle(s.page, 800);
    ok(/Not available yet: no such function coco_job_retry/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page)); eq(R.tables.jobs.find((j) => j.id === 'JOB-F1').status, 'failed', 'nothing changed');
  });
  await s.ctx.close();
}

{
  const E = fixture({ rpcAllow: ['coco_run_request_cancel', 'coco_task_enqueue'] });   // Nova with the two proposed functions
  s = await open(E, {});
  await check('Tasks: Cancel withdraws the waiting cloud run request when Nova has coco_run_request_cancel', async () => {
    const id = '00000001-0000-4000-8000-000000000005';   // Queued task 5, in Gigi
    await goHash(s.page, 'tasks:' + id); await settle(s.page, 300); await click(s.page, '[data-tk="start"]', 1000);
    const req = E.tables.run_requests.find((x) => x.note && x.note.startsWith('coco-task:' + id)); ok(req && req.state === 'pending' && req.workflow_id === 'youtube-pick', 'requested');
    await click(s.page, '[data-tk="cancel"]', 1000); const c = writes(s.calls, 'POST', '/rest/v1/rpc/coco_run_request_cancel').pop(); ok(c && c.body.p_id === req.id, 'withdraw call: ' + JSON.stringify(c && c.body)); eq(req.state, 'cancelled'); ok(/was withdrawn/.test(await toastOf(s.page)), 'toast: ' + await toastOf(s.page));
  });
  await check('Tasks: "Run as a cloud job" queues one zero-AI job through coco_task_enqueue and shows it under the task', async () => {
    const id = '00000001-0000-4000-8000-000000000001'; await goHash(s.page, 'tasks:' + id); await settle(s.page, 300);
    await s.page.fill('[data-opform="tk-enqueue"] input[name="payload"]', '{bad'); await click(s.page, '[data-opform="tk-enqueue"] button[type="submit"]', 400); ok(/valid JSON/.test(await toastOf(s.page)), 'bad JSON refused');
    await s.page.fill('[data-opform="tk-enqueue"] input[name="payload"]', '{"k":1}'); await s.page.selectOption('[data-opform="tk-enqueue"] select[name="type"]', 'title-analytics'); await click(s.page, '[data-opform="tk-enqueue"] button[type="submit"]', 1000);
    const c = writes(s.calls, 'POST', '/rest/v1/rpc/coco_task_enqueue').pop(); ok(c && c.body.p_task === id && c.body.p_job_type === 'title-analytics' && c.body.p_team === 'software' && c.body.p_payload.k === 1, 'call: ' + JSON.stringify(c && c.body));
    const d = flat(await text(s.page, '#tk-detail')); ok(/Related jobs \(1\)/.test(d) && /title-analytics/.test(d), 'the job is listed under the task: ' + d.slice(-300)); ok(/Waiting for a worker: cloud job/.test(d), 'the task says what it waits for: ' + d.slice(0, 300));
  });
  await s.ctx.close();
}
{
  s = await open(fixture({ workerOnline: true }), {});
  await check('Worker: a cloud worker that checked in within its schedule is "active", with no alert, and counts as online', async () => {
    ok(/Cloud worker active/.test(flat(await text(s.page, '.qa'))), 'pill: ' + flat(await text(s.page, '.qa'))); eq(await s.page.locator('#attn + .alist .arow', { hasText: 'Cloud worker' }).count(), 0, 'no alert');
    eq(flat(await text(s.page, '#remoteChip')), 'Remote · 3/4 online', 'the device chip counts it');
    await goHash(s.page, 'tasks'); await settle(s.page, 300); ok(/Cloud worker active · last run/.test(flat(await text(s.page, '.wline'))), 'line: ' + flat(await text(s.page, '#view')).slice(0, 200));
  });
  await s.ctx.close();
}

// ================================================================ approvals (own data: the checks decide approvals of the stand-in)
const P = fixture({});
s = await open(P, {});
const callsP = s.calls;
await check('Approvals: the list opens a detail with code, team, what, files, the action, requested by/at and the run', async () => {
  await goHash(s.page, 'approvals'); await settle(s.page, 300);
  eq(await s.page.locator('.sech .count').first().innerText(), '2', 'two waiting'); ok(/On hold/.test(await text(s.page, '#view')), 'the parked one is listed');
  await s.page.locator('.row a', { hasText: 'A-101' }).click(); await settle(s.page, 300); eq(await hashOf(s.page), '#approvals:' + AID.waiting1);
  const d = flat(await text(s.page, '#ap-detail'));
  for (const w of ['A-101', 'Waiting for YES', 'Publish the weekly Short', 'team YouTube', 'Gigi Social', 'short-007.mp4', 'Type publish', 'Channel yt-a', 'Title Weekly Short', 'Private false', 'cloud-worker-1', 'Open run RUN-1', AID.waiting1]) ok(d.includes(w), 'detail misses "' + w + '": ' + d);
  ok(await s.page.locator('#ap-detail [data-yes]').count() === 1 && await s.page.locator('#ap-detail [data-no]').count() === 1, 'Approve and Reject');
});
await check('Approvals: Approve writes the guarded decision, the decision record and the audit line; the detail then shows who decided', async () => {
  await click(s.page, '#ap-detail [data-yes]', 1000);
  const w = writes(callsP, 'PATCH', '/rest/v1/approvals').pop(); ok(w && w.body.state === 'approved' && w.body.decided_by === 'Boss' && !!w.body.decided_at && q(w).includes('id=eq.' + AID.waiting1) && /state=in\.\(waiting,on-hold\)/.test(q(w)), 'guarded PATCH: ' + q(w) + ' ' + JSON.stringify(w && w.body));
  const d = writes(callsP, 'POST', '/rest/v1/decisions').pop(); ok(d && /^YES A-101/.test(d.body.text) && d.body.by_name === 'Boss', 'decision: ' + JSON.stringify(d && d.body)); ok(writes(callsP, 'POST', '/rest/v1/activity').some((c) => c.body.action === 'approved' && c.body.detail === 'A-101'), 'activity line');
  const t = flat(await text(s.page, '#ap-detail')); ok(/Approved/.test(t) && /Decided by Boss/i.test(t), 'decided: ' + t.slice(0, 400)); eq(await s.page.locator('#ap-detail [data-yes]').count(), 0, 'no buttons once decided');
});
await check('Approvals: Reject writes rejected; a request someone else already decided is not overwritten', async () => {
  await goHash(s.page, 'approvals:' + AID.waiting2); await settle(s.page, 300); await click(s.page, '#ap-detail [data-no]', 1000);
  const w = writes(callsP, 'PATCH', '/rest/v1/approvals').pop(); ok(w.body.state === 'rejected' && q(w).includes('id=eq.' + AID.waiting2), 'reject: ' + JSON.stringify(w.body)); ok(/Rejected|No/.test(await text(s.page, '#ap-detail')), 'rejected shown');
  P.tables.approvals.push({ ...P.tables.approvals[0], id: 'aaaaaaaa-0000-4000-8000-000000000009', code: 'A-777', state: 'waiting', decided_by: null, decided_at: null });
  await goHash(s.page, 'approvals'); await settle(s.page, 400); await s.page.evaluate(() => loadAll()); await settle(s.page, 800);
  P.tables.approvals.find((a) => a.code === 'A-777').state = 'approved'; P.tables.approvals.find((a) => a.code === 'A-777').decided_by = 'Big Boss';   // decided on another device meanwhile
  await s.page.locator('.row', { hasText: 'A-777' }).locator('[data-no]').click(); await settle(s.page, 900);
  ok(/A-777 was already approved by Big Boss|already/.test(await toastOf(s.page)), 'told who got there first: ' + await toastOf(s.page)); eq(P.tables.approvals.find((a) => a.code === 'A-777').state, 'approved', 'the earlier decision stands');
});
await check('Approvals: Home "Waiting for YES" opens the detail of a request; decided ones show no buttons', async () => {
  await goHash(s.page, 'approvals:' + AID.approved); await settle(s.page, 300); const t = flat(await text(s.page, '#ap-detail')); ok(/A-099/.test(t) && /Decision/.test(t) && /Boss/.test(t) && /executed/.test(t), 'decided detail: ' + t.slice(0, 200)); eq(await s.page.locator('#ap-detail [data-yes]').count(), 0);
  await goHash(s.page, 'home'); await settle(s.page, 300); const a = await s.page.locator('#attn + .alist .arow a', { hasText: 'A-101' }).count(); eq(a, 0, 'A-101 was decided, so it left the list');
});
await s.ctx.close();

// ================================================================ the seven Houses on the original tables (no org_* table exists)
const HS = fixture({});
s = await open(HS, {});
const callsH = s.calls;
await check('All Houses: seven cards from the houses table with real counts (non-zero teams, categories, channels, agents), and never "Structure not loaded"', async () => {
  await goHash(s.page, 'houses'); await settle(s.page, 500);
  eq(await s.page.locator('.housecard').count(), 7); const t = await text(s.page, '#view'); ok(!/Structure not loaded|not loaded/i.test(t), 'a structure-not-loaded message appeared'); noLeak(t, 'Houses');
  const num = (card, label) => Number((flat(card).match(new RegExp('(\\d+) ' + label)) || [])[1]);
  for (let i = 0; i < 7; i++) {
    const card = await s.page.locator('.housecard').nth(i).innerText(); ok(num(card, 'teams') > 0, NAV.houses[i].id + ' has teams: ' + flat(card)); ok(num(card, 'categories') > 0, NAV.houses[i].id + ' has categories'); ok(num(card, 'agents') > 0, NAV.houses[i].id + ' has agents');
  }
  const gigi = await s.page.locator('.housecard').nth(0).innerText(); ok(num(gigi, 'channels and products') >= 15, 'Gigi has its 15 channels plus the snapshot ones: ' + flat(gigi)); ok(/Working on social/.test(gigi), 'the state line comes from the houses table');
  const poppy = await s.page.locator('.housecard').nth(2).innerText(); ok(/Blocked: Waiting for a cover review/.test(poppy), 'blocked reason from the houses table');
  ok(/Later|Next/.test(await s.page.locator('.housecard').nth(6).innerText()), 'later Houses say so');
});
await check('all seven House workspaces open with the same twenty tabs; every tab of Gigi renders; no tab is a dead end', async () => {
  for (const h of NAV.houses) {
    await s.page.locator(`#nav a[href="#house:${h.id}"]`).click(); await settle(s.page, 300);
    eq(await s.page.locator('.htabs button').count(), 20, h.id + ' tabs'); ok((await text(s.page, '.househead h2')).includes(h.label), 'House title');
    const tabs = h.id === 'gigi' ? NAV.house_tabs.map((x) => x[0]) : ['overview', 'organization', 'teams', 'categories', 'channels', 'agents', 'automation', 'connections', 'analytics', 'revenue'];
    for (const k of tabs) { await s.page.click(`.htabs [data-htab="${k}"]`); await settle(s.page, 180); const body = await text(s.page, '.hbody'); ok(body.trim().length > 10, `${h.id}/${k} rendered nothing`); noLeak(body, `${h.id}/${k}`); ok(!/Structure not loaded|not loaded/i.test(body), `${h.id}/${k} says something is not loaded`); }
  }
  await s.page.click('.htabs [data-htab="overview"]');
});
await check('House data is its own: Overview from the houses row, Categories and Channels from the tables, Agents from member_houses, Automation from pipelines', async () => {
  await goHash(s.page, 'house:gigi'); await s.page.click('.htabs [data-htab="overview"]'); await settle(s.page, 250);
  const o = flat(await text(s.page, '.hbody')); ok(/State Working/i.test(o) && /Rhythm daily/i.test(o) && /Publishing rule Founder YES before anything public/i.test(o) && /Doing now Working on social/i.test(o) && /Recently Posted one Short/i.test(o), 'overview facts: ' + o.slice(0, 400));
  await s.page.click('.htabs [data-htab="categories"]'); await settle(s.page, 250); const c = flat(await text(s.page, '.hbody')); ok(/01 · Gigi category 1/.test(c) && /14 · Gigi category 14/.test(c) && /linked to category 1/.test(c), 'the 14 categories of the table');
  await s.page.click('.htabs [data-htab="channels"]'); await settle(s.page, 250); eq(await s.page.locator('.hbody [data-offcat]').count(), 15, '15 offerings with a category selector'); ok(!/Poppy|Lulu item/.test(await text(s.page, '.hbody')), 'only Gigi\'s own items');
  await s.page.click('.htabs [data-htab="agents"]'); await settle(s.page, 250); eq(await s.page.locator('.hbody [data-hmember]').count(), 10, 'members linked to Gigi by member_houses'); ok(/Social Media Head/.test(await text(s.page, '.hbody')), 'team agents from the company snapshot');
  await s.page.click('.htabs [data-htab="automation"]'); await settle(s.page, 250); ok(/Daily Short/.test(await text(s.page, '.hbody')) && /Weekly long video/.test(await text(s.page, '.hbody')) && !/One extension a week/.test(await text(s.page, '.hbody')), 'Gigi pipelines only');
  await s.page.click('.htabs [data-htab="brains"]'); await settle(s.page, 250); eq(await s.page.locator('.hbody .brec').count(), 4, 'Brain records filed under the youtube team');
  await s.page.click('.htabs [data-htab="approvals"]'); await settle(s.page, 250); ok(/A-101/.test(await text(s.page, '.hbody')) && /A-102/.test(await text(s.page, '.hbody')), 'approvals matched by team text (YouTube, Social Media)');
  await s.page.click('.htabs [data-htab="outputs"]'); await settle(s.page, 250); ok(/Draft script/.test(await text(s.page, '.hbody')), 'outputs of the youtube team');
  await s.page.click('.htabs [data-htab="production"]'); await settle(s.page, 250); ok(/video-render/.test(await text(s.page, '.hbody')) && /upload quota exceeded/.test(await text(s.page, '.hbody')), 'jobs of the youtube team');
  await goHash(s.page, 'house:poppy'); await s.page.click('.htabs [data-htab="categories"]'); await settle(s.page, 250); ok(/Structure categories \(\d+\)/i.test(await text(s.page, '.hbody')) && /No category is set up for this House yet/i.test(await text(s.page, '.hbody')) && /Add a category/i.test(await text(s.page, '.hbody')), 'Poppy has no category rows but the registered ones, and the form to add one');
});
await check('Houses: add a category, add a channel or product, set an offering\'s category (founders write these tables through Nova)', async () => {
  await goHash(s.page, 'house:gigi'); await s.page.click('.htabs [data-htab="categories"]'); await settle(s.page, 250);
  await s.page.fill('[data-opform="cat-add"] input[name="name"]', '[COCO TEST] Tides'); await s.page.fill('[data-opform="cat-add"] input[name="linked"]', 'Gigi category 1'); await click(s.page, '[data-opform="cat-add"] button[type="submit"]', 900);
  const c = writes(callsH, 'POST', '/rest/v1/categories').pop(); ok(c && c.body.house_id === 'gigi' && c.body.code === 15 && c.body.name === '[COCO TEST] Tides' && c.body.linked_to === 'Gigi category 1', 'category insert: ' + JSON.stringify(c && c.body)); ok(/15 · \[COCO TEST\] Tides/.test(await text(s.page, '.hbody')), 'it is listed');
  await s.page.fill('[data-opform="cat-add"] input[name="name"]', '[coco test] tides'); await click(s.page, '[data-opform="cat-add"] button[type="submit"]', 500); ok(/already exists/.test(await toastOf(s.page)), 'a duplicate is refused'); eq(writes(callsH, 'POST', '/rest/v1/categories').length, 1, 'no second insert');
  await s.page.click('.htabs [data-htab="channels"]'); await settle(s.page, 250);
  await s.page.fill('[data-opform="off-add"] input[name="name"]', '[COCO TEST] Tides channel'); await s.page.selectOption('[data-opform="off-add"] select[name="kind"]', 'channel'); await s.page.selectOption('[data-opform="off-add"] select[name="platform"]', 'youtube'); await s.page.selectOption('[data-opform="off-add"] select[name="category"]', { label: '[COCO TEST] Tides' }); await click(s.page, '[data-opform="off-add"] button[type="submit"]', 900);
  const o = writes(callsH, 'POST', '/rest/v1/offerings').pop(); ok(o && o.body.house_id === 'gigi' && o.body.name === '[COCO TEST] Tides channel' && o.body.kind === 'channel' && o.body.platform_id === 'youtube' && o.body.status === 'planned' && !!o.body.category_id, 'offering insert: ' + JSON.stringify(o && o.body));
  const row = s.page.locator('.hbody .row', { hasText: '[COCO TEST] Tides channel' }); ok(await row.count() === 1, 'listed'); await row.locator('[data-offcat]').selectOption({ label: 'Gigi category 5' }); await settle(s.page, 800);
  const p = writes(callsH, 'PATCH', '/rest/v1/offerings').pop(); const cat5 = HS.tables.categories.find((x) => x.name === 'Gigi category 5'); ok(p && p.body.category_id === cat5.id && /id=eq\./.test(q(p)), 'set the category: ' + JSON.stringify(p && p.body) + q(p)); ok(/Category saved/.test(await toastOf(s.page)), 'toast');
});
await check('Houses: assign and unassign a member (member_houses), and add a subteam through coco_structure', async () => {
  await goHash(s.page, 'house:tilly'); await s.page.click('.htabs [data-htab="agents"]'); await settle(s.page, 300);
  eq(await s.page.locator('.hbody [data-hmember]').count(), 2, 'two members work for Tilly');
  await s.page.selectOption('[data-opform="member-add"] select[name="member"]', 'm-care-3'); await click(s.page, '[data-opform="member-add"] button[type="submit"]', 900);
  const a = writes(callsH, 'POST', '/rest/v1/member_houses').pop(); ok(a && a.body.member_id === 'm-care-3' && a.body.house_id === 'tilly', 'assign: ' + JSON.stringify(a && a.body)); eq(await s.page.locator('.hbody [data-hmember]').count(), 3, 'listed');
  await s.page.locator('.hbody .row', { hasText: 'Care Three' }).locator('[data-hmember="remove"]').click(); await settle(s.page, 900);
  ok(s.dialogs.some((d) => /Remove Care Three from Tilly Commerce/.test(d)), 'the founder is asked first'); const d = writes(callsH, 'DELETE', '/rest/v1/member_houses').pop(); ok(d && /member_id=eq\.m-care-3/.test(q(d)) && /house_id=eq\.tilly/.test(q(d)), 'unassign: ' + q(d)); eq(await s.page.locator('.hbody [data-hmember]').count(), 2, 'removed');
  eq(HS.tables.member_houses.filter((l) => l.member_id === 'm-care-3').map((l) => l.house_id).sort().join(','), 'gigi,lulu,poppy', 'the member keeps its other Houses');
  await goHash(s.page, 'house:poppy'); await s.page.click('.htabs [data-htab="teams"]'); await settle(s.page, 300);
  await s.page.selectOption('[data-opform="struct-add"] select[name="parent"]', 'ebooks'); await s.page.fill('[data-opform="struct-add"] input[name="name"]', '[COCO TEST] Test sub'); await s.page.fill('[data-opform="struct-add"] input[name="id"]', 'ebooks/test-sub'); await click(s.page, '[data-opform="struct-add"] button[type="submit"]', 1200);
  const r = writes(callsH, 'POST', '/rest/v1/rpc/coco_structure').pop(); ok(r && r.body.p_op === 'create' && r.body.p_kind === 'subteam' && r.body.p_id === 'ebooks/test-sub' && r.body.p_parent === 'ebooks' && r.body.p_name === '[COCO TEST] Test sub', 'coco_structure: ' + JSON.stringify(r && r.body));
  ok(/\[COCO TEST\] Test sub/.test(await text(s.page, '.hbody')), 'the new subteam is listed'); await s.page.fill('[data-opform="struct-add"] input[name="id"]', 'ebooks/test-sub'); await s.page.fill('[data-opform="struct-add"] input[name="name"]', 'again'); await click(s.page, '[data-opform="struct-add"] button[type="submit"]', 500);
  ok(/already exists/.test(await toastOf(s.page)), 'a duplicate id is refused'); eq(writes(callsH, 'POST', '/rest/v1/rpc/coco_structure').length, 1, 'no second call');
});
await check('Houses: the Add menu jumps to the real forms and opens New task for the House', async () => {
  await goHash(s.page, 'house:gigi'); await click(s.page, '.househead details.menu > summary', 150);
  const items = (await s.page.locator('.househead .menu-p button').allInnerTexts()).map(flat); ok(['Task for Gigi', 'Category', 'Channel or product', 'Subteam', 'Member'].every((x) => items.some((i) => i.includes(x))), 'menu: ' + items);
  await click(s.page, '.menu-p [data-hjump="categories"]', 250); ok(await s.page.locator('[data-opform="cat-add"]').isVisible(), 'Category opens its form');
  await click(s.page, '.househead details.menu > summary', 150); await click(s.page, '.menu-p [data-tkn]', 400); eq(await hashOf(s.page), '#tasks'); eq(await s.page.inputValue('#tkHouse'), 'gigi', 'the House is preselected');
});
const errorsH = s.errors.slice(); await check('no script error in the House run', async () => { eq(errorsH.length, 0, errorsH.join(' | ')); });
await s.ctx.close();

// ---------------------------------------------------------------- the optional org_* registry changes nothing that works without it
{
  s = await open(fixture({ org: true }), {});
  await check('when the optional org_* registry exists the House pages work the same', async () => {
    await goHash(s.page, 'houses'); await settle(s.page, 500); eq(await s.page.locator('.housecard').count(), 7); await goHash(s.page, 'house:gigi'); await s.page.click('.htabs [data-htab="teams"]'); await settle(s.page, 300);
    const t = await text(s.page, '.hbody'); ok(/YouTube Studio/.test(t), 'teams still come from the original tables: ' + t.slice(0, 120)); noLeak(t, 'Teams with org');
    ok(s.errors.length === 0, s.errors.join('|'));
  });
  await s.ctx.close();
}

// ================================================================ connections: real status, a working connect, a key form, Check now
const C = fixture({});
s = await open(C, {});
const callsC = s.calls;
await check('Connections: every integration is listed with its real status and PickTheory is a connectable provider', async () => {
  await goHash(s.page, 'connections'); await settle(s.page, 500);
  const rows = (await s.page.locator('#connlist .row').allInnerTexts()).map(flat); eq(rows.length, 15, '14 integrations from the table + PickTheory');
  const at = (n) => rows.find((r) => r.startsWith(n)) || ''; ok(/Error/.test(at('Gumroad (Poppy shop)')) && /leaked/.test(at('Gumroad (Poppy shop)')) && /Next: Press Reconnect/.test(at('Gumroad (Poppy shop)')), 'the Gumroad error and next action: ' + at('Gumroad (Poppy shop)'));
  ok(/Not connected/.test(at('PickTheory')) && /never verified/.test(at('PickTheory')) && /Create the PickTheory channel on YouTube first/.test(at('PickTheory')), 'PickTheory: ' + at('PickTheory')); ok(/Partly connected/.test(at('Roblox')) && /Paused/.test(at('Meta')), 'partial and paused');
  ok(/verified/.test(at('YouTube')) && /Connected/.test(at('YouTube')), 'YouTube verified date'); ok(rows.indexOf(at('Gumroad (Poppy shop)')) < rows.indexOf(at('YouTube')), 'problems come first');
  ok(/Every platform the company is connected to/.test(await text(s.page, '#view')), 'the account-level hub is still below');
});
await check('Connections: an OAuth integration opens its detail; Reconnect starts POST /api/oauth/begin and opens the authorize page; Verify calls POST /api/oauth/verify', async () => {
  await s.page.locator('#connlist .row a', { hasText: 'Gumroad (Poppy shop)' }).click(); await settle(s.page, 400); eq(await hashOf(s.page), '#connections:gumroad-poppy');
  const d = flat(await text(s.page, '#conn-detail')); for (const w of ['Connection problem', 'Last verified', 'access token was leaked', 'Next action', 'Press Reconnect and approve the new token', 'Poppy Ebooks', 'Demo shop']) ok(d.toLowerCase().includes(w.toLowerCase()), 'detail misses "' + w + '": ' + d.slice(0, 400));
  await click(s.page, '#conn-detail [data-oauth]', 900);
  const b = writes(callsC, 'POST', '/api/oauth/begin').pop(); ok(b && b.body.provider === 'gumroad' && b.body.connection_id === 'poppy', 'begin: ' + JSON.stringify(b && b.body)); const opened = await s.page.evaluate(() => window.__opened); ok(opened.length === 1 && /authorize\?connection=poppy/.test(opened[0]), 'opened: ' + opened);
  await click(s.page, '#conn-detail [data-cverify]', 900); const v = writes(callsC, 'POST', '/api/oauth/verify').pop(); ok(v && v.body.connection_id === 'poppy', 'verify: ' + JSON.stringify(v && v.body)); ok(/Verified from the cloud/.test(await toastOf(s.page)), 'verdict shown: ' + await toastOf(s.page));
  eq(await s.page.locator('#conn-detail [data-connchk]').count(), 0, 'an OAuth integration verifies; it has no separate Check now');
});
await check('Connections: PickTheory is a connectable provider - a YouTube channel connected with Google sign-in (POST /api/oauth/begin, then Verify)', async () => {
  await goHash(s.page, 'connections:picktheory'); await settle(s.page, 400);
  const d = flat(await text(s.page, '#conn-detail')); ok(/PickTheory/.test(d) && /Not connected/.test(d) && /Google sign-in/.test(d) && /Create the PickTheory channel on YouTube first/.test(d) && /Three steps/i.test(d) && /Verify, then assign/.test(d), 'detail: ' + d.slice(0, 500));
  eq(await s.page.locator('[data-opform="conn-key"]').count(), 0, 'no key form: Nova answers "use Google sign-in" to a PickTheory key, so offering one would be a dead end');
  await click(s.page, '#conn-detail .nextbox [data-oauth]', 900); const b = writes(callsC, 'POST', '/api/oauth/begin').pop(); ok(b && b.body.provider === 'youtube' && b.body.connection_id === 'yt-app-web', 'begin: ' + JSON.stringify(b && b.body));
  const opened = await s.page.evaluate(() => window.__opened); ok(/connection=yt-app-web/.test(opened[opened.length - 1]), 'opened: ' + opened);
  await click(s.page, '#conn-detail .nextbox [data-cverify]', 900); const v = writes(callsC, 'POST', '/api/oauth/verify').pop(); ok(v && v.body.connection_id === 'yt-app-web', 'verify: ' + JSON.stringify(v && v.body));
  eq(C.tables.integration_accounts.filter((a) => a.connection_id === 'yt-app-web').length, 1, 'the UI never inserts a connection row itself');
});
await check('Connections: a route that is not deployed is "Not available yet", never a fake success (Save key, Check now)', async () => {
  await goHash(s.page, 'connections:gumroad'); await settle(s.page, 400); await click(s.page, '#conn-detail .brec summary', 200);
  const secret = 'gr-test-SECRET-0123456789'; await s.page.fill('[data-opform="conn-key"] input[name="secret"]', secret);
  eq(await s.page.getAttribute('[data-opform="conn-key"] input[name="secret"]', 'type'), 'password', 'the key field is a password field'); await click(s.page, '[data-opform="conn-key"] button[type="submit"]', 900);
  const k = writes(callsC, 'POST', '/api/connect/key').pop(); ok(k && k.body.provider === 'gumroad' && k.body.connection_id === 'poppy' && k.body.secret === secret, 'key call: ' + JSON.stringify(k && k.body && { ...k.body, secret: '(sent)' }));
  ok(/Not available yet/.test(await toastOf(s.page)), 'honest about the missing route: ' + await toastOf(s.page)); eq(await s.page.inputValue('[data-opform="conn-key"] input[name="secret"]'), '', 'the field is emptied at once');
  ok(!(await s.page.content()).includes(secret) && !(await s.page.evaluate(() => JSON.stringify(localStorage))).includes(secret), 'the key is nowhere in the page or its storage');
  await goHash(s.page, 'connections:play_console'); await settle(s.page, 400);
  await click(s.page, '[data-connchk="play_console"]', 900); const c = writes(callsC, 'POST', '/api/connect/check').pop(); ok(c && c.body.connection_id === 'play_console', 'check call: ' + JSON.stringify(c && c.body)); ok(/Not available yet/.test(await text(s.page, '.connres')), 'Check now says so: ' + await text(s.page, '.connres'));
});
{
  const K = fixture({});
  K.routes['POST /api/connect/key'] = (b) => (b.secret === 'gr-bad-token-000' ? { status: 200, body: { ok: false, state: 'ERROR', stored: false, reason: 'Gumroad did not accept that key. Nothing was stored.' } } : { status: 200, body: { ok: true, state: 'CONNECTED_VERIFIED', stored: true, connection_id: 'poppy', detail: 'Demo shop answered from the cloud and can read sales' } });
  K.routes['POST /api/connect/check'] = (b) => (b.connection_id === 'github' ? { status: 200, body: { ok: false, state: 'CANNOT_CHECK', detail: 'GitHub has no credential the cloud can use, so Coco cannot check it from here. Nothing was changed.' } } : { status: 200, body: { ok: true, state: 'CONNECTED_VERIFIED', detail: 'The key works: 3 products found.' } });
  await s.ctx.close(); s = await open(K, {});
  await check('Connections: Save key checks first (a rejected key stores nothing and says so), Check now reports the verdict; the key is never shown again', async () => {
    await goHash(s.page, 'connections:gumroad'); await settle(s.page, 400); await click(s.page, '#conn-detail .brec summary', 200);
    await s.page.fill('[data-opform="conn-key"] input[name="secret"]', 'gr-bad-token-000'); await click(s.page, '[data-opform="conn-key"] button[type="submit"]', 900); ok(/Gumroad did not accept that key\. Nothing was stored\./.test(await text(s.page, '.connres')), 'rejection: ' + await text(s.page, '.connres')); ok(/bad/.test(await s.page.getAttribute('.connres', 'class')), 'shown as a failure');
    await click(s.page, '#conn-detail .brec summary', 200); await s.page.fill('[data-opform="conn-key"] input[name="secret"]', 'gr-live-ABCDEFGH'); await click(s.page, '[data-opform="conn-key"] button[type="submit"]', 1000);
    ok(/stored in the cloud vault/.test(await text(s.page, '.connres')) && /can read sales/.test(await text(s.page, '.connres')), 'stored: ' + await text(s.page, '.connres')); ok(!(await s.page.content()).includes('gr-live-ABCDEFGH'), 'never shown again');
    await goHash(s.page, 'connections:play_console'); await settle(s.page, 400); const t = flat(await text(s.page, '#conn-detail')); ok(/Create the API key in Partner Center/.test(t) && /Check now/.test(t), 'a manual platform shows its exact next step and Check now: ' + t.slice(0, 260)); eq(await s.page.locator('[data-opform="conn-key"]').count(), 0, 'no key form where Nova takes no key');
    await click(s.page, '[data-connchk="play_console"]', 900); ok(/The key works: 3 products found\./.test(await text(s.page, '.connres')), 'check result: ' + await text(s.page, '.connres'));
    await goHash(s.page, 'connections:github'); await settle(s.page, 300); await click(s.page, '[data-connchk="github"]', 900); const g = await s.page.locator('.connres').first(); ok(/cannot check it from here/.test(await g.innerText()) && !/bad/.test(await g.getAttribute('class')), 'a platform the cloud cannot check says so plainly, not as a failure: ' + await g.innerText());
    await goHash(s.page, 'connections:yt-c'); await settle(s.page, 300); ok(/YouTube/.test(await text(s.page, '#conn-detail')), 'an account id opens its provider detail');
  });
}
const errorsC = s.errors.slice(); await check('no script error on the connections pages', async () => { eq(errorsC.length, 0, errorsC.join(' | ')); });
await s.ctx.close();

// ================================================================ revenue and analytics: the states, with the real tables when they are served
const revOf = async (fx, hash = 'insights') => { const x = await open(fx, {}); await goHash(x.page, hash); await settle(x.page, 900); return x; };
{
  let r = await revOf(fixture({ revenue: 'missing' }));
  await check('Revenue: the tables are not served yet -> "Revenue sync is not set up yet", no zero, no invented number (Insights and the House tab)', async () => {
    const t = flat(await text(r.page, '#view')), card = flat(await r.page.locator('.hcard', { hasText: 'Revenue sync is not set up yet' }).first().innerText()); ok(/Revenue sync is not set up yet/.test(t) && !/₹|INR 0|\$0|USD 0/.test(card), card.slice(0, 300));
    await goHash(r.page, 'house:poppy'); await r.page.click('.htabs [data-htab="revenue"]'); await settle(r.page, 600); ok(/Revenue sync is not set up yet/.test(await text(r.page, '.hbody')), 'House revenue says it too');
  });
  await check('Analytics: YouTube views and subscribers per channel and in total from yt_stats, with the last sync time', async () => {
    await goHash(r.page, 'insights'); await settle(r.page, 500); const y = flat(await text(r.page, '#view'));
    ok(/6,150 views, all channels/.test(y) && /48 subscribers/.test(y) && /18 videos/.test(y), 'totals: ' + y.slice(0, 300)); ok(/Channel A 5,230 views · 41 subscribers · 15 videos/.test(y) && /Channel B 920 views · 7 subscribers · 3 videos/.test(y), 'per channel'); ok(/Last synced \d+ h ago/.test(y), 'last synced');
    await goHash(r.page, 'house:gigi'); await r.page.click('.htabs [data-htab="analytics"]'); await settle(r.page, 400); ok(/6,150/.test(await text(r.page, '.hbody')), 'the Gigi analytics tab shows the same numbers');
    await goHash(r.page, 'house:lulu'); await r.page.click('.htabs [data-htab="analytics"]'); await settle(r.page, 400); ok(!/6,150/.test(await text(r.page, '.hbody')) && /No software analytics source is connected yet/.test(await text(r.page, '.hbody')), 'another House does not borrow them');
    await goHash(r.page, 'insights'); await r.page.selectOption('select[data-hf="house"]', 'lulu'); await settle(r.page, 400); ok(/Lulu Software/.test(await text(r.page, '#view')), 'the House filter narrows the work table');
  });
  await r.ctx.close();
  r = await revOf(fixture({ revenue: 'empty', gumroadConnected: false }));
  await check('Revenue: a source that is not connected says "Not connected" with a working Connect, never a zero', async () => {
    const t = flat(await text(r.page, '#view')); ok(/Gumroad/.test(t) && /Not connected/.test(t) && /This is not a zero/.test(t) && !/INR 0/.test(t), t.slice(0, 500));
    await click(r.page, '#view [data-oauth="gumroad"]', 900); const b = writes(r.calls, 'POST', '/api/oauth/begin').pop(); ok(b && b.body.provider === 'gumroad' && b.body.connection_id === 'poppy', 'Connect begins the flow: ' + JSON.stringify(b && b.body));
  });
  await r.ctx.close();
  r = await revOf(fixture({ revenue: 'zero' }));
  await check('Revenue: a connected source with a successful sync and no sale is a verified zero in the currency Gumroad reports (USD, never rupees), with the last successful sync time', async () => {
    const t = flat(await text(r.page, '#view')); ok(/Gumroad/.test(t) && /USD 0/.test(t) && !/INR/.test(t) && /no sales in this period/.test(t) && /last successful sync/.test(t), t.slice(0, 500));
  });
  await check('Revenue: Sync now posts the connection to /api/revenue/sync; a route that is not deployed is "Not available yet"', async () => {
    await click(r.page, '[data-revsync="poppy"]', 900); const c = writes(r.calls, 'POST', '/api/revenue/sync').pop(); ok(c && c.body.connection_id === 'poppy', 'call: ' + JSON.stringify(c && c.body)); ok(/Not available yet/.test(await toastOf(r.page)), 'toast: ' + await toastOf(r.page));
  });
  await r.ctx.close();
  const SY = fixture({ revenue: 'zero' }); SY.routes['POST /api/revenue/sync'] = () => { SY.tables.revenue_events.push({ id: 'ev-new', source: 'gumroad', connection_id: 'poppy', house_id: 'poppy', product_id: null, occurred_at: new Date().toISOString(), amount: 250, currency: 'USD', kind: 'sale', external_id: 'o1', meta: {} }); return { status: 200, body: { ok: true, sources: [{ connection_id: 'poppy', state: 'ok', fetched: 1, inserted: 1, updated: 0 }] } }; };
  r = await revOf(SY);
  await check('Revenue: after a successful sync the new sale is read back and counted', async () => {
    await click(r.page, '[data-revsync="poppy"]', 1400); ok(/\$250\.00/.test(await text(r.page, '#view')), 'the amount appears in the row\'s own currency: ' + flat(await text(r.page, '#view')).slice(0, 400));
  });
  await r.ctx.close();
  r = await revOf(fixture({ revenue: 'some' }));
  await check('Revenue: real amounts in the currency of each row (refunds subtract, fees are not sales), never relabelled or added together', async () => {
  const t = flat(await text(r.page, '#view')); ok(/\$12\.97/.test(t) && /₹1,500/.test(t), 'USD 4.99+4.99+3.99-1.00 and the rupee source stay separate: ' + t.slice(0, 600)); ok(/3 sales in USD/.test(t) && /1 sale in INR/.test(t), 'counts');
  await r.page.selectOption('select[data-hf="currency"]', 'INR'); await settle(r.page, 500); const u = flat(await text(r.page, '#view')); ok(/₹1,500/.test(u) && !/\$12\.97/.test(u), 'the currency filter narrows: ' + u.slice(0, 300));
  await goHash(r.page, 'house:poppy'); await r.page.click('.htabs [data-htab="revenue"]'); await settle(r.page, 500); ok(/\$12\.97|₹1,500/.test(await text(r.page, '.hbody')), 'Poppy revenue tab');
  await goHash(r.page, 'house:gigi'); await r.page.click('.htabs [data-htab="revenue"]'); await settle(r.page, 500); ok(!/\$12\.97/.test(await text(r.page, '.hbody')), 'another House does not show Poppy\'s sales');
});
  r = await revOf(fixture({ revenue: 'failing' }));
  await check('Revenue: a failed sync says so, with its error, and offers Sync now', async () => {
    const t = flat(await text(r.page, '#view')); ok(/Sync failed/.test(t) && /Gumroad refused the token \(401\)/.test(t) && !/INR 0/.test(t), t.slice(0, 400)); eq(await r.page.locator('[data-revsync="poppy"]').count(), 1);
  });
  await check('no script error on the revenue runs', async () => { eq(r.errors.length, 0, r.errors.join(' | ')); });
  await r.ctx.close();
}

// ================================================================ dark theme and reduced motion
s = await open(A, { theme: 'dark', reduced: true });
await check('dark theme uses the dark tokens, and reduced motion turns the page animations off', async () => {
  eq((await s.page.evaluate(() => getComputedStyle(document.body).backgroundColor)).replace(/\s/g, ''), 'rgb(36,21,46)', 'dark surface is Deep Aubergine (Original Signature, the default theme)');
  eq(await s.page.evaluate(() => getComputedStyle(document.querySelector('.tile')).animationName), 'none', 'no animation under reduced motion');
  const contrast = await s.page.evaluate(() => { const c = (v) => { const m = v.match(/\d+(\.\d+)?/g).map(Number); return m.slice(0, 3).map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); }; const L = (v) => { const [r, g, b] = c(v); return .2126 * r + .7152 * g + .0722 * b; }; const a = L(getComputedStyle(document.body).color), b = L(getComputedStyle(document.body).backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
  ok(contrast >= 7, 'body text contrast in dark: ' + contrast.toFixed(1));
});
if (SHOTS) { await settle(s.page, 600); await shot(s.page, '20-desktop-home-dark'); }
await s.ctx.close();

// ================================================================ the phone
s = await open(A, { width: 390, height: 844 });
await check('phone: bottom bar is Home, Houses, Work, More; the sidebar is hidden; nothing overflows sideways on any new screen', async () => {
  const bar = (await s.page.locator('#bottom a > span:not(.pill):not(.badge)').allInnerTexts()).map((x) => x.trim()); eq(bar.join('|'), 'Home|Houses|Work|More'); ok(!(await s.page.locator('#rail').isVisible()), 'rail hidden on a phone');
  for (const h of ['home', 'houses', 'house:gigi', 'tasks', 'tasks:' + TID.running, 'approvals', 'approvals:' + AID.waiting1, 'connections', 'connections:gumroad-poppy', 'connections:picktheory', 'insights', 'board', 'hierarchy', 'system', 'automation']) {
    await goHash(s.page, h); await settle(s.page, 400); const w = await s.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (w[0] > w[1] + 1) { const off = await s.page.evaluate(() => [...document.querySelectorAll('#view *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tscroll, .htabs, .subnav, details')).slice(0, 4).map((e) => e.tagName + '.' + String(e.className).slice(0, 40) + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.innerText || '').slice(0, 50).replace(/\s+/g, ' '))); ok(false, `${h} overflows sideways: ${w[0]} > ${w[1]}; widest: ${JSON.stringify(off)}`); }
  }
  for (const k of ['teams', 'categories', 'channels', 'agents', 'automation', 'connections']) { await goHash(s.page, 'house:poppy'); await s.page.click(`.htabs [data-htab="${k}"]`); await settle(s.page, 300); const w = await s.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(w[0] <= w[1] + 1, `house:poppy/${k} overflows sideways: ${w}`); }
});
await check('phone: Home is compact - two tiles per row, the four tiles and the first Needs-attention row are on the first screen', async () => {
  await goHash(s.page, 'home'); await settle(s.page, 500);
  const cols = await s.page.evaluate(() => getComputedStyle(document.querySelector('.tiles')).gridTemplateColumns.split(' ').length); eq(cols, 2, 'two tiles per row');
  const last = await s.page.locator('.tiles .tile').last().boundingBox(); ok(last.y + last.height < 520, 'all four tiles sit in the top of the first screen, bottom=' + (last.y + last.height));
  const first = await s.page.locator('#attn + .alist .arow').first().boundingBox(); ok(first && first.y < 844, 'the first thing that needs attention is visible without scrolling, y=' + (first && first.y));
  const btn = await s.page.locator('#attn + .alist .arow .btn').first().boundingBox(); ok(btn.height >= 30, 'buttons are tappable: ' + btn.height);
});
await check('phone: the More sheet reaches every section, page (Tasks included), House, Ask COCO and Remote Control; the FAB opens Ask COCO', async () => {
  await s.page.click('#bottom [data-more]'); await settle(s.page, 250); ok(await s.page.locator('#moreSheet').isVisible(), 'sheet open');
  const hrefs = await s.page.locator('#moreNav a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  for (const sec of NAV.sections) for (const p of sec.pages) ok(hrefs.includes('#' + p.id), 'sheet misses ' + p.id);
  for (const h of NAV.houses) ok(hrefs.includes('#house:' + h.id), 'sheet misses ' + h.id); ok(hrefs.includes('#chat') && hrefs.includes('#remote'), 'Ask COCO and Remote Control');
  await s.page.click('#moreNav a[href="#connections"]'); await settle(s.page, 350); ok(!(await s.page.locator('#moreSheet').isVisible()), 'choosing a page closes the sheet'); eq(await hashOf(s.page), '#connections');
  await goHash(s.page, 'home'); await s.page.click('#askFab'); await settle(s.page, 300); ok(await s.page.locator('#askDrawer').isVisible(), 'drawer'); ok((await s.page.locator('#askDrawer').boundingBox()).width >= 385, 'the assistant takes the phone screen'); await s.page.click('[data-askclose]');
});
await check('phone: Insights tables become readable cards', async () => {
  await goHash(s.page, 'insights'); await settle(s.page, 500); ok(!(await s.page.locator('.dt thead').first().isVisible()), 'table header hidden on a phone'); ok((await s.page.locator('.dt td').first().evaluate((e) => getComputedStyle(e).display)) === 'block', 'cells stack');
});
if (SHOTS) {
  for (const [n, h] of [['24-phone-home', 'home'], ['26-phone-houses', 'houses'], ['27-phone-house-lulu', 'house:lulu'], ['28-phone-tasks', 'tasks'], ['29-phone-insights', 'insights']]) { await goHash(s.page, h); await settle(s.page, 600); await shot(s.page, n); }
}
const errorsP = s.errors.slice(); await check('no script error in the phone run', async () => { eq(errorsP.length, 0, errorsP.join(' | ')); });
await s.ctx.close();

// ================================================================ no dead control on the operating screens
s = await open(fixture({ revenue: 'zero' }), {});
await check('no dead link: every in-app link on the operating screens opens a route that renders, and no button is without a handler', async () => {
  const routes = new Set(await s.page.evaluate(() => PAGES.map((p) => p[0]))), seen = new Set(); const dead = [];
  const pages = ['home', 'tasks', 'approvals', 'houses', 'house:gigi', 'house:poppy', 'connections', 'insights', 'board'], legacy = ['company', 'teams', 'agents', 'club', 'brain', 'workflows', 'hierarchy', 'structure', 'runs', 'notes', 'ai', 'cloud', 'control', 'system', 'rules', 'devices', 'settings', 'remote', 'themes', 'automation'];
  for (const h of pages) {
    await goHash(s.page, h); await settle(s.page, 500);
    const links = await s.page.locator('#view a[href^="#"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
    for (const l of links) { const id = l.slice(1).split(':')[0]; if (id && !routes.has(id) && l !== '#') dead.push(`${h} -> ${l}`); seen.add(l); }
    const buttons = await s.page.locator('#view button').evaluateAll((bs) => bs.filter((b) => !b.disabled && !Object.keys(b.dataset).length && b.type !== 'submit' && !b.closest('summary')).map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 40)));
    if (buttons.length) dead.push(`${h}: buttons with no data hook: ${buttons.join(', ')}`);
  }
  for (const h of legacy) { await goHash(s.page, h); await settle(s.page, 450); const links = await s.page.locator('#view a[href^="#"]').evaluateAll((a) => a.map((x) => x.getAttribute('href'))); for (const l of links) { const id = l.slice(1).split(':')[0]; if (id && !routes.has(id) && l !== '#') dead.push(`${h} -> ${l}`); seen.add(l); } }
  eq(dead.join(' | '), '', 'dead links or buttons'); ok(seen.size > 10, 'links were checked: ' + seen.size);
  const houseTabs = NAV.house_tabs.map((x) => x[0]); await goHash(s.page, 'house:fifi');
  for (const k of houseTabs) { await s.page.click(`.htabs [data-htab="${k}"]`); await settle(s.page, 150); const links = await s.page.locator('.hbody a[href^="#"]').evaluateAll((a) => a.map((x) => x.getAttribute('href'))); for (const l of links) { const id = l.slice(1).split(':')[0]; if (id && !routes.has(id)) dead.push(`house tab ${k} -> ${l}`); } }
  eq(dead.join(' | '), '', 'dead links in the House tabs');
});
await s.ctx.close();

// ================================================================ the desktop bridge contract (static)
await check('every desktop bridge method the page calls exists in the preload (the contract is unchanged)', async () => {
  const page = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
  const used = [...new Set([...page.matchAll(/cocoDesktop\.([A-Za-z]+)/g)].map((m) => m[1]))];
  const missing = used.filter((k) => !preloadKeys.includes(k) && k !== 'platform'); eq(missing.join(','), '', 'methods used by the page but missing in preload.js');
  ok(used.length >= 8, 'the page uses the bridge: ' + used.join(','));
});

await H.finish('ui-browser');
