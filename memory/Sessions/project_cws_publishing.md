---
name: project-cws-publishing
description: "How Chrome Web Store publishing works here: the generic publisher, one Google account per extension, 2SV gates uploads, and a cloud secret that died silently"
metadata:
  node_type: memory
  type: project
  originSessionId: c06033a2-6126-421e-a39a-9b679095e776
  modified: 2026-10-29T06:01:18.482Z
---

**Use `node scripts/publish/extension.mjs` (capability `publish-browser-extension`), not the raw
command.** It is driven entirely by `os/extensions.json` — repo, source folder, item id, include
list, approved permissions, no credential — so a third extension is a row there and no new code.
Four verbs: `pack`, `check`, `verify`, `publish`. `scripts/cws_publish.mjs <item_id> <zip>` still
works and still takes an item id, but it has no version gate and no approval check: it does exactly
what it is told.

**Read the store before trusting any file.** `extension.mjs verify --ext <id>` answers in one call.
Doing this on 2026-10-29 found that Screen Time Tracker 5.5.0 was already live while
`company/ALERTS-STT.md` said nothing had been uploaded, and that three other files
(`os/integrations.json`, the `publish-chrome-store` capability card, `docs/CLOUD_SECRETS.md`) all
claimed the refresh token did not exist and publishing was blocked. It existed and had published
twice. Two sessions believed them.

The real ids: Orbi `jcfgocfmlmookmeikkiilleedifpllmn`, Screen Time Tracker
`llfciomelolhkmnepbnjkiokpinfgdmf`, publisher `2155adb3-bde8-46b5-8bde-d6302c75aa7c` for both.
Orbi's own code hardcodes `mlhchpbioeplikcfpmidjjmmdemodjef`, which answers 403 under our publisher —
unresolved, approval A-023.

**A cloud secret dies silently.** The four `CWS_*` GitHub Actions secrets were set on 2026-10-27 and
the refresh token behind them was revoked by 2026-10-29. Nothing reported it: the secret was still
listed, Coco showed a healthy connection, and the laptop kept working because the laptop reads
`Good Space\Coco Vault\Coco Keys\Chrome Web Store.env` instead. Only a real cloud run found it. The
"extension publish" workflow now verifies read-only every Monday as well as on every change. To fix
one: `node scripts/cws-login.mjs` on the laptop, then set the four secrets again from the Vault.

**Per extension, one founder action that no code can replace:** the owning Google account needs
2-Step Verification on, or the upload is refused. Each extension has its own account (Chrome profile
61 "Orbi" = noreply.fileforge@gmail.com, profile 76 "Screen Time tracker", profile 32 =
lokademangesh123@gmail.com).

**Never settable by any API, for any release:** the listing title and description, the privacy policy
URL, and visibility — Developer Dashboard only. The wrong privacy URL is exactly what got Orbi 2.9.0
rejected ("Purple Nickel"). And the API submits; Google decides when or whether it publishes, so
`SUBMITTED_FOR_REVIEW` is never reported as `PUBLISHED`.

**Edge:** no product exists for either extension, and Microsoft's Update REST API only updates
products that already exist — creating one and setting metadata is Partner Center only. Verified
endpoints are recorded in `os/extensions.json`; approval A-024.

**Why:** two days were lost guessing at a rejection reason from stale repo notes, and a further
session treated the API as uncallable because three files said so. The provider is the only
authority on provider state.

**How to apply:** ask the store, not the repo. If an upload fails on 2SV, that is the founder's
one-time action on that extension's own Google account — not something to work around. Ask Boss to
paste the dashboard Status tab text rather than inferring a rejection reason. Related:
[[project-github-repo-layout]], [[feedback-version-and-push]], [[feedback-paid-extensions-only]]
