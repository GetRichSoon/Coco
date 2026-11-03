---
name: project_youtube_cloud_analytics
description: "YouTube analytics fully in the cloud since 2026-11-03 via Nova; daily 04:10 UTC workflow, diagnose.mjs intelligence report, what the first live report found"
metadata:
  node_type: memory
  type: project
  originSessionId: 255d7cfb-a13c-48ce-9485-897af2a8adb6
  modified: 2026-11-03T17:32:52.445Z
---

Since 2026-11-03 The Flow's analytics run only in the cloud (CocoMaison cloud/durable-queue; `youtube daily` workflow registered on main, daily 04:10 UTC, checks out the cloud branch). Collector `scripts/youtube/analytics.mjs` goes through Nova as device cloud-worker-1 (token via Nova `/api/publish/token`); adds 7-day window, daily series, traffic, retention curves (source values daily/traffic/retention, migration 0029). Report `scripts/youtube/diagnose.mjs` writes `company/youtube/reports/<day>.md`, `latest.json`, `EXPERIMENTS.jsonl`; MEASURED vs HYPOTHESIS; STALE after 36 h. Nova `GET /api/youtube/latest` + desktop Home card show freshness. Report: `reports/2026-11-03-youtube-cloud-analytics.md`.

**Why:** the old job used the restricted Supabase gateway and the last snapshot was 29 Oct; Boss made fully cloud analytics + growth intelligence P0.

**How to apply:** answer channel questions from the latest report, not memory. First live findings: daily views peaked 1,403 on 9 Oct, 18 by 31 Oct; growth since then is new uploads (eye floaters 963 of 1,084); body family leads, phone family lags; hooks are fine (retention ≥1.0x at 10%, replays count); subscriber conversion is the weak point. Analytics API lags ~3 days; impressions/CTR not available. Experiments opened 2026-11-03 need 3 days before judging; production does not yet read latest.json. See [[project_youtube_the_flow]], [[project_production_test_2026_11_02]].
