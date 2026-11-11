---
name: project_gumroad_monitor
description: "Gumroad cloud engine (owner: gumroad-engine session) - old pipeline off 2026-11-04, daily monitor + category research live, phases gated by A-023/A-024/A-025"
metadata:
  node_type: memory
  type: project
  originSessionId: a88cba0d-487e-46b7-abea-ac39b2c53e62
  modified: 2026-11-03T18:56:35.674Z
---

Store **thevelvetfoundry.gumroad.com** (lokade.gumroad.com is 404). 4 live books, 0 sales (2026-11-03). Gumroad's own source: Discover/search shows a product only after its **first sale**, plus a category, reviews shown, a payout method and a compliant account ($0 claims count). All 4 have a category (ids 177, 266; names not decodable from outside, and 3 books sharing 266 is suspicious).

Engine = `gumroad daily` (04:30 UTC; schedule on main, code on cloud/durable-queue `scripts/gumroad/monitor.mjs`; out `company/publishing/ebooks/gumroad/`): products, 12 buyer searches, 15 registered categories (leaders, hot and new, week-on-week), ranked fixes per book, ebooks Claude ledger from ai_calls, Monday weekly report, STALE/failure alerts to Coco. Seller data via Nova `/api/publish/stats` (live; reached production inside another session's deploy a9378da without a YES). Views/sales need `view_sales` = migration 0030 + reconnect (A-023).

Old pipeline OFF 2026-11-04 (Boss directive): subteam ebooks/practical-skills paused (op 204), ebooks.ebooks-head claude blocked (205), Coco workflow ebook-daily disabled by session home-mode-c0 (207), GitHub 'gumroad publish' disabled, scripts/publish/gumroad.mjs CLI exits 3, os.mjs dept ebooks paused.

**Why:** Boss wants one cloud-only, evidence-driven Gumroad engine; Claude is last resort only (old chain spent $7.98 in a week, Opus wrote The Retake Method).

**How to apply:** don't resume the old chain or reuse old assets without approval. Next phases: A-025 (cloud improve stage, v2 packages, no Gumroad change), then YES per product to apply. Cloud runner has Chrome/Java/Python (no pandoc/typst/Pillow preinstalled). Org Actions is on the free plan, 2,000 min/month, and November's pace is ~2,300, so keep runs cheap. Audits: reports/2026-11-03-gumroad-growth-audit.md, reports/2026-11-04-gumroad-engine-audit.md. See [[project_youtube_cloud_analytics]], [[project_nova_control_api]].
