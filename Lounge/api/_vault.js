// The Coco vault: where every provider credential (OAuth refresh tokens, API keys, OAuth client secrets) is sealed and
// opened. Nova is the only place that can open one; nothing here returns a value to a caller outside Nova.
//
//   portable backend ('coco'):  AES-256-GCM in Nova -> ciphertext rows in private.credentials (migration 0041). The database
//                               cannot decrypt them, so the rows move to any Postgres unchanged and every connection keeps
//                               working without re-authorisation. The credential's NAME is the AAD: a row copied under
//                               another name does not open.
//   There is no other backend: the Supabase Vault doors are not part of Nova (docs/SUPABASE_REMOVAL_PLAN.md step 4). Without the
//   portable vault (COCO_VAULT_BACKEND=coco, a key ring, migration 0041's private.vault_*) every vault call fails closed with
//   VaultNotConfigured ('vault not configured', 503): nothing is read from or written to anywhere else.
//
// Env (Nova only; never in a client, a log or the database):
//   COCO_VAULT_BACKEND  must be 'coco'; anything else (or unset) = vault not configured
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

export class VaultNotConfigured extends Error {
  constructor(why) { super(`vault not configured: ${why}`); this.status = 503; this.state = 'VAULT_NOT_CONFIGURED'; }
}
// 0041 not applied (function or schema missing), the role missing, or coco_vault without 0041's grants: the portable vault is not
// there, so the call fails closed
const MISSING = new Set(['42883', '3F000', '42704', '42501']);
// Vault statements run as the vault's database role (0043: coco_vault; Nova's login nova_app is a member): the only role 0041 lets reach
// private.vault_*. Own transaction, or (tx = the caller already holds one) a role switch inside it that is undone after the statement.
export const VAULT_ROLE = 'coco_vault';
async function asVault(db, sql, params = [], tx = false) {
  if (!tx) await db.query('BEGIN');
  try {
    await db.query(`SET LOCAL ROLE ${VAULT_ROLE}`);
    const r = await db.query(sql, params);
    if (tx) await db.query('RESET ROLE'); else await db.query('COMMIT');
    return r.rows;
  } catch (e) {
    if (!tx) { try { await db.query('ROLLBACK'); } catch {} }
    if (MISSING.has(String(e?.code))) throw new VaultNotConfigured('the portable vault (migration 0041 and its grants to role coco_vault) is not in this database');
    throw e;
  }
}

// test seam: testVault.make(db, opts) -> a stand-in vault for route tests that do not exercise the vault itself (null in production)
export const testVault = { make: null };
// tx: true when the caller runs the vault call inside its own open transaction (all or nothing with its other writes)
export function createVault(db, { env = process.env, actor = 'nova', tx = false } = {}) {
  if (testVault.make) return testVault.make(db, { env, actor, tx });
  const backend = env.COCO_VAULT_BACKEND === 'coco' ? 'coco' : null;
  const ready = () => {
    if (!backend) throw new VaultNotConfigured('set COCO_VAULT_BACKEND=coco with COCO_VAULT_KEYS and COCO_VAULT_KEY_ID (the Supabase Vault is not used)');
    if (!Object.keys(keyring(env).ring).length) throw new VaultNotConfigured('COCO_VAULT_KEYS holds no key');
  };
  const vault = {
    backend,
    async secret(name, consumer) {
      ready();
      const row = (await asVault(db, 'SELECT private.vault_get($1, $2, $3) AS v', [name, consumer, actor], tx))[0]?.v;
      return row ? open(keyring(env).ring, name, typeof row === 'string' ? JSON.parse(row) : row) : null;
    },
    async client(provider) {
      const [id, secret] = [await vault.secret(`${provider}_client_id`, 'nova.oauth'), await vault.secret(`${provider}_client_secret`, 'nova.oauth')];
      return id && secret ? { client_id: id, client_secret: secret } : null;
    },
    // op: create | rotate (new value) | import (copied from another vault). Returns the new version.
    async put(name, value, { consumers, expiresAt = null, op = 'create' } = {}) {
      ready();
      const { ring, active } = keyring(env);
      if (!active) throw new VaultNotConfigured('COCO_VAULT_KEY_ID is not set');
      const s = seal(ring, active, name, value);
      return (await asVault(db, 'SELECT private.vault_put($1, $2, $3, $4, $5, $6, $7, $8, $9) AS v',
        [name, s.kek_id, s.iv, s.tag, s.ciphertext, consumers, expiresAt, actor, op], tx))[0].v;
    },
    async revoke(name) { ready(); return (await asVault(db, 'SELECT private.vault_revoke($1, $2) AS v', [name, actor], tx))[0].v === true; },
    // Master-key rotation: every active credential sealed by an older key is re-sealed with the active key (same value,
    // new version, op 'rewrap'). After it, the old key can leave COCO_VAULT_KEYS.
    async rewrap() {
      ready();
      const { ring, active } = keyring(env);
      if (!active) throw new VaultNotConfigured('COCO_VAULT_KEY_ID is not set');
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
