---
name: project-github-org
description: "Good Space GitHub layout in the GetRichSoon org (both founders owners): Coco, CocoMaison, BossSuite, BigBossSuite, House.Product repos; nightly Daily Seal"
metadata:
  node_type: memory
  type: project
  originSessionId: d04bdd3a-42fd-4026-a609-62a9f381ce5d
  modified: 2026-10-14T20:07:07.935Z
---

GetRichSoon org = the company on GitHub; Mangesh347 and shreyaahiremath are both owners. Set up 2026-10-15.

- **Coco**: Coco app + company memory, structure, toolkit, rules, Design Atelier, Grand Estate. Local: `Good Space\Coco`. Pushed every night 23:30 by scheduled task "Coco Daily Seal" (`Good Space\Coco\Daily Seal.ps1`, log in `Good Space\Safe Keeping\Seal Log.txt`).
- **CocoMaison**: renamed from nova-hq (old URL redirects). Local remote already updated. CLAUDE.md files still say nova-hq; GitHub redirects.
- **BigBossSuite**: renamed from shreya-nova-hq (Shreya's own work).
- **BossSuite**: Mangesh's own work (new).
- **.github-private**: members-only org front page with the company tree.
- **Analaysis-**: old Pip app, archived (not deleted; founder said "delete pip app", deletion on GitHub still needs an explicit YES).
- 2026-10-15: moving 31 product repos was blocked by the permission classifier; script ready at `Good Space\Move Products Home.ps1` (founder runs it or allows it). Product repos are still under Mangesh347 until then; plan: move them in one by one as `House.Product` (e.g. Lulu.QuickCast), checking each for public website / Vercel / store links before moving.
- Rule: company work → org; personal work → own Suite. Coco decides by whose device it runs on.

- **Coco Cloud** (2026-10-15): Supabase project 'Good Space' (id bfnhnkxvppqmklfpslfm, Mumbai, free), RLS founders-only, seeded with houses, categories, 57 offerings, 10 members, 54 tools, approvals, 43 decisions, rules. Notes: Good Space\Coco\Cloud\Read Me.md. Pending: Shreya's email as founder, phone app on Vercel, PC workers; access locked to 4 devices (founder login + device key header x-device-key, max 4 active, pairing codes, pulse table for realtime); first pairing codes must be made via admin SQL. Supabase migrations with DROP get declined; use additive/ALTER migrations.

Related: [[project-good-space-structure]], [[project-pc-folder-layout]], [[feedback-save-organised]].
