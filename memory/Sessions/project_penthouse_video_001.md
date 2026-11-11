---
name: project-penthouse-video-001
description: "Penthouse Frequency video 001 finished 2026-11-05 (90:00 verified), files in studio/penthouse_frequency/out/final, NOT uploaded, blockers"
metadata:
  node_type: memory
  type: project
  originSessionId: 4f9aea26-8f89-413c-9287-9413add140f3
  modified: 2026-11-05T18:23:02.333Z
---

Penthouse Frequency video 001 "BUILT FOR MORE" is produced and verified, not uploaded.

- Files: `c:\Users\Lenovo\nova-hq\studio\penthouse_frequency\out\final\` (mp4 90:00, 162000 frames 1080p30; m4a exactly 259.2M samples; 4K thumbnail jpg under 2 MB; QUALITY_REPORT.md lists what is real and what is not).
- Thumbnail = the private jet photo (R2); next video uses the garage photo (R1) at `out/thumbs/v3_reference_style/`.
- 4K thumbnail is upscaled from a 1680x945 Canva AI image; no 8K master exists (Canva cannot make one). Canva free credits ran out once; custom export sizes are blocked, workaround = add a page at 1680x945 and export that page.
- Upload blocked: no PENTHOUSE FREQUENCY channel connected yet (Boss said he will create it), and the browser upload tool accepts only 10 MB, so a 3 GB file needs yt_upload.py or the Coco publisher with that channel connected. Upload unlisted first; tick "altered or synthetic content".

**Why:** Boss asked for final production plus unlisted upload; the upload could not run honestly.
**How to apply:** when Boss says the channel exists, verify the channel identity first, upload unlisted, never public without his explicit OK. See [[feedback_ask_before_making]] and [[penthouse-thumbnail-style]].

**Update 2026-11-06:** Boss says the new channel's phone is ALREADY verified (so it is not the cause of the thumbnail 403 or the video vanishing). Channel id UCQ7HRdvJEemDPYPaOEKi34w, login file ~/.nova-secrets/youtube-penthouse-frequency.env. First upload (id 1Kb6Mnq2Cuc) uploaded fully, then disappeared from the channel (404, "Video unavailable"), cause unknown; custom thumbnail set returned 403. Do not re-upload blindly.

**Update 2026-11-06 (live):** re-uploaded as PUBLIC, video id WmWUoUNSbxA (https://youtu.be/WmWUoUNSbxA), category Music, 18 tags, SEO description in out/final/description_seo.txt. Public page shows author "Penthouse Frequency". Custom thumbnail still 403 via API even with phone verified; Boss adds thumbnail_4k_final.jpg in Studio. AI disclosure flag not confirmed by API (check in Studio). Test clip Mp_rKSq_ANs was uploaded and deleted by me.

**Cause found 2026-11-06 (Boss, from Studio):** both 90-min uploads were removed because the channel cannot yet post videos over 15 minutes (Intermediate features not enabled). API longUploadsStatus=eligible was WRONG for this channel; never trust it, check Studio feature eligibility first. Options: unlock (phone verify on sampleshoppp@gmail.com, up to 24 h) then re-upload, or publish a 14:59 cut first.

**LIVE 2026-11-06, third upload:** https://youtu.be/I0iVeP8PqVg public; custom thumbnail ACCEPTED after Boss finished channel verification (features unlocked). Thumbnail = Boss's ChatGPT image (jet + black Porsche Cayenne, visible crest) → out/final/thumbnail_v2_4k.jpg; the video's inner picture is still the Canva jet. Still to check in Studio: "altered or synthetic content" = Yes. Watch loop ran to confirm processing finished.
