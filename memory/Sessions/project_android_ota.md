---
name: android-ota
description: Coco Lounge Android updates over the air since 2026-11-02: android-ota.yml (Coco repo) builds with the phones' debug key and publishes a GitHub release android-<ver>-<code>; Nova /api/apk/latest serves it; updater checks sha256; version 2.9.2 code 19
metadata:
  type: project
---

The phone app updates itself without cable, store or Supabase storage (built 2026-11-02, Coco repo commit 0a0ed9b). Push touching `Lounge Android/app/**` or `Lounge/release.json` on cloud-foundation runs .github/workflows/android-ota.yml: release.test.js, debug keystore from ANDROID_DEBUG_KEYSTORE_BASE64, assembleDebug, `gh release create android-<versionName>-<versionCode>` with the APK and the sha256 in the notes. Nova's /api/apk/latest (device-key auth) reads the newest such release from the public GitHub API and returns {versionCode, versionName, url, sha256}; Updater.kt in Nova mode asks that first, verifies sha256, then Android installs. Every release needs versionCode > the last and release.json kept in step (release.test.js).

**Why:** the installed updater called Supabase Auth first (dead, 402), so phones could never update by themselves; the B2 route needed storage secrets the Coco repo holds mis-pasted and Nova lacks.

**How to apply:** 2.9.2 (19) is the first build on this path; the phones must get it once by hand (release link https://github.com/GetRichSoon/Coco/releases/tag/android-2.9.2-19 or cable). After that each build arrives over the air. Signature caveat: the CI debug key must equal the key the phone's current build was signed with, else Android refuses the install until an uninstall. See [[nova-control-api]].
