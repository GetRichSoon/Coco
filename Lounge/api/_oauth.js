// Nova's OAuth: the connect flow for every platform that signs in through a consent screen (YouTube, Gumroad).
//
// It replaces three Supabase-specific pieces with provider-independent code:
//   SQL coco_oauth_begin()                 read the client id from Supabase Vault inside SQL     -> begin()
//   Edge Functions youtube-oauth/gumroad-oauth  /callback (and YouTube /verify)                  -> callback() / verify()
// Credentials go through Nova's vault (api/_vault.js): the portable Coco vault, or today's Supabase Vault until it is moved.
// Nothing here prints, logs or returns a credential, and no page ever receives one.
//
// Routes (api/_nova.js):
//   POST /api/oauth/begin              founder on a paired device  { provider, connection_id, team?, subteam? } -> { authorize_url, state, redirect_uri }
//   GET  /api/oauth/<provider>/callback  the provider redirects the founder's BROWSER here: no device key; the one-time state is the gate
//   POST /api/oauth/verify             founder on a paired device  { connection_id } -> a real check against the platform
//
// The redirect URI is fixed by COCO_PUBLIC_URL, never taken from a request, and must be registered once in each provider's console:
//   <COCO_PUBLIC_URL>/api/oauth/youtube/callback        <COCO_PUBLIC_URL>/api/oauth/gumroad/callback
import { randomBytes } from 'node:crypto';
import { createVault, legacySupabase } from './_vault.js';
import { ACCESS_POLICY } from './_access_policy.js';
import { redact, maskId } from './_publish.js';

export class OauthError extends Error { constructor(status, message) { super(message); this.status = status; } }

const CONN_ID = /^[a-z0-9][a-z0-9._-]{1,60}$/;
const PLACE = /^[a-z0-9][a-z0-9/_.-]{0,80}$/;
const slug = (c) => String(c).replace(/[^a-z0-9]/g, '_');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (v, ...secrets) => redact(String(v ?? ''), ...secrets).slice(0, 400);
const CONSUMERS = ['nova.publish', 'nova.oauth'];

// What the cloud must be ALLOWED TO DO, not which scope strings it was given: Google has several scopes that grant the same
// thing, so a list of required names reports a false failure.
const CAN = {
  'upload a video': ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'],
  'make a video public or delete it': ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.force-ssl'],
};
export const missingScopes = (granted) => { const have = new Set(String(granted || '').split(/\s+/).filter(Boolean)); return Object.entries(CAN).filter(([, any]) => !any.some((s) => have.has(s))).map(([job]) => job); };

export const PROVIDERS = {
  youtube: {
    name: 'YouTube', authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', api: 'https://www.googleapis.com/youtube/v3',
    // `youtube` is upload + manage; yt-analytics.readonly is this channel's own reports, read only. Nothing else.
    scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/yt-analytics.readonly',
    extra: { access_type: 'offline', prompt: 'consent' },
    secretName: (c) => `youtube_refresh_token_${slug(c)}`, secretShape: /^youtube_refresh_token_[a-z0-9_]+$/,
  },
  gumroad: {
    name: 'Gumroad', authorize: 'https://gumroad.com/oauth/authorize', token: 'https://api.gumroad.com/oauth/token', api: 'https://api.gumroad.com',
    // view_sales is what GET /v2/sales needs: without it the revenue sync is refused with insufficient_scope
    scope: 'edit_products view_profile view_sales', extra: {},
    secretName: (c) => `gumroad_access_token_${slug(c)}`, secretShape: /^gumroad_access_token_[a-z0-9_]+$/,
  },
};
export const urlsOf = (provider, over = {}) => ({ authorize: PROVIDERS[provider].authorize, token: PROVIDERS[provider].token, api: PROVIDERS[provider].api, ...(over[provider] || {}) });
export const publicUrl = (env = process.env) => String(env.COCO_PUBLIC_URL || 'https://cocolounge.vercel.app').replace(/\/+$/, '');
export const redirectUri = (provider, env) => `${publicUrl(env)}/api/oauth/${provider}/callback`;
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

// ---------------------------------------------------------------- the page the founder lands on (every dynamic value escaped)
export function page(status, title, lines) {
  const part = (p) => (typeof p === 'string' ? esc(p) : p.code !== undefined ? `<code>${esc(p.code)}</code>` : `<b>${esc(p.b)}</b>`);
  const body = lines.map((l) => `<p>${[].concat(l).map(part).join('')}</p>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<style>:root{color-scheme:light dark}body{font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px;background:#faf7f5;color:#20201e}
@media (prefers-color-scheme:dark){body{background:#17181a;color:#e8e6e3}}main{max-width:34rem;background:#fff;border-radius:18px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 12px 32px rgba(0,0,0,.06)}
@media (prefers-color-scheme:dark){main{background:#212326;box-shadow:none}}h1{font-size:1.4rem;margin:0 0 .6em}.m{font-size:2rem;line-height:1;margin:0 0 .4em}p{margin:.5em 0}code{background:#0001;padding:.1em .4em;border-radius:6px;font-size:.9em}</style></head>
<body><main><p class="m">${status === 200 ? '&#10003;' : '&#10005;'}</p><h1>${esc(title)}</h1>${body}<p style="opacity:.6;font-size:.85em">You can close this tab. Nothing secret is shown on this page, and nothing secret was sent to your browser.</p></main></body></html>`;
  return { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }, body: html };
}

// 0041 added fields to integration_accounts and 0035 a health table; before they are applied these statements are skipped, not fatal
const hub = (db, sql, params) => db.query(sql, params).catch((e) => { if (e && (e.code === '42703' || e.code === '42P01')) return null; throw e; });
const activity = (db, actor, action, detail) => db.query('INSERT INTO public.activity (actor, action, detail) VALUES ($1, $2, $3)', [actor, action, String(detail).slice(0, 1500)]);
const vaultOf = (db, { env, actor }) => createVault(db, { env, actor, legacy: legacySupabase(db) });

// ---------------------------------------------------------------- talking to the platforms
async function ytWhoami(f, api, token) {
  const res = await f(`${api}/channels?part=snippet,contentDetails,status&mine=true`, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`youtube refused the credential (${res.status}): ${safe(text, token)}`), { denied: true });
  if (!res.ok) throw new Error(`youtube returned ${res.status}: ${safe(text, token)}`);
  let item = null; try { item = JSON.parse(text)?.items?.[0] || null; } catch { /* handled below */ }
  if (!item) throw new Error('that Google account has no YouTube channel to authorise. On the chooser, pick the brand channel itself, not the signing-in account.');
  return { id: String(item.id), title: String(item.snippet?.title ?? ''), handle: String(item.snippet?.customUrl ?? '') || null, avatar: String(item.snippet?.thumbnails?.default?.url ?? '') || null };
}
async function ytAccess(f, token, client, refresh) {
  const res = await f(token, { method: 'POST', headers: FORM, body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, refresh_token: refresh, grant_type: 'refresh_token' }) });
  const text = await res.text();
  // invalid_grant = revoked, expired or password-changed: a reconnect, not a retry
  if (!res.ok) throw Object.assign(new Error(`google refused the refresh (${res.status}): ${safe(text, refresh, client.client_secret)}`), { expired: /invalid_grant/.test(text) });
  let tok = null; try { tok = JSON.parse(text); } catch { /* handled below */ }
  if (!tok?.access_token) throw new Error('google returned no access token');
  return { token: tok.access_token, scope: String(tok.scope ?? '') };
}
export async function gumUser(f, api, token) {
  const res = await f(`${api}/v2/user`, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`gumroad refused the credential (${res.status})`), { denied: true });
  if (!res.ok) throw new Error(`the credential could not read the Gumroad account (${res.status})`);
  try { return JSON.parse(text)?.user ?? {}; } catch { throw new Error('gumroad returned something that is not JSON'); }
}

// ---------------------------------------------------------------- begin
export async function begin(db, who, body, { env = process.env, vault = null } = {}) {
  const provider = String(body?.provider || ''), conn = String(body?.connection_id || ''), P = PROVIDERS[provider];
  if (!P) throw new OauthError(400, `no connection flow is built for ${provider || 'null'}`);
  if (!CONN_ID.test(conn)) throw new OauthError(400, 'a connection id must be lower case letters, digits, dot, dash, underscore');
  const team = body?.team ? String(body.team) : null, subteam = body?.subteam ? String(body.subteam) : null;
  if ((team && !PLACE.test(team)) || (subteam && !PLACE.test(subteam))) throw new OauthError(400, 'team and sub-team must be company ids');
  // connecting a platform is a founder's act at a founder's device; a worker never starts one
  if (ACCESS_POLICY.workflow_devices.includes(who.device_id)) throw new OauthError(403, 'a cloud worker cannot start a connection; a founder does that from Coco');
  const v = vault || vaultOf(db, { env, actor: who.device_id });
  // today's vault answers a missing client with a database exception: that is a 409 the founder can act on, not a crash
  const client = await v.client(provider).catch((e) => { if (e && e.code === 'P0001') throw new OauthError(409, `${provider} client credentials are not in the vault yet: store the OAuth client before connecting`); throw e; });
  if (!client?.client_id) throw new OauthError(409, `${provider}_client_id is not in the vault yet: store the OAuth client before connecting`);
  const state = randomBytes(32).toString('base64url'), redirect = redirectUri(provider, env);
  await db.query('INSERT INTO public.oauth_states (state, provider, connection_id, team_id, subteam_id, requested_by, scope) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [state, provider, conn, team, subteam, who.email, P.scope]);
  await db.query('INSERT INTO public.activity (actor, device_id, action, detail) VALUES ($1, $2, $3, $4)',
    [who.email, who.device_id, 'platform connection started', `${provider}: a one-time authorization was begun for connection ${conn}`]);
  const q = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', scope: P.scope, state, ...P.extra });
  return { ok: true, state, expires_in_seconds: 600, redirect_uri: redirect, authorize_url: `${P.authorize}?${q}` };
}

// ---------------------------------------------------------------- callback
export async function callback(db, provider, query, { fetch: f = globalThis.fetch, env = process.env, urls = {}, vault = null } = {}) {
  const P = PROVIDERS[provider], U = urlsOf(provider, urls);
  const q = (k) => { const v = query?.[k]; return typeof v === 'string' && v.length <= 2048 ? v : ''; };
  if (q('error')) return page(400, 'Authorization was declined', [[`${P.name} reported: `, { code: safe(q('error')) }, '.'], 'Nothing was stored and nothing changed. You can start again from Coco whenever you like.']);
  const code = q('code'), state = q('state');
  if (!code || !state) return page(400, 'That link is incomplete', ['The authorization code or the state was missing, so there is nothing to verify.', 'Start the connection again from Coco rather than reusing this address.']);

  // the gate: a conditional update IS the check (unused, unexpired, right provider, exactly once)
  const claimed = (await db.query(`UPDATE public.oauth_states SET used_at = now() WHERE state = $1 AND provider = $2 AND used_at IS NULL AND expires_at > now()
    RETURNING connection_id, team_id, subteam_id, requested_by, scope`, [state, provider])).rows[0];
  if (!claimed) return page(400, 'That authorization is no longer valid', ['The state did not match a pending connection, or it had already been used, or it expired.', 'Each authorization works exactly once and lasts ten minutes, on purpose.', 'Start again from Coco.']);

  const finish = (result) => db.query('UPDATE public.oauth_states SET used_result = $2 WHERE state = $1', [state, String(result).slice(0, 300)]).catch(() => {});
  const conn = String(claimed.connection_id), v = vault || vaultOf(db, { env, actor: 'oauth-callback' });
  try {
    const client = await v.client(provider);
    if (!client?.client_id) throw new Error(`${provider} client credentials are not in the vault`);
    const res = await f(U.token, { method: 'POST', headers: FORM, body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, code, grant_type: 'authorization_code', redirect_uri: redirectUri(provider, env) }) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${P.name} refused the exchange (${res.status}): ${safe(text, client.client_secret, code)}`);
    let tok = null; try { tok = JSON.parse(text); } catch { /* handled below */ }
    if (!tok?.access_token) throw new Error(`${P.name} returned no access token`);
    const out = provider === 'youtube' ? await connectYoutube({ db, v, f, U, tok, conn, claimed }) : await connectGumroad({ db, v, f, U, tok, conn, claimed });
    await finish(out.result);
    return page(out.ok === false ? 400 : 200, out.title, out.lines);
  } catch (e) {
    const why = safe(e instanceof Error ? e.message : e);
    await finish(`failed: ${why}`);
    await activity(db, claimed.requested_by, 'platform connection failed', `${P.name} (${conn}): ${why}`).catch(() => {});
    return page(400, 'That did not complete', [['What went wrong: ', { code: why }], 'Nothing partial was left connected, and no credential was stored. Start again from Coco once the cause is dealt with.']);
  }
}

async function connectYoutube({ db, v, f, U, tok, conn, claimed }) {
  // Without a refresh token the credential dies in an hour and the cloud is back to needing a person: refused, not stored.
  if (!tok.refresh_token) throw new Error("Google issued no refresh token, so this would stop working in an hour. Revoke Coco's access at myaccount.google.com/permissions and connect again.");
  const who = await ytWhoami(f, U.api, tok.access_token), lacking = missingScopes(tok.scope), scopes = String(tok.scope ?? '').split(/\s+/).filter(Boolean);
  // the guard: never rebind a connection to a different channel, and one channel belongs to one connection
  const row = (await db.query('SELECT connection_id, external_id, external_name, secret_ref FROM public.integration_accounts WHERE connection_id = $1', [conn])).rows[0];
  if (row?.external_id && row.external_id !== who.id) throw new Error(`this connection is ${row.external_name ?? conn} (channel ${maskId(row.external_id)}), but you authorised ${who.title} (channel ${maskId(who.id)}). Nothing was stored. Start again and pick ${row.external_name ?? conn} on Google's chooser.`);
  const clash = (await db.query("SELECT connection_id, external_name FROM public.integration_accounts WHERE provider = 'youtube' AND external_id = $1 AND connection_id <> $2 LIMIT 1", [who.id, conn])).rows[0];
  if (clash) throw new Error(`${who.title} is already connected in Coco as "${clash.external_name ?? clash.connection_id}". One channel belongs to one connection, so nothing was stored. Reconnect that one instead.`);

  const name = PROVIDERS.youtube.secretName(conn);
  await v.put(name, tok.refresh_token, { consumers: CONSUMERS, op: row?.secret_ref === name ? 'rotate' : 'create' });
  await db.query("UPDATE public.integrations SET auth_method = $1, last_check_at = now(), last_ok_at = now(), updated_at = now() WHERE id = 'youtube'",
    ['OAuth 2.0 per channel; refresh token in the Coco vault, read server-side only']);
  // secret_ref is a NAME. The row says WHERE the credential is, never what it is. Not assigned here: where an account publishes is a founder's choice.
  await db.query(`INSERT INTO public.integration_accounts (connection_id, provider, external_id, external_name, external_handle, avatar_url, secret_ref, state, permissions, connected_at, last_verified_at, note, updated_at, updated_by)
    VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, $8, now(), now(), $9, now(), $10)
    ON CONFLICT (connection_id) DO UPDATE SET provider = 'youtube', external_id = EXCLUDED.external_id, external_name = EXCLUDED.external_name, external_handle = EXCLUDED.external_handle,
      avatar_url = EXCLUDED.avatar_url, secret_ref = EXCLUDED.secret_ref, state = EXCLUDED.state, permissions = EXCLUDED.permissions, connected_at = EXCLUDED.connected_at,
      last_verified_at = EXCLUDED.last_verified_at, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
    [conn, who.id, who.title || row?.external_name || conn, who.handle, who.avatar, name, lacking.length ? 'partial' : 'connected', scopes,
      'connected through Nova OAuth; channel identity confirmed by channels.list(mine=true). Not assigned: assign it in Coco before anything publishes.', claimed.requested_by]);
  await hub(db, 'UPDATE public.integration_accounts SET scopes = $2, refresh_state = $3, last_refresh_at = now(), last_success_at = now(), last_error = NULL, token_expires_at = NULL, reconnect_steps = $4 WHERE connection_id = $1',
    [conn, scopes, 'ok', `Press Connect in Coco and choose ${who.title || conn} on Google's chooser.`]);
  await activity(db, claimed.requested_by, 'platform connected',
    `YouTube: connection ${conn} authorised and confirmed as "${who.title}" (channel ${maskId(who.id)}). The refresh token is in the vault under a name only the server side can read. It is NOT assigned to a team yet, so nothing can publish with it.${lacking.length ? ` It cannot ${lacking.join(', nor ')}.` : ''}`);
  return { ok: !lacking.length, result: lacking.length ? 'connected (missing permission)' : 'connected', title: `${who.title || 'That channel'} is connected`, lines: [
    ['Confirmed from the cloud as ', { code: who.title }, who.handle ? [' (', { code: who.handle }, ')'] : '', ', channel ', { code: maskId(who.id) }, '.'].flat(),
    'The authorization is stored encrypted in the Coco vault. Coco can use this channel with your PC switched off.',
    lacking.length ? `It cannot ${lacking.join(', nor ')}. That will fail at the moment it matters, so connect again and approve everything Google asks for.` : 'It can upload, and it can make a video public or delete it.',
    ['It is ', { b: 'not assigned' }, ' yet. In Coco, open Integrations, then YouTube, and press Assign, or nothing will publish with it.'] ] };
}

async function connectGumroad({ db, v, f, U, tok, conn, claimed }) {
  const user = await gumUser(f, U.api, tok.access_token);
  const name = PROVIDERS.gumroad.secretName(conn), scopes = String(claimed.scope ?? '').split(/\s+/).filter(Boolean);
  const had = (await db.query('SELECT secret_ref FROM public.integration_accounts WHERE connection_id = $1', [conn])).rows[0];
  // one Gumroad account belongs to one connection (the revenue ledger keeps a sale under one connection only)
  const clash = String(user.user_id ?? user.id ?? '') && (await db.query("SELECT connection_id, external_name FROM public.integration_accounts WHERE provider = 'gumroad' AND external_id = $1 AND connection_id <> $2 LIMIT 1", [String(user.user_id ?? user.id), conn])).rows[0];
  if (clash) throw new Error(`that Gumroad account is already connected in Coco as "${clash.external_name}" (${clash.connection_id}). One account belongs to one connection, so nothing was stored. Reconnect that one instead.`);
  // Gumroad hands the same token back until the application is revoked by hand. Compare BEFORE overwriting: an unchanged token
  // means an exposed one is still live, so the alert about it must stay.
  const same = had?.secret_ref === name && (await v.secret(name, 'nova.oauth').catch(() => null)) === tok.access_token;
  await v.put(name, tok.access_token, { consumers: CONSUMERS, op: had?.secret_ref === name ? 'rotate' : 'create' });
  if (tok.refresh_token) await v.put(name.replace('_access_token_', '_refresh_token_'), tok.refresh_token, { consumers: ['nova.oauth'], op: 'rotate' });
  const label = user.email ?? user.name ?? conn;
  await db.query(`INSERT INTO public.integrations (id, house_id, platform, account, state, auth_method, capabilities, last_check_at, last_ok_at, error, next_action, updated_at)
    VALUES ('gumroad', 'poppy', 'Gumroad', $1, 'connected', $2, $3, now(), now(), NULL, NULL, now())
    ON CONFLICT (id) DO UPDATE SET house_id = EXCLUDED.house_id, platform = EXCLUDED.platform, account = EXCLUDED.account, state = EXCLUDED.state, auth_method = EXCLUDED.auth_method,
      capabilities = EXCLUDED.capabilities, last_check_at = EXCLUDED.last_check_at, last_ok_at = EXCLUDED.last_ok_at, error = NULL, next_action = NULL, updated_at = EXCLUDED.updated_at`,
    [label, 'OAuth 2.0; token in the Coco vault, read server-side only', ['create_product', 'upload_file', 'publish', 'categories', 'sales']]);
  await db.query(`INSERT INTO public.integration_accounts (connection_id, provider, external_id, external_name, external_handle, account_label, secret_ref, state, permissions, connected_at, last_verified_at, note, updated_at, updated_by)
    VALUES ($1, 'gumroad', $2, $3, $4, $5, $6, 'connected', $7, now(), now(), $8, now(), $9)
    ON CONFLICT (connection_id) DO UPDATE SET provider = 'gumroad', external_id = EXCLUDED.external_id, external_name = EXCLUDED.external_name, external_handle = EXCLUDED.external_handle,
      account_label = EXCLUDED.account_label, secret_ref = EXCLUDED.secret_ref, state = 'connected', permissions = EXCLUDED.permissions, connected_at = EXCLUDED.connected_at,
      last_verified_at = EXCLUDED.last_verified_at, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
    [conn, String(user.user_id ?? user.id ?? ''), user.name ?? null, user.url ?? null, label, name, scopes, 'connected through Nova OAuth; verified against GET /v2/user', claimed.requested_by]);
  await hub(db, 'UPDATE public.integration_accounts SET scopes = $2, refresh_state = $3, last_refresh_at = now(), last_success_at = now(), last_error = NULL, token_expires_at = NULL, reconnect_steps = $4 WHERE connection_id = $1',
    [conn, scopes, tok.refresh_token ? 'ok' : 'not_applicable', 'Press Connect in Coco and approve the Gumroad application.']);
  if (claimed.team_id) {
    await db.query(`INSERT INTO public.integration_links (integration_id, connection_id, team_id, subteam_id, permissions, enabled, created_by, updated_by, note)
      SELECT 'gumroad', $1, $2, $3, $4, true, $5, $5, 'assigned at connection time'
      WHERE NOT EXISTS (SELECT 1 FROM public.integration_links WHERE integration_id = 'gumroad' AND connection_id = $1 AND team_id = $2 AND coalesce(subteam_id, '') = coalesce($3, ''))`,
      [conn, claimed.team_id, claimed.subteam_id, scopes, claimed.requested_by]);
  }
  // a rotated token settles the old "this token was exposed" alert on the legacy row of this connection (gumroad-<connection>); an unchanged one does not
  if (!same) await db.query("UPDATE public.integrations SET state = 'connected', error = NULL, next_action = NULL, last_check_at = now(), last_ok_at = now(), updated_at = now() WHERE id = $1", ['gumroad-' + conn]);
  await activity(db, claimed.requested_by, 'platform connected',
    `Gumroad: connection ${conn} verified as ${label}${claimed.team_id ? ` and assigned to ${claimed.subteam_id ?? claimed.team_id}` : ''}.${same ? ' Gumroad returned the SAME access token as before.' : ''} The credential is in the vault under a name only the publishing worker can read. Publishing stays in PUBLISH_WITH_APPROVAL.`);
  return { result: same ? 'connected (same token)' : 'connected', title: 'Gumroad is connected', lines: [['Signed in as ', { code: label }, ', and verified from the cloud.'],
    'The credential is stored encrypted in the Coco vault. Coco can now use this connection with your PC switched off.',
    ...(same ? ['Gumroad gave back the same access token as before. If that token was ever exposed it is still live: in Gumroad open Settings, Advanced, Applications, revoke this application, then press Connect in Coco again to get a new one.'] : []),
    ['Publishing remains in ', { code: 'PUBLISH_WITH_APPROVAL' }, ': nothing goes on sale without you saying yes to that title.']] };
}

// ---------------------------------------------------------------- verify (a real check against the platform)
const HEALTH = { CONNECTED_VERIFIED: 'CONNECTED_AND_VERIFIED', NOT_ASSIGNED: 'CONNECTED_AND_VERIFIED', CONNECTED_EXPIRED: 'EXPIRED', CONNECTED_WRONG_CHANNEL: 'INVALID',
  CONNECTED_MISSING_PERMISSION: 'INSUFFICIENT_PERMISSION', NOT_CONNECTED: 'NOT_CONFIGURED', ERROR: 'CONNECTED_BUT_FAILING' };

export async function verify(db, who, body, { fetch: f = globalThis.fetch, env = process.env, urls = {}, vault = null } = {}) {
  const conn = String(body?.connection_id || '');
  if (!CONN_ID.test(conn)) throw new OauthError(400, 'which connection?');
  const acc = (await db.query('SELECT connection_id, provider, external_id, external_name, secret_ref, state FROM public.integration_accounts WHERE connection_id = $1', [conn])).rows[0];
  if (!acc) throw new OauthError(404, `no connection ${conn}`);
  const P = PROVIDERS[acc.provider];
  if (!P) return { status: 'CANNOT_CHECK', detail: `no cloud check is built for ${acc.provider} yet`, connection_id: conn };
  const links = (await db.query('SELECT team_id, subteam_id, category_id, channel_id FROM public.integration_links WHERE connection_id = $1 AND enabled IS NOT FALSE', [conn])).rows;
  const U = urlsOf(acc.provider, urls), v = vault || vaultOf(db, { env, actor: who?.device_id || 'oauth-verify' });

  const record = async (status, detail, extra = {}) => {
    const good = status === 'CONNECTED_VERIFIED' || status === 'NOT_ASSIGNED';
    // a check of something that was never connected does not turn "not connected" into "error"
    await db.query(`UPDATE public.integration_accounts SET state = CASE WHEN $2 THEN 'connected' WHEN state = 'not_connected' AND $3 = 'NOT_CONNECTED' THEN state ELSE 'error' END, ${good ? 'last_verified_at = now(),' : ''} updated_at = now() WHERE connection_id = $1`, [conn, good, status]);
    await hub(db, 'UPDATE public.integration_accounts SET last_error = $2, last_success_at = CASE WHEN $3 THEN now() ELSE last_success_at END, refresh_state = CASE WHEN $4 THEN \'revoked\' ELSE refresh_state END WHERE connection_id = $1',
      [conn, good ? null : String(detail).slice(0, 300), good, status === 'CONNECTED_EXPIRED']);
    await hub(db, `INSERT INTO public.integration_health (id, integration_id, account_id, status, detail, run_label) VALUES ($1, $2, $3, $4, $5, 'oauth-verify') ON CONFLICT (id) DO NOTHING`,
      [`oauth-${Date.now().toString(36)}:${acc.provider}/${conn}`, acc.provider, conn, HEALTH[status] || 'UNKNOWN', String(detail).slice(0, 300)]);
    await activity(db, 'coco-verify', 'connection verified', `${P.name} ${conn}: ${status} - ${detail}`);
    return { status, detail, connection_id: conn, assigned: links.length > 0, ...extra };
  };

  // a credential that is a path on somebody's laptop is not a cloud credential
  if (!acc.secret_ref || !P.secretShape.test(acc.secret_ref)) {
    return record('NOT_CONNECTED', acc.secret_ref
      ? `its credential is recorded as "${acc.secret_ref}", which is a file on a PC, not a cloud credential. Press Connect to authorise it so the cloud can use it.`
      : 'no credential is recorded for this connection. Press Connect to authorise it.');
  }
  let secret = null;
  try { secret = await v.secret(acc.secret_ref, 'nova.oauth'); } catch (e) { return record('NOT_CONNECTED', `the credential could not be read: ${safe(e instanceof Error ? e.message : e)}`); }
  if (!secret) return record('NOT_CONNECTED', 'the vault holds nothing under that name. Press Connect to authorise it.');
  try {
    if (acc.provider === 'gumroad') {
      const user = await gumUser(f, U.api, secret), id = String(user.user_id ?? user.id ?? '');
      if (acc.external_id && id && acc.external_id !== id) return record('CONNECTED_WRONG_CHANNEL', `this connection is recorded as ${acc.external_name} but the stored credential belongs to a different Gumroad account. Nothing may publish with it until it is reconnected.`);
      return record(links.length ? 'CONNECTED_VERIFIED' : 'NOT_ASSIGNED', `${user.email ?? user.name ?? 'the account'} answered from the cloud${links.length ? ` and it is assigned to ${links.map((l) => l.subteam_id || l.team_id).join(', ')}` : ', but it is not assigned to a team, so no run can choose it. Press Assign'}.`);
    }
    const client = await v.client('youtube');
    if (!client?.client_id) throw new Error('youtube client credentials are not in the vault');
    const { token, scope } = await ytAccess(f, U.token, client, secret), who2 = await ytWhoami(f, U.api, token), lacking = missingScopes(scope), ch = { channel: who2.title, channel_id_masked: maskId(who2.id) };
    if (acc.external_id && acc.external_id !== who2.id) return record('CONNECTED_WRONG_CHANNEL', `this connection is recorded as ${acc.external_name} (channel ${maskId(acc.external_id)}), but the stored credential belongs to ${who2.title} (channel ${maskId(who2.id)}). Nothing may publish with it until it is reconnected to the right channel.`, ch);
    if (lacking.length) return record('CONNECTED_MISSING_PERMISSION', `${who2.title} answered, but this authorization cannot ${lacking.join(', nor ')}. Connect again and approve everything Google asks for.`, ch);
    if (!links.length) return record('NOT_ASSIGNED', `${who2.title} is connected and verified from the cloud, but it is not assigned to a team, so no run can choose it. Press Assign.`, ch);
    return record('CONNECTED_VERIFIED', `${who2.title} answered from the cloud, it can upload and manage videos, and it is assigned to ${links.map((l) => l.channel_id || l.category_id || l.subteam_id || l.team_id).join(', ')}.`, ch);
  } catch (e) {
    if (e.expired || e.denied) return record('CONNECTED_EXPIRED', `${P.name} no longer accepts the stored authorization: it was revoked, or the account password changed. Press Connect to authorise it again.`);
    return record('ERROR', safe(e instanceof Error ? e.message : e));
  } finally { secret = null; }
}

// ---------------------------------------------------------------- HTTP (api/_nova.js calls these)
export async function handleAuthed(db, req, who, { json, fetch: f, env = process.env, urls = {}, vault = null } = {}) {
  if (req.method !== 'POST') return json(405, { ok: false, status: 'ERROR', detail: 'the oauth routes are POST' });
  try {
    if (req.path === '/api/oauth/begin') return json(200, await begin(db, who, req.body || {}, { env, vault }));
    if (req.path === '/api/oauth/verify') return json(200, await verify(db, who, req.body || {}, { fetch: f, env, urls, vault }));
  } catch (e) {
    if (e instanceof OauthError) return json(e.status, { ok: false, status: 'ERROR', detail: e.message, reason: e.message });
    throw e;
  }
  return json(404, { message: 'no such oauth route' });
}
