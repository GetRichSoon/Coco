// Coco Core: serves the Coco app and its memory on the PC (port 7777).
// On this PC no PIN is needed; phones on the Wi-Fi use the PIN in Coco Vault.
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { ROOT, loadBrain, update, firstHome } from './brain.mjs';
import { importNova } from './import-nova.mjs';

const PORT = +(process.env.COCO_PORT || 7777);
const VAULT = firstHome(process.env.COCO_VAULT, join(ROOT, '..', 'Coco Vault'), 'C:/Users/Lenovo/Coco Vault');
const NOVA = firstHome(process.env.NOVA_HQ, join(ROOT, '..', 'Coco HQ'), 'C:/Users/Lenovo/nova-hq');
const FACE = join(ROOT, 'face');
const SECRETS = firstHome(join(VAULT, 'Nova Live Keys'), 'C:/Users/Lenovo/.nova-secrets');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

export function appPin() {
  const f = join(VAULT, 'Coco Keys', 'Coco App PIN.txt');
  if (!existsSync(f)) { mkdirSync(join(VAULT, 'Coco Keys'), { recursive: true }); writeFileSync(f, String(Math.floor(100000 + Math.random() * 900000))); }
  return readFileSync(f, 'utf8').trim();
}

// Key files are checked for presence only; values are never sent anywhere.
function hasKey(file, name) {
  try { return new RegExp(`^\\s*${name}\\s*=\\s*\\S+`, 'm').test(readFileSync(file, 'utf8')); } catch { return false; }
}

export function liveConnections(brain) {
  const keys = join(VAULT, 'Coco Keys');
  const yt = existsSync(join(keys, 'YouTube The Flow.env')) || existsSync(join(SECRETS, 'youtube.env'));
  const cwsFile = existsSync(join(keys, 'Chrome Web Store.env')) ? join(keys, 'Chrome Web Store.env') : join(SECRETS, 'chrome-store.env');
  const cwsToken = hasKey(cwsFile, '\\w*REFRESH_TOKEN');
  return (brain.connections || []).map(c => {
    if (c.id === 'youtube') return { ...c, state: yt ? 'connected' : 'missing', detail: yt ? `${c.detail || 'The Flow'} · keys in Coco Vault` : 'Keys missing' };
    if (c.id === 'chrome-store') return { ...c, state: cwsToken ? 'connected' : existsSync(cwsFile) ? 'almost' : 'missing',
      detail: cwsToken ? 'Ready to publish (after your YES)' : 'Keys saved. One-time Google login still needed.' };
    return { ...c, state: /^connected/.test(c.state) ? 'connected' : c.state === 'partial' ? 'almost' : 'off' };
  });
}

function lanUrl() {
  for (const list of Object.values(networkInterfaces())) for (const n of list || [])
    if (n.family === 'IPv4' && !n.internal && /^(192\.168|10\.|172\.)/.test(n.address)) return `http://${n.address}:${PORT}`;
  return null;
}

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const body = (req) => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const say = (b, from, to, text) => (b.history = b.history || []).push({ at: new Date().toISOString(), from, to, text });

// Hand work to the Nova team that already runs on the Laptop Terminal.
function toNovaTeam(team, text) {
  const script = { youtube: 'yt-brain.mjs', extensions: 'ext-brain.mjs' }[team];
  if (!script || !existsSync(join(NOVA, 'scripts', script))) return Promise.resolve(false);
  return new Promise(r => execFile('node', [join(NOVA, 'scripts', script), 'send', 'request', text, '--from', 'coco'], { cwd: NOVA, timeout: 20000 }, (e) => r(!e)));
}

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    if (!isLocal(req) && req.headers['x-coco-pin'] !== appPin()) return send(res, 401, { error: 'PIN needed' });
    const b = loadBrain();
    if (req.method === 'GET' && url.pathname === '/api/brain')
      return send(res, 200, { ...b, connections: liveConnections(b), phoneUrl: lanUrl() });
    if (req.method === 'POST' && url.pathname === '/api/refresh') { importNova(); return send(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/api/approve') {
      const { key, answer, by } = await body(req);
      const who = by === 'shreya' ? 'Shreya' : 'Mangesh';
      let found = null;
      update(x => {
        found = (x.approvals || []).find(a => a.key === key);
        if (!found) return;
        Object.assign(found, { state: answer === 'yes' ? 'approved' : 'rejected', status: `${answer === 'yes' ? 'APPROVED' : 'REJECTED'} (${who}) in Coco`, decidedBy: who, from: 'coco' });
        (x.decisions = x.decisions || []).push({ date: new Date().toISOString().slice(0, 10), by: who, text: `${answer === 'yes' ? 'YES' : 'NO'} ${found.id}: ${found.what.slice(0, 160)}`, from: 'coco' });
        say(x, who.toLowerCase(), 'coco', `${answer === 'yes' ? 'YES' : 'NO'} ${found.id}`);
      });
      return found ? send(res, 200, { ok: true }) : send(res, 404, { error: 'not found' });
    }
    if (req.method === 'POST' && url.pathname === '/api/task') {
      const { team, title, by } = await body(req);
      if (!team || !title) return send(res, 400, { error: 'team and title needed' });
      const handed = await toNovaTeam(team, title);
      update(x => {
        (x.tasks = x.tasks || []).unshift({ id: `c${Date.now().toString(36)}`, title, team, status: handed ? 'sent to team' : 'queued', created: new Date().toISOString(), from: 'coco', by: by || 'mangesh' });
        say(x, by || 'mangesh', team, title);
      });
      return send(res, 200, { ok: true, handed });
    }
    return send(res, 404, { error: 'unknown' });
  }
  // the app itself
  const path = normalize(join(FACE, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!path.startsWith(FACE) || !existsSync(path)) return send(res, 404, 'Not found', 'text/plain');
  send(res, 200, readFileSync(path), TYPES[extname(path)] || 'application/octet-stream');
}

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  if (!existsSync(join(ROOT, 'memory', 'brain.json'))) importNova();
  createServer(handle).listen(PORT, '0.0.0.0', () => {
    console.log(`Coco is awake on http://localhost:${PORT}`);
    const lan = lanUrl(); if (lan) console.log(`Phone (same Wi-Fi): ${lan}  · PIN in Coco Vault\\Coco Keys\\Coco App PIN.txt`);
  });
}
