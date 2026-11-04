---
name: project-brains-growth-intel
description: "Coco brains + growth engine: merged, scheduled from main with every action HELD, dashboard deployed; 0031 NOT applied (declined); A-026 status 2026-11-04"
metadata:
  node_type: memory
  type: project
  originSessionId: bab6c305-2b58-4881-b6fc-e946c9123ca9
  modified: 2026-11-04T13:34:16.888Z
---

State on 2026-11-04 (canonical record: `docs/BRAINS.md` on cloud/durable-queue; runbook, controls, rollbacks, next actions):
- **Merged** into cloud/durable-queue (PRs 5, 6, 8). `brains.yml` is on main (05:00 UTC daily); a run dispatched from main passed.
- **Every brain action is HELD** by `os/brains/governance.json` (fail-closed) and by the emergency stop. The cloud cycle runs `brains.mjs audit` and fails if anything executed. Activation is NOT requested; it needs a separate founder YES plus a committed `activation` block.
- **Emergency stop untouched.** File vs live disagree only because Boss's 2026-11-03 lift (12c0045) is on cloud-foundation but never reached cloud/durable-queue or main. Live Coco policy: not paused.
- **Dashboard deployed** (Coco 55e5d75, dpl_F4Wao3RgtHBRfKS1A5zvMQMU3juz; rollback = promote dpl_EE77veAHHmiepU815kWK8nwXanrF). Read-only. The Coco test fixture is SYNTHETIC (public repo): never put real company data in it.
- **Migration 0031 NOT applied:** the apply call was declined at the permission prompt. A real data backup is blocked (REST gateway 402, no direct DB credential); a schema fingerprint was taken instead (in the docs). Waiting for Boss: apply now, or wait for the gateway.
- **Gumroad:** `0032_gumroad_scope_view_sales_only.sql` prepared (view_sales only, hash-verified as the live function plus one line), not applied; the reconnect is a founder login. Revenue stays UNKNOWN.
- **Goals:** proposed targets kept, flagged provisional.
- **Coco rows** (decision + 3 activity lines) could not be written (402); they are in company/STATUS.md for the next run.

**Why:** Boss wants brains that own outcomes, act only within permissions and prove results; production steps are gated one by one.

**How to apply:** don't rebuild; read the docs. APPROVALS.md has two rows labelled A-026 (the Orbi listing row from the dev line and the brains row): the brains row is the one Boss answered. See [[feedback-verify-pr-number-before-merge]], [[project-company-cloud-run]], [[project-youtube-cloud-analytics]].
