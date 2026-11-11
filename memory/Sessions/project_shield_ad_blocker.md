---
name: project-shield-ad-blocker
description: "Shield Ad Blocker 5.0.0 RC (2026-11-10): PR 1 on Mangesh347/shield-ad-blocker, not in the store; payment replay bug fixed in Extension PR 2 (not deployed); founder YES list"
metadata:
  node_type: memory
  type: project
  originSessionId: b95e0eb9-303c-45a3-b595-d874e2c29f1a
  modified: 2026-11-10T14:14:39.040Z
---

2026-11-10, built from a pasted "ultimate upgrade" prompt. Shield was 4.1.0, one commit, never on the Chrome Web Store (no item, no extension ID). Company ranking 2026-10-26 had failed it at Gate 1 (no proof of paying).

- Code: `Good Space/Coco/Extensions/Shield Ad Blocker` = Mangesh347/shield-ad-blocker, branch `upgrade_v5`, PR 1 (not merged). Docs in `docs/` (audit, licensing, architecture, payments, security, QA, perf, CWS readiness, `release/founder_decision_packet.md`).
- Engine: EasyList/EasyPrivacy/Fanboy compiled by `scripts/compile_lists.js` + `lib/filters.js` (17,493 rules, ~92k hosts free). Peter Lowe (no licence) and URLhaus (abuse.ch terms 4.1: commercial use needs Spamhaus subscription) left out.
- Pro: licence key + billing email checked by the shared payment server (product `shield-ad-blocker`, $2.99/30 d, $19.99/365 d hypothesis). No Google sign-in yet (needs store item id + OAuth client).
- 4.1.0 facts measured: promo codes unlocked Pro; its counter never recorded anything (`flushBlocks` emptied its own batch), NOT "+1 per page view"; substring selectors hid site headers; YouTube muted/16x on stray markup.
- Payment server (Mangesh347/Extension): a parallel replay of one payment could add two pass periods (30 -> 60 days) for every product incl. Screen Time Tracker. Fix PR 2 (`fix_replay_period`), Shield catalog PR 3 (stacked). Neither merged: merge = production deploy.
- Tests: `npm test` (9), `npm run test:e2e` (53, offline via host-resolver + local HTTPS + mock licence API), payment `npm test` 153.

**Why:** founder asked for the full product; publishing, deploys, migrations need his YES (CLAUDE.md).

**How to apply:** start from `docs/release/founder_decision_packet.md`. The e2e harness needs `openssl` with its own config (machine `OPENSSL_CONF` points at a missing PostgreSQL file) and Playwright chromium-1248. C: hit 0 bytes during browser tests; the harness now deletes its own profiles, but a wildcard sweep of shared Temp is blocked by the permission classifier, so old `shield-profile-*` folders need the founder. Coco Cloud log is in `Coco Pending Log/2026-11-10 Shield Ad Blocker 5.0.0.json` (402). Related: [[project-stt-nova]], [[feedback-paid-extensions-only]], [[project-cws-publishing]], [[project-quickcast-nhost]].
