---
name: supabase-neon-routing
description: Per-resource Supabase/Neon router built 2026-11-02 on cloud/durable-queue (providers.json, router.mjs, cloud-usage.mjs, neon-sync.mjs, migration 0026 NOT applied); egress cause is the Lounge apps' polling, fix is in the Lounge repos
metadata:
  type: project
---

Boss asked for Supabase + Neon with per-resource routing (2026-11-02). Built and mock-tested on branch cloud/durable-queue in CocoMaison: os/cloud/providers.json (limits, thresholds, which workload each resource may move), scripts/lib/router.mjs (hysteresis, alerts, health fallback), scripts/cloud-usage.mjs (monitor; dashboard numbers in, routing.json out, --push needs migration 0026), scripts/lib/neon.mjs + scripts/neon-sync.mjs (one-way jsonb replica of the 18 polled tables into schema `replica`), docs/CLOUD_PROVIDERS.md.

**Why:** Supabase egress hit 18.1 GB of 5 GB. Measured cause: Lounge Desktop (Electron, setInterval(runMyCommands, 5000)) and Lounge Android (okhttp) re-read ~18 small tables every 5–6 s per device, ~350k REST reads/day. Queue/workers are negligible. APK bucket (407 MB) adds download egress.

**How to apply:** the >50% cut needs (1) the Lounge apps to poll only `commands` plus a change marker (app repos under Good Space\Coco\Lounge Desktop / Lounge Android), and/or (2) Neon credentials as secrets NEON_HTTP_ENDPOINT + NEON_CONNECTION_STRING, then neon-sync on a 5-minute schedule and the apps reading the replica. Neon free transfer is also 5 GB, so (1) is the real fix. Never dual-write; Supabase stays source of truth. See [[supabase-egress-restriction]], [[company-cloud-run]].
