// Nova's connection + revenue routes. A founder's paired device presses Connect / Check now / Sync now; Nova does the real work.
//
//   POST /api/connect/key     { provider, connection_id, label?, house_id?, secret }  verify a pasted token with the provider FIRST, then seal it in the vault and record it
//   POST /api/connect/check   { connection_id }                                        re-verify with the stored credential and stamp the result (the "Check now" button)
//   POST /api/revenue/sync    { connection_id? }                                       fetch new sales, write the ledger, record the sync (the "Sync now" button)
//   GET  /api/revenue/summary                                                          what the ledger says, per source, with sources nobody connected yet listed too
//
// Which providers: Gumroad is the revenue source (a token can be pasted, or connected with Gumroad's consent screen through /api/oauth/begin).
// YouTube channels, PickTheory included, connect with Google's consent screen only (/api/oauth/begin); "Check now" for them is the real check in api/_oauth.js.
//
// Where things live (nothing here invents a door):
//   * the credential: the vault functions Nova already uses (coco_store_publish_secret / coco_callback_secret, postgres-only). The secret is
//     held in one variable, never returned, never logged, never put in activity or in an error text.
//   * the provider calls: api/_conn_*.js (the connectors), imported lazily; a missing connector answers 501 {error:'connector not installed'}.
//   * the ledger: public.revenue_events / revenue_sync, written ONLY through coco_revenue_upsert / coco_revenue_sync_set, which the database
//     lets a founder on a paired device call (runAs sets the founder's claims and device header, so Postgres decides, not this file).
//   * the "checked" stamp on integration_accounts: coco_connection_checked needs the engine key, which Nova does not hold. Nova IS the verifier,
//     so after a real provider call it stamps the same columns itself, exactly as api/_oauth.js does.
import { ACCESS_POLICY } from './_access_policy.js';
import { redact } from './_publish.js';
import { verify as oauthVerify, OauthError } from './_oauth.js';

const CONN_ID = /^[a-z0-9][a-z0-9._-]{1,60}$/;
const KEY_CONN = /^[a-z0-9][a-z0-9._-]{1,39}$/;            // the vault name carries it: <prefix>_<at most 40 characters>
const HOUSE = /^[a-z0-9][a-z0-9_-]{1,30}$/;
const SECRET_OK = /^[\x21-\x7e]{8,512}$/;                    // one printable token, no spaces or line breaks
const slug = (c) => String(c).replace(/[^a-z0-9]/g, '_');
const iso = (d) => (d ? new Date(d).toISOString() : null);
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
export const SYNC_COOLDOWN_MS = 20000;                       // a second press inside this window answers from the last sync (provider rate limits)
const lastSync = new Map();                                  // connection id -> { at }  (per warm instance; best effort)
const flying = new Map();                                    // connection id -> promise: two presses at once share one sync
export function _resetSync() { lastSync.clear(); flying.clear(); }   // test seam

// PickTheory is a YouTube channel (connection yt-app-web), not a service with a key: say how to connect it instead of taking a "key".
const GOOGLE_ONLY = { picktheory: { connect: { route: '/api/oauth/begin', body: { provider: 'youtube', connection_id: 'yt-app-web' } }, check: { route: '/api/connect/check', body: { connection_id: 'yt-app-web' } } }, youtube: { connect: { route: '/api/oauth/begin', body: { provider: 'youtube' } } } };

// What each provider is, how it is checked and how its secret is named in the vault. Adding a provider = adding an entry (+ its _conn_ file).
export const PROVIDERS = {
  gumroad: {
    label: 'Gumroad', connect: 'oauth', currency: 'USD', load: () => import('./_conn_gumroad.js'),   // Gumroad reports every amount in USD cents
    secretName: (c) => `gumroad_access_token_${slug(c)}`, secretShape: /^gumroad_access_token_[a-z0-9_]+$/,
    // -> { ok, state, detail, can_read_sales?, ...identity } where state is the same vocabulary /api/oauth/verify uses
    async check({ mod, secret, fetch: f, opts }) {
      const v = await mod.verifyGumroad(secret, f, opts);
      const identity = { external_id: v.external_id ?? null, account: v.account_label ?? v.external_name ?? null, scopes: v.scopes ?? [], can_read_sales: v.can_read_sales ?? null, missing_scopes: v.missing_scopes ?? [], warning: v.warning ?? null };
      if (!v.ok) return { ok: false, state: v.code === 'revoked' ? 'CONNECTED_EXPIRED' : v.code === 'missing_scope' ? 'CONNECTED_MISSING_PERMISSION' : 'ERROR', detail: v.error, ...identity };
      if (v.can_read_sales === false) return { ok: false, state: 'CONNECTED_MISSING_PERMISSION', detail: v.warning, ...identity };
      return { ok: true, state: 'CONNECTED_VERIFIED', detail: `${identity.account ?? 'the account'} answered from the cloud${v.can_read_sales ? ' and can read sales' : ''}${v.warning ? `. ${v.warning}` : ''}`, ...identity };
    },
    // -> ledger rows for every sale since `after`; throws (with the connector's own words) when the read did not complete
    async rows({ mod, secret, after, ctx, fetch: f, opts }) {
      const r = await mod.fetchGumroadSales(secret, { after, ...opts }, f);
      if (!r.ok) throw Object.assign(new Error(r.error), { code: r.code });
      return { rows: mod.toRevenueRows(r.sales, ctx), truncated: r.truncated === true };
    },
  },
};
const REVENUE = Object.keys(PROVIDERS);

// the connector for a provider, or null when its file is not installed (a broken file still throws: that is a bug to see, not hide)
export async function loadConnector(provider) {
  try { return await PROVIDERS[provider].load(); }
  catch (e) { if (e && (e.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module|Failed to load url/i.test(String(e.message)))) return null; throw e; }
}

class ConnectError extends Error { constructor(status, state, reason, extra = {}) { super(reason); this.status = status; this.state = state; this.extra = extra; } }
const NOT_INSTALLED = (e) => e && (e.code === '42P01' || e.code === '42883');
const safe = (v, ...secrets) => redact(String(v ?? ''), ...secrets).slice(0, 300);
const activity = (db, who, action, detail) => db.query('INSERT INTO public.activity (actor, device_id, action, detail) VALUES ($1, $2, $3, $4)', [who.email, who.device_id, action, String(detail).slice(0, 1500)]);
const readSecret = async (db, name) => { const r = await db.query('SELECT public.coco_callback_secret($1) AS v', [name]); return typeof r.rows[0]?.v === 'string' && r.rows[0].v ? r.rows[0].v : null; };
const isWorker = (who) => ACCESS_POLICY.workflow_devices.includes(who.device_id);
const missingConnector = (provider) => new ConnectError(501, 'NOT_INSTALLED', 'connector not installed', { error: 'connector not installed', provider });

// ---------------------------------------------------------------- the stamp a real provider check leaves behind
// 'connected' (verified), 'partial' (the credential works, a permission is missing) or 'error'; only a check that reached the provider dates last_verified_at
async function recordCheck(db, who, acc, state, detail) {
  const alive = state !== 'error';
  // a check of something that was never connected does not turn "not connected" into "error"
  await db.query(`UPDATE public.integration_accounts SET state = CASE WHEN $2 = 'error' AND state = 'not_connected' THEN state ELSE $2 END, ${alive ? 'last_verified_at = now(),' : ''} updated_at = now(), updated_by = $3 WHERE connection_id = $1`, [acc.connection_id, state, who.email]);
  await db.query(`UPDATE public.integrations SET last_check_at = now(), last_ok_at = CASE WHEN $2 THEN now() ELSE last_ok_at END, error = CASE WHEN $3 = 'connected' THEN NULL ELSE left($4, 300) END,
    state = $3, updated_at = now() WHERE id = $1`, [acc.provider, alive, state, String(detail)]);
  await activity(db, who, 'connection verified', `${acc.provider} ${acc.connection_id}: ${state === 'connected' ? 'verified' : state === 'partial' ? 'works, a permission is missing' : 'did not pass'} - ${String(detail).slice(0, 300)}`);
}
const STATE_OF = { CONNECTED_VERIFIED: 'connected', CONNECTED_MISSING_PERMISSION: 'partial' };

// ---------------------------------------------------------------- POST /api/connect/key
async function connectKey({ db, who, body, f, load, opts }) {
  if (isWorker(who)) throw new ConnectError(403, 'FORBIDDEN', 'a cloud worker cannot add a credential; a founder does that from Coco');
  const provider = String(body.provider || '').toLowerCase(), P = PROVIDERS[provider];
  if (!P) {
    const g = GOOGLE_ONLY[provider];
    if (g) throw new ConnectError(400, 'USE_GOOGLE_SIGN_IN', `${provider === 'picktheory' ? 'PickTheory is a YouTube channel, not a service with an API key' : 'YouTube has no key to paste'}: connect it with Google sign-in (Connections, Connect).`, g);
    throw new ConnectError(400, 'UNKNOWN_PROVIDER', `no key connection is built for ${provider || 'null'} (${REVENUE.join(', ')})`);
  }
  const conn = String(body.connection_id || '');
  if (!KEY_CONN.test(conn)) throw new ConnectError(400, 'ERROR', 'a connection id is 2 to 40 characters: lower case letters, digits, dot, dash, underscore');
  const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
  if (!SECRET_OK.test(secret)) throw new ConnectError(400, 'ERROR', 'the key must be 8 to 512 visible characters with no spaces');
  const label = body.label == null || body.label === '' ? null : String(body.label).trim();
  if (label !== null && (label.length > 80 || /[\x00-\x1f]/.test(label) || label.includes(secret))) throw new ConnectError(400, 'ERROR', 'the label is a short plain name (80 characters at most, never the key)');
  const house = body.house_id == null || body.house_id === '' ? null : String(body.house_id);
  if (house !== null && (!HOUSE.test(house) || !(await db.query('SELECT 1 FROM public.houses WHERE id = $1', [house])).rows.length)) throw new ConnectError(400, 'ERROR', `no House called ${house.slice(0, 40)}`);
  // one connection id, one provider
  const had = (await db.query('SELECT connection_id, provider, external_id, external_name FROM public.integration_accounts WHERE connection_id = $1', [conn])).rows[0];
  if (had && had.provider !== provider) throw new ConnectError(409, 'ERROR', `${conn} is already a ${had.provider} connection; pick another id for ${P.label}`);
  const mod = await load(provider);
  if (!mod) throw missingConnector(provider);

  // 1. ask the provider. A wrong token, a token missing its permission, or a provider that cannot be reached stores nothing.
  let v;
  try { v = await P.check({ mod, secret, fetch: f, opts }); }
  catch (e) { return { status: 200, body: { ok: false, state: 'ERROR', connection_id: conn, provider, stored: false, reason: `${P.label} could not be reached to check the key (${safe(e instanceof Error ? e.message : e, secret)}). Nothing was stored; try again.` } }; }
  if (!v.ok && v.state !== 'CONNECTED_MISSING_PERMISSION') return { status: 200, body: { ok: false, state: v.state, connection_id: conn, provider, stored: false, reason: `${safe(v.detail || `${P.label} did not accept that key`, secret)} Nothing was stored.` } };
  if (had?.external_id && v.external_id && had.external_id !== String(v.external_id)) {
    return { status: 200, body: { ok: false, state: 'CONNECTED_WRONG_CHANNEL', connection_id: conn, provider, stored: false, reason: `${conn} is recorded as ${had.external_name}, but that key belongs to a different ${P.label} account. Nothing was stored.` } };
  }

  // one provider account belongs to one connection: two would each claim the same sales, and the ledger keeps a sale under one connection only
  const clash = v.external_id ? (await db.query('SELECT connection_id, external_name FROM public.integration_accounts WHERE provider = $1 AND external_id = $2 AND connection_id <> $3 LIMIT 1', [provider, String(v.external_id), conn])).rows[0] : null;
  if (clash) return { status: 200, body: { ok: false, state: 'ALREADY_CONNECTED', connection_id: conn, provider, stored: false, reason: `that ${P.label} account is already connected in Coco as "${clash.external_name}" (${clash.connection_id}). One account belongs to one connection, so nothing was stored. Use that connection instead.` } };

  // 2. seal + record, all or nothing. A token that works but lacks a permission (Gumroad without view_sales) is kept, as 'partial', and says what is missing.
  const state = STATE_OF[v.state], name = P.secretName(conn);
  // what the connection is called: the founder's label, else what it already was, else what the provider says it is
  const account = label || had?.external_name || v.account || P.label;
  // Gumroad hands the same token back until the app is revoked: a token that did not change must not settle the alert about an exposed one
  const same = !!had && (await readSecret(db, name).catch(() => null)) === secret;
  await db.query('BEGIN');
  try {
    await db.query('SELECT public.coco_store_publish_secret($1, $2)', [name, secret]);
    if (!same) await db.query("UPDATE public.integrations SET state = 'connected', error = NULL, next_action = NULL, last_check_at = now(), last_ok_at = now(), updated_at = now() WHERE id = $1", [`${provider}-${conn}`]);
    await db.query(`INSERT INTO public.integrations (id, house_id, platform, account, state, auth_method, capabilities, last_check_at, last_ok_at, error, next_action, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now(), NULL, NULL, now())
      ON CONFLICT (id) DO UPDATE SET house_id = coalesce(public.integrations.house_id, EXCLUDED.house_id), state = EXCLUDED.state, last_check_at = now(), last_ok_at = now(), error = NULL, next_action = NULL,
        auth_method = coalesce(public.integrations.auth_method, EXCLUDED.auth_method), updated_at = now()`,
    [provider, house, P.label, account, state, 'API token; sealed in the Coco vault, read server-side only', ['sales']]);
    await db.query(`INSERT INTO public.integration_accounts (connection_id, provider, external_id, external_name, account_label, secret_ref, state, permissions, connected_at, last_verified_at, note, created_by, updated_at, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now(), $9, $10, now(), $10)
      ON CONFLICT (connection_id) DO UPDATE SET external_id = coalesce(EXCLUDED.external_id, public.integration_accounts.external_id), external_name = EXCLUDED.external_name, account_label = coalesce(EXCLUDED.account_label, public.integration_accounts.account_label),
        secret_ref = EXCLUDED.secret_ref, state = EXCLUDED.state, permissions = EXCLUDED.permissions, connected_at = now(), last_verified_at = now(), note = EXCLUDED.note, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [conn, provider, v.external_id ? String(v.external_id) : null, account, v.account || label || null, name, state, v.scopes?.length ? v.scopes : ['read'], `connected with a pasted token through Nova; ${P.label} answered the check${v.can_read_sales === false ? ' (it cannot read sales)' : ''}`, who.email]);
    await activity(db, who, 'platform connected', `${P.label}: connection ${conn} verified with a pasted token and sealed in the vault (name ${name})${v.can_read_sales === false ? '; it cannot read sales' : ''}. The token itself is not shown anywhere.`);
    await db.query('COMMIT');
  } catch (e) { try { await db.query('ROLLBACK'); } catch { /* the original error is the one to show */ } throw e; }
  return { status: 200, body: { ok: v.ok, state: v.state, connection_id: conn, provider, account, stored: true, verified_at: new Date().toISOString(), can_read_sales: v.can_read_sales ?? null, missing_scopes: v.missing_scopes ?? [],
    detail: v.ok ? safe(v.detail, secret) : `${safe(v.detail, secret)} The token is stored; connect again with the missing permission.` } };
}

// ---------------------------------------------------------------- POST /api/connect/check
async function connectCheck({ db, who, body, f, env, urls, load, opts }) {
  const conn = String(body.connection_id || '');
  if (!CONN_ID.test(conn)) throw new ConnectError(400, 'ERROR', 'which connection?');
  const acc = (await db.query('SELECT connection_id, provider, external_id, external_name, secret_ref, state FROM public.integration_accounts WHERE connection_id = $1', [conn])).rows[0];
  if (!acc) {
    // a platform that has no account row (github, cloudflare, ...) lives on a PC login: there is nothing for the cloud to ask, and saying so is the honest answer
    const integ = (await db.query('SELECT id, platform, auth_method FROM public.integrations WHERE id = $1', [conn])).rows[0];
    if (!integ) throw new ConnectError(404, 'ERROR', `no connection ${conn}`);
    return { status: 200, body: { ok: false, state: 'CANNOT_CHECK', connection_id: conn, provider: conn, detail: `${integ.platform} has no credential the cloud can use (${integ.auth_method || 'set up on a PC'}), so Coco cannot check it from here. Nothing was changed.`, checked_at: null } };
  }
  const out = (state, detail, extra = {}) => ({ status: 200, body: { ok: state === 'CONNECTED_VERIFIED' || state === 'NOT_ASSIGNED', state, connection_id: conn, provider: acc.provider, detail, checked_at: new Date().toISOString(), ...extra } });
  // YouTube (every channel, PickTheory = yt-app-web included) has its real check in api/_oauth.js; this is the same answer under the one "Check now" route
  if (acc.provider === 'youtube') {
    try { const { status, detail, ...rest } = await oauthVerify(db, who, { connection_id: conn }, { fetch: f, env, urls }); return out(status, detail, rest); }
    catch (e) { if (e instanceof OauthError) throw new ConnectError(e.status, 'ERROR', e.message); throw e; }
  }
  const P = PROVIDERS[acc.provider];
  if (!P) return out('CANNOT_CHECK', `no cloud check is built for ${acc.provider} yet`);
  if (!acc.secret_ref || !P.secretShape.test(acc.secret_ref)) {
    await recordCheck(db, who, acc, 'error', 'no cloud credential is recorded');
    return out('NOT_CONNECTED', 'no credential is recorded for this connection. Connect it to authorise it.');
  }
  let secret = null;
  try {
    secret = await readSecret(db, acc.secret_ref).catch(() => null);
    if (!secret) { await recordCheck(db, who, acc, 'error', 'the vault holds nothing under that name'); return out('NOT_CONNECTED', 'the vault holds nothing under that name. Connect it again.'); }
    const mod = await load(acc.provider);
    if (!mod) throw missingConnector(acc.provider);
    let v;
    try { v = await P.check({ mod, secret, fetch: f, opts }); }
    catch (e) { const why = safe(e instanceof Error ? e.message : e, secret); await recordCheck(db, who, acc, 'error', why); return out('ERROR', why); }
    const detail = safe(v.detail, secret), extra = { can_read_sales: v.can_read_sales ?? null, missing_scopes: v.missing_scopes ?? [], scopes: v.scopes ?? [] };
    if (v.ok && acc.external_id && v.external_id && acc.external_id !== String(v.external_id)) {
      const why = `this connection is recorded as ${acc.external_name} but the stored credential belongs to a different ${P.label} account. Reconnect it.`;
      await recordCheck(db, who, acc, 'error', why); return out('CONNECTED_WRONG_CHANNEL', why, extra);
    }
    await recordCheck(db, who, acc, v.ok || v.state === 'CONNECTED_MISSING_PERMISSION' ? STATE_OF[v.state] || 'connected' : 'error', detail);
    return out(v.state, detail, extra);
  } finally { secret = null; }
}

// ---------------------------------------------------------------- revenue
const SUM_SQL = `SELECT connection_id, currency,
    coalesce(sum(amount) FILTER (WHERE kind = 'sale'), 0) AS sales, coalesce(sum(amount) FILTER (WHERE kind = 'refund'), 0) AS refunds,
    count(*) FILTER (WHERE kind = 'sale') AS orders, count(*) FILTER (WHERE kind = 'refund') AS refund_count, max(occurred_at) FILTER (WHERE kind = 'sale') AS last_sale_at,
    coalesce(sum(amount) FILTER (WHERE kind = 'sale' AND occurred_at >= now() - interval '30 days'), 0) AS sales_30d,
    coalesce(sum(amount) FILTER (WHERE kind = 'refund' AND occurred_at >= now() - interval '30 days'), 0) AS refunds_30d
  FROM public.revenue_events WHERE connection_id = ANY($1::text[]) GROUP BY connection_id, currency`;

// per-connection totals from the ledger: { revenue:{CUR:net}, sales, refunds, orders, ... } (pure, so tests can feed it rows).
// A source with nothing sold yet is a verified zero in the currency its provider reports.
export function fold(rows, conn, zero = 'USD') {
  const mine = rows.filter((r) => r.connection_id === conn), o = { revenue: {}, sales: {}, refunds: {}, last_30d: {}, orders: 0, refund_count: 0, last_sale_at: null };
  for (const r of mine) {
    o.sales[r.currency] = money(r.sales); o.refunds[r.currency] = money(r.refunds); o.revenue[r.currency] = money(Number(r.sales) - Number(r.refunds));
    o.last_30d[r.currency] = money(Number(r.sales_30d) - Number(r.refunds_30d));
    o.orders += Number(r.orders); o.refund_count += Number(r.refund_count);
    if (r.last_sale_at && (!o.last_sale_at || new Date(r.last_sale_at) > new Date(o.last_sale_at))) o.last_sale_at = r.last_sale_at;
  }
  if (!mine.length) o.revenue = { [zero]: 0 };
  return { ...o, last_sale_at: iso(o.last_sale_at) };
}

const sourcesOf = async (db, only = null) => (await db.query(`SELECT a.connection_id, a.provider, a.external_name, a.account_label, a.secret_ref, a.state, i.house_id
  FROM public.integration_accounts a JOIN public.integrations i ON i.id = a.provider WHERE a.provider = ANY($1::text[]) AND ($2::text IS NULL OR a.connection_id = $2) ORDER BY a.provider, a.connection_id`, [REVENUE, only])).rows;

// rows the connectors return -> exactly what coco_revenue_upsert takes (a refund is a positive amount with kind 'refund'; connectors may sign it)
export function normalise(rows, { provider, connection_id, house_id }) {
  return rows.map((r) => ({ source: r.source || provider, connection_id: r.connection_id || connection_id, house_id: r.house_id ?? house_id ?? null, product_id: r.product_id ?? null,
    occurred_at: iso(r.occurred_at), amount: Math.abs(Number(r.amount)), currency: String(r.currency || '').toUpperCase(), kind: r.kind, external_id: String(r.external_id ?? ''), meta: r.meta && typeof r.meta === 'object' ? r.meta : {} }));
}
const orderedTotal = (rev) => Object.entries(rev || {}).map(([c, n]) => `${c} ${n}`).join(', ') || 'no sales yet';

async function syncOne({ db, who, run, src, f, load, now, cooldownMs, opts }) {
  const P = PROVIDERS[src.provider], conn = src.connection_id;
  const base = { provider: src.provider, connection_id: conn, label: src.account_label || src.external_name || P.label, house_id: src.house_id || null };
  const totals = async () => fold(await run({ sql: SUM_SQL, params: [[conn]] }), conn, P.currency);
  const none = { fetched: 0, inserted: 0, updated: 0 };
  const prev = (await db.query('SELECT state, last_ok_at, last_synced_at, error, records FROM public.revenue_sync WHERE connection_id = $1', [conn])).rows[0] || null;
  const recent = lastSync.get(conn);
  if (recent && now - recent.at < cooldownMs && prev) return { ...base, state: prev.state, cooldown: true, ...(await totals()), fetched: prev.records, inserted: 0, updated: 0, last_ok_at: iso(prev.last_ok_at), error: prev.error };
  const fail = async (why) => {
    await run({ sql: 'SELECT public.coco_revenue_sync_set($1, $2, $3, $4, $5) AS v', params: [conn, src.provider, 'error', why, 0] }).catch(() => {});
    return { ...base, state: 'error', ...(await totals().catch(() => ({ revenue: null, orders: 0 }))), ...none, last_ok_at: iso(prev?.last_ok_at), error: why };
  };
  if (src.state === 'not_connected' || !src.secret_ref || !P.secretShape.test(src.secret_ref)) return { ...base, state: 'not_connected', revenue: null, orders: 0, ...none, last_ok_at: iso(prev?.last_ok_at), error: 'not connected: press Connect first' };
  const mod = await load(src.provider);
  if (!mod) return { ...base, state: 'error', revenue: null, orders: 0, ...none, last_ok_at: iso(prev?.last_ok_at), error: 'connector not installed' };
  let secret = null;
  try {
    secret = await readSecret(db, src.secret_ref).catch(() => null);
    if (!secret) return await fail('the vault holds no credential for this connection: connect it again');
    // a little overlap catches a refund or an edit made after the last look; the ledger upsert makes the repeat harmless
    const after = prev?.last_ok_at ? new Date(new Date(prev.last_ok_at).getTime() - 2 * 86400000).toISOString() : null;
    let got;
    try { got = await P.rows({ mod, secret, after, ctx: { connection_id: conn, house_id: src.house_id || null }, fetch: f, opts }); }
    catch (e) { return await fail(safe(e instanceof Error ? e.message : e, secret)); }
    const clean = normalise(got.rows, { provider: src.provider, connection_id: conn, house_id: src.house_id }); let inserted = 0, updated = 0;
    for (let i = 0; i < clean.length; i += 1000) {
      const r = (await run({ sql: 'SELECT public.coco_revenue_upsert($1::jsonb) AS v', params: [JSON.stringify(clean.slice(i, i + 1000))] }))[0]?.v;
      inserted += Number(r?.inserted || 0); updated += Number(r?.updated || 0);
    }
    // more sales than one read returns: what was read is kept, and the sync says it is not complete instead of calling it done
    if (got.truncated) return await fail(`this account has more sales than one sync can read: the newest ${clean.length} records were saved, older ones are not in the ledger yet`);
    await run({ sql: 'SELECT public.coco_revenue_sync_set($1, $2, $3, $4, $5) AS v', params: [conn, src.provider, 'ok', null, clean.length] });
    const t = await totals();
    await activity(db, who, 'revenue synced', `${P.label} ${conn}: ${clean.length} record(s) read, ${inserted} new, ${updated} updated; ${orderedTotal(t.revenue)}`).catch(() => {});
    lastSync.set(conn, { at: now });
    return { ...base, state: 'ok', ...t, fetched: clean.length, inserted, updated, last_ok_at: new Date().toISOString(), error: null };
  } catch (e) {
    if (NOT_INSTALLED(e)) throw e;
    return await fail(safe(e instanceof Error ? e.message : e, secret));
  } finally { secret = null; }
}

async function revenueSync({ db, who, body, run, f, load, now, cooldownMs, opts }) {
  const only = body.connection_id == null || body.connection_id === '' ? null : String(body.connection_id);
  if (only !== null && !CONN_ID.test(only)) throw new ConnectError(400, 'ERROR', 'which connection?');
  const sources = await sourcesOf(db, only);
  if (only && !sources.length) throw new ConnectError(404, 'ERROR', `${only} is not a revenue source (${REVENUE.join(', ')})`);
  const out = [];
  for (const src of sources) {
    // two presses at once share one sync
    const key = src.connection_id;
    if (!flying.has(key)) flying.set(key, syncOne({ db, who, run, src, f, load, now, cooldownMs, opts }).finally(() => flying.delete(key)));
    out.push(await flying.get(key));
  }
  return { status: 200, body: { ok: out.every((s) => s.state === 'ok'), synced_at: new Date().toISOString(), sources: out } };
}

async function revenueSummary({ db, run }) {
  const accounts = await sourcesOf(db);
  const syncs = (await db.query('SELECT connection_id, state, last_synced_at, last_ok_at, error, records FROM public.revenue_sync')).rows;
  const ledger = accounts.length ? await run({ sql: SUM_SQL, params: [accounts.map((a) => a.connection_id)] }) : [];
  const sources = accounts.map((a) => {
    const s = syncs.find((x) => x.connection_id === a.connection_id) || null, P = PROVIDERS[a.provider], t = fold(ledger, a.connection_id, P.currency);
    return { provider: a.provider, label: P.label, connect: P.connect, connection_id: a.connection_id, account: a.account_label || a.external_name, house_id: a.house_id || null, state: a.state,
      sync: s ? { state: s.state, last_synced_at: iso(s.last_synced_at), last_ok_at: iso(s.last_ok_at), error: s.error, records: s.records } : { state: 'never', last_synced_at: null, last_ok_at: null, error: null, records: 0 },
      // no verified sync yet = no number: a source that was never read is not "0"
      revenue: s && s.last_ok_at ? t.revenue : null, sales: t.sales, refunds: t.refunds, orders: t.orders, refund_count: t.refund_count, last_30d: t.last_30d, last_sale_at: t.last_sale_at };
  });
  // providers nobody has connected yet are listed so the screen can offer Connect
  for (const k of REVENUE) if (!sources.some((s) => s.provider === k)) sources.push({ provider: k, label: PROVIDERS[k].label, connect: PROVIDERS[k].connect, connection_id: null, account: null, house_id: null, state: 'not_connected',
    sync: { state: 'never', last_synced_at: null, last_ok_at: null, error: null, records: 0 }, revenue: null, sales: {}, refunds: {}, orders: 0, refund_count: 0, last_30d: {}, last_sale_at: null });
  const totals = {};
  for (const s of sources) for (const [c, n] of Object.entries(s.revenue || {})) totals[c] = money((totals[c] || 0) + n);
  return { status: 200, body: { ok: true, generated_at: new Date().toISOString(), totals, sources } };
}

// ---------------------------------------------------------------- HTTP (api/_nova.js calls this after it authenticated the device)
// connectorOpts reaches the connectors untouched (their retry / timeout knobs); the tests use it to skip real waiting
export async function handleConnect(db, req, who, deviceKey, { runAs, json, log = () => {}, fetch: f = globalThis.fetch, env = process.env, urls = {}, load = loadConnector, now = Date.now(), cooldownMs = SYNC_COOLDOWN_MS, connectorOpts = {} } = {}) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const run = (stmt) => runAs(db, who, deviceKey, stmt);
  const route = `${req.method} ${req.path}`, opts = connectorOpts;
  try {
    let out;
    if (route === 'POST /api/connect/key') out = await connectKey({ db, who, body, f, load, opts });
    else if (route === 'POST /api/connect/check') out = await connectCheck({ db, who, body, f, env, urls, load, opts });
    else if (route === 'POST /api/revenue/sync') out = await revenueSync({ db, who, body, run, f, load, now, cooldownMs, opts });
    else if (route === 'GET /api/revenue/summary') out = await revenueSummary({ db, run });
    else return json(['/api/connect/key', '/api/connect/check', '/api/revenue/sync', '/api/revenue/summary'].includes(req.path) ? 405 : 404, { ok: false, state: 'ERROR', reason: 'no such route', message: 'no such route' });
    log(out.status, { device: who.device_id, connect: req.path.slice(5) });
    return json(out.status, out.body);
  } catch (e) {
    if (e instanceof ConnectError) { log(e.status, { device: who.device_id, connect: req.path.slice(5), state: e.state }); return json(e.status, { ok: false, state: e.state, reason: e.message, message: e.message, ...e.extra }); }
    if (NOT_INSTALLED(e)) { log(501, { device: who.device_id, connect: req.path.slice(5), state: 'NOT_INSTALLED' }); return json(501, { ok: false, state: 'NOT_INSTALLED', reason: 'the revenue tables are not installed in this database yet (migration 20261112 pending)', message: 'not installed' }); }
    throw e;
  }
}
