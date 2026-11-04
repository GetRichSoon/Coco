// Run: node brains.render.test.js
// Test: the brain capsule and the Growth brains tab show exactly what the brains recorded, nothing else.
// The real brainIsland() is lifted out of index.html and fed brains.sample.json, which is brain_records as
// the CocoMaison brains workflow wrote them in the cloud. Every number asserted below comes from that file.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'brains.sample.json'), 'utf8')).rows;
const grab = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(start, j + 1); }
  }
  throw new Error(`${name} not closed`);
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString();
const ago = (iso) => (iso ? 'earlier' : 'never');
const island = new Function('esc', 'num', 'ago', `${grab('brainIsland')}\nreturn brainIsland;`)(esc, num, ago);
const review = ROWS.find((r) => r.rec === 'decision' && r.id.startsWith('DEC-company-review-')).data;
const clean = (html, what) => { assert.ok(!/undefined|NaN|\[object Object\]/.test(html), `${what} leaks undefined/NaN/[object Object]`); };

// 1. nothing recorded = no capsule (never a placeholder that looks live)
assert.strictEqual(island(null, false, 'company'), null);
assert.strictEqual(island({ error: 'x' }, false, 'company'), null);
assert.strictEqual(island([], false, 'company'), null);
assert.strictEqual(island(ROWS.filter((r) => r.rec !== 'decision'), false, 'company'), null, 'no review yet = no capsule');

// 2. collapsed: the registry, the live activity and the counters, all from the review record
const closed = island(ROWS, false, 'company');
clean(closed, 'collapsed capsule');
assert.ok(closed.includes(`${review.registry.brains.toLocaleString()} brains`), 'brain count from the registry');
assert.ok(closed.includes(`${review.registry.teams_active} of ${review.registry.teams} teams active`));
assert.ok(closed.includes(`${review.tasks.in_progress} running`) && closed.includes(`${review.tasks.done} verified`));
assert.ok(closed.includes(`${review.open_escalations.length} need you`), 'founder blockers are counted');
assert.ok(closed.includes(esc(review.activity[0].action)), 'the latest brain action is shown');
assert.ok(closed.includes('aria-expanded="false"') && !closed.includes('id="biBody"'), 'collapsed has no body');

// 3. expanded at the company: revenue truth, teams, gaps with causes, tasks with their chain, blockers
const open = island(ROWS, true, 'company');
clean(open, 'expanded capsule');
assert.ok(/Not measurable yet: /.test(open) && open.includes('next milestone <b>$1,000</b>'), 'unknown revenue stays unknown; the next rung is $1,000');
for (const g of review.gaps) assert.ok(open.includes(esc(g.title)), `gap ${g.goal} listed`);
for (const t of review.task_list.slice(0, 8)) assert.ok(open.includes(esc(t.title)), `task ${t.id} listed`);
assert.ok(open.includes(' → '), 'a task shows who assigned it and who owns it');
for (const e of review.open_escalations) assert.ok(open.includes(esc(e.title)), `blocker ${e.id} listed`);
assert.ok(/None verified yet/.test(open) === !review.verified_growth.length, 'no improvement is claimed until one is verified');
assert.ok(open.includes('data-bifocus="team:youtube"') || open.includes('data-bifocus="product:the-flow"') || review.scorecards.every((c) => c.kind !== 'team'), 'teams are drill-down buttons');

// 3b. the controls are shown, and the capsule says that actions are held
assert.ok(closed.includes('actions held'), 'the collapsed capsule says actions are held');
assert.ok(open.includes('<h4>Controls</h4>') && open.includes('brain execution: <b>held</b>'), 'the expanded capsule shows every control');
assert.ok(review.controls.effective === 'held', 'the fixture is in the shipped state (held)');
const notHeld = JSON.parse(JSON.stringify(ROWS)); notHeld.find((r) => r.rec === 'decision').data.controls.effective = 'actions allowed';
assert.ok(!island(notHeld, false, 'company').includes('actions held'), 'the pill is not shown when actions are allowed (it follows the record, not a constant)');
const disagree = JSON.parse(JSON.stringify(ROWS)); Object.assign(disagree.find((r) => r.rec === 'decision').data.controls, { disagreement: true, emergency_stop_file: { by: 'x', at: 'y' }, live_company_paused: false });
assert.ok(/disagree/.test(island(disagree, true, 'company')), 'a disagreement between the file stop and the live pause is said plainly');

// 4. drill-down: a product brain shows only its own gaps and tasks, with a breadcrumb back up
const focus = review.scorecards.find((c) => c.brain === 'product:the-flow') ? 'product:the-flow' : review.scorecards[0].brain;
const down = island(ROWS, true, focus);
clean(down, 'drill-down');
assert.ok(down.includes('data-bifocus="company"'), 'breadcrumb back to the Global Brain');
for (const g of review.gaps.filter((x) => x.brain !== focus)) assert.ok(!down.includes(`<b>${esc(g.title)}</b>`), `another brain's gap ${g.goal} is not shown under ${focus}`);
assert.ok(!down.includes('Revenue vs the ladder'), 'the revenue ladder belongs to the Global Brain view');

// 4b. a team sees its whole subtree: the YouTube team shows The Flow's gaps and tasks
if (review.scorecards.some((c) => c.brain === 'team:youtube')) {
  const team = island(ROWS, true, 'team:youtube');
  for (const g of review.gaps.filter((x) => x.brain === 'product:the-flow')) assert.ok(team.includes(`<b>${esc(g.title)}</b>`), `team view shows its product's gap ${g.goal}`);
  assert.ok(review.task_list.filter((x) => (x.chain || []).includes('product:the-flow')).every((x) => team.includes(esc(x.title))), 'team view shows the tasks of its product');
}

// 5. text from records is escaped
const evil = JSON.parse(JSON.stringify(ROWS));
evil.find((r) => r.rec === 'decision').data.task_list[0].title = '<img src=x onerror=alert(1)>';
assert.ok(!island(evil, true, 'company').includes('<img src=x'), 'record text is escaped');

console.log('brains render: ok', { collapsed: closed.length, expanded: open.length, drill: down.length, focus });
