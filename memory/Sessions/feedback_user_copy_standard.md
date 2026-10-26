---
name: feedback-user-copy-standard
description: "User-facing text in every product uses the standard polished way; never reveal internals like servers, databases or migrations"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 59ee144d-81f9-4d78-ae14-ca2fe5054c43
  modified: 2026-10-25T19:18:09.373Z
---

Boss, 2026-10-26: show users things the standard way that big extensions and teams do. Tell them only what they need to hear. Never expose our internal talk such as "it's on the server, moving to another server, loading".

Example (Screen Time Tracker, old data not imported yet): "Restoring your earlier history. Your earlier friends, posts and leaderboard history will be back within the next 1–2 weeks. Everything from today is saved as usual."

**Why:** users want calm and trust, not our technical details.

**How to apply:**
- In UI, notifications, store listings and privacy pages, never mention: server, database, migration, vendor names (Supabase, Cloudflare), quota, error codes.
- Use calm words: saved, safe, restoring, update.
- Every QA round checks visible text for these words.
- Any promised time (like "1–2 weeks") must be kept. If it is at risk, tell Boss early.

Related: [[feedback-paid-extensions-only]], [[project-stt-db-move]].
