// POST /api/notes — Coco Idea Saver (and anything local) drops an idea into Coco Cloud notes.
// Key: Coco Cloud service key from Coco Vault, same pattern as nova-hq scripts/coco_log.mjs.
// The key and the cloud's error bodies are never sent back to the caller.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CLOUD = 'https://bfnhnkxvppqmklfpslfm.supabase.co';

export async function saveNote(b) {
  const kind = b.kind === 'link' ? 'link' : 'idea';
  const text = String(b.text || '').slice(0, 4000);
  const source_url = /^https?:\/\//.test(b.source_url || '') ? String(b.source_url).slice(0, 2000) : null;
  if (!text && !source_url) return { code: 400, ok: false, error: 'text or source_url needed' };
  let KEY;
  try { KEY = (readFileSync(join(homedir(), 'Good Space', 'Coco Vault', 'Coco Keys', 'Coco Cloud Service Key.txt'), 'utf8').match(/(eyJ[\w.-]+|sb_secret_[\w-]+)/) || [])[1]; } catch {}
  if (!KEY) return { code: 500, ok: false, error: 'Coco Cloud key missing' };
  const row = { kind, source_url, text, title: String(b.title || '').slice(0, 200) || null, status: 'new', created_by: 'mangesh', device_id: 'mangesh-pc' };
  const r = await fetch(`${CLOUD}/rest/v1/notes`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: JSON.stringify([row]),
  }).catch(() => null);
  if (!r || !r.ok) return { code: 502, ok: false, error: `cloud ${r ? r.status : 'unreachable'}` };
  return { code: 200, ok: true, id: (await r.json())[0]?.id };
}
