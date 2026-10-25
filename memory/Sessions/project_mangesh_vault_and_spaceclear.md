---
name: project-mangesh-vault-and-spaceclear
description: "Where Mangesh's organized backup lives (Google Drive \"Mangesh Vault\") and why SpaceClear no longer auto-deletes"
metadata:
  node_type: memory
  type: project
  originSessionId: 386368d0-a200-4c60-988f-c7c1c7196f8e
  modified: 2026-09-30T00:59:55.831Z
---

**Mangesh Vault** (built 2026-09-30) is the organized backup of all personal/college/work data, at `G:\My Drive\Mangesh Vault` (Google Drive for desktop, 5TB student plan, streaming mode). Layout: `00 Personal`, `College/01 First Year … 04 Fourth Year` (academic years July–June, 1st year started July 2023), `05 Extensions`, `06 Projects` (code as one ZIP per project incl. .git, excluding node_modules/venv), `07 Family & Friends`, `08 Media`, `99 Archive`. User asked for the year folders to live inside `College`.

Everything was COPIED, not moved: originals still sit in Downloads/Desktop/OneDrive until the user verifies Drive and approves cleanup group by group. 6 online-only OneDrive files in First year/2nd SEM were intentionally skipped by the user.

**SpaceClear 1.2.0 "Smart clean"**: background auto-delete retired (`anyAutoDeleteEnabled()` always false, scheduled task removed) because it permanently deleted in-use Temp files and user .log/.bak files. Protected paths (My Drive, Mangesh Vault, Projects, OneDrive PERSONAL DOC, college archive) are never suggested. Do not re-enable background deleting.

**Why:** user's data is irreplaceable to them ("don't want any data loss"). **How to apply:** new files go into the vault layout; any cleanup follows [[feedback-confirm-before-delete]].
