// Timeline integrity and filter logic: node tests/timeline.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const TRACKS = new Set(['recs', 'ads', 'sys', 'eval', 'privacy']);
const ERA = { 1: [1992, 2005], 2: [2006, 2013], 3: [2013, 2020], 5: [2021, 2026] };

const items = [...html.matchAll(/<li class="ar-ms" data-year="(\d{4})" data-era="(\d)" data-track="([a-z ]+)"><span class="ar-t">(\d{4})<\/span><div>([\s\S]*?)<\/div><\/li>/g)]
  .map((m) => ({ year: +m[1], era: m[2], tracks: m[3].split(' '), label: +m[4], body: m[5] }));
const raw = (html.match(/<li class="ar-ms"/g) || []).length;
assert.equal(items.length, raw, 'every milestone parses');
assert.ok(items.length >= 80, `expected at least 80 milestones, found ${items.length}`);

const hero = +(html.match(/<dt>Milestones<\/dt><dd>(\d+)/) || [])[1];
check(hero === items.length, `hero milestone count ${hero} ≠ ${items.length}`);

items.forEach((it, i) => {
  const title = (it.body.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || `#${i}`;
  check(it.year === it.label, `${title}: data-year ${it.year} ≠ label ${it.label}`);
  check(i === 0 || it.year >= items[i - 1].year, `${title}: out of chronological order`);
  const [lo, hi] = ERA[it.era] || [];
  check(lo !== undefined && it.year >= lo && it.year <= hi, `${title}: year ${it.year} outside era ${it.era}`);
  it.tracks.forEach((t) => check(TRACKS.has(t), `${title}: unknown track ${t}`));
  check(/class="ar-ev ar-ev-(paper|post|call)"/.test(it.body), `${title}: missing evidence grade`);
});
// Every track and every era option has at least one milestone.
for (const t of TRACKS) check(items.some((it) => it.tracks.includes(t)), `track ${t} is empty`);
for (const e of Object.keys(ERA)) check(items.some((it) => it.era === e), `era ${e} is empty`);
// Each track chip in the controls corresponds to a known track.
const chips = [...html.matchAll(/class="ar-chip" aria-pressed="true" data-track="([a-z]+)"/g)].map((m) => m[1]);
assert.deepEqual(new Set(chips), TRACKS);

// Filter logic: run the shipped timeline.js matcher against a minimal DOM stub.
const src = (html.match(/<script id="ar-timeline-script">([\s\S]*?)<\/script>/) || [])[1];
assert.ok(src, 'timeline script inlined');
const strip = (s) => s.replace(/<[^>]+>/g, ' ');
const lis = items.map((it) => ({ dataset: { track: it.tracks.join(' '), era: it.era }, textContent: strip(it.body), hidden: false }));
const el = (extra) => ({ addEventListener() {}, textContent: '', hidden: false, ...extra });
const list = { querySelectorAll: () => lis };
const docStub = {
  getElementById: (id) => ({ 'ar-tl': list, 'ar-tl-era': el({ value: 'all' }), 'ar-tl-q': el({ value: '' }), 'ar-tl-count': el(), 'ar-tl-empty': el() })[id],
  querySelectorAll: () => chips.map((t) => el({ dataset: { track: t }, getAttribute: () => 'true', setAttribute() {} })),
};
new Function('document', src)(docStub);
const run = (tracks, era, query) => lis.filter((li) => list.arMatches(li, { tracks: new Set(tracks), era, query })).length;
check(run([...TRACKS], 'all', '') === items.length, 'all filters on should show everything');
check(run(['privacy'], 'all', '') === items.filter((it) => it.tracks.includes('privacy')).length, 'privacy filter count');
check(run([...TRACKS], '1', '') === items.filter((it) => it.era === '1').length, 'era 1 filter count');
check(run([...TRACKS], 'all', 'ftrl') >= 1, 'search finds FTRL');
check(run([...TRACKS], 'all', 'zzzz-no-match') === 0, 'nonsense search finds nothing');
check(run([], 'all', '') === 0, 'no tracks selected shows nothing');

if (failures.length) {
  console.error(`FAIL (${failures.length}):\n- ` + failures.join('\n- '));
  process.exit(1);
}
console.log(`PASS: ${items.length} milestones dated, ordered, era-consistent, graded; filter logic verified.`);
