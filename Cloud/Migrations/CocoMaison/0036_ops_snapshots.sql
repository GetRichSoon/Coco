-- 0036 ops snapshots (DEVELOPMENT ONLY: NOT applied to Coco Cloud).
-- Internal status snapshots (company structure, security status, workflow health, PC dependencies, device sync) used to be files in
-- the PUBLIC Coco repository. They live here instead: the engine upserts one row per snapshot through Nova (redacted first) and
-- Nova serves it at GET /api/ops/<name> to paired founders only. Additive: one new table; nothing existing is altered.
-- Rollback: 0036_ops_snapshots.down.sql.
create table if not exists public.ops_snapshots (
  name         text primary key check (name in ('company-structure', 'security-status', 'ops-status', 'pc-dependencies', 'device-sync')),
  payload      jsonb not null check (octet_length(payload::text) <= 262144),   -- 256 KiB
  collected_at timestamptz not null default now(),
  updated_by   text
);
-- No role list on these policies: who reaches the table is decided by GRANTs (0043_nova_roles: Nova's coco_member), which rows by the predicate. No Supabase role is needed.
alter table public.ops_snapshots enable row level security;
drop policy if exists "founders read" on public.ops_snapshots;
create policy "founders read" on public.ops_snapshots for select using (private.is_founder() and private.device_ok());
drop policy if exists "coco engine" on public.ops_snapshots;
create policy "coco engine" on public.ops_snapshots for all using (private.engine_ok()) with check (private.engine_ok());
