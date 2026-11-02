#!/usr/bin/env node
// After the cloud build: put the APK in B2 under its version and write Lounge/ota/latest.json with
// the version, the storage key and the sha256. No download link is written anywhere: Nova mints a
// short-lived one for a paired device at /api/apk/latest, and the phone verifies the sha256 before
// Android installs. Env: STORAGE_* (the adapter's).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStorage, configFromEnv } from './storage.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const apk = process.argv[2]; if (!apk || !fs.existsSync(apk)) { console.error('usage: ota-publish.mjs <apk>'); process.exit(2); }
const gradle = fs.readFileSync(path.join(here, '..', 'app', 'build.gradle.kts'), 'utf8');
const versionCode = Number(gradle.match(/versionCode = (\d+)/)[1]);
const versionName = gradle.match(/versionName = "([^"]+)"/)[1];
const bytes = fs.readFileSync(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const S = createStorage(configFromEnv());
const key = `dist/android/${versionCode}/coco-lounge-${versionCode}.apk`;
await S.put(key, bytes, { contentType: 'application/vnd.android.package-archive' });
const head = await S.head(key); if (!head || head.sha256 !== sha256) throw new Error('upload did not verify');
const meta = { versionCode, versionName, file: `coco-lounge-${versionCode}.apk`, key, sha256, bytes: bytes.length, at: new Date().toISOString() };
const out = path.join(here, '..', '..', 'Lounge', 'ota', 'latest.json');
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(meta));
