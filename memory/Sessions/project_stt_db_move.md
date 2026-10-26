---
name: project-stt-db-move
description: "Screen Time Tracker moves from Supabase to Cloudflare D1 with zero user data loss and simple multi-device sync (Boss, 2026-10-25)"
metadata:
  node_type: memory
  type: project
  originSessionId: 59ee144d-81f9-4d78-ae14-ca2fe5054c43
  modified: 2026-10-25T18:29:34.843Z
---

Boss, 2026-10-25: "we change the DB, so easy sync and no loss of user data, keep that in mind." Screen Time Tracker's cloud moves from Supabase (account yoohhjj3, restricted by egress quota since about Oct 23) to Cloudflare Workers + D1 (screentimetracker.workers.dev).

Rules:
- Every computer keeps its own synced day rows (user, device, day), so computers never overwrite each other. The bigger number wins per device, and totals are the sum over devices.
- Uploads can be repeated safely and resumed. A limit answers 429 with Retry-After; nothing is dropped silently.
- No deletes in sync. Only explicit user actions (delete account, unfollow, unlike, delete post) delete data.
- Supabase is exported once after the quota resets and imported into D1, matched by Google account and checked by row counts and seconds per user before 5.6.0 switches. Old buyers go to the payment server (license data, so it needs Boss's YES).
- Supabase stays untouched for 60+ days after the switch. D1 has Time Travel (7 days) plus a nightly `wrangler d1 export`.
- 5.5.0 never deletes local history.
- The old layout has 15 stt_* tables, documented in the old project's `supabase/*.sql` (From C Drive/Extension/WEB SCREEN TIME (LATEST)). For days the old history already has, the total is max(old, sum of devices), so nothing is counted twice.
- The admin key is in Coco Vault as "Screen Time Tracker Supabase.env". As of 2026-10-25 the project answers 402 even with that key. Run the export (to Coco Vault/Backups, never git) the moment it answers again.

**Why:** 924 users, a 5.0 rating, and Boss promised users no data loss.

**How to apply:** check every Screen Time Tracker backend or sync change against these rules. Plan: nova-hq reports/2026-10-25-screen-time-tracker-paid-plan.md, section "Database move without losing data". Related: [[feedback-paid-extensions-only]], [[feedback-no-company-names-external]].
