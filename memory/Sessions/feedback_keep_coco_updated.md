---
name: keep-coco-updated
description: "Strict founder rule — every session keeps the Coco app (Integrations, Activity, Decisions) updated with connections, releases, decisions and bugs"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5c4d9b4e-a663-4256-b1a0-2ec912acc008
  modified: 2026-10-23T06:41:49.462Z
---

Every session keeps the Coco app true:
- **Connections:** login added, renewed, expired or blocked → the `integrations` row.
- **Products:** a new version, upload, post, delete or build → an `activity` line.
- **Decisions:** founder decisions → `decisions`.
- **Bugs:** every bug Boss reports → the team MISTAKES file plus an activity line.
- **Before ending a session:** check Coco shows the work. If Coco is unreachable, write company/STATUS.md and add it to Coco on the next run.

**Why:** Boss, 2026-10-23: "update all sessions, what they did, in the Coco app… make a strict rule, keep everything updated in the Coco app". He uses Coco as the single place to see the company.

**How to apply:** write with `node nova-hq/scripts/coco_log.mjs <file.json>` (service key from Coco Vault; the Supabase MCP write gets declined). The nightly task "Coco Daily Summary" (23:15, scripts/coco_daily.mjs) posts each repo's commits. Never put secret values there, only where they are kept. Also in nova-hq CLAUDE.md. Related: [[one-brain]], [[note-every-mistake]].
