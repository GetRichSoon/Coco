---
name: coco-repo-public-gate
description: GetRichSoon/Coco must stay PRIVATE until the QuickCast Supabase service_role key (committed 2026-10-25 in memory/Sessions, removed 2026-11-02 in 9e8c0af, still in history) is rotated; pre-commit guard in .githooks
metadata:
  type: project
---

Boss wants GetRichSoon/Coco public so Vercel Hobby can git-deploy the Lounge/Nova. Audit 2026-11-02 found one live secret tracked: a Supabase service_role JWT (plus anon key) for the QuickCast project kocnkdnnhgduynzpshvp in memory/Sessions/project_quickcast_keys.md (commit 3ee62e0, 2026-10-25). Removed from the tree in 9e8c0af; it remains in git history (2 added lines across the file's history). The QuickCast project is NOT under Mangesh-lokade-dev's Supabase org; it lives under a dedicated Gmail per Boss's one-account-per-extension rule.

**Why:** a live service_role key in public history bypasses every RLS policy of that project.

**How to apply:** do not flip visibility until Boss rotates the QuickCast service_role key (Supabase dashboard, Settings, API). Then: verify old key dead, make ONLY Coco public, connect Vercel project cocolounge (root Lounge, production branch cloud-foundation), deploy Nova. The repo has .githooks/pre-commit (enable per clone: git config core.hooksPath .githooks); anon keys in Extensions/* are public by design. See [[nova-control-api]].
