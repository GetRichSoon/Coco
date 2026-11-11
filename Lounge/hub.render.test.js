// Run: node hub.render.test.js
//
// Settings > Integrations & Connections, the 0041 parts, driven through the real page code (lifted out of index.html the
// same way connections.test.js does): per-account authorization facts, credentials by NAME only, cloud providers per
// capability, and the switch workflow whose only founder buttons are Approve (when the backup is verified and the checks
// passed) and Roll back.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const IDENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'identity.json'), 'utf8'));
const between = (a, b) => { const i = src.search(a), j = src.search(b); assert.ok(i > 0 && j > i, `lift failed ${a}`); return src.slice(i, j); };
const marksSrc = between(/\nlet IDENT = null;/, /\n\/\/ -+ control plane/);
const vStart = src.indexOf('const V = {');
const pagesSrc = src.slice(src.indexOf('{', vStart) + 1, src.indexOf('\n};', vStart));
const structSrc = between(/\n\/\/ -+ the company's shape\n/, /\n\/\/ 80% warning/);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CP = { teams: [{ id: 'youtube', name: 'YouTube Studio', subteams: [], categories: [], channels: [], agents: [], counts: {} }] };
const PROVIDERS = [{ id: 'youtube', platform: 'YouTube', state: 'connected' }];
const BASE = { connection_id: 'yt-the-flow', provider: 'youtube', external_name: 'The Flow', state: 'connected', secret_ref: 'youtube_refresh_token_the_flow',
  permissions: ['upload'], last_verified_at: '2026-11-10T00:00:00Z' };
const LINKS = [{ connection_id: 'yt-the-flow', integration_id: 'youtube', team_id: 'youtube', enabled: true }];

const page = ({ CONNS = [BASE], CREDS, CLOUD_PROV, SWITCHES } = {}) => new Function(
  'CP', 'LIVE', 'D', 'sub', 'cpRun', 'POLICIES', 'CONTROL_OPS', 'esc', 'chip', 'ago', 'store', 'IDENT_IN',
  'STRUCT', 'newKind', 'newParent', 'renaming', 'CONNS', 'CONN_LINKS', 'connAssign', 'connAdd', 'OUTPUTS',
  'OAUTH_PLATFORMS', 'connConnecting', 'connConnectingAt', 'serviceLogo', ...(CREDS ? ['CREDS', 'CLOUD_PROV', 'SWITCHES'] : []),
  `${marksSrc}\nIDENT = IDENT_IN;\n${structSrc}\nconst V = {\n${pagesSrc}\n};\nreturn V;`,
)(CP, null, { integrations: PROVIDERS, approvals: [] }, 'x', null, [], [], esc, (s) => `<span class="chip">${esc(s)}</span>`, () => '2 min ago',
  { get: () => null }, IDENT, [], 'subteam', {}, null, CONNS, LINKS, null, null, [], {}, null, 0, (id, name) => '<i>' + esc(name || id) + '</i>',
  ...(CREDS ? [CREDS, CLOUD_PROV || [], SWITCHES || []] : [])).connections();

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };

t('before 0041 is applied the page renders exactly as before, plus honest empty sections', () => {
  const html = page();
  assert.ok(!/authorization valid until|renewal|last successful request|To reconnect/.test(html));
  assert.ok(html.includes('The portable vault holds nothing yet') && html.includes('No cloud providers are registered yet') && html.includes('No provider switch has been planned'));
});

t('an account card says what the platform granted, until when, how renewal went, and how to reconnect', () => {
  const html = page({ CONNS: [{ ...BASE, scopes: ['a', 'b', 'c'], token_expires_at: '2099-01-01T00:00:00Z', refresh_state: 'ok', last_success_at: '2026-11-10T10:00:00Z',
    last_error: 'quota <b>exceeded</b>', reconnect_steps: 'Press Connect and pick The Flow on Google’s chooser.' }], CREDS: [] });
  assert.ok(html.includes('3 permissions granted by the platform') && html.includes('authorization valid until') && html.includes('renewal ok'));
  assert.ok(html.includes('last successful request') && html.includes('To reconnect: Press Connect'));
  assert.ok(html.includes('quota &lt;b&gt;exceeded&lt;/b&gt;'), 'provider text is escaped');
  assert.ok(page({ CONNS: [{ ...BASE, token_expires_at: '2020-01-01T00:00:00Z' }], CREDS: [] }).includes('authorization expired'));
});

t('credentials are listed by name with who may open them and who uses them; never a value; revoke only when active', () => {
  const html = page({ CREDS: [
    { name: 'youtube_refresh_token_the_flow', version: 2, status: 'active', consumers: ['nova.publish'], used_by: ['yt-the-flow'], last_read_at: '2026-11-10T00:00:00Z', ciphertext: 'CIPHER-SHOULD-NOT-SHOW' },
    { name: 'gumroad_access_token_poppy', version: 1, status: 'revoked', consumers: ['nova.publish'], used_by: [] }] });
  assert.ok(html.includes('youtube_refresh_token_the_flow') && html.includes('opened only by nova.publish') && html.includes('Used by yt-the-flow'));
  assert.ok(!html.includes('CIPHER-SHOULD-NOT-SHOW'), 'the screen never renders a vault field other than metadata');
  assert.equal((html.match(/data-credrevoke=/g) || []).length, 1);
  assert.ok(html.includes('data-credrevoke="youtube_refresh_token_the_flow"'));
});

t('cloud providers are grouped by capability with their role, adapter and state', () => {
  const html = page({ CREDS: [], CLOUD_PROV: [
    { id: 'supabase-legacy', capability: 'database', role: 'core', adapter: 'postgres', label: 'Supabase (legacy)', state: 'active' },
    { id: 'neon-core', capability: 'database', role: 'core', adapter: 'postgres', label: 'Neon goodspace-core', state: 'standby', notes: 'Target.' },
    { id: 'b2-media', capability: 'storage', role: 'media', adapter: 's3', label: 'Backblaze B2 goodspace-media', state: 'standby' }] });
  const db = html.indexOf('>database<'), st = html.indexOf('>storage<');
  assert.ok(db > 0 && st > db, 'one heading per capability');
  assert.ok(html.includes('Neon goodspace-core') && html.includes('core · postgres') && html.includes('media · s3') && html.includes('Target.'));
});

t('switch workflow: Approve appears only for a validated switch with a verified backup; Roll back while it is open', () => {
  const sw = (id, state, extra = {}) => ({ id, capability: 'database', role: 'core', from_provider: 'supabase-legacy', to_provider: 'neon-core', state, backup_verified: true, validation: { ok: true }, ...extra });
  const html = page({ CREDS: [], SWITCHES: [sw('a', 'validated'), sw('b', 'validated', { backup_verified: false }), sw('c', 'exported', { validation: {} }), sw('d', 'completed', { approved_by: 'boss@example.com' })] });
  assert.ok(html.includes('data-swapprove="a"') && !html.includes('data-swapprove="b"') && !html.includes('data-swapprove="c"') && !html.includes('data-swapprove="d"'));
  assert.ok(html.includes('data-swrollback="a"') && html.includes('data-swrollback="c"') && !html.includes('data-swrollback="d"'));
  assert.ok(html.includes('Backup NOT verified') && html.includes('checks not run yet') && html.includes('approved by boss@example.com'));
});

t('the founder actions go through the gated database functions, after a confirmation', () => {
  const op = src.slice(src.indexOf('async function hubOp('), src.indexOf('async function connectionOp('));
  assert.ok(op.includes("sb.rpc('coco_credential_revoke'") && op.includes("sb.rpc('coco_provider_switch'") && op.includes('confirm('));
  assert.ok(src.includes("sb.rpc('coco_credentials')"), 'credentials are read through the metadata function, never the vault table');
});

console.log(`hub render: ${pass}/6 passed`);
