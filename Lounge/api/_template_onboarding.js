// Creating a new channel, store, product or organisation unit from its correct place in the organisation, from a reusable template.
//
// Three DISTINCT operations, never fused:
//   1. creating the organisational record (this file)     a placeholder until a real account is connected: it is not a real YouTube channel
//   2. connecting an external account (Integration Hub)   official consent flow; the verified identity is then associated with the record
//   3. activating production (a template's own switch)    nothing here ever turns it on, or turns on public publishing
//
// The wizard's preview validates every step and writes nothing. Creating does it all in one transaction: the record, the dedicated Brain
// (connected to its parent Brain, memory scoped to itself), an INDEPENDENT copy of the chosen template owned by the new channel (lineage
// kept, so a later change to another channel or to the library never touches it), its prompt, the authorised agents and, if already
// connected, the account. An existing Brain is reused, never duplicated; an agent is only ever assigned from the target's own chain.
import { randomBytes } from 'node:crypto';
import * as S from './_template_schema.js';
import { presetById } from './_template_presets.js';
import { AutError, rows, one, tx, safe, audit, slugify, loadTarget, chainOf, brainOf, nearestBrain, createTemplate, getTemplate, assignTemplate, assignAgents, savePrompt, saveTemplate, resolveEffective, loadTemplate, applyPatch } from './_template_core.js';
import { PRODUCT_TYPES, CREATABLE, creatableAt, readinessOf, checkUrl, typeOfProduct } from './_template_ops.js';

const norm = (s) => String(s ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isUnique = (e) => e && e.code === '23505';

// ---------------------------------------------------------------- the organisation view a founder sees when standing on a unit
export async function unitOverview(db, unitId) {
  const unit = await loadTarget(db, { unit_id: unitId }), chain = await chainOf(db, unit);
  const [children, brain, assigned, products] = await Promise.all([
    rows(db, 'SELECT id, kind, display_name AS name, state FROM public.org_units WHERE parent_id = $1 ORDER BY sort, display_name', [unitId]),
    brainOf(db, { type: 'unit', id: unitId }),
    rows(db, `SELECT a.id AS assignment_id, t.id AS template_id, t.name, t.status, t.current_version FROM public.automation_assignments a JOIN public.automation_templates t ON t.id = a.template_id WHERE a.unit_id = $1 AND a.status = 'active'`, [unitId]),
    rows(db, `SELECT p.id, p.name, p.kind, p.platform_id, p.status, p.source, p.external_ref, p.meta, t.id AS template_id, t.name AS template_name, t.status AS template_status, v.settings, pr.status AS prompt_status, pr.active_version,
        (SELECT b.id FROM public.org_brains b WHERE b.product_id = p.id LIMIT 1) AS brain_id
      FROM public.org_products p
      LEFT JOIN LATERAL (SELECT * FROM public.automation_templates x WHERE x.owner_product_id = p.id AND x.status <> 'archived' ORDER BY x.created_at DESC LIMIT 1) t ON true
      LEFT JOIN public.automation_template_versions v ON v.template_id = t.id AND v.version = t.current_version
      LEFT JOIN public.prompt_records pr ON pr.template_id = t.id WHERE p.unit_id = $1 ORDER BY p.name`, [unitId]),
  ]);
  const connIds = [...new Set(products.map((p) => p.settings?.integrations?.connection_id).filter(Boolean))];
  const conns = connIds.length ? await safe(db, 'SELECT connection_id, state, last_verified_at, external_id FROM public.integration_accounts WHERE connection_id = ANY($1::text[])', [connIds], []) : [];
  return {
    unit: { id: unit.id, kind: unit.kind, level: unit.level, name: unit.name }, path: chain.map((c) => ({ id: c.id, kind: c.kind, name: c.name })), can_create: creatableAt(unit.kind),
    children, brain: brain && { id: brain.id, level: brain.level, state: brain.state }, templates: assigned,
    products: products.map((p) => {
      const cid = p.settings?.integrations?.connection_id, c = conns.find((x) => x.connection_id === cid), type = typeOfProduct(p);
      return { id: p.id, name: p.name, kind: p.kind, platform_id: p.platform_id, status: p.status, real_account: p.source === 'existing', product_type: p.meta?.product_type || null,
        template: p.template_id ? { id: p.template_id, name: p.template_name, status: p.template_status } : null, prompt: p.prompt_status ? { status: p.prompt_status, active_version: p.active_version } : null, brain_id: p.brain_id || null,
        connection: cid ? { connection_id: cid, state: c ? (c.state === 'connected' && c.last_verified_at ? 'connected' : c.state) : 'missing' } : { state: type?.needs_account === false ? 'not needed' : 'not_connected' },
        production: p.template_status === 'active' ? 'active' : p.template_id ? 'not_activated' : 'no_template' };
    }),
  };
}

// ---------------------------------------------------------------- duplicates
export async function findDuplicates(db, { unit_id, name }) {
  const n = norm(name);
  const here = (await rows(db, 'SELECT id, name, kind FROM public.org_products WHERE unit_id = $1', [unit_id])).concat((await rows(db, 'SELECT id, display_name AS name, kind FROM public.org_units WHERE parent_id = $1', [unit_id])));
  const exact = here.filter((r) => norm(r.name) === n);
  const similar = (await rows(db, 'SELECT id, name, unit_id FROM public.org_products WHERE unit_id <> $1', [unit_id])).filter((r) => norm(r.name) === n);
  return { exact, similar };
}

// ---------------------------------------------------------------- Brains and agents: reuse what exists, create only what is missing
export async function ensureBrain(db, who, entry, chain) {
  const existing = await brainOf(db, entry);
  if (existing) return { brain: existing, created: false };
  const parent = await nearestBrain(db, chain.slice(0, -1));
  const id = entry.type === 'product' ? `brain.product.${entry.id}` : `brain.${entry.level}.${entry.id}`;
  const policies = { memory: { scope: 'own', read_parent: true, write_parent: false, shared_with_siblings: false }, created_via: 'onboarding' };
  await db.query(`INSERT INTO public.org_brains (id, level, unit_id, product_id, parent_brain_id, objectives, tools, policies, state, health, meta) VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, '[]'::jsonb, $6, 'configured', 'idle', $7)`,
    [id, entry.type === 'product' ? 'product' : entry.level, entry.type === 'unit' ? entry.id : null, entry.type === 'product' ? entry.id : null, parent?.id || null, JSON.stringify(policies), JSON.stringify({ created_by: who.email, created_via: 'onboarding' })]);
  await audit(db, who, 'organisation', id, 'brain_create', null, { for: `${entry.type}:${entry.id}`, parent: parent?.id || null });
  return { brain: await brainOf(db, entry), created: true, parent: parent?.id || null };
}

// ---------------------------------------------------------------- the organisational record
const validName = (name) => { const n = String(name ?? '').trim(); if (n.length < 2 || n.length > 80) throw new AutError(422, 'NAME', 'a name needs 2 to 80 characters'); return n; };
export async function createUnit(db, who, input = {}) {
  const name = validName(input.name), parent = await loadTarget(db, { unit_id: input.parent_id }), kind = String(input.kind || '');
  if (!(CREATABLE[parent.kind]?.units || []).includes(kind)) throw new AutError(422, 'NOT_ALLOWED_HERE', `a ${kind || 'unit'} cannot be created under a ${parent.kind}`);
  return tx(db, async () => {
    const dup = await findDuplicates(db, { unit_id: parent.id, name });
    if (dup.exact.length) throw new AutError(409, 'DUPLICATE', `"${dup.exact[0].name}" already exists here (${dup.exact[0].id})`, { existing: dup.exact });
    const id = `${parent.id}.${slugify(name, '_')}`, house = (await one(db, 'SELECT house_id FROM public.org_units WHERE id = $1', [parent.id]))?.house_id || null;
    if (await one(db, 'SELECT 1 AS x FROM public.org_units WHERE id = $1', [id])) throw new AutError(409, 'DUPLICATE', `${id} already exists`);
    const sort = ((await one(db, 'SELECT coalesce(max(sort), 0) AS s FROM public.org_units WHERE parent_id = $1', [parent.id])).s || 0) + 10;
    await db.query(`INSERT INTO public.org_units (id, kind, parent_id, house_id, display_name, short_name, purpose, state, sort) VALUES ($1, $2, $3, $4, $5, $5, $6, 'planned', $7)`, [id, kind, parent.id, house, name, input.description ? String(input.description).slice(0, 500) : null, sort]);
    await db.query(`INSERT INTO public.org_agents (id, unit_id, role, name, registry_agent, status) VALUES ($1, $2, 'head', $3, NULL, 'placeholder')`, [`agent.${id}.head`, id, `Head of ${name} (not assigned)`]);   // a placeholder, as everywhere in the canonical organisation: nobody is invented
    const target = await loadTarget(db, { unit_id: id }), brain = await ensureBrain(db, who, { type: 'unit', id, level: target.level, name }, await chainOf(db, target));
    await audit(db, who, 'organisation', id, 'unit_create', null, { kind, parent: parent.id });
    return { unit: { id, kind, parent_id: parent.id, name }, brain: brain.brain, brain_created: brain.created };
  });
}
export async function createProduct(db, who, { unit_id, type, name, details = {} }) {
  const t = PRODUCT_TYPES[type]; if (!t) throw new AutError(422, 'TYPE', 'choose what to create');
  const parent = await loadTarget(db, { unit_id });
  if (!(CREATABLE[parent.kind]?.products || []).includes(t.kind)) throw new AutError(422, 'NOT_ALLOWED_HERE', `a ${t.label} cannot be created under a ${parent.kind}`);
  const clean = validName(name), dup = await findDuplicates(db, { unit_id, name: clean });
  if (dup.exact.length) throw new AutError(409, 'DUPLICATE', `"${dup.exact[0].name}" already exists here (${dup.exact[0].id})`, { existing: dup.exact });
  if (t.platform_id && !(await one(db, 'SELECT 1 AS x FROM public.platforms WHERE id = $1', [t.platform_id]))) throw new AutError(422, 'PLATFORM', `unknown platform ${t.platform_id}`);
  let id = `${t.prefix}.${slugify(clean) || 'item'}`;
  if (await one(db, 'SELECT 1 AS x FROM public.org_products WHERE id = $1', [id])) id += `-${randomBytes(2).toString('hex')}`;
  const meta = { product_type: type, description: details.description || null, audience: details.audience || null, language: details.language || null, niche: details.niche || null, website: details.website || null, created_via: 'onboarding', created_by: who.email };
  try { await db.query(`INSERT INTO public.org_products (id, unit_id, kind, name, platform_id, status, source, meta) VALUES ($1, $2, $3, $4, $5, 'planned', 'placeholder', $6)`, [id, unit_id, t.kind, clean, t.platform_id, JSON.stringify(meta)]); }
  catch (e) { if (isUnique(e)) throw new AutError(409, 'DUPLICATE', `"${clean}" already exists here`); throw e; }
  return { id, unit_id, kind: t.kind, name: clean, platform_id: t.platform_id, product_type: type };
}

// ---------------------------------------------------------------- the account: associating a VERIFIED connection with the record
export async function associateConnection(db, who, productId, connectionId) {
  const prod = await one(db, 'SELECT id, name, kind, meta, external_ref, platform_id FROM public.org_products WHERE id = $1', [productId]);
  if (!prod) throw new AutError(404, 'NO_PRODUCT', `no product ${productId}`);
  const type = typeOfProduct(prod);
  if (!type?.provider) throw new AutError(422, 'NO_ACCOUNT_NEEDED', 'this kind of product has no connected account');
  const acc = (await safe(db, 'SELECT connection_id, provider, state, external_id, external_name, last_verified_at FROM public.integration_accounts WHERE connection_id = $1', [connectionId], []))[0];
  if (!acc) throw new AutError(422, 'NO_CONNECTION', `there is no connection ${connectionId}: connect the account from Integrations first`);
  if (acc.provider !== type.provider) throw new AutError(422, 'PROVIDER', `${connectionId} is a ${acc.provider} connection, this is a ${type.label}`);
  if (acc.state !== 'connected' || !acc.last_verified_at || !acc.external_id) throw new AutError(409, 'NOT_VERIFIED', 'the account is not connected and verified yet: finish connecting it and press Verify');
  const taken = await one(db, `SELECT id, name FROM public.org_products WHERE external_ref = $1 AND id <> $2 AND coalesce(platform_id, '') = coalesce($3, '')`, [acc.external_id, productId, prod.platform_id]);
  if (taken) throw new AutError(409, 'DUPLICATE_CHANNEL', `that account is already ${taken.name}`);
  const own = await one(db, "SELECT id FROM public.automation_templates WHERE owner_product_id = $1 AND status <> 'archived' ORDER BY created_at DESC LIMIT 1", [productId]);
  await tx(db, async () => {
    if (own) await saveTemplate(db, who, own.id, { patch: { integrations: { connection_id: connectionId } }, change_summary: `Connected ${connectionId}` });
    await db.query(`UPDATE public.org_products SET external_ref = $2, source = 'existing', meta = meta || $3::jsonb, updated_at = now() WHERE id = $1`, [productId, acc.external_id, JSON.stringify({ connection_id: connectionId })]);
    await audit(db, who, 'organisation', productId, 'account_associate', null, { connection: connectionId, provider: acc.provider });
  });
  return { associated: true, connection_id: connectionId, identity: { name: acc.external_name, id_masked: `${String(acc.external_id).slice(0, 6)}…${String(acc.external_id).slice(-4)}`, verified_at: acc.last_verified_at, provider: acc.provider } };
}

// ---------------------------------------------------------------- the wizard
const FORBIDDEN_AT_CREATION = [['publishing.auto_create', true], ['publishing.auto_upload', true], ['publishing.auto_publish', true], ['publishing.visibility', 'public']];
export async function onboardingPreview(db, who, input = {}) {
  const errors = [], warnings = [], missing = [], err = (step, field, message) => errors.push({ step, field, message });
  let parent = null, chain = [];
  try { parent = await loadTarget(db, { unit_id: input.destination?.unit_id }); chain = await chainOf(db, parent); } catch (e) { err('destination', 'unit_id', e.message); }
  const type = PRODUCT_TYPES[input.type];
  if (!type) err('type', 'type', 'choose what to create');
  if (parent && type && !(CREATABLE[parent.kind]?.products || []).includes(type.kind)) err('destination', 'unit_id', `a ${type.label} cannot be created under a ${parent.kind}: open a Subteam or a Category`);
  const d = input.details || {}, name = String(d.name ?? '').trim();
  if (name.length < 2 || name.length > 80) err('details', 'name', 'a name needs 2 to 80 characters');
  if (d.language && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(d.language)) err('details', 'language', 'use a language code such as en or hi');
  if (d.website) { try { checkUrl('website_url', d.website); } catch (e) { err('details', 'website', e.message); } }
  for (const [f, max] of [['description', 1000], ['audience', 500], ['niche', 200], ['brand_guidelines', 8000]]) if (d[f] && String(d[f]).length > max) err('details', f, `at most ${max} characters`);
  let duplicates = { exact: [], similar: [] };
  if (parent && name.length >= 2) {
    duplicates = await findDuplicates(db, { unit_id: parent.id, name });
    if (duplicates.exact.length) err('details', 'name', `"${duplicates.exact[0].name}" already exists here (${duplicates.exact[0].id})`);
    if (duplicates.similar.length) warnings.push(`A record named "${name}" also exists elsewhere (${duplicates.similar.map((s) => s.id).join(', ')}). Make sure this is a different one.`);
  }
  // step 4: the template (an independent copy is made for the new channel in every mode)
  const tm = input.template || { mode: 'preset' }, mode = tm.mode || 'preset';
  let source = null, virtual = {}, promptInfo = { state: 'missing' }, sourceLabel = null;
  if (mode === 'copy_template') {
    try { source = await loadTemplate(db, tm.template_id); if (source.status === 'archived') err('template', 'template_id', 'that template is archived'); } catch (e) { err('template', 'template_id', e.message); }
    if (source && source.status !== 'archived') {
      virtual = structuredClone((await getTemplate(db, source.id)).settings); if (virtual.integrations) delete virtual.integrations.connection_id;
      const pr = await one(db, 'SELECT id, name, status, active_version, current_version FROM public.prompt_records WHERE template_id = $1', [source.id]);
      const ver = pr && await one(db, 'SELECT sections, full_text, variables FROM public.prompt_versions WHERE prompt_id = $1 AND version = $2', [pr.id, pr.status === 'active' && pr.active_version ? pr.active_version : pr.current_version]);
      promptInfo = ver ? { state: pr.status === 'active' ? 'copied, active' : 'copied, needs activation', version_from: pr.status === 'active' ? pr.active_version : pr.current_version, text: S.composeOperatorPrompt(ver).slice(0, 2500), variables: ver.variables } : promptInfo;
      sourceLabel = `${source.name} v${source.current_version}`;
    }
  } else if (mode === 'preset' || mode === 'default') {
    const preset = presetById(mode === 'preset' ? (tm.preset || type?.preset) : 'general_content');
    if (!preset) err('template', 'preset', 'choose a preset'); else { virtual = structuredClone(preset.settings); promptInfo = { state: 'starter, needs activation', version_from: null, text: S.composeOperatorPrompt({ sections: preset.prompt }).slice(0, 2500), variables: S.extractVariables(S.composeOperatorPrompt({ sections: preset.prompt })).used }; sourceLabel = mode === 'preset' ? `${preset.name} preset` : 'default settings'; if (mode === 'default') virtual = {}; }
  } else err('template', 'mode', 'choose a template, a preset or the default settings');
  // the details the founder typed become the new configuration's own settings
  const fromDetails = {}; if (d.audience) S.setPath(fromDetails, 'basics.target_audience', String(d.audience)); if (d.language) S.setPath(fromDetails, 'content.language', String(d.language)); if (d.brand_guidelines) S.setPath(fromDetails, 'brand.guidelines', String(d.brand_guidelines));
  const patch = tm.patch || {};
  for (const [path, bad] of FORBIDDEN_AT_CREATION) if (S.getPath(patch, path) === bad) err('production', path, 'creating a channel never switches on automatic creation, upload or publishing, or public visibility: authorise that later, separately, from its dashboard');
  if (S.getPath(patch, 'integrations.connection_id') != null) err('integration', 'connection_id', 'the account is connected in the Account step, where its identity is verified');
  const pv = S.validateSettings(patch, { partial: true }); if (!pv.ok) for (const e of pv.errors) err('production', e.path, e.message);
  virtual = applyPatch(applyPatch(virtual, { patch: fromDetails }), { patch, unset: tm.unset || [] });
  if (type && mode === 'default' && !S.getPath(virtual, 'basics.content_type') && type.preset) { const p = presetById(type.preset); if (p?.settings.basics?.content_type) S.setPath(virtual, 'basics.content_type', p.settings.basics.content_type); }
  // step 5: Brain and agents
  const brain = parent ? { action: 'create a dedicated Brain', parent: (await nearestBrain(db, chain))?.id || null, memory: 'its own scope: reads its parent\'s knowledge, writes only to itself, shares nothing with siblings' } : null;
  const agents = [];
  for (const id of input.agents || []) {
    const a = await one(db, 'SELECT id, unit_id, role, name, status FROM public.org_agents WHERE id = $1', [id]);
    if (!a) { err('brain', 'agents', `no agent ${id}`); continue; }
    if (chain.length && !chain.some((c) => c.type === 'unit' && c.id === a.unit_id)) err('brain', 'agents', `${a.name} is outside this destination's organisation chain`); else agents.push(a);
    if (a.status === 'placeholder') warnings.push(`${a.name} is a placeholder: nobody is assigned to it yet.`);
  }
  // step 6: the account is optional here; creating the record never creates a real channel
  let integration = { state: 'not_connected', note: type?.needs_account ? `Creating this record does not create a real ${type.label.replace(' Channel', '')} channel. Create the real account with the provider first, then connect it from Integrations.` : 'This kind of product needs no connected account.' };
  if (input.integration?.connection_id && type?.provider) {
    const acc = (await safe(db, 'SELECT connection_id, provider, state, external_id, external_name, last_verified_at FROM public.integration_accounts WHERE connection_id = $1', [input.integration.connection_id], []))[0];
    if (!acc) err('integration', 'connection_id', 'no such connection'); else if (acc.provider !== type.provider) err('integration', 'connection_id', `that is a ${acc.provider} connection`);
    else if (acc.state !== 'connected' || !acc.last_verified_at) err('integration', 'connection_id', 'that account is not connected and verified yet');
    else integration = { state: 'connected', connection_id: acc.connection_id, identity: { name: acc.external_name, id_masked: `${String(acc.external_id).slice(0, 6)}…${String(acc.external_id).slice(-4)}` } };
  }
  if (type?.needs_account && integration.state !== 'connected') missing.push('Account: not connected yet');
  if (promptInfo.state !== 'copied, active') missing.push(`Prompt: ${promptInfo.state}`);
  missing.push('Production: not activated (it stays off until you activate it)'); missing.push('Publishing: founder approval required (nothing is public until you authorise it)');
  // the effective production configuration, as it will be once created
  let effective = null;
  if (parent) {
    const up = await resolveEffective(db, parent, { statuses: ['draft', 'active', 'paused'], allowEmpty: true }), merged = structuredClone(up.settings), provenance = { ...up.provenance };
    for (const p of S.leafPaths(virtual)) { S.setPath(merged, p, structuredClone(S.getPath(virtual, p))); provenance[p] = `${name || 'New'} configuration`; }
    effective = { settings: merged, provenance, inherited_from: up.templates.map((t) => `${t.name} @ ${t.at.name}`) };
  }
  const summary = parent && type ? {
    destination: { unit_id: parent.id, path: chain.map((c) => c.name) }, details: { name, ...d }, type: { id: input.type, label: type.label, kind: type.kind, platform_id: type.platform_id },
    template: { mode, source: sourceLabel, independent_copy: true, settings_set_by_the_new_configuration: S.leafPaths(virtual).length }, prompt: promptInfo, brain, agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role })), integration, production: effective,
    publishing: { visibility: effective?.settings.publishing.visibility, auto_publish: false, founder_approval: effective?.settings.publishing.founder_approval ?? true, note: 'Approval required. Public publishing is authorised separately, later.' },
  } : null;
  return { ok: errors.length === 0, errors, warnings, missing, duplicates, summary, _virtual: virtual };
}

export async function saveOnboardingDraft(db, who, input, draftId = null) {
  const payload = JSON.stringify({ destination: input.destination, type: input.type, details: input.details, template: input.template, agents: input.agents, integration: input.integration });
  if (draftId) { const r = await one(db, "UPDATE public.automation_onboarding_drafts SET payload = $2, updated_at = now() WHERE id = $1 AND status = 'draft' RETURNING id", [draftId, payload]); if (!r) throw new AutError(404, 'NO_DRAFT', 'no open draft with that id'); await audit(db, who, 'onboarding', draftId, 'draft_update'); return { draft_id: draftId }; }
  const r = await one(db, 'INSERT INTO public.automation_onboarding_drafts (payload, unit_id, created_by) VALUES ($1, $2, $3) RETURNING id', [payload, input.destination?.unit_id || null, who.email]);
  await audit(db, who, 'onboarding', r.id, 'draft_save'); return { draft_id: r.id };
}
export const listOnboardingDrafts = (db) => rows(db, "SELECT id, payload, unit_id, created_by, created_at, updated_at FROM public.automation_onboarding_drafts WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 50");
export async function discardOnboardingDraft(db, who, id) { const r = await one(db, "UPDATE public.automation_onboarding_drafts SET status = 'discarded', updated_at = now() WHERE id = $1 AND status = 'draft' RETURNING id", [id]); if (!r) throw new AutError(404, 'NO_DRAFT', 'no open draft with that id'); await audit(db, who, 'onboarding', id, 'draft_discard'); return { discarded: id }; }

// mode: 'draft' saves the wizard only; 'create' and 'create_open' create the record (and 'create_open' tells the app to open its settings)
export async function onboardingCreate(db, who, input = {}, ctx = {}) {
  if (input.mode === 'draft') return saveOnboardingDraft(db, who, input, input.draft_id || null);
  const prev = await onboardingPreview(db, who, input);
  if (!prev.ok) throw new AutError(422, 'ONBOARDING_INVALID', 'fix the highlighted fields first', { errors: prev.errors });
  const type = PRODUCT_TYPES[input.type], d = input.details, tm = input.template || { mode: 'preset' };
  const result = await tx(db, async () => {
    const product = await createProduct(db, who, { unit_id: input.destination.unit_id, type: input.type, name: d.name, details: { description: d.description, audience: d.audience, language: d.language, niche: d.niche, website: d.website } });
    const target = await loadTarget(db, { product_id: product.id }), chain = await chainOf(db, target);
    const brain = await ensureBrain(db, who, { type: 'product', id: product.id, level: 'product', name: product.name }, chain);
    // the source (a template to copy, or a preset) supplies the prompt and the lineage; the preview's merged settings are the whole truth for the
    // new configuration's own settings, so what the founder reviewed is exactly what is saved
    const from = tm.mode === 'copy_template' ? { from_template_id: tm.template_id } : { preset: tm.mode === 'preset' ? (tm.preset || type.preset) : 'general_content' };
    const tpl = await createTemplate(db, who, { name: `${product.name} configuration`, owner: { product_id: product.id }, platform_id: type.platform_id, ...from });
    await saveTemplate(db, who, tpl.template.id, { settings: prev._virtual, change_summary: 'Set up in the creation wizard' });
    const asg = await assignTemplate(db, who, tpl.template.id, { product_id: product.id }, ctx);
    if (input.prompt && (input.prompt.full_text || Object.keys(input.prompt.sections || {}).length)) await savePrompt(db, who, tpl.prompt.id, { sections: input.prompt.sections || {}, full_text: input.prompt.full_text || '', change_summary: 'Set during creation', activate: !!input.prompt.activate });
    if (input.agents?.length) await assignAgents(db, who, tpl.template.id, input.agents);
    let account = null; if (input.integration?.connection_id && type.provider) account = await associateConnection(db, who, product.id, input.integration.connection_id);
    await db.query(`UPDATE public.org_products SET meta = meta || $2::jsonb, updated_at = now() WHERE id = $1`, [product.id, JSON.stringify({ automation: { template_id: tpl.template.id, storage_prefix: `refs/${tpl.template.id}/`, tracking: { production: 'not_activated', statistics: 'initialised' } } })]);
    if (input.draft_id) await db.query("UPDATE public.automation_onboarding_drafts SET status = 'created', product_id = $2, template_id = $3, updated_at = now() WHERE id = $1 AND status = 'draft'", [input.draft_id, product.id, tpl.template.id]);
    await audit(db, who, 'onboarding', product.id, 'create', null, { unit: input.destination.unit_id, type: input.type, template: tpl.template.id, source: tm.template_id || tm.preset || tm.mode, brain: brain.brain?.id, brain_created: brain.created, account: account?.connection_id || null });
    return { product, brain: brain.brain, brain_created: brain.created, template_id: tpl.template.id, assignment_id: asg.assignment.id, account };
  });
  const readiness = await readinessOf(db, result.product.id);
  return { ...result, readiness: { items: readiness.items, fully_ready: readiness.fully_ready, missing: readiness.missing }, production: readiness.production, publishing: readiness.publishing, open: input.mode === 'create_open' ? 'settings' : 'dashboard' };
}
