-- 2026-11-12 (c)  Start a task: coco_task_enqueue + the link back (ADDITIVE).  Founder's YES, 2026-11-12, given through the coordinator.
-- Written by the connectors agent as reports/ops-proposed-migration-task-enqueue.sql, reviewed against the live schema and applied here with the
-- changes marked  [review]  (two behaviour changes, and the trigger clears the old error when it puts a task back in the queue).
--
-- Why
--   A task row never becomes work by itself. A founder can write tasks (RLS: founders ALL), but only the cloud runtime (engine key) may call
--   coco_job_submit, so the app's Start button had no door to the durable queue (jobs); and nothing wrote a finished job back to its task.
--   This adds that door for work that needs NO AI, and the link back. It does not touch the intake path (task -> coco_request_run -> run-requests),
--   which is how AI team workflows are started and which a founder can already call.
--
-- What it adds
--   1. public.coco_task_enqueue(p_task uuid, p_job_type text, p_team text, p_payload jsonb)
--        A founder on a paired device creates ONE queued job for a task. The type is one of five zero-AI handlers (filter-rank, package-research,
--        search-memory, validate-output, title-analytics): none runs a command, none publishes. claude_budget is forced to 0 whatever the caller
--        sends. One job per (task, type): pressing Start twice returns the same job, and a job that failed or was cancelled is put back in the queue.
--        The task becomes 'queued' with a "waiting for a worker" result.
--        [review] title-analytics reads a folder NAMED BY THE PAYLOAD (input.book, joined to the repository root without a check) and appends a line
--        to a ledger file: its payload.book must be company/publishing/ebooks/<folder>, so a payload cannot point the worker anywhere else.
--   2. public.jobs_sync_task() + trigger jobs_task_sync on public.jobs (status changes only)
--        When a job that carries payload.coco_task_id changes status, its task follows: running, done (with evidence), failed (with the job's error),
--        cancelled -> stopped, blocked -> blocked, back to queued. It only moves a task that is still queued or running, so a task a founder stopped
--        is never revived. A job without coco_task_id is ignored, and a failure inside the trigger never blocks a worker's claim / done / fail.
--        [review] it also moves a task that the stale-heartbeat reaper (coco_reap_stale: no heartbeat for 10 minutes) blocked with "worker stopped",
--        because a job that outlives the reaper would otherwise finish while its task stays blocked for good.
--   3. public.coco_run_request_cancel(p_id bigint)
--        run_requests are read-only for a founder, so a task started as an AI team run (coco_request_run, tagged coco-task:<id>) could be stopped on
--        screen and still run at the next cloud cycle. This lets a founder on a paired device cancel a request that is still pending. A request that
--        is already running cannot be recalled.
--
-- Nothing existing is removed, renamed or rewritten, and no existing row is touched (the trigger returns at once for the jobs that exist).
-- Rollback: 20261112c_task_enqueue.rollback.sql (jobs and tasks already created stay as history; none of them is lost).

create or replace function public.coco_task_enqueue(p_task uuid, p_job_type text, p_team text default null, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c_types constant text[] := array['filter-rank', 'package-research', 'search-memory', 'validate-output', 'title-analytics'];
  t tasks; v_team text; v_key text; v_row jobs; v_dup boolean := false; v_payload jsonb;
begin
  if not (private.is_founder() and private.device_ok()) then
    raise exception 'only a founder on a paired device may start a task';
  end if;
  if p_job_type is null or not (p_job_type = any (c_types)) then
    raise exception 'a task can start these cloud jobs without AI: %', array_to_string(c_types, ', ');
  end if;
  if p_payload is null then p_payload := '{}'::jsonb; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'the job payload must be a JSON object'; end if;
  if p_job_type = 'title-analytics' and coalesce(p_payload ->> 'book', '') !~ '^company/publishing/ebooks/[a-z0-9][a-z0-9._-]{0,80}$' then
    raise exception 'title-analytics needs payload.book = company/publishing/ebooks/<book folder>';
  end if;

  select * into t from tasks where id = p_task for update;
  if t.id is null then return jsonb_build_object('ok', false, 'reason', 'no such task'); end if;
  if t.merged_into is not null then return jsonb_build_object('ok', false, 'reason', 'that task was merged into another one; start that one'); end if;
  if t.status in ('running', 'working', 'verifying', 'done', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', format('the task is already %s', t.status));
  end if;

  -- the team the job runs as: the founder's choice, else the team behind the task's House (the same map the intake uses for a "Team:" line)
  v_team := coalesce(nullif(btrim(p_team), ''), case t.house_id when 'gigi' then 'youtube' when 'lulu' then 'software' when 'poppy' then 'ebooks'
    when 'fifi' then 'courses' when 'zaza' then 'games' when 'mochi' then 'comics' when 'tilly' then 'commerce' else 'core' end);
  if v_team !~ '^[a-z0-9][a-z0-9._-]{1,60}$' then raise exception 'bad team id'; end if;

  v_key := format('coco-task:%s:%s', t.id, p_job_type);
  v_payload := (p_payload - 'claude_budget' - 'coco_task_id' - 'coco_task_title')
               || jsonb_build_object('claude_budget', 0, 'coco_task_id', t.id, 'coco_task_title', left(t.title, 120));

  insert into jobs (idempotency_key, type, team_id, payload, priority, max_attempts)
    values (v_key, p_job_type, v_team, v_payload, least(greatest(coalesce(t.priority, 2), 1), 5), 3)
    on conflict (idempotency_key) do nothing
    returning * into v_row;
  if v_row.id is null then
    select * into v_row from jobs where idempotency_key = v_key;
    v_dup := true;
    -- the same press after a failure or a cancel is a retry of the same job, not a second one
    if v_row.status in ('failed', 'cancelled') then
      update jobs set status = 'queued', attempt = 0, run_after = now(), lease_owner = null, lease_until = null, failed_at = null,
                      error = '{}'::jsonb, payload = v_payload, updated_at = now()
       where id = v_row.id returning * into v_row;
      v_dup := false;
    end if;
  end if;

  if not v_dup then
    update tasks set status = 'queued', error = null, claimed_by_device = null, claimed_at = null, updated_at = now(),
                     result = format('Waiting for a worker: cloud job %s (%s). It runs on the next worker run.', v_row.id, p_job_type)
     where id = t.id;
    insert into activity (actor, action, detail)
      values (coalesce(auth.jwt() ->> 'email', 'founder'), 'task started', format('%s -> cloud job %s (%s, team %s)', left(t.title, 80), v_row.id, p_job_type, v_team));
  end if;
  return jsonb_build_object('ok', true, 'duplicate', v_dup, 'job', to_jsonb(v_row));
end $$;

-- A job's status changes are mirrored onto the task it was made for. Never raises: a worker's claim / done / fail must not depend on a task row.
create or replace function public.jobs_sync_task()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_task uuid; v_msg text; v_movable boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  begin
    v_task := nullif(new.payload ->> 'coco_task_id', '')::uuid;
  exception when others then
    return new;                                              -- not a task job, or an id that is not a uuid
  end;
  if v_task is null then return new; end if;
  begin
    -- only a task that is still queued or running follows its job (a task a founder stopped is never revived), plus one the reaper blocked while the job lived
    select (status in ('queued', 'running') or (status = 'blocked' and coalesce(error, '') like 'worker stopped%')) into v_movable from tasks where id = v_task;
    if not coalesce(v_movable, false) then return new; end if;
    v_msg := left(coalesce(nullif(new.error ->> 'message', ''), 'the job failed'), 500);
    if new.status = 'running' then
      update tasks set status = 'running', claimed_by_device = (select id from devices where id = 'cloud-worker-1'), claimed_at = coalesce(claimed_at, now()),
                       heartbeat_at = now(), updated_at = now(), error = null, result = format('Running in the cloud: job %s (%s).', new.id, new.type)
       where id = v_task;
    elsif new.status = 'done' then
      update tasks set status = 'done', heartbeat_at = now(), updated_at = now(), error = null,
                       result = format('Cloud job %s (%s) finished.', new.id, new.type),
                       evidence = jsonb_build_object('cloud_job', new.id, 'type', new.type, 'result', left(new.result::text, 3000))::text
       where id = v_task;
    elsif new.status = 'failed' then
      update tasks set status = 'failed', heartbeat_at = now(), updated_at = now(), error = v_msg, result = format('Cloud job %s (%s) failed.', new.id, new.type)
       where id = v_task;
    elsif new.status = 'cancelled' then
      update tasks set status = 'stopped', updated_at = now(), error = null, result = format('Cloud job %s (%s) was cancelled.', new.id, new.type)
       where id = v_task;
    elsif new.status = 'blocked' then
      update tasks set status = 'blocked', updated_at = now(), error = v_msg, result = format('Cloud job %s (%s) is blocked.', new.id, new.type)
       where id = v_task;
    elsif new.status = 'queued' then                          -- a transient failure put it back: the worker will try again
      update tasks set status = 'queued', claimed_by_device = null, claimed_at = null, updated_at = now(), error = null,
                       result = format('Waiting for a worker: cloud job %s (%s), attempt %s of %s.', new.id, new.type, new.attempt + 1, new.max_attempts)
       where id = v_task;
    end if;
  exception when others then
    null;                                                    -- shortcut: a task that cannot be updated is not worth failing a worker's call; the job row stays the truth
  end;
  return new;
end $$;

-- Cancel a run request that has not started. The state 'cancelled' is already allowed by run_requests_state_check; the runtime only serves 'pending'.
create or replace function public.coco_run_request_cancel(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_row run_requests;
begin
  if not (private.is_founder() and private.device_ok()) then
    raise exception 'only a founder on a paired device may cancel a run request';
  end if;
  update run_requests set state = 'cancelled', reason = 'cancelled by a founder', finished_at = now()
   where id = p_id and state = 'pending'
  returning * into v_row;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no waiting run request with that id (one that is already running cannot be recalled)');
  end if;
  insert into activity (actor, action, detail)
    values (coalesce(auth.jwt() ->> 'email', 'founder'), 'run request cancelled', format('#%s %s', v_row.id, v_row.workflow_id));
  return jsonb_build_object('ok', true, 'request', to_jsonb(v_row));
end $$;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'jobs_task_sync' and tgrelid = 'public.jobs'::regclass and not tgisinternal) then
    create trigger jobs_task_sync after update of status on public.jobs for each row execute function public.jobs_sync_task();
  end if;
end
$trigger$;

revoke all on function public.coco_task_enqueue(uuid, text, text, jsonb) from public, anon;
revoke all on function public.coco_run_request_cancel(bigint) from public, anon;
revoke all on function public.jobs_sync_task() from public, anon, authenticated;
grant execute on function public.coco_task_enqueue(uuid, text, text, jsonb) to authenticated;
grant execute on function public.coco_run_request_cancel(bigint) to authenticated;
