---
name: project-orbi-210-rc
description: "Orbi 3.1.0 release candidate (was 2.10): branch rc-3.1 in Projects/Orbi-rc, local test build only, Vercel API + Nhost (A1), original icon, dark only, name stays Orbi, payments last"
metadata:
  node_type: memory
  type: project
  originSessionId: c61efa00-d33f-4fd9-a5f4-76b5bc1eaf5f
  modified: 2026-11-11T08:48:35.798Z
---

Orbi (Chrome new tab extension, repo Projects/Orbi) 3.1.0 is assembled on branch `rc-3.1` (worktree `Projects/Orbi-rc`; it was called rc-2.10) from isolated branches. The main checkout `Projects/Orbi` holds ANOTHER session's uncommitted work: never stash/commit it; branch via worktrees. Delivery is a LOCAL test build only (`dist/Orbi_3.1.0` folder + zip, built by `release/package-extension.mjs`, optional `--site=` for a beta address): never the Chrome Web Store, never production, no live payments.

Approved by the founder:
- Decision A1 (2026-11-10): Vercel Functions = the whole API + payments; Nhost = Auth + Postgres; Nhost scheduled events call protected /api/cron/*. Supabase and Screen Time Tracker untouched.
- Prices USD $3.49 / $27.99 / $59, INR fixed at $1 = Rs 95 (Rs 332 / 2,659 / 5,605), INR shown on the website payment page only. Prepaid passes (30 d / 365 d / lifetime), no auto-renew.
- 4 server-side Link Wallpaper tries; one Chrome install per account, 3 moves / 30 days; 15-min signed pass, 24 h offline max.
- Payments are the LAST milestone; live payments only after his approval.
- Name stays "Orbi" (he often types "Orby" - do not rename).
- Design: Material You (M3 Expressive), one design system (`design/`), Roboto Flex the only typeface. Logo: the ORIGINAL orange Orbi icon everywhere; he rejected the Satellite logo (2026-11-10). Dark theme only (2026-11-11, [[feedback-orbi-dark-only]]).
- Content: only original Orbi-made art, external catalogue held ([[feedback-orbi-original-content-only]], 2026-11-11).
- Spend nothing: no domain purchase (DigitalPlat's free slot needed payment; founder said skip it, 2026-11-11). Beta = a separate Vercel project (`orbibeta`, free vercel.app address), not a preview of the 2.9.2 project; the live 2.9.2 site `orbi-new-tab-live-wallpapers-shortc.vercel.app` stays untouched. Reuse the existing Resend account and Razorpay test + PayPal sandbox apps.

State on 2026-11-11: no Orbi Nhost project yet (founder creates it; need subdomain + region), so signup and Community can't work online (the live site is still 2.9.2 and returns 404 for the 3.1 pages and API). YouTube wallpapers now go through Orbi's own player page `/player/youtube.html` (no spoofed Referer); music player and removal of the old DNR rule 1531 are in branch `youtube-player`. Creator platform plan (uploads, rights, discovery, editorial, then monetisation and payouts in sandbox, all off) is `CREATOR_PLATFORM_GAP.md` on rc-3.1. The 2.9.2 production Vercel project keeps six secrets as readable (not Sensitive) variables: flagged to the founder, not changed.

**Why:** long multi-agent build; the next session must not redo or re-decide these.
**How to apply:** read CREATOR_PLATFORM_GAP.md, NHOST_PLAN.md, NHOST_SETUP.md and COMMUNITY_API.md on rc-3.1 first. Related: [[feedback-test-once]], [[feedback-no-company-names-external]].
