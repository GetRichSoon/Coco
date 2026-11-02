---
name: company-cloud-run
description: Migration 0025 applied to Coco Cloud 2026-11-01 (Boss's instruction); first controlled company run done on cloud/durable-queue; QUEUE_ENABLED=true; B2 app key has file-name prefix proof/ (confirmed by storage-key-check 2026-11-01 run 41340083973); bucket has NO lifecycle rules; worker schedule needs a main-branch trampoline
metadata:
  type: project
---

On 2026-11-01 Boss instructed applying migration 0025 (jobs queue) to Coco Cloud; it is live as control_plane_0025_jobs. The repo variable QUEUE_ENABLED=true is set on GetRichSoon/CocoMaison. The first controlled company run (workflow company-run.yml on branch cloud/durable-queue, run 41338661610) submitted 33 jobs: 30 done, 2 store-artifact retries pending (B2 PUT 403 on tmp/ keys), 1 blocked by design.

**Why:** Boss wants the company to run through the cloud until the 3 Nov B2 lifecycle check and decide providers from real data.

**How to apply:** CONFIRMED by B2's own API: the app key (also the replacement Boss made 2026-11-01) is restricted to file-name prefix `proof/`, so every production key under tmp/, hold/, final/ answers 403. Boss must create a key with NO file-name prefix (bucket restriction is fine). ALSO confirmed: the bucket has zero lifecycle rules, so the Nov 3 lifecycle verification will FAIL unless a founder sets daysFromHidingToDeleting (do not set it silently). Run scripts/storage-key-check.mjs (workflow storage-key-check.yml) to re-verify. GitHub schedules only fire on the default branch, so continuous worker runs need a one-file trampoline workflow on main (not pushed; needs Boss YES). See [[durable-queue]], [[b2-storage-proof]].
