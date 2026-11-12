-- Rollback for 20261112_revenue_connections.sql. Run in this order. Everything the migration created is removed and the vault name rule is restored to its two earlier patterns.
-- Revenue rows hold only what a sync fetched; a sync can fetch them again. Nothing that existed before the migration is touched.
drop function if exists public.coco_job_retry(text);
drop function if exists public.coco_revenue_sync_set(text, text, text, text, integer);
drop function if exists public.coco_revenue_upsert(jsonb);
drop table if exists public.revenue_sync;
drop table if exists public.revenue_events;
create or replace function private.publishing_secret_name_ok(p_name text)
returns boolean
language sql
immutable
as $$
  select p_name ~ '^gumroad_(access|refresh)_token_[a-z0-9][a-z0-9_]{0,39}$'
      or p_name ~ '^youtube_refresh_token_[a-z0-9][a-z0-9_]{0,39}$';
$$;
