---
name: b2-storage-proof
description: Backblaze B2 object-storage proof passed 16/16 on 2026-11-01; secrets live on CocoMaison; lifecycle re-check due 2026-11-03
metadata:
  type: project
---

The provider-independent storage adapter (scripts/lib/storage.mjs, branch proof/b2-storage in GetRichSoon/CocoMaison, not on main) passed its 16-step proof against Backblaze B2 on 2026-11-01 (run 41331364128).

**Why:** Boss's secrets took five tries: endpoint pasted as label text, then the bucket secret held a hyphenated name while the app key is restricted to bucket `cocoproof`. The five STORAGE_* secrets must be on CocoMaison (where the workflow lives), not on the Coco app repo.

**How to apply:** on 2026-11-03 or later, run the workflow with `--lifecycle-verify proof-mvy3p93o` to confirm the bucket's hide-to-delete rule removed the 2 hidden versions. Merging the branch to main is still a founder decision. See [[supabase-backup-state]].
