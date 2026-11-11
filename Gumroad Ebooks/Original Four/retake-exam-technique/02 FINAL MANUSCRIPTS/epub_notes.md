# EPUB / PDF builder notes for manuscript_final.md

Parser assumed: python-markdown with `fenced_code`, `tables`, `sane_lists`; no `nl2br`. Every construct below was test-rendered with exactly that configuration and produces the HTML shown.

## 1. Worked multiple-choice question

```
> **Question.** Stem text, ending with the lead-in. What should you do FIRST?
>
> - **A.** Option text.
> - **B.** Option text.
> - **C.** Option text.
> - **D.** Option text.

**Answer: B.** Explanation paragraph...
```

Renders as `<blockquote><p><strong>Question.</strong> ...</p><ul><li><strong>A.</strong> ...</li>...</ul></blockquote>` followed by a normal paragraph starting with `<strong>Answer: B.</strong>`.

Builder requirements:
- Style `blockquote > ul` with `list-style: none; padding-left: 0; margin-left: 0` so the bullet does not show; the bold `A.` to `D.` is the label. Each `li` on its own line (block), small vertical gap.
- Keep the blockquote together on a page (`page-break-inside: avoid`), and do not make blockquote text italic (the old EPUB did and the options collapsed).
- Chapter 6 splits one question in two: a stem blockquote (**Question.**), prose about prediction, then a blockquote that holds only the option list. This is intended; it follows the prose. The list-only blockquote is the same `<blockquote><ul>` markup.
- Never rely on raw line breaks inside a paragraph: there are none in the manuscript.

## 2. Self-talk lines and single paragraph scripts

Plain blockquote with one paragraph: `> "Text."`. Multi-paragraph spoken scripts (chapters 12 and 13) are several blockquote paragraphs separated by `>` blank lines. Do not italicise.

## 3. Templates the reader copies (emails, fill-in sentences, log and plan templates)

Fenced code block with info string `text`, lines hard-wrapped at 64 characters or fewer, blank lines between paragraphs:

````
```text
Dear Candidate Services,

I sat the (exam name) on (date) ...
```
````

Renders `<pre><code class="language-text">`. Builder requirements: monospace font at a size that fits 64 characters in the text column (about 9 pt on a 6 inch measure), `white-space: pre-wrap; word-wrap: break-word`, light background, `page-break-inside: avoid` where possible. Placeholders are in round brackets, for example `(exam name)`; do not treat them as markup. There are 17 such blocks (chapters 4, 12, 14, 15, 16, 18).

## 4. Rule lines list (chapter 7, "Putting the rules into practice")

A normal bulleted list, `- **FIRST:** "danger, then information."` and so on. Show bullets.

## 5. Table (chapter 10, checkpoints)

One pipe table with a header row, four columns. Needs borders or row striping and `table { width: 100%; }`; keep text at body size. No other tables in the book.

## 6. Images and captions

`![alt](diagrams/NN_name.png)` on its own paragraph, followed by a blank line and `*Figure N. caption*` as its own italic paragraph. Embed the PNG from `02 FINAL MANUSCRIPTS/diagrams/` (800 px wide; print at about 4.8 inches wide, set `max-width: 100%`). Caption centred, small. Five figures. Do not use the SVG files in the EPUB.

## 7. Headings and front/back matter

- `# Chapter N. Title` for chapters 1 to 18. `#` unnumbered: "Conclusion: the habits that carry over", "Recommended next steps and further resources", "About the publisher", "Copyright". Each H1 starts a new page/file.
- Chapter 1 (How to use this book) is numbered 1 on purpose: the book's own references count it as chapter 1.
- Move or build your own copyright page at the front if the builder does that; the "Copyright" H1 at the end of the manuscript may then be dropped so it is not duplicated. Keep the sentence "This book is not affiliated with, endorsed by or approved by any examination body, licensing authority or professional body." on it.
- Title page and cover are added by the builder. Cover subtitle: "Exam technique for candidates retaking a professional licensing exam". Do not add any promise or pass claim anywhere.

## 8. Other

- Inline bold with `**`, bold-italic not used. Straight double quotes in scripts are intentional (leave as typed; smart quotes are optional).
- Reference list in the last chapter is a bulleted list of four items with bare URLs; make URLs wrap (`word-break: break-all` on that list) so they do not overflow the page.
