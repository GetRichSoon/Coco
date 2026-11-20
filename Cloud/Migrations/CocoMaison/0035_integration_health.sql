-- 0035 integration health history (DEVELOPMENT ONLY: NOT applied to Coco Cloud).
-- One row per check per run. Additive: one new table and one helper function; nothing existing is altered.
-- The monitor (scripts/ops/integration-health.mjs) writes it through Nova; error text is redacted before it gets here.
-- Rollback: 0035_integration_health.down.sql.
create table if not exists public.integration_health (
  id             text primary key,                    -- '<run_label>:<integration>/<account>' so a re-run writes nothing twice
  integration_id text not null,
  account_id     text,
  checked_at     timestamptz not null default now(),
  status         text not null check (status in ('CONNECTED_AND_VERIFIED','CONNECTED_BUT_INSECURE','CONNECTED_BUT_FAILING','EXPIRED',
                   'INVALID','DISCONNECTED','NOT_CONFIGURED','INSUFFICIENT_PERMISSION','UNKNOWN')),
  detail         text,
  latency_ms     int,
  run_label      text,
  incident_id    text
);
create index if not exists integration_health_key_idx on public.integration_health (integration_id, account_id, checked_at desc);
create index if not exists integration_health_at_idx  on public.integration_health (checked_at);

-- No role list on these policies: who reaches the table is decided by GRANTs (0043_nova_roles: Nova's coco_member), which rows by the predicate. No Supabase role is needed.
alter table public.integration_health enable row level security;
drop policy if exists "founders only" on public.integration_health;
create policy "founders only" on public.integration_health for all
  using (private.is_founder() and private.device_ok()) with check (private.is_founder() and private.device_ok());
drop policy if exists "coco engine read" on public.integration_health;
create policy "coco engine read" on public.integration_health for select using (private.engine_ok());
drop policy if exists "coco engine write" on public.integration_health;
create policy "coco engine write" on public.integration_health for insert with check (private.engine_ok());

-- 90 day retention: call public.integration_health_prune(90) from the nightly job (engine cannot call it; founders/service only).
create or replace function public.integration_health_prune(p_days int default 90) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.integration_health where checked_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.integration_health_prune(int) from public;
