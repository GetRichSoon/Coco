---
name: whatsapp-enhancer-is-spaceguard
description: The WhatsApp Enhancer extension lives in Projects/SpaceGuard; internal identifiers keep the old SpaceGuard name on purpose
metadata:
  node_type: memory
  type: project
  originSessionId: 8e14f1c5-1085-4d3b-a873-1df3481aff79
  modified: 2026-09-30T17:04:25.946Z
---

The Chrome extension **WhatsApp Enhancer** (renamed from SpaceGuard on 2026-09-30, to match ChatGPT/Claude/Gemini Enhancer) lives in `C:\Users\Lenovo\Projects\SpaceGuard`. The folder was not renamed.

**Why:** Mangesh asked for the family name. Internal identifiers were deliberately left as SpaceGuard — `SpaceGuardDefaults/Adapter/Security/Motion/Payments` globals, the `spaceguardState` storage key, `#spaceguard-*` DOM ids, `SPACEGUARD_*` messages — because changing the storage key would wipe users' spaces and PINs on update.

**How to apply:**
- When he says "WhatsApp Enhancer" or "SpaceGuard", it is the same project. Rename only user-visible text, never the storage key.
- The name leads with Meta's trademark; STORE_LISTING.md documents the fallback "Enhancer for WhatsApp Web: …" if the Chrome Web Store rejects it.
- What he wants from it: every space (Personal, Work, custom) is its own WhatsApp-like two-panel screen (left = only that space's chats, tap = opens on the right, never jumps to General), a full-page space chooser on open / after idle / on demand, full Material You design with looping animations, Free plan + "Pro coming soon" with nothing locked.
- Claude cannot see his real web.whatsapp.com — only `tests/visual/wa-mock.html`. WhatsApp-specific selectors belong only in `content/dom-adapter.js`.
- **Real WhatsApp Web ignores script-generated clicks.** 1.2.0 (and 1.1.4–1.1.9 before it) failed on his real account for this reason: chats listed correctly but would not open. Since 1.2.1 chats open by "pass-through clicks": WhatsApp's own row is positioned under the pointed-at row so the user's real click opens it (`armFor` / `guardNativeEvents` in content.js). Never go back to synthetic clicks or typing into WhatsApp's search box as the main path. The mock is strict (rejects `isTrusted === false`) so tests can't pass on something that fails for real.
- **Smoothness is a hard requirement for him** ("no lag, no glitch, smooth Material You animation"). 1.2.1 lagged on his machine because the UI was rebuilt on every interaction (the background worker re-saved settings on each click → every tab re-rendered) and pointer moves re-measured every row. Rules since 1.2.2, enforced by a unit check: build UI once and update in place (signatures/keyed rows), pointer work once per frame on cached geometry, looping animations animate only `transform`/`opacity`, no `backdrop-filter`, background never writes settings on activity. Run `tests/visual/qa-perf.mjs` after any content.js change.
- His motion taste: **continuously looping** animations on every space logo; **no hover-lift/tilt** animations (he asked to remove them). Full-page screens (chooser/lock/PIN) must appear instantly and always dark — no white flash, no light variant.
- Never put a background scan between him and a click: the list scan is lazy and aborts the moment he points at a chat (1.2.2 blocked clicks for up to 15 s and he reported it as lag).
- "Pro" features: badge them Pro but leave them usable by everyone (no checkout exists; he said users must keep using everything free).
- The space bar must not cover WhatsApp's conversation or change size on hover; it docks in the empty middle of WhatsApp's left icon column (fallback: bottom of the chat list).
- If something fails on his real account, ask for Settings → Advanced → Copy diagnostics (content-free page outline) rather than guessing.
- Not a git repo; Python does not run on this PC (build the zip and icons with the PowerShell/.NET and `scripts/make_icons.mjs` routes).
