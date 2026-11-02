// Run: node chat-cloud.test.js
//
// Coco Chat as every device reaches it: Nova's /api/chat running the engine lifted out of index.html
// against the real registry snapshot. The database is a small in-memory stand-in that records what
// was written, so these check the contract: one thread per scope, a pending yes that survives to the
// next request (another device), work that leaves as a cloud task, and nothing done without a yes.
import assert from 'node:assert';
import { chatTurn, chatTree, forgetWorlds } from './api/_chat.js';
import { handle } from './api/_nova.js';

const WORLD = { approvals: [{ id: 7, code: 'A-777', team: 'youtube', what: 'Publish the Short', state: 'waiting' }],
  devices: [], integrations: [], policies: [], structure: [], conns: [], links: [], outputs: [], brain: [], runs: [], release: null,
  founders: [{ email: 'boss@example.com', name: 'Mangesh' }] };
let CHAT, RPCS, nextId;
const reset = () => { CHAT = []; RPCS = []; nextId = 1; forgetWorlds(); };
const run = async ({ sql, params }) => {
  if (/^SELECT\s+\(SELECT coalesce/.test(sql)) return [WORLD];
  if (/FROM public\.chat WHERE scope = \$1 AND role = 'coco'/.test(sql)) return CHAT.filter((r) => r.scope === params[0] && r.role === 'coco').slice(-1);
  if (/INSERT INTO public\.chat \(role, author, device_id/.test(sql)) { const r = { id: nextId++, role: 'founder', author: params[0], device_id: params[1], body: params[2], status: 'answered', scope: params[3], created_at: new Date().toISOString() }; CHAT.push(r); return [r]; }
  if (/INSERT INTO public\.chat \(role, author, body, reply_to/.test(sql)) { const r = { id: nextId++, role: 'coco', author: 'Coco', body: params[0], reply_to: params[1], status: params[2], scope: params[3], meta: JSON.parse(params[4]), created_at: new Date().toISOString() }; CHAT.push(r); return [r]; }
  throw new Error('unexpected SQL ' + sql.slice(0, 80));
};
const rpc = async (fn, args) => { RPCS.push({ fn, args }); return fn === 'submit_task' ? { merged: false, task_id: '0f0e0d0c-0000-0000-0000-000000000000' } : { ok: true }; };
const who = { email: 'boss@example.com', device_id: 'boss-pc' };
const say = (scope, body) => chatTurn({ run, rpc, who, body: { scope, body } });

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

console.log(`\nchat cloud: ${pass}/${pass} passed · 0 Claude calls by construction`);
