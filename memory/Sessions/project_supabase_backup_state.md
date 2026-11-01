---
name: project_supabase_backup_state
description: "Where Coco Cloud (Supabase) backups live, the nightly Drive job outside the repo, and the cloud-foundation branch divergence found 2026-11-01"
metadata:
  node_type: memory
  type: project
  originSessionId: 8054edd5-97c5-4cc0-894f-5ad1cf52e1b9
  modified: 2026-11-01T09:27:27.281Z
---

- Nightly Coco Cloud export lives OUTSIDE the repo: `Good Space\Coco\Cloud\Cloud Backup.mjs`, scheduled task "Coco Cloud Backup" 23:30, writes all tables except pulse to `G:\My Drive\Good Space Backup\Coco Cloud\<Weekday>`. It fails whenever Google Drive desktop is not running ("G: is not connected"); last success 2026-10-28.
- Step 1 (2026-11-01) added `scripts/cloud-backup.mjs` (schema + functions + pulse, verified manifest) writing to `Good Space\Safe Keeping\Supabase Backups\<stamp>`; first backup 2026-11-01T09-13-23 (45 tables, 70,498 rows). All 94 applied migrations are in `os/cloud/migrations/applied/`.
- `Backup Coco Vault.cmd` has never produced a file on Drive; all recovery keys exist only on Boss's PC.
- Branch divergence: local `cloud-foundation` on Boss's PC and `origin/cloud-foundation` diverge at ad250e1 (48 unpushed local commits vs 46 remote-only). Step 1 is on both lineages. Owner must reconcile; never stash or reset other sessions' files.

**Why:** the free Supabase plan has no backups; these facts are not in the repo and were wrong in the first audit.
**How to apply:** before claiming "no backup exists", check Drive > Good Space Backup > Coco Cloud and the activity table for "Coco Cloud backup". Pushing to cloud-foundation from the PC needs the divergence resolved first. See [[project_company_handoff]].
