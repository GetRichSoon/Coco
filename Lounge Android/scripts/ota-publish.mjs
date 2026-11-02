#!/usr/bin/env node
// After the cloud build: the version from build.gradle.kts and the sha256 of the APK, as one JSON
// line, for the release step. The phone checks that sha256 before Android installs anything.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apk = process.argv[2]; if (!apk || !fs.existsSync(apk)) { console.error('usage: ota-publish.mjs <apk>'); process.exit(2); }
const gradle = fs.readFileSync(path.join(here, '..', 'app', 'build.gradle.kts'), 'utf8');
const versionCode = Number(gradle.match(/versionCode = (\d+)/)[1]);
const versionName = gradle.match(/versionName = "([^"]+)"/)[1];
const bytes = fs.readFileSync(apk);
console.log(JSON.stringify({ versionCode, versionName, file: `coco-lounge-${versionCode}.apk`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, at: new Date().toISOString() }));
