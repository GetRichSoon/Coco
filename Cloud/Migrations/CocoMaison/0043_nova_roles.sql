-- 0043 Nova's own roles: COCO's schema on plain Postgres (Neon) with no Supabase role, schema or function.
-- docs/SUPABASE_REMOVAL_PLAN.md section 2 (role model), section 3 item 2, section 4 step 2. NOT applied anywhere. It runs on Neon
-- only, after the verified legacy load (and after 0034-0037, which carry no role list), in ONE transaction (psql -1), as the
-- database owner (neondb_owner), with a founder YES (docs/NEON_CUTOVER.md). Never on Supabase. Proof: nova_roles.test.sh in
-- .github/workflows/neon-migration-proof.yml (a throwaway postgres:16 with no Supabase role).
--
-- Roles. No password here: the owner sets the two login passwords in the Neon console or with ALTER ROLE, outside git.
--   nova_app        LOGIN, Nova's DATABASE_URL. Member of coco_member and coco_vault (runAs() does SET LOCAL ROLE). SELECT/INSERT/
--                   UPDATE/DELETE on every public/private table, sequences, no DDL, no TRUNCATE. BYPASSRLS for stage 1 (Nova's raw
--                   queries outside runAs()); stage 2 moves them into runAs() and removes it.
--   coco_member     NOLOGIN. Replaces authenticated (and the anon half of 'to anon, authenticated'): what Nova's requests run as.
--   coco_vault      NOLOGIN. Replaces service_role for the vault only (EXECUTE on private.vault_* once 0041 lands; nothing yet).
--   coco_backup_ro  LOGIN, the backup's NEON_BACKUP_URL. Read only: default_transaction_read_only, BYPASSRLS (pg_dump must see every
--                   row), USAGE + SELECT on public/private/archive tables and sequences, nothing else. SECURITY DEFINER functions
--                   lose their PUBLIC EXECUTE (coco_member keeps it), so no definer function can write on its behalf.
-- Also:
--   private.claims() replaces auth.jwt(): the JSON Nova's runAs() puts in request.jwt.claims (set_config(..., true)). Every function
--   body that calls auth.jwt() is rewritten to private.claims() (18 live today). request.headers stays a plain Postgres setting.
--   Policies naming anon/authenticated move to coco_member. authenticated's privileges are copied to coco_member (tables: SELECT,
--   INSERT, UPDATE, DELETE incl. column grants; sequences: USAGE, SELECT, UPDATE; functions: EXECUTE; schemas: USAGE), never
--   TRUNCATE/REFERENCES/TRIGGER/CREATE; service_role's are not copied (the vault doors it served are not on Neon).
--   Explicit GRANTs for main's 0034-0037 objects (Neon has no default privileges). Later migrations grant for themselves.
--   PUBLIC loses USAGE/CREATE on schema public (every role that needs it gets an explicit grant).
--   The legacy role names are NOT dropped and NOT needed: after this file no policy, membership or function uses them. Dropping
--   them is the cleanup step, after the cutover.
-- Refuses (raises, nothing changes) when Supabase-only objects are still present: extensions pg_net / pg_cron / supabase_vault, a
--   function calling net.*, vault.* or cron.*, or a policy for anon/service_role without authenticated (decide those by hand).
--   They are excluded from the Neon baseline and are never recreated on Neon, in particular: the pg_net trigger wake_coco_chat on
--   public.chat (Nova /api/chat answers synchronously) and the pg_cron job coco-reap-stale (coco_reap_stale() is called from the
--   queue reads instead, plan step 4/5), the 7 Supabase Vault door functions (replaced by 0041's portable vault).
-- Re-runnable: every step is idempotent; originals are saved once in private.nova_roles_undo.
-- ROLLBACK: 0043_nova_roles.down.sql restores policies, function bodies and PUBLIC privileges from private.nova_roles_undo, drops
--   private.claims() and the roles 0043 created. Neither file touches a table, column or row.

create schema if not exists private;
create table if not exists private.nova_roles_undo (
  kind     text not null check (kind in ('role', 'claims', 'policy', 'function', 'public_execute', 'schema_public')),
  ident    text not null,
  payload  jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  primary key (kind, ident)
);
revoke all on private.nova_roles_undo from public;

-- 0. refuse Supabase-only leftovers
do $$ declare bad text; begin
  select string_agg(x, '; ') into bad from (
    select 'extension ' || extname as x from pg_extension where extname in ('pg_net', 'pg_cron', 'supabase_vault')
    union all
    select 'function ' || p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and p.prosrc ~ '\m(net|vault|cron)\.'
    union all
    select format('policy %I on %I.%I (for %s only)', policyname, schemaname, tablename, array_to_string(roles, ', ')) from pg_policies
     where roles && array['anon', 'service_role']::name[] and not 'authenticated' = any (roles)
  ) s;
  if bad is not null then raise exception '0043 refuses: Supabase-only objects must not exist on Neon (excluded from the baseline): %', bad; end if;
end $$;

-- 1. roles (NOLOGIN groups, two LOGIN roles without a password) and membership
do $$ declare r text; begin
  foreach r in array array['coco_member', 'coco_vault', 'nova_app', 'coco_backup_ro'] loop
    begin
      execute format('create role %I nologin', r);
      insert into private.nova_roles_undo (kind, ident) values ('role', r) on conflict do nothing;
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
alter role coco_member nologin;
alter role coco_vault nologin;
alter role nova_app login;
alter role coco_backup_ro login;
alter role coco_backup_ro set default_transaction_read_only = on;
grant coco_member to nova_app;
grant coco_vault to nova_app;
do $$ begin
  alter role nova_app bypassrls;
  alter role coco_backup_ro bypassrls;
exception when insufficient_privilege then
  raise warning '0043: this owner cannot grant BYPASSRLS: nova_app raw queries and coco_backup_ro pg_dump will see only rows the policies allow. Ask the account owner (plan section 8).';
end $$;
do $$ begin execute format('grant connect on database %I to nova_app, coco_backup_ro', current_database()); end $$;

-- 2. private.claims(): what Nova's runAs() sets, read the way auth.jwt() read it (null when no claims were set)
do $$ begin
  if to_regprocedure('private.claims()') is null then insert into private.nova_roles_undo (kind, ident) values ('claims', 'private.claims()') on conflict do nothing; end if;
end $$;
create or replace function private.claims() returns jsonb language sql stable set search_path = '' as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

-- 3. function bodies: auth.jwt() -> private.claims() (originals saved), then nothing may still call into a Supabase auth schema
do $$ declare f record; bad text; begin
  for f in
    select p.oid, format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as ident, pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prokind in ('f', 'p') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and p.prosrc like '%auth.jwt()%'
  loop
    insert into private.nova_roles_undo (kind, ident, payload) values ('function', f.ident, jsonb_build_object('def', f.def)) on conflict do nothing;
    execute replace(f.def, 'auth.jwt()', 'private.claims()');
  end loop;
  select string_agg(p.oid::regprocedure::text, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
     and p.prosrc ~ '\mauth\.';
  if bad is not null then raise exception '0043 refuses: functions still use the Supabase auth schema (rewrite them by hand): %', bad; end if;
end $$;

-- 4. policies: anon/authenticated/service_role -> coco_member (other roles in the list are kept)
do $$ declare p record; keep text; begin
  for p in select schemaname, tablename, policyname, roles from pg_policies where roles && array['anon', 'authenticated', 'service_role']::name[] loop
    insert into private.nova_roles_undo (kind, ident, payload)
      values ('policy', format('%I.%I.%I', p.schemaname, p.tablename, p.policyname),
              jsonb_build_object('schema', p.schemaname, 'table', p.tablename, 'policy', p.policyname, 'roles', to_jsonb(p.roles::text[])))
      on conflict do nothing;
    select string_agg(quote_ident(r), ', ') into keep from unnest(p.roles::text[]) r where r not in ('anon', 'authenticated', 'service_role', 'coco_member');
    execute format('alter policy %I on %I.%I to %s', p.policyname, p.schemaname, p.tablename, concat_ws(', ', keep, 'coco_member'));
  end loop;
end $$;

-- 5. coco_member gets exactly what authenticated had (no-op where that role never existed)
do $$ declare g record; begin
  for g in
    select n.nspname, c.relname, c.relkind, a.privilege_type from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) a
     where a.grantee = to_regrole('authenticated') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
       and ((c.relkind in ('r', 'p', 'v', 'm', 'f') and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
         or (c.relkind = 'S' and a.privilege_type in ('USAGE', 'SELECT', 'UPDATE')))
  loop
    execute format('grant %s on %s %I.%I to coco_member', g.privilege_type, case when g.relkind = 'S' then 'sequence' else 'table' end, g.nspname, g.relname);
  end loop;
  for g in
    select n.nspname, c.relname, t.attname, a.privilege_type from pg_attribute t join pg_class c on c.oid = t.attrelid join pg_namespace n on n.oid = c.relnamespace, aclexplode(t.attacl) a
     where a.grantee = to_regrole('authenticated') and not t.attisdropped and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE')
       and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
  loop
    execute format('grant %s (%I) on table %I.%I to coco_member', g.privilege_type, g.attname, g.nspname, g.relname);
  end loop;
  for g in
    select p.oid::regprocedure::text as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(p.proacl) a
     where a.grantee = to_regrole('authenticated') and a.privilege_type = 'EXECUTE' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
  loop
    execute format('grant execute on routine %s to coco_member', g.fn);
  end loop;
  for g in
    select n.nspname from pg_namespace n, aclexplode(n.nspacl) a
     where a.grantee = to_regrole('authenticated') and a.privilege_type = 'USAGE' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname !~ '^pg_'
  loop
    execute format('grant usage on schema %I to coco_member', g.nspname);
  end loop;
end $$;

-- 6. explicit grants for what main's migrations define (0034-0037 and the access helpers they call)
grant usage on schema public, private to coco_member, nova_app;
do $$ declare t text; f text; begin
  foreach t in array array['org_units', 'org_products', 'org_agents', 'org_repos', 'org_workflows', 'org_access', 'org_metrics', 'org_refs', 'ops_snapshots', 'worker_registry'] loop
    if to_regclass('public.' || t) is not null then execute format('grant select, insert, update, delete on public.%I to coco_member', t); end if;
  end loop;
  if to_regclass('public.org_unit_tree') is not null then execute 'grant select on public.org_unit_tree to coco_member'; end if;
  if to_regclass('public.integration_health') is not null then execute 'grant select, insert on public.integration_health to coco_member'; end if;
  foreach f in array array['private.claims()', 'private.is_founder()', 'private.device_ok()', 'private.engine_ok()', 'private.device_id()', 'public.org_has_access(text,text,text,text)'] loop
    if to_regprocedure(f) is not null then execute format('grant execute on function %s to coco_member', f); end if;
  end loop;
  -- the 90 day prune: not for requests (engine or founder), only for Nova's own ops call as nova_app
  if to_regprocedure('public.integration_health_prune(int)') is not null then execute 'grant execute on function public.integration_health_prune(int) to nova_app'; end if;
end $$;

-- 7. nova_app: DML on every public/private table and the sequences (no TRUNCATE, no DDL), not on this file's bookkeeping
grant select, insert, update, delete on all tables in schema public, private to nova_app;
grant usage, select, update on all sequences in schema public, private to nova_app;
revoke all on private.nova_roles_undo from nova_app;

-- 8. coco_backup_ro: SELECT on every table and sequence of public, private and archive (when it exists), nothing else
do $$ declare s text; begin
  foreach s in array array['public', 'private', 'archive'] loop
    if exists (select 1 from pg_namespace where nspname = s) then
      execute format('grant usage on schema %I to coco_backup_ro', s);
      execute format('grant select on all tables in schema %I to coco_backup_ro', s);
      execute format('grant select on all sequences in schema %I to coco_backup_ro', s);
    end if;
  end loop;
end $$;

-- 9. no SECURITY DEFINER function stays callable by PUBLIC (coco_member keeps what PUBLIC gave it), PUBLIC off schema public
do $$ declare f record; privs text[]; begin
  for f in
    select format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as ident from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef and n.nspname in ('public', 'private')
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  loop
    insert into private.nova_roles_undo (kind, ident) values ('public_execute', f.ident) on conflict do nothing;
    execute format('grant execute on routine %s to coco_member', f.ident);
    execute format('revoke execute on routine %s from public', f.ident);
  end loop;
  select array_agg(a.privilege_type) into privs from pg_namespace n, aclexplode(n.nspacl) a where n.nspname = 'public' and a.grantee = 0;
  if privs is not null then
    insert into private.nova_roles_undo (kind, ident, payload) values ('schema_public', 'public', jsonb_build_object('privileges', to_jsonb(privs))) on conflict do nothing;
    revoke all on schema public from public;
  end if;
end $$;

-- 10. the result: Nova needs no Supabase name anywhere
do $$ declare bad text; begin
  select string_agg(format('%I.%I.%I', schemaname, tablename, policyname), ', ') into bad from pg_policies where roles && array['anon', 'authenticated', 'service_role']::name[];
  if bad is not null then raise exception '0043: policies still name Supabase roles: %', bad; end if;
  select string_agg(r.rolname, ', ') into bad from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
   where r.rolname in ('anon', 'authenticated', 'service_role') and u.rolname in ('nova_app', 'coco_member', 'coco_vault', 'coco_backup_ro');
  if bad is not null then raise exception '0043: Nova roles are members of Supabase roles: %', bad; end if;
end $$;
