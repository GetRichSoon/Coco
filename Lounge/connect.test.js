// Run: node connect.test.js   (no network; real Postgres in process: PGlite, shaped like the Good Space database)
//
// What the 2026-11-12 backend must hold:
//   * the migrations (api/migrations/20261112*.sql) apply twice, a founder on a paired device is the only writer of the revenue ledger, nobody can
//     write the tables directly, anon sees nothing, a founder can retry a failed job, and the vault name rule ends exactly as production had it
//   * Nova's table door serves revenue_events / revenue_sync for GET only (405 before any SQL), the RPC allow-list has what the clients call
//     and none of the vault functions, and a database refusal is a 4xx while only Nova's own failures are 500
//   * POST /api/connect/key, POST /api/connect/check, POST /api/revenue/sync, GET /api/revenue/summary, against the REAL Gumroad connector
//     (api/_conn_gumroad.js) with Gumroad's answers stood in for: validation, unknown provider, no key / not a founder / a cloud worker, a connector
//     that is not installed, a provider that refuses or fails, a token without view_sales, a verified zero, and a secret that never reaches a
//     response, a log line, an activity row or an error
//   * PickTheory is a YouTube channel (yt-app-web): "Check now" is the real Google check, and a "key" for it is refused with the way to connect
//   * /api/oauth/begin asks Gumroad for view_sales, and a missing OAuth client is a 409, not a crash
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { handle, deps, invalidate, sha256, resetUpstream, buildWrite, buildRpc, pgRefusal, isUpstream, RPCS, TABLES, READ_ONLY } from './api/_nova.js';
import { fold, normalise, PROVIDERS, loadConnector, _resetSync } from './api/_connect.js';
import { PROVIDERS as OAUTH } from './api/_oauth.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { resetUpstream(); invalidate(); try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.stack?.split('\n').slice(0, 12).join(' | ') || e.message}`); } };
// Nova logs one JSON line per request: keep them, so a test can prove no secret ever reached a log
const logs = []; const quiet = console.log;
console.log = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('{"t":')) logs.push(a[0]); else quiet(...a); };

const KEY = 'boss-pc-key-0123456789abcdef', KEY2 = 'boss-phone-key-0123456789abcdef', WORKER = 'worker-key-0123456789abcdef', STRANGER = 'stranger-key-0123456789abcdef';
// Gumroad tokens: the one an earlier leak exposed, a fresh one, one Gumroad refuses, one that works but lacks view_sales; plus the YouTube refresh token of PickTheory
const OLDGUM = 'gum-OLD-LEAKED-token-1111', NEWGUM = 'gum-NEW-ROTATED-token-2222', BADGUM = 'gum-WRONG-not-accepted-99', NOSALES = 'gum-NO-SALES-scope-3333', YTREFRESH = 'yt-refresh-PICKTHEORY-secret-4444';
const SECRETS = [OLDGUM, NEWGUM, BADGUM, NOSALES, YTREFRESH, 'csecret-OAUTH-CLIENT-SECRET', 'ya29.access-token-SECRET-abcdefghijklmnop'];

// ------------------------------------------------------------------------------------------------ the database: production-shaped
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema private; create schema auth; create schema extensions;
grant usage on schema private, auth, public to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table public.founders (email text primary key, name text, call_me text);
create table public.devices (id text primary key, name text, owner_email text, key_hash text, active boolean not null default true, last_seen timestamptz);
create table public.engine_keys (key_hash text primary key, active boolean not null default true);
create function private.is_founder() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.founders f where lower(f.email) = lower(coalesce(auth.jwt() ->> 'email', ''))) $$;
create function private.device_ok() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.devices d where d.active and d.key_hash is not null
  and lower(d.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and d.key_hash = encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::json ->> 'x-device-key', ''), 'UTF8')), 'hex')) $$;
create function private.engine_ok() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.engine_keys k where k.active
  and k.key_hash = encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::json ->> 'x-engine-key', ''), 'UTF8')), 'hex')) $$;
-- the two name rules production had BEFORE this migration
create function private.publishing_secret_name_ok(p_name text) returns boolean language sql immutable as $$
  select p_name ~ '^gumroad_(access|refresh)_token_[a-z0-9][a-z0-9_]{0,39}$' or p_name ~ '^youtube_refresh_token_[a-z0-9][a-z0-9_]{0,39}$' $$;
grant execute on all functions in schema private, auth to anon, authenticated, service_role;

create table public.houses (id text primary key, name text);
create table public.activity (id bigint generated by default as identity primary key, at timestamptz not null default now(), actor text, device_id text, action text, detail text);
create table public.integrations (id text primary key, house_id text references public.houses(id), platform text not null, account text,
  state text not null default 'not_connected' check (state = any (array['connected','partial','not_connected','error','paused'])), auth_method text, capabilities text[],
  last_check_at timestamptz, last_ok_at timestamptz, error text, next_action text, updated_at timestamptz not null default now());
create table public.integration_accounts (connection_id text primary key check (connection_id ~ '^[a-z0-9][a-z0-9._-]{1,60}$'), provider text not null references public.integrations(id) on update cascade,
  external_id text, external_name text not null, external_handle text, avatar_url text, account_label text, secret_ref text,
  state text not null default 'not_connected' check (state = any (array['connected','partial','not_connected','error','paused'])), permissions text[] not null default '{read}',
  connected_at timestamptz, last_verified_at timestamptz, note text, created_at timestamptz not null default now(), created_by text, updated_at timestamptz not null default now(), updated_by text);
create table public.integration_links (id bigint generated by default as identity primary key, integration_id text not null, team_id text not null, subteam_id text, connection_id text, category_id text, channel_id text,
  permissions text[] not null default '{read}', enabled boolean not null default false, note text, created_by text, updated_by text);
create table public.oauth_states (state text primary key, provider text not null, connection_id text not null, team_id text, subteam_id text, requested_by text not null, scope text,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '10 minutes', used_at timestamptz, used_result text);
create table public.jobs (id text primary key default 'JOB-' || substr(md5(random()::text), 1, 8), idempotency_key text not null unique, type text not null, company_id text not null default 'good-space', team_id text not null,
  status text not null default 'queued' check (status = any (array['queued','running','done','failed','cancelled','blocked'])), attempt integer not null default 0, max_attempts integer not null default 3,
  run_after timestamptz not null default now(), lease_owner text, lease_until timestamptz, failed_at timestamptz, error jsonb not null default '{}', errors jsonb not null default '[]',
  updated_at timestamptz not null default now(), check (status <> 'running' or (lease_owner is not null and lease_until is not null)));

-- the vault, stood in for by a table behind the same two functions production has (postgres / service_role only, the same name check, the same activity trail)
create table public.fake_vault (name text primary key, value text not null);
create function public.coco_callback_secret(p_name text) returns text language plpgsql security definer set search_path = '' as $$
declare v text; begin
  if p_name is null or not private.publishing_secret_name_ok(p_name) then raise exception 'not a publishing credential name'; end if;
  select value into v from public.fake_vault where name = p_name;
  insert into public.activity (actor, action, detail) values ('coco-oauth-callback', 'publishing credential read', format('%s (%s)', p_name, case when v is null then 'NOT PRESENT in the vault' else 'present' end));
  return v; end $$;
create function public.coco_store_publish_secret(p_name text, p_value text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e text; begin
  if p_name is null or not private.publishing_secret_name_ok(p_name) then raise exception 'not a publishing credential name'; end if;
  if p_value is null or length(p_value) < 8 then raise exception 'refusing to store an empty or implausibly short credential'; end if;
  select name into e from public.fake_vault where name = p_name;
  insert into public.fake_vault (name, value) values (p_name, p_value) on conflict (name) do update set value = excluded.value;
  insert into public.activity (actor, action, detail) values ('coco-oauth-callback', 'publishing credential stored', format('%s (%s)', p_name, case when e is null then 'new' else 'rotated' end));
  return jsonb_build_object('ok', true, 'name', p_name, 'rotated', e is not null); end $$;
create function public.coco_oauth_client(p_provider text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare i text; s text; begin
  select value into i from public.fake_vault where name = p_provider || '_client_id'; select value into s from public.fake_vault where name = p_provider || '_client_secret';
  if i is null or s is null then raise exception '% client credentials are not both in the vault yet', p_provider; end if;
  return jsonb_build_object('client_id', i, 'client_secret', s); end $$;
revoke all on function public.coco_callback_secret(text), public.coco_store_publish_secret(text, text), public.coco_oauth_client(text) from public, anon, authenticated;
-- production's tables are open to authenticated (RLS decides); the migration below takes the writes back from its own two tables
grant select, insert, update, delete on all tables in schema public to authenticated;
`);
const ok = (sql, params = []) => db.query(sql, params);
const seed = async () => {
  await db.exec(`insert into public.founders values ('boss@example.com', 'Boss', 'Boss');`);
  for (const [id, owner, key] of [['boss-pc', 'boss@example.com', KEY], ['boss-phone', 'boss@example.com', KEY2], ['cloud-worker-1', 'boss@example.com', WORKER], ['stranger-pc', 'stranger@example.com', STRANGER]])
    await ok('insert into public.devices (id, name, owner_email, key_hash) values ($1, $1, $2, $3)', [id, owner, sha256(key)]);
  await db.exec(`insert into public.houses values ('poppy', 'Poppy Ebooks'), ('gigi', 'Gigi Social');
    insert into public.integrations (id, house_id, platform, account, state, auth_method, capabilities) values
      ('gumroad', 'poppy', 'Gumroad', 'owner@example.com', 'connected', 'OAuth 2.0', '{sales}'), ('youtube', 'gigi', 'YouTube', 'brand channels', 'connected', 'OAuth 2.0', '{upload}'),
      ('github', 'gigi', 'GitHub', 'org', 'connected', 'gh CLI login on PC', null),
      ('gumroad-poppy', null, 'Gumroad', 'owner@example.com', 'connected', 'OAuth', null);
    update public.integrations set error = 'The access token was exposed in a log.', next_action = 'FOUNDER ACTION: rotate it.' where id = 'gumroad-poppy';
    insert into public.integration_accounts (connection_id, provider, external_id, external_name, account_label, secret_ref, state, permissions, last_verified_at) values
      ('poppy', 'gumroad', 'g-1', 'The Test Foundry', 'owner@example.com', 'gumroad_access_token_poppy', 'connected', '{edit_products,view_profile}', now() - interval '3 days'),
      ('yt-the-flow', 'youtube', 'UC1', 'The Flow', 'brand', 'youtube_refresh_token_yt_the_flow', 'connected', '{upload}', now() - interval '3 days'),
      ('yt-app-web', 'youtube', 'UC-pt', 'PickTheory', 'brand', 'youtube_refresh_token_yt_app_web', 'connected', '{upload}', now() - interval '3 days');
    insert into public.fake_vault values ('gumroad_access_token_poppy', '${OLDGUM}'), ('youtube_refresh_token_yt_the_flow', 'refresh-token-not-used-abc'), ('youtube_refresh_token_yt_app_web', '${YTREFRESH}'),
      ('gumroad_client_id', 'gum-client-id-123456'), ('gumroad_client_secret', 'csecret-OAUTH-CLIENT-SECRET'), ('youtube_client_id', 'yt-client-id-123456'), ('youtube_client_secret', 'yt-client-secret-OAUTH-9999');
    insert into public.jobs (id, idempotency_key, type, team_id, status, attempt, error, errors) values
      ('JOB-failed', 'k1', 't', 'x', 'failed', 3, '{"kind":"boom"}', '[{"kind":"boom"}]'), ('JOB-cancelled', 'k2', 't', 'x', 'cancelled', 1, '{"kind":"cancelled"}', '[]'),
      ('JOB-done', 'k3', 't', 'x', 'done', 1, '{}', '[]'), ('JOB-queued', 'k4', 't', 'x', 'queued', 0, '{}', '[]'), ('JOB-failed2', 'k6', 't', 'x', 'failed', 2, '{"kind":"boom"}', '[]'), ('JOB-failed3', 'k7', 't', 'x', 'failed', 1, '{"kind":"boom"}', '[]');
    insert into public.jobs (id, idempotency_key, type, team_id, status, attempt, lease_owner, lease_until) values ('JOB-running', 'k5', 't', 'x', 'running', 1, 'w', now() + interval '5 minutes');`);
};
await seed();
// both files in the order they were applied to production: the revenue ledger first, then the vault name rule put back
const file = (n) => readFileSync(new URL(`./api/migrations/${n}`, import.meta.url), 'utf8');
const MIGRATION = file('20261112_revenue_connections.sql') + '\n' + file('20261112b_vault_name_rule_back.sql');
await db.exec(MIGRATION);

// run SQL the way Nova's runAs does: as `authenticated`, with a founder's claims and a device header
const as = async (email, deviceKey, sql, params = [], engineKey = null) => {
  await db.query('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)`, [JSON.stringify({ email, role: 'authenticated', sub: email }), JSON.stringify({ 'x-device-key': deviceKey, ...(engineKey ? { 'x-engine-key': engineKey } : {}) })]);
    await db.query('SET LOCAL ROLE authenticated');
    const r = await db.query(sql, params); await db.query('COMMIT'); return r.rows;
  } catch (e) { try { await db.query('ROLLBACK'); } catch {} throw e; }
};
const asAnon = async (sql) => { await db.query('BEGIN'); try { await db.query('SET LOCAL ROLE anon'); const r = await db.query(sql); await db.query('COMMIT'); return r.rows; } catch (e) { try { await db.query('ROLLBACK'); } catch {} throw e; } };
const refused = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail(`expected a refusal matching ${re}`); };
const row = (n, over = {}) => ({ source: 'gumroad', connection_id: 'poppy', house_id: 'poppy', product_id: 'p1', occurred_at: '2026-11-10T10:00:00Z', amount: 499.5, currency: 'inr', kind: 'sale', external_id: 'sale-' + n, meta: { email_hash: 'abc' }, ...over });

// ------------------------------------------------------------------------------------------------ 1-9: the migration
await t('1 the migration is safe to run twice, and the new things exist with RLS on', async () => {
  await db.exec(MIGRATION);
  const r = await ok(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('revenue_events', 'revenue_sync') order by 1`);
  assert.deepEqual(r.rows.map((x) => [x.relname, x.relrowsecurity]), [['revenue_events', true], ['revenue_sync', true]]);
  const f = await ok(`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('coco_revenue_upsert', 'coco_revenue_sync_set', 'coco_job_retry') order by 1`);
  assert.deepEqual(f.rows.map((x) => x.proname), ['coco_job_retry', 'coco_revenue_sync_set', 'coco_revenue_upsert']);
});

await t('2 a founder on a paired device writes the ledger; the same sale twice is one row, updated; a refund is a positive amount of kind refund', async () => {
  const a = (await as('boss@example.com', KEY, 'select public.coco_revenue_upsert($1::jsonb) as v', [JSON.stringify([row(1), row(2), row(3, { kind: 'refund', external_id: 'refund-3', amount: 100 }), row(1)])]))[0].v;
  assert.deepEqual([a.received, a.inserted, a.updated], [4, 3, 0], 'a repeat inside one call collapses to one row');
  const b = (await as('boss@example.com', KEY, 'select public.coco_revenue_upsert($1::jsonb) as v', [JSON.stringify([row(1, { amount: 600 }), row(4)])]))[0].v;
  assert.deepEqual([b.inserted, b.updated], [1, 1]);
  const rows = (await ok(`select external_id, amount::float8 as amount, currency, kind from public.revenue_events order by external_id`)).rows;
  assert.equal(rows.length, 4); assert.equal(rows.find((r) => r.external_id === 'sale-1').amount, 600); assert.ok(rows.every((r) => r.currency === 'INR'), 'currency is stored upper case');
  assert.deepEqual((await as('boss@example.com', KEY, `select public.coco_revenue_upsert('[]'::jsonb) as v`))[0].v, { ok: true, received: 0, inserted: 0, updated: 0 });
});

await t('3 only a founder on a paired device may write: another email, a founder with the wrong device key, no header and the engine key are all refused', async () => {
  const body = JSON.stringify([row(9)]), sql = 'select public.coco_revenue_upsert($1::jsonb) as v';
  await refused(as('stranger@example.com', STRANGER, sql, [body]), /only a founder on a paired device/);
  await refused(as('boss@example.com', 'some-other-key-0123456789abcdef', sql, [body]), /only a founder on a paired device/);
  await refused(as('boss@example.com', '', sql, [body]), /only a founder on a paired device/);
  await db.exec(`insert into public.engine_keys values ('${sha256('engine-key-0123456789abcdef')}', true)`);
  await refused(as('nobody@example.com', '', sql, [body], 'engine-key-0123456789abcdef'), /only a founder on a paired device/);
  await refused(as('stranger@example.com', STRANGER, 'select public.coco_revenue_sync_set($1, $2, $3, $4, $5)', ['poppy', 'gumroad', 'ok', null, 0]), /only a founder on a paired device/);
  await refused(as('boss@example.com', '', 'select public.coco_job_retry($1)', ['JOB-failed']), /only a founder on a paired device/);
  assert.equal((await ok(`select count(*)::int n from public.revenue_events where external_id = 'sale-9'`)).rows[0].n, 0);
  assert.equal((await ok(`select count(*)::int n from public.revenue_sync`)).rows[0].n, 0);
});

await t('4 nobody writes the tables directly (no insert / update / delete / truncate for authenticated), anon sees and runs nothing', async () => {
  const claims = ['boss@example.com', KEY];
  for (const sql of [`insert into public.revenue_events (source, occurred_at, amount, currency, kind, external_id) values ('x', now(), 1, 'INR', 'sale', 'z')`,
    `update public.revenue_events set amount = 1`, `delete from public.revenue_events`, `truncate public.revenue_events`, `insert into public.revenue_sync (connection_id) values ('zz')`, `update public.revenue_sync set error = 'x'`, `delete from public.revenue_sync`])
    await refused(as(...claims, sql), /permission denied/);
  await refused(asAnon('select * from public.revenue_events'), /permission denied/);
  await refused(asAnon('select * from public.revenue_sync'), /permission denied/);
  await refused(asAnon(`select public.coco_revenue_upsert('[]')`), /permission denied/);
  await refused(asAnon(`select public.coco_job_retry('JOB-failed')`), /permission denied/);
});

await t('5 a founder on a paired device reads the ledger; anyone else reads zero rows (RLS), and so does a founder without the device header', async () => {
  assert.equal((await as('boss@example.com', KEY, 'select count(*)::int n from public.revenue_events'))[0].n, 4);
  assert.equal((await as('stranger@example.com', STRANGER, 'select count(*)::int n from public.revenue_events'))[0].n, 0);
  assert.equal((await as('boss@example.com', 'wrong-device-key-0123456789abcdef', 'select count(*)::int n from public.revenue_events'))[0].n, 0);
  assert.equal((await as('nobody@example.com', '', 'select count(*)::int n from public.revenue_events', [], 'engine-key-0123456789abcdef'))[0].n, 4, 'the engine key may read, as it can for yt_stats');
});

await t('6 incomplete or impossible rows are refused whole: nothing is half written', async () => {
  const before = (await ok('select count(*)::int n from public.revenue_events')).rows[0].n;
  for (const [bad, re] of [[{ external_id: '' }, /incomplete/], [{ kind: 'gift' }, /incomplete/], [{ currency: 'RUPEE' }, /incomplete/], [{ amount: -5 }, /incomplete/], [{ amount: 'abc' }, /incomplete/], [{ source: '' }, /incomplete/], [{ occurred_at: '' }, /incomplete/]])
    await refused(as('boss@example.com', KEY, 'select public.coco_revenue_upsert($1::jsonb)', [JSON.stringify([row(20), row(21, bad)])]), re);
  await refused(as('boss@example.com', KEY, `select public.coco_revenue_upsert('{"a":1}'::jsonb)`), /JSON array/);
  await refused(as('boss@example.com', KEY, 'select public.coco_revenue_upsert($1::jsonb)', [JSON.stringify(Array.from({ length: 5001 }, (_, i) => row(i + 100)))]), /5000/);
  assert.equal((await ok('select count(*)::int n from public.revenue_events')).rows[0].n, before);
});

await t('7 coco_revenue_sync_set: one row per connection; a failed attempt keeps last_ok_at; a bad state or id is refused; the error is capped', async () => {
  const set = (...a) => as('boss@example.com', KEY, 'select public.coco_revenue_sync_set($1, $2, $3, $4, $5) as v', a);
  await set('unit-test-conn', 'gumroad', 'ok', null, 12);
  const first = (await ok(`select * from public.revenue_sync where connection_id = 'unit-test-conn'`)).rows[0];
  assert.deepEqual([first.state, first.error, first.records], ['ok', null, 12]); assert.ok(first.last_ok_at && first.last_synced_at);
  await set('unit-test-conn', 'gumroad', 'error', 'x'.repeat(900), 0);
  const second = (await ok(`select * from public.revenue_sync where connection_id = 'unit-test-conn'`)).rows[0];
  assert.equal(second.state, 'error'); assert.equal(second.error.length, 500); assert.equal(String(second.last_ok_at), String(first.last_ok_at), 'the failure did not erase the last good sync');
  await set('unit-test-conn', 'gumroad', 'ok', 'ignored', 0);
  assert.equal((await ok(`select error from public.revenue_sync where connection_id = 'unit-test-conn'`)).rows[0].error, null, 'a good sync clears the error');
  await refused(set('unit-test-conn', 'gumroad', 'maybe', null, 0), /ends ok or error/); await refused(set('Bad Id', 'gumroad', 'ok', null, 0), /bad connection id/);
  assert.equal((await ok('select count(*)::int n from public.revenue_sync')).rows[0].n, 1);
  await ok(`delete from public.revenue_sync where connection_id = 'unit-test-conn'`);   // the fixture database is ours: leave the routes a clean ledger
});

await t('8 the vault name rule ends exactly as production had it: gumroad and youtube token names only (PickTheory is a YouTube channel, it has no key name)', async () => {
  const okName = async (n) => (await ok('select private.publishing_secret_name_ok($1) as v', [n])).rows[0].v;
  for (const n of ['gumroad_access_token_poppy', 'gumroad_refresh_token_poppy', 'youtube_refresh_token_yt_the_flow', 'youtube_refresh_token_yt_app_web']) assert.equal(await okName(n), true, n);
  for (const n of ['picktheory_api_key_main', 'picktheory_api_key_', 'gumroad_client_secret', 'gumroad_access_token_UPPER', 'gumroad_access_token_' + 'a'.repeat(41), 'other_api_key_x', 'engine_key', '']) assert.equal(await okName(n), false, n);
});

await t('9 coco_job_retry: a founder re-queues a failed or cancelled job with fresh attempts; running, done and queued jobs are untouched; others are refused', async () => {
  const retry = (id, email = 'boss@example.com', key = KEY) => as(email, key, 'select public.coco_job_retry($1) as v', [id]);
  const a = (await retry('JOB-failed'))[0].v; assert.equal(a.ok, true); assert.equal(a.job.status, 'queued'); assert.equal(a.job.attempt, 0); assert.deepEqual(a.job.error, {});
  assert.equal((await ok(`select jsonb_array_length(errors)::int n from public.jobs where id = 'JOB-failed'`)).rows[0].n, 1, 'the history of what went wrong stays');
  assert.equal((await retry('JOB-cancelled'))[0].v.ok, true);
  for (const id of ['JOB-running', 'JOB-done', 'JOB-queued', 'JOB-nope']) assert.equal((await retry(id))[0].v.ok, false, id);
  assert.equal((await ok(`select status from public.jobs where id = 'JOB-running'`)).rows[0].status, 'running');
  await refused(retry('JOB-done', 'stranger@example.com', STRANGER), /only a founder on a paired device/);
  assert.ok((await ok(`select 1 from public.activity where action = 'job retried'`)).rows.length >= 2);
});


// ------------------------------------------------------------------------------------------------ Nova over that database
// a request every simulated second: the per-device rate limit (120 a minute) is about real traffic, not a test run
let clock = Date.now();
const call = async (method, path, { body = null, key = KEY, query = {}, prefer = '' } = {}) => {
  const r = await handle(db, { method, path, query, headers: { 'x-device-key': key, ...(prefer ? { prefer } : {}) }, body }, (clock += 1000));
  return { status: r.status, body: r.body ? JSON.parse(r.body) : null, raw: r.body || '' };
};
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
// Gumroad and Google stood in for by ONE handler; the knobs in G are the scenario. The connector (api/_conn_gumroad.js) is the real file.
const G = {};
const reset = () => Object.assign(G, { calls: [], user: { user_id: 'g-1', name: 'The Test Foundry', email: 'owner@example.com', url: 'https://testfoundry.gumroad.com' }, userStatus: 200, salesStatus: 200, sales: [], down: false, exchange: OLDGUM, ytStatus: 200, ytId: 'UC-pt' });
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
reset();
deps.fetch = async (url, init = {}) => {
  const u = String(url), auth = init.headers?.authorization || ''; G.calls.push({ url: u, auth });
  if (G.down && /gumroad/.test(u)) throw new Error(`socket hang up while sending ${auth}`);
  if (u.includes('/oauth/token')) return res(200, { access_token: G.exchange, token_type: 'bearer' });
  if (u.includes('/v2/user')) return G.userStatus === 200 ? res(200, { success: true, user: G.user }) : res(G.userStatus, '');
  if (u.includes('/v2/sales')) return G.salesStatus !== 200 ? res(G.salesStatus, '') : res(200, { success: true, sales: u.includes('after=' + tomorrow()) ? [] : G.sales });
  if (u.startsWith('https://google.test/token')) return res(200, { access_token: 'ya29.access-token-SECRET-abcdefghijklmnop', scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly' });
  if (u.startsWith('https://yt.test/v3/channels')) return G.ytStatus === 200 ? res(200, { items: [{ id: G.ytId, snippet: { title: 'PickTheory', customUrl: '@picktheory' } }] }) : res(G.ytStatus, '');
  return res(404, 'unscripted ' + u);
};
const sale = (id, cents, at, extra = {}) => ({ id, product_id: 'prod-' + id, product_name: 'Guide ' + id, product_permalink: 'g' + id, order_id: 1, quantity: 1, price: cents, currency: 'inr', formatted_display_price: 'Rs ' + cents, gumroad_fee: 0,
  created_at: at, refunded: false, partially_refunded: false, chargedback: false, recurring_charge: false, email: 'buyer@example.com', ...extra });
const BASE = { cooldownMs: 0, connectorOpts: { sleep: async () => {}, retries: 2 } };
deps.connect = { ...BASE };
deps.oauthUrls = { gumroad: { api: 'https://gumroad.test', token: 'https://gumroad.test/oauth/token' }, youtube: { token: 'https://google.test/token', api: 'https://yt.test/v3' } };
const noSecrets = (...texts) => { for (const s of SECRETS) for (const x of texts) assert.ok(!String(x).includes(s), `a secret leaked: ${s.slice(0, 10)}...`); };
const everything = async () => [logs.join('\n'), JSON.stringify((await ok('select * from public.activity')).rows), JSON.stringify((await ok('select * from public.integrations')).rows), JSON.stringify((await ok('select * from public.integration_accounts')).rows),
  JSON.stringify((await ok('select * from public.revenue_sync')).rows), JSON.stringify((await ok('select * from public.revenue_events')).rows)].join('\n');

await t('10 revenue_events and revenue_sync: GET works for a paired founder; every other verb is 405 before any SQL; no key is 401; an unpaired founder reads nothing', async () => {
  assert.ok(TABLES.has('revenue_events') && TABLES.has('revenue_sync') && READ_ONLY.has('revenue_events') && READ_ONLY.has('revenue_sync'));
  const g = await call('GET', '/rest/v1/revenue_events', { query: { select: 'external_id,amount,currency,kind', order: 'external_id.asc', limit: '50' } });
  assert.equal(g.status, 200); assert.equal(g.body.length, 4); assert.deepEqual(Object.keys(g.body[0]), ['external_id', 'amount', 'currency', 'kind']);
  assert.equal((await call('GET', '/api/rest/revenue_sync', { query: { select: '*' } })).status, 200);
  assert.throws(() => buildWrite('revenue_events', 'POST', {}, {}), /read-only/); assert.throws(() => buildWrite('revenue_sync', 'DELETE', { connection_id: 'eq.x' }, null), /read-only/);
  const seen = []; const spy = { query: (text, params) => { seen.push(text); return db.query(text, params); } };
  for (const [method, query, body, prefer] of [['POST', {}, row(50), 'return=representation'], ['POST', { on_conflict: 'source,external_id' }, [row(51)], 'resolution=merge-duplicates'], ['PATCH', { external_id: 'eq.sale-1' }, { amount: 1 }, ''],
    ['DELETE', { external_id: 'eq.sale-1' }, null, ''], ['PUT', {}, {}, ''], ['get', {}, null, '']]) for (const path of ['/rest/v1/revenue_events', '/api/rest/revenue_sync']) {
    seen.length = 0; const r = await handle(spy, { method, path, query, headers: { 'x-device-key': KEY, prefer }, body }, (clock += 1000));
    assert.equal(r.status, 405, `${method} ${path} -> ${r.status}`); assert.match(JSON.parse(r.body).message, /read-only/);
    assert.deepEqual(seen.filter((s) => !/FROM public\.devices d JOIN/.test(s)), [], 'a refused write issues no statement at all');
  }
  for (const [method, key] of [['GET', ''], ['POST', ''], ['PATCH', 'wrong-key-xxxxxxxxxxxxxxx']]) assert.equal((await call(method, '/rest/v1/revenue_events', { key, query: { id: 'eq.1' }, body: {} })).status, 401);
  assert.equal((await call('GET', '/rest/v1/revenue_events', { key: STRANGER })).status, 401, 'a device whose owner is not a founder is not let in');
  assert.equal((await db.query('select count(*)::int n from public.revenue_events')).rows[0].n, 4);
});

await t('11 the RPC allow-list has what the clients call, and none of the vault functions; a missing function is a clean 404', async () => {
  for (const n of ['coco_job_submit', 'coco_job_cancel', 'coco_job_block', 'coco_job_recover', 'coco_job_status', 'coco_job_retry', 'coco_request_run', 'coco_connection_checked', 'coco_connection', 'coco_integration',
    'coco_structure', 'coco_approval', 'submit_task', 'claim_task', 'coco_task_enqueue', 'coco_run_request_cancel']) assert.ok(RPCS.has(n), `${n} must be callable`);
  for (const n of ['coco_callback_secret', 'coco_store_publish_secret', 'coco_publish_secret', 'coco_oauth_client', 'coco_store_oauth_client', 'coco_secret', 'coco_revenue_upsert', 'coco_revenue_sync_set', 'coco_oauth_begin']) assert.ok(!RPCS.has(n), `${n} must stay off the list`);
  const r = await call('POST', '/rest/v1/rpc/coco_job_retry', { body: { p_id: 'JOB-failed2' } }); assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.job.status, 'queued');
  assert.equal((await call('POST', '/rest/v1/rpc/coco_job_retry', { body: { p_id: 'JOB-nope' } })).body.ok, false);
  // the phone (build 2.11.0) sends p_by with p_id; the database function takes p_id only, so Nova drops the extra argument instead of answering "function does not exist"
  const phone = await call('POST', '/rest/v1/rpc/coco_job_retry', { body: { p_id: 'JOB-failed3', p_by: 'Boss' } }); assert.equal(phone.status, 200, phone.raw); assert.equal(phone.body.ok, true); assert.equal(phone.body.job.status, 'queued');
  assert.deepEqual(buildRpc('coco_job_retry', { p_id: 'x', p_by: 'y', p_reason: 'z' }).params, ['x'], 'only p_id reaches the database'); assert.deepEqual(buildRpc('coco_job_cancel', { p_id: 'x', p_by: 'y' }).params, ['x', 'y'], 'other functions keep every argument');
  assert.equal((await call('POST', '/rest/v1/rpc/coco_revenue_upsert', { body: { p_rows: [] } })).status, 404, 'the ledger writer is not a client door');
  assert.equal((await call('POST', '/rest/v1/rpc/coco_callback_secret', { body: { p_name: 'gumroad_access_token_poppy' } })).status, 404);
  // the raw coco_oauth_begin would let a cloud worker's device open a connection that POST /api/oauth/begin refuses it: Nova does not carry it any more
  const raw = await call('POST', '/rest/v1/rpc/coco_oauth_begin', { key: WORKER, body: { p_provider: 'youtube', p_connection_id: 'yt-x' } }); assert.equal(raw.status, 404); assert.match(raw.body.message, /no such function/);
  // the two names prepared for the proposed task-start migration answer "not installed" until it is applied, never a 500
  for (const [fn, body] of [['coco_task_enqueue', { p_task: '00000000-0000-0000-0000-000000000000', p_job_type: 'filter-rank' }], ['coco_run_request_cancel', { p_id: 1 }]]) { const r = await call('POST', `/rest/v1/rpc/${fn}`, { body }); assert.equal(r.status, 404, fn); assert.equal(r.body.state, 'NOT_INSTALLED', fn); }
});

await t('12 a database refusal is a 4xx the app can show; only Nova\'s own failure is a 500; a RAISE EXCEPTION never trips the outage breaker', async () => {
  assert.deepEqual(pgRefusal({ code: '42P01', message: 'x' }), { status: 404, state: 'NOT_INSTALLED' }); assert.deepEqual(pgRefusal({ code: '42883', message: 'x' }), { status: 404, state: 'NOT_INSTALLED' });
  assert.equal(pgRefusal({ code: '23505', message: 'x' }).status, 409); assert.equal(pgRefusal({ code: '23503', message: 'x' }).status, 409); assert.equal(pgRefusal({ code: '22P02', message: 'x' }).status, 400); assert.equal(pgRefusal({ code: '42703', message: 'x' }).status, 400);
  assert.equal(pgRefusal({ code: 'P0001', message: 'only a founder on a paired device may answer A-1' }).status, 403); assert.equal(pgRefusal({ code: 'P0001', message: 'only the cloud runtime may submit a job' }).status, 403);
  assert.equal(pgRefusal({ code: 'P0001', message: 'unknown operation zzz' }).status, 400); assert.equal(pgRefusal({ code: 'XX000', message: 'boom' }), null);
  assert.equal(isUpstream({ code: 'P0001', message: 'the daily quota is used up' }), false, 'a company rule that mentions a quota is not an outage');
  assert.equal(isUpstream({ code: '53300', message: 'too many connections' }), true);
  // through the real route on the real database
  const eng = await call('POST', '/rest/v1/rpc/coco_job_status', { body: {} }); assert.equal(eng.status, 404, 'coco_job_status is not in this fixture database: a missing function is a clean 404, not a 500'); assert.equal(eng.body.state, 'NOT_INSTALLED');
  const tbl = await call('GET', '/rest/v1/org_units', { query: { select: '*' } }); assert.equal(tbl.status, 404); assert.equal(tbl.body.state, 'NOT_INSTALLED');
  assert.equal((await call('GET', '/rest/v1/jobs', { query: { select: 'no_such_column' } })).status, 400);
  const dup = await call('POST', '/rest/v1/jobs', { body: { idempotency_key: 'k1', type: 't', team_id: 'x' } }); assert.equal(dup.status, 409, `duplicate key -> ${dup.status}`);
  const h = await call('GET', '/api/health', { key: '' }); assert.equal(h.status, 200); assert.equal(h.body.db, 'ok'); assert.ok('commit' in h.body);
});

// ---- /api/connect/key  (Gumroad: a token pasted instead of the consent screen)
const keyBody = (over = {}) => ({ provider: 'gumroad', connection_id: 'poppy-two', label: 'Second shop', secret: NEWGUM, ...over });
const count = async (sql) => (await ok(sql)).rows[0].n;
await t('13 connect/key refuses what it should: no key 401, a non-founder device 401, a cloud worker 403, GET 405, unknown or missing provider, bad id, bad secret, bad label, bad house', async () => {
  assert.equal((await call('POST', '/api/connect/key', { key: '', body: keyBody() })).status, 401);
  assert.equal((await call('POST', '/api/connect/key', { key: STRANGER, body: keyBody() })).status, 401);
  const w = await call('POST', '/api/connect/key', { key: WORKER, body: keyBody() }); assert.equal(w.status, 403); assert.equal(w.body.state, 'FORBIDDEN');
  assert.equal((await call('GET', '/api/connect/key')).status, 405); assert.equal((await call('POST', '/api/connect/nope', { body: {} })).status, 404);
  const u = await call('POST', '/api/connect/key', { body: keyBody({ provider: 'etsy' }) }); assert.equal(u.status, 400); assert.equal(u.body.state, 'UNKNOWN_PROVIDER'); assert.match(u.body.reason, /gumroad/);
  assert.equal((await call('POST', '/api/connect/key', { body: keyBody({ provider: undefined }) })).status, 400);
  for (const bad of [{ connection_id: 'Bad Id' }, { connection_id: 'x' }, { connection_id: 'a'.repeat(41) }, { secret: '' }, { secret: 'short' }, { secret: 'has a space inside it' }, { secret: 'x'.repeat(513) }, { secret: 12345678 },
    { label: 'x'.repeat(81) }, { label: 'bad\nlabel' }, { label: NEWGUM }, { house_id: 'nohouse' }, { house_id: 'Bad House' }]) {
    const r = await call('POST', '/api/connect/key', { body: keyBody(bad) }); assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(r.body.ok, false); assert.ok(r.body.reason);
    noSecrets(r.raw);
  }
  assert.equal(await count(`select count(*)::int n from public.integration_accounts where connection_id = 'poppy-two'`), 0, 'nothing was stored by any of those');
  assert.equal(G.calls.length, 0, 'and Gumroad was never asked');
});

await t('14 a "key" for PickTheory or YouTube is refused with the way to connect it: PickTheory is a YouTube channel (yt-app-web), Google sign-in is the connection', async () => {
  const pt = await call('POST', '/api/connect/key', { body: { provider: 'picktheory', connection_id: 'picktheory', secret: 'some-secret-value-1234' } });
  assert.equal(pt.status, 400); assert.equal(pt.body.state, 'USE_GOOGLE_SIGN_IN'); assert.match(pt.body.reason, /YouTube channel/);
  assert.deepEqual(pt.body.connect, { route: '/api/oauth/begin', body: { provider: 'youtube', connection_id: 'yt-app-web' } }); assert.deepEqual(pt.body.check, { route: '/api/connect/check', body: { connection_id: 'yt-app-web' } });
  assert.ok(!pt.raw.includes('some-secret-value-1234'));
  const yt = await call('POST', '/api/connect/key', { body: { provider: 'youtube', connection_id: 'yt-new', secret: 'some-secret-value-1234' } }); assert.equal(yt.status, 400); assert.equal(yt.body.state, 'USE_GOOGLE_SIGN_IN');
  assert.equal(await count(`select count(*)::int n from public.fake_vault where name like 'picktheory%'`), 0);
});

await t('15 a connector that is not installed is 501 {error: "connector not installed"} on key and check, "connector not installed" on a sync source, and stores nothing', async () => {
  deps.connect = { ...BASE, load: async () => null };
  const k = await call('POST', '/api/connect/key', { body: keyBody() }); assert.equal(k.status, 501); assert.equal(k.body.error, 'connector not installed'); assert.equal(k.body.ok, false); assert.equal(k.body.provider, 'gumroad');
  assert.equal((await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } })).status, 501);
  const s = await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } }); assert.equal(s.status, 200); assert.deepEqual([s.body.ok, s.body.sources[0].state, s.body.sources[0].error], [false, 'error', 'connector not installed']);
  assert.equal(await count(`select count(*)::int n from public.integration_accounts where connection_id = 'poppy-two'`), 0);
  deps.connect = { ...BASE };
  const real = await loadConnector('gumroad'); assert.equal(typeof real.fetchGumroadSales, 'function'); assert.equal(typeof real.verifyGumroad, 'function'); assert.equal(typeof real.toRevenueRows, 'function');
});

await t('16 connect/key: a token Gumroad refuses stores nothing; an unreachable Gumroad stores nothing and the token is redacted from the reason; a token without view_sales is stored as partial and says so', async () => {
  reset(); G.userStatus = 401;
  const bad = await call('POST', '/api/connect/key', { body: keyBody({ secret: BADGUM }) }); assert.equal(bad.status, 200);
  assert.deepEqual([bad.body.ok, bad.body.stored, bad.body.state], [false, false, 'CONNECTED_EXPIRED']); assert.match(bad.body.reason, /refused the token/); noSecrets(bad.raw);
  reset(); G.down = true;
  const down = await call('POST', '/api/connect/key', { body: keyBody({ secret: BADGUM }) }); assert.deepEqual([down.body.ok, down.body.stored, down.body.state], [false, false, 'ERROR']); noSecrets(down.raw); assert.match(down.body.reason, /could not be reached/);
  assert.equal(await count(`select count(*)::int n from public.fake_vault where name = 'gumroad_access_token_poppy_two'`), 0);
  reset(); G.user = { ...G.user, user_id: 'g-2' }; G.salesStatus = 403;
  const part = await call('POST', '/api/connect/key', { body: keyBody({ secret: NOSALES }) }); assert.equal(part.status, 200, part.raw);
  assert.deepEqual([part.body.ok, part.body.stored, part.body.state, part.body.can_read_sales, part.body.missing_scopes], [false, true, 'CONNECTED_MISSING_PERMISSION', false, ['view_sales']]); assert.match(part.body.detail, /view sales/);
  const acc = (await ok(`select state, permissions from public.integration_accounts where connection_id = 'poppy-two'`)).rows[0]; assert.equal(acc.state, 'partial'); assert.ok(!acc.permissions.includes('view_sales'));
  assert.equal((await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy_two'`)).rows[0].value, NOSALES);
  noSecrets(part.raw, await everything());
});

await t('17 connect/key with a good token: verified first (profile AND sales), sealed in the vault under gumroad_access_token_<connection>, recorded as connected; the token appears nowhere; one Gumroad account is one connection', async () => {
  reset(); G.user = { ...G.user, user_id: 'g-2' }; logs.length = 0;
  const r = await call('POST', '/api/connect/key', { body: keyBody({ house_id: 'poppy' }) }); assert.equal(r.status, 200, r.raw);
  assert.deepEqual([r.body.ok, r.body.state, r.body.stored, r.body.connection_id, r.body.provider, r.body.account, r.body.can_read_sales], [true, 'CONNECTED_VERIFIED', true, 'poppy-two', 'gumroad', 'Second shop', true]); assert.ok(r.body.verified_at);
  assert.equal((await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy_two'`)).rows[0].value, NEWGUM, 'the vault holds it');
  const acc = (await ok(`select * from public.integration_accounts where connection_id = 'poppy-two'`)).rows[0];
  assert.deepEqual([acc.provider, acc.state, acc.secret_ref, acc.external_id, acc.external_name, acc.account_label], ['gumroad', 'connected', 'gumroad_access_token_poppy_two', 'g-2', 'Second shop', 'owner@example.com']); assert.ok(acc.last_verified_at);
  assert.equal((await ok(`select state from public.integrations where id = 'gumroad'`)).rows[0].state, 'connected');
  const act = (await ok(`select device_id from public.activity where action = 'platform connected' order by id desc limit 1`)).rows[0]; assert.equal(act.device_id, 'boss-pc');
  assert.deepEqual(G.calls.filter((c) => c.url.includes('api.gumroad.com')).map((c) => c.url.replace(/after=.*/, 'after=…')), ['https://api.gumroad.com/v2/user', 'https://api.gumroad.com/v2/sales?after=…']);
  noSecrets(r.raw, await everything());
  // the same Gumroad account under a third connection id is refused: its sales would be claimed twice
  reset(); G.user = { ...G.user, user_id: 'g-2' };
  const clash = await call('POST', '/api/connect/key', { body: keyBody({ connection_id: 'poppy-three', secret: NEWGUM }) }); assert.deepEqual([clash.body.ok, clash.body.state, clash.body.stored], [false, 'ALREADY_CONNECTED', false]); assert.match(clash.body.reason, /poppy-two/);
  // the same provider id under another provider is refused
  assert.equal((await call('POST', '/api/connect/key', { body: keyBody({ connection_id: 'yt-the-flow' }) })).status, 409);
});

await t('18 connect/key again for the same connection re-keys it in place; a token that belongs to a different account is refused and the old one stays', async () => {
  reset(); G.user = { ...G.user, user_id: 'g-2' };
  const again = await call('POST', '/api/connect/key', { body: keyBody({ label: undefined }) }); assert.equal(again.body.ok, true); assert.equal(await count(`select count(*)::int n from public.integration_accounts where connection_id = 'poppy-two'`), 1);
  assert.equal((await ok(`select external_name from public.integration_accounts where connection_id = 'poppy-two'`)).rows[0].external_name, 'Second shop', 'a re-key keeps the name the founder gave');
  reset(); G.user = { ...G.user, user_id: 'g-OTHER' };
  const wrong = await call('POST', '/api/connect/key', { body: keyBody({ secret: OLDGUM }) }); assert.deepEqual([wrong.body.ok, wrong.body.state, wrong.body.stored], [false, 'CONNECTED_WRONG_CHANNEL', false]);
  assert.equal((await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy_two'`)).rows[0].value, NEWGUM); assert.equal((await ok(`select external_id from public.integration_accounts where connection_id = 'poppy-two'`)).rows[0].external_id, 'g-2');
});

await t('19 connect/key on the exposed connection: the SAME token keeps the "exposed token" alert; a NEW token settles it', async () => {
  reset();
  const same = await call('POST', '/api/connect/key', { body: { provider: 'gumroad', connection_id: 'poppy', secret: OLDGUM } }); assert.equal(same.body.ok, true, same.raw);
  assert.match((await ok(`select error from public.integrations where id = 'gumroad-poppy'`)).rows[0].error, /exposed/, 'the alert stays while the exposed token is still the one in use');
  const fresh = await call('POST', '/api/connect/key', { body: { provider: 'gumroad', connection_id: 'poppy', secret: NEWGUM } }); assert.equal(fresh.body.ok, true);
  assert.equal((await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy'`)).rows[0].value, NEWGUM);
  const legacy = (await ok(`select state, error, next_action from public.integrations where id = 'gumroad-poppy'`)).rows[0]; assert.deepEqual([legacy.state, legacy.error, legacy.next_action], ['connected', null, null]);
  assert.equal((await ok(`select external_name from public.integration_accounts where connection_id = 'poppy'`)).rows[0].external_name, 'The Test Foundry', 'the shop name is not replaced by the email');
  noSecrets(same.raw, fresh.raw, await everything());
});

// ---- /api/connect/check
await t('20 connect/check on Gumroad: verified (and can read sales), missing view_sales is partial, a revoked token is error, another account is refused; the stamp is honest each time', async () => {
  const state = async () => (await ok(`select a.state, a.last_verified_at, i.state as istate, i.error from public.integration_accounts a join public.integrations i on i.id = a.provider where a.connection_id = 'poppy'`)).rows[0];
  await ok(`update public.integration_accounts set last_verified_at = now() - interval '5 days' where connection_id = 'poppy'`);
  reset(); const good = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } }); assert.equal(good.status, 200, good.raw);
  assert.deepEqual([good.body.ok, good.body.state, good.body.provider, good.body.can_read_sales, good.body.missing_scopes], [true, 'CONNECTED_VERIFIED', 'gumroad', true, []]); assert.ok(good.body.checked_at);
  let s = await state(); assert.equal(s.state, 'connected'); assert.ok(Date.now() - new Date(s.last_verified_at).getTime() < 60000, 'a real check dates last_verified_at');
  reset(); G.salesStatus = 403; const part = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } });
  assert.deepEqual([part.body.ok, part.body.state, part.body.can_read_sales, part.body.missing_scopes], [false, 'CONNECTED_MISSING_PERMISSION', false, ['view_sales']]); s = await state(); assert.deepEqual([s.state, s.istate], ['partial', 'partial']); assert.match(s.error, /view sales/);
  reset(); G.userStatus = 401; const dead = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } });
  assert.deepEqual([dead.body.ok, dead.body.state], [false, 'CONNECTED_EXPIRED']); s = await state(); assert.deepEqual([s.state, s.istate], ['error', 'error']);
  reset(); G.user = { ...G.user, user_id: 'g-WRONG' }; const other = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } }); assert.deepEqual([other.body.ok, other.body.state], [false, 'CONNECTED_WRONG_CHANNEL']);
  reset(); const heal = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } }); assert.equal(heal.body.ok, true); s = await state(); assert.deepEqual([s.state, s.istate, s.error], ['connected', 'connected', null]);
  noSecrets(good.raw, part.raw, dead.raw, other.raw, await everything());
});

await t('21 connect/check edge cases: unknown id 404, bad id 400, no key 401, a platform with no cloud credential says CANNOT_CHECK and changes nothing, an empty vault entry is NOT_CONNECTED and heals when the token is back', async () => {
  reset();
  assert.equal((await call('POST', '/api/connect/check', { body: { connection_id: 'nope-nothing' } })).status, 404); assert.equal((await call('POST', '/api/connect/check', { body: { connection_id: 'BAD ID' } })).status, 400);
  assert.equal((await call('POST', '/api/connect/check', { key: '', body: { connection_id: 'poppy' } })).status, 401); assert.equal((await call('GET', '/api/connect/check')).status, 405);
  // a channel whose authorization is a file on a PC was never connected: checking it says so and does not turn "not connected" into "error"
  await ok(`insert into public.integration_accounts (connection_id, provider, external_name, secret_ref, state) values ('yt-food', 'youtube', 'TasteOdessey', '~/.nova-secrets/youtube-food.env', 'not_connected')`);
  for (const route of ['/api/connect/check', '/api/oauth/verify']) {
    const nc = await call('POST', route, { body: { connection_id: 'yt-food' } }); assert.equal(nc.status, 200, route); assert.match(nc.body.status || nc.body.state, /NOT_CONNECTED/); assert.equal(nc.body.ok === true, false);
    assert.equal((await ok(`select state from public.integration_accounts where connection_id = 'yt-food'`)).rows[0].state, 'not_connected', route);
  }
  const before = JSON.stringify((await ok('select * from public.integrations order by id')).rows);
  const gh = await call('POST', '/api/connect/check', { body: { connection_id: 'github' } }); assert.deepEqual([gh.status, gh.body.ok, gh.body.state], [200, false, 'CANNOT_CHECK']); assert.match(gh.body.detail, /PC|cloud/);
  assert.equal(JSON.stringify((await ok('select * from public.integrations order by id')).rows), before, 'nothing changed');
  const saved = (await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy'`)).rows[0].value; await ok(`delete from public.fake_vault where name = 'gumroad_access_token_poppy'`);
  const gone = await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } }); assert.deepEqual([gone.body.ok, gone.body.state], [false, 'NOT_CONNECTED']);
  assert.equal((await ok(`select state from public.integration_accounts where connection_id = 'poppy'`)).rows[0].state, 'error', 'a check that found no credential says so on the connection');
  await ok(`insert into public.fake_vault values ('gumroad_access_token_poppy', $1)`, [saved]);
  assert.equal((await call('POST', '/api/connect/check', { body: { connection_id: 'poppy' } })).body.ok, true, 'put the token back and Check now heals it');
});

await t('22 PickTheory is the YouTube channel yt-app-web: "Check now" is the real Google check (refresh token -> access token -> the channel), not-assigned until a team has it, expired when Google refuses', async () => {
  reset();
  const a = await call('POST', '/api/connect/check', { body: { connection_id: 'yt-app-web' } }); assert.equal(a.status, 200, a.raw);
  assert.deepEqual([a.body.ok, a.body.state, a.body.provider, a.body.channel], [true, 'NOT_ASSIGNED', 'youtube', 'PickTheory']);
  await ok(`insert into public.integration_links (integration_id, connection_id, team_id, channel_id, enabled) values ('youtube', 'yt-app-web', 'youtube', 'app-web', true)`);
  const b = await call('POST', '/api/connect/check', { body: { connection_id: 'yt-app-web' } }); assert.deepEqual([b.body.ok, b.body.state], [true, 'CONNECTED_VERIFIED']);
  G.ytId = 'UC-someone-else'; const c = await call('POST', '/api/connect/check', { body: { connection_id: 'yt-app-web' } }); assert.deepEqual([c.body.ok, c.body.state], [false, 'CONNECTED_WRONG_CHANNEL']);
  reset(); G.ytStatus = 401; const d = await call('POST', '/api/connect/check', { body: { connection_id: 'yt-app-web' } }); assert.deepEqual([d.body.ok, d.body.state], [false, 'CONNECTED_EXPIRED']);
  reset(); assert.equal((await call('POST', '/api/connect/check', { body: { connection_id: 'yt-app-web' } })).body.ok, true);
  // Connect for it is the consent screen
  const begin = await call('POST', '/api/oauth/begin', { body: { provider: 'youtube', connection_id: 'yt-app-web' } }); assert.equal(begin.status, 200, begin.raw);
  const u = new URL(begin.body.authorize_url); assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth'); assert.equal(u.searchParams.get('client_id'), 'yt-client-id-123456'); assert.equal(u.searchParams.get('redirect_uri'), 'https://cocolounge.vercel.app/api/oauth/youtube/callback');
  assert.equal(u.searchParams.get('access_type'), 'offline'); assert.equal(u.searchParams.get('prompt'), 'consent');
  noSecrets(a.raw, b.raw, c.raw, d.raw, begin.raw, await everything());
});

// ---- revenue
await t('23 revenue/sync, first sync of Gumroad with ZERO sales: a successful sync, a verified 0 (in the currency Gumroad reports), last_ok_at set; the summary then shows 0, not "unknown"', async () => {
  reset(); await ok('delete from public.revenue_events');   // the rows the migration tests wrote: this source starts with nothing sold
  const pre = await call('GET', '/api/revenue/summary'); const g0 = pre.body.sources.find((s) => s.connection_id === 'poppy');
  assert.equal(g0.revenue, null, 'never synced: no number at all'); assert.equal(g0.sync.state, 'never'); assert.equal(g0.state, 'connected');
  const r = await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } }); assert.equal(r.status, 200, r.raw);
  assert.equal(r.body.ok, true); assert.ok(r.body.synced_at); assert.equal(r.body.sources.length, 1);
  const s = r.body.sources[0]; assert.deepEqual([s.provider, s.connection_id, s.state, s.revenue, s.orders, s.error, s.fetched], ['gumroad', 'poppy', 'ok', { USD: 0 }, 0, null, 0]);
  const reads = G.calls.filter((c) => c.url.includes('/v2/sales')); assert.equal(reads.length, 1); assert.ok(!reads[0].url.includes('after='), 'the first sync reads everything');
  assert.equal(reads[0].auth, `Bearer ${NEWGUM}`, 'with the stored token');
  const rs = (await ok(`select state, error, records, last_ok_at is not null as ok from public.revenue_sync where connection_id = 'poppy'`)).rows[0]; assert.deepEqual([rs.state, rs.error, rs.records, rs.ok], ['ok', null, 0, true]);
  const post = await call('GET', '/api/revenue/summary'); const g1 = post.body.sources.find((x) => x.connection_id === 'poppy'); assert.deepEqual(g1.revenue, { USD: 0 }); assert.equal(g1.sync.state, 'ok'); assert.ok(g1.sync.last_ok_at);
  noSecrets(r.raw, post.raw, await everything());
});

await t('24 revenue/sync with sales and a refund: rows land once, a refund is a positive amount of kind refund, totals are sales minus refunds, a repeat adds nothing and looks back 35 days from last_ok_at; no buyer data reaches the ledger', async () => {
  await ok(`delete from public.revenue_events where source = 'gumroad'`);
  reset(); G.sales = [sale('s1', 4900, '2026-11-09T09:00:00Z'), sale('s2', 2900, '2026-11-10T09:00:00Z'), sale('s3', 1900, '2026-11-11T09:00:00Z'), sale('r1', 9900, '2026-11-11T10:00:00Z', { refunded: true })];
  const r = await call('POST', '/api/revenue/sync', { body: {} }); const g = r.body.sources.find((s) => s.connection_id === 'poppy');
  assert.deepEqual([g.state, g.fetched, g.inserted, g.updated, g.orders], ['ok', 5, 5, 0, 4]);
  assert.deepEqual(g.revenue, { USD: 97 }, 'USD 49 + 29 + 19 + 99 sold, 99 given back');
  assert.deepEqual((await ok(`select amount::float8 as amount, kind, currency from public.revenue_events where external_id = 'r1:refund'`)).rows, [{ amount: 99, kind: 'refund', currency: 'USD' }]);
  assert.ok(!(await ok(`select meta::text as m from public.revenue_events`)).rows.some((x) => /buyer@example\.com/.test(x.m)), 'no buyer email in the ledger');
  assert.deepEqual(r.body.sources.map((s) => s.connection_id).sort(), ['poppy', 'poppy-two'], 'with no id every Gumroad connection is synced');
  const again = await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } }); const g2 = again.body.sources[0];
  assert.deepEqual([g2.inserted, g2.updated, g2.revenue], [0, 5, { USD: 97 }]); assert.equal(await count(`select count(*)::int n from public.revenue_events where source = 'gumroad'`), 5);
  const after = G.calls.filter((c) => c.url.includes('/v2/sales')).at(-1).url.match(/after=(\d{4}-\d{2}-\d{2})/)?.[1]; const days = (Date.now() - new Date(after).getTime()) / 86400000;
  assert.ok(after && days > 34 && days < 37, `the repeat looks back about 35 days from the last good sync, so a refund of an older sale is seen (${after}, ${days.toFixed(1)} days ago)`);
  const sum = await call('GET', '/api/revenue/summary'); const gs = sum.body.sources.find((x) => x.connection_id === 'poppy');
  assert.deepEqual([gs.revenue, gs.sales, gs.refunds, gs.orders, gs.refund_count], [{ USD: 97 }, { USD: 196 }, { USD: 99 }, 4, 1]); assert.equal(gs.last_sale_at, '2026-11-11T10:00:00.000Z'); assert.equal(gs.house_id, 'poppy'); assert.equal(gs.connect, 'oauth');
  assert.equal(sum.body.totals.USD, 97); assert.ok(sum.body.sources.find((x) => x.connection_id === 'poppy-two'), 'every connected source is listed');
  noSecrets(r.raw, sum.raw, await everything());
});

await t('25 revenue/sync when Gumroad fails: the source says error in the connector\'s own words (missing view_sales, revoked, unreachable), the earlier ledger and last good sync time stay, the token is redacted, and the next good sync clears it', async () => {
  const okAt = (await ok(`select last_ok_at from public.revenue_sync where connection_id = 'poppy'`)).rows[0].last_ok_at;
  const sync = async () => (await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } })).body;
  reset(); G.salesStatus = 403; let b = await sync(); let s = b.sources[0];
  assert.deepEqual([b.ok, s.state, s.revenue], [false, 'error', { USD: 97 }]); assert.match(s.error, /view_sales/); assert.match(s.error, /Reconnect/);
  const rs = (await ok(`select state, error, last_ok_at from public.revenue_sync where connection_id = 'poppy'`)).rows[0]; assert.equal(rs.state, 'error'); assert.match(rs.error, /view_sales/); assert.equal(String(rs.last_ok_at), String(okAt), 'the failure did not erase the last good sync');
  reset(); G.salesStatus = 401; s = (await sync()).sources[0]; assert.equal(s.state, 'error'); assert.match(s.error, /revoked|expired/);
  reset(); G.down = true; b = await sync(); s = b.sources[0]; assert.equal(s.state, 'error'); assert.match(s.error, /could not be reached/); noSecrets(JSON.stringify(b));
  reset(); G.sales = [sale('s1', 4900, '2026-11-09T09:00:00Z')]; G.sales[0].price = 'not a number';
  s = (await sync()).sources[0]; assert.equal(s.state, 'error'); assert.match(s.error, /cannot read/, 'a sale the connector cannot read fails the sync instead of being skipped or counted as zero');
  assert.equal(await count(`select count(*)::int n from public.revenue_events where source = 'gumroad'`), 5, 'and the ledger was not touched');
  const sum = await call('GET', '/api/revenue/summary'); assert.equal(sum.body.sources.find((x) => x.connection_id === 'poppy').sync.state, 'error');
  noSecrets(sum.raw, await everything());
  reset(); G.sales = [sale('s1', 4900, '2026-11-09T09:00:00Z'), sale('s2', 2900, '2026-11-10T09:00:00Z'), sale('s3', 1900, '2026-11-11T09:00:00Z'), sale('r1', 9900, '2026-11-11T10:00:00Z', { refunded: true })];
  assert.equal((await sync()).sources[0].state, 'ok'); assert.equal((await ok(`select error from public.revenue_sync where connection_id = 'poppy'`)).rows[0].error, null, 'the next good sync clears it');
});

await t('26 revenue/sync edge cases: a not-connected source says so (no number), YouTube and unknown ids are 404, bad id 400, no key 401, GET and POST on the wrong route 405, the paired cloud worker may sync', async () => {
  reset();
  await ok(`insert into public.integration_accounts (connection_id, provider, external_name, secret_ref, state) values ('poppy-empty', 'gumroad', 'Empty shop', null, 'not_connected')`);
  const nc = (await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy-empty' } })).body.sources[0]; assert.deepEqual([nc.state, nc.revenue, nc.orders], ['not_connected', null, 0]);
  assert.equal((await call('POST', '/api/revenue/sync', { body: { connection_id: 'yt-the-flow' } })).status, 404, 'YouTube is not a revenue source');
  assert.equal((await call('POST', '/api/revenue/sync', { body: { connection_id: 'nope-nothing' } })).status, 404); assert.equal((await call('POST', '/api/revenue/sync', { body: { connection_id: 'BAD ID' } })).status, 400);
  assert.equal((await call('POST', '/api/revenue/sync', { key: '', body: {} })).status, 401); assert.equal((await call('GET', '/api/revenue/sync')).status, 405); assert.equal((await call('POST', '/api/revenue/summary', { body: {} })).status, 405); assert.equal((await call('GET', '/api/revenue/nope')).status, 404);
  assert.equal((await call('POST', '/api/revenue/sync', { key: WORKER, body: { connection_id: 'poppy' } })).status, 200, 'the paired cloud worker (a founder-owned, paired device) may run the sync');
  const sum = await call('GET', '/api/revenue/summary'); assert.equal(sum.body.sources.find((x) => x.connection_id === 'poppy-empty').revenue, null);
});

await t('27 revenue/sync cooldown: a second press inside the window answers from the last sync without calling Gumroad again', async () => {
  _resetSync(); deps.connect = { ...BASE, cooldownMs: 60000 };
  reset(); G.sales = [sale('s1', 4900, '2026-11-09T09:00:00Z')]; await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } });
  const n = G.calls.filter((c) => c.url.includes('/v2/sales')).length; assert.equal(n, 1, 'the first press read Gumroad');
  const r = (await call('POST', '/api/revenue/sync', { body: { connection_id: 'poppy' } })).body.sources[0];
  assert.equal(G.calls.filter((c) => c.url.includes('/v2/sales')).length, n, 'no second call to Gumroad'); assert.equal(r.cooldown, true); assert.equal(r.state, 'ok');
  deps.connect = { ...BASE };
});

await t('28 revenue tables missing (migration not applied): sync and summary answer 501 NOT_INSTALLED, not a crash', async () => {
  const gone = { query: async (text, params) => { if (/revenue_sync|revenue_events/.test(text)) throw Object.assign(new Error('relation "public.revenue_sync" does not exist'), { code: '42P01' }); return db.query(text, params); } };
  const r1 = await handle(gone, { method: 'POST', path: '/api/revenue/sync', query: {}, headers: { 'x-device-key': KEY }, body: { connection_id: 'poppy' } }, (clock += 1000));
  const r2 = await handle(gone, { method: 'GET', path: '/api/revenue/summary', query: {}, headers: { 'x-device-key': KEY }, body: null }, (clock += 1000));
  for (const r of [r1, r2]) { assert.equal(r.status, 501); assert.equal(JSON.parse(r.body).state, 'NOT_INSTALLED'); }
});

// ---- oauth
await t('29 /api/oauth/begin asks Gumroad for view_sales (stored on the state too); a missing OAuth client is a 409; a worker cannot begin; an unknown provider is 400', async () => {
  assert.match(OAUTH.gumroad.scope, /\bview_sales\b/); assert.match(OAUTH.gumroad.scope, /\bedit_products\b/); assert.match(OAUTH.gumroad.scope, /\bview_profile\b/);
  const b = await call('POST', '/api/oauth/begin', { body: { provider: 'gumroad', connection_id: 'poppy', team: 'ebooks', subteam: 'ebooks/practical-skills' } });
  assert.equal(b.status, 200, b.raw); const u = new URL(b.body.authorize_url);
  assert.equal(u.origin + u.pathname, 'https://gumroad.com/oauth/authorize'); assert.match(u.searchParams.get('scope'), /view_sales/); assert.equal(u.searchParams.get('redirect_uri'), 'https://cocolounge.vercel.app/api/oauth/gumroad/callback');
  assert.equal(b.body.redirect_uri, 'https://cocolounge.vercel.app/api/oauth/gumroad/callback');
  assert.match((await ok('select scope from public.oauth_states where state = $1', [b.body.state])).rows[0].scope, /view_sales/);
  noSecrets(b.raw);
  await ok(`delete from public.fake_vault where name = 'youtube_client_id'`);
  const y = await call('POST', '/api/oauth/begin', { body: { provider: 'youtube', connection_id: 'yt-new-channel' } }); assert.equal(y.status, 409); assert.match(y.body.reason, /client credentials are not in the vault/);
  await ok(`insert into public.fake_vault values ('youtube_client_id', 'yt-client-id-123456')`);
  assert.equal((await call('POST', '/api/oauth/begin', { key: WORKER, body: { provider: 'gumroad', connection_id: 'poppy' } })).status, 403);
  assert.equal((await call('POST', '/api/oauth/begin', { body: { provider: 'etsy', connection_id: 'poppy' } })).status, 400);
});

await t('30 the Gumroad OAuth callback: a rotated token is sealed and settles the alert; the SAME token is flagged and does not; the state works once; the account is stored with view_sales', async () => {
  await ok(`update public.integrations set state = 'connected', error = 'The access token was exposed in a log.', next_action = 'rotate it' where id = 'gumroad-poppy'`);
  await ok(`update public.fake_vault set value = $1 where name = 'gumroad_access_token_poppy'`, [OLDGUM]);
  const begin = async () => (await call('POST', '/api/oauth/begin', { body: { provider: 'gumroad', connection_id: 'poppy' } })).body.state;
  const cb = (state) => handle(db, { method: 'GET', path: '/api/oauth/gumroad/callback', query: { code: 'auth-code-123', state }, headers: {}, body: null }, (clock += 1000));
  reset(); G.exchange = OLDGUM; const s1 = await begin(); const same = await cb(s1);
  assert.equal(same.status, 200); assert.match(same.body, /same access token/); assert.match((await ok(`select error from public.integrations where id = 'gumroad-poppy'`)).rows[0].error, /exposed/);
  reset(); G.exchange = NEWGUM; const s2 = await begin(); const fresh = await cb(s2);
  assert.equal(fresh.status, 200); assert.ok(!/same access token/.test(fresh.body)); assert.equal((await ok(`select error from public.integrations where id = 'gumroad-poppy'`)).rows[0].error, null);
  assert.equal((await ok(`select value from public.fake_vault where name = 'gumroad_access_token_poppy'`)).rows[0].value, NEWGUM);
  assert.match((await ok(`select permissions from public.integration_accounts where connection_id = 'poppy'`)).rows[0].permissions.join(' '), /view_sales/);
  assert.equal((await cb(s2)).status, 400, 'a state is used once');
  // a second connection id for the account poppy already holds is refused
  reset(); G.exchange = NEWGUM; const s3 = (await call('POST', '/api/oauth/begin', { body: { provider: 'gumroad', connection_id: 'poppy-dup' } })).body.state; const dup = await cb(s3);
  assert.equal(dup.status, 400); assert.match(dup.body, /already connected in Coco/); assert.equal(await count(`select count(*)::int n from public.integration_accounts where connection_id = 'poppy-dup'`), 0);
  noSecrets(same.body, fresh.body, dup.body, await everything());
});

await t('31 /api/automation/* before its tables exist is 501 NOT_INSTALLED, not a crash; /api/ops/* before ops_snapshots exists is a clean 404 NOT_COLLECTED', async () => {
  const a = await call('GET', '/api/automation/templates'); assert.equal(a.status, 501, a.raw); assert.equal(a.body.state, 'NOT_INSTALLED');
  const o = await call('GET', '/api/ops/company-structure'); assert.equal(o.status, 404); assert.equal(o.body.state, 'NOT_COLLECTED');
});

await t('32 the pure helpers: fold() nets refunds per currency and shows a verified zero in the provider\'s currency; normalise() makes connector rows the shape the database function takes (a signed refund becomes a positive amount)', async () => {
  assert.deepEqual(fold([], 'x').revenue, { USD: 0 }); assert.deepEqual(fold([], 'x', 'INR').revenue, { INR: 0 });
  const f = fold([{ connection_id: 'a', currency: 'INR', sales: '100.5', refunds: '20.25', orders: '2', refund_count: '1', last_sale_at: '2026-11-01T00:00:00Z', sales_30d: '100', refunds_30d: '0' }, { connection_id: 'b', currency: 'USD', sales: '5', refunds: '0', orders: '1', refund_count: '0', last_sale_at: null, sales_30d: '5', refunds_30d: '0' }], 'a');
  assert.deepEqual([f.revenue, f.orders, f.refund_count], [{ INR: 80.25 }, 2, 1]);
  const n = normalise([{ occurred_at: '2026-11-01T00:00:00Z', amount: -12.5, currency: 'usd', kind: 'refund', external_id: 77 }], { provider: 'gumroad', connection_id: 'poppy', house_id: 'poppy' })[0];
  assert.deepEqual([n.source, n.connection_id, n.house_id, n.amount, n.currency, n.external_id, n.kind], ['gumroad', 'poppy', 'poppy', 12.5, 'USD', '77', 'refund']);
  assert.deepEqual(Object.keys(PROVIDERS), ['gumroad']);
});

await t('33 the rollback file removes what the migration created and restores the vault name rule; running the migration again brings it all back', async () => {
  const accountsBefore = await count(`select count(*)::int n from public.integration_accounts`);
  await db.exec(file('20261112_revenue_connections.rollback.sql'));
  assert.equal(await count(`select count(*)::int n from pg_class where relname in ('revenue_events', 'revenue_sync')`), 0);
  assert.equal(await count(`select count(*)::int n from pg_proc where proname in ('coco_revenue_upsert', 'coco_revenue_sync_set', 'coco_job_retry')`), 0);
  assert.equal((await ok(`select private.publishing_secret_name_ok('gumroad_access_token_poppy') as v`)).rows[0].v, true);
  assert.equal(await count(`select count(*)::int n from public.integration_accounts`), accountsBefore, 'nothing that existed before was touched');
  await db.exec(MIGRATION);
  assert.equal(await count(`select count(*)::int n from pg_class where relname in ('revenue_events', 'revenue_sync')`), 2);
});

console.log = quiet;
console.log(`\nconnect.test: ${pass} passed, ${fail} failed`);
await db.close();
process.exit(fail ? 1 : 0);
