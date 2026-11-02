---
name: supabase-egress-restriction
description: 2026-11-02 Coco Cloud (Supabase "Good Space", free plan) is restricted with 402 exceed_egress_quota; REST/RPC refused for apps and queue; only the project owner can lift it (upgrade or cycle reset)
metadata:
  type: project
---

On 2026-11-02 at 00:30 UTC (2,145 refusals by 04:57 across auth, realtime and REST) the Supabase project bfnhnkxvppqmklfpslfm ("Good Space") started answering HTTP 402 "Service for this project is restricted: exceed_egress_quota" on the REST API. The company run (company-run.yml) failed at submit; the Coco apps' polling hits the same wall. Direct SQL through the Supabase MCP still works; the project reports ACTIVE_HEALTHY.

**Why:** the free plan egress allowance was exhausted. Last-24h edge logs show ~150k REST requests/day from the Coco apps polling (commands 40k, devices 17k, approvals 16k, activity 16k, task_notes/structure/policies/integration_links ~14k each) plus APK downloads served from the Supabase storage bucket `apk` (15 objects, 407 MB; coco-lounge-18.apk alone 8.4 MB in 3 requests in 24 h). The queue itself is negligible.

**How to apply:** this is founder-only: Supabase dashboard -> Organization -> Billing/Usage. Either upgrade the plan (money: needs Boss YES, never done by a session) or wait for the billing cycle reset. To stop it recurring: raise the Coco apps' polling intervals (Coco repo, not CocoMaison), and serve APKs from GitHub Releases instead of Supabase storage. See [[company-cloud-run]].
