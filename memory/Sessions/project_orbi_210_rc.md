---
name: project-orbi-210-rc
description: "Orbi 2.10 release candidate (2026-11-10): branch rc-2.10 in Projects/Orbi-rc, Vercel API + Nhost auth/DB (A1), approved prices/decisions, name stays Orbi, payments last"
metadata:
  node_type: memory
  type: project
  originSessionId: c61efa00-d33f-4fd9-a5f4-76b5bc1eaf5f
  modified: 2026-11-10T13:52:26.143Z
---

Orbi (Chrome new tab extension, repo Projects/Orbi) 2.10 is assembled on branch `rc-2.10` (worktree `Projects/Orbi-rc`) from isolated branches: live-wallpaper, community, nhost-backend, ext-account, reuse, catalogue; `website` and `design-system` were still finishing. The main checkout `Projects/Orbi` holds ANOTHER session's uncommitted work: never stash/commit it; branch via worktrees.

Approved by the founder on 2026-11-10:
- Decision A1: Vercel Functions = the whole API + payments; Nhost = Auth + Postgres; Nhost scheduled events call protected /api/cron/*. Supabase and Screen Time Tracker untouched.
- Prices USD $3.49 / $27.99 / $59, INR fixed at $1 = Rs 95 (Rs 332 / 2,659 / 5,605). Prepaid passes (30 d / 365 d / lifetime), no auto-renew.
- 4 server-side Link Wallpaper tries; one Chrome install per account, 3 moves / 30 days; 15-min signed pass, 24 h offline max.
- Payments are the LAST milestone; live payments only after his approval.
- Name stays "Orbi" (he often types "Orby" - do not rename).
- Design: Material You (M3 Expressive) only, one design system (design/ in the design-system branch), brand "A · Satellite", seed "Iris".
- Spend nothing: reuse what exists for free (Resend sender billing@fenwicklabs.com shown as "Orbi"; existing Razorpay test + PayPal sandbox apps).

**Why:** long multi-agent build; next session must not redo or re-decide these.
**How to apply:** read NHOST_PLAN.md / NHOST_SETUP.md / COMMUNITY_API.md on rc-2.10 first. Related: [[feedback-test-once]], [[feedback-no-company-names-external]].
