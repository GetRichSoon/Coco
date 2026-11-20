-- 0037 worker registry (DEVELOPMENT ONLY: NOT applied to Coco Cloud). One row per worker the Global Brain may give jobs to (AI worker, animation worker,
-- rendering worker, storage service). Workers report facts and execute; COCO decides. Additive: one new table. Rollback: 0037_worker_registry.down.sql.
-- Written by the engine key only (through Nova); a free host never touches this table: it reports through the job door with a short-lived token.
create table if not exists public.worker_registry (
  worker_id    text primary key check (worker_id ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  kind         text not null check (kind in ('ai', 'animation', 'render', 'storage')),
  provider     text not null,                                  -- the host: oracle-always-free, cloud-worker-1 ... never gemini or claude for kind ai when MODEL_BACKEND=ollama
  status       text not null default 'active' check (status in ('active', 'paused', 'revoked')),   -- revoked: the door refuses this worker's token at once
  capabilities text[] not null default '{}',                   -- job types it can run, e.g. {ai.generate}
  facts        jsonb not null default '{}' check (jsonb_typeof(facts) = 'object' and octet_length(facts::text) <= 16384),
                                                               -- arch, cpus, ram_total_mb, ram_free_mb, gpu, storage_free_gb, utilisation (0..1), network, models [{name,digest}]
  terms        jsonb not null default '{}'                     -- provider terms: commercial_ok (boolean), source (text), checked_on (text); no other key
               check (jsonb_typeof(terms) = 'object' and (terms - array['commercial_ok', 'source', 'checked_on']) = '{}'::jsonb
                      and (not terms ? 'commercial_ok' or jsonb_typeof(terms -> 'commercial_ok') = 'boolean')),
  quota        jsonb not null default '{}'                     -- free quota: unit (text), limit and used (numbers), resets_at (text); no other key. The door adds real lease minutes to used.
               check (jsonb_typeof(quota) = 'object' and (quota - array['unit', 'limit', 'used', 'resets_at']) = '{}'::jsonb
                      and (not quota ? 'limit' or jsonb_typeof(quota -> 'limit') = 'number') and (not quota ? 'used' or jsonb_typeof(quota -> 'used') = 'number')),
  revoked_before bigint not null default 0,                    -- epoch seconds: the door refuses every token whose chain began at or before this (set it to revoke a stolen chain at once)
  last_seen    timestamptz,                                    -- last heartbeat; a worker silent for 30 minutes is stale and its leases are reclaimed
  updated_at   timestamptz not null default now()
);
create or replace function public.worker_registry_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists worker_registry_touch on public.worker_registry;
create trigger worker_registry_touch before update on public.worker_registry for each row execute function public.worker_registry_touch();
-- No role list on these policies: who reaches the table is decided by GRANTs (0043_nova_roles: Nova's coco_member), which rows by the predicate. No Supabase role is needed.
alter table public.worker_registry enable row level security;
drop policy if exists "coco engine" on public.worker_registry;
create policy "coco engine" on public.worker_registry for all using (private.engine_ok()) with check (private.engine_ok());
