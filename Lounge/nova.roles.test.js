// Run: node nova.roles.test.js   (no network: real Postgres in process, PGlite)
//
// Supabase removal plan step 4: Nova on plain Postgres with its own roles. A database with NO Supabase role or schema
// (no anon / authenticated / service_role, no auth / storage / extensions schema) gets CocoMaison's real migrations
// 0034-0037 and 0043_nova_roles (Cloud/Migrations/CocoMaison/ at the repo root, outside the deployed tree; byte-identical copies of CocoMaison main @ 38019ff), then the
// real Nova handler runs on it logged in as nova_app. What must hold:
//   * runAs() runs as coco_member, and private.claims() reads the founder's claims Nova set
//   * coco_member reads and writes the allowlisted tables 0043 grants (org_*, integration_health, worker_registry), RLS decides rows
//   * coco_member cannot touch anything else (engine_keys, a private table), and Nova refuses tables off its allowlist
//   * the vault fails closed ('vault not configured') without the portable vault, and never calls a Supabase function
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { handle, runAs, sha256, invalidate, resetUpstream, MEMBER_ROLE } from './api/_nova.js';
import { createVault, VaultNotConfigured } from './api/_vault.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { resetUpstream(); invalidate(); try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.stack?.split('\n').slice(0, 6).join(' | ') || e.message}`); } };
console.log = ((orig) => (...a) => { if (!(typeof a[0] === 'string' && a[0].startsWith('{"t":'))) orig(...a); })(console.log);   // Nova's request log lines

const KEY = 'boss-pc-key-0123456789abcdef', STRANGER = 'stranger-key-0123456789abcdef', ENGINE = 'engine-key-0123456789abcdef';
const mig = (n) => readFileSync(new URL(`../Cloud/Migrations/CocoMaison/${n}.sql`, import.meta.url), 'utf8');
const pg = new PGlite();
// The Neon baseline Nova needs, in plain Postgres: the access helpers read private.claims() (0043 defines the same function).
await pg.exec(`
create schema private;
create function private.claims() returns jsonb language sql stable set search_path = '' as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create table public.founders (email text primary key, name text);
create table public.devices (id text primary key, name text, owner_email text, key_hash text, active boolean not null default true);
create table public.engine_keys (key_hash text primary key, active boolean not null default true);
create table public.houses (id text primary key, name text);
create table public.platforms (id text primary key, name text);
create table public.offerings (id uuid primary key default gen_random_uuid(), name text);
create table private.secret_stuff (v text);
insert into private.secret_stuff values ('nobody but Nova');
create function private.is_founder() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.founders f where lower(f.email) = lower(coalesce(private.claims() ->> 'email', ''))) $$;
create function private.device_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.active and lower(d.owner_email) = lower(coalesce(private.claims() ->> 'email', ''))
    and d.key_hash = encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::json ->> 'x-device-key', ''), 'UTF8')), 'hex')) $$;
create function private.engine_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.engine_keys k where k.active
    and k.key_hash = encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::json ->> 'x-engine-key', ''), 'UTF8')), 'hex')) $$;
alter table public.houses enable row level security;
create policy "founders only" on public.houses for all using (private.is_founder() and private.device_ok()) with check (private.is_founder() and private.device_ok());
insert into public.houses (id, name) select h, initcap(h) from unnest(array['fifi', 'gigi', 'lulu', 'mochi', 'poppy', 'tilly', 'zaza']) h;
insert into public.platforms (id, name) select p, initcap(p) from unnest(array['youtube', 'gumroad', 'chrome_web_store', 'play_store', 'website', 'kdp', 'instagram', 'tiktok', 'x', 'pinterest']) p;
insert into public.founders values ('boss@example.com', 'Boss');
`);
for (const [id, owner, key] of [['boss-pc', 'boss@example.com', KEY], ['stranger-pc', 'stranger@example.com', STRANGER]])
  await pg.query('insert into public.devices (id, name, owner_email, key_hash) values ($1, $1, $2, $3)', [id, owner, sha256(key)]);
await pg.query('insert into public.engine_keys values ($1, true)', [sha256(ENGINE)]);
for (const n of ['0034_company_structure', '0035_integration_health', '0036_ops_snapshots', '0037_worker_registry', '0043_nova_roles']) await pg.exec(mig(n));
// houses: a later Neon-native migration grants for itself (0043 copies only what a legacy role had, and there is none here)
await pg.exec('grant select on public.houses to coco_member');
// Nova logs in as nova_app (its DATABASE_URL role), never as the owner
await pg.exec('set role nova_app');
const db = { query: (sql, params) => pg.query(sql, params) };
const founder = { email: 'boss@example.com', device_id: 'boss-pc' };
const req = (method, path, { key = KEY, body = null, query = {}, headers = {} } = {}) => ({ method, path, query, headers: { 'x-device-key': key, ...headers }, body });
const call = async (...a) => { const r = await handle(db, req(...a)); return { status: r.status, body: r.body ? JSON.parse(r.body) : null }; };

await t('1 the database has no Supabase role or schema, and 0043 left Nova its own roles', async () => {
  const roles = (await db.query(`select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'coco_member', 'coco_vault', 'nova_app', 'coco_backup_ro') order by 1`)).rows.map((r) => r.rolname);
  assert.deepEqual(roles, ['coco_backup_ro', 'coco_member', 'coco_vault', 'nova_app']);
  assert.deepEqual((await db.query(`select nspname from pg_namespace where nspname in ('auth', 'storage', 'extensions', 'vault', 'net', 'cron')`)).rows, []);
  assert.equal((await db.query('select current_user as u')).rows[0].u, 'nova_app');
  assert.equal(MEMBER_ROLE, 'coco_member');
});

await t('2 runAs runs as coco_member and private.claims() reads the claims Nova set', async () => {
  const [r] = await runAs(db, founder, KEY, { sql: `select current_user as u, private.claims() ->> 'email' as email, private.is_founder() as f, private.device_ok() as d`, params: [] });
  assert.deepEqual(r, { u: 'coco_member', email: 'boss@example.com', f: true, d: true });
  assert.equal((await db.query('select current_user as u')).rows[0].u, 'nova_app', 'the role switch ends with the transaction');
});

await t('3 a founder reads and writes the 0034 org tables through Nova; a stranger sees nothing', async () => {
  const units = await call('GET', '/rest/v1/org_units', { query: { select: 'id', id: 'eq.coco' } });
  assert.equal(units.status, 200); assert.deepEqual(units.body, [{ id: 'coco' }]);
  for (const name of ['org_products', 'org_agents', 'org_repos', 'org_workflows', 'org_access', 'org_metrics', 'org_refs']) assert.equal((await call('GET', `/rest/v1/${name}`, { query: { select: '*', limit: '1' } })).status, 200, name);
  const w = await call('POST', '/rest/v1/org_repos', { body: { repo: 'GetRichSoon/RcProbe', unit_id: 'coco', kind: 'app', state: 'active' }, headers: { prefer: 'return=representation' } });
  assert.equal(w.status, 200, JSON.stringify(w.body)); assert.equal(w.body[0].repo, 'GetRichSoon/RcProbe');
  assert.equal((await call('DELETE', '/rest/v1/org_repos', { query: { repo: 'eq.GetRichSoon/RcProbe' } })).status, 201);
  const s = await call('GET', '/rest/v1/org_units', { key: STRANGER, query: { select: 'id' } });
  assert.equal(s.status, 401, 'a device whose owner is no founder is not let in');
  assert.deepEqual(await runAs(db, { email: 'stranger@example.com' }, STRANGER, { sql: 'select id from public.org_units', params: [] }), [], 'and RLS hides every row from a non-founder');
});

await t('4 integration_health: founders read, insert; no update or delete (0043 grants select, insert only)', async () => {
  const row = { id: 'rc:gumroad/poppy', integration_id: 'gumroad', account_id: 'poppy', status: 'CONNECTED_AND_VERIFIED' };
  assert.equal((await call('POST', '/rest/v1/integration_health', { body: row })).status, 201);
  const r = await call('GET', '/rest/v1/integration_health', { query: { select: 'id,status' } });
  assert.deepEqual(r.body, [{ id: 'rc:gumroad/poppy', status: 'CONNECTED_AND_VERIFIED' }]);
  assert.equal((await call('PATCH', '/rest/v1/integration_health', { query: { id: 'eq.rc:gumroad/poppy' }, body: { status: 'EXPIRED' } })).status, 403);
  assert.equal((await call('DELETE', '/rest/v1/integration_health', { query: { id: 'eq.rc:gumroad/poppy' } })).status, 403);
});

await t('5 worker_registry: the engine key reads and writes it through Nova; a founder without it sees no row', async () => {
  const eng = { 'x-engine-key': ENGINE };
  const w = await call('POST', '/rest/v1/worker_registry', { body: { worker_id: 'ai-worker-1', kind: 'ai', provider: 'oracle-always-free' }, headers: eng });
  assert.equal(w.status, 201, JSON.stringify(w.body));
  assert.deepEqual((await call('GET', '/rest/v1/worker_registry', { query: { select: 'worker_id,status' }, headers: eng })).body, [{ worker_id: 'ai-worker-1', status: 'active' }]);
  invalidate();
  assert.deepEqual((await call('GET', '/rest/v1/worker_registry', { query: { select: 'worker_id' } })).body, [], 'RLS: engine only');
  assert.equal((await call('PATCH', '/rest/v1/worker_registry', { query: { worker_id: 'eq.ai-worker-1' }, body: { status: 'paused' }, headers: eng })).status, 201);
});

await t('6 coco_member cannot touch what 0043 did not grant: engine_keys, a private table, the owner-only prune; Nova refuses tables off its allowlist', async () => {
  for (const sql of ['select * from public.engine_keys', 'select * from private.secret_stuff', 'insert into public.engine_keys values ($$x$$, true)', 'select public.integration_health_prune(90)', 'update public.houses set name = $$x$$'])
    await assert.rejects(runAs(db, founder, KEY, { sql, params: [] }), /permission denied/, sql);
  assert.equal((await call('GET', '/rest/v1/engine_keys', { query: { select: '*' } })).status, 404);
  assert.equal((await call('GET', '/rest/v1/oauth_states', { query: { select: '*' } })).status, 404);
  assert.equal((await db.query('select count(*)::int as n from private.secret_stuff')).rows[0].n, 1, 'Nova itself (nova_app) still can, for its own raw reads');
});

await t('7 the vault fails closed: no backend, no key, or no 0041 functions is "vault not configured"; never a Supabase function', async () => {
  const seen = []; const spy = { query: async (sql, p) => { seen.push(sql); return db.query(sql, p); } };
  const keys = JSON.stringify({ k1: Buffer.alloc(32, 7).toString('base64') });
  for (const env of [{}, { COCO_VAULT_BACKEND: 'supabase' }, { COCO_VAULT_BACKEND: 'coco' }, { COCO_VAULT_BACKEND: 'coco', COCO_VAULT_KEYS: keys, COCO_VAULT_KEY_ID: 'k1' }]) {
    await assert.rejects(createVault(spy, { env }).secret('gumroad_access_token_poppy', 'nova.publish'), (e) => e instanceof VaultNotConfigured && /vault not configured/.test(e.message), JSON.stringify(env));
    await assert.rejects(createVault(spy, { env }).put('gumroad_access_token_poppy', 'v', { consumers: ['nova.publish'] }), VaultNotConfigured);
  }
  assert.ok(seen.includes('SET LOCAL ROLE coco_vault'), 'the configured vault switched to coco_vault (nova_app is a member) before it found no 0041 functions');
  assert.ok(!seen.some((s) => /coco_(callback|publish|store_publish)_secret|coco_oauth_client|coco_secret|vault\.|supabase/i.test(s)), seen.join(' | '));
  const r = await call('POST', '/api/oauth/verify', { body: { connection_id: 'poppy' } });
  assert.notEqual(r.status, 500, 'a vault route answers, it does not crash');
});

console.log(`\nnova.roles.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
