// Run: node control-center.render.test.js
// Test: every control-centre page RENDERS — the real V.control/teams/agents/runs/ai/brain/workflows/
// system functions are lifted out of index.html and called with the real control-plane.json, the
// way island-approve.test.js lifts islandModules() out of main.js. It catches what a screenshot
// cannot: a thrown page, an empty page, and "undefined"/"NaN" leaking into what the founders read.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const CP = JSON.parse(fs.readFileSync(path.join(__dirname, 'control-plane.json'), 'utf8'));

// ---------------------------------------------------------------- lift the real code out of the page
const between = (startRe, endRe) => {
  const a = src.search(startRe);
  const b = src.search(endRe);
  assert.ok(a > 0 && b > a, `could not find ${startRe} … ${endRe} in index.html`);
  return src.slice(a, b);
};
const pagesSrc = between(/\n {2}\/\/ -+ Control: one screen, whole company\n/, /\n {2}home\(\) \{/);
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
const helpersSrc = ['cpStatus', 'cpRollup', 'cpWhy', 'cpChain'].map(grab).join('\n');
// the whole control block, lifted in one piece: policyOf, effective, control, CONTROL_LABEL, pick, numberCtl
const controlsSrc = between(/\n\/\/ -+ real controls\n/, /\n\/\/ 80% warning/);
const constSrc = [/const cpWait = .*/, /const num = .*/, /const money = .*/, /const CPWHY = .*/]
  .map((re) => { const m = src.match(re); assert.ok(m, `missing ${re}`); return m[0]; }).join('\n');
// the identity marks the pages draw beside every team, sub-team, category, channel and agent,
// driven by the real identity.json so the test fails if a mark stops resolving
const marksSrc = between(/\nlet IDENT = null;/, /\n\/\/ -+ control plane/);
const IDENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'identity.json'), 'utf8'));

// the few page helpers the control-centre pages borrow from the rest of the Lounge
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chip = (s) => `<span class="chip">${esc(s)}</span>`;
const ago = (iso) => (iso ? '2 min ago' : 'never');
const store = { get: () => null };   // no browser storage here; Calm motion reads as off

const make = (state) => new Function('CP', 'LIVE', 'D', 'sub', 'cpRun', 'POLICIES', 'CONTROL_OPS', 'esc', 'chip', 'ago', 'store', 'IDENT_IN', 'STRUCT', 'newKind', 'newParent', 'renaming',
  `${constSrc}\n${marksSrc}\nIDENT = IDENT_IN;\n${helpersSrc}\n${controlsSrc}\nconst V = {\n${pagesSrc}\n};\nreturn V;`,
)(state.CP, state.LIVE, state.D, state.sub, state.cpRun || null, state.POLICIES || [], state.CONTROL_OPS || [], esc, chip, ago, store, IDENT, state.STRUCT || [], state.newKind || 'subteam', {}, null);

const D0 = { approvals: [], activity: [], houses: [], devices: [], tasks: [], decisions: [], rules: [], integrations: [] };
const PAGES = ['control', 'teams', 'agents', 'runs', 'ai', 'brain', 'workflows', 'system'];
const SUB0 = { teams: 'teams', ai: 'calls', system: 'runtime' };

// ---------------------------------------------------------------- 1. live data, every page
const results = {};
for (const p of PAGES) {
  const V = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: SUB0[p] || 'x' });
  let html;
  assert.doesNotThrow(() => { html = V[p](); }, `${p}() threw`);
  assert.ok(html.length > 400, `${p}() rendered only ${html.length} chars`);
  const text = html.replace(/<[^>]*>/g, ' ');
  assert.ok(!/\bundefined\b/.test(text), `${p}() shows "undefined" to the founders`);
  assert.ok(!/\bNaN\b/.test(text), `${p}() shows "NaN"`);
  assert.ok(!/\[object Object\]/.test(text), `${p}() shows "[object Object]"`);
  assert.ok(!/<[a-z]+[^>]*$/.test(html), `${p}() produced a truncated tag`);
  results[p] = html.length;
}

// ---------------------------------------------------------------- 2. the live data actually appears
const run = CP.runs[0];
const call = CP.ai.calls[0];
assert.ok(run && call && CP.brain.items.length && CP.teams.length, 'the snapshot under test must contain real data');

const control = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'x' }).control();
assert.ok(control.includes(run.run_id), 'Control lists the real run');
assert.ok(control.includes('Live from Coco Cloud'), 'Control says the data is live when it is');
assert.ok(make({ CP, LIVE: null, D: D0, sub: 'x' }).control().includes('Cached snapshot'), 'and says cached when it is not');
assert.ok(/cloud steps/.test(control) && /Claude steps/.test(control), 'Control separates cloud work from Claude work');

const runs = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'x' }).runs();
assert.ok(runs.includes(run.run_id) && runs.includes('data-cprun'), 'Runs lists the run with a Trace button');
assert.ok(runs.includes('Good Space') && runs.includes('›'), 'Runs shows the chain');
assert.ok(runs.includes(String(run.events.length)), 'Runs shows the event count');

const ai = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'calls' }).ai();
assert.ok(ai.includes(call.id) || ai.includes(call.purpose), 'AI usage lists the call');
assert.ok(/80% warning/.test(ai) && /90%/.test(ai) && /100%/.test(ai), 'AI usage shows the whole ladder');
const refused = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'refused' }).ai();
if (CP.ai.calls.some((c) => c.status === 'blocked')) {
  assert.ok(/Refused|Blocked/.test(refused.replace(/<[^>]*>/g, ' ')), 'the refusal reason is shown in plain words');
}

const brain = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'x' }).brain();
assert.ok(brain.includes(CP.brain.items[0].id), 'the Brain page lists an item by id');
assert.ok(/things the company knows/.test(brain));

const teams = make({ CP, LIVE: null, D: D0, sub: 'teams' }).teams();
assert.ok(teams.includes(CP.teams[0].name), 'Teams lists a real team');
const withSub = CP.teams.find((t) => t.subteams.length);
const withCat = CP.teams.find((t) => t.categories.length);
const withChan = CP.teams.find((t) => t.channels.length);
for (const [tab, must] of [
  ['subteams', withSub.subteams[0].agent_id],
  ['categories', withCat.categories[0].file],
  ['channels', withChan.channels[0].id],
  ['heads', withSub.agents.find((a) => a.id === withSub.head_agent_id).name],
  ['new', 'id="newStruct"'],
]) {
  const html = make({ CP, LIVE: null, D: D0, sub: tab }).teams();
  assert.ok(html.includes(must), `the Teams/${tab} tab does not show ${must}`);
}

// ---------------------------------------------------------------- the Structure screen
// The company's shape is Team > Sub-team > Category > Channel, and the screen has to be able to
// make any of the four, ask for the right parents, and show what already exists as a tree.
{
  const kinds = { team: [], subteam: ['Team'], category: ['Team', 'Sub-team'], channel: ['Team', 'Sub-team', 'Category'] };
  for (const [kind, parents] of Object.entries(kinds)) {
    const html = make({ CP, LIVE: null, D: D0, sub: 'new', newKind: kind }).teams();
    assert.ok(html.includes(`data-kind="${kind}"`), `the Structure form is not making a ${kind}`);
    for (const p of parents) assert.ok(new RegExp(`<label>${p}`).test(html), `making a ${kind} must ask for its ${p}`);
    if (!parents.length) assert.ok(!html.includes('<label>Team'), 'a team has no parent to ask for');
  }
  // a channel's Category selector is filled from the company that exists
  const chan = make({ CP, LIVE: null, D: D0, sub: 'new', newKind: 'channel' }).teams();
  const aCat = CP.teams.find((t) => t.categories.length).categories[0];
  assert.ok(chan.includes(`value="${aCat.id}"`), 'the Category selector does not offer a real category');
  // the tree shows a team, and a sub-team under it, each with what it is
  assert.ok(/class="trow/.test(chan), 'the Structure screen shows no tree');
  assert.ok(chan.includes(withSub.subteams[0].name), 'the tree does not show a real sub-team');
  // live cloud rows appear even before the next cloud cycle rebuilds control-plane.json
  const live = make({ CP, LIVE: null, D: D0, sub: 'new', newKind: 'channel',
    STRUCT: [{ id: 'moonveil-audio', kind: 'channel', parent_id: aCat.id, name: 'Moonveil Audio', state: 'paused' }] }).teams();
  assert.ok(live.includes('Moonveil Audio'), 'a channel created in the cloud is not shown until the next cycle');
  assert.ok(live.includes('data-sarchive="moonveil-audio"'), 'a live row cannot be archived');
}

const agents = make({ CP, LIVE: { runs: CP.runs }, D: D0, sub: 'x' }).agents();
const anAgent = CP.teams.find((t) => t.agents.length).agents[0];
assert.ok(agents.includes(anAgent.name) && agents.includes(anAgent.id), 'Agents lists a real agent');
assert.ok(/Claude allowed/.test(agents) && /deterministic/.test(agents), 'Agents separates Claude-allowed from deterministic agents');

const wf = make({ CP, LIVE: null, D: D0, sub: 'x' }).workflows();
assert.ok(wf.includes(CP.cloud_runtime.pipelines[0].id), 'Workflows lists a pipeline');
assert.ok(wf.includes('>Claude<') && wf.includes('>cloud<'), 'Workflows chips each step cloud or Claude');

for (const [tab, must] of [['runtime', 'PC needed for production'], ['policies', 'approval'], ['stop', 'Paused teams']]) {
  const html = make({ CP, LIVE: null, D: D0, sub: tab }).system();
  assert.ok(html.includes(must), `the System/${tab} tab is missing "${must}"`);
}

// ---------------------------------------------------------------- 3. an empty company must not crash
const EMPTY = { generated_at: new Date().toISOString(), company: { counts: {} }, system: {}, cloud_runtime: {}, ai: { limits: null, calls: [], usage: {}, budgets: {}, purposes: [], split: {} }, brain: { stats: {}, items: [] }, runs: [], teams: [], policies: {} };
for (const p of PAGES) {
  const V = make({ CP: EMPTY, LIVE: null, D: D0, sub: SUB0[p] || 'x' });
  let html;
  assert.doesNotThrow(() => { html = V[p](); }, `${p}() throws on an empty snapshot`);
  assert.ok(!/\bundefined\b|\bNaN\b/.test(html.replace(/<[^>]*>/g, ' ')), `${p}() shows undefined/NaN when there is no data`);
}
// and no snapshot at all
for (const p of PAGES) {
  const V = make({ CP: null, LIVE: null, D: D0, sub: SUB0[p] || 'x' });
  const html = V[p]();
  assert.ok(/Waiting for the first cloud cycle/.test(html), `${p}() must say it is waiting, not render blank`);
}


// ---------------------------------------------------------------- 4. the controls are real controls
const src2 = src; // the page source, for wiring checks
const unesc = (x) => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const ctlOf = (html) => [...html.matchAll(/data-ctl="([^"]+)"/g)].map((m) => unesc(m[1]));

// every switch carries scope|id|key|value and nothing else: the click handler sends exactly that
const teamsHtml = make({ CP, LIVE: null, D: D0, sub: 'teams' }).teams();
const teamCtls = ctlOf(teamsHtml);
assert.ok(teamCtls.length >= 6, `the Teams page has no controls: ${teamCtls.length}`);
for (const c of teamCtls) {
  const [scope, id, key, value] = c.split('|');
  assert.ok(['company', 'team', 'subteam', 'agent', 'channel', 'workflow'].includes(scope), `bad scope ${scope}`);
  assert.ok(['paused', 'enabled', 'claude', 'model', 'daily_tokens'].includes(key), `bad key ${key}`);
  assert.doesNotThrow(() => JSON.parse(value), `control value is not JSON: ${value}`);
  assert.ok(id, 'a control must name what it acts on');
}
assert.ok(teamCtls.some((c) => c.startsWith('team|') && c.includes('|claude|')), 'a team can be switched off Claude');
assert.ok(teamCtls.some((c) => c.includes('|paused|')), 'a team can be paused');
assert.ok(/data-ctlnum="team\|/.test(teamsHtml), 'a team budget can be typed in');

const agentsHtml = make({ CP, LIVE: null, D: D0, sub: 'x' }).agents();
assert.ok(ctlOf(agentsHtml).some((c) => c.startsWith('agent|') && c.includes('|claude|')), 'an agent Claude policy is a control');
assert.ok(ctlOf(agentsHtml).some((c) => c.startsWith('agent|') && c.includes('|model|')), 'an agent model is a control');
assert.ok(/data-ctlnum="agent\|/.test(agentsHtml), 'an agent token budget is a control');

const wfHtml = make({ CP, LIVE: null, D: D0, sub: 'x' }).workflows();
assert.ok(ctlOf(wfHtml).some((c) => c.startsWith('workflow|') && c.includes('|enabled|')), 'a workflow can be switched off');

const stopHtml = make({ CP, LIVE: null, D: D0, sub: 'stop' }).system();
assert.ok(ctlOf(stopHtml).some((c) => c === 'company|*|paused|true'), 'the emergency stop is a real control');
const claudeHtml = make({ CP, LIVE: null, D: D0, sub: 'claude' }).system();
for (const must of ['company|*|claude|"blocked"', 'company|*|model|"opus"']) {
  assert.ok(ctlOf(claudeHtml).includes(must), `the company Claude tab is missing ${must}`);
}
assert.ok(/data-ctlnum="company\|\*\|daily_tokens"/.test(claudeHtml), 'the company budget is a control');

// the live policy is what the switch shows, not a frontend guess
const anAgentId = CP.teams.find((t) => t.agents.length).agents[0].id;
const POL = [{ scope: 'agent', scope_id: anAgentId, key: 'claude', value: 'blocked' }];
const shown = make({ CP, LIVE: null, D: D0, sub: 'x', POLICIES: POL }).agents();
// the options live in the app's segmented control: the live one carries aria-pressed="true"
const OPTION = /<button data-ctl="([^"]+)" aria-pressed="(true|false)"/g;
const btns = [...shown.matchAll(OPTION)]
  .map((m) => ({ on: m[2] === 'true', ctl: unesc(m[1]) }))
  .filter((b) => b.ctl.startsWith(`agent|${anAgentId}|claude|`));
assert.ok(btns.length === 3, `expected three Claude options for ${anAgentId}, got ${btns.length}`);
const live = btns.find((b) => b.on);
assert.ok(live && live.ctl.endsWith('|"blocked"'), `the live cloud policy must be the highlighted option, got ${JSON.stringify(btns)}`);
// with no policy row the agent falls back to its registry default, never to a guess
const bare = make({ CP, LIVE: null, D: D0, sub: 'x', POLICIES: [] }).agents();
const bareOn = [...bare.matchAll(OPTION)]
  .map((m) => ({ on: m[2] === 'true', ctl: unesc(m[1]) }))
  .find((b) => b.ctl.startsWith(`agent|${anAgentId}|claude|`) && b.on);
assert.ok(bareOn && bareOn.ctl.includes(CP.teams.find((t) => t.agents.length).agents[0].claude), 'the registry default is shown when Coco has set nothing');

// the audit trail is shown
const audit = make({ CP, LIVE: null, D: D0, sub: 'audit', CONTROL_OPS: [{ at: new Date().toISOString(), scope: 'agent', scope_id: 'core.quill', key: 'daily_tokens', old_value: 100000, new_value: 30000, state: 'applied', requested_by: 'mangesh' }] }).system();
assert.ok(audit.includes('100000') && audit.includes('30000') && audit.includes('mangesh'), 'the audit tab shows what changed and who changed it');

// and the page may never write policy itself
assert.ok(!/from\('policies'\)\s*\.\s*(insert|update|upsert|delete)/.test(src2), 'the dashboard must not write policies directly');
assert.ok(!/from\('control_ops'\)\s*\.\s*(insert|update|upsert|delete)/.test(src2), 'the dashboard must not write the audit trail');
assert.ok(src2.includes("sb.rpc('coco_control'"), 'controls go through the cloud control API');
assert.ok(src2.includes("sb.from('policies').select"), 'the dashboard reads the live policy state');

console.log('control-center render: ok', JSON.stringify(results));
