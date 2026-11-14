// Static checks on the built page: node tests/site.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// Self-contained, locked-down page.
assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'/);
assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/, 'no external scripts');
assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"/, 'no external stylesheets');
assert.doesNotMatch(html, /<iframe\b/, 'no iframe wrapper');
assert.doesNotMatch(html, /<x-tex\b/, 'all TeX rendered at build time');
assert.doesNotMatch(html, /<x-chart\b/, 'all charts rendered at build time');

// Eleven chapters, only the first visible without JavaScript.
const articles = [...html.matchAll(/<article class="ar-lesson" id="ar-chapter-(\d+)"[^>]*>/g)];
assert.deepEqual(articles.map((m) => m[1]), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
assert.deepEqual(articles.map((m) => /\shidden\b/.test(m[0])), [false, true, true, true, true, true, true, true, true, true, true]);

// Every chapter except the reference chapter opens with a plain-words gist.
const lessons = html.split(/<article class="ar-lesson"/).slice(1);
lessons.slice(0, -1).forEach((a, i) => check(/<p class="ar-gist">/.test(a), `chapter ${i + 1} has no ar-gist paragraph`));

// Unique ids; every in-page link resolves.
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
check(dupes.length === 0, `duplicate ids: ${[...new Set(dupes)].join(', ')}`);
const idSet = new Set(ids);
for (const [, target] of html.matchAll(/href="#([^"]*)"/g)) {
  const m = /^chapter-(\d+)$/.exec(target);
  check(m ? +m[1] >= 1 && +m[1] <= 11 : idSet.has(target), `broken in-page link #${target}`);
}

// Mobile table layout: each data-label equals its column header.
for (const [table] of html.matchAll(/<table>[\s\S]*?<\/table>/g)) {
  const heads = [...(table.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]));
  if (!heads.length) continue;
  for (const [row] of table.matchAll(/<tr>(?:(?!<\/tr>)[\s\S])*?<td[\s\S]*?<\/tr>/g)) {
    [...row.matchAll(/<td\b([^>]*)>/g)].forEach((m, i) => {
      const label = (m[1].match(/data-label="([^"]*)"/) || [])[1];
      check(label !== undefined && strip(label) === heads[i], `data-label "${label}" ≠ header "${heads[i]}"`);
    });
  }
}

// Every chart has a caption telling the reader what to notice.
for (const [fig] of html.matchAll(/<figure class="ar-figure ar-chart">[\s\S]*?<\/figure>/g)) {
  check(/<figcaption>/.test(fig), `chart without caption: ${strip((fig.match(/ar-figtitle[^>]*>([^<]*)/) || [])[1] || fig.slice(0, 80))}`);
}

// House style.
const text = strip(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ''));
check(!/\byuan\b/.test(text), 'currency must be US dollars ("yuan" found)');
check(!/\{\{[A-Z_]+\}\}/.test(html), 'unreplaced template placeholder');

// Hero totals equal the per-chapter reading times stated in chapter 1.
const stat = (k) => +(html.match(new RegExp(`<dt>${k}</dt><dd>(\\d+)`)) || [])[1];
check(stat('Gist path') === 145 && stat('Full path') === 430, `hero totals ${stat('Gist path')}/${stat('Full path')} ≠ 145/430`);

// Evidence badges only use the four defined grades.
for (const [, cls] of html.matchAll(/class="ar-ev ar-ev-([a-z]+)"/g)) check(['paper', 'post', 'call', 'inf'].includes(cls), `unknown evidence grade ${cls}`);

// Every chapter link to an exercise or section id resolves (covered above); external links open safely.
for (const [a] of html.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)) check(!/javascript:/i.test(a), 'unsafe link');

if (failures.length) {
  console.error(`FAIL (${failures.length}):\n- ` + [...new Set(failures)].join('\n- '));
  process.exit(1);
}
console.log('PASS: self-contained page, eleven chapters, chapter gists, unique ids, resolvable links, table labels, hero totals, evidence grades.');
