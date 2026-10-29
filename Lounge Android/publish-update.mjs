// Publish a new Coco Lounge phone build to Coco Cloud; both phones pick it up and install it themselves (Boss, 2026-10-21).
// Usage: node publish-update.mjs        (after gradlew assembleRelease)
// Needs the Supabase service key in Coco Vault\Coco Keys\Coco Cloud Service Key.txt (never printed, never in git).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = 'https://bfnhnkxvppqmklfpslfm.supabase.co';
// In the cloud the key is the SUPABASE_SERVICE_KEY secret; on a laptop it is the vault file. Env first,
// so a CI run never depends on a file that only exists on one of the two PCs.
const vault = path.join(HERE, '..', '..', 'Coco Vault', 'Coco Keys', 'Coco Cloud Service Key.txt');
const KEY = process.env.SUPABASE_SERVICE_KEY
  || (fs.existsSync(vault) ? (fs.readFileSync(vault, 'utf8').match(/(eyJ[\w.-]+|sb_secret_[\w-]+)/) || [])[1] : null);
if (!KEY) { console.error(`Service key missing: set SUPABASE_SERVICE_KEY, or put it in ${vault}`); process.exit(1); }

// --pending writes controls/apk_pending instead of controls/apk_latest. It exists for exactly one
// situation: a build signed with a different key from the one the phones already carry. Android refuses
// such an update, and the installed app, told about it through apk_latest, would download the APK, be
// refused, delete it and try again every 15 minutes for as long as the row said so. So the first build
// after a key change is announced as pending, the founders uninstall and reinstall once by hand, and
// only then is the row promoted to apk_latest - after which every later release updates by itself again.
const ROW = process.argv.includes('--pending') ? 'apk_pending' : 'apk_latest';

const gradle = fs.readFileSync(path.join(HERE, 'app', 'build.gradle.kts'), 'utf8');
const versionCode = Number(gradle.match(/versionCode = (\d+)/)[1]);
const versionName = gradle.match(/versionName = "([^"]+)"/)[1];
const apk = path.join(HERE, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apk)) { console.error('Build first: gradlew assembleRelease'); process.exit(1); }
const file = `coco-lounge-${versionCode}.apk`;

async function put(name, body, type) {
  const r = await fetch(`${URL}/storage/v1/object/apk/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': type, 'x-upsert': 'true' },
    body,
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
}

// APK first, then latest.json, so a phone never sees a version whose file is not there yet.
await put(file, fs.readFileSync(apk), 'application/vnd.android.package-archive');
await put('latest.json', JSON.stringify({ versionCode, versionName, file, at: new Date().toISOString() }), 'application/json');
// Announce it in controls/apk_latest with a download link valid for a year, so phones never depend on storage rules.
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
const signed = await (await fetch(`${URL}/storage/v1/object/sign/apk/${file}`, { method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 365 * 24 * 3600 }) })).json();
if (!signed.signedURL) throw new Error('Could not make the download link: ' + JSON.stringify(signed));
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
const row = { id: ROW, value: { versionCode, versionName, file, sha256, url: `${URL}/storage/v1${signed.signedURL}` }, updated_by: 'coco', updated_at: new Date().toISOString() };
const up = await fetch(`${URL}/rest/v1/controls`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
if (!up.ok) throw new Error('controls: ' + up.status + ' ' + await up.text());
console.log(`Published Coco Lounge ${versionName} (${versionCode}) as ${file} -> controls/${ROW}`);
console.log(`sha256 ${sha256}`);
if (ROW === 'apk_pending') console.log('Pending, not live: the phones will NOT offer this build until the row is promoted to apk_latest.');
