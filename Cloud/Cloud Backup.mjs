// CANONICAL BACKUP (2026-11-01). The one scheduled backup of Coco Cloud. The repo's scripts/cloud-backup.mjs is a
// manual full export (adds pulse, schema, function sources and a verified manifest) and is not scheduled; its
// extras are to be folded in here in Step 2. Known gap: this needs Google Drive Desktop running (G: mounted).
// Nightly Coco Cloud backup (founder YES 2026-10-25: code on GitHub, live data in Supabase, backups on Google Drive).
// 1. Every Coco Cloud table goes to Google Drive as JSON: one folder per weekday (overwritten each week) plus a monthly copy on the 1st.
// 2. Release APKs that Drive does not have yet are copied to Drive "APK Archive" (copy only, never deletes).
// 3. One activity line in Coco: backed up, or failed and why.
// Run: node "Cloud Backup.mjs"   (scheduled task "Coco Cloud Backup", daily 23:30)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = 'https://bfnhnkxvppqmklfpslfm.supabase.co';
const HOME = os.homedir();
const KEY = (fs.readFileSync(path.join(HOME, 'Good Space', 'Coco Vault', 'Coco Keys', 'Coco Cloud Service Key.txt'), 'utf8').match(/(eyJ[\w.-]+|sb_secret_[\w-]+)/) || [])[1];
if (!KEY) { console.error('Coco Cloud service key missing'); process.exit(1); }
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const DRIVE = 'G:\\My Drive\\Good Space Backup';
const SKIP = new Set(['pulse']); // heartbeat telemetry: grows fast, no business value, would eat the free egress
const RELEASES = [
  path.join(HOME, 'Good Space', 'Coco', 'Lounge Android', 'Releases'),
  path.join(HOME, 'nova-hq', 'apps', 'nova-island', 'Releases'),
];

async function log(action, detail) {
  await fetch(`${URL}/rest/v1/activity`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify([{ actor: 'Coco', device_id: 'mangesh-pc', at: new Date().toISOString(), action, detail }]),
  }).catch(() => {});
}

async function rowsOf(table) {
  const rows = [];
  let total;
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1000&offset=${from}`, { headers: { ...H, prefer: 'count=exact' } });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    total ??= Number((r.headers.get('content-range') || '').split('/')[1]);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  // Self-check: a backup that silently misses rows is worse than none.
  if (Number.isFinite(total) && rows.length !== total) throw new Error(`${table}: got ${rows.length} of ${total} rows`);
  return rows;
}

function archiveApks() {
  const dir = path.join(DRIVE, 'APK Archive');
  fs.mkdirSync(dir, { recursive: true });
  let copied = 0;
  for (const src of RELEASES) {
    if (!fs.existsSync(src)) continue;
    for (const f of fs.readdirSync(src).filter((n) => n.toLowerCase().endsWith('.apk'))) {
      const from = path.join(src, f);
      const to = path.join(dir, f);
      if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
      fs.copyFileSync(from, to);
      copied++;
    }
  }
  return copied;
}

try {
  if (!fs.existsSync('G:\\My Drive')) throw new Error('Google Drive (G:) is not connected');
  const spec = await (await fetch(`${URL}/rest/v1/`, { headers: H })).json();
  const tables = Object.keys(spec.definitions || {}).filter((t) => !SKIP.has(t)).sort();
  if (!tables.length) throw new Error('no tables found in Coco Cloud');

  const now = new Date();
  const day = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const targets = [path.join(DRIVE, 'Coco Cloud', day)];
  if (now.getDate() === 1) targets.push(path.join(DRIVE, 'Coco Cloud', `${now.getFullYear()} ${String(now.getMonth() + 1).padStart(2, '0')}`));

  const counts = {};
  for (const t of tables) {
    const rows = await rowsOf(t);
    counts[t] = rows.length;
    for (const dir of targets) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 1));
    }
  }
  for (const dir of targets) fs.writeFileSync(path.join(dir, 'backup info.json'), JSON.stringify({ at: now.toISOString(), skipped: [...SKIP], counts }, null, 1));

  const apks = archiveApks();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const line = `Backed up ${tables.length} tables (${total} rows) to Drive > Good Space Backup > Coco Cloud > ${day}${apks ? `; ${apks} new APK(s) archived` : ''}.`;
  console.log(line);
  await log('Coco Cloud backup', line);
} catch (e) {
  console.error(e);
  await log('Coco Cloud backup failed', String(e.message || e));
  process.exitCode = 1;
}
