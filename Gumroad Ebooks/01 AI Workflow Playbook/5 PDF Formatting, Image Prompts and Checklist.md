# PDF formatting, image-generation prompts and publishing checklist

No images were generated for this package. Use the prompts below in ChatGPT Image Generation, one at a time.

---

## A. PDF layout instructions

- **Page size:** 6 x 9 in portrait. Margins: 0.75 in inside, 0.6 in outside, 0.7 in top and bottom.
- **Fonts:** headings in a serif (Georgia, Playfair Display or similar); body in a clean sans (Inter, Source Sans) at 10.5 to 11 pt, line height 1.5.
- **Colors:** midnight navy #0B1330, electric blue #3D8BFF, champagne gold #D9BD84, ivory #F6F1E6.
- **Chapter openers:** full-page navy with chapter number in gold, title in ivory.
- **Workflow pages:** each workflow starts on a new page. Show the nine parts with small gold labels. Put prompts in a shaded box with a monospace font (use a font that supports straight quotes) so they are easy to copy.
- **Callouts:** "Verify" in a blue-bordered box; "Mistakes" in a grey box.
- **Navigation:** clickable table of contents, PDF bookmarks per chapter and workflow, page numbers in the footer, book title in the header.
- **Check:** copy a prompt out of the PDF into a text editor to confirm quotes and line breaks survive.
- **Export:** PDF with embedded fonts, under about 10 MB.
- **Image placement:** the current PDF contains no images. If you generate the interior diagrams (section C), place them at the stated positions and rebuild with `build_pdf.py`, then update the sales page.

---

## B. Cover and thumbnail prompts

**Image text rule (use in every prompt):** Do not render any letters, words or numbers in the image. Leave clean empty space for text that will be added later in a design tool.

**Shared art direction:** premium international business-book look. Dark midnight navy background, electric blue light, subtle champagne gold accents. One main focal subject: a luminous, elegant neural-network sphere made of fine glowing lines and small nodes, with a few gold nodes and one thin gold orbit ring. Minimalist editorial composition, soft depth of field, fine dust particles. Avoid cheap robot faces, glowing brains, clip-art circuits, stock-photo people and clutter.

### Prompt A. Portrait front cover (6 x 9 in, 2:3)

```
Create a premium portrait book-cover background, 2:3 aspect ratio (6 x 9 inches, high resolution). Dark midnight navy gradient background. One main focal subject: a large, elegant glowing neural-network sphere made of fine electric-blue lines and small luminous nodes, a few nodes in champagne gold, with one thin gold orbit ring crossing it at a slight angle. Place the sphere in the upper-middle of the frame, taking about 55% of the width. Soft blue glow behind it, subtle dust particles, shallow depth of field, sophisticated editorial minimalism, like a bestselling international business book. The bottom 35% of the image must be clean, dark, nearly empty navy with only a faint gradient, so a title can be added later. Do NOT include any letters, words, numbers, logos or watermarks. No people, no robots, no cartoon icons, no clutter.
```
- **Title overlay (add in design tool, not in the image):**
  - "THE" small, gold, letter-spaced, centered, at about 68% height
  - "AI WORKFLOW" and "PLAYBOOK" large bold serif, ivory, centered over two lines
  - short gold rule below the title
  - subtitle: "30 Practical ChatGPT Systems for Small Business, Marketing, Sales & Daily Operations" in light sans, pale blue-grey, two centered lines
  - no author line (no author name has been provided; add one only when you supply it)
- **Colors:** #0B1330, #3D8BFF, #D9BD84, #F6F1E6.

### Prompt B. Landscape Gumroad product cover (1280 x 720, 16:9)

```
Create a premium landscape background image, 16:9 aspect ratio, high resolution. Dark midnight navy gradient. A large elegant glowing neural-network sphere of fine electric-blue lines and small nodes, a few champagne-gold nodes, and one thin gold orbit ring, positioned on the RIGHT third of the frame, slightly cropped by the right edge. Soft blue glow, fine dust particles, shallow depth of field, minimalist editorial look. The LEFT 55% of the image must be clean, dark, nearly empty navy space for title text. Do NOT include any letters, words, numbers, logos or watermarks. No people, robots, cartoons or clutter.
```
- **Title overlay:** left-aligned block starting at about 7% from the left and 30% from the top: "THE" small gold letter-spaced; "AI WORKFLOW / PLAYBOOK" large ivory serif; gold rule; subtitle in three short lines of pale blue-grey sans. Keep all text inside the left 55%.
- **Final size:** export at 1280 x 720 px minimum (2560 x 1440 is fine).

### Prompt C. Square Gumroad thumbnail (600 x 600, 1:1)

```
Create a premium square background image, 1:1 aspect ratio, high resolution. Dark midnight navy gradient. A glowing neural-network sphere of fine electric-blue lines and small nodes with a few champagne-gold nodes and a thin gold orbit ring, placed in the UPPER RIGHT, partly cropped by the top and right edges. Soft blue glow, fine dust, minimalist editorial style. The lower 45% and left side must be clean dark navy for text. Do NOT include any letters, words, numbers, logos or watermarks. No people, robots, cartoons or clutter.
```
- **Title overlay:** at the bottom-left, "THE" small gold; "AI WORKFLOW / PLAYBOOK" large ivory serif (must stay readable at thumbnail size); gold rule; shortened subtitle "30 Practical ChatGPT Systems for Small Business".
- **Final size:** 600 x 600 px minimum (1200 x 1200 recommended).

---

## C. Interior images (six)

**Rule for all six:** ask the image tool for a clean diagram background with blank labeled shapes only, then add the exact labels yourself in a design tool. Generated text is often wrong. If you want text in the image, paste the exact labels below and check every word.

**Common style:** flat, clean, vector-like infographic on ivory #F6F1E6 background, navy #0B1330 lines and shapes, electric-blue #3D8BFF accent, champagne-gold #D9BD84 highlights, generous spacing, thin consistent line weight, no gradients, no icons that look like clip-art, no people.

### Image 1. AI-powered business workflow map
- **Placement:** Chapter 1, after "The five-part workflow."
- **Purpose:** show the Input, Prompt, Draft, Check, Save loop.
- **Aspect ratio:** 4:3, 1600 x 1200 px.
- **Palette:** ivory, navy, blue, gold.
```
Create a clean infographic diagram on an ivory background, 4:3 aspect ratio. Five rounded rectangles arranged in a horizontal flow connected by thin arrows: five equal boxes left to right, with a return arrow curving from the last box back to the first to show a loop. The fourth box is outlined in champagne gold to signal a human checkpoint. Navy lines, electric-blue fills for boxes, thin consistent line weight, flat vector style, lots of white space. Leave all boxes completely empty with no text, letters or numbers.
```
- **Labels to add:** 1 Input · 2 Prompt · 3 Draft · 4 Human Check (gold) · 5 Save. Caption: "The five-part workflow: AI drafts, you decide."

### Image 2. Prompt framework
- **Placement:** Chapter 2, start.
- **Purpose:** show role, context, task, format, limits.
- **Aspect ratio:** 1:1, 1400 x 1400 px.
```
Create a clean flat infographic on ivory, 1:1. Five stacked horizontal blocks like building layers, equal width, gently stepped from top to bottom, navy outlines with blue fills, the bottom block outlined in gold. A thin vertical arrow on the left pointing downward. Minimal, editorial, no text, no letters, no numbers, blocks left empty for labels.
```
- **Labels:** Role · Context · Task · Format · Limits. Caption: "A good prompt is a good brief."

### Image 3. Marketing content production workflow
- **Placement:** Chapter 4, after Workflow 8.
- **Purpose:** one source piece branching into five outputs.
- **Aspect ratio:** 16:9, 1800 x 1013 px.
```
Create a clean flat infographic on ivory, 16:9. On the left one rounded rectangle, from which five thin lines branch to five smaller rounded rectangles stacked vertically on the right. A small gold circle sits on each connecting line. Navy lines, blue fills, gold accents, generous spacing. No text, letters or numbers; all shapes empty.
```
- **Labels:** Source piece → Email · LinkedIn post · Social captions · Video script · FAQ. Gold circles: "Check facts".

### Image 4. Lead-generation workflow
- **Placement:** Chapter 6, after Workflow 18.
- **Purpose:** show profile → qualify → outreach → follow-up → stop on "no".
- **Aspect ratio:** 16:9.
```
Create a clean flat infographic on ivory, 16:9. A horizontal funnel-like flow of five steps with arrows: four rounded rectangles in a row, then a fifth rounded rectangle slightly below with a small branching arrow to a small gold octagon (a stop shape). Navy outlines, blue fills, gold highlight on the stop shape. No text, letters or numbers; leave shapes empty.
```
- **Labels:** Ideal lead profile · Qualify · Personal message · Follow-ups (day 3, 7, 14) · Reply or no reply. Stop shape: "Said no: stop".

### Image 5. Customer support workflow
- **Placement:** Chapter 7, after Workflow 21.
- **Purpose:** question in, check facts, draft, human review, send, log.
- **Aspect ratio:** 4:3.
```
Create a clean flat infographic on ivory, 4:3. A vertical flow chart of six rounded rectangles connected by arrows, with a small diamond decision shape after the fourth step and a short branch arrow back to the third. Navy outlines, blue fills, one gold-outlined box. No text, letters or numbers; shapes empty.
```
- **Labels:** Customer message · Anonymize + facts · Draft reply · Human review? (decision: "Not ready" returns to Draft) · Send · Log new FAQ idea.

### Image 6. 30-day implementation roadmap
- **Placement:** Chapter 12, start.
- **Purpose:** four weeks, one theme each.
- **Aspect ratio:** 16:9.
```
Create a clean flat infographic on ivory, 16:9. A horizontal timeline with four equal segments connected by a thin navy line, each segment with a circle marker (the final marker gold) and a rounded rectangle above it. Blue fills, navy outlines. Subtle step progression rising slightly to the right. No text, letters or numbers; all shapes empty.
```
- **Labels:** Week 1 Foundations · Week 2 Communication · Week 3 Marketing & research · Week 4 Sales, admin & systems. End marker: "Day 30: review and plan".

---

## D. Final publishing checklist

**Content**
- [ ] Read all 30 workflows and test each prompt once yourself
- [ ] Replace fictional examples if you prefer your own (keep them labeled illustrative)
- [ ] Check every statement about ChatGPT features against the current official help pages; update the "written" date
- [ ] Author name: none provided yet. Do not add one until the owner supplies it
- [ ] Spell-check; confirm no promises of income or growth

**Design**
- [ ] Format PDF per section A; copy-test prompt boxes
- [ ] Generate covers and thumbnail with section B; overlay text yourself; confirm no garbled lettering
- [ ] Place six interior diagrams and add exact labels

**Gumroad**
- [ ] Upload PDF; add product cover (1280 x 720) and thumbnail (600 x 600)
- [ ] Paste description from file 1; set category and 8 tags; set slug
- [ ] Check 5 to 10 competing listings, then set price
- [ ] Enable ratings; add a refund policy that matches your intention
- [ ] Purchase the product yourself as a test and open the PDF
- [ ] No fake reviews, no copied covers or text

**After launch**
- [ ] Share to your own audience; note first-week questions and improve the book (edition 1.1)
- [ ] Start Product 02 using the same format
