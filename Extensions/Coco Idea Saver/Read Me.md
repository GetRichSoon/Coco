# Coco Idea Saver

Boss's private capture tool (2026-10-26): while browsing in Brave, save any YouTube video,
page, link, image or selected text as an idea into Coco Notes with one click.

- **YouTube chip**: indigo "Save to Coco" pill on watch pages. Click = save. Hold (or click
  again right after a save) = add a 1-line "why this idea" note first. Drag to move it.
- **Right-click anywhere**: "Save to Coco Notes" (works on Pinterest images, articles, links).
- **Where it goes**: POST to the local heart server (`/api/notes`, port 7777) → Coco Cloud
  `notes` with status `new` → the 30-min check analyzes it → Notes tab. No analytics, no
  external calls, localhost only. Offline saves queue in the extension and flush later.

Load steps: `LOAD.md`. Tests: `node test.mjs` (in this folder). Private — never for the store.
Spec: `nova-hq\specs\coco_idea_saver\SPEC.md`.
