---
name: project-quickcast-nhost
description: "QuickCast backend moving Supabase → Nhost (decided 2026-11-10); step 1 = PR #1, not live; what's blocked on Mangesh"
metadata:
  node_type: memory
  type: project
  originSessionId: aa53976f-e9f7-4311-b259-83be0c196e1b
  modified: 2026-11-10T11:51:01.774Z
---

2026-11-10, Mangesh chose:
- move the QuickCast backend from Supabase to Nhost
- keep Razorpay + PayPal (no Paddle)
- keep videos in R2
- build on the PC, missing features first

The master prompt he pasted wanted Nhost + Paddle. QuickCast was already at 1.10.2, with most Loom-like features built.

- **Step 1 done:** PR #1 on Mangesh347/QuickCast (branch `nhost-backend`, v1.10.3). It adds the `nhost/` config, the schema, Hasura permissions and 12 PGlite tests (`cd nhost && npm test`), plus `docs/NHOST.md`, which holds the plan and the cost forecast. Nothing is wired up yet; live is still Supabase.
- **Blocked on Mangesh:**
  1. create the Nhost account and project (check whether it asks for a card)
  2. add the Google secrets in Nhost
  3. rotate the old QuickCast Supabase service_role key
- 2026-11-10: Mangesh asked Claude to do the Nhost setup through Claude in Chrome after he logs in. The extension was connected, but each new tab was removed from Claude's tab group right away (3 tries), so nothing was done in Nhost. He said "wait for now". Resume when he says retry. He said "run" later the same day and it failed the same way 3 more times: the group is created, then the tab leaves it straight away. Likely cause is a tab-manager extension, Chrome's auto tab groups, or a second Claude in Chrome session.
- **2026-11-10, done through Claude in Chrome on the third try:** created Nhost org "QuickCast" (Starter, free, no card asked) and project "QuickCast", Mumbai ap-south-1, subdomain `iatvjniojbqkktsqklsy`. Recorded in docs/NHOST.md on PR #1.
  - Still open: Mangesh enters the Google secrets himself (Claude doesn't type secrets).
  - Still open: GitHub connect (base dir `nhost`) after PR #1 review.
- **Next steps:**
  2. API port to Nhost GraphQL
  3. email sign-in, guest local recording and the trial button
  4. data move with the same user ids (needs his YES)
  5. folders, workspaces and notifications UI
- Coco Cloud logging failed with a 402 egress error on 2026-11-10, so this decision is not in Coco yet. Log it when service is back ([[feedback-keep-coco-updated]]).

**Why:** the database now enforces plan, trial and quota itself, so later steps depend on that schema.

**How to apply:**
- Continue from `docs/NHOST.md` in the QuickCast repo.
- Follow the QuickCast CLAUDE.md: branch + PR, bump the version.
- No Nhost CLI for Windows and no Docker on this PC: test the SQL with PGlite.
- See [[project-quickcast-keys]].
