// The universal publishing layer. Every team publishes through here, whatever the platform:
//
//   COCO app / chat -> cloud worker (a paired device, with the engine key) -> Nova -> platform adapter -> provider
//
// Nova is the only place a platform credential is read (from the Coco vault, through the same
// engine-gated SQL functions the hosted gateway used) and the only place a provider is called with
// it. A worker never sees a refresh token or an API token: an adapter either does the whole publish
// here (transport "nova": small files, metadata, product listings) or hands the worker a short-lived
// access token for one account and lets the worker move the big bytes (transport "worker": video).
// Everything a caller gets back is safe metadata: ok, state, platform, account, external id, url,
// status, a redacted provider reason. Nothing here prints, stores or returns a credential.
//
// Routes (all need a paired device key AND a live engine key; the engine key is verified in Postgres):
//   GET  /api/publish/platforms         what Nova can publish to, and how
//   POST /api/publish/token             { platform, connection_id }  -> a one-hour provider token for a worker-transport adapter
//   POST /api/publish                   { platform, team, subteam?, category?, channel?, connection_id?, idempotency_key, mode,
//                                         approved_by?, run_id?, artifact: { url, sha256?, name? }, listing, artwork? }
//
// Modes are the company's own words (PREPARE_ONLY, DRAFT, PUBLISH_WITH_APPROVAL, AUTO_PUBLISH); nothing is
// public without a named approver, and the provider's answer, not the request's intent, is what is recorded.
import { createHash } from 'node:crypto';

export const MODES = ['PREPARE_ONLY', 'DRAFT', 'PUBLISH_WITH_APPROVAL', 'AUTO_PUBLISH'];
export class PublishError extends Error { constructor(status, state, reason, extra = {}) { super(reason); this.status = status; this.state = state; this.extra = extra; } }

// A provider error body is the classic place a credential leaks into a log or a reply.
export const redact = (text, ...secrets) => {
  let s = String(text ?? '');
  for (const k of secrets) if (k && String(k).length >= 6) s = s.split(String(k)).join('[redacted]');
  return s.replace(/("?(?:access_token|refresh_token|id_token|client_secret|token|api_key|secret|password|authorization)"?\s*[:=]\s*"?)[^"&\s,}]{6,}/gi, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/g, 'Bearer [redacted]');
};
export const maskId = (id) => !id ? '' : String(id).length <= 10 ? String(id) : `${String(id).slice(0, 6)}…${String(id).slice(-4)}`;
export function wantsPublic({ mode = 'PUBLISH_WITH_APPROVAL', approvedBy = null, autoPublishAllowed = false } = {}) {
  const m = String(mode || '').toUpperCase();
  if (!MODES.includes(m)) return false;
  if (m === 'PREPARE_ONLY' || m === 'DRAFT') return false;
  if (m === 'PUBLISH_WITH_APPROVAL') return Boolean(approvedBy);
  if (m === 'AUTO_PUBLISH') return autoPublishAllowed === true;
  return false;
}
const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

// ---------------------------------------------------------------- the company's own answers (SQL, never REST)
// `sql` runs as the founder-claimed session with the engine header set (RLS and the engine-gated
// functions see exactly what PostgREST would have shown them); `raw` runs as Nova's own role for the
// reads the hosted callback did as the admin client.
export function company(db, who, deviceKey, engineKey, runAs) {
  const sql = async (text, params = []) => runAs(db, who, deviceKey, { sql: text, params }, engineKey);
  return {
    async engineOk() { const r = await sql('SELECT public.coco_engine_ok() AS ok'); return r[0]?.ok === true; },
    async account(connectionId) {
      const r = await db.query('SELECT connection_id, provider, external_id, external_name, external_handle, account_label, secret_ref, state, permissions FROM public.integration_accounts WHERE connection_id = $1', [connectionId]);
      return r.rows[0] || null;
    },
    async target({ provider, team, subteam = null, category = null, channel = null }) {
      const r = await sql('SELECT public.coco_publish_target($1, $2, $3, $4, $5) AS v', [provider, team, subteam, category, channel]);
      const v = r[0]?.v; return v && v.connection_id ? v : null;
    },
    // audited by name inside the function; the value lives in one variable and is dropped by the caller
    async secret(name) { const r = await sql('SELECT public.coco_publish_secret($1) AS v', [name]); return typeof r[0]?.v === 'string' && r[0].v ? r[0].v : null; },
    async client(provider) { const r = await db.query('SELECT public.coco_oauth_client($1) AS v', [provider]); return r.rows[0]?.v || null; },
    async existing(idempotencyKey) {
      const r = await db.query("SELECT id, status, external_id, url, at, meta FROM public.outputs WHERE meta ->> 'idempotency_key' = $1 ORDER BY at DESC LIMIT 1", [idempotencyKey]);
      return r.rows[0] || null;
    },
    async record(row) {
      const id = row.id || `OUT-${new Date().toISOString().slice(0, 10)}-${createHash('sha256').update(JSON.stringify([row.meta?.idempotency_key, row.external_id, Date.now()])).digest('hex').slice(0, 8)}`;
      await db.query('INSERT INTO public.outputs (id, team_id, subteam_id, category_id, channel_id, run_id, kind, title, status, external_id, url, created_by, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        [id, row.team_id || null, row.subteam_id || null, row.category_id || null, row.channel_id || null, row.run_id || null, row.kind || 'file', row.title || '', row.status || 'created', row.external_id || null, row.url || null, 'nova-publisher', JSON.stringify(row.meta || {})]);
      return id;
    },
    async note(action, detail) { await db.query('INSERT INTO public.activity (actor, device_id, action, detail) VALUES ($1, $2, $3, $4)', ['nova-publisher', who?.device_id || null, action, String(detail).slice(0, 1500)]); },
    async accountState(connectionId, state) { await db.query('UPDATE public.integration_accounts SET state = $2, updated_at = now(), updated_by = $3 WHERE connection_id = $1', [connectionId, state, 'nova-publisher']); },
  };
}

// ---------------------------------------------------------------- YouTube (transport: worker)
// The worker moves the video; Nova mints the one-hour token for exactly one account, after proving the
// credential belongs to the channel the company says it is. Same contract as the hosted token route.
const YT = { token: 'https://oauth2.googleapis.com/token', api: 'https://www.googleapis.com/youtube/v3' };
const CAN = { upload: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.force-ssl'],
  'make a video public': ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.force-ssl'] };
const missingScopes = (granted) => { const have = new Set(String(granted || '').split(/\s+/).filter(Boolean)); return Object.entries(CAN).filter(([, any]) => !any.some((s) => have.has(s))).map(([job]) => job); };

async function youtubeToken({ co, account, fetch: f, urls = YT }) {
  if (account.provider !== 'youtube') throw new PublishError(400, 'ERROR', `${account.connection_id} is not a YouTube connection`);
  if (account.state === 'paused') throw new PublishError(409, 'PAUSED', `${account.external_name} is paused in Coco`);
  if (!account.secret_ref || !/^youtube_refresh_token_[a-z0-9_]+$/.test(account.secret_ref)) throw new PublishError(409, 'NOT_CONNECTED', `${account.external_name} has no cloud credential. Connect it in Coco first.`);
  let refresh = await co.secret(account.secret_ref);
  if (!refresh) throw new PublishError(409, 'NOT_CONNECTED', 'the vault holds nothing under that name');
  const client = await co.client('youtube');
  if (!client?.client_id) throw new PublishError(503, 'NOT_CONNECTED', 'the YouTube client credentials are not in the vault');
  try {
    const res = await f(urls.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, refresh_token: refresh, grant_type: 'refresh_token' }) });
    const text = await res.text();
    if (!res.ok) {
      if (/invalid_grant/.test(text)) { await co.accountState(account.connection_id, 'error'); throw new PublishError(409, 'EXPIRED', `Google no longer accepts ${account.external_name}'s authorization. Reconnect it in Coco.`); }
      throw new PublishError(502, 'PROVIDER_ERROR', `google refused the refresh (${res.status}): ${redact(text, refresh, client.client_secret).slice(0, 200)}`);
    }
    const tok = parseJson(text);
    if (!tok?.access_token) throw new PublishError(502, 'PROVIDER_ERROR', 'google returned no access token');
    const me = await f(`${urls.api}/channels?part=snippet&mine=true`, { headers: { authorization: `Bearer ${tok.access_token}` } });
    const mt = await me.text();
    if (me.status === 401 || me.status === 403) { await co.accountState(account.connection_id, 'error'); throw new PublishError(409, 'EXPIRED', `YouTube refused ${account.external_name}'s credential (${me.status}). Reconnect it in Coco.`); }
    if (!me.ok) throw new PublishError(502, 'PROVIDER_ERROR', `youtube returned ${me.status}: ${redact(mt, tok.access_token).slice(0, 200)}`);
    const item = parseJson(mt)?.items?.[0];
    if (!item) throw new PublishError(409, 'NOT_CONNECTED', 'that Google account has no YouTube channel');
    const who = { id: String(item.id), title: String(item.snippet?.title ?? ''), handle: String(item.snippet?.customUrl ?? '') || null };
    if (account.external_id && account.external_id !== who.id) {
      await co.accountState(account.connection_id, 'error');
      await co.note('publish refused', `YouTube ${account.connection_id}: recorded as ${account.external_name} (channel ${maskId(account.external_id)}) but its credential belongs to ${who.title} (channel ${maskId(who.id)}). No token was issued.`);
      throw new PublishError(409, 'WRONG_CHANNEL', `${account.connection_id} is recorded as ${account.external_name} (channel ${maskId(account.external_id)}) but its credential belongs to ${who.title} (channel ${maskId(who.id)}). No token was issued.`);
    }
    const lacking = missingScopes(tok.scope);
    if (lacking.length) throw new PublishError(409, 'MISSING_PERMISSION', `${who.title}'s authorization cannot ${lacking.join(', nor ')}.`);
    await co.note('publish token issued', `YouTube ${account.connection_id}: a one-hour access token was issued through Nova to a cloud worker for "${who.title}" (channel ${maskId(who.id)}). The refresh token did not leave the cloud.`);
    return { state: 'OK', connection_id: account.connection_id, access_token: tok.access_token, expires_in: 3500, channel_id: who.id, channel_title: who.title, channel_handle: who.handle, scopes: String(tok.scope || '').split(/\s+/).filter(Boolean) };
  } finally { refresh = null; }
}

// ---------------------------------------------------------------- Gumroad (transport: nova)
// Ported from the company's publisher (scripts/publish/gumroad.mjs), verified against Gumroad's own
// routes: the file goes up first so a product is never created empty; `draft` is always explicit; the
// provider's answer is read back; artwork replaces, never appends.
const GUMROAD_TAG_MAX = 19;
export function gumroadTags(listing) {
  const chosen = (listing.tags_by_platform || {}).gumroad;
  const source = Array.isArray(chosen) && chosen.length ? chosen : (listing.keywords || []);
  const seen = new Set(), out = [];
  for (const raw of source) { const t = String(raw || '').trim().toLowerCase(); if (!t || t.length > GUMROAD_TAG_MAX || seen.has(t)) continue; seen.add(t); out.push(t); if (out.length === 10) break; }
  return out;
}
export function productPayload(listing, { mode, approvedBy, autoPublishAllowed } = {}) {
  const pub = wantsPublic({ mode, approvedBy, autoPublishAllowed });
  if (!listing || !listing.title) throw new PublishError(400, 'PUBLISH_FAILED', 'a Gumroad product needs a title');
  const perStore = (listing.price_by_platform || {}).gumroad;
  const price = Number(perStore ?? listing.price_usd);
  if (!Number.isFinite(price) || price <= 0) throw new PublishError(400, 'PUBLISH_FAILED', 'a Gumroad product needs a price above zero');
  return { name: listing.title, description: listing.description || listing.subtitle || '', price: Math.round(price * 100), native_type: 'ebook', draft: !pub, published: pub, tags: gumroadTags(listing), custom_permalink: listing.slug };
}
const RETRY_ON = [500, 502, 503, 504], MAX_ATTEMPTS = 3;
function gumroadClient(f, api, tok) {
  const call = async (method, pathname, body, attempt = 1) => {
    let res;
    try { res = await f(`${api}/v2${pathname}`, { method, headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { if (attempt < MAX_ATTEMPTS) return call(method, pathname, body, attempt + 1); throw new PublishError(502, 'PROVIDER_ERROR', `Gumroad could not be reached after ${attempt} attempts: ${redact(e.message, tok)}`, { attempts: attempt }); }
    if (RETRY_ON.includes(res.status) && attempt < MAX_ATTEMPTS) return call(method, pathname, body, attempt + 1);
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new PublishError(409, 'REAUTH_REQUIRED', `Gumroad refused the credential (${res.status}). Reconnect it in Coco.`, { attempts: attempt });
    if (res.status === 429) throw new PublishError(429, 'RATE_LIMITED', `Gumroad rate-limited this account after ${attempt} attempts`, { attempts: attempt });
    if (!res.ok) throw new PublishError(502, 'PROVIDER_ERROR', `Gumroad returned ${res.status}: ${redact(text, tok).slice(0, 300)}`, { attempts: attempt });
    const json = parseJson(text);
    if (json && json.success === false) throw new PublishError(409, 'PUBLISH_FAILED', `Gumroad refused it: ${redact(json.message || 'no reason given', tok)}`, { attempts: attempt });
    return { json, attempts: attempt };
  };
  return { call };
}
async function fetchBytes(f, url, { sha256 = null, name = 'file' } = {}) {
  const res = await f(url);
  if (!res.ok) throw new PublishError(409, 'UPLOAD_FAILED', `the artifact ${name} could not be fetched (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new PublishError(409, 'UPLOAD_FAILED', `the artifact ${name} is empty`);
  const got = createHash('sha256').update(bytes).digest('hex');
  if (sha256 && got !== sha256) throw new PublishError(409, 'UPLOAD_FAILED', `the artifact ${name} does not match the approved sha256`);
  return { bytes, sha256: got };
}
async function gumroadUploadFile(gr, f, bytes, name) {
  const pre = await gr.call('POST', '/files/presign', { filename: name, file_size: bytes.length });
  const { upload_id: uploadId, key, file_url: fileUrl, parts } = pre.json || {};
  if (!uploadId || !key || !Array.isArray(parts) || !parts.length) throw new PublishError(502, 'UPLOAD_FAILED', `Gumroad did not return a usable upload for ${name}`);
  const PART = 100 * 1024 * 1024;
  try {
    const done = [];
    for (const part of parts) {
      const n = part.part_number;
      const put = await f(part.presigned_url, { method: 'PUT', body: bytes.subarray((n - 1) * PART, n * PART) });
      if (!put.ok) throw new Error(`S3 refused part ${n} (${put.status})`);
      const etag = put.headers.get('etag'); if (!etag) throw new Error(`S3 returned no ETag for part ${n}`);
      done.push({ part_number: n, etag });
    }
    const fin = await gr.call('POST', '/files/complete', { upload_id: uploadId, key, parts: done });
    const url = (fin.json || {}).file_url || fileUrl;
    if (!url) throw new Error('Gumroad completed the upload but returned no file URL');
    return { url, bytes: bytes.length, name };
  } catch (e) {
    try { await gr.call('POST', '/files/abort', { upload_id: uploadId, key }); } catch { /* best effort */ }
    if (e instanceof PublishError) throw e;
    throw new PublishError(502, 'UPLOAD_FAILED', `uploading ${name} failed: ${e.message}`);
  }
}
async function gumroadUploadImage(gr, f, bytes, name, { purpose = null } = {}) {
  const ext = name.toLowerCase().split('.').pop();
  const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  const checksum = createHash('md5').update(bytes).digest('base64');
  const pre = await gr.call('POST', `/direct_uploads${purpose ? `?purpose=${purpose}` : ''}`, { blob: { filename: name, byte_size: bytes.length, checksum, content_type: contentType } });
  const blob = pre.json || {}; const up = blob.direct_upload || {};
  if (!blob.signed_id || !up.url) throw new PublishError(502, 'UPLOAD_FAILED', `Gumroad did not return a direct upload for ${name}`);
  const put = await f(up.url, { method: 'PUT', headers: up.headers || {}, body: bytes });
  if (!put.ok) throw new PublishError(502, 'UPLOAD_FAILED', `storage refused ${name} (${put.status})`);
  return { signed_blob_id: blob.signed_id, bytes: bytes.length, name };
}
async function gumroadPublish({ co, account, body, who, fetch: f, api = 'https://api.gumroad.com' }) {
  if (account.provider !== 'gumroad') throw new PublishError(400, 'ERROR', `${account.connection_id} is not a Gumroad connection`);
  if (account.state !== 'connected') throw new PublishError(409, 'NOT_CONNECTED', `${account.connection_id} is ${account.state} in Coco`);
  const listing = body.listing || {};
  if (listing.ready_for_upload === false) throw new PublishError(409, 'UPLOAD_FAILED', `${listing.slug || 'the title'} is not ready to upload: ${(listing.problems || listing.blocking || []).join('; ')}`);
  const mode = String(body.mode || 'PUBLISH_WITH_APPROVAL').toUpperCase();
  if (!MODES.includes(mode)) throw new PublishError(400, 'PUBLISH_FAILED', `unknown publishing mode "${body.mode}"`);
  const approvedBy = body.approved_by || null, wantPublic = wantsPublic({ mode, approvedBy, autoPublishAllowed: false });
  const payload = productPayload(listing, { mode, approvedBy, autoPublishAllowed: false });
  const base = { platform: 'gumroad', account: account.external_handle || account.external_name, connection_id: account.connection_id, slug: listing.slug, title: listing.title, mode, approved_by: approvedBy, run_id: body.run_id || null };
  if (mode === 'PREPARE_ONLY') return { ok: true, state: 'READY', ...base, published: false, would_send: { ...payload }, note: 'PREPARE_ONLY: nothing was sent to Gumroad' };
  if (mode === 'PUBLISH_WITH_APPROVAL' && !approvedBy) return { ok: false, state: 'READY', ...base, needs_approval: true, published: false, reason: `${listing.title} waits for a founder YES before anything is created on Gumroad` };
  if (mode === 'AUTO_PUBLISH') throw new PublishError(409, 'PUBLISH_FAILED', 'AUTO_PUBLISH is not enabled for Gumroad');
  if (!body.artifact?.url) throw new PublishError(400, 'UPLOAD_FAILED', 'a Gumroad publish needs artifact.url (the built EPUB)');
  let tok = await co.secret(String(account.secret_ref || '').replace(/^vault:/, ''));
  if (!tok) throw new PublishError(409, 'NOT_CONNECTED', 'the vault holds no Gumroad credential for this connection');
  try {
    const gr = gumroadClient(f, api, tok);
    const file = await fetchBytes(f, body.artifact.url, { sha256: body.artifact.sha256 || null, name: body.artifact.name || `${listing.slug}.epub` });
    const up = await gumroadUploadFile(gr, f, file.bytes, body.artifact.name || `${listing.slug}.epub`);
    const created = await gr.call('POST', '/products', { ...payload, files: [{ url: up.url }] });
    const product = (created.json && (created.json.product || created.json)) || {};
    const isPublic = product.published === true;
    const result = { ...base, external_id: product.id || null, url: product.short_url || null, uploaded_bytes: up.bytes, artifact_sha256: file.sha256, attempts: created.attempts };
    if (!wantPublic && isPublic) {
      let undone = false; try { await gr.call('PUT', `/products/${product.id}/disable`); undone = true; } catch { /* reported */ }
      return { ok: false, state: 'PUBLISH_FAILED', ...result, published: false, disabled_again: undone, reason: `Gumroad published this although draft=true was sent.${undone ? ' It has been disabled again.' : ' It could NOT be disabled again.'}` };
    }
    const artwork = { cover: null, thumbnail: null };
    if (product.id && body.artwork?.cover_url) {
      try {
        const img = await fetchBytes(f, body.artwork.cover_url, { name: 'cover' });
        const cv = await gumroadUploadImage(gr, f, img.bytes, body.artwork.cover_name || 'cover.jpg');
        const r = await gr.call('POST', `/products/${encodeURIComponent(product.id)}/covers`, { signed_blob_id: cv.signed_blob_id });
        artwork.cover = { bytes: cv.bytes, covers: ((r.json || {}).covers || []).length };
      } catch (e) { artwork.cover = { error: redact(e.message, tok).slice(0, 200) }; }
    }
    if (product.id && body.artwork?.thumbnail_url) {
      try {
        const img = await fetchBytes(f, body.artwork.thumbnail_url, { name: 'thumbnail' });
        const th = await gumroadUploadImage(gr, f, img.bytes, body.artwork.thumbnail_name || 'cover-thumb.jpg', { purpose: 'media' });
        const r = await gr.call('POST', `/products/${encodeURIComponent(product.id)}/thumbnail`, { signed_blob_id: th.signed_blob_id });
        artwork.thumbnail = { bytes: th.bytes, url: ((r.json || {}).thumbnail || {}).url || null };
      } catch (e) { artwork.thumbnail = { error: redact(e.message, tok).slice(0, 200) }; }
    }
    return { ok: true, state: isPublic ? 'PUBLISHED' : 'READY', ...result, published: isPublic, artwork, note: isPublic ? 'Gumroad confirmed this is published' : (wantPublic ? `Gumroad created it but did not publish it: ${(created.json || {}).warning || 'no reason given'}` : 'created on Gumroad as an unpublished draft') };
  } finally { tok = null; }
}

export const ADAPTERS = {
  youtube: { transport: 'worker', what: 'a one-hour access token for one verified channel; the worker uploads the video and records the result', token: youtubeToken },
  gumroad: { transport: 'nova', what: 'the product, its file and its artwork are created here from artifact links; the provider answer is recorded', publish: gumroadPublish },
};

// ---------------------------------------------------------------- the entry point
export async function handlePublish(db, req, who, deviceKey, { runAs, fetch: f = globalThis.fetch, json, log, urls = {} }) {
  const engineKey = String(req.headers['x-engine-key'] || '');
  const co = company(db, who, deviceKey, engineKey, runAs);
  const safeErr = (e, extra = {}) => e instanceof PublishError ? json(e.status, { ok: false, state: e.state, reason: redact(e.message), ...e.extra, ...extra }) : json(502, { ok: false, state: 'PROVIDER_ERROR', reason: redact(e?.message || String(e)).slice(0, 300), ...extra });
  if (req.path === '/api/publish/platforms' && req.method === 'GET') return json(200, { platforms: Object.fromEntries(Object.entries(ADAPTERS).map(([k, a]) => [k, { transport: a.transport, what: a.what }])) });
  if (req.method !== 'POST') return json(405, { message: 'publishing is POST' });
  if (!engineKey || !(await co.engineOk().catch(() => false))) { log(403, { device: who.device_id, publish: 'refused', why: 'no live engine key' }); return json(403, { ok: false, state: 'AUTH_REQUIRED', reason: 'publishing needs the cloud runtime (a live engine key) on a paired device' }); }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  let platform = String(body.platform || '').toLowerCase();
  try {
    // which account: the one named (its provider then names the platform, as the existing publishers only
    // send a connection id to the token route), or the one the company's resolver assigns to this team/channel
    let account = null;
    if (body.connection_id) { account = await co.account(String(body.connection_id)); if (account && !platform) platform = String(account.provider || '').toLowerCase(); }
    const adapter = ADAPTERS[platform];
    if (!adapter) return json(400, { ok: false, state: 'ERROR', reason: `no publisher for "${platform}" (${Object.keys(ADAPTERS).join(', ')})` });
    if (!account && body.team) { const t = await co.target({ provider: platform, team: body.team, subteam: body.subteam || null, category: body.category || null, channel: body.channel || null }); account = t ? await co.account(t.connection_id) : null; }
    if (!account) return json(404, { ok: false, state: 'NOT_ASSIGNED', reason: body.connection_id ? `no connection ${body.connection_id}` : `no ${platform} account is assigned to ${[body.team, body.subteam, body.category, body.channel].filter(Boolean).join(' > ') || 'anything'}. Assign one in Coco under Integrations; nothing is guessed.` });
    if (req.path === '/api/publish/token') {
      if (!adapter.token) return json(400, { ok: false, state: 'ERROR', reason: `${platform} publishes through Nova itself; it issues no worker token` });
      const r = await adapter.token({ co, account, fetch: f, urls: urls[platform] });
      log(200, { device: who.device_id, publish: 'token', platform, account: account.connection_id }); return json(200, r);
    }
    if (req.path !== '/api/publish') return json(404, { message: 'not found' });
    if (!adapter.publish) return json(400, { ok: false, state: 'ERROR', reason: `${platform} is a worker-transport platform: ask /api/publish/token, upload from the worker, record the output` });
    const key = String(body.idempotency_key || '');
    if (!key) return json(400, { ok: false, state: 'ERROR', reason: 'a publish needs an idempotency_key' });
    const prior = await co.existing(key);
    if (prior && prior.external_id) { log(200, { device: who.device_id, publish: 'duplicate', platform, key }); return json(200, { ok: true, state: 'DUPLICATE', platform, duplicate_of: prior.id, external_id: prior.external_id, url: prior.url, status: prior.status, reason: 'this idempotency key already produced a product; nothing was sent again' }); }
    const r = await adapter.publish({ co, account, body, who, fetch: f, api: urls[platform] });
    if (r.external_id) {
      const outputId = await co.record({ team_id: body.team || null, subteam_id: body.subteam || null, category_id: body.category || null, channel_id: body.channel || null, run_id: body.run_id || null, kind: body.kind || 'ebook', title: r.title || '', status: r.published ? 'published' : 'draft', external_id: r.external_id, url: r.url,
        meta: { idempotency_key: key, platform, connection_id: account.connection_id, mode: r.mode, approved_by: r.approved_by || null, provider_state: r.state, artifact_sha256: r.artifact_sha256 || null, artwork: r.artwork || null, published_via: 'nova', at: new Date().toISOString() } });
      r.output_id = outputId;
      await co.note(r.published ? 'product published' : 'product created', `${platform} ${account.connection_id}: "${r.title}" is ${r.state} as ${r.external_id}${r.url ? ` (${r.url})` : ''}. Mode ${r.mode}${r.approved_by ? `, approved by ${r.approved_by}` : ''}. Through Nova; run ${body.run_id || 'none'}.`);
    }
    log(r.ok ? 200 : 409, { device: who.device_id, publish: platform, state: r.state, external_id: r.external_id || null });
    return json(r.ok ? 200 : 409, r);
  } catch (e) {
    log(e instanceof PublishError ? e.status : 502, { device: who.device_id, publish: platform, error: redact(e.message).slice(0, 160) });
    return safeErr(e, { platform });
  }
}
