---
name: project-the-last-star
description: "The Last Star 90 s animated pilot - source branch, Kaggle production run (kernel version), deliverables, what blocks B2 upload"
metadata:
  node_type: memory
  type: project
  originSessionId: a4503653-a1ce-4894-9850-f2f9d7768cc3
  modified: 2026-11-10T14:46:37.989Z
---

The Last Star = original 90 s 3D pilot (24 fps, 2160 frames, 1280x720, Kokoro narration + original score/SFX), founder chose 90 s + 720p on 2026-11-10.

- Source: CocoMaison branch `studio/the-last-star` (worktree `C:\Users\Lenovo\last-star`, sparse `studio/animation_pilot`), commit 6dea05b, LOCAL ONLY (not pushed). Files: `the_last_star/source_code/{build_scene,render_cfg,make_audio,kaggle_job}.py` + README.md.
- Production run: Kaggle private kernel `friendlyneighborhood/coco-gpu-diagnostic` (the only kernel that gets T4 x2 from the CLI), version 6 pushed 2026-11-10T14:44Z. `kaggle_job.py --bundle` embeds the sources; job writes report.json always, frames.tar = resume checkpoint (2-3 GB: never download the output without --file-pattern; C: has ~1 GB free).
- Local audio test passed (158 s, voice af_heart, 90.000 s, peak -1 dBFS, 0 clipping). Preview QA fixed: backwards lantern touch, mirrored head turns, cut-off heads, oversized guide light (orb scale had no key before S6), new silhouette final shot (cam8 at 2041).
- B2 upload blocked until the founder saves a temporary admin key (`scripts\ops\b2-key-input.ps1 -Name b2-admin`, branch org/unified) -> `node scripts/ops/b2-setup.mjs apply` -> upload MP4 to goodspace-media, .blend + report to goodspace-artifacts.
- Before any monetized use: check Kaggle's terms for commercial rendering (founder rule); publishing needs a founder YES.

**Why:** founder rule: never claim the video is complete without a verified playable MP4; show the video when created ([[feedback-show-video-when-created]]).
**How to apply:** check report.json `complete` + `mp4.checks` before saying done; related [[neon-b2-target-architecture]].
