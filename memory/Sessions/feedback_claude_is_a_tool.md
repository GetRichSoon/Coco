---
name: feedback-claude-is-a-tool
description: Good Space must run without Claude; Claude is only a tool Coco calls for hard work
metadata:
  node_type: memory
  type: feedback
  originSessionId: d04bdd3a-42fd-4026-a609-62a9f381ce5d
  modified: 2026-10-16T06:47:35.893Z
---

The 4 devices, remote control, voice, chat and all company operations must keep working with Claude out of limit or absent. They run on Coco Cloud (Supabase, Gemini via vault key `gemini_api_key`) and local Ollama. Claude is called by Coco only for hard work (code, scripts, big builds).

**Why:** Boss, 2026-10-16: "full company Claude pe depend na ho; Claude ek tool hai jo Coco use karega". The weekly limit hit 97%, which showed the risk.

**How to apply:** never put Claude on a runtime path. Use rules, Gemini or Ollama for routing and checks; finish-shorts.mjs (Ollama check, then scheduled upload) is the model. Related: [[project-coco-remote]], [[feedback-cloud-first]].
