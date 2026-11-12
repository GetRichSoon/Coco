-- 2026-11-12 (b)  Put the vault name rule back to its two earlier patterns.
--
-- 20261112_revenue_connections.sql let private.publishing_secret_name_ok accept picktheory_api_key_<connection>, expecting PickTheory to be a
-- service with an API key. It is a YouTube channel (connection yt-app-web) that connects with Google sign-in, so that name is never written and the
-- wider rule only adds surface. This restores exactly the rule production had before. Nothing was ever stored under a picktheory_api_key_ name.
-- Rollback of THIS file: re-run the picktheory line of 20261112_revenue_connections.sql (not needed unless a service with an API key is added).
create or replace function private.publishing_secret_name_ok(p_name text)
returns boolean
language sql
immutable
as $$
  select p_name ~ '^gumroad_(access|refresh)_token_[a-z0-9][a-z0-9_]{0,39}$'
      or p_name ~ '^youtube_refresh_token_[a-z0-9][a-z0-9_]{0,39}$';
$$;
