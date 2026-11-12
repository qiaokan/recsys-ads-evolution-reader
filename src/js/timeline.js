// Timeline explorer (chapter 2): filter milestones by track chips, era and free-text search.
// Works without JavaScript: every milestone is static HTML; this script only hides non-matching ones.
(() => {
  const list = document.getElementById('ar-tl');
  if (!list) return;
  const items = [...list.querySelectorAll('li.ar-ms')];
  const chips = [...document.querySelectorAll('#ar-tl-controls .ar-chip')];
  const era = document.getElementById('ar-tl-era');
  const q = document.getElementById('ar-tl-q');
  const count = document.getElementById('ar-tl-count');
  const empty = document.getElementById('ar-tl-empty');
  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const text = new Map(items.map((li) => [li, norm(li.textContent)]));

  // Exposed for tests: returns the indices of visible milestones for a given filter state.
  function matches(li, state) {
    const tracks = li.dataset.track.split(/\s+/);
    if (!tracks.some((t) => state.tracks.has(t))) return false;
    if (state.era !== 'all' && li.dataset.era !== state.era) return false;
    const terms = norm(state.query).split(/\s+/).filter(Boolean);
    return terms.every((t) => text.get(li).includes(t));
  }

  function apply() {
    const state = {
      tracks: new Set(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.track)),
      era: era.value,
      query: q.value,
    };
    let shown = 0;
    for (const li of items) {
      const ok = matches(li, state);
      li.hidden = !ok;
      if (ok) shown += 1;
    }
    count.textContent = `Showing ${shown} of ${items.length} milestones`;
    empty.hidden = shown > 0;
  }

  for (const c of chips) {
    c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
      apply();
    });
  }
  era.addEventListener('change', apply);
  q.addEventListener('input', apply);
  list.arMatches = matches;
  apply();
})();
