---
name: project-vintage-oldies-engine
description: "2026-11-09 vintage oldies engine in nova-hq/studio/vintage_oldies: Engine A procedural instrumental built + first 150 s test rendered; Engine B vocals = interface and licence research only; workflow written, NOT pushed"
metadata:
  type: project
---

New project (not Moonveil/Penthouse code): `c:\Users\Lenovo\nova-hq\studio\vintage_oldies\` (score_lamplight.py, engine_a.py, fx.py, verify.py, test_modules.py, VOCAL_ENGINE_RESEARCH.md, README.md) + `.github/workflows/vintage-oldies-test.yml` (manual dispatch, CPU only).
- First test "Lamplight and Rain" 150 s, 74 BPM, 12/8, E-flat: renders in about 2 min, verify.py all PASS, out/lamplight/ (gitignored). NOT listened to by a person; procedural prototype, not a vocal song.
- Vocals: no free hosted API exists (acemusic.ai is web-only; Terms ban automated access); all open singing models need GPUs; YuE weights non-commercial for companies. See research file.
- Lesson: integer WAV stems clipped silently; engine stems are 32-bit float.

**Why:** Boss wants an automated vintage oldies YouTube pipeline. **How to apply:** wait for Boss to listen and approve before long-form or video; workflow push needs his YES. See [[project-penthouse-video-001]].

**LIVE 2026-11-09:** 6 h video https://youtu.be/wqP3M8M9ucM on Moonveil Audio (public). 145 different procedural songs (score_gen.py, seed 0 = Lamplight) crossfaded + non-looping rain/crackle/hiss via long_audio.py; picture = Boss's bedroom image completely unedited and STILL (no zoom/text), thumbnail = same pixels as JPG (PNG was over 2 MB). Audio re-encoded -3 dB (-19.9 LUFS, TP -0.5). Boss pre-approved publishing, no listening needed. Studio todo: tick "altered or synthetic content". I deleted moonveil/out_bedroom with Boss's OK to free disk. Another session's synth_golden.py jobs eat RAM/disk; keep workers at 2.
