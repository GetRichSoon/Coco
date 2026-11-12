// Run: node conn.enqueue.test.js   (no network: real Postgres in process, PGlite)
//
// The PROPOSED migration reports/ops-proposed-migration-task-enqueue.sql, run against a stand-in with the production shapes it touches
// (tasks, jobs, devices, activity, their CHECK constraints, tasks_done_needs_evidence, private.is_founder / device_ok). It is NOT applied to
// production. It must: let only a founder on a paired device start a task; accept only the zero-AI job types and force claude_budget to 0;
// make one job per task and type however many times Start is pressed; follow the job's life onto the task; never revive a stopped task; never
// touch a job that is not a task's; let a founder cancel a run request that has not started; and be safe to run twice.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

let pass = 0, fail = 0, skip = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.message}`); } };
const file = new URL('../reports/ops-proposed-migration-task-enqueue.sql', import.meta.url);
if (!existsSync(file)) { console.log('SKIP the proposed migration is not in this tree'); process.exit(0); }
const sql = readFileSync(file, 'utf8');

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema private; create schema auth;
create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('email', 'boss@example.test') $$;
create function private.is_founder() returns boolean language sql as $$ select coalesce(current_setting('app.founder', true), 'on') = 'on' $$;
create function private.device_ok() returns boolean language sql as $$ select coalesce(current_setting('app.device', true), 'on') = 'on' $$;
create table public.devices (id text primary key); insert into public.devices values ('cloud-worker-1');
create table public.tasks (id uuid primary key default gen_random_uuid(), title text not null, details text, house_id text, needs text not null default 'any',
  status text not null default 'queued', priority integer not null default 2, claimed_by_device text references public.devices(id), claimed_at timestamptz, heartbeat_at timestamptz,
  result text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), merged_into uuid references public.tasks(id), retry_count integer default 0, error text, evidence text,
  constraint tasks_needs_check check (needs = any (array['cloud','pc','any'])),
  constraint tasks_status_check check (status = any (array['planned','queued','working','need_approval','blocked','failed','verifying','done','paused','cancelled','running','waiting_pc','needs_yes','stopped'])));
create function public.tasks_done_needs_evidence() returns trigger language plpgsql as $$ begin
  if new.status = 'done' and coalesce(new.evidence, new.result, '') = '' then raise exception 'DONE needs evidence or result'; end if; return new; end $$;
create trigger tasks_done_evidence before insert or update of status on public.tasks for each row execute function public.tasks_done_needs_evidence();
create table public.jobs (id text primary key default ('JOB-' || to_char((now() at time zone 'UTC'), 'YYYY-MM-DD') || '-' || substr(gen_random_uuid()::text, 1, 8)),
  idempotency_key text not null unique, type text not null, company_id text not null default 'good-space', team_id text not null, subteam_id text, category_id text, channel_id text, agent_id text,
  workflow_id text, run_id text, payload jsonb not null default '{}', priority integer not null default 2, status text not null default 'queued', attempt integer not null default 0,
  max_attempts integer not null default 3, run_after timestamptz not null default now(), lease_owner text, lease_until timestamptz, created_at timestamptz not null default now(),
  started_at timestamptz, completed_at timestamptz, failed_at timestamptz, result jsonb not null default '{}', error jsonb not null default '{}', errors jsonb not null default '[]', updated_at timestamptz not null default now(),
  constraint jobs_status_check check (status = any (array['queued','running','done','failed','cancelled','blocked'])),
  constraint jobs_max_attempts_check check (max_attempts >= 1 and max_attempts <= 20), constraint jobs_payload_is_small check (octet_length(payload::text) <= 65536),
  constraint jobs_running_has_lease check (status <> 'running' or (lease_owner is not null and lease_until is not null)));
create table public.run_requests (id bigint generated always as identity primary key, workflow_id text not null, state text not null default 'pending', requested_by text, device_id text, note text, run_id text,
  result text, reason text, created_at timestamptz not null default now(), claimed_at timestamptz, claimed_by text, finished_at timestamptz,
  constraint run_requests_state_check check (state = any (array['pending','claimed','done','failed','refused','cancelled'])));
create table public.activity (id bigint generated always as identity primary key, at timestamptz not null default now(), actor text not null, device_id text, action text not null, detail text);
`);
await db.exec(sql); await db.exec(sql);   // safe to run twice

const q = async (text, params = []) => (await db.query(text, params)).rows;
const mkTask = async (o = {}) => (await q('insert into public.tasks (title, house_id, needs, status, priority) values ($1,$2,$3,$4,$5) returning *', [o.title ?? '[COCO TEST] synthetic task', o.house ?? 'gigi', 'cloud', o.status ?? 'queued', o.priority ?? 2]))[0];
const enqueue = async (task, type = 'filter-rank', team = null, payload = {}) => (await q('select public.coco_task_enqueue($1, $2, $3, $4::jsonb) as v', [task, type, team, JSON.stringify(payload)]))[0].v;
const task = async (id) => (await q('select * from public.tasks where id = $1', [id]))[0];
const job = async (id) => (await q('select * from public.jobs where id = $1', [id]))[0];
// what the worker's own functions do to a row (coco_job_claim / done / fail / cancel), as plain updates
const claim = (id) => q("update public.jobs set status = 'running', lease_owner = 'gh-1', lease_until = now() + interval '10 minutes', attempt = attempt + 1, updated_at = now() where id = $1", [id]);
const finish = (id, status, extra = {}) => q("update public.jobs set status = $2, lease_owner = null, lease_until = null, result = $3::jsonb, error = $4::jsonb, updated_at = now() where id = $1",
  [id, status, JSON.stringify(extra.result ?? {}), JSON.stringify(extra.error ?? {})]);
const as = (founder, device = true) => db.exec(`select set_config('app.founder', '${founder ? 'on' : 'off'}', false), set_config('app.device', '${device ? 'on' : 'off'}', false)`);

await t('1 a founder on a paired device starts a task: one queued job, linked, zero Claude, the task waits for a worker', async () => {
  await as(true);
  const tk = await mkTask({ house: 'gigi', priority: 3 }); const r = await enqueue(tk.id, 'filter-rank', null, { candidates: ['a', 'b'], top: 1, claude_budget: 5, coco_task_id: 'spoofed' });
  assert.equal(r.ok, true); assert.equal(r.duplicate, false);
  const j = await job(r.job.id);
  assert.equal(j.type, 'filter-rank'); assert.equal(j.status, 'queued'); assert.equal(j.team_id, 'youtube', 'gigi is the YouTube House'); assert.equal(j.priority, 3); assert.equal(j.max_attempts, 3);
  assert.equal(j.idempotency_key, `coco-task:${tk.id}:filter-rank`);
  assert.equal(j.payload.claude_budget, 0, 'the caller cannot buy Claude calls'); assert.equal(j.payload.coco_task_id, tk.id, 'the caller cannot point the job at another task'); assert.deepEqual(j.payload.candidates, ['a', 'b']);
  const after = await task(tk.id); assert.equal(after.status, 'queued'); assert.match(after.result, /Waiting for a worker: cloud job JOB-/); assert.equal(after.error, null);
  assert.equal((await q("select count(*)::int n from public.activity where action = 'task started'"))[0].n, 1);
});

await t('2 only a founder on a paired device may start a task', async () => {
  const tk = await mkTask();
  await as(false); await assert.rejects(() => enqueue(tk.id), /only a founder on a paired device/);
  await as(true, false); await assert.rejects(() => enqueue(tk.id), /only a founder on a paired device/);
  await as(true);
  assert.equal((await q('select count(*)::int n from public.jobs where payload ->> \'coco_task_id\' = $1', [tk.id]))[0].n, 0, 'nothing was queued');
});

await t('3 only the five zero-AI, payload-only job types; nothing that runs a command or publishes', async () => {
  const tk = await mkTask();
  for (const type of ['filter-rank', 'package-research', 'search-memory', 'validate-output', 'title-analytics']) assert.equal((await enqueue(tk.id, type)).ok, true, type);
  for (const bad of ['build-artifact', 'check-artifact', 'pack-extension', 'publish-extension', 'store-artifact', 'teleport', '', null]) await assert.rejects(() => enqueue(tk.id, bad), /without AI/, String(bad));
  await assert.rejects(() => q("select public.coco_task_enqueue($1, 'filter-rank', null, '[1]'::jsonb)", [tk.id]), /JSON object/);
  await assert.rejects(() => enqueue(tk.id, 'filter-rank', 'Bad Team!'), /bad team id/);
  assert.equal((await enqueue(tk.id, 'filter-rank', 'ebooks')).duplicate, true, 'a different team does not make a second job for the same task and type');
});

await t('4 pressing Start twice is one job; a failed or cancelled job is put back, not duplicated', async () => {
  const tk = await mkTask(); const a = await enqueue(tk.id), b = await enqueue(tk.id);
  assert.equal(a.job.id, b.job.id); assert.equal(b.duplicate, true);
  assert.equal((await q('select count(*)::int n from public.jobs where idempotency_key = $1', [`coco-task:${tk.id}:filter-rank`]))[0].n, 1);
  await claim(a.job.id); await finish(a.job.id, 'failed', { error: { kind: 'permanent', message: 'boom' } });
  assert.equal((await task(tk.id)).status, 'failed');
  const c = await enqueue(tk.id, 'filter-rank', null, { top: 2 });
  assert.equal(c.job.id, a.job.id); assert.equal(c.duplicate, false); const j = await job(a.job.id);
  assert.equal(j.status, 'queued'); assert.equal(j.attempt, 0); assert.deepEqual(j.error, {}); assert.equal(j.payload.top, 2, 'the retry carries the new payload');
  const back = await task(tk.id); assert.equal(back.status, 'queued'); assert.equal(back.error, null);
});

await t('5 a task that is running, finished or merged cannot be started again; a missing one says so', async () => {
  for (const status of ['running', 'working', 'verifying', 'done', 'cancelled']) { const tk = await mkTask({ status: status === 'done' ? 'queued' : status }); if (status === 'done') await q("update public.tasks set status = 'done', result = 'ok' where id = $1", [tk.id]); const r = await enqueue(tk.id); assert.equal(r.ok, false, status); assert.match(r.reason, new RegExp(status)); }
  const a = await mkTask(), b = await mkTask(); await q('update public.tasks set merged_into = $2 where id = $1', [a.id, b.id]); assert.match((await enqueue(a.id)).reason, /merged/);
  assert.equal((await enqueue('00000000-0000-0000-0000-000000000000')).reason, 'no such task');
  for (const status of ['planned', 'paused', 'blocked', 'failed', 'stopped']) { const tk = await mkTask({ status }); assert.equal((await enqueue(tk.id)).ok, true, `${status} can be started`); assert.equal((await task(tk.id)).status, 'queued'); }
});

await t('6 the job\'s life is the task\'s: running, then done with evidence', async () => {
  const tk = await mkTask(); const { job: j } = await enqueue(tk.id, 'validate-output');
  await claim(j.id); let s = await task(tk.id); assert.equal(s.status, 'running'); assert.equal(s.claimed_by_device, 'cloud-worker-1'); assert.ok(s.claimed_at && s.heartbeat_at); assert.match(s.result, /Running in the cloud/);
  await finish(j.id, 'done', { result: { artifacts: [], meta: { ok: true }, worker: 'gh-1', claude: { budget: 0, used: 0 } } });
  s = await task(tk.id); assert.equal(s.status, 'done'); assert.match(s.result, /finished/); assert.equal(s.error, null);
  const ev = JSON.parse(s.evidence); assert.equal(ev.cloud_job, j.id); assert.equal(ev.type, 'validate-output'); assert.match(ev.result, /"used": ?0/);
});

await t('7 failed, blocked, cancelled and a transient retry each show on the task honestly', async () => {
  const f = await mkTask(); const jf = (await enqueue(f.id)).job; await claim(jf.id); await finish(jf.id, 'failed', { error: { kind: 'permanent', message: 'handler said no' } });
  let s = await task(f.id); assert.equal(s.status, 'failed'); assert.equal(s.error, 'handler said no'); assert.match(s.result, /failed/);
  const b = await mkTask(); const jb = (await enqueue(b.id, 'search-memory')).job; await finish(jb.id, 'blocked', { error: { kind: 'unsupported', message: 'no handler for job type search-memory' } });
  s = await task(b.id); assert.equal(s.status, 'blocked'); assert.match(s.error, /no handler/);
  const c = await mkTask(); const jc = (await enqueue(c.id, 'package-research')).job; await finish(jc.id, 'cancelled', { error: { kind: 'cancelled', message: 'founder' } });
  s = await task(c.id); assert.equal(s.status, 'stopped'); assert.match(s.result, /cancelled/); assert.equal(s.error, null);
  const r = await mkTask(); const jr = (await enqueue(r.id, 'title-analytics')).job; await claim(jr.id); await finish(jr.id, 'queued', { error: { kind: 'transient', message: 'flaky' } });
  s = await task(r.id); assert.equal(s.status, 'queued'); assert.equal(s.claimed_by_device, null); assert.match(s.result, /Waiting for a worker.*attempt 2 of 3/);
});

await t('8 a task a founder stopped is never revived by its job; a finished job does not reopen a done task', async () => {
  const tk = await mkTask(); const { job: j } = await enqueue(tk.id); await claim(j.id);
  await q("update public.tasks set status = 'stopped' where id = $1", [tk.id]);
  await finish(j.id, 'done', { result: { artifacts: [] } }); assert.equal((await task(tk.id)).status, 'stopped');
  const d = await mkTask(); const { job: k } = await enqueue(d.id, 'filter-rank'); await claim(k.id); await finish(k.id, 'done', { result: { artifacts: [] } });
  await q("update public.jobs set status = 'failed' where id = $1", [k.id]); assert.equal((await task(d.id)).status, 'done');
});

await t('9 a job that is not a task\'s, or carries a bad task id, is left alone and never raises', async () => {
  const other = await mkTask(); const before = await task(other.id);
  await q("insert into public.jobs (idempotency_key, type, team_id, payload) values ('plain-1', 'filter-rank', 'core', '{}'), ('plain-2', 'filter-rank', 'core', '{\"coco_task_id\": \"not-a-uuid\"}'), ('plain-3', 'filter-rank', 'core', '{\"coco_task_id\": \"00000000-0000-0000-0000-000000000000\"}')");
  for (const k of ['plain-1', 'plain-2', 'plain-3']) { const id = (await q('select id from public.jobs where idempotency_key = $1', [k]))[0].id; await claim(id); await finish(id, 'done', { result: {} }); assert.equal((await job(id)).status, 'done', `${k} still finishes`); }
  assert.deepEqual(await task(other.id), before);
});

await t('10 a task that cannot be updated never blocks the worker', async () => {
  const tk = await mkTask(); const { job: j } = await enqueue(tk.id); await claim(j.id);
  await db.exec("alter table public.tasks add constraint tasks_frozen check (status <> 'done') not valid");
  await finish(j.id, 'done', { result: { artifacts: [] } });
  assert.equal((await job(j.id)).status, 'done', 'the job row is the truth even when the task could not follow'); assert.equal((await task(tk.id)).status, 'running');
  await db.exec('alter table public.tasks drop constraint tasks_frozen');
});

await t('11 the team follows the House unless the founder names one; the payload must be small like any job', async () => {
  const want = { gigi: 'youtube', lulu: 'software', poppy: 'ebooks', fifi: 'courses', zaza: 'games', mochi: 'comics', tilly: 'commerce', nowhere: 'core' };
  for (const [house, team] of Object.entries(want)) { const tk = await mkTask({ house: null }); await q('update public.tasks set house_id = $2 where id = $1', [tk.id, house]); assert.equal((await enqueue(tk.id)).job.team_id, team, house); }
  const tk = await mkTask(); assert.equal((await enqueue(tk.id, 'search-memory', 'research')).job.team_id, 'research');
  const big = await mkTask(); await assert.rejects(() => enqueue(big.id, 'filter-rank', null, { x: 'y'.repeat(70000) }), /jobs_payload_is_small/);
});

await t('12 a founder cancels a run request that is still waiting; one that started, or does not exist, cannot be recalled', async () => {
  const mk = async (state) => (await q("insert into public.run_requests (workflow_id, state, note) values ('youtube-pick', $1, 'coco-task:x') returning id", [state]))[0].id;
  const cancel = async (id) => (await q('select public.coco_run_request_cancel($1) as v', [id]))[0].v;
  const waiting = await mk('pending'); const r = await cancel(waiting);
  assert.equal(r.ok, true); assert.equal(r.request.state, 'cancelled'); assert.equal(r.request.reason, 'cancelled by a founder'); assert.ok(r.request.finished_at);
  assert.equal((await q('select state from public.run_requests where id = $1', [waiting]))[0].state, 'cancelled');
  assert.equal((await q("select count(*)::int n from public.activity where action = 'run request cancelled'"))[0].n, 1);
  for (const state of ['claimed', 'done', 'failed']) { const id = await mk(state); const out = await cancel(id); assert.equal(out.ok, false, state); assert.equal((await q('select state from public.run_requests where id = $1', [id]))[0].state, state, 'untouched'); }
  assert.equal((await cancel(999999)).ok, false); assert.equal((await cancel(waiting)).ok, false, 'twice is not an error, it is just no longer waiting');
  const again = await mk('pending'); await as(false); await assert.rejects(() => cancel(again), /only a founder on a paired device/); await as(true, false); await assert.rejects(() => cancel(again), /only a founder on a paired device/); await as(true);
  assert.equal((await q('select state from public.run_requests where id = $1', [again]))[0].state, 'pending');
});

await t('13 the door is only open to signed-in apps: anon has no execute right, authenticated has', async () => {
  const has = async (role, fn) => (await q('select has_function_privilege($1, $2, \'execute\') as ok', [role, fn]))[0].ok;
  assert.equal(await has('authenticated', 'public.coco_task_enqueue(uuid,text,text,jsonb)'), true); assert.equal(await has('anon', 'public.coco_task_enqueue(uuid,text,text,jsonb)'), false);
  assert.equal(await has('authenticated', 'public.coco_run_request_cancel(bigint)'), true); assert.equal(await has('anon', 'public.coco_run_request_cancel(bigint)'), false);
  assert.equal(await has('authenticated', 'public.jobs_sync_task()'), false); assert.equal(await has('anon', 'public.jobs_sync_task()'), false);
});

await t('14 the migration is additive: it created three functions and one trigger and changed no existing row', async () => {
  const fns = (await q("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('coco_task_enqueue','coco_run_request_cancel','jobs_sync_task') order by 1")).map((r) => r.proname);
  assert.deepEqual(fns, ['coco_run_request_cancel', 'coco_task_enqueue', 'jobs_sync_task']);
  assert.equal((await q("select count(*)::int n from pg_trigger where tgname = 'jobs_task_sync' and not tgisinternal"))[0].n, 1, 'one trigger even after running the file twice');
  assert.ok(!/\b(drop\s+(table|column|function|schema|trigger)|truncate|delete\s+from|alter\s+table)\b/i.test(sql.replace(/^--.*$/gm, '')), 'no destructive statement outside the comments');
});

console.log(`\nconn.enqueue.test: ${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}`);
process.exit(fail ? 1 : 0);
