# Authoring guide

Same toolchain and components as the companion Computational Advertising reader (callouts, worked examples, `<x-tex>`, `<x-chart>`, tables with `data-label`, `ar-timeline`). This file lists only what is specific to the evolution reader.

## Reader and claims

- Reader: fluent in CS, ML, probability, distributed systems and markets. Never explain basics; define every domain term and acronym at first use or link to the glossary (`#glossary`).
- Each section opens with a bold sentence stating its claim (the gist path reads only these).
- Every company claim carries an evidence badge: `<span class="ar-ev ar-ev-paper">Paper</span>`, `ar-ev-post` (engineering blog, documentation, press record), `ar-ev-call` (earnings call, investor letter), `ar-ev-inf` (this reader's interpretation). Interpretive paragraphs use `<p class="ar-inference"><strong>Inference.</strong> …</p>`.
- Quote company-reported gains with their scope (metric, surface, period). Never present them as reproduced.
- Every new dated or numeric claim gets a source in chapter 11 and an entry in the review record if it was corrected.

## Timeline milestones (chapter 2)

```html
<li class="ar-ms" data-year="2016" data-era="3" data-track="recs ads"><span class="ar-t">2016</span><div><strong>Title</strong> <span class="ar-ev ar-ev-paper">Paper</span><p>What changed and why it mattered. <a href="#chapter-5">Ch. 5</a></p></div></li>
```

- `data-track`: any of `recs ads sys eval privacy` (space-separated).
- `data-era`: 1 (1992–2005), 2 (2006–2013), 3 (2013–2020), 5 (2021–2026). Era IV is a theme, reached via tracks.
- Keep entries in chronological order; `tests/timeline.test.cjs` enforces order, era/year consistency, known tracks, an evidence badge on each entry, and that the hero milestone count matches.

## Reading times

Each `<article>` carries `data-gist` and `data-full` minutes; the build sums them into the hero, and `tests/site.test.cjs` checks the totals against the table in chapter 1. Update both when a chapter's length changes.
