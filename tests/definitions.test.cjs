// Every abbreviation on the page must be findable: in the glossary, the venue table, or an explicit
// allowlist of proper names and general computing terms. node tests/definitions.test.cjs
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
// Prose comes from the chapter sources with math removed (rendered KaTeX would leak symbol names).
const dir = path.join(__dirname, '../src/chapters');
const src = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const unent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"');
const body = unent(src
  .replace(/<x-tex[^>]*>[\s\S]*?<\/x-tex>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<a\b[^>]*href="https?:[^"]*"[^>]*>[\s\S]*?<\/a>/g, ' ') // cited titles are quoted, not our prose
  .replace(/<[^>]+>/g, ' '));

const gl = html.slice(html.indexOf('id="glossary"'), html.indexOf('id="ar-review"'));
const defined = new Set();
for (const [, cell] of gl.matchAll(/<td data-label="(?:Term|Venue)">([\s\S]*?)<\/td>/g)) {
  for (const part of unent(cell.replace(/<[^>]+>/g, '')).split(/\s*[/()]\s*|-/)) {
    for (const tok of part.match(/[A-Za-z0-9&+-]+/g) || []) defined.add(tok.replace(/s$/, ''));
  }
}

// Proper names, roman numerals, exercise labels and general computing terms: not glossary material.
const ALLOW = new Set(`AT T PARC MIT IEEE DVD NVIDIA US EU SEC URL API AI GPU CPU ID I II III IV V Q1 Q2 Q3 Q4
  G1 G2 G3 G4 G5 G6 D1 D2 D3 D4 D5 D6 D7 D8 ETH UCL AXON GPT MTIA CHIPS FLEDGE FALCON M CIN L1 L2 P5 ROC S P
  CDF NIPS OK ACM SIGKDD USENIX ESCM T5`.split(/\s+/));

const missing = new Map();
for (const m of body.matchAll(/\b[A-Z][A-Z0-9]+s?\b/g)) {
  const tok = m[0].replace(/(?<=[A-Z0-9])s$/, '');
  if (defined.has(tok) || ALLOW.has(tok)) continue;
  if (!missing.has(tok)) missing.set(tok, body.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' '));
}
if (missing.size) {
  console.error(`FAIL: ${missing.size} abbreviation(s) not in the glossary:\n- ` + [...missing].map(([k, v]) => `${k}: …${v}…`).join('\n- '));
  process.exit(1);
}
console.log(`PASS: every abbreviation on the page is in the glossary (${defined.size} terms) or the proper-name allowlist.`);
