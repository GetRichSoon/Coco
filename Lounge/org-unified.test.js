// Run: node org-unified.test.js
// Drives the REAL ouPage() and the Structure page's tab bar, copied out of index.html, against org-unified.fixture.json:
// the dry-run organisation (production copy + 0034 + 0039 + 0040) exported by nova-hq os/cloud/company-structure/fixtures/export-ui.mjs.
// Desktop (Electron loads this index.html) and the PWA (the same file on Vercel) run this exact code, so one test covers both.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const grab = (head) => { const s = src.indexOf(head); assert.ok(s > 0, `${head} missing`); let i = src.indexOf('{', s), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; } return src.slice(s, i + 1); };
const ouPageSrc = grab('function ouPage() {'), structSrc = grab('  structure() {');
const OU_TABS = [['readiness', 'Readiness'], ['decisions', 'Decisions'], ['brains', 'Brains']];
assert.ok(src.includes("const OU_TABS = [['readiness', 'Readiness'], ['decisions', 'Decisions'], ['brains', 'Brains']];"));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fx = JSON.parse(fs.readFileSync(path.join(here, 'org-unified.fixture.json'), 'utf8'));
const run = (sub, ORG, OU) => new Function('sub', 'ORG', 'OU', 'OU_TABS', 'esc', 'ago', `${ouPageSrc}; return ouPage();`)(sub, ORG, OU, OU_TABS, esc, () => 'just now');
const ORG = { source: 'cloud', units: fx.units, products: fx.products, agents: [] };
const OU = { brains: { rows: fx.brains }, ready: { rows: fx.ready }, recon: { rows: fx.recon } };
let n = 0; const ok = (m) => console.log(`ok ${++n} - ${m}`);

// the tabs live on the existing Structure page (no second organisation page)
assert.ok(!src.includes("['org', 'Organisation'"), 'no separate Organisation page'); assert.ok(/\['structure', 'Structure', 'schema'\]/.test(src));
assert.ok(structSrc.includes('return bar + orgPage();') && structSrc.includes('return bar + ouPage();'));
assert.ok(src.includes('if (ds.orgdo) await orgDecide(ds.orgdo);') && src.includes('if (ds.orgtask) await orgTask();'));
ok('Readiness, Decisions and Brains are tabs of the existing Structure page; its own tree stays the Tree tab');

const notApplied = run('readiness', { source: 'dev', units: [] }, { brains: { err: 'relation "org_brains" does not exist' }, ready: {}, recon: {} });
assert.match(notApplied, /not applied in Coco Cloud yet/); assert.ok(!/<b>0<\/b><span>brains/.test(notApplied));
ok('before the migration the page says it is not applied (no fake zero counts)');

const r = run('readiness', ORG, OU);
assert.match(r, /<b>8<\/b><span>Houses/); assert.match(r, /<b>288<\/b><span>brains/); assert.match(r, /<b>33<\/b><span>decisions open/);
assert.match(r, /<b>67<\/b><span>ready for cloud work/); assert.ok(r.includes('data-orgtask="1"') && r.includes('<option value="lulu.diamond">'));
assert.ok(/Lulu[\s\S]*products \(\d+ ready for cloud work\)/.test(r)); assert.match(r, /It does not mean tested/);
ok('Readiness: 8 Houses, 288 brains, 67 ready for cloud work, 33 open decisions, per-House product counts, and a give-a-task bar over every unit');

const d = run('decisions', ORG, OU);
assert.equal((d.match(/data-orgdo="\d+\|merge"/g) || []).length, 33); assert.equal((d.match(/data-orgdo="\d+\|dismiss"/g) || []).length, 33);
const kahani = fx.recon.find((q) => q.legacy_id === '09a283e9-e8c1-4e2a-84ba-abbeb3f99601'); assert.ok(d.includes(`<select id="orgt-${kahani.id}">`) && d.includes('<option value="yt.kahani-ghar">Kahani Ghar TV (yt.kahani-ghar)</option>'));
const moveCount = (d.match(/\|move"/g) || []).length, unplacedTeams = fx.recon.filter((q) => q.canonical_kind === 'unit' && String(q.canonical_id || '').startsWith('coco.unplaced.')).length;
assert.equal(moveCount, unplacedTeams); assert.ok(moveCount > 0);
ok(`Decisions: 33 questions, each with evidence, candidates and Keep/Merge/Retire/Not now; "Move" only on the ${moveCount} unplaced teams`);

const evil = JSON.parse(JSON.stringify(OU)); evil.recon.rows[0] = { ...evil.recon.rows[0], question: '<img src=x onerror=alert(1)>' };
assert.ok(!run('decisions', ORG, evil).includes('<img src=x')); ok('question text is escaped');

const decided = JSON.parse(JSON.stringify(OU)); decided.recon.rows[0] = { ...decided.recon.rows[0], status: 'resolved', resolution: 'merge -> core', resolved_by: 'boss@x', resolved_at: '2026-11-10T12:00:00Z' };
const dd = run('decisions', ORG, decided); assert.match(dd, /32 open/); assert.match(dd, /Decided: merge -&gt; core/);
ok('a decided question leaves the open list and shows who decided what');

const b = run('brains', ORG, OU);
assert.match(b, /global<\/div><b>1<\/b>/); assert.match(b, /brain\.lulu &gt; brain\.coco/); assert.match(b, /brain\.gigi &gt; brain\.coco/);
ok('Brains: one global brain; every House brain routes to brain.coco');

const nova = fs.readFileSync(path.join(here, 'api', '_nova.js'), 'utf8');
const TABLES = nova.slice(nova.indexOf('export const TABLES'), nova.indexOf('export const RPCS')), RPCS = nova.slice(nova.indexOf('export const RPCS'), nova.indexOf('export const RPC_CREDENTIAL_OK'));
for (const t of ['org_units', 'org_products', 'org_brains', 'org_readiness', 'org_reconciliation_view', 'org_legacy_map']) assert.ok(TABLES.includes(`'${t}'`), `${t} not readable through Nova`);
assert.ok(RPCS.includes("'org_reconcile_decide'")); assert.ok(!TABLES.includes("'engine_keys'") && !TABLES.includes("'oauth_states'") && !TABLES.includes("'org_reconciliation'"));
ok('Nova: the app can read the organisation views and call org_reconcile_decide; engine_keys, oauth_states and the raw question table stay closed');
console.log(`\n${n} checks passed`);
