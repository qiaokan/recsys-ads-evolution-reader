// Builds dist/index.html from src/.
//   node build.mjs          write dist/index.html
//   node build.mjs --check     fail if dist/index.html is stale or any TeX is invalid
//   node build.mjs --validate  only check that every chapter assembles and all TeX renders (no write)
//   node build.mjs --only 03 --out /tmp/ch3.html   preview one chapter (prefix match) to another file
//
// Authoring conventions (src/chapters/*.html):
//   <x-tex>a+b</x-tex>          inline math (TeX, HTML-escaped: write &lt; for <)
//   <x-tex display>…</x-tex>    display math
//   <!-- script: name.js -->    inline src/js/name.js at this position
//   <x-chart>{…}</x-chart>      build-time SVG chart (spec in scripts/charts.mjs; see docs/AUTHORING.md)
// Every <h2> without an id gets a stable slug id for deep links and the page outline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { renderCharts } from './scripts/charts.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const errors = [];

// Inline only the KaTeX font families the rendered math can use (each optional family is
// triggered by a specific KaTeX class); the rest are dropped to keep the page small.
const OPTIONAL_FONTS = {
  KaTeX_Caligraphic: /\bmathcal\b/, KaTeX_Fraktur: /\bmathfrak\b/, KaTeX_Script: /\bmathscr\b/,
  KaTeX_SansSerif: /\b(mathsf|textsf|mathsfit)\b/, KaTeX_Typewriter: /\b(mathtt|texttt)\b/,
};
function katexCss(html) {
  const dir = path.join(root, 'node_modules/katex/dist');
  return fs
    .readFileSync(path.join(dir, 'katex.min.css'), 'utf8')
    .replace(/@font-face\{font-display:block;font-family:(KaTeX_\w+);[^}]*\}/g, (face, fam) =>
      OPTIONAL_FONTS[fam] && !OPTIONAL_FONTS[fam].test(html) ? '' : face)
    .replace(/src:url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)(?:,url\([^)]+\) format\("[^"]+"\))*/g, (_, f) =>
      `src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}) format("woff2")`);
}

const unescape = (s) => s.replace(/&(lt|gt|amp|quot|#39);/g, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', '#39': "'" })[e]);
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const slug = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function renderTex(html, file) {
  return html.replace(/<x-tex( display)?>([\s\S]*?)<\/x-tex>/g, (_, display, tex) => {
    try {
      return katex.renderToString(unescape(tex).trim(), { displayMode: !!display, throwOnError: true, strict: 'error', output: 'htmlAndMathml' });
    } catch (e) {
      errors.push(`${file}: ${e.message}\n    TeX: ${tex.trim().slice(0, 160)}`);
      return '';
    }
  });
}

function chapter(file, index) {
  let html = read(`src/chapters/${file}`);
  html = html.replace(/<!-- script: ([\w.-]+) -->/g, (_, js) => `<script id="ar-${js.replace(/\.js$/, '')}-script">\n${read(`src/js/${js}`)}</script>`);
  const used = new Set();
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    let id = `c${index + 1}-${slug(inner)}`;
    while (used.has(id)) id += '-x';
    used.add(id);
    return `<h2 id="${id}">${inner}</h2>`;
  });
  html = renderCharts(html, file, errors);
  html = renderTex(html, file);
  const tag = html.match(/<article\b[^>]*>/)[0];
  const attr = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [])[1] || '';
  const title = html.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '');
  if (index > 0 && !/\shidden\b/.test(tag)) html = html.replace(tag, tag.replace(/>$/, ' hidden>'));
  return { html, nav: attr('data-nav'), time: attr('data-time'), title };
}

const argVal = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const only = argVal('--only');
const files = fs.readdirSync(path.join(root, 'src/chapters')).filter((f) => f.endsWith('.html') && (!only || f.startsWith(only))).sort();
const chapters = files.map(chapter);
// Reading-path totals come from data-gist / data-full minutes on each <article>, so the hero cannot drift from the chapters.
const TIMES = files.reduce((t, f) => {
  const tag = read(`src/chapters/${f}`).match(/<article\b[^>]*>/)[0];
  const n = (k) => Number((tag.match(new RegExp(`data-${k}="(\\d+)"`)) || [])[1] || 0);
  return { gist: t.gist + n('gist'), full: t.full + n('full') };
}, { gist: 0, full: 0 });
const pad = (i) => String(i + 1).padStart(2, '0');
const nav = chapters
  .map((c, i) => `<li><a class="ar-chapterlink" href="#chapter-${i + 1}" data-chapter="${i}"${i === 0 ? ' aria-current="page"' : ''}><span class="ar-navnum">${pad(i)}</span><span class="ar-navlabel">${c.nav}</span><span class="ar-navtime">${c.time}</span></a></li>`)
  .join('\n');

const out = read('src/template.html')
  .replace('{{KATEX_CSS}}', () => katexCss(chapters.map((c) => c.html).join('')))
  .replace('{{READER_CSS}}', () => read('src/css/reader.css'))
  .replace('{{CHAPTER_NAV}}', () => nav)
  .replace('{{CHAPTER_COUNT}}', String(chapters.length).padStart(2, '0'))
  .replace('{{CHAPTERS}}', () => chapters.map((c) => c.html.trim()).join('\n'))
  .replace('{{CHAPTER_META}}', () => escapeAttr(JSON.stringify(chapters.map(({ title, time }) => ({ title, time })))))
  .replace('{{GIST_MIN}}', String(TIMES.gist))
  .replace('{{FULL_MIN}}', String(TIMES.full))
  .replace('{{MILESTONES}}', String(chapters.reduce((n, c) => n + (c.html.match(/<li class="ar-ms"/g) || []).length, 0)))
  .replace('{{READER_JS}}', () => read('src/js/reader.js'));

if (errors.length) {
  console.error(`Build errors (${errors.length}):\n` + errors.join('\n'));
  process.exit(1);
}
const target = argVal('--out') ? path.resolve(argVal('--out')) : path.join(root, 'dist/index.html');
if (only && !argVal('--out') && !process.argv.includes('--validate')) { console.error('--only requires --out (never overwrite dist with a partial build)'); process.exit(1); }
if (process.argv.includes('--validate')) {
  console.log('PASS: all chapters assemble and all TeX renders.');
} else if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== out) {
    console.error('dist/index.html is stale: run `npm run build`.');
    process.exit(1);
  }
  console.log('PASS: dist/index.html matches src/, all TeX valid.');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out);
  console.log(`Wrote ${path.relative(root, target)} (${(out.length / 1024).toFixed(0)} KB, ${chapters.length} chapters).`);
}
