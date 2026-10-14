// Backup only: Coco Cloud (function coco-chat) answers chat first; this local AI steps in only for messages
// still unanswered after 45 seconds.
// Coco Gatekeeper: the free local AI (Ollama on this PC) reads every new chat message first.
// Easy things (greetings, status, simple questions) it answers itself; real work becomes a task
// for the Coco Engine (Claude). Founder idea, 2026-10-15. Token Treasury rule 2.
// Runs on Boss PC; reads the engine key from the vault at start and never prints it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT_KEY = path.join(HERE, '..', '..', 'Coco Vault', 'Coco Keys', 'Coco Engine Key.txt');
const URL_ = 'https://bfnhnkxvppqmklfpslfm.supabase.co/rest/v1/';
const ANON = 'sb_publishable_had-6h5KG1epTVwISeuWbg_IKg7IO1s';
const OLLAMA = 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.COCO_GATE_MODEL || 'gemma3:4b';
const LOG = path.join(HERE, 'Gatekeeper Log.txt');

const raw = fs.readFileSync(VAULT_KEY, 'utf8');
const KEY = (raw.match(/COCO_ENGINE_KEY\s*[=:]\s*(\S+)/) || raw.match(/\b([A-Za-z0-9_\-]{24,})\b/) || [])[1];
if (!KEY) { console.error('No engine key found in the vault file'); process.exit(1); }
const H = { apikey: ANON, authorization: `Bearer ${ANON}`, 'x-engine-key': KEY, 'content-type': 'application/json' };

const log = (s) => { const line = `${new Date().toISOString()} ${s}\n`; process.stdout.write(line); try { fs.appendFileSync(LOG, line); } catch {} };
async function rest(p, opt = {}) {
  const r = await fetch(URL_ + p, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const patch = (p, body) => rest(p, { method: 'PATCH', body: JSON.stringify(body), headers: { prefer: 'return=minimal' } });
const insert = (t, body) => rest(t, { method: 'POST', body: JSON.stringify(body), headers: { prefer: 'return=representation' } });

const SYSTEM = `You are Coco, the manager of the company Good Space, owned by Mangesh (call him "Boss") and Shreya (call her "Big Boss").
Houses (main teams): Gigi (content, YouTube), Lulu (products: Chrome extensions, Play apps), Fifi (downloads), Zaza (Roblox games).
Support team, the Bonbon Club: Lola ideas, Lili research, Remy builds, Vivi design, Margot writes, Cleo videos, Elise QA, Kiki growth, Didi customer care, Bibi money.
Always address Mangesh as "Boss" and Shreya as "Big Boss", never by first name. Talk like a warm voice assistant: 1 to 3 short sentences, in the same language the founder used (Hindi, Hinglish or English). Never invent facts or numbers.
To control a PC or phone (play songs, open apps, volume, lock), the founder uses the Remote tab; tell them that.
Answer with JSON only: {"reply": "...", "needs_work": true|false, "task_title": "...", "house": "gigi|lulu|fifi|zaza|coco"}.
needs_work is true only when the message asks for real work (build, write, research, make a video, fix, plan). Then reply says which team will do it and that it is on the Board.`;

async function context() {
  const [houses, devices, recent, tasks] = await Promise.all([
    rest('houses?select=name,state,doing'), rest('devices?select=name,last_seen'),
    rest('chat?select=role,author,body&order=id.desc&limit=8'), rest('tasks?select=title,status&order=created_at.desc&limit=6'),
  ]);
  const on = devices.filter((d) => d.last_seen && Date.now() - new Date(d.last_seen) < 150000).map((d) => d.name);
  return { facts: `Houses: ${houses.map((h) => `${h.name} (${h.state}): ${h.doing || ''}`).join('; ')}\nDevices online: ${on.join(', ') || 'none'}\nLatest tasks: ${tasks.map((t) => `${t.title} [${t.status}]`).join('; ') || 'none'}\nTime in India: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, recent: recent.reverse() };
}

async function think(msg) {
  const { facts, recent } = await context();
  const messages = [{ role: 'system', content: SYSTEM + '\n\nFacts right now:\n' + facts },
    ...recent.slice(0, -1).map((m) => ({ role: m.role === 'coco' ? 'assistant' : 'user', content: m.body })),
    { role: 'user', content: `${/shreya/i.test(msg.author) ? 'Big Boss (Shreya)' : 'Boss (Mangesh)'} says: ${msg.body}` }];
  const r = await fetch(OLLAMA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, messages, format: 'json', stream: false, options: { temperature: 0.4 } }) });
  const out = JSON.parse((await r.json()).message.content);
  return { reply: String(out.reply || '').slice(0, 600).trim(), needsWork: !!out.needs_work, title: String(out.task_title || '').slice(0, 140), house: ['gigi', 'lulu', 'fifi', 'zaza'].includes(out.house) ? out.house : null };
}

async function handle(msg) {
  await patch(`chat?id=eq.${msg.id}&status=eq.new`, { status: 'thinking', handled_by: 'gatekeeper' });
  let a;
  try { a = await think(msg); } catch (e) { log(`think failed #${msg.id}: ${e.message}`); a = { reply: 'I got your message. My local brain is busy, the Coco Engine will answer soon.', needsWork: false }; }
  let taskId = null;
  if (a.needsWork) {
    const [t] = await insert('tasks', { title: a.title || msg.body.slice(0, 120), details: `From chat (${msg.author}): ${msg.body}`, house_id: a.house, needs: 'cloud', created_by: `${msg.author} via Coco chat`, ai_checked: true });
    taskId = t && t.id;
  }
  await insert('chat', { role: 'coco', author: 'Coco', body: a.reply || 'Got it.', reply_to: msg.id, status: 'answered', task_id: taskId, handled_by: 'gatekeeper' });
  await patch(`chat?id=eq.${msg.id}`, { status: 'answered', task_id: taskId });
  log(`#${msg.id} ${a.needsWork ? 'task ' + taskId : 'answered'}: ${a.reply.slice(0, 80)}`);
}

let busy = false;
async function tick() {
  if (busy) return; busy = true;
  try {
    const fresh = await rest('chat?select=id,author,body,created_at&role=eq.founder&status=eq.new&created_at=lt.' + new Date(Date.now() - 45000).toISOString() + '&order=id.asc&limit=5');
    for (const m of fresh) await handle(m);
  } catch (e) { log('tick: ' + e.message); } finally { busy = false; }
}
log(`Coco Gatekeeper started with ${MODEL}`);
tick(); setInterval(tick, 4000);
