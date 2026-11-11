-- 0037 device sync audit (Boss order 2026-11-04; numbered 0037 so it cannot collide with the engine repo's 0029-0036). PREPARED, NOT APPLIED.
-- Idempotent (safe to run twice). Only ever holds generic device labels, never ids, emails or names.
-- Cost: one row per 15 minutes = 96 rows a day (~30 KB), read once per cycle with limit 1.
-- Least privilege: the cloud engine may read and insert; founders may only read; nobody can update or delete an audit row.
-- ROLLBACK:  drop table if exists public.device_sync_audit;   (nothing else depends on it)

create table if not exists public.device_sync_audit (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  runner         text        not null,
  latest_version text,
  calls_reads    smallint    not null check (calls_reads between 0 and 7),
  calls_writes   smallint    not null check (calls_writes between 0 and 7),
  calls_total    smallint    not null check (calls_total between 0 and 8),
  budget_ok      boolean     not null,
  stale          boolean     not null default false,
  current_count  smallint    not null,
  total          smallint    not null,
  devices        jsonb       not null,
  state          jsonb       not null,
  next_check_at  timestamptz not null
);
create index if not exists device_sync_audit_at_idx on public.device_sync_audit (at desc);
alter table public.device_sync_audit enable row level security;
revoke all on public.device_sync_audit from anon, authenticated;
grant select, insert on public.device_sync_audit to anon, authenticated;   -- row policies below decide who, exactly as for devices / controls

drop policy if exists "coco engine reads" on public.device_sync_audit;
create policy "coco engine reads"  on public.device_sync_audit for select to anon, authenticated using (private.engine_ok());
drop policy if exists "coco engine writes" on public.device_sync_audit;
create policy "coco engine writes" on public.device_sync_audit for insert to anon, authenticated with check (private.engine_ok());
drop policy if exists "founders read" on public.device_sync_audit;
create policy "founders read"      on public.device_sync_audit for select to authenticated using (private.is_founder() and private.device_ok());
