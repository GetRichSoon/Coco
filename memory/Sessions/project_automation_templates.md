---
name: project-automation-templates
description: "Universal Automation Template system (templates, prompts, references, schedule, wizard, dashboard) built 2026-11-11; local only, not deployed; how to test and what waits for a YES"
metadata:
  node_type: memory
  type: project
  originSessionId: a4503653-a1ce-4894-9850-f2f9d7768cc3
  modified: 2026-11-11T13:42:29.703Z
---

Founder directive 2026-11-11 "COCO universal automation template system" (+ section 20, create new channel/product wizard). Built in two local repos, nothing pushed, deployed or applied to a live database.

- **Backend (Coco repo `C:\Users\Lenovo\coco-cloud-ui`, branch org/unified-ui):** Nova routes `/api/automation/*` in `Lounge/api/_templates.js` over `_template_schema/_presets/_schedule/_core/_ops/_onboarding.js`. Layered inheritance Global>House>Team>Subteam>Category>Channel with provenance; every channel/product owns an independent template copy (lineage kept); immutable versions; 9-section prompts with 12 validated variables; references via presigned B2 URLs; planned work (cancel never delete); publish gate with per-channel authorisations; readiness; wizard (record, account, production are three separate operations; creation never turns on auto publish or public).
- **UI:** one code path for desktop and phone/PWA inside `Lounge/index.html` between the markers `AUTOMATION UI (begin)` / `(end)`, page id `automation`, "+ Create New" section on House/Team/Subteam/Category pages (`autUnitSection`). No native Android screen: the phone uses the same web code.
- **Database:** CocoMaison (`C:\Users\Lenovo\org-unified`, branch org/unified) migrations `0041_integration_hub` and `0042_automation_templates` (+ down files). NOT applied live: needs a verified backup and the founder's YES.
- **Tests:** `scripts/ops/automation-{core,ops,onboarding,http,produce}.test.mjs` + `migration-0042.test.mjs`, plus TWO REAL-BROWSER suites run by `node scripts/ops/automation-ui.run.mjs` (26 + 41 checks: embedded Postgres + real Nova handler + the real index.html in a headless browser; drive scripts `automation-ui.drive.mjs` / `.drive.prompts.mjs`, database checks `automation-ui.checks.mjs` / `.prompts.checks.mjs`). Worker job `os/cloud/jobs/automation-produce.mjs` (prepare + package only, no model). Final report: CocoMaison `reports/coco-universal-automation-template.md` (17/20 PASS, 1 PREPARED, 2 BLOCKED). Env: `PGLITE=<pglite dist/index.js>` and `COCO_REPO=<Coco repo>`. Gotcha learned: the headless driver evaluates page code in an isolated JS world, so the harness publishes app state in `document.body.dataset.autState`; and the runner must spawn the browser asynchronously because it also serves the page.
- **Waiting for the founder:** deploy Nova; apply 0041/0042 after a verified backup; B2 admin key (real upload test); Gemini gateway policy (real sample test); connect real accounts one at a time. Scheduler stays off (`automation_scheduler_enabled`), mass production NOT started.

**Why:** founder wants one reusable template system where each channel is independent and nothing publishes without approval.
**How to apply:** before changing any of it, run the e2e and the four automation backend suites; never turn on the scheduler or public publishing without a founder YES. See [[project-integration-hub]].
