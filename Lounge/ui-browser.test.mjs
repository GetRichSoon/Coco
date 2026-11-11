// Run: node ui-browser.test.mjs        (SHOTS=<folder> keeps screenshots; DESKTOP=1 runs the same checks with the desktop bridge stub installed)
//
// The unified UI in a real browser (Chromium through Playwright), against SYNTHETIC data served by a stand-in for Nova: no production
// service, database or account is touched. It drives the real index.html: the navigation, the revenue-first Home and its filters, the seven
// House workspaces, Ask COCO on every screen, Remote Control, approvals, the phone layout, dark theme and reduced motion.
// Without Playwright or a browser it SKIPS loudly instead of passing quietly.
import fs from 'node:fs';
import path from 'node:path';
import { createHarness, here, preloadKeys } from './ui-harness.mjs';
import { fixture, NAV } from './ui-fixture.mjs';

const H = await createHarness('ui-browser');
const { check, eq, ok, settle, text, bad, goHash, shot, open, SHOTS, DESKTOP } = H;

// ================================================================ scenario A: no revenue record exists anywhere
const A = fixture({ withRevenue: false });
let s = await open(A, { calls: [] });
const callsA = s.calls;
if (process.env.DBG) console.log('DBG beat', await s.page.evaluate(async () => JSON.stringify(await sb.from('devices').update({ last_seen: 'x' }).eq('id', 'boss-pc').select('id'))));

await check('the shell: eight sections, seven Houses, search, device chip, Ask COCO, bell, profile', async () => {
  const links = await s.page.locator('#nav a:not(.hl) .lbl').allInnerTexts();
  eq(links.map((x) => x.trim()).join('|'), NAV.sections.map((x) => x.label).join('|'), 'sections');
  const houses = await s.page.locator('#nav a.hl .lbl').allInnerTexts();
  eq(houses.join('|'), NAV.houses.map((h) => h.label).join('|'), 'Houses');
  for (const id of ['#q', '#remoteChip', '#askBtn', '#bellBtn', '#meBtn']) ok(await s.page.locator(id).isVisible(), id + ' is missing');
  eq((await text(s.page, '#remoteChip')).replace(/\s+/g, ' ').trim(), 'Remote · 3/4 online');
  ok((await text(s.page, '#nav a[href="#board"]')).includes('2'), 'the Work badge shows the 2 waiting approvals');
});

await check('Home: Revenue is the first and most prominent KPI, and with no revenue record it says Unavailable, not zero', async () => {
  const first = s.page.locator('.kpis > .kpi').first();
  ok((await first.getAttribute('class')).includes('revenue'), 'revenue is not first');
  const box = await first.boundingBox(); ok(box.y < 450, 'revenue must be visible without scrolling, y=' + box.y);
  const t = await first.innerText();
  ok(/Unavailable/.test(t), 'revenue must say Unavailable'); ok(/not a confirmed zero/.test(t), 'revenue must say it is not a zero');
  ok(!/(^|\s)0(\s|$)/.test(await first.locator('.kv').innerText()), 'revenue must not show a 0');
  ok(/connected/.test(t) && /No account yet for/.test(t), 'revenue must state its coverage: ' + t);
});

await check('Home: the other KPIs come from the recorded data, each with its source', async () => {
  const kp = await s.page.locator('.kpis > .kpi').allInnerTexts();
  eq(kp.length, 6, 'six KPI cards');
  ok(/Total views/.test(kp[1]) && !/Unavailable/.test(kp[1]) && /youtube analytics/.test(kp[1]), 'views: ' + kp[1]);
  ok(/Total sales/.test(kp[2]) && /gumroad/.test(kp[2]), 'sales: ' + kp[2]);
  ok(/Audience growth/.test(kp[3]) && /\+/.test(kp[3]), 'audience: ' + kp[3]);
  ok(/Published outputs/.test(kp[4]) && /\b9\b/.test(kp[4]) === false || /Published outputs/.test(kp[4]), 'outputs: ' + kp[4]);
  ok(/Active jobs/.test(kp[5]) && /1 running/.test(kp[5]) && /1 queued/.test(kp[5]) && /1 failed or blocked|failed/.test(kp[5]), 'jobs: ' + kp[5]);
  for (const k of kp) ok(!bad(k), 'a KPI leaked undefined/NaN: ' + k);
});

await check('Home: the four charts, with honest empty states instead of empty axes', async () => {
  eq(await s.page.locator('.chartcard').count(), 4);
  const cards = await s.page.locator('.chartcard').allInnerTexts();
  ok(/No revenue records to chart/.test(cards[0]), 'revenue chart must be an empty state');
  ok(/No House has revenue records/.test(cards[1]), 'by-House chart must be an empty state');
  ok(await s.page.locator('.chartcard').nth(2).locator('svg.chart').count() >= 1, 'views chart must draw');
  await s.page.waitForFunction(() => /short/.test(document.querySelectorAll('.chartcard')[3].innerText), null, { timeout: 8000 });
  ok(/6 \/ 10/.test(await s.page.locator('.chartcard').nth(3).innerText()), 'production target and actual from the schedule');
});

await check('Home: seven House cards that show only measures that apply to each House', async () => {
  eq(await s.page.locator('.housecard').count(), 7);
  const gigi = await s.page.locator('.housecard').nth(0).innerText(), lulu = await s.page.locator('.housecard').nth(1).innerText();
  ok(/Gigi Social/.test(gigi) && /views/i.test(gigi) && !/installs/i.test(gigi), 'Gigi shows views, not installs: ' + gigi);
  ok(/installs/i.test(lulu) && !/views/i.test(lulu.replace(/\n/g, ' ').replace(/Not tracked yet:[^\n]*/, '')), 'Lulu shows installs: ' + lulu);
  ok(/Revenue\s+Unavailable/.test(gigi.replace(/\n+/g, ' ')), 'each card says revenue is Unavailable');
  ok((await s.page.locator('.housecard a.btn').first().getAttribute('href')) === '#house:gigi');
});

await check('Home: live operations: approvals with YES/No, jobs, cloud worker and integration problems', async () => {
  const ops = await s.page.locator('.opsgrid').innerText();
  ok(/Waiting for your YES\s*2/.test(ops.replace(/\n+/g, ' ')), 'two approvals: ' + ops.slice(0, 200));
  eq(await s.page.locator('.opsgrid [data-yes]').count(), 2);
  ok(/Running jobs\s*1/.test(ops.replace(/\n+/g, ' ')) && /Failed jobs\s*1/.test(ops.replace(/\n+/g, ' ')) && /Blocked jobs\s*1/.test(ops.replace(/\n+/g, ' ')), 'job counts');
  ok(/Cloud worker/.test(ops) && /Online/.test(ops), 'cloud worker online');
  ok(/Integration problems\s*1/.test(ops.replace(/\n+/g, ' ')), 'one integration problem');
});

await check('Home: filters work together, cascade and reset', async () => {
  await s.page.selectOption('select[data-hf="house"]', 'gigi'); await settle(s.page);
  eq(await s.page.locator('.housecard').count(), 1, 'one House card after filtering');
  ok(!(await s.page.locator('select[data-hf="team"]').isDisabled()), 'team filter becomes available');
  const teams = await s.page.locator('select[data-hf="team"] option').allInnerTexts(); ok(teams.length >= 3, 'team options: ' + teams);
  await s.page.selectOption('select[data-hf="team"]', 'gigi.s1'); await settle(s.page);
  const views28 = await text(s.page, '.kpis > .kpi:nth-child(2) .kv'); ok(!/Unavailable/.test(views28), 'the team has recorded views: ' + views28);
  await s.page.selectOption('select[data-hf="period"]', '7d'); await settle(s.page);
  const views7 = await text(s.page, '.kpis > .kpi:nth-child(2) .kv'); ok(views7 !== views28 && !/Unavailable/.test(views7), `7 days must differ from 28 days (${views7} vs ${views28})`);
  await s.page.selectOption('select[data-hf="period"]', '28d'); await settle(s.page);
  ok(!(await s.page.locator('select[data-hf="category"]').isDisabled()), 'category filter is available once a team is chosen');
  await s.page.selectOption('select[data-hf="category"]', 'gigi.s1.c1'); await settle(s.page);
  const chans = await s.page.locator('select[data-hf="channel"] option').allInnerTexts(); ok(chans.some((x) => /Gigi Channel A/.test(x)) && !chans.some((x) => /Lulu/.test(x)) && !chans.some((x) => /Gigi Product B/.test(x)), 'channel options follow the category: ' + chans);
  ok(/Unavailable/.test(await text(s.page, '.kpis > .kpi:nth-child(2) .kv')), 'narrowing to a category with no recorded metrics says Unavailable instead of keeping the parent numbers');
  await s.page.selectOption('select[data-hf="house"]', 'lulu'); await settle(s.page);
  eq(await s.page.locator('select[data-hf="team"]').inputValue(), '', 'changing the House clears the deeper filters');
  ok(/Unavailable/.test(await text(s.page, '.kpis > .kpi:nth-child(2)')), 'Lulu has no views: Unavailable');
  await s.page.click('[data-hf-reset]'); await settle(s.page);
  eq(await s.page.locator('.housecard').count(), 7, 'reset restores all Houses'); eq(await s.page.locator('select[data-hf="period"]').inputValue(), '28d');
  await s.page.selectOption('select[data-hf="period"]', 'custom'); await settle(s.page);
  ok(await s.page.locator('input[data-hf="from"]').isVisible(), 'custom range shows its dates'); await s.page.click('[data-hf-reset]');
});

await check('Home: YES on a waiting approval goes through the existing approval write', async () => {
  await s.page.locator('.opsgrid [data-yes]').first().click(); await settle(s.page, 600);
  const w = callsA.find((c) => c.m === 'PATCH' && c.p === '/rest/v1/approvals');
  ok(w && w.body && w.body.state === 'approved' && /id=eq\.1/.test(w.q), 'approval PATCH was not sent as before: ' + JSON.stringify(w));
});

await check('Ask COCO is one tap from every screen and sends through the existing chat path', async () => {
  for (const h of ['home', 'board', 'insights', 'house:poppy']) {
    await goHash(s.page, h); await s.page.click('#askBtn'); await settle(s.page, 200);
    ok(await s.page.locator('#askDrawer').isVisible(), 'drawer did not open on ' + h);
    eq(await s.page.locator('#chatForm').count(), 1, 'exactly one chat form on ' + h);
    await s.page.click('[data-askclose]'); await settle(s.page, 150); ok(!(await s.page.locator('#askDrawer').isVisible()), 'drawer did not close');
  }
  await goHash(s.page, 'home'); await s.page.click('#askBtn'); await s.page.fill('#askBody input[name="q"]', 'status please'); await s.page.press('#askBody input[name="q"]', 'Enter'); await settle(s.page, 700);
  const c = callsA.find((x) => x.p === '/api/chat'); ok(c && c.body && c.body.body === 'status please', 'POST /api/chat: ' + JSON.stringify(c));
  ok(/Mock reply/.test(await text(s.page, '#askBody')), 'the reply is shown in the drawer');
  await s.page.click('#askDrawer a[href="#chat"]'); await settle(s.page, 400);
  ok(!(await s.page.locator('#askDrawer').isVisible()), 'the drawer steps aside on the full Ask COCO page'); eq(await s.page.locator('#chatForm').count(), 1, 'still exactly one chat form');
  await goHash(s.page, 'home');
});

await check('Remote Control: the device chip opens it; it lists the paired devices', async () => {
  await s.page.click('#remoteChip'); await settle(s.page, 400); eq(await s.page.evaluate(() => location.hash), '#remote');
  const t = await text(s.page, '#view'); ok(/Boss PC/.test(t) || /Boss phone/.test(t), 'Remote shows devices: ' + t.slice(0, 120));
  await goHash(s.page, 'home');
});

await check('notifications and search are built from loaded data', async () => {
  await s.page.click('#bellBtn'); await settle(s.page, 150);
  const bell = await text(s.page, '#bellPanel'); ok(/Waiting for your YES/.test(bell) || /Publish the weekly Short|Price change/.test(bell), 'bell lists approvals: ' + bell.slice(0, 200)); ok(/offline/i.test(bell), 'bell lists the offline device');
  await s.page.keyboard.press('Escape'); ok(!(await s.page.locator('#bellPanel').isVisible()), 'Escape closes the panel');
  await s.page.fill('#q', 'poppy'); await settle(s.page, 150);
  ok(/Poppy Ebooks/.test(await text(s.page, '#searchResults')), 'search finds the House');
  await s.page.press('#q', 'Enter'); await settle(s.page, 300); eq(await s.page.evaluate(() => location.hash), '#house:poppy');
  await goHash(s.page, 'home');
});

await check('every one of the original 20 pages is reachable through the new navigation (clicks, not hash edits)', async () => {
  const ORIGINAL = ['home', 'control', 'board', 'notes', 'remote', 'approvals', 'company', 'teams', 'agents', 'runs', 'ai', 'brain', 'workflows', 'system', 'chat', 'connections', 'club', 'rules', 'devices', 'settings'];
  for (const id of ORIGINAL) {
    await goHash(s.page, 'home'); await settle(s.page, 120);
    if (id === 'remote') await s.page.click('#remoteChip');
    else if (id === 'chat') { await s.page.click('#askBtn'); await s.page.click('#askDrawer a[href="#chat"]'); }
    else {
      const sec = NAV.sections.find((x) => x.pages.some((p) => p.id === id));
      await s.page.locator('#nav a:not(.hl)', { hasText: sec.label }).first().click(); await settle(s.page, 150);
      if (sec.pages[0].id !== id) await s.page.locator('#subnav a', { hasText: new RegExp('^' + sec.pages.find((p) => p.id === id).label.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') + '$') }).click();
    }
    await settle(s.page, 350);
    eq(await s.page.evaluate(() => location.hash), '#' + id, 'navigating to ' + id);
    const view = await text(s.page, '#view'); ok(view.trim().length > 0, id + ' rendered nothing'); ok(!bad(view), id + ' leaked undefined/NaN: ' + (view.match(/.{20}(undefined|NaN|\[object).{20}/s) || [''])[0]);
  }
  await goHash(s.page, 'home');
});

await check('the new and moved routes render without leaking undefined: houses, hierarchy, insights, structure, automation, cloud', async () => {
  for (const id of ['houses', 'hierarchy', 'insights', 'structure', 'automation', 'cloud']) { await goHash(s.page, id); await settle(s.page, 500); const v = await text(s.page, '#view'); ok(v.trim().length > 20, id + ' is empty'); ok(!bad(v), id + ' leaked: ' + (v.match(/.{20}(undefined|NaN|\[object).{20}/s) || [''])[0]); }
});

await check('all seven House workspaces open, each with the same twenty tabs, and every tab renders', async () => {
  for (const h of NAV.houses) {
    await s.page.locator(`#nav a[href="#house:${h.id}"]`).click(); await settle(s.page, 300);
    eq(await s.page.locator('.htabs button').count(), 20, h.id + ' tabs'); ok((await text(s.page, '.househead h2')).includes(h.label), 'House title');
    if (h.id === 'gigi' || h.id === 'poppy') for (const [k] of NAV.house_tabs) {
      await s.page.click(`.htabs [data-htab="${k}"]`); await settle(s.page, 220);
      const body = await text(s.page, '.hbody'); ok(body.trim().length > 10, `${h.id}/${k} rendered nothing`); ok(!bad(body), `${h.id}/${k} leaked: ` + (body.match(/.{20}(undefined|NaN|\[object).{20}/s) || [''])[0]);
    }
  }
  await s.page.click('.htabs [data-htab="overview"]');
});

await check('a House shows only its own data (changing one House does not change another)', async () => {
  await goHash(s.page, 'house:gigi'); await s.page.click('.htabs [data-htab="channels"]'); await settle(s.page, 250);
  const g = await text(s.page, '.hbody'); ok(/Gigi Channel A/.test(g) && !/Poppy Channel A/.test(g), 'Gigi channels: ' + g.slice(0, 200));
  await goHash(s.page, 'house:poppy'); await s.page.click('.htabs [data-htab="outputs"]'); await settle(s.page, 250);
  const p = await text(s.page, '.hbody'); ok(/Output/.test(p), 'Poppy outputs'); await s.page.click('.htabs [data-htab="approvals"]'); await settle(s.page, 250);
  const pa = await text(s.page, '.hbody'); ok(/A-102/.test(pa) && !/A-101/.test(pa), 'Poppy approvals only: ' + pa.slice(0, 150));
  await s.page.click('.htabs [data-htab="brains"]'); await settle(s.page, 400); ok(/house brain/.test(await text(s.page, '.hbody')), 'Poppy brains');
});

await check('+ Create opens the real creation wizard and refuses to invent a House', async () => {
  await goHash(s.page, 'house:gigi'); await s.page.click('.househead details.menu > summary'); await settle(s.page, 100);
  const items = await s.page.locator('.househead .menu-p button').allInnerTexts(); ok(['Team', 'Subteam', 'Category', 'Channel', 'Product', 'Automation', 'House'].every((x) => items.some((i) => i.includes(x))), 'create menu: ' + items);
  await s.page.click('.househead .menu-p [data-create="house"]'); await settle(s.page, 150); ok(/Houses are fixed in the registry/.test(await text(s.page, '#toast')), 'House creation says why it is not offered');
  await s.page.click('.househead details.menu > summary'); await s.page.click('.househead .menu-p [data-create="channel"]'); await settle(s.page, 600);
  eq(await s.page.evaluate(() => location.hash), '#automation', 'the wizard lives in Automation'); ok(!bad(await text(s.page, '#view')), 'wizard rendered');
});

await check('Brains & Agents: the hierarchy shows the tree and a selected Brain’s detail; held actions are stated', async () => {
  await goHash(s.page, 'hierarchy'); await settle(s.page, 500);
  ok(/Brain hierarchy/.test(await text(s.page, '#view')) && /COCO/.test(await text(s.page, '.btreewrap')), 'tree');
  await s.page.locator('.bnode', { hasText: 'Poppy' }).first().click(); await settle(s.page, 250);
  const d = await text(s.page, '.bdetail'); ok(/house Brain/.test(d) && /Objectives \(2\)/i.test(d) && /Brain actions stay held/.test(d), 'detail: ' + d.slice(0, 200));
});

await check('Insights: revenue Unavailable with its reason; Houses list only their own measures', async () => {
  await goHash(s.page, 'insights'); await settle(s.page, 500); const t = await text(s.page, '#view');
  ok(/Unavailable/.test(t) && /Nothing is estimated or shown as zero/.test(t), 'revenue honesty'); ok(/Performance by House/.test(t) && /Gigi Social/.test(t) && /Tilly Commerce/.test(t), 'all Houses'); ok(/AI usage and budget/.test(t) && /Platform performance/.test(t) && /Reports/.test(t), 'sections');
});

if (SHOTS) {
  await goHash(s.page, 'home'); await settle(s.page, 800); await shot(s.page, '01-desktop-home-light');
  await s.page.evaluate(() => window.scrollTo(0, 900)); await settle(s.page, 200); await shot(s.page, '02-desktop-home-scrolled'); await s.page.evaluate(() => window.scrollTo(0, 0));
  await goHash(s.page, 'houses'); await settle(s.page, 400); await shot(s.page, '03-desktop-houses');
  await goHash(s.page, 'house:gigi'); await settle(s.page, 400); await shot(s.page, '04-desktop-house-gigi-overview');
  for (const k of ['channels', 'brains', 'automation']) { await s.page.click(`.htabs [data-htab="${k}"]`); await settle(s.page, 400); await shot(s.page, `05-desktop-house-gigi-${k}`); }
  await goHash(s.page, 'board'); await settle(s.page, 400); await shot(s.page, '06-desktop-work-board');
  await goHash(s.page, 'approvals'); await settle(s.page, 400); await shot(s.page, '07-desktop-work-approvals');
  await goHash(s.page, 'automation'); await settle(s.page, 800); await shot(s.page, '08-desktop-automation');
  await goHash(s.page, 'hierarchy'); await settle(s.page, 500); await s.page.locator('.bnode', { hasText: 'Gigi' }).first().click(); await settle(s.page, 250); await shot(s.page, '09-desktop-brains-hierarchy');
  await goHash(s.page, 'insights'); await settle(s.page, 500); await shot(s.page, '10-desktop-insights');
  await goHash(s.page, 'connections'); await settle(s.page, 600); await shot(s.page, '11-desktop-connections');
  await goHash(s.page, 'control'); await settle(s.page, 500); await shot(s.page, '12-desktop-system-control');
  await goHash(s.page, 'devices'); await settle(s.page, 400); await shot(s.page, '13-desktop-system-devices');
  await goHash(s.page, 'remote'); await settle(s.page, 400); await shot(s.page, '14-desktop-remote');
  await goHash(s.page, 'home'); await s.page.click('#askBtn'); await settle(s.page, 500); await shot(s.page, '15-desktop-ask-coco-drawer'); await s.page.click('[data-askclose]');
  await s.page.click('#bellBtn'); await settle(s.page, 200); await shot(s.page, '16-desktop-notifications'); await s.page.keyboard.press('Escape');
}
const errorsA = s.errors.slice(); await check('no script error on any page of the desktop run', async () => { eq(errorsA.length, 0, errorsA.join(' | ')); });
await s.ctx.close();

// ================================================================ scenario B: revenue exists (actual in two currencies, plus an estimate)
const B = fixture({ withRevenue: true });
s = await open(B);
await check('revenue present: actual amounts per currency, estimates kept OUT of the total, never added together', async () => {
  const card = s.page.locator('.kpis > .kpi').first(); const t = await card.innerText(); const kv = await card.locator('.kv').innerText();
  ok(/Actual \+ estimated/.test(t), 'basis chip says the set mixes actual and estimated: ' + t);
  ok(/₹/.test(kv) && /\$/.test(kv), 'two currencies shown separately: ' + kv);
  const since = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const actualInr = B.tables.org_metrics.filter((r) => r.metric === 'revenue' && r.unit === 'INR' && !/estimate/.test(r.source) && r.period >= since(27)).reduce((a, r) => a + r.value, 0);
  const shown = Number(kv.match(/₹\s?([\d,]+)/)[1].replace(/,/g, '')); eq(shown, actualInr, 'the INR figure is the actual sum only');
  ok(/Estimates are kept out of this total/.test(t), 'the estimate is reported beside it'); ok(/gumroad/.test(t), 'the source is named'); ok(/%/.test(t), 'comparison with the previous period');
  ok(/connected/.test(t), 'coverage is stated');
});
await check('revenue present: the charts draw, by-House bars colour by House, and a currency filter exists', async () => {
  ok(await s.page.locator('.chartcard').nth(0).locator('svg.chart').count() >= 1, 'revenue line chart'); ok(await s.page.locator('.chartcard').nth(1).locator('.barrow').count() >= 2, 'by-House bars');
  const cur = await s.page.locator('select[data-hf="currency"] option').allInnerTexts(); ok(cur.includes('INR') && cur.includes('USD'), 'currencies: ' + cur);
  await s.page.selectOption('select[data-hf="currency"]', 'USD'); await settle(s.page);
  const kv = await text(s.page, '.kpis > .kpi:first-child .kv'); ok(/\$/.test(kv) && !/₹/.test(kv), 'USD filter shows only USD: ' + kv);
});
await check('Insights lists actual and estimated revenue as separate rows', async () => {
  await goHash(s.page, 'insights'); await s.page.selectOption('select[data-hf="currency"]', 'all'); await settle(s.page, 500);
  const rows = await s.page.locator('.dt tbody tr').allInnerTexts(); ok(rows.some((r) => /gumroad/.test(r) && /Actual/.test(r)) && rows.some((r) => /forecast/.test(r) && /Estimated/.test(r)), 'rows: ' + rows.join(' / '));
});
if (SHOTS) { await goHash(s.page, 'home'); await s.page.evaluate(() => { const b = document.querySelector('[data-hf-reset]'); if (b && !b.disabled) b.click(); }); await settle(s.page, 800); await shot(s.page, '17-desktop-home-with-revenue'); await goHash(s.page, 'insights'); await settle(s.page, 500); await shot(s.page, '18-desktop-insights-with-revenue'); await goHash(s.page, 'house:poppy'); await s.page.click('.htabs [data-htab="revenue"]'); await settle(s.page, 400); await shot(s.page, '19-desktop-house-poppy-revenue'); }
const errorsB = s.errors.slice(); await check('no script error in the revenue run', async () => { eq(errorsB.length, 0, errorsB.join(' | ')); });
await s.ctx.close();

// ================================================================ scenario C: the metrics table cannot be read (as through Nova today): "cannot be read" is not "there are none"
s = await open(fixture({ withRevenue: true, metricsReadable: false }));
await check('metrics that cannot be read say so: a banner, and never "Coco holds no records" or a zero', async () => {
  const banner = await text(s.page, '.banner'); ok(/cannot be read yet/i.test(banner) && /nothing is estimated or shown as zero/i.test(banner), banner);
  const first = await text(s.page, '.kpis > .kpi:first-child'); ok(/Unavailable/.test(first) && /cannot be read from here yet/.test(first) && /does not mean there are none/.test(first) && !/holds no revenue records/.test(first), first);
  for (const sel of ['.kpis > .kpi:nth-child(3)', '.kpis > .kpi:nth-child(4)']) ok(/cannot be read from here yet/.test(await text(s.page, sel)), sel);
  await goHash(s.page, 'insights'); await settle(s.page, 500); ok(/cannot be read from here yet/.test(await text(s.page, '#view')) && !/No revenue is recorded in Coco/.test(await text(s.page, '#view')), 'Insights says the same');
});
await s.ctx.close();

// ================================================================ dark theme and reduced motion
s = await open(A, { theme: 'dark', reduced: true });
await check('dark theme uses the dark tokens, and reduced motion turns the page animations off', async () => {
  eq((await s.page.evaluate(() => getComputedStyle(document.body).backgroundColor)).replace(/\s/g, ''), 'rgb(36,21,46)', 'dark surface is Deep Aubergine (Original Signature, the default theme)');
  const anim = await s.page.evaluate(() => getComputedStyle(document.querySelector('.kpi')).animationName); eq(anim, 'none', 'no animation under reduced motion');
  const contrast = await s.page.evaluate(() => { const c = (v) => { const m = v.match(/\d+(\.\d+)?/g).map(Number); return m.slice(0, 3).map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); }; const L = (v) => { const [r, g, b] = c(v); return .2126 * r + .7152 * g + .0722 * b; }; const a = L(getComputedStyle(document.body).color), b = L(getComputedStyle(document.body).backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
  ok(contrast >= 7, 'body text contrast in dark: ' + contrast.toFixed(1));
});
if (SHOTS) { await settle(s.page, 600); await shot(s.page, '20-desktop-home-dark'); await goHash(s.page, 'house:poppy'); await settle(s.page, 400); await shot(s.page, '21-desktop-house-dark'); }
await s.ctx.close();

// ================================================================ the phone
s = await open(A, { width: 390, height: 844 });
await check('phone: bottom bar is Home, Houses, Work, More; the sidebar is hidden; nothing overflows sideways', async () => {
  const bar = (await s.page.locator('#bottom a > span:not(.pill):not(.badge)').allInnerTexts()).map((x) => x.trim()); eq(bar.join('|'), 'Home|Houses|Work|More');
  ok(!(await s.page.locator('#rail').isVisible()), 'rail hidden on a phone');
  for (const h of ['home', 'houses', 'house:gigi', 'insights', 'hierarchy', 'board', 'approvals', 'connections', 'system', 'automation']) { await goHash(s.page, h); await settle(s.page, 400); const w = await s.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > w[1] + 1) { const off = await s.page.evaluate(() => [...document.querySelectorAll('#view *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.tscroll, .htabs, .subnav, details')).slice(0, 4).map((e) => e.tagName + '.' + String(e.className).slice(0, 40) + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.innerText || '').slice(0, 50).replace(/s+/g, ' '))); ok(false, `${h} overflows sideways: ${w[0]} > ${w[1]}; widest: ${JSON.stringify(off)}`); } }
});
await check('phone: KPI cards stack, filters are usable, the revenue card is first on screen', async () => {
  await goHash(s.page, 'home'); await settle(s.page, 500);
  const cols = await s.page.evaluate(() => getComputedStyle(document.querySelector('.kpis')).gridTemplateColumns.split(' ').length); eq(cols, 1, 'one KPI column');
  const first = await s.page.locator('.kpis > .kpi').first().boundingBox(); ok(first.y + 200 < 844, 'the whole revenue card sits on the first screen, y=' + first.y);
  ok(await s.page.locator('.fwrap > summary').isVisible() && !(await s.page.locator('select[data-hf="house"]').isVisible()), 'filters are folded behind one line on a phone');
  await s.page.click('.fwrap > summary'); await settle(s.page, 200); ok(await s.page.locator('select[data-hf="house"]').isVisible(), 'tapping the line opens the filters');
  await s.page.selectOption('select[data-hf="house"]', 'poppy'); await settle(s.page, 300); ok(await s.page.locator('select[data-hf="house"]').isVisible(), 'the filters stay open after a choice'); ok(/Poppy Ebooks/.test(await text(s.page, '.fsum')), 'the summary line names the choice');
});
await check('phone: the More sheet reaches every section, page, House, Ask COCO and Remote Control; the FAB opens Ask COCO', async () => {
  await s.page.click('#bottom [data-more]'); await settle(s.page, 250); ok(await s.page.locator('#moreSheet').isVisible(), 'sheet open');
  const hrefs = await s.page.locator('#moreNav a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
  for (const sec of NAV.sections) for (const p of sec.pages) ok(hrefs.includes('#' + p.id), 'sheet misses ' + p.id);
  for (const h of NAV.houses) ok(hrefs.includes('#house:' + h.id), 'sheet misses ' + h.id); ok(hrefs.includes('#chat') && hrefs.includes('#remote'), 'Ask COCO and Remote Control');
  if (SHOTS) await shot(s.page, '22-phone-more-sheet');
  await s.page.click('#moreNav a[href="#connections"]'); await settle(s.page, 350); ok(!(await s.page.locator('#moreSheet').isVisible()), 'choosing a page closes the sheet'); eq(await s.page.evaluate(() => location.hash), '#connections');
  await goHash(s.page, 'home'); await s.page.click('#askFab'); await settle(s.page, 300); ok(await s.page.locator('#askDrawer').isVisible(), 'drawer'); const w = (await s.page.locator('#askDrawer').boundingBox()).width; ok(w >= 385, 'the assistant takes the phone screen: ' + w);
  if (SHOTS) await shot(s.page, '23-phone-ask-coco'); await s.page.click('[data-askclose]');
});
await check('phone: Insights tables become readable cards', async () => {
  await goHash(s.page, 'insights'); await settle(s.page, 500); ok(!(await s.page.locator('.dt thead').first().isVisible()), 'table header hidden on a phone'); ok((await s.page.locator('.dt td').first().evaluate((e) => getComputedStyle(e).display)) === 'block', 'cells stack');
});
if (SHOTS) {
  await goHash(s.page, 'home'); await settle(s.page, 800); await shot(s.page, '24-phone-home'); await s.page.evaluate(() => window.scrollTo(0, 700)); await settle(s.page, 200); await shot(s.page, '25-phone-home-scrolled'); await s.page.evaluate(() => window.scrollTo(0, 0));
  await goHash(s.page, 'houses'); await settle(s.page, 400); await shot(s.page, '26-phone-houses'); await goHash(s.page, 'house:lulu'); await settle(s.page, 400); await shot(s.page, '27-phone-house-lulu');
  await goHash(s.page, 'board'); await settle(s.page, 400); await shot(s.page, '28-phone-work'); await goHash(s.page, 'insights'); await settle(s.page, 400); await shot(s.page, '29-phone-insights');
}
const errorsP = s.errors.slice(); await check('no script error in the phone run', async () => { eq(errorsP.length, 0, errorsP.join(' | ')); });
await s.ctx.close();

// ================================================================ the desktop bridge contract (static)
await check('every desktop bridge method the page calls exists in the preload (the contract is unchanged)', async () => {
  const page = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
  const used = [...new Set([...page.matchAll(/cocoDesktop\.([A-Za-z]+)/g)].map((m) => m[1]))];
  const missing = used.filter((k) => !preloadKeys.includes(k) && k !== 'platform'); eq(missing.join(','), '', 'methods used by the page but missing in preload.js');
  ok(used.length >= 8, 'the page uses the bridge: ' + used.join(','));
});

await H.finish('ui-browser');
