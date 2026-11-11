// Universal Automation Template: the ONE definition of a template's settings. It drives the form in COCO Desktop and Mobile/PWA, the
// server-side validation in Nova and the defaults, so the three can never disagree. Also here: the dynamic-variable catalogue, the prompt
// sections, the layered merge that implements inheritance (Global > House > Team > Subteam > Category > Channel/Product) with provenance,
// and the check that keeps credentials out of prompt text. Pure functions: no database, no network.
import { redactText } from './_redact.js';

export const LEVELS = ['global', 'house', 'team', 'subteam', 'category', 'product', 'channel'];
const KIND_LEVEL = { organisation: 'global', company: 'global', group: 'global', house: 'house', team: 'team', subteam: 'subteam', category: 'category', product: 'product', channel: 'channel' };
export const levelOfKind = (kind) => KIND_LEVEL[kind] || null;

export const DELIVERABLES = ['short', 'long_form', 'image', 'ebook', 'comic', 'lesson', 'software_release', 'game', 'other'];
export const DELIVERABLE_LABEL = { short: 'Shorts', long_form: 'Long-form videos', image: 'Images', ebook: 'Ebooks', comic: 'Comics', lesson: 'Lessons', software_release: 'Software releases', game: 'Games', other: 'Other deliverables' };
export const FAMILY = { short: 'video', long_form: 'video', image: 'image', ebook: 'text', comic: 'image', lesson: 'text', software_release: 'software', game: 'game', other: 'other' };
export const familyOf = (settings) => FAMILY[settings?.basics?.content_type] || 'other';
export const DEPTHS = ['standard', 'advanced', 'deep', 'extensive'];
export const FREQUENCIES = ['manual', 'daily', 'weekly', 'monthly'];
export const COMPETITOR_PRESETS = [25, 50, 100, 200, 500, 1000];
export const VISIBILITIES = ['private', 'unlisted', 'public'];
export const QA_CHECKS = ['originality', 'copyright_licensing', 'factual_accuracy', 'audio_video_quality', 'image_quality', 'brand_consistency', 'file_integrity', 'formatting', 'metadata'];
export const QA_LABEL = { originality: 'Originality', copyright_licensing: 'Copyright and licensing', factual_accuracy: 'Factual accuracy', audio_video_quality: 'Audio and video quality', image_quality: 'Image quality',
  brand_consistency: 'Brand consistency', file_integrity: 'File integrity', formatting: 'Formatting', metadata: 'Metadata' };
export const QA_FAMILIES = { audio_video_quality: ['video'], image_quality: ['video', 'image'] };   // the others apply to everything
export const LEARN_GOALS = ['visual_style', 'animation', 'expressions', 'storytelling', 'editing', 'thumbnails', 'pacing', 'topic', 'niche', 'all'];
export const RESOLUTIONS = ['720p', '1080p', '1440p', '2160p', 'square_1080', 'vertical_1080x1920'];
export const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash-lite'];   // the gateway's allowlist (api/_ai.js)

// ---------------------------------------------------------------- the field catalogue
// type: text | string | bool | int | enum | date | tz | days | times | competitors | language | id
// families: which kinds of deliverable the field is relevant to (the form shows only those); omitted = all
const F = (path, label, type, o = {}) => ({ path, label, type, section: path.split('.')[0], ...o });
const dflt = (v) => ({ default: v });
export const FIELDS = [
  F('basics.content_type', 'Main content type', 'enum', { options: DELIVERABLES, ...dflt('other'), help: 'Decides which settings are shown.' }),
  F('basics.target_audience', 'Target audience', 'text', { max: 500, ...dflt(''), help: 'Used as {{target_audience}} in prompts.' }),
  F('basics.timezone', 'Timezone', 'tz', { ...dflt('UTC'), help: 'Days, schedules and daily targets follow this timezone.' }),

  F('targets.operating_days', 'Operating days', 'days', { ...dflt([1, 2, 3, 4, 5, 6, 7]), help: '1 = Monday … 7 = Sunday' }),
  F('targets.times', 'Production times', 'times', { ...dflt(['09:00']), help: 'Local times planned work is scheduled at, in order.' }),
  F('targets.start_date', 'Start date', 'date', { nullable: true, ...dflt(null) }),
  F('targets.end_date', 'End date', 'date', { nullable: true, ...dflt(null) }),
  F('targets.backlog_limit', 'Backlog limit', 'int', { min: 1, max: 500, ...dflt(14), help: 'The most planned, unstarted items waiting at once.' }),
  F('targets.horizon_days', 'Planning horizon (days)', 'int', { min: 1, max: 60, ...dflt(14) }),

  F('research.enabled', 'Deep research', 'bool', { ...dflt(false) }),
  F('research.frequency', 'Research frequency', 'enum', { options: FREQUENCIES, ...dflt('weekly') }),
  F('research.depth', 'Research depth', 'enum', { options: DEPTHS, ...dflt('standard') }),
  F('research.competitor_targets', 'Competitor research target', 'competitors', { ...dflt(25), help: 'A goal, not a guarantee: provider quotas, cost and source access decide what is reachable.' }),

  F('content.topic_generation', 'Generate topics', 'bool', { ...dflt(true) }),
  F('content.script', 'Write scripts', 'bool', { families: ['video', 'text', 'game'], ...dflt(true) }),
  F('content.language', 'Language', 'language', { ...dflt('en') }),
  F('content.duration_s', 'Duration (seconds)', 'int', { min: 3, max: 36000, nullable: true, families: ['video'], ...dflt(null) }),
  F('content.voice', 'Voice', 'string', { max: 120, families: ['video'], ...dflt('') }),
  F('content.visual_style', 'Visual style', 'text', { max: 1000, families: ['video', 'image'], ...dflt('') }),
  F('content.character_consistency', 'Keep characters consistent', 'bool', { families: ['video', 'image'], ...dflt(false) }),
  F('content.animation', 'Animation', 'enum', { options: ['none', 'simple', 'full'], families: ['video'], ...dflt('none') }),
  F('content.music', 'Music', 'bool', { families: ['video'], ...dflt(false) }),
  F('content.sound_effects', 'Sound effects', 'bool', { families: ['video'], ...dflt(false) }),
  F('content.subtitles', 'Subtitles', 'bool', { families: ['video'], ...dflt(false) }),
  F('content.thumbnail', 'Thumbnail', 'bool', { families: ['video'], ...dflt(false) }),
  F('content.metadata', 'Titles, descriptions and tags', 'bool', { ...dflt(true) }),
  F('content.editing', 'Editing pass', 'bool', { families: ['video'], ...dflt(true) }),
  F('content.resolution', 'Resolution', 'enum', { options: RESOLUTIONS, families: ['video', 'image'], ...dflt('1080p') }),
  F('content.fps', 'Frames per second', 'enum', { options: [24, 25, 30, 60], numeric: true, families: ['video'], ...dflt(30) }),
  F('content.pages', 'Pages', 'int', { min: 1, max: 5000, nullable: true, families: ['text', 'image'], ...dflt(null) }),
  F('content.build_template', 'Build template (existing templates registry)', 'id', { nullable: true, ...dflt(null), help: 'Optional id of an artifact build template; it is only referenced, never copied.' }),

  ...QA_CHECKS.flatMap((c) => [
    F(`quality.checks.${c}.enabled`, `${QA_LABEL[c]}: check`, 'bool', { families: QA_FAMILIES[c], ...dflt(true) }),
    F(`quality.checks.${c}.required`, `${QA_LABEL[c]}: must pass`, 'bool', { families: QA_FAMILIES[c], ...dflt(['originality', 'copyright_licensing', 'file_integrity'].includes(c)) }),
  ]),

  F('publishing.auto_create', 'Create automatically', 'bool', { ...dflt(false) }),
  F('publishing.auto_upload', 'Upload automatically', 'bool', { ...dflt(false) }),
  F('publishing.auto_publish', 'Publish automatically', 'bool', { ...dflt(false), help: 'Public auto-publishing also needs a founder authorisation for this exact channel or product.' }),
  F('publishing.scheduled_publish', 'Schedule publishing', 'bool', { ...dflt(false) }),
  F('publishing.founder_approval', 'Founder approval before publishing', 'bool', { ...dflt(true) }),
  F('publishing.visibility', 'Visibility', 'enum', { options: VISIBILITIES, ...dflt('private') }),

  F('brand.guidelines', 'Brand guidelines', 'text', { max: 8000, ...dflt(''), help: 'Used as {{brand_guidelines}} in prompts.' }),
  F('integrations.connection_id', 'Connected account', 'id', { nullable: true, ...dflt(null), help: 'A connection NAME from Integrations. Credentials are never stored here and never copied with a template.' }),
  F('ai.model', 'AI model', 'enum', { options: MODELS, ...dflt('gemini-3.5-flash-lite') }),
  F('ai.max_output_tokens', 'Maximum output tokens', 'int', { min: 256, max: 8192, ...dflt(4096) }),
];
// targets.deliverables.<type>.<period>: how many, per day / week / month (empty = no target)
for (const d of DELIVERABLES) for (const p of ['daily', 'weekly', 'monthly'])
  FIELDS.push(F(`targets.deliverables.${d}.${p}`, `${DELIVERABLE_LABEL[d]} per ${p === 'daily' ? 'day' : p === 'weekly' ? 'week' : 'month'}`, 'int', { min: 0, max: 500, nullable: true, deliverable: d, ...dflt(null) }));

export const SECTION_LABEL = { basics: 'Basics', targets: 'Production targets', research: 'Deep research', content: 'Content creation', quality: 'Quality control', publishing: 'Publishing and approval', brand: 'Brand', integrations: 'Connected account', ai: 'AI' };
const BY_PATH = new Map(FIELDS.map((f) => [f.path, f]));

// ---------------------------------------------------------------- small helpers
export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
export function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (const k of ks.slice(0, -1)) a = (a[k] ??= {}); a[ks.at(-1)] = v; return o; }
export function leafPaths(o, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(o || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p)); else out.push(p);
  }
  return out;
}
export function defaults() { const o = {}; for (const f of FIELDS) setPath(o, f.path, structuredClone(f.default)); return o; }

// ---------------------------------------------------------------- validation (same rules for the form and for the server)
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
const isTz = (s) => { try { new Intl.DateTimeFormat('en', { timeZone: s }); return typeof s === 'string' && s.length < 60; } catch { return false; } };
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const CHECKS = {
  text: (v, f) => typeof v === 'string' && v.length <= (f.max || 4000),
  string: (v, f) => typeof v === 'string' && v.length <= (f.max || 200),
  bool: (v) => typeof v === 'boolean',
  int: (v, f) => Number.isInteger(v) && v >= (f.min ?? -1e9) && v <= (f.max ?? 1e9),
  enum: (v, f) => f.options.includes(v),
  date: isDate, tz: isTz,
  days: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 7 && new Set(v).size === v.length && v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7),
  times: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 12 && new Set(v).size === v.length && v.every(isTime),
  competitors: (v) => Number.isInteger(v) && v >= 1 && v <= 10000,
  language: (v) => typeof v === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(v),
  id: (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(v),
};

// partial = an override object: only the keys present are checked and none is filled in. Otherwise missing keys take their defaults.
export function validateSettings(input, { partial = false } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: [{ path: '', message: 'settings must be an object' }], clean: null };
  const clean = partial ? {} : defaults();
  for (const path of leafPaths(input)) {
    const f = BY_PATH.get(path), v = getPath(input, path);
    if (!f) { errors.push({ path, message: 'unknown setting' }); continue; }
    if (v === null) { if (f.nullable) setPath(clean, path, null); else errors.push({ path, message: 'cannot be empty' }); continue; }
    if (!CHECKS[f.type](v, f)) { errors.push({ path, message: `${f.label}: not a valid value` }); continue; }
    setPath(clean, path, v);
  }
  if (!partial) {
    const t = clean.targets;
    if (t.start_date && t.end_date && t.end_date < t.start_date) errors.push({ path: 'targets.end_date', message: 'the end date is before the start date' });
  }
  return { ok: errors.length === 0, errors, clean: errors.length ? null : clean };
}

// ---------------------------------------------------------------- inheritance: layers root > leaf, the deeper layer wins, per setting
// layers: [{ label, settings }] in order from Global down to the channel/product. Returns the merged settings and, for every setting,
// which layer decided it, so a founder can always see where a value comes from.
export function mergeLayers(layers) {
  const settings = {}, provenance = {};
  for (const l of layers) for (const p of leafPaths(l.settings || {})) { setPath(settings, p, structuredClone(getPath(l.settings, p))); provenance[p] = l.label; }
  return { settings, provenance };
}

// ---------------------------------------------------------------- dynamic variables
export const VARIABLES = {
  house_name: 'The House this work belongs to', team_name: 'The team', subteam_name: 'The subteam', category_name: 'The category',
  product_name: 'The product', channel_name: 'The channel', content_type: 'The kind of deliverable', target_audience: 'Who it is for',
  daily_target: 'The daily production target', research_depth: 'The configured research depth', reference_assets: 'The references COCO should learn from',
  brand_guidelines: 'The brand guidelines',
};
export const OPTIONAL_VARIABLES = new Set(['reference_assets', 'brand_guidelines']);   // resolve to an explicit "(none)" instead of blocking
const VAR_RE = /\{\{([^{}]*)\}\}/g;
export function extractVariables(text) {
  const used = new Set(), unknown = new Set(), malformed = [];
  const s = String(text || '');
  for (const m of s.matchAll(VAR_RE)) {
    const name = m[1].trim();
    if (!/^[a-z][a-z_]{1,40}$/.test(name)) { malformed.push(m[0].slice(0, 40)); continue; }
    if (name in VARIABLES) used.add(name); else unknown.add(name);
  }
  const opens = (s.match(/\{\{/g) || []).length, closes = (s.match(/\}\}/g) || []).length;
  if (opens !== closes || opens !== [...s.matchAll(VAR_RE)].length) malformed.push('unbalanced {{ }}');
  return { used: [...used].sort(), unknown: [...unknown].sort(), malformed: [...new Set(malformed)] };
}
// Our own envelope tags can never be forged from inside prompt text, a reference or a variable value.
export const neutralize = (t) => String(t ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/<(\/?)(SYSTEM|BRAIN_INSTRUCTIONS|TEMPLATE_SETTINGS|OPERATOR_PROMPT|REFERENCES|TASK)>/gi, '‹$1$2›');
// Single pass: a value is inserted as plain text and never expanded again, so a variable's content can not smuggle in another variable.
export function resolveText(text, values) {
  const unresolved = new Set();
  const out = String(text || '').replace(VAR_RE, (whole, raw) => {
    const name = raw.trim();
    if (!(name in VARIABLES)) return whole;
    const v = values[name];
    if (v === undefined || v === null || String(v).trim() === '') { if (OPTIONAL_VARIABLES.has(name)) return '(none provided)'; unresolved.add(name); return whole; }
    return neutralize(v);
  });
  return { text: out, unresolved: [...unresolved].sort() };
}

// ---------------------------------------------------------------- prompt sections
export const PROMPT_SECTIONS = [['objective', 'Main objective'], ['research', 'Research instructions'], ['reference_analysis', 'Reference analysis'], ['content', 'Content creation'],
  ['style_quality', 'Style and quality'], ['output', 'Output requirements'], ['publishing', 'Publishing instructions'], ['platform', 'Platform-specific instructions'], ['restrictions', 'Restrictions and safety rules']];
const SECTION_IDS = new Set(PROMPT_SECTIONS.map(([id]) => id));
export const MAX_SECTION = 20000, MAX_FULL = 60000;

export function composeOperatorPrompt({ sections = {}, full_text = '' } = {}) {
  const parts = [];
  if (String(full_text).trim()) parts.push(String(full_text).trim());
  for (const [id, label] of PROMPT_SECTIONS) if (String(sections[id] || '').trim()) parts.push(`## ${label}\n${String(sections[id]).trim()}`);
  return parts.join('\n\n');
}
// Pasted text may carry the section headings ("## Main objective"): split on them; otherwise the whole text is one block.
export function parseImportedPrompt(text) {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const names = new Map(PROMPT_SECTIONS.flatMap(([id, label]) => [[label.toLowerCase(), id], [id, id], [id.replace(/_/g, ' '), id]]));
  const lines = src.split('\n'), sections = {}; let head = [], cur = null, found = false;
  for (const line of lines) {
    const m = line.match(/^#{1,4}\s*(.+?)\s*:?\s*$/);
    const id = m && names.get(m[1].toLowerCase());
    if (id) { cur = id; found = true; sections[id] = sections[id] ? sections[id] + '\n' : ''; continue; }
    if (cur) sections[cur] += (sections[cur] ? '\n' : '') + line; else head.push(line);
  }
  if (!found) return { sections: {}, full_text: src.trim() };
  for (const k of Object.keys(sections)) sections[k] = sections[k].trim();
  return { sections, full_text: head.join('\n').trim() };
}
// What may be saved as a prompt version: known sections, sane sizes, only known well-formed variables, and no credential-shaped text.
export function validatePrompt({ sections = {}, full_text = '' } = {}) {
  const errors = [];
  if (typeof full_text !== 'string' || full_text.length > MAX_FULL) errors.push({ path: 'full_text', message: `the prompt text must be at most ${MAX_FULL} characters` });
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return { ok: false, errors: [{ path: 'sections', message: 'sections must be an object' }], variables: [] };
  for (const [k, v] of Object.entries(sections)) {
    if (!SECTION_IDS.has(k)) errors.push({ path: `sections.${k}`, message: 'unknown prompt section' });
    else if (typeof v !== 'string' || v.length > MAX_SECTION) errors.push({ path: `sections.${k}`, message: `at most ${MAX_SECTION} characters` });
  }
  const all = composeOperatorPrompt({ sections, full_text });
  if (!all.trim()) errors.push({ path: '', message: 'the prompt is empty' });
  const vars = extractVariables(all);
  for (const u of vars.unknown) errors.push({ path: 'variables', message: `{{${u}}} is not a known variable` });
  for (const m of vars.malformed) errors.push({ path: 'variables', message: `${m} is not a valid variable` });
  const found = redactText(all).findings || [];
  if (found.length) errors.push({ path: 'secrets', message: `the prompt contains what looks like a credential (${[...new Set(found)].join(', ')}). Keep secrets out of prompt text: connect the account in Integrations instead.` });
  return { ok: errors.length === 0, errors, variables: vars.used };
}
// Signals worth showing a founder; they never change what the system does (the policy header and the gates are fixed in code).
export function promptWarnings(text) {
  const w = [];
  if (/ignore (all |any )?(previous|prior|above) (instructions|rules)|disregard (the )?(system|policy)|you are now|jailbreak/i.test(text)) w.push('The prompt tries to override earlier instructions. It is treated as plain data and cannot change policies, permissions, approvals or budgets.');
  if (/\b(rm -rf|curl |wget |powershell|bash -c|exec\(|child_process)\b/i.test(text)) w.push('The prompt mentions shell commands. Prompts never run commands.');
  return w;
}

// ---------------------------------------------------------------- what the form shows
export function schemaForUi() {
  const sections = {};
  for (const f of FIELDS) (sections[f.section] ??= { id: f.section, label: SECTION_LABEL[f.section] || f.section, fields: [] }).fields.push(
    { path: f.path, label: f.label, type: f.type, options: f.options || null, min: f.min ?? null, max: f.max ?? null, nullable: !!f.nullable, families: f.families || null, deliverable: f.deliverable || null, help: f.help || '', default: f.default });
  return { sections: Object.values(sections), levels: LEVELS, deliverables: DELIVERABLES.map((d) => ({ id: d, label: DELIVERABLE_LABEL[d], family: FAMILY[d] })), variables: VARIABLES,
    optional_variables: [...OPTIONAL_VARIABLES], prompt_sections: PROMPT_SECTIONS.map(([id, label]) => ({ id, label })), learn_goals: LEARN_GOALS, qa_checks: QA_CHECKS.map((id) => ({ id, label: QA_LABEL[id], families: QA_FAMILIES[id] || null })),
    competitor_presets: COMPETITOR_PRESETS, models: MODELS };
}
// the fields a form shows for this template: those relevant to its kind of deliverable (and, for targets, only the deliverables that matter)
export function relevantFields(settings) {
  const fam = familyOf(settings), main = settings?.basics?.content_type;
  return FIELDS.filter((f) => (!f.families || f.families.includes(fam)) && (!f.deliverable || f.deliverable === main || f.deliverable === 'other' || (settings?.targets?.deliverables?.[f.deliverable] && Object.values(settings.targets.deliverables[f.deliverable]).some((x) => x))));
}
