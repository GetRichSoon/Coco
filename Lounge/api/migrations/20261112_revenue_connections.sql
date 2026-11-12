-- 2026-11-12  Revenue ledger + connection secrets (ADDITIVE).  Applied to the Good Space database through the Supabase migration tool.
--
-- What it adds
--   1. public.revenue_events  every sale / refund a connected source reported (one row per source + external id)
--   2. public.revenue_sync    when each connection was last synced, whether it worked, and why not
--   3. public.coco_revenue_upsert(jsonb) and public.coco_revenue_sync_set(...)  the ONLY way to write them (founder on a paired device)
--   4. private.publishing_secret_name_ok  also accepts picktheory_api_key_<connection> so an API key can sit in the vault
--      next to the OAuth tokens (the same store/read functions as before; no new door)
--   5. public.coco_job_retry(text)  a founder's Retry for a failed / cancelled job (cancel existed; retry had no founder door)
-- Nothing existing is removed, renamed or rewritten, and no existing row is touched.
--
-- Rollback: 20261112_revenue_connections.rollback.sql (next to this file). Revenue rows only ever hold what a sync fetched, and a sync can fetch it again.

create table if not exists public.revenue_events (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,                       -- the provider: 'gumroad', 'picktheory', ...
  connection_id text,                                -- integration_accounts.connection_id it came through
  house_id      text,                                -- houses.id the money belongs to
  product_id    text,                                -- the provider's product id (or Coco's, when mapped)
  occurred_at   timestamptz not null,
  amount        numeric not null check (amount >= 0), -- major units (rupees, dollars), never negative: kind says which way it went
  currency      text not null check (currency ~ '^[A-Z]{3}$'),
  kind          text not null check (kind in ('sale', 'refund')),
  external_id   text not null,                       -- the provider's own id for the sale / refund
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists revenue_events_conn_time on public.revenue_events (connection_id, occurred_at desc);
create index if not exists revenue_events_time on public.revenue_events (occurred_at desc);

create table if not exists public.revenue_sync (
  connection_id  text primary key,
  provider       text,
  last_synced_at timestamptz,                        -- the last attempt, good or bad
  last_ok_at     timestamptz,                        -- the last attempt that worked (zero sales is a success)
  state          text,                               -- 'ok' | 'error'
  error          text,
  records        integer not null default 0,         -- rows the last attempt fetched
  updated_at     timestamptz not null default now()
);

alter table public.revenue_events enable row level security;
alter table public.revenue_sync   enable row level security;

-- the same expressions yt_stats uses: founders on a paired device read; the engine key may read. Nobody writes through a policy.
-- (created only when missing, so the file can be run twice)
do $policies$
declare t text;
begin
  foreach t in array array['revenue_events', 'revenue_sync'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'founders read') then
      execute format('create policy "founders read" on public.%I for select to authenticated using (private.is_founder() and private.device_ok())', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'coco engine read') then
      execute format('create policy "coco engine read" on public.%I for select to authenticated using (private.engine_ok())', t);
    end if;
  end loop;
end
$policies$;

-- Supabase hands every new table to anon / authenticated; take the writes (and anon altogether) back.
revoke all on public.revenue_events from anon, authenticated;
revoke all on public.revenue_sync   from anon, authenticated;
grant select on public.revenue_events to authenticated;
grant select on public.revenue_sync   to authenticated;

-- Writes: rows = [{source, external_id, occurred_at, amount, currency, kind, connection_id?, house_id?, product_id?, meta?}, ...]
create or replace function public.coco_revenue_upsert(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n int; v_bad int; v_ins int := 0; v_upd int := 0;
begin
  if not (private.is_founder() and private.device_ok()) then
    raise exception 'only a founder on a paired device may record revenue';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'revenue rows must be a JSON array';
  end if;
  v_n := jsonb_array_length(p_rows);
  if v_n = 0 then return jsonb_build_object('ok', true, 'received', 0, 'inserted', 0, 'updated', 0); end if;
  if v_n > 5000 then raise exception 'at most 5000 revenue rows per call'; end if;

  select count(*) into v_bad from jsonb_array_elements(p_rows) e
   where jsonb_typeof(e) <> 'object'
      or coalesce(e ->> 'source', '') = '' or coalesce(e ->> 'external_id', '') = ''
      or coalesce(e ->> 'kind', '') not in ('sale', 'refund')
      or coalesce(e ->> 'currency', '') !~* '^[a-z]{3}$'
      or coalesce(e ->> 'amount', '') !~ '^[0-9]+(\.[0-9]+)?$'
      or coalesce(e ->> 'occurred_at', '') = '';
  if v_bad > 0 then
    raise exception '% of % revenue rows are incomplete (each needs source, external_id, kind sale|refund, a 3-letter currency, a non-negative amount and occurred_at)', v_bad, v_n;
  end if;

  with src as (
    select distinct on (e ->> 'source', e ->> 'external_id')
           e ->> 'source' as source, nullif(e ->> 'connection_id', '') as connection_id, nullif(e ->> 'house_id', '') as house_id,
           nullif(e ->> 'product_id', '') as product_id, (e ->> 'occurred_at')::timestamptz as occurred_at,
           (e ->> 'amount')::numeric as amount, upper(e ->> 'currency') as currency, e ->> 'kind' as kind,
           e ->> 'external_id' as external_id, coalesce(e -> 'meta', '{}'::jsonb) as meta
      from jsonb_array_elements(p_rows) e
     order by e ->> 'source', e ->> 'external_id', (e ->> 'occurred_at')::timestamptz desc
  ), up as (
    insert into public.revenue_events as r (source, connection_id, house_id, product_id, occurred_at, amount, currency, kind, external_id, meta)
    select source, connection_id, house_id, product_id, occurred_at, amount, currency, kind, external_id, meta from src
    on conflict (source, external_id) do update set
      connection_id = excluded.connection_id, house_id = excluded.house_id, product_id = excluded.product_id,
      occurred_at = excluded.occurred_at, amount = excluded.amount, currency = excluded.currency, kind = excluded.kind, meta = excluded.meta
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;

  return jsonb_build_object('ok', true, 'received', v_n, 'inserted', v_ins, 'updated', v_upd);
end $$;

-- One row per connection: the last attempt, and the last one that worked. A failed attempt never erases last_ok_at.
create or replace function public.coco_revenue_sync_set(p_connection text, p_provider text, p_state text, p_error text default null, p_records integer default 0)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (private.is_founder() and private.device_ok()) then
    raise exception 'only a founder on a paired device may record a revenue sync';
  end if;
  if p_connection is null or p_connection !~ '^[a-z0-9][a-z0-9._-]{1,60}$' then raise exception 'bad connection id'; end if;
  if p_state is null or p_state not in ('ok', 'error') then raise exception 'a revenue sync ends ok or error'; end if;

  insert into public.revenue_sync as s (connection_id, provider, last_synced_at, last_ok_at, state, error, records, updated_at)
  values (p_connection, p_provider, now(), case when p_state = 'ok' then now() end, p_state,
          case when p_state = 'ok' then null else left(coalesce(p_error, 'the sync failed'), 500) end, greatest(coalesce(p_records, 0), 0), now())
  on conflict (connection_id) do update set
    provider = coalesce(excluded.provider, s.provider), last_synced_at = excluded.last_synced_at,
    last_ok_at = case when excluded.state = 'ok' then excluded.last_ok_at else s.last_ok_at end,
    state = excluded.state, error = excluded.error, records = excluded.records, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'connection_id', p_connection, 'state', p_state);
end $$;

-- A founder's Retry on a failed or cancelled job. coco_job_submit / _block / _recover are the runtime's (engine key); only cancel existed for a founder.
-- The job goes back to the queue with a fresh set of attempts; its errors history stays. A running or finished job is never touched.
create or replace function public.coco_job_retry(p_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_row jobs;
begin
  if not (private.is_founder() and private.device_ok()) then
    raise exception 'only a founder on a paired device may retry a job';
  end if;
  update jobs set status = 'queued', attempt = 0, run_after = now(), lease_owner = null, lease_until = null, failed_at = null,
                  error = '{}'::jsonb, updated_at = now()
   where id = p_id and status in ('failed', 'cancelled')
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'reason', 'no failed or cancelled job with that id'); end if;
  insert into activity (actor, action, detail)
    values (coalesce(auth.jwt() ->> 'email', 'founder'), 'job retried', format('%s (%s)', v_row.id, v_row.type));
  return jsonb_build_object('ok', true, 'job', to_jsonb(v_row));
end $$;

revoke all on function public.coco_revenue_upsert(jsonb) from public, anon;
revoke all on function public.coco_revenue_sync_set(text, text, text, text, integer) from public, anon;
revoke all on function public.coco_job_retry(text) from public, anon;
grant execute on function public.coco_revenue_upsert(jsonb) to authenticated;
grant execute on function public.coco_revenue_sync_set(text, text, text, text, integer) to authenticated;
grant execute on function public.coco_job_retry(text) to authenticated;

-- an API key (PickTheory) is sealed in the same vault, under a name the same two functions already check
create or replace function private.publishing_secret_name_ok(p_name text)
returns boolean
language sql
immutable
as $$
  select p_name ~ '^gumroad_(access|refresh)_token_[a-z0-9][a-z0-9_]{0,39}$'
      or p_name ~ '^youtube_refresh_token_[a-z0-9][a-z0-9_]{0,39}$'
      or p_name ~ '^picktheory_api_key_[a-z0-9][a-z0-9_]{0,39}$';
$$;
