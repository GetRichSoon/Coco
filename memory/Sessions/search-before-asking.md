---
name: search-before-asking
description: "Before asking Mangesh for a file, image, key or folder, search the whole PC and past Claude session history first"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0a0a68ab-65c8-42a0-8020-ae8bd3707608
  modified: 2026-10-22T20:23:37.935Z
---

Before telling Mangesh "I don't have X, send it", search for it yourself first: every likely folder on the PC (Projects, Downloads, Desktop, Pictures, Documents, Good Space, nova-*), and past Claude Code session transcripts in `~/.claude/projects/**/*.jsonl`. Ask only if the search truly finds nothing, and say where you looked.

**Why:** He has already shared files in earlier sessions/terminals and gets frustrated when asked again (2026-10-23, theme images for the Material You redesign).

**How to apply:** Applies to theme images, .env files, extension source, screenshots — anything he says he "already shared". Credential-file searches may be blocked by the auto-mode safety check; then explain that and ask for the path.
