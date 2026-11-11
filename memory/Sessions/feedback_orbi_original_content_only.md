---
name: feedback-orbi-original-content-only
description: "Orbi editorial and default wallpapers must be original Orbi-made AI art from an approved provider, human reviewed; no third-party, stock, Pinterest or catalogue images (2026-11-11)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c61efa00-d33f-4fd9-a5f4-76b5bc1eaf5f
  modified: 2026-11-11T08:48:32.467Z
---

Founder policy (2026-11-11, overrides every earlier editorial seeding instruction): automated Orbi Editorial posts and default wallpapers may only be ORIGINAL images Orbi created from scratch with an approved image-generation provider whose terms allow the use. Never Pinterest, Google Images, stock, other creators' uploads, social media, protected characters, logos or brands, named living artists, or another creator's image as a reference. Not even "free", public domain or Creative Commons catalogues, and never just to hit a daily count.

The 546-item external catalogue (`catalogue/`, and `extension/data/catalogue.json` on rc-3.1) stays in the repo but is HELD for an independent rights review: do not delete it, do not publish it, the extension package excludes `data/catalogue.json`.

What follows from it:
- Channels are official "Orbi Editorial — Nature / Space / AMOLED / Architecture / Abstract / Automotive / Fantasy", never fake people.
- 6–12 posts a day is a ceiling: publish fewer, or none, when quality, originality or rights checks fail.
- Every generated image needs a stored generation record (provider, model and version, date, prompt, asset id, provider terms, human review, commercial eligibility, similarity concerns, final decision). Never call an image "copyright-free".
- No fake users, likes, followers, comments or download numbers.
- After about 30–60 days, cut the editorial share as real creators contribute; never suppress creators to keep Orbi-controlled content on top.

**Why:** the founder wants Orbi known for exceptional original wallpapers, not for copying images from other platforms.
**How to apply:** the editorial scheduler publishes only approved `editorial_assets`. No image provider is approved yet, so zero editorial posts go out until one is. Related: [[project-orbi-210-rc]].
