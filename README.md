# Recommendation & Ads Algorithms, 1992–2026: An Evolution Reader

An interactive reader on how recommendation and advertising algorithms evolved: collaborative filtering and keyword auctions, matrix factorization and planet-scale logistic regression, deep ranking and the multi-stage funnel, exchanges / first-price auctions / autobidding, bias, causality and the privacy shock, and scaling laws and generative recommenders. A companion to the [Computational Advertising reader](https://github.com/qiaokan/computational-advertising-reader), built on the same toolchain.

## Contents

1. Start here: six through-lines, five eras, evidence grades, reading paths
2. Interactive timeline: 87 dated milestones, filterable by track, era and keyword
3. Era I (1992–2005): neighbourhoods and keyword auctions (GroupLens, Amazon item-to-item, GoTo, GSP vs VCG)
4. Era II (2006–2013): latent factors and linear models (Netflix Prize, MF, implicit ALS, BPR, FM, FTRL, bandits)
5. Era III (2013–2020): embeddings, deep ranking and the funnel (YouTube DNN, Wide & Deep, DCN, DIN, two-tower + logQ, ESMM, MMoE, reproducibility audits)
6. Ads track (2007–2026): RTB, oCPM/oCPC, pacing, first-price shading, autobidding, campaign automation
7. Cross-cutting: position bias and IPS, off-policy evaluation, delayed feedback, incrementality, ITP/GDPR/ATT/Privacy Sandbox
8. Era V (2021–2026): scaling laws, semantic IDs, HSTU, OneRec, Andromeda/GEM, ads in AI answers
9. Fourteen exercises with worked answers (gist set and depth set)
10. Sources, glossary and review record (fact-check findings and corrections)

Every company claim carries an evidence grade: **Paper**, **Post** (engineering blog, documentation, press record), **Call** (earnings call / investor letter) or **Inference** (this reader's interpretation).

## Layout

```
src/template.html        page shell (header, hero, sidebar, pagination)
src/chapters/NN-*.html   one <article> per chapter; data-gist / data-full minutes feed the hero totals
src/css/reader.css       theme (light/dark tokens, layout, components, timeline explorer, evidence badges)
src/js/reader.js         chapter routing, outline, theme toggle
src/js/timeline.js       timeline filters (track chips, era, search); static HTML works without JS
scripts/charts.mjs       build-time SVG charts from <x-chart> JSON specs
build.mjs                assembles dist/index.html, renders TeX and charts, inlines the KaTeX fonts in use
tests/                   site integrity (links, ids, tables, hero totals) and timeline integrity + filter logic
dist/index.html          the self-contained page to deploy
```

Authoring conventions are the same as the companion reader: `<x-tex>` for math, `<x-chart>{…}</x-chart>` for charts, `<!-- script: name.js -->` to inline a script, `<td data-label>` equal to the column header. Timeline milestones are `<li class="ar-ms" data-year data-era data-track>` with an evidence badge; the test suite enforces chronological order, era/year consistency, known tracks and a grade on every entry.

## Build, test, preview

```
npm install
npm run build
npm test
python3 -m http.server 8000 --directory dist
```

The page is a single self-contained HTML file with no external requests. Deploy `dist/` as a static site (the included `vercel.json` serves it with no build step).
