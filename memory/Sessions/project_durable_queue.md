---
name: durable-queue
description: Step 4 prep on branch cloud/durable-queue (migration 0025 NOT applied); worker command, cancel/block/status, e2e proof; 83 tests green at 239a5cc; cancel founder-only; durable pipeline steps; cloud-worker.yml gated by repo var QUEUE_ENABLED; waits on Step 3C lifecycle check 2026-11-03 and a founder YES to apply
metadata:
  type: project
---

The durable job queue for Coco Cloud lives on branch `cloud/durable-queue` in GetRichSoon/CocoMaison (worktree C:\Users\Lenovo\nova-hq-queue, based on proof/b2-storage). Migration os/cloud/migrations/0025_jobs.sql is proven on a throwaway Postgres by queue-proof.yml (run 41334465894) but NOT applied to Coco Cloud. Latest f6e064b (run 41335733789): scripts/worker.mjs CLI (run|submit|status|cancel, --memory dry run), coco_job_cancel/block/status, os/cloud/job-capabilities.json, scripts/cloud-e2e.test.mjs; 13+11+36 tests green.

**Why:** Boss wants 0% PC dependency for production; the queue plus shared worker (scripts/lib/queue.mjs, worker.mjs) is the layer between scheduler and storage, provider-independent by test.

**How to apply:** do not apply 0025 or merge without a founder YES. Order of events: Step 3C lifecycle verify on/after 2026-11-03 17:26 UTC (see [[b2-storage-proof]]), then founder YES to apply 0025, then wire executor.mjs steps to coco_job_submit, then the Oracle / shared-worker phase. PC dependency audit: reports/cloud-pc-dependency-audit.md on that branch.
