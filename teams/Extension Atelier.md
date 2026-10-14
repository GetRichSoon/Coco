# 🧩 Extension Atelier

Coco's extension team. Ideas Monday to Thursday, shortlist Friday, one extension built and published a week, only after the founder says it is final. Every Web Store release needs a YES.

---
_Playbook brought over from Nova:_

# Extension team (separate from the YouTube team)

Own brain: `node scripts/ext-brain.mjs status | sync | inbox | event | fact | send` (facts `ext:*`, events `ext.*` in the Nova Brain database, snapshot `company/extensions/BRAIN.md`). Parent: the Nova Brain.

- **Every session saves extension work here**: the Laptop Terminal, a temporary local terminal, a cloud session, the Nova desktop app (section "Extension team").
- **Working and publishing run on the Laptop Terminal only**, exactly like the YouTube team. A cloud session that wants something done leaves a command: `node scripts/ext-brain.mjs send <idea|note|feedback|request> "<text>" --from <name>`. The Laptop Terminal runs `ext-brain.mjs inbox` (Nova's daily status does it every morning) and acts on it.
- **Cadence:** ideas Mon to Thu, shortlist to the founder on Friday (`company/extensions-weekly/`), ONE extension built, QA'd and published per week, only after the founder says it is final. YES per release.
- **Credentials:** `~/.nova-secrets/chrome-store.env` (laptop only). The Chrome Web Store refresh token (one-time Google login by the founder) is still pending.
- Files that belong to this team: `company/EXTENSION-TEAM.md`, `company/BACKLOG.md` (extension part), `company/PORTFOLIO.md` (extension rows), `company/IDEA-INTELLIGENCE.md`, `release/`, the extension repos.

