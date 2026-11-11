// Automation templates, second layer: references, the publishing gate, statistics, readiness and the channel dashboard.
//
//   references   files go straight to object storage through short-lived signed URLs (Nova never carries a video); the database keeps only
//                metadata. Links are validated (https, no addresses, no credentials). Untrusted by definition: they guide original work.
//   publishing   one decision function: required quality checks must pass, public auto-publishing needs a live authorisation for that exact
//                channel or product, approval and automation are independent switches, and the default is private with approval.
//   statistics   planned vs actual from COCO's own planned work; provider numbers from what the provider reported (yt_stats), labelled as
//                such; anything not collected is said to be missing, never filled in.
//   readiness    what a channel still needs, item by item; "fully ready" is never claimed while a required item is missing.
import * as S from './_template_schema.js';
import { AutError, rows, one, tx, safe, audit, loadTarget, chainOf, brainOf, resolveEffective, getTemplate } from './_template_core.js';
import { localDate } from './_template_schedule.js';

// ---------------------------------------------------------------- what can be created, and what each kind of thing needs
export const PRODUCT_TYPES = {
  youtube_channel: { label: 'YouTube Channel', kind: 'channel', prefix: 'yt', platform_id: 'youtube', preset: 'youtube_channel', provider: 'youtube', needs_account: true },
  gumroad_store: { label: 'Gumroad Store', kind: 'product', prefix: 'gr', platform_id: null, preset: 'gumroad_store', provider: 'gumroad', needs_account: true },
  ebook: { label: 'Ebook', kind: 'product', prefix: 'eb', platform_id: null, preset: 'ebooks', provider: null, needs_account: false },
  comic: { label: 'Comic Series', kind: 'product', prefix: 'cm', platform_id: null, preset: 'comics', provider: null, needs_account: false },
  course: { label: 'Course', kind: 'product', prefix: 'cs', platform_id: null, preset: 'courses', provider: null, needs_account: false },
  software: { label: 'Software Product', kind: 'product', prefix: 'sw', platform_id: null, preset: 'software', provider: null, needs_account: false },
  game: { label: 'Game', kind: 'product', prefix: 'gm', platform_id: null, preset: 'games', provider: null, needs_account: false },
  other: { label: 'Other supported unit', kind: 'product', prefix: 'ot', platform_id: null, preset: 'general_content', provider: null, needs_account: false },
};
// what may be created under which kind of unit: the available choice depends on where the founder is standing
export const CREATABLE = {
  house: { units: ['team', 'subteam'], products: [] }, team: { units: ['subteam'], products: ['channel', 'product'] },
  subteam: { units: ['category'], products: ['channel', 'product'] }, category: { units: [], products: ['channel', 'product'] },
};
export const creatableAt = (kind) => { const c = CREATABLE[kind] || { units: [], products: [] }; return { units: c.units, product_types: Object.entries(PRODUCT_TYPES).filter(([, t]) => c.products.includes(t.kind)).map(([id, t]) => ({ id, label: t.label, needs_account: t.needs_account })) }; };

// ---------------------------------------------------------------- references
const MB = 1024 ** 2;
export const FILE_RULES = {
  image: { max: 25 * MB, types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] }, video: { max: 2048 * MB, types: ['video/mp4', 'video/webm', 'video/quicktime'] },
  audio: { max: 200 * MB, types: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg', 'audio/flac'] }, pdf: { max: 100 * MB, types: ['application/pdf'] },
  text: { max: 5 * MB, types: ['text/plain', 'text/markdown', 'text/csv', 'application/json'] },
};
export const LINK_KINDS = ['website_url', 'youtube_url', 'channel_url', 'product_url'];
export function checkUrl(kind, raw) {
  let u; try { u = new URL(String(raw).trim()); } catch { throw new AutError(422, 'URL', 'that is not a valid link'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') throw new AutError(422, 'URL', 'only https links are accepted');
  if (u.username || u.password) throw new AutError(422, 'URL', 'a link must not carry a username or password');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) throw new AutError(422, 'URL', 'links must point to a public website, not an address or a local name');
  if (kind === 'youtube_url' && !/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) throw new AutError(422, 'URL', 'a YouTube link must be on youtube.com or youtu.be');
  return u.toString().slice(0, 500);
}
const extOf = (name, type) => { const m = String(name).toLowerCase().match(/\.([a-z0-9]{1,6})$/); return m ? `.${m[1]}` : ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'video/mp4': '.mp4', 'application/pdf': '.pdf', 'text/plain': '.txt' }[type] || ''); };
const learnOf = (learn) => {
  const l = [...new Set(Array.isArray(learn) ? learn : [])];
  if (!l.length) throw new AutError(422, 'LEARN', 'say what COCO should learn from this reference');
  if (l.some((g) => !S.LEARN_GOALS.includes(g))) throw new AutError(422, 'LEARN', `learning goals must be among: ${S.LEARN_GOALS.join(', ')}`);
  return l;
};
export async function addReference(db, who, templateId, input = {}, ctx = {}) {
  return tx(db, async () => {
    const t = await one(db, 'SELECT id, status FROM public.automation_templates WHERE id = $1', [templateId]);
    if (!t) throw new AutError(404, 'NO_TEMPLATE', `no template ${templateId}`); if (t.status === 'archived') throw new AutError(409, 'ARCHIVED', 'an archived template takes no references');
    const kind = String(input.kind || ''), learn = learnOf(input.learn), notes = input.notes ? String(input.notes).slice(0, 1000) : null;
    if (LINK_KINDS.includes(kind)) {
      const url = checkUrl(kind, input.url), name = String(input.name || new URL(url).hostname).trim().slice(0, 200);
      const ref = await one(db, `INSERT INTO public.reference_assets (template_id, kind, name, url, status, learn, notes, created_by) VALUES ($1, $2, $3, $4, 'link', $5, $6, $7) RETURNING *`, [templateId, kind, name, url, learn, notes, who.email]);
      await audit(db, who, 'reference', ref.id, 'add', null, { kind, template: templateId }); return { reference: ref };
    }
    const rule = FILE_RULES[kind]; if (!rule) throw new AutError(422, 'KIND', `a reference is one of: ${[...Object.keys(FILE_RULES), ...LINK_KINDS].join(', ')}`);
    const type = String(input.content_type || '').toLowerCase(), bytes = Number(input.bytes), digest = String(input.sha256 || '').toLowerCase(), name = String(input.name || '').trim().slice(0, 200);
    if (!name) throw new AutError(422, 'NAME', 'a file reference needs a name');
    if (!rule.types.includes(type)) throw new AutError(422, 'TYPE', `${kind} references accept: ${rule.types.join(', ')}`);
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > rule.max) throw new AutError(422, 'SIZE', `${kind} references are at most ${Math.round(rule.max / MB)} MB`);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new AutError(422, 'SHA256', 'send the sha256 of the file so the upload can be verified');
    const dup = await one(db, "SELECT * FROM public.reference_assets WHERE template_id = $1 AND sha256 = $2 AND status <> 'removed'", [templateId, digest]);
    if (dup) return { reference: dup, duplicate: true, upload: dup.status === 'pending_upload' && ctx.storage ? upload(ctx.storage, dup) : null };
    if (!ctx.storage) throw new AutError(503, 'STORAGE_NOT_CONFIGURED', 'object storage is not configured for this runtime, so files cannot be uploaded yet; links still work');
    const key = `refs/${templateId}/${digest.slice(0, 12)}${extOf(name, type)}`;
    const ref = await one(db, `INSERT INTO public.reference_assets (template_id, kind, name, content_type, bytes, sha256, storage_bucket, storage_key, status, learn, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_upload', $9, $10, $11) RETURNING *`,
      [templateId, kind, name, type, bytes, digest, ctx.storage.bucket, key, learn, notes, who.email]);
    await audit(db, who, 'reference', ref.id, 'add', null, { kind, template: templateId, bytes });
    return { reference: ref, upload: upload(ctx.storage, ref) };
  });
}
const upload = (storage, ref) => ({ method: 'PUT', url: storage.presign('PUT', ref.storage_key, { expires: 900 }), headers: { 'content-type': ref.content_type, 'x-amz-meta-sha256': ref.sha256 }, expires_in: 900 });
export async function completeReference(db, who, id, ctx = {}) {
  const ref = await one(db, 'SELECT * FROM public.reference_assets WHERE id = $1', [id]);
  if (!ref) throw new AutError(404, 'NO_REFERENCE', `no reference ${id}`);
  if (ref.status === 'stored') return { reference: ref };
  if (ref.status !== 'pending_upload') throw new AutError(409, 'STATE', `the reference is ${ref.status}`);
  if (!ctx.storage) throw new AutError(503, 'STORAGE_NOT_CONFIGURED', 'object storage is not configured');
  const head = await ctx.storage.head(ref.storage_key);
  const bad = !head ? 'the file has not arrived in storage' : Number(head.bytes) !== Number(ref.bytes) ? `the stored size ${head.bytes} differs from the declared ${ref.bytes}` : head.sha256 && head.sha256 !== ref.sha256 ? 'the stored checksum differs from the declared one' : null;
  if (bad) { if (head) await db.query("UPDATE public.reference_assets SET status = 'failed' WHERE id = $1", [id]); throw new AutError(409, 'NOT_UPLOADED', bad); }
  const done = await one(db, "UPDATE public.reference_assets SET status = 'stored' WHERE id = $1 RETURNING *", [id]);
  await audit(db, who, 'reference', id, 'stored', null, { bytes: ref.bytes }); return { reference: done };
}
export async function referenceDownload(db, id, ctx = {}) {
  const ref = await one(db, "SELECT * FROM public.reference_assets WHERE id = $1 AND status = 'stored'", [id]);
  if (!ref) throw new AutError(404, 'NO_REFERENCE', 'no stored reference with that id');
  if (!ctx.storage) throw new AutError(503, 'STORAGE_NOT_CONFIGURED', 'object storage is not configured');
  return { url: ctx.storage.presign('GET', ref.storage_key, { expires: 300 }), expires_in: 300, name: ref.name, content_type: ref.content_type, bytes: Number(ref.bytes), sha256: ref.sha256 };
}
export async function removeReference(db, who, id) {
  const r = await one(db, "UPDATE public.reference_assets SET status = 'removed' WHERE id = $1 AND status <> 'removed' RETURNING id, template_id", [id]);
  if (!r) throw new AutError(404, 'NO_REFERENCE', 'no such reference'); await audit(db, who, 'reference', id, 'remove', null, { note: 'the stored file is kept; storage lifecycle decides its retention' }); return { removed: id };
}
export async function setReferenceLearn(db, who, id, learn) {
  const l = learnOf(learn); const r = await one(db, "UPDATE public.reference_assets SET learn = $2 WHERE id = $1 AND status <> 'removed' RETURNING *", [id, l]);
  if (!r) throw new AutError(404, 'NO_REFERENCE', 'no such reference'); await audit(db, who, 'reference', id, 'learn', null, { learn: l }); return { reference: r };
}

// ---------------------------------------------------------------- publishing: one decision, three independent controls
// stage 'upload' puts a PRIVATE draft on the platform; 'publish' makes something visible. Required quality checks gate both.
export function publishDecision({ settings, qa = {}, authorization = null, stage = 'publish', visibility = null, approvedBy = null, publishedToday = 0 }) {
  const p = settings.publishing, vis = visibility || p.visibility, blockers = [], warnings = [];
  for (const c of S.QA_CHECKS) { const cfg = settings.quality.checks[c]; if (cfg.enabled && cfg.required && qa[c] !== 'pass') blockers.push({ code: `QA_REQUIRED:${c}`, message: `${S.QA_LABEL[c]} is required and ${qa[c] ? `reported "${qa[c]}"` : 'has not been run'}` }); else if (cfg.enabled && qa[c] === 'fail') warnings.push(`${S.QA_LABEL[c]} failed (not required)`); }
  if (!S.VISIBILITIES.includes(vis)) blockers.push({ code: 'VISIBILITY', message: `unknown visibility ${vis}` });
  let mode = 'DRAFT';
  if (stage === 'upload') { if (vis !== 'private') warnings.push('an upload is always a private draft; visibility applies when it is published'); }
  else if (vis !== 'private') {
    const auto = p.auto_publish && !p.founder_approval;
    if (auto) {
      if (!authorization) blockers.push({ code: 'NOT_AUTHORISED', message: 'automatic publishing needs a founder authorisation for this exact channel or product' });
      else if (vis === 'public' && authorization.visibility !== 'public') blockers.push({ code: 'VISIBILITY_NOT_AUTHORISED', message: 'the authorisation covers unlisted publishing only' });
      else if (publishedToday >= authorization.daily_limit) blockers.push({ code: 'DAILY_LIMIT', message: `the daily limit of ${authorization.daily_limit} is reached` });
      else mode = 'AUTO_PUBLISH';
    } else if (!approvedBy) blockers.push({ code: 'NEEDS_APPROVAL', message: 'a founder must approve this item before it is published' });
    else mode = 'PUBLISH_WITH_APPROVAL';
    if (p.auto_publish && p.founder_approval) warnings.push('automatic publishing is on but founder approval is required, so every item waits for approval');
  }
  return { allowed: blockers.length === 0, mode: blockers.length ? null : mode, visibility: vis, blockers, warnings };
}
const targetClause = (t) => (t.type === 'unit' ? ['unit_id', t.id] : ['product_id', t.id]);
export async function liveAuthorization(db, templateId, target) {
  const [col, id] = targetClause(target);
  return one(db, `SELECT id, visibility, daily_limit, authorized_by, authorized_at FROM public.publish_authorizations WHERE template_id = $1 AND ${col} = $2 AND revoked_at IS NULL`, [templateId, id]);
}
export async function authorizeAutoPublish(db, who, templateId, input = {}) {
  return tx(db, async () => {
    const t = await one(db, 'SELECT id, owner_product_id, owner_unit_id, status FROM public.automation_templates WHERE id = $1', [templateId]);
    if (!t) throw new AutError(404, 'NO_TEMPLATE', `no template ${templateId}`);
    const target = await loadTarget(db, input);
    if (target.level !== 'channel' && target.level !== 'product') throw new AutError(422, 'SCOPE', 'public auto-publishing is authorised for one channel or product at a time');
    if (t.owner_product_id !== target.id) throw new AutError(422, 'SCOPE', 'authorise it on that channel\'s own configuration');
    if (!['unlisted', 'public'].includes(input.visibility)) throw new AutError(422, 'VISIBILITY', 'authorise unlisted or public');
    const limit = Number(input.daily_limit); if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AutError(422, 'LIMIT', 'set a daily limit between 1 and 50');
    if (await liveAuthorization(db, templateId, target)) throw new AutError(409, 'ALREADY', 'there is already a live authorisation: revoke it first');
    const a = await one(db, 'INSERT INTO public.publish_authorizations (template_id, product_id, visibility, daily_limit, note, authorized_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [templateId, target.id, input.visibility, limit, input.note || null, who.email]);
    await audit(db, who, 'publish', String(a.id), 'authorise', null, { template: templateId, target: target.id, visibility: input.visibility, daily_limit: limit }); return { authorization: a };
  });
}
export async function revokeAutoPublish(db, who, id) {
  const a = await one(db, 'UPDATE public.publish_authorizations SET revoked_at = now(), revoked_by = $2 WHERE id = $1 AND revoked_at IS NULL RETURNING *', [id, who.email]);
  if (!a) throw new AutError(404, 'NO_AUTHORISATION', 'no live authorisation with that id'); await audit(db, who, 'publish', String(id), 'revoke'); return { authorization: a };
}
export async function publishGate(db, input = {}) {
  const target = await loadTarget(db, input), eff = await resolveEffective(db, target, { statuses: ['active'], allowEmpty: true });
  if (!eff.primary) return { allowed: false, mode: null, blockers: [{ code: 'NO_TEMPLATE', message: 'no active template governs this target' }], warnings: [] };
  const auth = await liveAuthorization(db, eff.primary.template_id, target);
  return { ...publishDecision({ settings: eff.settings, qa: input.qa || {}, authorization: auth, stage: input.stage || 'publish', visibility: input.visibility || null, approvedBy: input.approved_by || null, publishedToday: Number(input.published_today) || 0 }), template_id: eff.primary.template_id, authorised: !!auth };
}

// ---------------------------------------------------------------- statistics
export function rangeOf(key, tz, now = new Date(), from = null, to = null) {
  const today = localDate(now, tz), add = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  if (key === 'today') return { key, from: today, to: today };
  if (key === '7d' || key === '28d' || key === '90d') return { key, from: add(today, 1 - Number(key.slice(0, -1))), to: today };
  if (key === 'month') return { key, from: today.slice(0, 8) + '01', to: today };
  if (key === 'custom') {
    const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
    if (!ok(from) || !ok(to) || to < from || (Date.parse(to) - Date.parse(from)) / 864e5 > 366) throw new AutError(422, 'RANGE', 'a custom range needs a valid from and to date, at most a year apart');
    return { key, from, to };
  }
  throw new AutError(422, 'RANGE', 'range must be today, 7d, 28d, 90d, month or custom');
}
export const YT_LABELS = { views: 'Views', estimatedMinutesWatched: 'Watch time (minutes)', averageViewDuration: 'Average view duration (s)', subscribersGained: 'Subscribers gained', subscribersLost: 'Subscribers lost',
  likes: 'Likes', comments: 'Comments', shares: 'Shares', impressions: 'Impressions', impressionClickThroughRate: 'Click-through rate (%)', averageViewPercentage: 'Retention (average % viewed)', estimatedRevenue: 'Provider-reported revenue',
  subscriberCount: 'Subscribers', viewCount: 'Lifetime views', videoCount: 'Videos' };
export async function getStats(db, input = {}, ctx = {}) {
  const target = await loadTarget(db, input), eff = await resolveEffective(db, target, { statuses: ['draft', 'active', 'paused'], allowEmpty: true }), tz = eff.settings.basics.timezone;
  const range = rangeOf(input.range || '28d', tz, ctx.now || new Date(), input.from, input.to);
  const clause = target.type === 'product' ? 'w.product_id = $1' : `(w.unit_id IN (SELECT id FROM d) OR w.product_id IN (SELECT p.id FROM public.org_products p WHERE p.unit_id IN (SELECT id FROM d)))`;
  const raw = await rows(db, `WITH RECURSIVE d AS (SELECT id FROM public.org_units WHERE id = $1 UNION ALL SELECT u.id FROM public.org_units u JOIN d ON u.parent_id = d.id)
    SELECT w.deliverable, w.status, count(*)::int AS n FROM public.planned_work w WHERE ${clause} AND w.local_date BETWEEN $2::date AND $3::date GROUP BY 1, 2`, [target.id, range.from, range.to]);
  const by = {}; for (const r of raw) (by[r.deliverable] ??= { deliverable: r.deliverable, planned: 0, created: 0, pending: 0, failed: 0, cancelled: 0 })[{ done: 'created', failed: 'failed', cancelled: 'cancelled' }[r.status] || 'pending'] += r.n;
  for (const d of Object.values(by)) d.planned = d.created + d.pending + d.failed;
  const out = { target: { type: target.type, id: target.id, name: target.name }, range, production: { source: 'COCO planned work', rows: Object.values(by), uploaded_published_scheduled: { available: false, reason: 'not collected yet: it needs the upload and publish steps to report back; the provider-reported figures below are real' } },
    youtube: null, gumroad: null, missing: [] };
  const conn = eff.settings.integrations.connection_id;
  if (conn) {
    const acc = (await safe(db, 'SELECT provider FROM public.integration_accounts WHERE connection_id = $1', [conn], []))[0];
    if (acc?.provider === 'youtube') {
      const ch = await safe(db, `SELECT DISTINCT ON (source, window_days) source, window_days, day, at, metrics FROM public.yt_stats WHERE connection_id = $1 AND video_id IS NULL ORDER BY source, window_days, at DESC`, [conn], []);
      const vids = await safe(db, `SELECT kind, privacy, count(*)::int AS n FROM (SELECT DISTINCT ON (video_id) video_id, kind, privacy, published_at FROM public.yt_stats WHERE connection_id = $1 AND video_id IS NOT NULL ORDER BY video_id, at DESC) v
        WHERE (published_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date GROUP BY 1, 2`, [conn, range.from, range.to, tz], []);
      const windows = {}, present = new Set();
      for (const r of ch) { const m = r.metrics || {}; for (const k of Object.keys(m)) present.add(k); windows[r.window_days == null ? 'lifetime' : `${r.window_days}d`] = { source: r.source, collected_at: r.at, metrics: m }; }
      out.youtube = { provider_reported: true, connection_id: conn, source: 'YouTube Data and Analytics APIs, collected by the daily cloud job (yt_stats)', collected: ch.length > 0, windows, labels: YT_LABELS,
        videos_published_in_range: { total: vids.reduce((s, v) => s + v.n, 0), by_kind: Object.fromEntries(vids.map((v) => [v.kind, 0]).map(([k]) => [k, vids.filter((v) => v.kind === k).reduce((s, v) => s + v.n, 0)])), by_privacy: Object.fromEntries([...new Set(vids.map((v) => v.privacy || 'unknown'))].map((p) => [p, vids.filter((v) => (v.privacy || 'unknown') === p).reduce((s, v) => s + v.n, 0)])) } };
      for (const k of ['views', 'estimatedMinutesWatched', 'averageViewDuration', 'subscribersGained', 'subscribersLost', 'impressions', 'impressionClickThroughRate', 'averageViewPercentage', 'estimatedRevenue']) if (!present.has(k)) out.missing.push(`youtube.${k}`);
    } else if (acc?.provider === 'gumroad') {
      try { out.gumroad = ctx.gumroad ? { provider_reported: true, connection_id: conn, ...(await ctx.gumroad(conn)) } : { available: false, reason: 'the Gumroad numbers are read live through /api/publish/stats' }; }
      catch (e) { out.gumroad = { available: false, reason: String(e?.message || e).slice(0, 200) }; }
    }
  } else out.missing.push('no connected account: provider statistics need one');
  out.estimates = { note: 'COCO makes no estimates of provider numbers. Anything not listed above has not been collected.' };
  return out;
}

// ---------------------------------------------------------------- readiness: what a channel still needs, item by item
export async function readinessOf(db, productId) {
  const target = await loadTarget(db, { product_id: productId });
  if (target.type !== 'product') throw new AutError(422, 'TARGET', 'readiness is for a channel or product');
  const prod = await one(db, 'SELECT id, kind, name, platform_id, external_ref, source, status, meta FROM public.org_products WHERE id = $1', [productId]);
  const type = PRODUCT_TYPES[prod.meta?.product_type] || null, needsAccount = !!type?.needs_account;
  const own = await one(db, "SELECT id, name, status, current_version FROM public.automation_templates WHERE owner_product_id = $1 AND status <> 'archived' ORDER BY created_at DESC LIMIT 1", [productId]);
  const asg = own ? await one(db, "SELECT id FROM public.automation_assignments WHERE template_id = $1 AND product_id = $2 AND status = 'active'", [own.id, productId]) : null;
  const prompt = own ? await one(db, 'SELECT id, status, active_version, current_version FROM public.prompt_records WHERE template_id = $1', [own.id]) : null;
  const brain = await brainOf(db, { type: 'product', id: productId });
  const eff = await resolveEffective(db, target, { statuses: ['draft', 'active', 'paused'], allowEmpty: true }), st = eff.settings;
  const conn = st.integrations.connection_id ? (await safe(db, 'SELECT connection_id, provider, state, external_id, last_verified_at FROM public.integration_accounts WHERE connection_id = $1', [st.integrations.connection_id], []))[0] : null;
  const connected = !!conn && conn.state === 'connected' && !!conn.last_verified_at && (!prod.external_ref || prod.external_ref === conn.external_id);
  const refs = own ? (await one(db, "SELECT count(*)::int AS n FROM public.reference_assets WHERE template_id = $1 AND status IN ('stored', 'link')", [own.id])).n : 0;
  const auth = own ? await liveAuthorization(db, own.id, target) : null;
  const promptReady = !!(prompt && prompt.status === 'active' && prompt.active_version);
  const items = [
    { id: 'organisation', label: 'Organisational record', state: 'created', ok: true, required: true },
    { id: 'template', label: 'Template', state: asg ? 'assigned' : 'missing', ok: !!asg, required: true, detail: own ? `${own.name} v${own.current_version} (${own.status})` : 'no configuration is assigned' },
    { id: 'prompt', label: 'Prompt', state: promptReady ? 'ready' : prompt ? 'needs_activation' : 'missing', ok: promptReady, required: true, detail: prompt ? `v${prompt.active_version || prompt.current_version} (${prompt.status})` : 'no prompt' },
    { id: 'brain', label: 'Brain', state: brain ? 'assigned' : 'missing', ok: !!brain, required: true, detail: brain ? `${brain.id} (${brain.state})` : 'no Brain' },
    { id: 'account', label: 'Account', state: connected ? 'connected' : 'not_connected', ok: connected, required: needsAccount, detail: conn ? `${conn.connection_id}: ${conn.state}${conn.last_verified_at ? ', verified' : ', not verified'}` : needsAccount ? 'connect it from Integrations after the real account exists' : 'this kind of product needs no connected account' },
    { id: 'references', label: 'References', state: refs ? 'available' : 'none', ok: refs > 0, required: false, detail: refs ? `${refs} ready` : 'none yet (optional)' },
  ];
  const missing = items.filter((i) => i.required && !i.ok).map((i) => i.id);
  const active = own?.status === 'active';
  const production = { state: !active ? 'not_activated' : missing.length ? 'blocked' : 'ready', can_activate: !!asg && promptReady, blockers: missing };
  const publishing = { state: auth && st.publishing.auto_publish && !st.publishing.founder_approval ? 'authorized' : 'approval_required', visibility: st.publishing.visibility, auto_publish: st.publishing.auto_publish, founder_approval: st.publishing.founder_approval, authorisation: auth };
  items.push({ id: 'production', label: 'Production', state: production.state, ok: production.state === 'ready', required: false, detail: production.state === 'not_activated' ? 'production has not been activated' : production.blockers.join(', ') });
  items.push({ id: 'publishing', label: 'Publishing', state: publishing.state, ok: true, required: false, detail: `${publishing.visibility}${publishing.auto_publish ? ', automatic' : ''}${publishing.founder_approval ? ', founder approval required' : ''}` });
  return { product: { id: prod.id, name: prod.name, kind: prod.kind, source: prod.source, external_ref: prod.external_ref }, items, fully_ready: missing.length === 0, missing, production, publishing, template_id: own?.id || null };
}

export async function productDashboard(db, productId, ctx = {}) {
  const target = await loadTarget(db, { product_id: productId }), readiness = await readinessOf(db, productId), chain = await chainOf(db, target);
  const own = readiness.template_id ? await getTemplate(db, readiness.template_id) : null;
  const eff = await resolveEffective(db, target, { statuses: ['draft', 'active', 'paused'], allowEmpty: true });
  const brain = await brainOf(db, { type: 'product', id: productId }), parent = brain?.parent_brain_id ? await one(db, 'SELECT id, level, state FROM public.org_brains WHERE id = $1', [brain.parent_brain_id]) : null;
  const conn = eff.settings.integrations.connection_id ? (await safe(db, 'SELECT connection_id, provider, state, external_id, external_name, permissions, last_verified_at FROM public.integration_accounts WHERE connection_id = $1', [eff.settings.integrations.connection_id], []))[0] : null;
  const hub = conn ? (await safe(db, 'SELECT scopes, token_expires_at, refresh_state, last_success_at, last_error FROM public.integration_accounts WHERE connection_id = $1', [conn.connection_id], []))[0] : null;
  const planned = own ? await rows(db, `SELECT id, deliverable, to_char(local_date, 'YYYY-MM-DD') AS local_date, seq, planned_for, status FROM public.planned_work WHERE template_id = $1 AND product_id = $2 AND status IN ('planned', 'queued', 'running') ORDER BY planned_for LIMIT 20`, [own.template.id, productId]) : [];
  const ids = [productId, own?.template.id, own?.prompt?.id, ...(own?.assignments || []).map((a) => a.id)].filter(Boolean);
  const activity = await rows(db, 'SELECT at, actor, entity, entity_id, action, version FROM public.automation_events WHERE entity_id = ANY($1::text[]) ORDER BY id DESC LIMIT 60', [ids]);
  return {
    overview: { product: readiness.product, path: chain.map((c) => ({ id: c.id, kind: c.kind, name: c.name })), readiness: { items: readiness.items, fully_ready: readiness.fully_ready, missing: readiness.missing }, production: readiness.production, publishing: readiness.publishing },
    template: own && { template: own.template, versions: own.versions, assignments: own.assignments, effective: { settings: eff.settings, provenance: eff.provenance, layers: eff.layers } },
    prompt: own?.prompt || null, brain: brain && { id: brain.id, level: brain.level, state: brain.state, parent: parent, policies: brain.policies, objectives: brain.objectives }, agents: own?.agents || [],
    integration: conn ? { ...conn, ...(hub || {}), external_id_masked: conn.external_id ? `${String(conn.external_id).slice(0, 6)}…${String(conn.external_id).slice(-4)}` : null, external_id: undefined } : { state: 'not_connected' },
    references: own?.references || [], production_settings: eff.settings, scheduler: { upcoming: planned, policy: 'work becomes a job only while the template is active AND the scheduler policy is on' },
    statistics: await getStats(db, { product_id: productId, range: '28d' }, ctx), activity,
  };
}
