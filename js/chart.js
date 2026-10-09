const NS = 'http://www.w3.org/2000/svg';
const PAD_TOP = 18;
const PAD_BOTTOM = 26;
const DOT = 4;
const LABEL_GAP = 16;
const TICK_FONT = '500 11px';
const TIP_GAP = 12;
const cleanups = new WeakMap();

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

function niceStep(range, count, integer) {
  const raw = range / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) * mag;
  return integer ? Math.max(1, Math.round(step)) : step;
}

export function niceTicks(min, max, { count = 3, integer = false } = {}) {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = integer ? Math.max(1, Math.ceil(Math.abs(lo) * 0.1)) : Math.max(1, Math.abs(lo) * 0.1);
    lo -= pad;
    hi += pad;
  }
  if (min >= 0) lo = Math.max(0, lo);
  const step = niceStep(hi - lo, count, integer);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function lineChart(figure, { rows, series, domain, formatValue, formatTick = formatValue, formatDate, formatAxisDate = formatDate, label, height = 200, endLabels = false, integer = false }) {
  cleanups.get(figure)?.();
  const box = document.createElement('div');
  box.className = 'chart';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', label);
  if (rows.length) box.tabIndex = 0;
  figure.replaceChildren(box);
  const tip = document.createElement('div');
  tip.className = 'chart__tip';
  tip.hidden = true;
  const values = rows.flatMap((r) => series.map((s) => r[s.key]));
  const ticks = niceTicks(Math.min(...values), Math.max(...values), { integer });
  const yMin = ticks[0];
  const yMax = ticks.at(-1);
  let active = -1;
  let geometry = null;

  const tickLabels = ticks.map((tick) => formatTick(tick));
  const measure = document.createElement('canvas').getContext('2d');

  const draw = () => {
    const width = Math.max(240, box.clientWidth);
    const labelSpace = endLabels ? 96 : 0;
    measure.font = `${TICK_FONT} ${getComputedStyle(box).fontFamily}`;
    const left = Math.ceil(Math.max(...tickLabels.map((t) => measure.measureText(t).width))) + 10;
    const right = width - DOT - 2 - labelSpace;
    const top = PAD_TOP;
    const bottom = height - PAD_BOTTOM;
    const [t0, t1] = domain;
    const x = (t) => (t1 === t0 ? (left + right) / 2 : left + ((t - t0) / (t1 - t0)) * (right - left));
    const y = (v) => (yMax === yMin ? (top + bottom) / 2 : bottom - ((v - yMin) / (yMax - yMin)) * (bottom - top));
    geometry = { x, y, top, bottom, width };

    const root = svg('svg', { class: 'chart__svg', viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true' });
    const grid = svg('g', { class: 'chart__grid' });
    ticks.forEach((tick, i) => {
      const ty = y(tick);
      grid.append(svg('line', { x1: left, x2: width, y1: ty, y2: ty }));
      const text = svg('text', { x: left - 8, y: ty + 4, 'text-anchor': 'end', class: 'chart__tick' });
      text.textContent = tickLabels[i];
      grid.append(text);
    });
    root.append(grid);

    const axis = svg('g', { class: 'chart__axis' });
    const dates = t1 === t0 ? [[t0, 'middle']] : [[t0, 'start'], [t1, 'end']];
    if (t1 !== t0 && width >= 480) dates.splice(1, 0, [(t0 + t1) / 2, 'middle']);
    for (const [t, anchor] of dates) {
      const text = svg('text', { x: t1 === t0 ? (left + right) / 2 : x(t), y: height - 6, 'text-anchor': anchor, class: 'chart__tick' });
      text.textContent = formatAxisDate(t);
      axis.append(text);
    }
    root.append(axis);

    const ends = [];
    series.forEach((s, i) => {
      const pts = rows.map((r) => [x(r.t), y(r[s.key])]);
      const line = pts.map(([px, py], j) => `${j ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');
      const group = svg('g', { class: `chart__series chart__series--${i + 1}` });
      if (pts.length > 1) {
        if (series.length === 1) group.append(svg('path', { class: 'chart__area', d: `${line}L${pts.at(-1)[0].toFixed(1)} ${bottom}L${pts[0][0].toFixed(1)} ${bottom}Z` }));
        group.append(svg('path', { class: 'chart__line', d: line }));
      }
      const [ex, ey] = pts.at(-1);
      group.append(svg('circle', { class: 'chart__dot', cx: ex, cy: ey, r: DOT }));
      root.append(group);
      ends.push({ s, ex, ey, value: rows.at(-1)[s.key] });
    });

    const apart = ends.every((a, i) => ends.every((b, j) => i === j || Math.abs(a.ey - b.ey) >= LABEL_GAP));
    if (endLabels && apart) {
      for (const end of ends) {
        const text = svg('text', { x: end.ex + DOT + 8, y: end.ey + 4, class: 'chart__end' });
        const value = svg('tspan', { class: 'chart__end-value' });
        value.textContent = formatValue(end.value);
        text.append(value, ` ${end.s.name}`);
        root.append(text);
      }
    }

    const cross = svg('g', { class: 'chart__cross', visibility: 'hidden' });
    cross.append(svg('line', { y1: top - 6, y2: bottom }));
    series.forEach((s, i) => cross.append(svg('circle', { class: `chart__cross-dot chart__series--${i + 1}`, r: DOT })));
    root.append(cross);

    const hit = svg('rect', { class: 'chart__hit', x: 0, y: 0, width, height });
    root.append(hit);
    box.replaceChildren(root, tip);
    geometry.cross = cross;
    if (active >= 0) show(active);
  };

  const nearest = (px) => {
    let best = 0;
    rows.forEach((r, i) => {
      if (Math.abs(geometry.x(r.t) - px) < Math.abs(geometry.x(rows[best].t) - px)) best = i;
    });
    return best;
  };

  function show(i) {
    active = i;
    const row = rows[i];
    const cx = geometry.x(row.t);
    const { cross } = geometry;
    cross.setAttribute('visibility', 'visible');
    const line = cross.querySelector('line');
    line.setAttribute('x1', cx);
    line.setAttribute('x2', cx);
    cross.querySelectorAll('circle').forEach((dot, j) => {
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', geometry.y(row[series[j].key]));
    });
    const date = document.createElement('span');
    date.className = 'chart__tip-date';
    date.textContent = formatDate(row.t);
    tip.replaceChildren(date, ...series.map((s, j) => {
      const item = document.createElement('span');
      item.className = 'chart__tip-row';
      const key = document.createElement('i');
      key.className = `chart__key chart__series--${j + 1}`;
      const value = document.createElement('b');
      value.textContent = formatValue(row[s.key]);
      item.append(key, value);
      if (series.length > 1) item.append(` ${s.name}`);
      return item;
    }));
    tip.hidden = false;
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const ys = series.map((s) => geometry.y(row[s.key]));
    const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
    const side = cx + TIP_GAP + tipWidth <= geometry.width ? cx + TIP_GAP : cx - TIP_GAP - tipWidth;
    tip.style.left = `${Math.max(0, side)}px`;
    tip.style.top = `${Math.min(Math.max(0, middle - tipHeight / 2), height - tipHeight)}px`;
  }

  function hide() {
    active = -1;
    tip.hidden = true;
    geometry?.cross.setAttribute('visibility', 'hidden');
  }

  if (rows.length) {
    box.addEventListener('pointermove', (e) => show(nearest(e.clientX - box.getBoundingClientRect().left)));
    box.addEventListener('pointerleave', hide);
    box.addEventListener('blur', hide);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        show(Math.min(rows.length - 1, Math.max(0, (active < 0 ? rows.length : active) + step)));
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        show(e.key === 'Home' ? 0 : rows.length - 1);
      } else if (e.key === 'Escape') {
        hide();
      }
    });
  }

  draw();
  let lastWidth = box.clientWidth;
  const observer = new ResizeObserver(() => {
    if (box.clientWidth === lastWidth) return;
    lastWidth = box.clientWidth;
    draw();
  });
  observer.observe(box);
  cleanups.set(figure, () => observer.disconnect());
}
