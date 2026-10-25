---
name: recall-all-sessions-first
description: Founder rule: before saying "I don't know" or asking him to repeat, search ALL his sessions' history first, then answer and save; learned 2026-10-09
metadata:
  type: feedback
---

Before answering "I don't have it / tell me again", search every session's history, the repo and the Brain first. Only then answer (quote the source), and save what was found.

**Why:** On 2026-10-09 the founder said he had already told me about Shreya's new-device setup; I searched only this session and the repo and told him I found nothing. He has ~6 sessions and had said it in two others (Laptop terminal 3, Cloude 1). A subagent scan of all sessions found it in minutes. He was annoyed that I made him repeat himself.

**How to apply:** use the `recall` skill (.claude/skills/recall/SKILL.md): memory + DECISIONS + Brain, then `list_sessions` and `list_events` kinds ["user"] on every other session (delegate to a sonnet subagent so raw data stays out of context), then answer with the source, then save to memory/DECISIONS/Brain. Say which sessions could not be read. Ask the founder only if all of that is empty, and only for the smallest missing piece. Never copy secrets found in other sessions. See [[shreya-setup-history]], [[feedback-one-brain]].
