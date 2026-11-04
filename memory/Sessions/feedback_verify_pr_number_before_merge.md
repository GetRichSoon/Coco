---
name: feedback-verify-pr-number-before-merge
description: "Never gh pr merge a number you assumed; use the number gh pr create printed, check head/base first. Several sessions open PRs in CocoMaison."
metadata:
  node_type: memory
  type: feedback
  originSessionId: bab6c305-2b58-4881-b6fc-e946c9123ca9
  modified: 2026-11-04T13:34:17.899Z
---

On 2026-11-04 I ran `gh pr merge 7` assuming it was my docs PR. My PR was #8; #7 was another session's "Integrate the cloud work line into main" (dev -> main). It merged 1,221 files and 24 workflow files (new schedules, changed publish workflows) into main in one command, under my merge message.

**Why:** all Claude sessions share one GitHub account (Mangesh347) and open PRs in the same repo at the same time, so PR numbers are not mine by default. Merging to main activates schedules and secrets.

**How to apply:** take the number from the output of `gh pr create` (never guess or increment), run `gh pr view <n> --json headRefName,baseRefName,changedFiles` and confirm head/base/files are mine before any `gh pr merge`. If a merge lands on the wrong thing, say so at once and do not make further changes to that branch until the owner decides.
