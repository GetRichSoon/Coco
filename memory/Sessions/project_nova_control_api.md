---
name: nova-control-api
description: Nova LIVE since 2026-11-02 10:41 UTC at https://cocolounge.vercel.app (Vercel cocolounge, region bom1, Git-linked to public GetRichSoon/Coco, root Lounge); desktop on Nova with 0 direct Supabase traffic; pushes build previews only, production deploys via MCP create_deployment
metadata:
  type: project
---

Nova (built 2026-11-02, Coco repo branch cloud-foundation, commit 1406f1c) lives in Good Space\Coco\Lounge\api\_nova.js and is served by the Lounge's Vercel project `cocolounge` (https://cocolounge.vercel.app, deployed by CLI, not git-linked). It speaks the PostgREST subset the apps use at /rest/v1/* and /api/rest/*, plus /api/health, /api/me, /api/changes; authenticates by x-device-key (sha256 vs devices.key_hash, owner must be a founder); runs SQL as role `authenticated` with request.jwt.claims + request.headers set so RLS/is_founder/device_ok behave as under PostgREST; connects to Postgres directly through the pooler (DATABASE_URL env, pg 8.13.1), which the 402 gateway restriction does not block. Cache 15 s, rate 120/min/device, pair_device is the one unauthenticated RPC. Desktop reads Lounge/nova.json; Android has const NOVA in Cloud.kt.

**Why:** Supabase gateway 402 (egress) took both apps down; Boss ordered an app-data provider that does not depend on gateway egress.

**How to apply:** Nova is live (commit 7a1087f): /api/health db ok, routes via api/nova.js + vercel.json rewrites (?__path=; Vercel also injects `path=` which the adapter drops), pg Pool per instance, region bom1. Pairing: Nova resolves the founder from the code's device because pair_device needs is_founder(). Pushes to cloud-foundation build PREVIEWS only: make production with the Vercel MCP create_deployment (gitSource github GetRichSoon/Coco ref cloud-foundation, projectSettings rootDirectory Lounge) or set Production Branch = cloud-foundation in Vercel Git settings. Measured 10:15-10:25 UTC: desktop ~2 Nova req/min, 0 direct Supabase, 0 errors. The Vercel runtime-log tool is permission-blocked; use /api/health stats and Supabase edge logs. See [[lounge-egress-fix]].
**WARNING (2026-11-03 outage):** a create_deployment WITHOUT `projectSettings: { rootDirectory: "Lounge" }` builds the repo root: every Nova route 404, region iad1, for ~7 min (dpl_8ZWT…). Always pass rootDirectory Lounge; a correct build shows region bom1. After any deploy, check `/` = 200 and `/api/apk/latest` = 401.
