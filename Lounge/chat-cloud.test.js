// Run: node chat-cloud.test.js
//
// Coco Chat as every device reaches it: Nova's /api/chat running the engine lifted out of index.html
// against the real registry snapshot. The database is a small in-memory stand-in that records what
// was written, so these check the contract: one thread per scope, a pending yes that survives to the
// next request (another device), work that leaves as a cloud task, and nothing done without a yes.
import assert from 'node:assert';
import { chatTurn, chatTree, forgetWorlds } from './api/_chat.js';
import { handle } from './api/_nova.js';

const NOW = Date.now();
const ago = (min) => new Date(NOW - min * 60000).toISOString();
// the live company the engine reads; structure and policies change as the stand-in RPCs run
let STRUCTURE, POLICIES;
const WORLD = () => ({ approvals: [{ id: 7, code: 'A-777', team: 'youtube', what: 'Publish the Short', state: 'waiting' }],
  devices: [{ id: 'boss-pc', name: 'Boss PC', last_seen: ago(1), active: true }, { id: 'boss-phone', name: 'Boss phone', last_seen: ago(90), active: true }],
  integrations: [], policies: POLICIES, structure: STRUCTURE,
  conns: [{ connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow – Daily Science', state: 'connected' }], links: [],
  outputs: [{ id: 'OUT-9', team_id: 'youtube', kind: 'video', title: 'Eye floaters', status: 'qa_passed', at: ago(30) },
            { id: 'OUT-8', team_id: 'youtube', kind: 'video', title: 'Mantis shrimp', status: 'published', url: 'https://youtu.be/x', at: ago(600) }],
  tasks: [{ id: 't1', title: 'Write the KDP listing', status: 'queued', details: 'Team: ebooks', created_at: ago(120) }],
  jobs: [{ id: 'j1', type: 'store-artifact', team_id: 'youtube', status: 'failed', error: { message: 'B2 PUT 403 on tmp/' }, failed_at: ago(20), updated_at: ago(20) },
         { id: 'j2', type: 'filter-rank', team_id: 'ebooks', status: 'done', completed_at: ago(5), updated_at: ago(5) }],
  run_requests: [], activity: [{ id: 1, actor: 'coco', action: 'published', detail: 'youtube: Mantis shrimp', at: ago(10) }],
  brain: [], runs: [], release: null, founders: [{ email: 'boss@example.com', name: 'Mangesh', call_me: 'Boss' }] });
let CHAT, RPCS, nextId;
const reset = () => { CHAT = []; RPCS = []; nextId = 1; STRUCTURE = []; POLICIES = []; forgetWorlds(); };
const run = async ({ sql, params }) => {
  if (/^SELECT\s+\(SELECT coalesce/.test(sql)) return [WORLD()];
  if (/SELECT role, body, meta, created_at FROM public\.chat WHERE scope = \$1/.test(sql)) return CHAT.filter((r) => r.scope === params[0]).slice(-8).reverse();
  if (/FROM public\.structure WHERE id = ANY/.test(sql)) return STRUCTURE.filter((r) => params[0].includes(r.id));
  if (/INSERT INTO public\.chat \(role, author, device_id/.test(sql)) { const r = { id: nextId++, role: 'founder', author: params[0], device_id: params[1], body: params[2], status: 'answered', scope: params[3], created_at: new Date().toISOString() }; CHAT.push(r); return [r]; }
  if (/INSERT INTO public\.chat \(role, author, body, reply_to/.test(sql)) { const r = { id: nextId++, role: 'coco', author: 'Coco', body: params[0], reply_to: params[1], status: params[2], scope: params[3], meta: JSON.parse(params[4]), created_at: new Date().toISOString() }; CHAT.push(r); return [r]; }
  throw new Error('unexpected SQL ' + sql.slice(0, 80));
};
// the real contracts, in miniature: coco_structure makes a paused row with a paused policy, and
// refuses a duplicate id; coco_control writes the policy; coco_approval returns the approval id
const rpc = async (fn, args) => {
  RPCS.push({ fn, args });
  if (fn === 'coco_structure' && args.p_op === 'create') {
    if (STRUCTURE.some((r) => r.id === args.p_id)) throw new Error(args.p_id + ' already exists');
    STRUCTURE.push({ id: args.p_id, kind: args.p_kind, parent_id: args.p_parent || null, name: args.p_name, description: args.p_description, config: args.p_config || {}, state: 'paused', created_at: new Date().toISOString() });
    POLICIES.push({ scope: ['team', 'subteam', 'agent'].includes(args.p_kind) ? args.p_kind : 'team', scope_id: args.p_id, key: 'paused', value: true });
    return { ok: true, id: args.p_id, state: 'paused' };
  }
  if (fn === 'coco_structure') { const r = STRUCTURE.find((x) => x.id === args.p_id); if (r && args.p_name) r.name = args.p_name; if (r && args.p_parent) r.parent_id = args.p_parent; if (r && args.p_config) r.config = args.p_config; return { ok: true }; }
  if (fn === 'coco_control') { POLICIES = POLICIES.filter((p) => !(p.scope === args.p_scope && p.scope_id === args.p_scope_id && p.key === args.p_key)); POLICIES.push({ scope: args.p_scope, scope_id: args.p_scope_id, key: args.p_key, value: args.p_value }); return { state: 'applied' }; }
  if (fn === 'coco_approval') return { code: args.p_code, approval_id: 99, raised_now: true, state: 'waiting' };
  if (fn === 'submit_task') return { merged: false, task_id: '0f0e0d0c-0000-0000-0000-000000000000' };
  return { ok: true, request_id: 5 };
};
const fetchImpl = async () => ({ ok: true, json: async () => [{ tag_name: 'android-2.9.3-20', draft: false, published_at: ago(60), html_url: 'https://github.com/GetRichSoon/Coco/releases/tag/android-2.9.3-20', body: 'sha256 ' + 'a'.repeat(64) }] });
const who = { email: 'boss@example.com', device_id: 'boss-pc' };
const say = (scope, body) => chatTurn({ run, rpc, who, body: { scope, body }, fetchImpl });
const calls = (fn) => RPCS.filter((r) => r.fn === fn);

let pass = 0;
const t = async (name, fn) => { reset(); await fn(); pass++; console.log(`  ok  ${name}`); };

await t('the tree a selector walks has the live teams, their parts and their agents, not the paused departments', async () => {
  const { body } = await chatTree({ run, rpc, who });
  const kinds = new Set(body.tree.map((n) => n.kind));
  for (const k of ['team', 'category', 'channel', 'agent']) assert.ok(kinds.has(k), 'missing ' + k);
  assert.ok(body.tree.some((n) => n.kind === 'channel' && n.id === 'biology-health' && n.parent === 'youtube/biology-health'));
  assert.ok(body.tree.some((n) => n.kind === 'agent' && n.parent === 'youtube'));
});

await t('COCO: a question is answered from company state, stored in the company thread, no RPC', async () => {
  const r = await say('coco', 'company status');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.scope, 'coco');
  assert.ok(/teams are live/.test(r.body.reply.body), r.body.reply.body);
  assert.deepStrictEqual(CHAT.map((x) => [x.role, x.status, x.scope]), [['founder', 'answered', 'coco'], ['coco', 'answered', 'coco']]);
  assert.strictEqual(RPCS.length, 0);
});

await t('a category scope: "create 5 Shorts" is cloud work for that category, not a new category', async () => {
  const r = await say('youtube||youtube/biology-health', 'Create 5 Shorts for this category');
  assert.strictEqual(r.body.scope, 'youtube||youtube/biology-health');
  assert.strictEqual(RPCS.length, 1, JSON.stringify(RPCS));
  assert.strictEqual(RPCS[0].fn, 'submit_task');
  assert.strictEqual(RPCS[0].args.p_needs, 'cloud');
  assert.ok(/Category: youtube\/biology-health/.test(RPCS[0].args.p_details), RPCS[0].args.p_details);
  assert.ok(/Team: youtube/.test(RPCS[0].args.p_details));
  assert.strictEqual(RPCS[0].args.p_by, 'Mangesh');
  assert.ok(/as cloud work/.test(r.body.reply.body), r.body.reply.body);
});

await t('a channel scope shows its path and keeps its own thread', async () => {
  const r = await say('youtube|||biology-health', 'status');
  assert.strictEqual(r.body.scope, 'youtube|||biology-health');
  assert.ok(/YouTube Studio › BodyDecode/.test(r.body.reply.body), r.body.reply.body);
  assert.ok(CHAT.every((x) => x.scope === 'youtube|||biology-health'));
});

await t('a waiting approval for the team comes back as buttons, decided by the cloud write, not by chat', async () => {
  const r = await say('youtube', 'anything waiting for approval?');
  assert.deepStrictEqual(r.body.reply.meta.approvals.map((a) => a.code), ['A-777']);
  assert.strictEqual(RPCS.length, 0);
});

await t('a pending yes is stored with the thread and confirmed by a later request (another device)', async () => {
  const first = await say('youtube', 'make the thumbnails warmer across the board please');
  assert.strictEqual(first.body.reply.meta.state, 'Ready for confirmation', first.body.reply.body);
  assert.ok(first.body.reply.meta.pending, 'the pending action must be stored');
  assert.strictEqual(RPCS.length, 0, 'nothing before the yes');
  forgetWorlds();                                            // a fresh instance, like the phone's request
  const yes = await chatTurn({ run, rpc, who: { ...who, device_id: 'boss-phone' }, body: { scope: 'youtube', body: 'yes' } });
  assert.strictEqual(RPCS.length, 1, yes.body.reply.body);
  assert.strictEqual(RPCS[0].fn, 'submit_task');
  assert.strictEqual(RPCS[0].args.p_device, 'boss-phone');
  assert.strictEqual(yes.body.reply.meta.pending, null, 'a used yes is gone');
});

await t('"stop" in a sentence never pauses the scope team on its own; it waits for a yes', async () => {
  const r = await say('youtube', 'create 1 idea here (automatic test, stop it)');
  assert.strictEqual(RPCS.length, 0, JSON.stringify(RPCS));
  assert.strictEqual(r.body.reply.meta.state, 'Ready for confirmation', r.body.reply.body);
  await say('youtube', 'no');
  assert.strictEqual(RPCS.length, 0);
  // naming the team is still a direct instruction
  await say('youtube', 'pause YouTube Studio');
  assert.strictEqual(RPCS[0].fn, 'coco_control');
});

await t('@agent sends the work to that agent', async () => {
  const r = await say('youtube', '@trendy find three rising science topics for this week');
  assert.strictEqual(RPCS[0].fn, 'submit_task', r.body.reply.body);
  assert.ok(/^@Trendy · /.test(RPCS[0].args.p_title), RPCS[0].args.p_title);
  assert.ok(/Agent: youtube\.trendy/.test(RPCS[0].args.p_details));
});

await t('an agent picked in the scope bar gets plain words as its work', async () => {
  const r = await say('youtube||||youtube.trendy', 'rewrite the hook of the last Short');
  assert.strictEqual(r.body.scope, 'youtube||||youtube.trendy');
  assert.ok(/Agent: youtube\.trendy/.test(RPCS[0].args.p_details));
});

await t('a reference link with "like this" goes to the cloud with the link attached', async () => {
  await say('youtube', 'create a new channel like this https://www.youtube.com/@veritasium');
  assert.strictEqual(RPCS[0].fn, 'submit_task');
  assert.ok(/References: https:\/\/www\.youtube\.com\/@veritasium/.test(RPCS[0].args.p_details), RPCS[0].args.p_details);
});

await t('a part that no longer exists lands one level up, never on a guess', async () => {
  const r = await say('youtube|||gone-category', 'status');
  assert.strictEqual(r.body.scope, 'youtube');
});

await t('bad input is refused before anything is written', async () => {
  assert.strictEqual((await say('coco; drop table', 'hi')).status, 400);
  assert.strictEqual((await say('coco', '')).status, 400);
  assert.strictEqual(CHAT.length, 0);
});

await t('Nova routes /api/chat for a paired founder device only', async () => {
  const db = { query: async () => ({ rows: [] }) };          // no device matches: refused before chat runs
  const out = await handle(db, { method: 'POST', path: '/api/chat', query: {}, headers: { 'x-device-key': 'x'.repeat(40) }, body: { scope: 'coco', body: 'hi' } });
  assert.strictEqual(out.status, 401);
});

// ---------------------------------------------------------------- talking like a person
const reply = (r) => r.body.reply.body;
await t('hi / sup / what can you do / what did I just say: conversation, from live rows, no command words', async () => {
  for (const hi of ['hi', 'sup', "what's up", 'hello coco']) {
    const r = await say('coco', hi);
    assert.ok(/^Hi Boss\. .*running.*waiting for your YES/.test(reply(r)), hi + ' -> ' + reply(r));
  }
  assert.ok(/what is running/i.test(reply(await say('coco', 'what can you do'))));
  assert.ok(/You said: "what can you do"/.test(reply(await say('coco', 'what did I just say'))));
  assert.ok(!CHAT.some((m) => /did not catch a command/.test(m.body)));
  assert.strictEqual(RPCS.length, 0);
});

await t('live questions answer from cloud rows: running, pending, failed and why, APK, publish, devices, today', async () => {
  assert.ok(/Nothing is running in the company right now\. 1 thing queued/.test(reply(await say('coco', "what's running?"))));
  assert.ok(/queued in the company: Write the KDP listing/.test(reply(await say('coco', "what's pending?"))));
  assert.ok(/B2 PUT 403 on tmp\//.test(reply(await say('youtube', 'why did it fail?'))));
  assert.ok(/Yes — Coco 2\.9\.3 \(20\)/.test(reply(await say('coco', 'is the APK ready?'))));
  assert.ok(/^Not yet — "Eye floaters" is qa_passed/.test(reply(await say('youtube', 'did the Short publish?'))));
  assert.ok(/1 device online of 2 paired: Boss PC/.test(reply(await say('coco', 'how many devices are connected?'))));
  assert.ok(/Today in the company: 1 cloud job done/.test(reply(await say('coco', "what's finished?"))));
  assert.ok(/YouTube Studio is (live|paused): .*running/.test(reply(await say('coco', 'what is YouTube Studio doing?'))));
  assert.ok(/A-777/.test(reply(await say('coco', 'what should I work on today?'))));
  assert.strictEqual(RPCS.length, 0, 'questions never change anything');
});

await t('"go to YouTube Studio" moves the chat there', async () => {
  const r = await say('coco', 'go to YouTube Studio');
  assert.strictEqual(r.body.goto, 'youtube');
});

await t('the big one: a whole team from one sentence, planned, confirmed, built, verified, then grown by follow-ups', async () => {
  const ask = await say('coco', 'Create a new team that researches AI tools, turns the best ones into daily Shorts, checks the scripts, creates the videos, publishes them to The Flow, and tracks performance.');
  assert.strictEqual(ask.body.reply.meta.state, 'Ready for confirmation', reply(ask));
  assert.strictEqual(RPCS.length, 0, 'a plan is shown before anything is made');
  const rows = Object.fromEntries(ask.body.reply.meta.act.rows);
  assert.strictEqual(rows.Team, 'AI Tools Shorts');
  assert.strictEqual(rows['Sub-teams'], 'Research, Script, Video, QA, Publishing, Analytics');
  assert.ok(/The Flow – Daily Science/.test(rows.Publishing));

  const done = await say('coco', 'yes');                               // could be another device: the plan rides in the thread
  const made = calls('coco_structure').map((c) => c.args.p_kind + ':' + c.args.p_id);
  assert.deepStrictEqual(made.slice(0, 4), ['team:ai-tools-shorts', 'agent:ai-tools-shorts.head', 'subteam:ai-tools-shorts/research', 'agent:ai-tools-shorts.research']);
  assert.strictEqual(made.length, 2 + 6 * 2);
  assert.deepStrictEqual(calls('coco_control')[0].args, { p_scope: 'workflow', p_scope_id: 'ai-tools-shorts-daily', p_key: 'schedule', p_value: 'daily 08:00', p_note: 'from Coco Chat: AI Tools Shorts' });
  assert.ok(/Verified in Coco Cloud: 14 of 14 saved, every parent linked\./.test(reply(done)), reply(done));
  assert.ok(!calls('coco_connection').length, 'The Flow is never taken away from the YouTube team');
  assert.ok(STRUCTURE.every((r) => r.state === 'paused'), 'everything new starts paused');

  RPCS = [];
  const ag = await say('coco', 'give it a research agent');               // "it" = the team just built
  const c1 = calls('coco_structure')[0].args;
  assert.deepStrictEqual([c1.p_kind, c1.p_parent], ['agent', 'ai-tools-shorts/research'], reply(ag));
  RPCS = [];
  await say('coco', 'make that agent run every morning');                // "that agent"
  assert.deepStrictEqual(calls('coco_control')[0].args.p_scope + ' ' + calls('coco_control')[0].args.p_value, 'agent daily 08:00');
  RPCS = [];
  const st = await say('coco', 'start it');                              // "it" = that agent
  assert.ok(calls('coco_control').some((c) => c.args.p_key === 'paused' && c.args.p_value === false), reply(st));
  assert.strictEqual(calls('submit_task')[0].args.p_needs, 'cloud');
});

await t('creation, modification and the guard rails in plain words', async () => {
  await say('youtube', 'create a new category for AI video');
  let c = calls('coco_structure')[0].args;
  assert.deepStrictEqual([c.p_kind, c.p_name, c.p_parent], ['category', 'AI Video', 'youtube']);
  RPCS = [];
  await say('youtube', 'rename it to AI Video Lab');
  c = calls('coco_structure')[0].args;
  assert.deepStrictEqual([c.p_op, c.p_name], ['edit', 'AI Video Lab']);
  RPCS = [];
  assert.ok(/did not create a duplicate/.test(reply(await say('coco', 'make me a new YouTube team'))));
  { const r = await say('youtube', 'create a research team'); assert.ok(/sub-team, or as a new company-level team/.test(reply(r)), reply(r)); }
  assert.strictEqual(RPCS.length, 0);
  const del = await say('youtube', 'delete it');
  assert.strictEqual(del.body.reply.meta.state, 'Ready for confirmation', reply(del));
  assert.strictEqual(RPCS.length, 0, 'delete is an archive, and only after a yes');
});

await t('a workflow for a team, and moving an agent by talking', async () => {
  await say('coco', 'create a team called Lab Two');
  RPCS = [];
  await say('coco', 'give it a daily workflow for research and review');
  const edit = calls('coco_structure')[0].args;
  assert.deepStrictEqual(edit.p_config.workflows[0].steps, ['research', 'qa']);
  assert.strictEqual(calls('coco_control')[0].args.p_value, 'daily 08:00');
  await say('coco', 'create a sub-team called Research under Lab Two');
  await say('coco', 'give Lab Two a designer');
  RPCS = [];
  const mv = await say('coco', 'move this agent to the research sub-team');
  assert.strictEqual(mv.body.reply.meta.state, 'Ready for confirmation', reply(mv));
  await say('coco', 'yes');
  const m = calls('coco_structure')[0].args;
  assert.deepStrictEqual([m.p_op, m.p_kind], ['move', 'agent'], JSON.stringify(m));
  assert.strictEqual(m.p_parent, STRUCTURE.find((r) => r.kind === 'subteam' && r.name === 'Research').id, 'it lands in the Research sub-team just made: ' + JSON.stringify(STRUCTURE.map((r) => [r.kind, r.id, r.name, r.parent_id])));
});

await t('publish raises a YES; fix retries what policy allows and sends the rest as a repair task', async () => {
  const p = await say('youtube', 'publish it');
  assert.strictEqual(calls('coco_approval')[0].args.p_op, 'request');
  assert.strictEqual(calls('coco_approval')[0].args.p_payload.action.output_id, 'OUT-9');
  assert.deepStrictEqual(p.body.reply.meta.approvals.map((a) => a.id), [99]);
  RPCS = [];
  const f = await say('youtube', 'fix it');
  assert.ok(/Repair: store-artifact job j1 failed with "B2 PUT 403 on tmp\/"/.test(calls('submit_task')[0].args.p_title + calls('submit_task')[0].args.p_details), reply(f));
});

await t('the optional model only rewrites a sentence the rules missed, and is off without a key', async () => {
  const { llmRewrite } = await import('./api/_chat.js');
  process.env.GEMINI_API_KEY = 'test';
  const seen = [];
  const fake = async (url, init) => { seen.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"command":"what is running"}' }] } }] }) }; };
  const r = await llmRewrite({ text: 'yo whats cooking in the factory', scope: 'Good Space', history: [], fetchImpl: fake });
  assert.strictEqual(r.command, 'what is running');
  assert.ok(!/Write the KDP listing|youtube/.test(JSON.stringify(seen)), 'the company itself is never sent to the model');
  const viaChat = await chatTurn({ run, rpc, who, body: { scope: 'coco', body: 'yo whats cooking in the factory' }, fetchImpl: async (u, i) => /googleapis/.test(u) ? fake(u, i) : fetchImpl() });
  assert.ok(/^Understood as "what is running"\. Nothing is running/.test(viaChat.body.reply.body), viaChat.body.reply.body);
  delete process.env.GEMINI_API_KEY;
});

// ---------------------------------------------------------------- what the first production run found
await t('Nova sends a text control value as JSON, and serves the build with the highest versionCode', async () => {
  const { buildRpc, newestAndroid } = await import('./api/_nova.js');
  const q = buildRpc('coco_control', { p_scope: 'workflow', p_scope_id: 'x', p_key: 'schedule', p_value: 'daily 08:00' });
  assert.ok(q.params.includes('"daily 08:00"'), 'a schedule must reach the jsonb parameter as a JSON string: ' + JSON.stringify(q.params));
  assert.ok(buildRpc('coco_control', { p_scope: 'team', p_scope_id: 'x', p_key: 'paused', p_value: false }).params.includes(false));
  const list = [{ tag_name: 'android-2.9.3-20' }, { tag_name: 'android-2.9.2-19' }, { tag_name: 'android-2.10.0-21' }, { tag_name: 'android-2.11.0-22', draft: true }];
  assert.strictEqual(newestAndroid(list).tag_name, 'android-2.10.0-21');
});

await t('"give it a research agent" makes a Researcher; "give X a workflow for research" belongs to X', async () => {
  await say('coco', 'create a team called Lab Three');
  await say('coco', 'create a sub-team called Research under Lab Three');
  RPCS = [];
  await say('coco', 'give Lab Three a research agent');
  const a = calls('coco_structure')[0].args;
  assert.deepStrictEqual([a.p_name, a.p_parent], ['Researcher', 'lab-three/research'], JSON.stringify(a));
  RPCS = [];
  await say('coco', 'give Lab Three a daily workflow for research and review');
  assert.strictEqual(calls('coco_structure')[0].args.p_id, 'lab-three');
});

await t('a schedule the control plane refuses is reported as not saved, never as scheduled', async () => {
  const strict = async (fn, args) => { if (fn === 'coco_control' && args.p_key === 'schedule') throw new Error('invalid input syntax for type json'); return rpc(fn, args); };
  await chatTurn({ run, rpc: strict, who, body: { scope: 'coco', body: 'create a team called Lab Four' }, fetchImpl });
  const r = await chatTurn({ run, rpc: strict, who, body: { scope: 'coco', body: 'give Lab Four a daily workflow for research' }, fetchImpl });
  assert.ok(/schedule was NOT saved/.test(r.body.reply.body) && !/scheduled daily/.test(r.body.reply.body), r.body.reply.body);
});

console.log(`\nchat cloud: ${pass}/${pass} passed · 0 Claude calls by construction`);
