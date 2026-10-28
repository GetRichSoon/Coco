// Run: node chat.test.js
//
// Coco Chat is the natural-language front door to the control plane, not a second one. These tests
// drive the real engine lifted out of index.html against real company data, and check the two things
// that matter: a question is answered from state already loaded (so it costs nothing), and an action
// goes through the same RPC a dashboard button calls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const IDENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'identity.json'), 'utf8'));
const CPREAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'control-plane.json'), 'utf8'));

const between = (a, b) => { const i = src.search(a), j = src.search(b); assert.ok(i > 0 && j > i, `lift failed ${a}`); return src.slice(i, j); };
const marksSrc = between(/\nlet IDENT = null;/, /\n\/\/ -+ control plane/);
const structSrc = between(/\n\/\/ -+ the company's shape\n/, /\n\/\/ -+ Coco Chat/);
const chatSrc = between(/\n\/\/ -+ Coco Chat: the company's front door\n/, /\n\/\/ 80% warning/);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = () => '2 min ago';
const store = { get: () => null };

// what the RPC was asked to do, instead of a network call
let CALLS = [];
const sb = { rpc: async (fn, args) => { CALLS.push({ fn, args }); return { data: { ok: true }, error: null }; } };
const toast = () => {};
const loadAll = async () => {};

const CONNS = [
  { connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow – Daily Science', state: 'connected', permissions: ['upload'] },
  { connection_id: 'yt-moonveil', provider: 'youtube', external_name: 'Moonveil Audio', state: 'not_connected', permissions: ['upload'] },
];
const CONN_LINKS = [{ connection_id: 'yt-the-flow', team_id: 'youtube', subteam_id: null, category_id: null, enabled: true }];
const OUTPUTS = [{ id: 'OUT-1', workflow_id: 'ebook-daily', team_id: 'ebooks', status: 'created' }];
const POLICIES = [
  { scope: 'company', scope_id: '*', key: 'paused', value: true },
  { scope: 'workflow', scope_id: 'ebook-daily', key: 'schedule', value: 'daily 08:00' },
  { scope: 'workflow', scope_id: 'ebook-daily', key: 'outputs_per_day', value: 1 },
];

const make = () => new Function(
  'CP', 'LIVE', 'D', 'OUTPUTS', 'CONNS', 'CONN_LINKS', 'STRUCT', 'POLICIES', 'IDENT_IN',
  'esc', 'ago', 'store', 'sb', 'toast', 'loadAll', 'num', 'policyOf', 'control', 'connectionOp',
  `${marksSrc}\nIDENT = IDENT_IN;\n${structSrc}\n${chatSrc}\nreturn { chatIntent, chatRead, chatSend, chatEntities };`,
)(CPREAL, null, { integrations: [{ id: 'youtube', platform: 'YouTube', state: 'connected' }], approvals: [] },
  OUTPUTS, CONNS, CONN_LINKS, [], POLICIES, IDENT,
  esc, ago, store, sb, toast, loadAll,
  (n) => Number(n || 0).toLocaleString(),
  (scope, id, key) => { const r = POLICIES.find((p) => p.scope === scope && p.scope_id === id && p.key === key); return r ? r.value : undefined; },
  async (scope, id, key, value) => { CALLS.push({ fn: 'coco_control', args: { p_scope: scope, p_scope_id: id, p_key: key, p_value: value } }); return { state: 'applied' }; },
  async (op, id) => { CALLS.push({ fn: 'coco_connection', args: { p_op: op, p_connection: id } }); return { ok: true }; });

const C = make();
let pass = 0;
const t = async (name, fn) => { CALLS = []; await fn(); pass++; console.log(`  ok  ${name}`); };

// ---------------------------------------------------------------- reading: real state, no network
await t('company status answers from loaded state', async () => {
  const a = await C.chatSend('company status');
  assert.ok(/teams are live/.test(a.text), a.text);
  assert.ok(/emergency stop/i.test(a.text), 'it must say the company is stopped: ' + a.text);
  assert.strictEqual(CALLS.length, 0, 'a question must not call anything');
});

await t('Hindi asks the same question', async () => {
  const a = await C.chatSend('company me kya chal raha hai');
  assert.ok(/teams are live/.test(a.text), a.text);
  assert.strictEqual(CALLS.length, 0);
});

await t('workflow status reads the real saved schedule and target', async () => {
  const a = await C.chatSend('ebook-daily workflow status');
  assert.ok(/daily 08:00/.test(a.text), 'the saved schedule must be shown: ' + a.text);
  assert.ok(/Daily target: 1/.test(a.text), a.text);
  assert.strictEqual(CALLS.length, 0);
});

await t('channel status says plainly when nothing can publish to it', async () => {
  const a = await C.chatSend('Moonveil Audio status');
  assert.ok(/not_connected/.test(a.text) && /not assigned/i.test(a.text), a.text);
  assert.strictEqual(CALLS.length, 0);
});

await t('outputs are grouped by the workflow that made them', async () => {
  const a = await C.chatSend('how many outputs');
  assert.ok(/1 outputs recorded/.test(a.text), a.text);
  assert.ok((a.cards || []).some((c) => c.t === 'ebook-daily'), JSON.stringify(a.cards));
});

// ---------------------------------------------------------------- acting: through the real gate
await t('pausing a workflow goes through coco_control', async () => {
  const a = await C.chatSend('pause ebook-daily');
  assert.strictEqual(CALLS.length, 1);
  assert.deepStrictEqual(CALLS[0].args, { p_scope: 'workflow', p_scope_id: 'ebook-daily', p_key: 'enabled', p_value: false });
  assert.ok(a.acted, 'it must report that something really changed');
});

await t('setting a schedule writes the control the scheduler reads', async () => {
  const a = await C.chatSend('schedule ebook-daily daily 09:30');
  assert.strictEqual(CALLS.length, 1);
  assert.deepStrictEqual(CALLS[0].args, { p_scope: 'workflow', p_scope_id: 'ebook-daily', p_key: 'schedule', p_value: 'daily 09:30' });
  assert.ok(/not the one in the file/.test(a.text), a.text);
});

await t('a bad schedule is never sent: only the real grammar is matched', async () => {
  const a = await C.chatSend('schedule ebook-daily every tuesday-ish');
  assert.strictEqual(CALLS.length, 0, 'nothing may be written for a phrase the control plane would reject');
  assert.ok(/runs:/.test(a.text), 'it falls back to showing the schedule: ' + a.text);
});

await t('disconnecting an account goes through coco_connection', async () => {
  await C.chatSend('pause Moonveil Audio');
  assert.strictEqual(CALLS[0].fn, 'coco_connection');
  assert.strictEqual(CALLS[0].args.p_op, 'disconnect');
});

// ---------------------------------------------------------------- the things it must not do
await t('it asks instead of guessing which thing to pause', async () => {
  const a = await C.chatSend('pause it');
  assert.strictEqual(CALLS.length, 0, 'nothing may be changed when the target is unknown');
  assert.ok(/which target/i.test(a.text) || /will not guess/i.test(a.text), a.text);
});

await t('run now is refused honestly, not faked', async () => {
  const a = await C.chatSend('run ebook-daily now');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/cannot start a run from here/.test(a.text), a.text);
  assert.ok(/executor\.mjs run ebook-daily/.test(a.text), 'it must say exactly how to do it instead');
});

await t('an unknown message offers what it can do, and changes nothing', async () => {
  const a = await C.chatSend('make me a sandwich');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/did not catch a command/.test(a.text), a.text);
});

await t('nothing in the chat path can reach a model', () => {
  assert.ok(!/anthropic|ai-gateway|invoke\(|MODEL_ID/.test(chatSrc), 'the chat engine must stay deterministic');
});

console.log(`\nchat: ${pass}/${pass} passed · 0 Claude calls by construction`);
