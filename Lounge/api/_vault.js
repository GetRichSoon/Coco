// The Coco vault: where every provider credential (OAuth refresh tokens, API keys, OAuth client secrets) is sealed and
// opened. Nova is the only place that can open one; nothing here returns a value to a caller outside Nova.
//
//   portable backend ('coco'):  AES-256-GCM in Nova -> ciphertext rows in private.credentials (migration 0041). The database
//                               cannot decrypt them, so the rows move to any Postgres unchanged and every connection keeps
//                               working without re-authorisation. The credential's NAME is the AAD: a row copied under
//                               another name does not open.
//   legacy backend ('supabase'): today's Supabase Vault functions (coco_publish_secret / coco_oauth_client), unchanged.
//                               The default until the vault is moved (scripts/ops/vault-migrate.mjs in CocoMaison).
//
// Env (Nova only; never in a client, a log or the database):
//   COCO_VAULT_BACKEND  'supabase' (default) | 'coco'
//   COCO_VAULT_KEYS     JSON {"<key id>": "<base64 of 32 random bytes>", ...}  old keys stay until a rewrap retires them
//   COCO_VAULT_KEY_ID   the key new credentials are sealed with
// Business code calls secret(name, consumer) / client(provider) and never knows which backend answered.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KID = /^[a-z0-9_-]{1,40}$/;

export function keyring(env = process.env) {
  let keys;
  try { keys = JSON.parse(env.COCO_VAULT_KEYS || '{}'); } catch { throw new Error('COCO_VAULT_KEYS is not valid JSON'); }
  const ring = {};
  for (const [kid, b64] of Object.entries(keys)) {
    const k = Buffer.from(String(b64), 'base64');
    if (!KID.test(kid) || k.length !== 32) throw new Error(`vault key "${kid}" must have an id of [a-z0-9_-] and be 32 bytes`);
    ring[kid] = k;
  }
  const active = env.COCO_VAULT_KEY_ID || null;
  if (active && !ring[active]) throw new Error('COCO_VAULT_KEY_ID names a key that is not in COCO_VAULT_KEYS');
  return { ring, active };
}

export function seal(ring, kid, name, value) {
  if (!ring[kid]) throw new Error(`vault key ${kid} is not loaded`);
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', ring[kid], iv);
  c.setAAD(Buffer.from(name, 'utf8'));
  const ct = Buffer.concat([c.update(String(value), 'utf8'), c.final()]);
  return { kek_id: kid, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ciphertext: ct.toString('base64') };
}

export function open(ring, name, row) {
  const k = ring[row.kek_id];
  if (!k) throw new Error(`vault key ${row.kek_id} is not loaded (it sealed ${name})`);
  const d = createDecipheriv('aes-256-gcm', k, Buffer.from(row.iv, 'base64'));
  d.setAAD(Buffer.from(name, 'utf8')); d.setAuthTag(Buffer.from(row.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(row.ciphertext, 'base64')), d.final()]).toString('utf8');
}

// Vault statements run as service_role in their own transaction: the only role 0041 lets reach private.vault_*.
async function asVault(db, sql, params = []) {
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE service_role');
    const r = await db.query(sql, params);
    await db.query('COMMIT');
    return r.rows;
  } catch (e) { try { await db.query('ROLLBACK'); } catch {} throw e; }
}

// legacy = { secret(name) -> value|null, client(provider) -> {client_id, client_secret}|null }: today's Supabase functions
export function createVault(db, { env = process.env, legacy = {}, actor = 'nova' } = {}) {
  const backend = env.COCO_VAULT_BACKEND === 'coco' ? 'coco' : 'supabase';
  const vault = {
    backend,
    async secret(name, consumer) {
      if (backend !== 'coco') return legacy.secret ? legacy.secret(name) : null;
      const row = (await asVault(db, 'SELECT private.vault_get($1, $2, $3) AS v', [name, consumer, actor]))[0]?.v;
      return row ? open(keyring(env).ring, name, typeof row === 'string' ? JSON.parse(row) : row) : null;
    },
    async client(provider) {
      if (backend !== 'coco') return legacy.client ? legacy.client(provider) : null;
      const [id, secret] = [await vault.secret(`${provider}_client_id`, 'nova.oauth'), await vault.secret(`${provider}_client_secret`, 'nova.oauth')];
      return id && secret ? { client_id: id, client_secret: secret } : null;
    },
    // op: create | rotate (new value) | import (copied from another vault). Returns the new version.
    async put(name, value, { consumers, expiresAt = null, op = 'create' } = {}) {
      if (backend !== 'coco') throw new Error('the legacy vault is written by its own functions; set COCO_VAULT_BACKEND=coco to use the portable vault');
      const { ring, active } = keyring(env);
      if (!active) throw new Error('COCO_VAULT_KEY_ID is not set');
      const s = seal(ring, active, name, value);
      return (await asVault(db, 'SELECT private.vault_put($1, $2, $3, $4, $5, $6, $7, $8, $9) AS v',
        [name, s.kek_id, s.iv, s.tag, s.ciphertext, consumers, expiresAt, actor, op]))[0].v;
    },
    async revoke(name) { return (await asVault(db, 'SELECT private.vault_revoke($1, $2) AS v', [name, actor]))[0].v === true; },
    // Master-key rotation: every active credential sealed by an older key is re-sealed with the active key (same value,
    // new version, op 'rewrap'). After it, the old key can leave COCO_VAULT_KEYS.
    async rewrap() {
      const { ring, active } = keyring(env);
      if (!active) throw new Error('COCO_VAULT_KEY_ID is not set');
      let n = 0;
      for (const r of await asVault(db, 'SELECT * FROM private.vault_rows()')) {
        if (r.kek_id === active) continue;
        const s = seal(ring, active, r.name, open(ring, r.name, r));
        await asVault(db, 'SELECT private.vault_put($1, $2, $3, $4, $5, $6, $7, $8, $9) AS v', [r.name, s.kek_id, s.iv, s.tag, s.ciphertext, r.consumers, r.expires_at, actor, 'rewrap']);
        n++;
      }
      return n;
    },
  };
  return vault;
}
