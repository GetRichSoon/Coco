# QA — Coco Lounge 2.8.2 (versionCode 16) — VERDICT: PASS

Gate (release QA), 2026-10-26. Built by Nono (commit 7ee07bc); QA by a different agent as required.
APK: `app\build\outputs\apk\release\app-release.apk`

## BLOCKERS
None.

## MAJOR
None.

## MINOR
1. Signed with the Android Debug certificate (CN=Android Debug). Identical to every previous
   release (2.7 checked, SHA-256 `326f4e2c…3d45`), so updates install fine on the founders'
   phones — but a proper release keystore should be created before this ever goes near a store.
2. `Releases\` has no 2.8.1 APK (latest kept is 2.7). Permission baseline was verified two ways
   instead: diff vs 2.7 APK + git history of AndroidManifest.xml.

## PASSED
1. **Unit tests green.** `gradlew test` BUILD SUCCESSFUL (JDK 17 via PyCharm JBR — note: plain
   `java` on PATH is 1.8 and fails the build; set JAVA_HOME). HealTest 5/5, HqTest 5/5,
   TalkTest 3/3, IslandRulesTest 27/27 — 40 tests, 0 failures, 0 skipped, debug+release variants.
2. **APK identity.** aapt: versionName 2.8.2, versionCode 16, package `com.goodspace.cocolounge`
   (unchanged). Permissions identical to 2.8.1: the 2.8.2 commit (7ee07bc) does not touch
   AndroidManifest.xml; the 5 permissions newer than 2.7 (VIBRATE, BLUETOOTH maxSdk30,
   BLUETOOTH_CONNECT, READ_CALENDAR, REQUEST_DELETE_PACKAGES) were all added in the 2.8.0
   commit 93fae97 and shipped already. No new permission in this release.
3. **Signature.** apksigner: signer cert of 2.8.2 byte-identical (SHA-256/SHA-1/MD5) to
   `Releases\Coco Lounge 2.7.apk`. Same key as all previous releases.
4. **Heal.kt static review.** One shared runner confirmed: `PhoneRemote.run` is called ONLY
   inside `Heal.runOne`; both the app (Lounge.kt:169) and the always-on service
   (Connected.kt:85) delegate to it — the duplicate runners are gone. Retry paths:
   `canRetry` requires `action in retrySafe` = {status, notify, open_app, open_url, ring};
   the sweeper requeue (Heal.kt:44) has the same `retrySafe` + `!_retried` + age guard.
   voice = {say, play_youtube, media, volume} is never in any retry/requeue path, and
   `ageLimitSec` gives voice 120 s (2 min expiry), lateOk 7200 s, others 600 s — exactly as
   specified, and locked in by HealTest.neverReplaysVoice. Double-run between app and service
   is prevented by `Heal.runKey` dedupe plus the conditional DB claim (`status=eq.queued`).
   Error notes are once-per-kind-per-day via SharedPreferences (`coco_heal`).
5. **No secrets in the APK.** Full unzip + strings scan for eyJ (JWT/legacy service keys),
   sb_secret_, sbp_, AIza, sk-, ghp_, PRIVATE KEY blocks: zero hits. Only the Supabase
   publishable key (`sb_publishable_…`, public by design) and the project URL are embedded.
6. **Emulator smoke test.** AVD `nova_test` booted headless; `adb install -r` Success;
   launcher intent started the app; process alive after 6 s; crash buffer clean for
   `com.goodspace.cocolounge` (only emulator-internal droid.bluetooth SIGABRTs, pre-existing);
   first-run notification-permission dialog on top as expected.

## Publish
Internal update channel (founders' two phones, private Coco Cloud bucket — approved path):
`node publish-update.mjs` run after this PASS → "Published Coco Lounge 2.8.2 (16) as
coco-lounge-16.apk". Verified independently: `controls/apk_latest` row now 2.8.2 (16),
updated 2026-10-26T12:21:24Z, and the signed download URL returns 200 with 4,171,198 bytes —
exactly the local APK size. Coco activity line logged (actor Gate, action release, 201 ok).
First install may need one tap on each phone.
