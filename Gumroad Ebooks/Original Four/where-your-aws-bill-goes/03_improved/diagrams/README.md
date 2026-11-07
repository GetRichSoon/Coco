# Diagrams for "Where Your AWS Bill Goes"

Five self-contained SVGs (1200 px wide, Georgia headings and Segoe UI labels, palette navy #0f2238 / cream #f4efe6 / copper #b87333 / teal #3aa6a0). Each has a PNG render (headless Chrome) that was viewed to check legibility. Text is 24 px or larger on a 1200 px canvas, which is about 9 pt or larger at a 6 inch page width. No prices, no AWS logos, no service icons.

Every diagram restates something the manuscript already says. None adds a fact.

| File | Placed before heading | What it shows | Why it helps |
|---|---|---|---|
| `five_shapes.svg` | "Reading an unfamiliar service" (five things you pay for chapter) | Time, storage, requests, data transfer, provisioned capacity: what you pay for, what you control, how each behaves as you grow | The whole book rests on this table; readers can return to it when they open any pricing page. |
| `why_did_it_go_up.svg` | "Daily granularity, and why monthly lies" (reading the bill chapter) | The five-step investigation: service, usage type, matching dimension, cost versus usage, detailed report | It is the single most reused routine in the book; a numbered flow is faster to find than a paragraph. |
| `boundary_ladder.svg` | "The boundaries that cost money and are easy to cross by accident" (data transfer chapter) | Ordering only: within a zone, across zones, across regions, out to the internet; plus "traffic in is generally not charged" | Makes the rule "bytes cost by the boundary they cross" visible. Bars are labelled as order only, not prices. |
| `right_sizing_tree.svg` | "Automated recommendations, and their one bias" (right-sizing chapter) | The five questions in order: delete, change family, reduce one step, scale out, upgrade generation | The decision tree is described in prose; this turns it into a lookup. |
| `monthly_review.svg` | "What to do with what you find" (monthly review chapter) | The six steps of the one-hour review with minutes (5, 10, 20, 10, 10, 5) drawn to scale | Shows that the hour is real and where it goes; printable as a pinned reminder. |

`..\manuscript_with_diagrams.md` is an exact copy of the original manuscript with only these five image lines (each followed by a blank line) inserted. Removing the five lines gives back the original byte for byte (checked).

Not diagrammed on purpose: the worked-month chapter (the step shape is clear in prose; a chart would require invented numbers) and the NAT gateway chapter (a network diagram would need service icons).

Before use in an EPUB: SVG is supported by most EPUB 3 readers, but add a PNG fallback for older Kindle-style readers. Alt text in the manuscript is already written for each image.
