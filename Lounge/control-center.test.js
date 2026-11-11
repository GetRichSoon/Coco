// Run: node control-center.test.js
// Test: the Lounge is the company's control centre — it has every control-plane page, it renders the
// real control-plane.json contract, and it drives the REAL helpers copied out of index.html
// (cpStatus / cpRollup / cpWhy / cpChain), the same way island-approve.test.js drives main.js.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---------------------------------------------------------------- the pages exist and are wired
const PAGES = ['control', 'teams', 'agents', 'runs', 'ai', 'brain', 'workflows', 'system'];
for (const p of PAGES) {
  assert.ok(new RegExp(`\\['${p}',`).test(src), `${p} is missing from PAGES (the nav)`);
  assert.ok(new RegExp(`\\n  ${p}\\(\\) \\{`).test(src), `${p}() render function is missing from V`);
}
// the sections the founders already had must survive
for (const p of ['home', 'board', 'notes', 'remote', 'approvals', 'company', 'club', 'rules', 'devices', 'settings']) {
  assert.ok(new RegExp(`\\['${p}',`).test(src), `${p} was lost from the nav`);
}
// The bottom bar is four tabs plus a way into everything else. Approvals must still be one tap.
// This asserted the exact list before, which meant the sheet that fixed fifteen pages being
// unreachable on a phone read as a regression - the intent was one tap to Approvals, not that
// particular five ids.
// The phone bar is now Home, Houses, Work and More (the navigation contract). Approvals live in Work, whose first tap is the Board and whose
// section tabs show Approvals at once; the More sheet lists every page as well. The bar itself comes from the contract.
{
  const nav = JSON.parse(fs.readFileSync(path.join(__dirname, 'contract', 'nav-contract.json'), 'utf8'));
  assert.deepEqual(nav.phone_bottom, ['home', 'houses', 'work', 'more'], 'the phone bar must be Home, Houses, Work, More');
  assert.ok(nav.sections.find((x) => x.id === 'work').pages.some((p) => p.id === 'approvals'), 'Approvals must stay inside Work, one tab away');
  assert.ok(src.includes('phone_bottom'), 'the page must build its phone bar from the contract');
}
assert.ok(src.includes('data-more="1"'), 'the bottom bar needs a way into the pages it has no room for');
assert.ok(src.includes('#moreNav'), 'the sheet that reaches every other page is missing');
assert.ok(src.includes("fetch('control-plane.json'"), 'the dashboard loads the control plane snapshot');
assert.ok(src.includes('let CP = null'), 'CP holds the snapshot');
assert.ok(src.includes('const cpWait =') && src.includes('return cpWait('), 'a missing snapshot shows a waiting card, never a guess');
assert.ok(src.includes("data-cprun=") && src.includes('ds.cprun !== undefined'), 'runs can be opened and closed from any page');
// The Structure screen makes any of the four kinds. A team still goes the long way round, because
// it needs agents, permissions, a budget and a Brain scope provisioned after a founder YES.
assert.ok(src.includes('async function addTeam') && src.includes('id="newStruct"'), 'structure creation form + handler');
assert.ok(src.includes("if (kind === 'team') return addTeam(e)"), 'a new team keeps its provisioning approval route');
// The identity rule, enforced: a thing without an approved logo gets a Material You mark from the
// theme's own shapes and contrast-checked duos - never initials, never a plain circle, never an
// empty box where a logo failed to load.
{
  const ident = JSON.parse(fs.readFileSync(path.join(__dirname, 'identity.json'), 'utf8'));
  const duos = [['plum','bubblegum'],['cobalt','sky'],['forest','butter'],['cocoa','cream'],['bubblegum','plum'],['sky','ink'],['butter','cocoa']];
  assert.deepStrictEqual(ident.derived.pairs, duos, 'derived marks must use the theme duos, minus the red ones');
  for (const [bg] of ident.derived.pairs) assert.ok(!/tomato|wine|cherry|marigold/.test(bg), `${bg} is a red/orange hue; those are reserved for failures`);
  assert.ok(!ident.derived.shapes.includes('circle'), 'a derived mark must have a silhouette, not be a disc');
  for (const p of Object.values(ident.platforms)) assert.ok(p.shape, 'every platform mark needs a theme shape');
  assert.ok(!/function markText|markText\(/.test(src), 'nothing may fall back to initials');
  // a stroked ring is an accent inside a composed mark; what is banned is a mark that IS a disc
  assert.ok(!/<circle cx="50" cy="50" r="4[0-9]"[^>]*fill="(?!none)/.test(src), 'no mark may be a plain filled disc');
  // the approved art is drawn as it always was: its own silhouette, its own flat colour, its own
  // symbol. A layered rebuild was tried and rejected, so nothing may put it back.
  assert.ok(!src.includes('accentArt(') && !/linearGradient id="mkg-/.test(src),
    'a mark must not be recomposed with accents or tonal ramps: that was a second logo system');
  assert.ok(src.includes('m.shapes[0]'), "a mark must use its identity's own first shape, not one picked by hash");
  assert.ok(src.includes('fill="${esc(tone(m.bg))}"'), 'the approved colour must be used flat');
  // motion is presentation only, and reduced motion must leave the original static logo
  assert.ok(src.includes('@media (prefers-reduced-motion: no-preference)') && src.includes('mkfloat'),
    'the loop animation must sit behind prefers-reduced-motion');
  assert.ok(/\.mk \{[^}]*width: 44px/.test(src) && /\.mk\.l \{[^}]*width: 64px/.test(src),
    'the logos must be shown large');
  assert.ok(src.includes("onerror=\"this.remove()\""), 'a logo that fails to load must fall back to the mark beneath it');
  // every mark named in Brand.kt must still exist here, unchanged - approved identities are never regenerated
  const brand = fs.readFileSync(path.join(__dirname, '..', 'Lounge Android', 'app', 'src', 'main', 'java', 'com', 'goodspace', 'cocolounge', 'Brand.kt'), 'utf8');
  for (const m of brand.matchAll(/"([a-z]+)" to Mark\("([^"]+)", Mu\.(\w+), Mu\.(\w+)/g)) {
    const [, id, , bg, fg] = m;
    const here2 = ident.marks[id];
    assert.ok(here2, `${id} has a mark on the phone but not in identity.json`);
    assert.strictEqual(here2.bg, bg, `${id} changed colour between the phone and the desktop`);
    assert.strictEqual(here2.fg, fg, `${id} changed its second colour between the phone and the desktop`);
  }
}

assert.ok(src.includes("sb.rpc('coco_structure'"), 'structure changes go through the cloud control path, not a local store');
assert.ok(src.includes("sb.from('structure')"), 'the live structure table is read, so a new channel shows before the next cloud cycle');
assert.ok(/PARENT_OF = \{ team: null, subteam: 'team', category: 'subteam', channel: 'category' \}/.test(src), 'the hierarchy is Team > Sub-team > Category > Channel');
assert.ok(src.includes("from('approvals').insert({ code: `A-NEW-"), 'creating a team raises one approval carrying the spec');
// Phase 7: the four control-plane tables are live, so the dashboard reads them under RLS and keeps
// the generated snapshot as the cache for the registry side.
for (const t of ['runs', 'run_events', 'ai_calls', 'brain_items']) {
  assert.ok(src.includes(`from('${t}')`), `the dashboard must read ${t} from Coco Cloud`);
}
assert.ok(src.includes("sb.from('brain_items').select('*').eq('retired', false)"), 'retired Brain items stay out of the dashboard');
assert.ok(src.includes('function cpMerge'), 'cloud rows merge over the cached snapshot');
assert.ok(src.includes('let CP = null, LIVE = null'), 'the page tracks whether it is live or cached');
assert.ok(/LIVE \? 'Live from Coco Cloud' : 'Cached snapshot'/.test(src), 'the page says where its numbers come from');
// no secret may ever reach the frontend
assert.ok(!/sb_secret_|service_role|SERVICE_KEY|x-engine-key/.test(src), 'no service or engine key in the dashboard');
assert.ok(src.includes('sb_publishable_'), 'the dashboard uses the publishable key only');

// ---------------------------------------------------------------- the real helpers
const grab = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  let i = src.indexOf('{', start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return src.slice(start, j + 1); }
  }
  throw new Error(`${name} not closed`);
};
const helpers = new Function('esc', `${grab('cpStatus')}\n${grab('cpRollup')}\n${grab('cpWhy')}\n${grab('cpChain')}\nreturn { cpStatus, cpRollup, cpWhy, cpChain };`)((x) => String(x ?? ''));

// 80 / 90 / 100
for (const [level, pct, expect] of [['ok', 12, 'healthy'], ['warning', 83, '80%'], ['restricted', 94, 'P0-P1'], ['blocked', 101, 'Boss YES']]) {
  const st = helpers.cpStatus({ ai: { limits: { level, pct, plan: 'max5', windows: [] } } });
  assert.equal(st.level, level);
  assert.equal(st.pct, pct);
  assert.ok(st.label.includes(expect), `${level}: "${st.label}" should mention ${expect}`);
}
assert.equal(helpers.cpStatus(null).level, 'unknown', 'no snapshot, no invented status');
assert.equal(helpers.cpStatus({ ai: { limits: { level: 'blocked', pct: 100 } } }).tone, 'bad');

// spend rollups: only completed calls, biggest first, cache and unverified split out
const calls = [
  { status: 'done', team_id: 'core', agent_id: 'core.quill', run_id: 'RUN-1', model: 'sonnet', total_tokens: 6100, output_tokens: 800, cache_read_tokens: 4000, cache_write_tokens: 100, cost: 0.0488, verified: true },
  { status: 'done', team_id: 'core', agent_id: 'core.reel', run_id: 'RUN-1', model: 'opus', total_tokens: 100000, output_tokens: 2000, cache_read_tokens: 0, cache_write_tokens: 0, cost: 4, verified: false },
  { status: 'blocked', team_id: 'games', agent_id: 'games.games-head', total_tokens: 0, cost: 0 },
];
const byTeam = helpers.cpRollup(calls, 'team_id');
assert.equal(byTeam.length, 1, 'a refused call is not spend');
assert.equal(byTeam[0][0], 'core');
assert.equal(byTeam[0][1].tokens, 106100);
assert.equal(byTeam[0][1].cache, 4100);
assert.equal(byTeam[0][1].unverified, 100000, 'unverified tokens are reported separately');
assert.equal(helpers.cpRollup(calls, 'agent_id')[0][0], 'core.reel', 'biggest spender first');
assert.equal(helpers.cpRollup(calls, 'run_id').length, 1);
assert.deepEqual(helpers.cpRollup([], 'team_id'), []);

// why a request was allowed, refused, blocked, already known or cloud-only
assert.ok(/already knows/i.test(helpers.cpWhy({ status: 'blocked', why: [{ code: 'already_known', label: 'Refused: the Company Brain already knows this' }] })));
assert.ok(/cloud/i.test(helpers.cpWhy({ status: 'blocked', why: [{ code: 'cloud_only', label: 'Refused: the cloud can do this deterministically' }] })));
assert.ok(/budget/i.test(helpers.cpWhy({ status: 'blocked', why: [{ code: 'limit', label: 'Blocked: the token budget' }] })));
assert.ok(/ticket issued/.test(helpers.cpWhy({ status: 'approved' })));
assert.ok(/Boss override/.test(helpers.cpWhy({ status: 'done', purpose: 'creative_write', approved_by: 'mangesh' })));
assert.ok(/over its token budget/.test(helpers.cpWhy({ status: 'done', purpose: 'creative_write', over_budget: true })));

// the full chain, in order, with the empty links left out
assert.equal(
  helpers.cpChain({ company: 'good-space', team: 'youtube', subteam: null, category: 'youtube/study', channel: 'the-flow', agent: 'core.reel', task: 't42' }).replace(/<[^>]+>/g, ''),
  'Good Space › youtube › youtube/study › the-flow › core.reel › t42',
);
assert.equal(helpers.cpChain(null), '');

console.log('control-center: ok');
