// Build-time chart renderer: <x-chart>{JSON spec}</x-chart> → <figure class="ar-figure"> with inline SVG.
// Curves are computed from the formulas in the spec, so a plotted line is exactly the stated function.
// Colors come from CSS classes (tone-*) bound to theme tokens, so charts follow light/dark mode.
//
// Spec (all fields optional unless noted):
// {
//   "type": "line" | "bar",                    default "line"
//   "title": "Short heading", "caption": "HTML (may contain <x-tex>)",
//   "width": 560, "height": 300,              SVG viewBox size
//   "params": {"L": 0.02, "v": 0.015},         constants visible inside every fn
//   "x": {"label": "...", "min": 0, "max": 20, "ticks": [0, 5, 10], "format": FORMAT},   (line: min/max required)
//   "y": {"label": "...", "min": 0, "max": 1, "ticks": [...], "format": FORMAT},        (min/max required)
//   "series": [{"fn": "x/L", "label": "F(b)", "tone": "accent", "dash": false, "from": 0, "to": 20, "samples": 240}
//              | {"points": [[x, y], ...], "label": "...", "tone": "warm", "step": false}],
//   "areas":  [{"fn": "x/L", "fn2": "0", "from": 0, "to": 6, "tone": "accent", "label": "..."}],
//   "vlines": [{"x": 7.5, "label": "b* = $7.50", "tone": "warm", "dash": true}],
//   "hlines": [{"y": 0.3, "label": "...", "tone": "muted", "dash": true}],
//   "points": [{"x": 6, "y": 0.3, "label": "(6, 30%)", "tone": "ink", "pos": "right" | "left" | "above" | "below", "marker": true}],
//   bar charts: "categories": ["A", "B"], "groups": [{"label": "Attributed", "tone": "accent", "values": [1, 2]}],
//               "valueFormat": FORMAT (labels on bars; default = y.format)
// }
// FORMAT: "pct" (0.3 → 30%), "usd" ($1,234), "usd2" ($1,234.56), "num", or {"prefix","suffix","decimals","scale"}.
// Tones: accent, warm, positive, negative, muted, ink.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TONES = new Set(['accent', 'warm', 'positive', 'negative', 'muted', 'ink']);
const tone = (t, d = 'accent') => `tone-${TONES.has(t) ? t : d}`;
let figureCount = 0;

function formatter(f) {
  const presets = {
    pct: { scale: 100, suffix: '%' },
    usd: { prefix: '$', decimals: 0 },
    usd2: { prefix: '$', decimals: 2 },
    num: {},
  };
  const o = typeof f === 'string' ? presets[f] || {} : f || {};
  return (v) => {
    const x = v * (o.scale ?? 1);
    const d = o.decimals ?? (Number.isInteger(+x.toFixed(6)) ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(Math.abs(x) || 1)) + 2)));
    const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (x < 0 ? '−' : '') + (o.prefix ?? '') + s + (o.suffix ?? '');
  };
}

function compile(expr, params) {
  const names = Object.keys(params);
  // eslint-disable-next-line no-new-func
  const f = new Function(...names, 'x', `with (Math) { return (${expr}); }`);
  return (x) => f(...names.map((n) => params[n]), x);
}

function niceTicks(min, max) {
  const span = max - min, step0 = span / 5, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 6);
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

function draw(spec, where, id, W, H) {
  const M = { l: spec.y?.label ? 88 : 60, r: 18, t: 18, b: spec.x?.label ? 52 : 34 };
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const params = spec.params ?? {};
  const ax = spec.x ?? {}, ay = spec.y ?? {};
  if (ay.min == null || ay.max == null) throw new Error(`${where}: chart y.min and y.max are required`);
  const fx = formatter(ax.format), fy = formatter(ay.format);
  const Y = (v) => M.t + ph - ((v - ay.min) / (ay.max - ay.min)) * ph;
  const svg = [];
  const legend = [];
  const yTicks = ay.ticks ?? niceTicks(ay.min, ay.max);

  // Grid and y axis.
  for (const t of yTicks) {
    svg.push(`<line class="xc-grid" x1="${M.l}" x2="${M.l + pw}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>`);
    svg.push(`<text class="xc-tick" x="${M.l - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(fy(t))}</text>`);
  }
  if (ay.min < 0 && ay.max > 0) svg.push(`<line class="xc-zero" x1="${M.l}" x2="${M.l + pw}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`);

  if ((spec.type ?? 'line') === 'bar') {
    const cats = spec.categories ?? [], groups = spec.groups ?? [];
    const band = pw / Math.max(1, cats.length), inner = band * 0.72, bw = inner / Math.max(1, groups.length);
    const fv0 = formatter(spec.valueFormat ?? ay.format);
    const fv = bw >= 58 ? fv0 : (v) => {
      const a = Math.abs(v), k = a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : [1, ''];
      const f = typeof (spec.valueFormat ?? ay.format) === 'string' ? (spec.valueFormat ?? ay.format) : '';
      if (f === 'pct') return fv0(v);
      const pre = f.startsWith('usd') ? '$' : ((spec.valueFormat ?? ay.format)?.prefix ?? '');
      const n = a / k[0];
      return (v < 0 ? '−' : '') + pre + (n >= 100 || k[1] === '' ? Math.round(n) : +n.toFixed(1)) + k[1];
    };
    const values = [];
    cats.forEach((c, i) => {
      const x0 = M.l + i * band + (band - inner) / 2;
      groups.forEach((g, k) => {
        const v = g.values[i];
        if (v == null) return;
        const y1 = Y(Math.max(0, Math.min(v, ay.max))), y0 = Y(Math.max(ay.min, Math.min(0, v)));
        const top = Math.min(y1, y0), h = Math.abs(y0 - y1);
        const x = x0 + k * bw + 1.5;
        svg.push(`<rect class="xc-bar ${tone(g.tone, k ? 'warm' : 'accent')}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" rx="2"/>`);
        const ly = v >= 0 ? top - 6 : Math.min(top + h + 15, M.t + ph - 6);
        if (spec.valueLabels !== false && bw >= 30) values.push(`<text class="xc-value" x="${(x + (bw - 3) / 2).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${esc(fv(v))}</text>`);
      });
      svg.push(`<text class="xc-tick" x="${(M.l + i * band + band / 2).toFixed(1)}" y="${M.t + ph + 18}" text-anchor="middle">${esc(c)}</text>`);
    });
    svg.push(...values);
    groups.forEach((g, k) => g.label && legend.push([g.label, tone(g.tone, k ? 'warm' : 'accent'), 'bar']));
  } else {
    if (ax.min == null || ax.max == null) throw new Error(`${where}: chart x.min and x.max are required`);
    const X = (v) => M.l + ((v - ax.min) / (ax.max - ax.min)) * pw;
    for (const t of ax.ticks ?? niceTicks(ax.min, ax.max)) {
      svg.push(`<line class="xc-grid xc-grid-v" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${M.t}" y2="${M.t + ph}"/>`);
      svg.push(`<text class="xc-tick" x="${X(t).toFixed(1)}" y="${M.t + ph + 18}" text-anchor="middle">${esc(fx(t))}</text>`);
    }
    const sample = (f, from, to, n) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n, y = f(x);
        pts.push([x, Number.isFinite(y) ? y : NaN]);
      }
      return pts;
    };
    const pathOf = (pts) => {
      let d = '', pen = false;
      for (const [x, y] of pts) {
        if (Number.isNaN(y)) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
        pen = true;
      }
      return d;
    };
    svg.push(`<clipPath id="${id}-clip"><rect x="${M.l}" y="${M.t - 1}" width="${pw}" height="${ph + 2}"/></clipPath>`);
    const plot = [];
    for (const a of spec.areas ?? []) {
      const from = a.from ?? ax.min, to = a.to ?? ax.max;
      const up = sample(compile(a.fn, params), from, to, a.samples ?? 160);
      const lo = sample(compile(a.fn2 ?? '0', params), from, to, a.samples ?? 160).reverse();
      plot.push(`<path class="xc-area ${tone(a.tone)}" d="${pathOf(up)}${pathOf(lo).replace(/^M/, 'L')}Z"/>`);
      if (a.label) legend.push([a.label, tone(a.tone), 'area']);
    }
    (spec.series ?? []).forEach((s, k) => {
      let pts;
      if (s.points) {
        pts = s.step ? s.points.flatMap((p, i) => (i ? [[p[0], s.points[i - 1][1]], p] : [p])) : s.points;
      } else {
        pts = sample(compile(s.fn, params), s.from ?? ax.min, s.to ?? ax.max, s.samples ?? 240);
      }
      const t = tone(s.tone, ['accent', 'warm', 'positive', 'muted'][k % 4]);
      plot.push(`<path class="xc-line ${t}${s.dash ? ' xc-dash' : ''}" d="${pathOf(pts)}"/>`);
      if (s.label) legend.push([s.label, t, s.dash ? 'dash' : 'line']);
    });
    svg.push(`<g clip-path="url(#${id}-clip)">${plot.join('')}</g>`);
    (spec.vlines ?? []).forEach((v, i) => {
      const x = X(v.x).toFixed(1);
      svg.push(`<line class="xc-ref ${tone(v.tone, 'warm')}${v.dash === false ? '' : ' xc-dash'}" x1="${x}" x2="${x}" y1="${M.t}" y2="${M.t + ph}"/>`);
      if (v.label) {
        const right = X(v.x) < M.l + pw * 0.7;
        svg.push(`<text class="xc-label ${tone(v.tone, 'warm')}" x="${(+x + (right ? 6 : -6)).toFixed(1)}" y="${M.t + 13 + 16 * (v.row ?? i)}" text-anchor="${right ? 'start' : 'end'}">${esc(v.label)}</text>`);
      }
    });
    for (const h of spec.hlines ?? []) {
      const y = Y(h.y).toFixed(1);
      svg.push(`<line class="xc-ref ${tone(h.tone, 'muted')}${h.dash === false ? '' : ' xc-dash'}" x1="${M.l}" x2="${M.l + pw}" y1="${y}" y2="${y}"/>`);
      if (h.label) svg.push(`<text class="xc-label ${tone(h.tone, 'muted')}" x="${M.l + pw - 4}" y="${(+y - 6).toFixed(1)}" text-anchor="end">${esc(h.label)}</text>`);
    }
    for (const p of spec.points ?? []) {
      const px = X(p.x), py = Y(p.y), t = tone(p.tone, 'ink');
      if (p.marker !== false) svg.push(`<circle class="xc-point ${t}" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5"/>`);
      if (p.label) {
        const pos = p.pos ?? 'right';
        const [dx, dy, anchor] = { right: [9, 4, 'start'], left: [-9, 4, 'end'], above: [0, -10, 'middle'], below: [0, 18, 'middle'] }[pos];
        svg.push(`<text class="xc-label ${t}" x="${(px + dx).toFixed(1)}" y="${(py + dy).toFixed(1)}" text-anchor="${anchor}">${esc(p.label)}</text>`);
      }
    }
  }

  svg.push(`<line class="xc-axis" x1="${M.l}" x2="${M.l + pw}" y1="${M.t + ph}" y2="${M.t + ph}"/>`);
  svg.push(`<line class="xc-axis" x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${M.t + ph}"/>`);
  if (ax.label) svg.push(`<text class="xc-axislabel" x="${M.l + pw / 2}" y="${H - 8}" text-anchor="middle">${esc(ax.label)}</text>`);
  if (ay.label) svg.push(`<text class="xc-axislabel" transform="translate(16 ${M.t + ph / 2}) rotate(-90)" text-anchor="middle">${esc(ay.label)}</text>`);
  return { svg: svg.join(''), legend };
}

export function renderChart(json, where) {
  const spec = JSON.parse(json);
  const id = `fig-${++figureCount}`;
  const W = spec.width ?? 600, H = spec.height ?? 320;
  const wide = draw(spec, where, `${id}w`, W, H);
  const narrow = draw(spec, where, `${id}n`, spec.narrowWidth ?? 400, Math.round(H * 1.05));
  const legend = wide.legend;
  const title = spec.title ? `<div class="ar-figtitle" id="${id}-t">${esc(spec.title)}</div>` : '';
  const leg = legend.length
    ? `<ul class="ar-legend">${legend.map(([l, t, k]) => `<li><span class="ar-swatch ar-swatch-${k} ${t}"></span>${esc(l)}</li>`).join('')}</ul>`
    : '';
  const label = esc(spec.alt ?? spec.title ?? 'Chart');
  const svgOf = (d, cls, w, h) => `<svg class="xc ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">${d.svg}</svg>`;
  return `<figure class="ar-figure ar-chart">${title}${svgOf(wide, 'xc-wide', W, H)}${svgOf(narrow, 'xc-narrow', spec.narrowWidth ?? 400, Math.round(H * 1.05))}${leg}${spec.caption ? `<figcaption>${spec.caption}</figcaption>` : ''}</figure>`;
}

export function renderCharts(html, file, errors) {
  return html.replace(/<x-chart>([\s\S]*?)<\/x-chart>/g, (_, json) => {
    try {
      return renderChart(json, file);
    } catch (e) {
      errors.push(`${file}: chart error: ${e.message}\n    spec: ${json.trim().slice(0, 160)}`);
      return '';
    }
  });
}
