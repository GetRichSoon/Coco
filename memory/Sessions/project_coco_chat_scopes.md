---
name: project_coco_chat_scopes
description: "COCO Chat LIVE 2026-11-02 (Coco 2.10.0): scoped + conversational, builds teams/agents/workflows from plain words via Nova /api/chat; engine lifted from Lounge/index.html; one thread per scope (0028); how to test live; gaps"
metadata:
  node_type: memory
  type: project
  originSessionId: 334a9046-52b7-4446-9c7f-8b8085706a0c
  modified: 2026-11-02T16:10:48.898Z
---

Built 2026-11-02 on Boss's orders (Coco repo cloud-foundation, last 1fc1289, production Nova deployed). One engine: the chat section of Lounge/index.html ("talking like a person" + older command rules) is lifted by Lounge/api/_chat.js and served as POST /api/chat {scope, body} and GET /api/chat/tree for desktop/web and Android. Scope key `team|subteam|category|channel|agent` (ChatScope.kt mirrors it). public.chat has scope+meta (migration control_plane_0028_chat_scope); meta carries cards/act/approvals/pending/ctx (follow-up memory)/verified/goto. No model by default; GEMINI_API_KEY on Vercel enables a rewrite-only fallback (llmRewrite) that never sees company data.

Building: team plans (head + one sub-team and agent per stage + daily workflow in team config + schedule policy) go through coco_structure/coco_control, start paused, and Nova reads every id back ("Verified in Coco Cloud"). The cloud cycle's provision-structure turns rows into a working team. Real team made from Boss's request: ai-tools-shorts (paused, schedule daily 08:00, publishes to The Flow only with a YES; The Flow stays assigned to YouTube).

**Why:** Boss wants chat to be the company's operating system, cloud only, no command syntax.

**How to apply:** live test = scratchpad script with cloud-creds NOVA_DEVICE_ID=cloud-worker-1 hitting /api/chat; name test structure "E2E ..." and archive it after; never say stop/pause inside a team scope in tests (paused YouTube 20 s once). Fixed live: coco_control text values must be JSON (buildRpc), newest APK = highest versionCode (GitHub list is unordered). Open: file uploads need a B2 key without prefix in Vercel env; tasks reach teams only when the cloud cycle runs (schedule needs main trampoline); "fix it" on real failures re-requests runs (not fired live). See [[nova-control-api]].
