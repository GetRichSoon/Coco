// Publish a new Coco Lounge phone build to Coco Cloud; both phones pick it up and install it themselves (Boss, 2026-10-21).
// Usage: node publish-update.mjs        (after gradlew assembleRelease)
// Needs the Supabase service key in Coco Vault\Coco Keys\Coco Cloud Service Key.txt (never printed, never in git).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = 'https://bfnhnkxvppqmklfpslfm.supabase.co';
const vault = path.join(HERE, '..', '..', 'Coco Vault', 'Coco Keys', 'Coco Cloud Service Key.txt');
const KEY = fs.existsSync(vault) ? (fs.readFileSync(vault, 'utf8').match(/(eyJ[\w.-]+|sb_secret_[\w-]+)/) || [])[1] : null;
if (!KEY) { console.error(`Service key missing: put it in ${vault}`); process.exit(1); }

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
console.log(`Published Coco Lounge ${versionName} (${versionCode}) as ${file}`);
