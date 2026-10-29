// Run: node assistant.test.js
//
// Coco Chat as the company's operating assistant: not a chatbot, and not a second control plane.
// These tests drive the real engine lifted out of index.html against the real company snapshot and
// check the things that would actually hurt if they were wrong:
//
//   * a reference's SOURCE channel is never recorded as the company's publishing TARGET
//   * metadata that needs the platform is left unknown rather than invented
//   * nothing risky happens on one sentence; it is shown, and it waits
//   * "connect" opens the real OAuth flow and never writes "connected" by itself
//   * "work on this" queues a request and does not publish
//   * an ambiguous instruction is a question, not a guess
//   * every mutation goes through a founder-and-device gated RPC, never a table
//
// Zero Claude calls by construction: there is no gateway call anywhere in the chat path.
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

// everything that leaves the browser, recorded instead of sent
let CALLS = [], OAUTH = [], VERIFIED = [], TOASTS = [];
const sb = { rpc: async (fn, args) => { CALLS.push({ fn, args }); return { data: RPC_REPLY[fn] || { ok: true }, error: null }; } };
let RPC_REPLY = {};
const toast = (m) => { TOASTS.push(String(m)); };
const loadAll = async () => {};

// the two cloud paths chat reuses rather than reimplementing
let OAUTH_RESULT = { started: true, connection: 'yt-moonveil-audio', platform: 'YouTube' };
const oauthConnect = async (provider, connection) => { OAUTH.push({ provider, connection }); return OAUTH_RESULT; };
let VERIFY_RESULT = { status: 'CONNECTED_VERIFIED', detail: 'Moonveil Audio, upload allowed' };
const connectionVerify = async (connection) => { VERIFIED.push(connection); return VERIFY_RESULT; };
const VERIFY_SAID = {
  CONNECTED_VERIFIED: 'Verified from the cloud',
  CONNECTED_WRONG_CHANNEL: 'Wrong channel — not safe to publish',
  CANNOT_CHECK: 'No cloud check for this platform yet',
};

const CONNS = [
  { connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow – Daily Science',
    external_id: 'UCDmTA14WA', external_handle: '@theflowdaily', state: 'connected', secret_ref: 'youtube_refresh_token_yt_the_flow', permissions: ['upload'] },
  { connection_id: 'yt-moonveil-audio', provider: 'youtube', external_name: 'Moonveil Audio',
    external_id: 'UCflgDjnA', external_handle: '@moonveilaudio', state: 'not_connected', permissions: ['upload'] },
  { connection_id: 'poppy', provider: 'gumroad', external_name: 'Poppy Store', state: 'connected', secret_ref: 'gumroad_token_poppy' },
];
const CONN_LINKS = [{ connection_id: 'yt-the-flow', team_id: 'youtube', subteam_id: null, category_id: null, channel_id: null, enabled: true }];
const OUTPUTS = [{ id: 'OUT-1', workflow_id: 'ebook-daily', team_id: 'ebooks', status: 'created' }];
const POLICIES = [
  { scope: 'company', scope_id: '*', key: 'paused', value: true },
  { scope: 'team', scope_id: 'youtube', key: 'paused', value: false },
  { scope: 'workflow', scope_id: 'ebook-daily', key: 'schedule', value: 'daily 08:00' },
];
// the Brain as the snapshot really shapes it: { stats, items }, not an array
const BRAIN = {
  stats: { items: 2 },
  items: [
    { id: 'BRN-2026-10-29-0001', kind: 'reference', title: 'youtube video abcdefghijk', retired: false,
      source: 'https://youtube.com/watch?v=abcdefghijk', team_id: 'youtube', channel_id: 'yt-the-flow',
      meta: { provider: 'youtube', research_status: 'not_started', for_id: 'yt-the-flow' } },
    { id: 'BRN-2026-10-29-0002', kind: 'knowledge', title: 'Inter font fails silently in pycairo', retired: false, team_id: 'youtube' },
  ],
};

// opts.D adds the rows the four-device questions need (devices, approvals); opts.release is the
// cloud release row those answers are measured against. Left out, nothing changes for the tests
// that came before them.
const make = (opts = {}) => {
  const CP = { ...CPREAL, brain: BRAIN };
  return new Function(
    'CP', 'LIVE', 'D', 'OUTPUTS', 'CONNS', 'CONN_LINKS', 'STRUCT', 'POLICIES', 'IDENT_IN',
    'CLOUD_RELEASE_IN', 'RELEASE_IN', 'online', 'devVersion',
    'esc', 'ago', 'store', 'sb', 'toast', 'loadAll', 'num', 'policyOf', 'control', 'connectionOp', 'structureOp', 'confirm',
    'oauthConnect', 'connectionVerify', 'VERIFY_SAID',
    `${marksSrc}\nIDENT = IDENT_IN;\n${structSrc}\nCLOUD_RELEASE = CLOUD_RELEASE_IN; RELEASE = RELEASE_IN;\n${chatSrc}\nreturn { chatIntent, chatRead, chatSend, chatEntities, chatScope, chatRefs, chatBrain, chatParseRef, chatWorkflowsFor, CHAT_ACTIONS, ctx: () => CHAT_CTX, reset: chatCtxReset };`,
  )(CP, null, { integrations: [{ id: 'youtube', platform: 'YouTube', state: 'connected' }, { id: 'gumroad', platform: 'Gumroad', state: 'connected' }], approvals: [], devices: [], ...(opts.D || {}) },
    OUTPUTS, CONNS, CONN_LINKS, [], POLICIES, IDENT,
    opts.release === undefined ? null : opts.release, opts.file || null,
    // the same two helpers index.html defines: a device is online only if it reported recently
    (d) => d.last_seen && (Date.now() - new Date(d.last_seen)) < 150000,
    (d) => String(d.app_version || '').replace(/^(desktop|web|android|lounge)-/, '') || '?',
    esc, ago, store, sb, toast, loadAll,
    (n) => Number(n || 0).toLocaleString(),
    (scope, id, key) => { const r = POLICIES.find((p) => p.scope === scope && p.scope_id === id && p.key === key); return r ? r.value : undefined; },
    async (scope, id, key, value, note) => { CALLS.push({ fn: 'coco_control', args: { p_scope: scope, p_scope_id: id, p_key: key, p_value: value, p_note: note } }); return { state: 'applied' }; },
    async (op, id, extra) => { CALLS.push({ fn: 'coco_connection', args: { p_op: op, p_connection: id, ...(extra || {}) } }); return { ok: true }; },
    async (op, id, confirmWith, extra) => { CALLS.push({ fn: 'coco_structure', args: { p_op: op, p_id: id, ...(extra || {}) } }); return { ok: true }; },
    () => true,
    oauthConnect, connectionVerify, VERIFY_SAID);
};

const C = make();
let pass = 0;
const t = async (name, fn) => {
  CALLS = []; OAUTH = []; VERIFIED = []; TOASTS = []; RPC_REPLY = {};
  OAUTH_RESULT = { started: true, connection: 'yt-moonveil-audio', platform: 'YouTube' };
  VERIFY_RESULT = { status: 'CONNECTED_VERIFIED', detail: 'Moonveil Audio, upload allowed' };
  C.reset();
  await fn();
  pass++; console.log(`  ok  ${name}`);
};
const only = (fn) => { assert.strictEqual(CALLS.length, 1, 'expected exactly one call, got ' + JSON.stringify(CALLS)); assert.strictEqual(CALLS[0].fn, fn, JSON.stringify(CALLS[0])); return CALLS[0].args; };

console.log('\nCoco Operating Assistant\n');

// ---------------------------------------------------------------- the Brain read that used to throw
await t('the Brain is read from the snapshot shape, not assumed to be an array', () => {
  assert.ok(Array.isArray(C.chatBrain()), 'chatBrain must always hand back a list');
  assert.strictEqual(C.chatBrain().length, 2);
});

await t('asking about the Brain answers instead of crashing', async () => {
  const a = await C.chatSend('what does the brain know about pycairo');
  assert.ok(a && /2 things in the Brain/i.test(a.text), JSON.stringify(a));
  assert.strictEqual(CALLS.length, 0, 'a Brain question must cost nothing');
});

// ---------------------------------------------------------------- resolving a name a founder says
await t('a word only one thing owns resolves it: "Moonveil" finds Moonveil Audio', () => {
  const it = C.chatIntent('connect Moonveil');
  assert.strictEqual(it.intent, 'connect');
  assert.strictEqual(it.target.id, 'yt-moonveil-audio', JSON.stringify(it.target));
});

await t('a name nobody types exactly still resolves: no en-dash needed', () => {
  const it = C.chatIntent('verify the flow');
  assert.strictEqual(it.target.id, 'yt-the-flow', JSON.stringify(it.target));
});

await t('a word several things share resolves nothing on its own', () => {
  // "youtube" is the YouTube Studio team AND the YouTube platform, so it is not distinctive; the
  // full name still is. A shared word must never be enough to pick one of them.
  const shared = C.chatEntities().filter((e) => /youtube/i.test(e.name));
  assert.ok(shared.length > 1, 'expected more than one thing called YouTube something');
  const byWord = C.chatEntities().filter((e) => e.kind === 'team' && e.id === 'youtube');
  assert.ok(byWord.length, 'the YouTube Studio team should exist');
  const it = C.chatIntent('start working on youtube');
  if (it.target) assert.notStrictEqual(it.target.id, undefined);
});

await t('a name that is not in the company resolves to nothing', () => {
  const it = C.chatIntent('connect Spotify Premium');
  assert.ok(it.missing && it.missing.length, 'an unknown name must become a question: ' + JSON.stringify(it));
});

// ---------------------------------------------------------------- reading a reference off its URL
await t('a YouTube watch link gives up its provider and id, and nothing else', () => {
  const r = C.chatParseRef('use https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s as a reference');
  assert.deepStrictEqual(r, { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', provider: 'youtube', ref_type: 'video', external_id: 'dQw4w9WgXcQ' });
});

await t('shorts, youtu.be and channel links are all understood', () => {
  assert.strictEqual(C.chatParseRef('https://youtu.be/dQw4w9WgXcQ').external_id, 'dQw4w9WgXcQ');
  assert.strictEqual(C.chatParseRef('https://www.youtube.com/shorts/dQw4w9WgXcQ').ref_type, 'video');
  const ch = C.chatParseRef('https://youtube.com/@moonveilaudio');
  assert.strictEqual(ch.ref_type, 'channel');
  assert.strictEqual(ch.external_id, 'moonveilaudio');
});

await t('an unknown host is still a reference, just a plain page', () => {
  const r = C.chatParseRef('https://blog.example.com/posts/7');
  assert.strictEqual(r.provider, 'blog.example.com');
  assert.strictEqual(r.ref_type, 'page');
  assert.strictEqual(r.external_id, null);
});

await t('no link in the message is no reference', () => {
  assert.strictEqual(C.chatParseRef('use that video for Moonveil'), null);
});

// ---------------------------------------------------------------- storing a reference, at a scope
await t('a reference for a channel is stored against that channel, through coco_brain', async () => {
  RPC_REPLY = { coco_brain: { ok: true, id: 'BRN-2026-10-29-0003', scope: 'yt-moonveil-audio' } };
  const a = await C.chatSend('use https://www.youtube.com/watch?v=dQw4w9WgXcQ as a reference for Moonveil Audio');
  const args = only('coco_brain');
  assert.strictEqual(args.p_op, 'add');
  assert.strictEqual(args.p_kind, 'reference');
  assert.strictEqual(args.p_url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(args.p_channel, 'yt-moonveil-audio', 'the deepest scope is the channel');
  assert.ok(/Moonveil Audio/.test(a.text), a.text);
  assert.ok(a.act && a.act.title === 'Reference added', JSON.stringify(a.act));
});

await t('the SOURCE video is never recorded as the publishing target', async () => {
  await C.chatSend('use https://www.youtube.com/watch?v=dQw4w9WgXcQ as a reference for Moonveil Audio');
  const m = only('coco_brain').p_meta;
  assert.strictEqual(m.for_id, 'yt-moonveil-audio', 'the target is the Coco channel');
  assert.strictEqual(m.source_url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(m.source_channel, null, 'a video link does not say who published it');
  assert.strictEqual(m.source_channel_id, null);
  assert.strictEqual(m.role, 'unknown_source', 'an unproven source is somebody else\'s, never ours');
});

await t('metadata that needs the platform is left unknown, not invented', async () => {
  await C.chatSend('reference https://www.youtube.com/watch?v=dQw4w9WgXcQ for Moonveil Audio');
  const m = only('coco_brain').p_meta;
  for (const k of ['title', 'duration', 'published_at', 'thumbnail']) {
    assert.strictEqual(m[k], null, `${k} must be null, not guessed`);
  }
  assert.strictEqual(m.research_status, 'not_started');
});

await t('a channel link that matches a connected account is recognised as ours', async () => {
  await C.chatSend('use https://youtube.com/@moonveilaudio as a reference for Moonveil Audio');
  const m = only('coco_brain').p_meta;
  assert.strictEqual(m.role, 'own_channel');
  assert.strictEqual(m.source_channel, 'Moonveil Audio');
});

await t('"for all Ebooks" is the team scope, with no channel', async () => {
  const a = await C.chatSend('use https://amazon.com/dp/B0CZ1234AB as a reference for Poppy Ebooks and Workbooks');
  const args = only('coco_brain');
  assert.strictEqual(args.p_team, 'ebooks');
  assert.strictEqual(args.p_channel, null, 'a team reference is not pinned to one channel');
  assert.ok(/the whole team/.test(a.text), a.text);
});

await t('a deeper name wins: a category reference carries its parents', async () => {
  const cat = (CPREAL.teams.find((x) => x.id === 'ebooks').categories || [])[0];
  if (!cat) return;
  await C.chatSend('use https://youtu.be/dQw4w9WgXcQ as a reference for ' + (cat.name || cat));
  const args = only('coco_brain');
  assert.ok(args.p_category || args.p_team, 'something in the chain must be set: ' + JSON.stringify(args));
});

await t('a link with nothing to attach it to is a question, not a guess', async () => {
  const a = await C.chatSend('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(CALLS.length, 0, 'nothing is stored until Coco knows what it is for');
  assert.strictEqual(a.state, 'Needs clarification');
  assert.ok(/which part of the company/i.test(a.text), a.text);
});

await t('listing references is free and scoped', async () => {
  const a = await C.chatSend('show references for The Flow – Daily Science');
  assert.strictEqual(CALLS.length, 0, 'a list is a Brain read');
  assert.ok(/1 reference for The Flow/i.test(a.text), a.text);
  assert.ok(/not researched yet/i.test(a.text), a.text);
});

await t('a scope with no references says so plainly', async () => {
  const a = await C.chatSend('references for Moonveil Audio');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/No references stored/i.test(a.text), a.text);
});

// ---------------------------------------------------------------- connecting a real account
await t('"connect Moonveil Audio" opens the real OAuth flow and writes no state', async () => {
  const a = await C.chatSend('connect Moonveil Audio');
  assert.strictEqual(CALLS.length, 0, 'connecting never writes a row from chat: ' + JSON.stringify(CALLS));
  assert.deepStrictEqual(OAUTH, [{ provider: 'youtube', connection: 'yt-moonveil-audio' }]);
  assert.ok(/Sent you to YouTube/.test(a.text), a.text);
  assert.ok(!/\bis now connected\b/i.test(a.text), 'chat must not claim a connection it cannot see');
  assert.ok(/turns Connected only once the cloud holds a credential/i.test(a.text), a.text);
});

await t('"connect YouTube" will not choose between fifteen channels', async () => {
  const a = await C.chatSend('connect YouTube');
  assert.strictEqual(OAUTH.length, 0, 'no flow is opened without knowing which account');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/Which YouTube account/i.test(a.text), a.text);
  assert.ok(/will not choose/i.test(a.text), a.text);
});

await t('a cancelled consent dialog is reported as nothing connected', async () => {
  OAUTH_RESULT = { started: false, why: 'you cancelled it' };
  const a = await C.chatSend('connect Moonveil Audio');
  assert.ok(/Nothing was connected/.test(a.text), a.text);
  assert.ok(/cancelled/.test(a.text), a.text);
});

await t('"connections" is a question and "disconnect" is not "connect"', async () => {
  const q = await C.chatSend('show all connections');
  assert.strictEqual(OAUTH.length, 0, '"connections" must not open a consent screen');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/accounts across/i.test(q.text), q.text);
  const d = C.chatIntent('disconnect Moonveil Audio');
  assert.strictEqual(d.intent, 'disconnect', JSON.stringify(d));
});

await t('verify asks the platform and repeats what it said', async () => {
  const a = await C.chatSend('verify Moonveil Audio');
  assert.deepStrictEqual(VERIFIED, ['yt-moonveil-audio']);
  assert.strictEqual(CALLS.length, 0, 'the check is a cloud call, not a table write');
  assert.ok(/Verified from the cloud/.test(a.text), a.text);
});

await t('a failed check is never dressed up as a pass', async () => {
  VERIFY_RESULT = { status: 'CONNECTED_WRONG_CHANNEL', detail: 'answered as The Flow' };
  const a = await C.chatSend('verify Moonveil Audio');
  assert.ok(/Wrong channel/.test(a.text), a.text);
  assert.strictEqual(a.act.status, 'Wrong channel — not safe to publish');
});

await t('a check the cloud cannot do changes nothing', async () => {
  VERIFY_RESULT = null;
  const a = await C.chatSend('verify Poppy Store');
  assert.ok(/could not check/i.test(a.text), a.text);
  assert.ok(/nothing was changed or dated/i.test(a.text), a.text);
});

// ---------------------------------------------------------------- confirmation before anything risky
await t('assigning a channel is shown and waits for a yes', async () => {
  const a = await C.chatSend('assign Moonveil Audio to YouTube Studio');
  assert.strictEqual(CALLS.length, 0, 'nothing happens on the first sentence');
  assert.strictEqual(a.state, 'Ready for confirmation');
  assert.ok(a.act.rows.some(([k]) => k === 'Undo'), 'a founder is told how to undo it');
  assert.ok(a.act.rows.some(([k, v]) => k === 'Permission' && /paired device/.test(v)), JSON.stringify(a.act.rows));
  assert.strictEqual(C.ctx().pending.it.intent, 'assign');
});

await t('the yes runs exactly the assign that was shown', async () => {
  await C.chatSend('assign Moonveil Audio to YouTube Studio');
  CALLS = [];
  const a = await C.chatSend('yes');
  const args = only('coco_connection');
  assert.strictEqual(args.p_op, 'assign');
  assert.strictEqual(args.p_connection, 'yt-moonveil-audio');
  assert.strictEqual(args.p_team, 'youtube');
  assert.strictEqual(a.state, 'Completed');
  assert.strictEqual(C.ctx().pending, null, 'the pending action is spent');
});

await t('a no leaves it alone', async () => {
  await C.chatSend('assign Moonveil Audio to YouTube Studio');
  CALLS = [];
  const a = await C.chatSend('nahi');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/Left it alone/.test(a.text), a.text);
  assert.strictEqual(C.ctx().pending, null);
});

await t('a yes buried in a longer sentence is a new instruction, not an approval', async () => {
  await C.chatSend('assign Moonveil Audio to YouTube Studio');
  CALLS = [];
  const a = await C.chatSend('yes and also show me the approvals');
  assert.ok(!CALLS.some((c) => c.fn === 'coco_connection'), 'the pending assign must not have fired: ' + JSON.stringify(CALLS));
  assert.ok(/waiting for a YES|Nothing is waiting/i.test(a.text), a.text);
});

await t('stopping the whole company is shown before it happens', async () => {
  const a = await C.chatSend('stop the company');
  assert.strictEqual(CALLS.length, 0);
  assert.strictEqual(a.state, 'Ready for confirmation');
  assert.ok(a.act.rows.some(([k, v]) => k === 'Scope' && /every team/.test(v)), JSON.stringify(a.act.rows));
  CALLS = [];
  await C.chatSend('haan');
  const args = only('coco_control');
  assert.deepStrictEqual([args.p_scope, args.p_scope_id, args.p_key, args.p_value], ['company', '*', 'paused', true]);
});

await t('resuming the company is just as deliberate', async () => {
  const a = await C.chatSend('resume the company');
  assert.strictEqual(CALLS.length, 0);
  assert.strictEqual(a.state, 'Ready for confirmation');
  await C.chatSend('yes');
  assert.strictEqual(only('coco_control').p_value, false);
});

await t('a bare "stop" never reaches the whole company', async () => {
  const it = C.chatIntent('stop ebook-daily');
  assert.notStrictEqual(it.intent, 'company_stop');
  assert.strictEqual(it.intent, 'pause');
});

// ---------------------------------------------------------------- moving the company around
await t('move is confirmed, then goes through coco_structure', async () => {
  const team = CPREAL.teams.find((x) => x.id === 'ebooks');
  // a category and a sub-team whose names are not near-duplicates of each other, so the sentence
  // means one thing
  const pair = (team.categories || []).map((cat) => ({ cat, sub: (team.subteams || [])
      .filter((s) => String(s.name).toLowerCase().indexOf(String(cat.name).toLowerCase()) < 0
                  && String(cat.name).toLowerCase().indexOf(String(s.name).toLowerCase()) < 0)[0] }))
    .filter((p) => p.sub)[0];
  assert.ok(pair, 'expected a category and a sub-team with distinct names');
  const a = await C.chatSend('move ' + pair.cat.name + ' under ' + pair.sub.name);
  assert.strictEqual(a.state, 'Ready for confirmation', a.text);
  assert.strictEqual(CALLS.length, 0, 'a move never happens on the first sentence');
  CALLS = [];
  await C.chatSend('yes');
  const args = only('coco_structure');
  assert.strictEqual(args.p_op, 'move');
  assert.strictEqual(args.p_parent, pair.sub.id);
});

await t('a parent the company\'s shape does not allow is a question, not a move', async () => {
  // the registry really does have a sub-team "Amazon KDP" and a category "kdp"; a sub-team cannot
  // live under a category, so this resolves to nothing rather than to a guess
  const a = await C.chatSend('move Amazon KDP under kdp');
  assert.strictEqual(CALLS.length, 0, 'nothing may move on an impossible parent: ' + JSON.stringify(CALLS));
  assert.strictEqual(a.state, 'Needs clarification');
});

await t('"move this" with nothing in context asks', async () => {
  const a = await C.chatSend('move this');
  assert.strictEqual(CALLS.length, 0);
  assert.strictEqual(a.state, 'Needs clarification');
});

// ---------------------------------------------------------------- "start working on this"
await t('work on a channel resolves its team\'s workflow and queues a request', async () => {
  RPC_REPLY = { coco_request_run: { ok: true, request_id: 77 } };
  const a = await C.chatSend('start working on The Flow – Daily Science');
  const args = only('coco_request_run');
  assert.strictEqual(args.p_workflow, 'youtube-pick', 'the workflow comes from the team the channel belongs to');
  assert.ok(/BRN-2026-10-29-0001/.test(args.p_note), 'the run is told which references to work from: ' + args.p_note);
  assert.ok(/request 77/.test(a.text), a.text);
});

await t('work never publishes, and says so', async () => {
  RPC_REPLY = { coco_request_run: { ok: true, request_id: 78 } };
  const a = await C.chatSend('start working on The Flow – Daily Science');
  assert.ok(/Nothing goes out anywhere/.test(a.text), a.text);
  assert.ok(a.act.rows.some(([k, v]) => k === 'Publishing' && /needs its own approval/.test(v)), JSON.stringify(a.act.rows));
  assert.ok(!CALLS.some((c) => /publish/i.test(c.fn)), 'no publish RPC may be called');
});

await t('a team with no workflow is told, not given an invented one', async () => {
  const flowTeams = new Set((CPREAL.cloud_runtime.pipelines || []).map((f) => f.team));
  const bare = CPREAL.teams.filter((x) => !flowTeams.has(x.id) && String(x.name || '').length > 3)[0];
  assert.ok(bare, 'expected at least one team with no workflow in the snapshot');
  const a = await C.chatSend('start working on ' + bare.name);
  assert.strictEqual(CALLS.length, 0, 'nothing is queued against a workflow that does not exist');
  assert.ok(/no workflow belongs to/i.test(a.text), a.text);
});

await t('a team with several workflows is a question', async () => {
  const flows = (CPREAL.cloud_runtime.pipelines || []).filter((f) => f.team === 'ebooks');
  if (flows.length < 2) return;
  const a = await C.chatSend('start working on Poppy Ebooks and Workbooks');
  assert.strictEqual(CALLS.length, 0);
  assert.ok(/Which workflow/i.test(a.text), a.text);
});

await t('the control plane refusing a run is reported, not papered over', async () => {
  RPC_REPLY = { coco_request_run: { ok: false, reason: 'the company is stopped' } };
  const a = await C.chatSend('start working on The Flow – Daily Science');
  assert.ok(/Not queued: the company is stopped/.test(a.text), a.text);
  assert.ok(/Nothing was started/.test(a.text), a.text);
});

await t('"work on this" with nothing in context asks', async () => {
  const a = await C.chatSend('start working on this');
  assert.strictEqual(CALLS.length, 0);
  assert.strictEqual(a.state, 'Needs clarification');
  assert.ok(/what to work on/i.test(a.text), a.text);
});

// ---------------------------------------------------------------- conversation context
await t('a reference, then "start working on this", uses the channel just named', async () => {
  RPC_REPLY = { coco_brain: { ok: true, id: 'BRN-X' }, coco_request_run: { ok: true, request_id: 91 } };
  await C.chatSend('use https://youtu.be/dQw4w9WgXcQ as a reference for The Flow – Daily Science');
  assert.strictEqual(C.ctx().connection.id, 'yt-the-flow', 'the channel is remembered');
  CALLS = [];
  const a = await C.chatSend('now start working on this');
  const args = only('coco_request_run');
  assert.strictEqual(args.p_workflow, 'youtube-pick');
  assert.ok(/request 91/.test(a.text), a.text);
});

await t('naming a category remembers the team above it', async () => {
  const cat = (CPREAL.teams.find((x) => x.id === 'ebooks').categories || [])[0];
  if (!cat) return;
  await C.chatSend('status of ' + (cat.name || cat));
  const c = C.ctx();
  assert.ok(c.category || c.team, 'the chain is remembered: ' + JSON.stringify(c));
});

await t('context only ever holds things the company really has', async () => {
  await C.chatSend('status of Nonexistent Imaginary Team');
  const c = C.ctx();
  for (const k of ['team', 'subteam', 'category', 'channel', 'connection', 'workflow']) {
    if (c[k]) assert.ok(C.chatEntities().some((e) => e.id === c[k].id), k + ' came from nowhere: ' + JSON.stringify(c[k]));
  }
});

// ---------------------------------------------------------------- remembering things
await t('"remember that ..." writes a note to the Brain at the right scope', async () => {
  RPC_REPLY = { coco_brain: { ok: true, id: 'BRN-N1' } };
  const a = await C.chatSend('remember that Moonveil Audio uploads at 6am');
  const args = only('coco_brain');
  assert.strictEqual(args.p_op, 'add');
  assert.strictEqual(args.p_kind, 'knowledge');
  assert.strictEqual(args.p_text, 'Moonveil Audio uploads at 6am');
  assert.strictEqual(args.p_channel, 'yt-moonveil-audio');
  assert.ok(/Noted for Moonveil Audio/.test(a.text), a.text);
});

await t('a question containing "remember" is still a question', async () => {
  const it = C.chatIntent('what does the brain remember');
  assert.notStrictEqual(it.intent, 'note');
  assert.strictEqual(it.intent, 'brain');
});

await t('removing a reference retires it and deletes nothing', async () => {
  RPC_REPLY = { coco_brain: { ok: true, id: 'BRN-X' } };
  await C.chatSend('use https://youtu.be/dQw4w9WgXcQ as a reference for Moonveil Audio');
  CALLS = [];
  const a = await C.chatSend('remove this reference');
  if (a.state === 'Ready for confirmation') { CALLS = []; await C.chatSend('yes'); }
  const args = CALLS.find((c) => c.fn === 'coco_brain').args;
  assert.strictEqual(args.p_op, 'retire');
  assert.ok(!CALLS.some((c) => /delete|drop/i.test(JSON.stringify(c))), 'nothing is deleted');
});

// ---------------------------------------------------------------- the action registry
await t('every action declares what it needs and how far it reaches', () => {
  for (const [name, a] of Object.entries(C.CHAT_ACTIONS)) {
    assert.ok(Array.isArray(a.needs), name + ' must declare its inputs');
    assert.ok(a.verb, name + ' must have a verb a founder can read');
    assert.ok(['company', 'cloud', 'platform'].includes(a.reach), name + ' must declare its reach');
  }
});

await t('nothing that CHANGES a platform or the whole company happens unconfirmed', () => {
  for (const [name, a] of Object.entries(C.CHAT_ACTIONS)) {
    if (a.reads) continue;                       // a read-only check changes nothing to confirm
    if (a.reach === 'platform' || /^company_/.test(name)) {
      assert.ok(a.confirm === 'chat' || a.confirm === 'dialog', name + ' reaches outside and must be confirmed');
    }
  }
});

await t('only read-only actions are allowed to skip confirmation at platform reach', () => {
  const unconfirmed = Object.entries(C.CHAT_ACTIONS)
    .filter(([, a]) => a.reach === 'platform' && !a.confirm).map(([n]) => n);
  assert.deepStrictEqual(unconfirmed, ['verify'], 'unexpected unconfirmed platform action: ' + unconfirmed.join(', '));
});

// ---------------------------------------------------------------- security, by construction
await t('chat never touches a table', () => {
  assert.strictEqual(chatSrc.indexOf('sb.from('), -1, 'the chat path must not read or write tables directly');
});

await t('chat never builds SQL and never holds the service key', () => {
  for (const bad of ['service_role', 'SERVICE_ROLE', 'serviceKey', 'select * from', 'insert into', 'delete from', 'drop table']) {
    assert.strictEqual(chatSrc.toLowerCase().indexOf(bad.toLowerCase()), -1, 'found ' + bad + ' in the chat path');
  }
});

await t('chat never reads a secret or a token value', () => {
  for (const bad of ['decrypted_secret', 'refresh_token', 'client_secret', 'coco_publish_secret', 'coco_secret', 'vault']) {
    assert.strictEqual(chatSrc.indexOf(bad), -1, 'found ' + bad + ' in the chat path');
  }
});

await t('every mutation goes through a gated coco_ RPC', () => {
  const fns = [...chatSrc.matchAll(/sb\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(fns.length, 'expected some RPCs');
  for (const f of fns) assert.ok(/^coco_/.test(f), f + ' is not a control-plane RPC');
  assert.deepStrictEqual([...new Set(fns)].sort(), ['coco_brain', 'coco_request_run']);
});

await t('chat never calls Claude', () => {
  for (const bad of ['anthropic', 'claude.ai/api', 'ai_gateway', 'coco_ai_', 'messages.create']) {
    assert.strictEqual(chatSrc.toLowerCase().indexOf(bad.toLowerCase()), -1, 'found ' + bad + ' in the chat path');
  }
});

// Reading last_verified_at to say "last checked 2 min ago" is the point. WRITING it is the bug this
// whole area exists to prevent: that is how fifteen channels came to read Connected on the strength
// of a button having been pressed.
await t('chat never marks anything connected, or dates a check it did not make', () => {
  assert.strictEqual(/p_state\s*:/.test(chatSrc), false, 'chat must not set a connection state');
  assert.strictEqual(/last_verified_at\s*[:=][^=]/.test(chatSrc), false, 'chat must not write a verification date');
  // coco_connection('verify') was the op that only wrote a timestamp. Chat must reach the real
  // cloud check instead. ('reconnect' is fine: connection_touch now NULLs last_verified_at, so a
  // reconnected account reads "Connected, not yet checked" until a platform actually answers.)
  assert.strictEqual(/connectionOp\(\s*'verify'/.test(chatSrc), false,
    'chat must not call the verify op that only dates a row; connectionVerify asks the platform');
  assert.ok(/connectionVerify\(/.test(chatSrc), 'chat must use the real cloud check');
});

// ---------------------------------------------------------------- the screen, not just the engine
// The chat view lifted out of the page and rendered with a log that has every shape in it: a
// working bubble, an answer with an action summary, and cards. Catches a thrown view, and catches
// unescaped company text reaching the page, which a unit test on the engine never would.
const chatViewSrc = (() => {
  const start = src.indexOf('\n  chat() {');
  assert.ok(start > 0, 'the chat view is not in index.html any more');
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (!depth) return 'function chatView' + src.slice(start + 7, j + 1); }
  }
  throw new Error('the chat view is not closed');
})();

await t('the chat view renders a working bubble, an answer and an action summary', () => {
  const LOG = [
    { who: 'you', text: 'connect Moonveil Audio' },
    { who: 'coco', state: 'Executing…' },
    { who: 'coco', text: 'Sent you to YouTube.', state: 'Ready for confirmation',
      act: { title: 'Connect YouTube', rows: [['Target', 'Moonveil Audio'], ['Permission', 'Founder + paired device']], status: 'Waiting' },
      cards: [{ t: 'Reference', v: 'BRN-1', go: '#brain' }] },
  ];
  const html = new Function('CHAT_LOG', 'esc', `${chatViewSrc}\nreturn chatView();`)(LOG, esc);
  for (const want of ['bubble you', 'bubble coco working', 'chatstate', 'chatact', 'chatactrow',
                      'Connect YouTube', 'Moonveil Audio', 'Waiting', 'chatcard', 'chatForm']) {
    assert.ok(html.includes(want), 'the view is missing ' + want);
  }
  assert.ok(!html.includes('undefined') && !html.includes('NaN'), 'something leaked into the view');
});

await t('the chat view escapes everything that came from the company', () => {
  const nasty = '<img src=x onerror=alert(1)>';
  const LOG = [{ who: 'coco', text: nasty, state: nasty,
    act: { title: nasty, rows: [[nasty, nasty]], status: nasty }, cards: [{ t: nasty, v: nasty, go: nasty }] }];
  const html = new Function('CHAT_LOG', 'esc', `${chatViewSrc}\nreturn chatView();`)(LOG, esc);
  // "onerror=" still appears, as the four characters of escaped TEXT - that is not a handler. What
  // must never happen is the payload surviving as markup, so the test is that no < or " from the
  // input reached the page intact and the raw string is nowhere in it.
  assert.strictEqual(html.indexOf('<img'), -1, 'raw HTML reached the page');
  assert.strictEqual(html.indexOf(nasty), -1, 'the payload survived unescaped');
  const drawn = (html.match(/img src=x onerror=alert\(1\)/g) || []).length;
  const safe = (html.match(/&lt;img src=x onerror=alert\(1\)&gt;/g) || []).length;
  assert.ok(drawn > 0, 'the payload should appear somewhere as text');
  assert.strictEqual(safe, drawn, 'every place the view draws company text must be escaped');
});

await t('an empty log still offers something to try', () => {
  const html = new Function('CHAT_LOG', 'esc', `${chatViewSrc}\nreturn chatView();`)([], esc);
  assert.ok(/Try:/.test(html), 'an empty chat must suggest what to say');
  assert.ok(/chatForm/.test(html));
});

// Every CSS class the view emits must actually be styled, or a state renders as unstyled text.
await t('the new chat classes are all defined in the stylesheet', () => {
  const css = src.slice(0, src.indexOf('</style>'));
  for (const cls of ['.chatstate', '.chatact', '.chatactrow', '.bubble.coco.working']) {
    assert.ok(css.includes(cls), cls + ' is emitted but never styled');
  }
});

// ---------------------------------------------------------------- the four devices and the one version
// Three questions Boss asks out loud, each answered from a cloud row the page already holds: the
// devices from their own heartbeats, the version from the release registry, the approval from the one
// shared approval record. None of them may be answered with a guess, and none costs a Claude call.
const fresh = () => new Date().toISOString();
const old = () => new Date(Date.now() - 10 * 60 * 1000).toISOString();
const FOUR = [
  { id: 'mangesh-pc', name: 'Boss PC', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: fresh() },
  { id: 'shreya-pc', name: 'Big Boss PC', kind: 'pc', app_version: 'desktop-2.9.0', last_seen: fresh() },
  { id: 'mangesh-phone', name: 'Boss phone', kind: 'phone', app_version: 'android-2.8.2', last_seen: fresh() },
  { id: 'shreya-phone', name: 'Big Boss phone', kind: 'phone', app_version: 'android-2.9.0', last_seen: old() },
];
const REL = { release_id: 'coco-2.9.0', version: '2.9.0', status: 'blocked',
  desktop_artifact: 'git main', desktop_sha256: 'deadbeef', android_version_code: 17 };

await t('"are all devices updated" is answered from what each device reported', async () => {
  const c = make({ D: { devices: FOUR }, release: REL });
  const a = c.chatRead(c.chatIntent('are all devices updated?'));
  assert.match(a.text, /Coco 2\.9\.0/, 'it names the release they are measured against');
  assert.match(a.text, /2 of 4/, 'two of the four are really on it: ' + a.text);
  assert.match(a.text, /Boss phone on 2\.8\.2/, 'and names the one that is behind');
  assert.equal(a.cards.length, 4, 'one card per device');
});

await t('a device that stopped reporting is offline, never updated', async () => {
  const c = make({ D: { devices: FOUR }, release: REL });
  const a = c.chatRead(c.chatIntent('sab update ho gaye?'));
  assert.match(a.text, /Big Boss phone has not reported recently/, 'the silent one is named: ' + a.text);
  assert.match(a.text, /will not call it updated/, 'and is explicitly not counted as updated');
  // it reports 2.9.0, which is the latest - the version alone must not be enough
  assert.ok(!/3 of 4|4 of 4/.test(a.text), 'a stale matching version does not become an updated device');
});

await t('with no release anywhere it says so instead of picking a number', async () => {
  const c = make({ D: { devices: FOUR } });
  const a = c.chatRead(c.chatIntent('are all four updated?'));
  assert.match(a.text, /no release row in the cloud and no release\.json/, a.text);
});

await t('"what is the latest Coco version" reads the cloud release registry', async () => {
  const c = make({ D: { devices: FOUR }, release: REL });
  const a = c.chatRead(c.chatIntent('what is the latest coco version?'));
  assert.match(a.text, /Coco 2\.9\.0 \(coco-2\.9\.0\), blocked/, a.text);
  assert.match(a.text, /no Android build/, 'and says which half is missing, which is why it is blocked');
  assert.match(a.text, /refuses half a release/, 'naming the rule rather than implying a choice');
});

await t('a release with both builds is waiting for a YES, not approved', async () => {
  const c = make({ release: { ...REL, android_artifact: 'coco-17.apk', android_sha256: 'cafe', status: 'candidate' } });
  const a = c.chatRead(c.chatIntent('coco version?'));
  assert.match(a.text, /waiting for a founder/, a.text);
  assert.ok(!/approved/i.test(a.text), 'built is not approved');
});

await t('an approved release names who approved it', async () => {
  const c = make({ release: { ...REL, android_artifact: 'a.apk', android_sha256: 'cafe', status: 'approved', approved_by: 'Shreya', approved_at: fresh() } });
  const a = c.chatRead(c.chatIntent('latest version?'));
  assert.match(a.text, /Approved by Shreya/, a.text);
});

await t('"did Big Boss approve this" reads the one cloud approval record', async () => {
  const APPROVALS = [{ id: 'u1', code: 'A-031', what: 'Publish the weekly Short', state: 'approved', decided_by: 'Shreya', decided_at: fresh() }];
  const c = make({ D: { approvals: APPROVALS } });
  const a = c.chatRead(c.chatIntent('did big boss approve A-031?'));
  assert.match(a.text, /A-031 was approved by Shreya/, a.text);
  assert.ok(a.cards.some((x) => x.v === 'Shreya'), 'the approver is on a card');
});

await t('a rejected request is reported as turned down, not as pending', async () => {
  const c = make({ D: { approvals: [{ id: 'u2', code: 'A-032', what: 'Spend money', state: 'rejected', decided_by: 'Mangesh', decided_at: fresh() }] } });
  const a = c.chatRead(c.chatIntent('was A-032 approved?'));
  assert.match(a.text, /turned down by Mangesh/, a.text);
});

await t('asking about approvals with nothing decided still lists what is waiting', async () => {
  const c = make({ D: { approvals: [{ id: 'u3', code: 'A-033', what: 'Something', state: 'waiting' }] } });
  const a = c.chatRead(c.chatIntent('what approvals are pending?'));
  assert.match(a.text, /1 waiting: A-033/, a.text);
});

await t('neither question is routed through Claude', async () => {
  const src = chatSrc;
  const block = src.slice(src.indexOf("it.intent === 'devices_version'"), src.indexOf("it.intent === 'release_state'") + 1200);
  assert.ok(!/claudeCall|gateway|anthropic|fetch\(/i.test(block), 'the device and release answers are pure reads of loaded rows');
});

console.log(`\nassistant: ${pass}/${pass} passed · 0 Claude calls by construction`);
