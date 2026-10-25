---
name: pc-storage-drive
description: "PC storage — Google Drive for desktop on G: (lokademangesh123, stream mode), PC Archive folder on Drive, Boss deletes originals himself"
metadata:
  node_type: memory
  type: project
  originSessionId: 5c4d9b4e-a663-4256-b1a0-2ec912acc008
  modified: 2026-10-25T13:35:46.923Z
---

- Google Drive for desktop runs on G: in stream mode, signed in as lokademangesh123@gmail.com.
- The plan is Google AI Pro 5 TB "offered through Jio", activated 2026-06-08. It replaced the student AI Pro 2 TB plan from 2025-08-15. Jio's offer runs 18 months while the Jio number stays on an Unlimited 5G plan (Rs 349+), so it ends around Dec 2027; the exact date is in MyJio. After that the free tier is 15 GB, with 226 GB in use (2026-10-25). Logged in Coco Integrations as `google-drive-pc`.
- The Gmail connector here is on clixyteams@gmail.com, not on Boss's account. To read his mail, use Chrome Profile 32 (lokademangesh123) through the Claude in Chrome extension. G:'s free space shows the local C: disk, not the Drive quota. The claude.ai Google Drive connector is on the same account, so use it to check that uploads arrived.
- 2026-10-25: these folders were copied to `G:\My Drive\PC Archive\` with throttled robocopy (34 GB): Videos\Captures, Downloads\Old Files From C, the two Downloads\takeout-20251023T132427Z folders, and Videos\Mangesh Photos And Videos. The originals stay on the PC until the upload is checked, then Boss deletes them himself. I may not permanently delete his files, and the photos folder (29 GB) is bigger than the C: Recycle Bin (about 26 GB).
- Cursor (AppData\Roaming\Cursor, 10.5 GB) is not mostly cache:
  - 7.2 GB is state.vscdb, which holds 435 AI chats and has no free pages.
  - About 0.6 GB is real cache.
  - About 2 GB is 9 old agent CLI versions.
  - The cache and the old versions are safe to clear on a YES. Projects live in their own folders.
- Split (Boss YES, 2026-10-25): code on GitHub, live app data in Supabase (Coco Cloud, free plan, no backups), backups and archives on Drive under `G:\My Drive\Good Space Backup\`.
  - Nightly at 23:30: `Good Space\Coco\Cloud\Cloud Backup.mjs` (task "Coco Cloud Backup") exports every table except `pulse` to `Coco Cloud\<weekday>`, archives APKs, and writes an activity line.
  - Vault: `Good Space\Coco Vault\Backup Coco Vault.cmd` (7-Zip AES; Boss types the password) covers the Vault and .nova-secrets. Boss skipped it on 2026-10-25, so no Vault backup exists yet; remind him later.
  - Old APKs stay in the Supabase `apk` bucket for now (391 MB of 1 GB); I don't hard-delete them.
- Drive for desktop can unmount G: on its own; it shut down cleanly at 18:19 on 2026-10-25. Fix: stop GoogleDriveFS, start `C:\Program Files\Google\Drive File Stream\<ver>\GoogleDriveFS.exe`, and wait about 25 s. Drive startup was off and is now on.
- PC speed (2026-10-25):
  - Turned off at startup: Edge auto-start (26 entries), uTorrent, Teams, Reallusion, WallpaperFlow. Undo: Task Manager, or `os/state/local/startup_before_2026_10_25.reg`.
  - Gradle daemon idle timeout is 10 minutes and Kotlin compiles in-process (`~/.gradle/gradle.properties`). Idle daemons had held about 5 GB.
- Still open: OneDrive 44.6 GB, either free up or move it.

**Why:** Boss wants C: freed and the PC faster (2026-10-25). C: had 19 GB free and RAM was full.
**How to apply:**
- Look in PC Archive before copying again.
- Never read the Drive quota from G:'s size.
- Hand Boss the exact folders to delete once Drive has them.

Related: [[pc-folder-layout]].
