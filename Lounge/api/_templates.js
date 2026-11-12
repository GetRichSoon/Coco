// Nova's HTTP door for the Universal Automation Templates: /api/automation/*. The desktop app and the phone/PWA call exactly these routes, so
// both see the same templates, prompts, references, schedules and approvals; there is no second system for mobile.
//
// Who may call what: every route needs a paired device (checked by Nova before this file runs). Changing anything needs a FOUNDER's device;
// the paired cloud worker may only read what it needs to run a job and report back (prepare and record an execution, the effective
// configuration, the publish gate). A route that needs the AI or storage says so plainly when that is not configured.
import { ACCESS_POLICY } from './_access_policy.js';
import * as S from './_template_schema.js';
import { presetSummary } from './_template_presets.js';
import * as C from './_template_core.js';
import * as O from './_template_ops.js';
import * as W from './_template_onboarding.js';
import { storageFromEnv } from './_storage.js';
import { generateText } from './_ai.js';
import { createVault } from './_vault.js';

const ROUTES = [];
const route = (method, pattern, fn, opts = {}) => ROUTES.push([method, new RegExp(`^/api/automation${pattern}$`), fn, opts]);
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const target = (q) => ({ unit_id: q.unit_id || null, product_id: q.product_id || null });

// ---------------------------------------------------------------- reference data the forms need
route('GET', '/schema', async ({ db }) => ({
  ...S.schemaForUi(), presets: presetSummary(), product_types: Object.entries(O.PRODUCT_TYPES).map(([id, t]) => ({ id, label: t.label, kind: t.kind, platform_id: t.platform_id, provider: t.provider, needs_account: t.needs_account, preset: t.preset })),
  creatable: Object.fromEntries(Object.keys(O.CREATABLE).map((k) => [k, O.creatableAt(k)])), platforms: await C.rows(db, 'SELECT id, name FROM public.platforms ORDER BY name'),
}), { worker: true });
route('GET', '/org', async ({ db }) => ({
  units: await C.rows(db, 'SELECT id, kind, parent_id, display_name AS name, state FROM public.org_units ORDER BY sort, display_name'),
  products: await C.rows(db, 'SELECT id, unit_id, kind, name, platform_id, status, source FROM public.org_products ORDER BY name'),
}));
route('GET', '/agents', async ({ db, q }) => {
  const t = await C.loadTarget(db, target(q)), ids = (await C.chainOf(db, t)).filter((c) => c.type === 'unit').map((c) => c.id);
  return { agents: await C.rows(db, 'SELECT id, unit_id, role, name, status FROM public.org_agents WHERE unit_id = ANY($1::text[]) ORDER BY unit_id, role', [ids]) };
});
route('GET', '/library', async ({ db }) => ({ presets: presetSummary(), templates: await C.listTemplates(db, { library: true }) }));

// ---------------------------------------------------------------- templates
route('GET', '/templates', async ({ db, q }) => ({ templates: await C.listTemplates(db, { status: q.status || null, library: q.library === undefined ? null : q.library === 'true', owner_product_id: q.owner_product_id || null, owner_unit_id: q.owner_unit_id || null }) }));
route('POST', '/templates', ({ db, who, body, ctx }) => C.createTemplate(db, who, body));
route('GET', '/templates/([^/]+)', ({ db, m }) => C.getTemplate(db, m[1]));
route('POST', '/templates/([^/]+)/save', ({ db, who, m, body, ctx }) => C.saveTemplate(db, who, m[1], body, ctx));
route('POST', '/templates/([^/]+)/status', ({ db, who, m, body, ctx }) => C.setTemplateStatus(db, who, m[1], String(body.action || ''), ctx));
route('POST', '/templates/([^/]+)/duplicate', ({ db, who, m, body }) => C.createTemplate(db, who, { name: body.name || 'Copy', from_template_id: m[1], is_library: !!body.is_library, owner: body.owner || undefined }));
route('POST', '/templates/([^/]+)/restore', ({ db, who, m, body, ctx }) => C.restoreTemplateVersion(db, who, m[1], Number(body.version), ctx));
route('POST', '/templates/([^/]+)/assign', ({ db, who, m, body, ctx }) => C.assignTemplate(db, who, m[1], body, ctx));
route('POST', '/templates/([^/]+)/agents', ({ db, who, m, body }) => C.assignAgents(db, who, m[1], body.agent_ids || []));
route('POST', '/templates/([^/]+)/agents/remove', ({ db, who, m, body }) => C.removeAgent(db, who, m[1], String(body.agent_id || '')));
route('POST', '/assignments/([^/]+)', ({ db, who, m, body, ctx }) => C.updateAssignment(db, who, m[1], body, ctx));
route('GET', '/effective', async ({ db, q }) => {
  const eff = await C.resolveEffective(db, await C.loadTarget(db, target(q)), { statuses: q.active_only === 'true' ? ['active'] : ['draft', 'active', 'paused'], assume: q.template_id ? { template_id: q.template_id } : null, allowEmpty: true });
  return { target: eff.target, chain: eff.chain, layers: eff.layers, settings: eff.settings, provenance: eff.provenance, templates: eff.templates };
}, { worker: true });
route('POST', '/schedule/recalculate', async ({ db, who, body, ctx }) => ({ schedule: await C.recalculateSchedule(db, who, String(body.template_id || ''), ctx) }));
route('GET', '/schedule', async ({ db, q }) => ({ work: await C.rows(db, `SELECT id, deliverable, to_char(local_date, 'YYYY-MM-DD') AS local_date, seq, planned_for, status, job_id, template_version, note FROM public.planned_work
  WHERE template_id = $1 AND ($2::text IS NULL OR product_id = $2) AND ($3::text IS NULL OR unit_id = $3) ORDER BY planned_for LIMIT 500`, [q.template_id, q.product_id || null, q.unit_id || null]) }));

// ---------------------------------------------------------------- prompts
route('GET', '/prompts', async ({ db, q }) => ({ prompts: await C.listPrompts(db, { kind: q.kind || null, template_id: q.template_id || null }) }));
route('POST', '/prompts', ({ db, who, body }) => C.createLibraryPrompt(db, who, body));
route('POST', '/prompts/import', ({ db, who, body }) => C.importPrompt(db, who, body));
route('POST', '/prompts/apply', ({ db, who, body }) => C.applyPrompt(db, who, { from_prompt_id: body.from_prompt_id, version: num(body.version), to_template_id: body.to_template_id, activate: !!body.activate }));
route('GET', '/prompts/([^/]+)', ({ db, m, q }) => C.getPrompt(db, m[1], num(q.version)));
route('POST', '/prompts/([^/]+)/save', ({ db, who, m, body }) => C.savePrompt(db, who, m[1], body));
route('POST', '/prompts/([^/]+)/status', ({ db, who, m, body }) => C.setPromptStatus(db, who, m[1], String(body.action || ''), num(body.version)));
route('POST', '/prompts/([^/]+)/restore', ({ db, who, m, body }) => C.restorePromptVersion(db, who, m[1], Number(body.version)));
route('POST', '/prompts/([^/]+)/duplicate', ({ db, who, m, body }) => C.duplicatePrompt(db, who, m[1], body));
route('GET', '/prompts/([^/]+)/compare', ({ db, m, q }) => C.comparePromptVersions(db, m[1], Number(q.a), Number(q.b)));

// ---------------------------------------------------------------- preview, test and the production pipeline
route('POST', '/preview', ({ db, who, body, ctx }) => C.prepareExecution(db, who, { ...body, kind: 'preview' }, ctx));
route('POST', '/test', ({ db, who, body, ctx }) => C.runTest(db, who, body, ctx));
route('POST', '/executions/prepare', ({ db, who, body, ctx }) => C.prepareExecution(db, who, { ...body, kind: 'production' }, ctx), { worker: true, workerOnly: true });
route('POST', '/executions/([^/]+)/record', ({ db, who, m, body }) => C.recordExecution(db, who, m[1], body), { worker: true, workerOnly: true });

// ---------------------------------------------------------------- references
route('POST', '/references', ({ db, who, body, ctx }) => O.addReference(db, who, String(body.template_id || ''), body, ctx));
route('POST', '/references/([^/]+)/complete', ({ db, who, m, ctx }) => O.completeReference(db, who, m[1], ctx));
route('GET', '/references/([^/]+)/download', ({ db, m, ctx }) => O.referenceDownload(db, m[1], ctx));
route('POST', '/references/([^/]+)/remove', ({ db, who, m }) => O.removeReference(db, who, m[1]));
route('POST', '/references/([^/]+)/learn', ({ db, who, m, body }) => O.setReferenceLearn(db, who, m[1], body.learn));

// ---------------------------------------------------------------- publishing, statistics, readiness, dashboard
route('POST', '/publish/authorize', ({ db, who, body }) => O.authorizeAutoPublish(db, who, String(body.template_id || ''), body));
route('POST', '/publish/revoke', ({ db, who, body }) => O.revokeAutoPublish(db, who, Number(body.id)));
route('POST', '/publish/gate', ({ db, body }) => O.publishGate(db, body), { worker: true });
route('GET', '/stats', ({ db, q, ctx }) => O.getStats(db, { ...target(q), range: q.range, from: q.from, to: q.to }, ctx));
route('GET', '/readiness', ({ db, q }) => O.readinessOf(db, String(q.product_id || '')));
route('GET', '/dashboard', ({ db, q, ctx }) => O.productDashboard(db, String(q.product_id || ''), ctx));

// ---------------------------------------------------------------- the organisation and the creation wizard
route('GET', '/units/([^/]+)/overview', ({ db, m }) => W.unitOverview(db, decodeURIComponent(m[1])));
route('POST', '/units', ({ db, who, body }) => W.createUnit(db, who, body));
route('POST', '/onboarding/preview', async ({ db, who, body }) => { const { _virtual, ...out } = await W.onboardingPreview(db, who, body); return out; });
route('POST', '/onboarding/create', ({ db, who, body, ctx }) => W.onboardingCreate(db, who, body, ctx));
route('GET', '/onboarding/drafts', async ({ db }) => ({ drafts: await W.listOnboardingDrafts(db) }));
route('POST', '/onboarding/drafts/([^/]+)/discard', ({ db, who, m }) => W.discardOnboardingDraft(db, who, m[1]));
route('POST', '/onboarding/associate', ({ db, who, body }) => W.associateConnection(db, who, String(body.product_id || ''), String(body.connection_id || '')));

// ---------------------------------------------------------------- the AI door for a founder's sample test: the same lock, cap and booking as production
async function geminiKey(db, env) {
  if (env.COCO_VAULT_BACKEND === 'coco') return createVault(db, { env, actor: 'nova.ai' }).secret('gemini_api_key', 'nova.ai');
  return (await db.query("SELECT public.coco_secret('gemini_api_key') AS v")).rows[0]?.v || null;
}
const aiDoor = (db, who, { env, fetch: f, log }) => async (r) => {
  let key = null;
  try {
    key = await geminiKey(db, env);
    if (!key) return { ok: false, state: 'NOT_CONNECTED', reason: 'no Gemini key in the vault' };
    const out = await generateText(db, who, { provider: 'gemini', ...r, run_id: null }, { key, f, log, json: (status, body) => ({ status, body }) });
    return out.body;
  } catch (e) { return { ok: false, state: 'PROVIDER_ERROR', reason: String(e?.message || e).replace(key || '\u0000', '[redacted]').slice(0, 200) }; }
  finally { key = null; }
};

export async function handleAutomation(db, req, who, { json, log = () => {}, fetch: f = globalThis.fetch, env = process.env, overrides = {} } = {}) {
  const worker = ACCESS_POLICY.workflow_devices.includes(who.device_id), q = req.query || {}, body = req.body && typeof req.body === 'object' ? req.body : {};
  for (const [method, re, fn, opts] of ROUTES) {
    if (req.method !== method) continue;
    const m = re.exec(req.path); if (!m) continue;
    if (worker && !opts.worker) return json(403, { ok: false, state: 'FORBIDDEN', reason: 'the cloud worker can only prepare and record executions, read the effective configuration and ask the publish gate' });
    if (opts.workerOnly && !worker) return json(403, { ok: false, state: 'FORBIDDEN', reason: 'production executions are prepared by the cloud worker only; use preview or test from the app' });
    const storage = storageFromEnv(env);
    const ctx = { now: new Date(), storage, storageConfigured: !!storage, generate: aiDoor(db, who, { env, fetch: f, log }), ...overrides };
    try { return json(200, (await fn({ db, who, req, m, q, body, ctx })) ?? { ok: true }); }
    catch (e) {
      if (e instanceof C.AutError) return json(e.status, { ok: false, state: e.code, reason: e.message, ...e.extra });
      // the automation tables / functions are a later migration: until it is applied this is "not installed", not a crash
      if (e && (e.code === '42P01' || e.code === '42883')) return json(501, { ok: false, state: 'NOT_INSTALLED', reason: 'automation templates are not installed in this database yet' });
      log(500, { automation: 'error', why: String(e?.message || e).slice(0, 160) });
      return json(500, { ok: false, state: 'ERROR', reason: 'the request could not be completed' });
    }
  }
  return json(404, { message: 'no such automation route' });
}
