// Run: node vault.test.js   (no network, no database: an in-memory stand-in plays private.vault_* from migration 0041)
//
// The Coco vault must: seal with AES-256-GCM bound to the credential's name; never put a value where the database can read
// it; open only through service_role; keep the legacy Supabase path byte-for-byte the same; let a master key rotate
// (rewrap) without touching any connection; and serve the publishing seam (company().secret / client) from either backend.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { keyring, seal, open, createVault } from './api/_vault.js';
import { company } from './api/_publish.js';

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} — ${e.message}`); } };
const K1 = randomBytes(32).toString('base64'), K2 = randomBytes(32).toString('base64');
const SECRET = 'refresh-token-SECRET-1234567890';
const envOf = (keys, active) => ({ COCO_VAULT_BACKEND: 'coco', COCO_VAULT_KEYS: JSON.stringify(keys), COCO_VAULT_KEY_ID: active });

// private.vault_put / vault_get / vault_rows / vault_revoke, as 0041 defines them, over an array
function fakeDb() {
  const rows = [], sql = [];
  let role = null;
  return { rows, sql, async query(text, params = []) {
    sql.push({ text, params, role });
    if (/^BEGIN|^COMMIT|^ROLLBACK/.test(text)) { if (!/BEGIN/.test(text)) role = null; return { rows: [] }; }
    if (/SET LOCAL ROLE service_role/.test(text)) { role = 'service_role'; return { rows: [] }; }
    if (/private\.vault_/.test(text) && role !== 'service_role') throw new Error('permission denied for function');
    if (/private\.vault_put/.test(text)) {
      const [name, kek_id, iv, tag, ciphertext, consumers, expires_at, , op] = params;
      if (!consumers?.length) throw new Error('needs at least one consumer');
      for (const r of rows) if (r.name === name && r.status === 'active') r.status = 'superseded';
      const version = rows.filter((r) => r.name === name).length + 1;
      rows.push({ name, version, kek_id, iv, tag, ciphertext, consumers, expires_at, status: 'active', op });
      return { rows: [{ v: version }] };
    }
    if (/private\.vault_get/.test(text)) { const r = rows.find((x) => x.name === params[0] && x.status === 'active'); return { rows: [{ v: r && r.consumers.includes(params[1]) ? { ...r } : null }] }; }
    if (/private\.vault_rows/.test(text)) return { rows: rows.filter((r) => r.status === 'active') };
    if (/private\.vault_revoke/.test(text)) { const r = rows.find((x) => x.name === params[0] && x.status === 'active'); if (r) r.status = 'revoked'; return { rows: [{ v: !!r }] }; }
    if (/coco_publish_secret/.test(text)) return { rows: [{ v: 'legacy-value' }] };
    if (/coco_oauth_client/.test(text)) return { rows: [{ v: { client_id: 'legacy-cid', client_secret: 'legacy-cs' } }] };
    return { rows: [] };
  } };
}

await t('keyring: rejects malformed keys and an active id that is not loaded', () => {
  assert.throws(() => keyring({ COCO_VAULT_KEYS: '{oops' }), /not valid JSON/);
  assert.throws(() => keyring({ COCO_VAULT_KEYS: JSON.stringify({ k1: Buffer.alloc(16).toString('base64') }) }), /32 bytes/);
  assert.throws(() => keyring({ COCO_VAULT_KEYS: JSON.stringify({ 'K 1': K1 }) }), /id of/);
  assert.throws(() => keyring({ COCO_VAULT_KEYS: JSON.stringify({ k1: K1 }), COCO_VAULT_KEY_ID: 'k2' }), /not in COCO_VAULT_KEYS/);
});

await t('seal/open: round trip; the ciphertext holds no trace of the value; bound to its name; tampering fails', () => {
  const { ring } = keyring(envOf({ k1: K1 }, 'k1'));
  const s = seal(ring, 'k1', 'youtube_refresh_token_the_flow', SECRET);
  assert.ok(!JSON.stringify(s).includes(SECRET) && !JSON.stringify(s).includes(Buffer.from(SECRET).toString('base64')));
  assert.equal(open(ring, 'youtube_refresh_token_the_flow', s), SECRET);
  assert.throws(() => open(ring, 'youtube_refresh_token_other', s));                       // copied under another name
  const bad = { ...s, ciphertext: Buffer.from('x' + Buffer.from(s.ciphertext, 'base64').toString('latin1').slice(1), 'latin1').toString('base64') };
  assert.throws(() => open(ring, 'youtube_refresh_token_the_flow', bad));
  assert.throws(() => open({}, 'youtube_refresh_token_the_flow', s), /not loaded/);
});

await t('portable backend: write and read run as service_role, the database row is ciphertext, consumers are enforced', async () => {
  const db = fakeDb(), v = createVault(db, { env: envOf({ k1: K1 }, 'k1'), actor: 'test' });
  assert.equal(await v.put('gumroad_access_token_poppy', SECRET, { consumers: ['nova.publish'] }), 1);
  assert.ok(!JSON.stringify(db.rows).includes(SECRET));
  assert.ok(db.sql.filter((s) => /private\.vault_/.test(s.text)).every((s) => s.role === 'service_role'));
  assert.equal(await v.secret('gumroad_access_token_poppy', 'nova.publish'), SECRET);
  assert.equal(await v.secret('gumroad_access_token_poppy', 'nova.chat'), null);
  await assert.rejects(v.put('gumroad_access_token_x', SECRET, { consumers: [] }), /consumer/);
});

await t('rotate + revoke: a new value supersedes the old one; a revoked credential reads as nothing', async () => {
  const db = fakeDb(), v = createVault(db, { env: envOf({ k1: K1 }, 'k1') });
  await v.put('gumroad_access_token_poppy', 'old-SECRET-value', { consumers: ['nova.publish'] });
  assert.equal(await v.put('gumroad_access_token_poppy', SECRET, { consumers: ['nova.publish'], op: 'rotate' }), 2);
  assert.equal(await v.secret('gumroad_access_token_poppy', 'nova.publish'), SECRET);
  assert.equal(await v.revoke('gumroad_access_token_poppy'), true);
  assert.equal(await v.secret('gumroad_access_token_poppy', 'nova.publish'), null);
});

await t('master-key rotation: rewrap re-seals every credential with the new key; afterwards the old key can go', async () => {
  const db = fakeDb();
  const v1 = createVault(db, { env: envOf({ k1: K1 }, 'k1') });
  await v1.put('youtube_refresh_token_the_flow', SECRET, { consumers: ['nova.publish'] });
  await v1.put('youtube_client_secret', 'cs-SECRET-123456', { consumers: ['nova.oauth'] });
  const both = createVault(db, { env: envOf({ k1: K1, k2: K2 }, 'k2') });
  assert.equal(await both.rewrap(), 2);
  assert.equal(await both.rewrap(), 0, 'a second rewrap has nothing left to do');
  assert.ok(db.rows.filter((r) => r.status === 'active').every((r) => r.kek_id === 'k2' && r.op === 'rewrap'));
  const onlyNew = createVault(db, { env: envOf({ k2: K2 }, 'k2') });
  assert.equal(await onlyNew.secret('youtube_refresh_token_the_flow', 'nova.publish'), SECRET);
});

await t('legacy backend (the default): the same Supabase functions as before, and it refuses to write', async () => {
  const db = fakeDb();
  const v = createVault(db, { env: {}, legacy: { secret: async (n) => `legacy:${n}`, client: async () => ({ client_id: 'a', client_secret: 'b' }) } });
  assert.equal(v.backend, 'supabase');
  assert.equal(await v.secret('x_y_z', 'nova.publish'), 'legacy:x_y_z');
  await assert.rejects(v.put('x_y_z', 'v', { consumers: ['nova.publish'] }), /legacy vault/);
});

await t('the publishing seam: company().secret / client answer from whichever backend Nova is configured with', async () => {
  const runAs = async (db, who, key, { sql, params }) => (await db.query(sql, params)).rows;
  const who = { email: 'boss@example.com', device_id: 'cloud-worker-1' };
  const legacyDb = fakeDb();
  assert.equal(await company(legacyDb, who, 'k', 'e', runAs).secret('gumroad_access_token_poppy'), 'legacy-value');
  assert.deepEqual(await company(legacyDb, who, 'k', 'e', runAs).client('youtube'), { client_id: 'legacy-cid', client_secret: 'legacy-cs' });
  const saved = { ...process.env };
  Object.assign(process.env, envOf({ k1: K1 }, 'k1'));
  try {
    const db = fakeDb(), v = createVault(db, { env: process.env });
    await v.put('gumroad_access_token_poppy', SECRET, { consumers: ['nova.publish'] });
    await v.put('youtube_client_id', 'cid-123', { consumers: ['nova.oauth'] });
    await v.put('youtube_client_secret', 'cs-SECRET-123456', { consumers: ['nova.oauth'] });
    const co = company(db, who, 'k', 'e', runAs);
    assert.equal(await co.secret('gumroad_access_token_poppy'), SECRET);
    assert.deepEqual(await co.client('youtube'), { client_id: 'cid-123', client_secret: 'cs-SECRET-123456' });
    assert.ok(!db.sql.some((s) => /coco_publish_secret|coco_oauth_client/.test(s.text)), 'the portable backend never touches Supabase Vault');
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
