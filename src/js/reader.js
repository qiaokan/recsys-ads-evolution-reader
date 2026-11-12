(() => {
  const root = document.getElementById('adtech-reader');
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const meta = JSON.parse(root.dataset.chapters);
  const lessons = [...root.querySelectorAll('.ar-lesson')];
  const links = [...root.querySelectorAll('.ar-chapterlink')];
  const last = lessons.length - 1;
  const pad = (i) => String(i + 1).padStart(2, '0');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  // ---------- Theme ----------
  const savedTheme = store.get('ar-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.dataset.theme = savedTheme;
  $('ar-theme').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('ar-theme', next);
  });

  // ---------- Mobile menu ----------
  const menu = $('ar-menu');
  const setMenu = (open) => { root.classList.toggle('ar-menu-open', open); menu.setAttribute('aria-expanded', String(open)); };
  menu.addEventListener('click', () => setMenu(!root.classList.contains('ar-menu-open')));

  // ---------- Reading progress (current chapter) ----------
  const bar = $('ar-progress');
  const progress = () => {
    const el = lessons.find((l) => !l.hidden);
    if (!el || !bar) return;
    const r = el.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, total > 0 ? -r.top / total : 1))})`;
  };
  addEventListener('scroll', progress, { passive: true });
  addEventListener('resize', progress);

  // ---------- Chapters, outline, and deep links ----------
  let chapter = 0;
  let observer = null;

  function buildOutline() {
    const list = $('ar-outline');
    list.textContent = '';
    if (observer) observer.disconnect();
    const heads = [...lessons[chapter].querySelectorAll('h2[id]')];
    const items = new Map();
    for (const h of heads) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.append(a);
      list.append(li);
      items.set(h, a);
    }
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        items.forEach((a) => a.removeAttribute('aria-current'));
        items.get(e.target)?.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '0px 0px -75% 0px' });
    heads.forEach((h) => observer.observe(h));
  }

  function showChapter(i) {
    chapter = Math.max(0, Math.min(last, i));
    lessons.forEach((el, k) => { el.hidden = k !== chapter; });
    links.forEach((a, k) => (k === chapter ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('ar-current-label').textContent = `Chapter ${pad(chapter)} of ${pad(last)}`;
    $('ar-current-time').textContent = meta[chapter].time;
    $('ar-page-index').textContent = `${pad(chapter)} / ${pad(last)}`;
    $('ar-prev').disabled = chapter === 0;
    $('ar-next').disabled = chapter === last;
    $('ar-prev-title').textContent = chapter > 0 ? meta[chapter - 1].title : '—';
    $('ar-next-title').textContent = chapter < last ? meta[chapter + 1].title : 'End of reader';
    document.title = `${meta[chapter].title} · Recommendation & Ads Algorithms`;
    buildOutline();
    progress();
    store.set('ar-chapter', String(chapter));
  }

  function route(scroll) {
    const hash = decodeURIComponent(location.hash.slice(1));
    const m = /^chapter-(\d+)$/.exec(hash);
    let target = null;
    if (m) showChapter(Number(m[1]) - 1);
    else if (hash && (target = document.getElementById(hash)) && root.contains(target)) {
      const owner = target.closest('.ar-lesson');
      if (owner) showChapter(lessons.indexOf(owner));
      for (let el = target; el && root.contains(el); el = el.parentElement) {
        if (el.tagName === 'DETAILS') el.open = true;
      }
    } else showChapter(Number(store.get('ar-chapter')) || 0);
    setMenu(false);
    if (!scroll) return;
    (target && !m ? target : $('ar-main')).scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  const go = (i) => { location.hash = `chapter-${i + 1}`; };
  $('ar-prev').addEventListener('click', () => chapter > 0 && go(chapter - 1));
  $('ar-next').addEventListener('click', () => chapter < last && go(chapter + 1));
  addEventListener('hashchange', () => route(true));
  route(Boolean(location.hash));

})();
