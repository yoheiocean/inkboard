/* Inkboard — a self-hosted infinite-canvas sketching app. No dependencies. */
'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------------------------------------------------------------- constants
  const PAPERS = [
    { id: 'warm', name: 'Warm paper', bg: '#f6f3ec', grid: 'rgba(70,58,35,0.20)' },
    { id: 'white', name: 'White', bg: '#ffffff', grid: 'rgba(0,0,0,0.14)' },
    { id: 'blueprint', name: 'Blueprint', bg: '#16395c', grid: 'rgba(255,255,255,0.22)' },
    { id: 'slate', name: 'Slate', bg: '#1e2127', grid: 'rgba(255,255,255,0.14)' },
  ];
  const GRIDS = ['none', 'dots', 'lines', 'iso'];
  const GRID_NAMES = { none: 'off', dots: 'dots', lines: 'lines', iso: 'isometric' };
  const SWATCHES = ['#1f2430', '#6b7180', '#ffffff', '#d6453d', '#ef8a2b', '#f2c230',
    '#4caf6a', '#2f9e9a', '#2f6fd6', '#7a4fd1', '#d64f9a', '#8a5a3b'];
  const BRUSHES = {
    pen: { alpha: 1, multiply: false },
    pencil: { alpha: 0.82, multiply: false },
    marker: { alpha: 0.55, multiply: true },
  };
  const DRAW_TOOLS = ['pen', 'pencil', 'marker'];
  const COLOR_TOOLS = ['pen', 'pencil', 'marker', 'shape', 'fill']; // each remembers its own colour (prefs.colors)
  const MIN_SCALE = 0.05, MAX_SCALE = 40;
  const HISTORY_LIMIT = 150;
  const EXPORT_PAD = 24;
  const MAX_SAVED_COLORS = 24;
  const PDF_MAX_PAGES = 30;    // per import; each page becomes an embedded image

  const ICONS = {
    menu: 'M4 7h16M4 12h16M4 17h16',
    undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    minus: 'M5 12h14',
    plus: 'M12 5v14M5 12h14',
    fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    grid: 'M4 4h16v16H4zM9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16',
    paper: 'M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-1.8 0-1.2-1-1.5-1-2.6 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
    stylus: 'M14.5 4.5l5 5L9 20H4v-5zM12.5 6.5l5 5',
    layers: 'M12 3 2.5 8 12 13l9.5-5zM2.5 12 12 17l9.5-5M2.5 16 12 21l9.5-5',
    pen: 'M15.5 4.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4zM13.5 6.5l3 3',
    pencil: 'M4 20l1.2-4.6L15.8 4.8a1.8 1.8 0 0 1 2.5 0l.9.9a1.8 1.8 0 0 1 0 2.5L8.6 18.8zM14 6.5l3.5 3.5M5.2 15.4l3.4 3.4',
    marker: 'M14.5 3.5l6 6-9 9H5.5v-6zM4 21h16',
    eraser: 'M7 20h13M5.6 15.6 14.8 6.4a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8L12 19.6H9.6zM10 11l5 5',
    shape: 'M3.5 11.5h9v9h-9zM16.5 3a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z',
    select: 'M5 3l5.5 16 2.3-6.7L19.5 10z',
    hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.4-3.8a1.5 1.5 0 0 1 2.5-1.7L8 13',
    line: 'M5 19 19 5',
    rect: 'M4 6h16v12H4z',
    ellipse: 'M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    dup: 'M8 8h12v12H8zM16 8V4H4v12h4',
    front: 'M12 19V5M6 11l6-6 6 6',
    back: 'M12 5v14M6 13l6 6 6-6',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
    eyeOff: 'M3 3l18 18M10.6 5.6A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    fill: 'M6.5 7.5C9 4 16 3.5 18.5 7s.5 9.5-4.5 11.5S4 18.5 4 14.5c0-2.5 1-4.5 2.5-7zM8 12l4.5-4.5M7 16l8-8M10.5 17.5l6-6',
    lasso: 'M12 4.5c4.7 0 8.5 2.3 8.5 5.25S16.7 15 12 15s-8.5-2.35-8.5-5.25S7.3 4.5 12 4.5zM5.5 13c-1.2 1.8-.6 4 1.6 4.2 2 .2 2.1 2 1.2 3.3',
    marquee: 'M4 8V4h4M10.5 4h3M16 4h4v4M20 10.5v3M20 16v4h-4M13.5 20h-3M8 20H4v-4M4 13.5v-3',
    copy: 'M9 3.5h6v3H9zM8 5H5.5v15.5h13V5H16',
    cut: 'M6.5 9.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM6.5 20a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM8.6 8.4 19.5 18M8.6 15.6 19.5 6',
    paste: 'M9 3.5h6v3H9zM8 5H5.5v15.5h13V5H16M12 9.5v7M9 13.5l3 3 3-3',
    library: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    folder: 'M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
    more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    whole: 'M7 7h10v10H7zM3.5 3.5h2v2h-2zM18.5 3.5h2v2h-2zM3.5 18.5h2v2h-2zM18.5 18.5h2v2h-2z',
    insert: 'M13 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-6.5M4.5 16l4.5-4.5 3.5 3.5 2-2 5 5M18 3v6M15 6h6',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;

  // ---------------------------------------------------------------- helpers
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fx = (n) => String(Math.round(n * 100) / 100);
  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isHex = (c) => typeof c === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c);
  // Even-odd ray cast; poly is [[x, y], ...] (extra entries per point are ignored).
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const union = (a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
  const intersects = (a, b) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
  function ptsBBox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0];
      if (p[1] > y1) y1 = p[1];
    }
    return { x0, y0, x1, y1 };
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  const stamp = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };

  // ---------------------------------------------------------------- DOM
  const canvas = $('#board');
  const ctx = canvas.getContext('2d');
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');
  let dpr = 1, W = 0, H = 0;

  // ---------------------------------------------------------------- prefs
  const prefs = loadPrefs();
  function loadPrefs() {
    const d = {
      tool: 'pen', lastBrush: 'pen', color: '#1f2430',
      sizes: { pen: 4, pencil: 4, marker: 18, eraser: 28 },
      opacity: { pen: 100, pencil: 100, marker: 100, fill: 100 },
      straight: { pen: 0, pencil: 0, marker: 0 },
      shape: 'line', selectMode: 'lasso', selectCut: 'partial', eraseMode: 'partial', grid: 'dots', pencilOnly: false,
      savedColors: [],
    };
    d.colors = Object.fromEntries(COLOR_TOOLS.map((t) => [t, d.color]));
    try {
      const s = JSON.parse(localStorage.getItem('inkboard.prefs') || 'null');
      if (s && typeof s === 'object') {
        // Prefs saved before per-tool colours start every tool on the old shared colour.
        const base = isHex(s.color) ? s.color : d.color;
        const sc = s.colors && typeof s.colors === 'object' ? s.colors : {};
        return {
          ...d, ...s,
          color: base,
          colors: Object.fromEntries(COLOR_TOOLS.map((t) => [t, isHex(sc[t]) ? sc[t] : base])),
          sizes: { ...d.sizes, ...(s.sizes || {}) },
          opacity: { ...d.opacity, ...(s.opacity || {}) },
          straight: { ...d.straight, ...(s.straight || {}) },
          savedColors: (Array.isArray(s.savedColors) ? s.savedColors : []).filter(isHex).slice(0, MAX_SAVED_COLORS),
        };
      }
    } catch (_) { /* storage unavailable */ }
    return d;
  }
  function savePrefs() { try { localStorage.setItem('inkboard.prefs', JSON.stringify(prefs)); } catch (_) { /* ignore */ } }

  // ---------------------------------------------------------------- document state
  let doc = null;
  let view = { x: 0, y: 0, scale: 1 };
  let selection = new Set();
  const history = { past: [], future: [] };
  let gesture = null;          // active pointer interaction
  let liveItem = null;         // stroke/shape being drawn
  let preview = null;          // selection transform preview {dx,dy,s,ox,oy}
  const hiddenIds = new Set(); // items being erased
  let hover = null;            // last pointer position (screen) for cursors
  const pointers = new Map();
  let tap = null;              // multi-finger tap tracking
  let spaceDown = false;
  let penSeen = false;
  let pendingLayerSnap = null;

  function newLayer(name) { return { id: uid(), name, visible: true, opacity: 1, items: [] }; }
  function newDoc() { const l = newLayer('Layer 1'); return { version: 1, paper: 'warm', layers: [l], active: l.id }; }
  const paper = () => PAPERS.find((p) => p.id === doc.paper) || PAPERS[0];
  const activeLayer = () => doc.layers.find((l) => l.id === doc.active) || doc.layers[doc.layers.length - 1];
  const hasContent = () => doc.layers.some((l) => l.items.length);

  // ---------------------------------------------------------------- stroke geometry
  // A stroke is drawn as the union of a disc at every sample point plus a quad
  // between neighbours, all in one nonzero-filled path. This gives clean,
  // pressure-varying strokes with uniform opacity and an exact SVG twin.
  function radiusAt(it, i, n) {
    const p = it.points[i][2];
    if (it.brush === 'marker') return it.size * 0.8;
    if (it.brush === 'pencil') return it.size * 0.3 * (0.55 + 0.9 * p);
    // Pieces left by a cut keep full width at the cut end (noTaperStart / noTaperEnd).
    const taper = it.noTaper ? 1 : Math.min(1, it.noTaperStart ? 1 : (i + 1) / 5, it.noTaperEnd ? 1 : (n - i) / 5);
    return it.size * 0.5 * (0.3 + 1.4 * p) * (0.45 + 0.55 * taper);
  }
  const geomCache = new WeakMap();
  function strokeGeom(it) {
    let g = geomCache.get(it);
    if (g) return g;
    const P = it.points, n = P.length, rs = new Array(n);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const r = Math.max(0.25, radiusAt(it, i, n));
      rs[i] = r;
      const x = P[i][0], y = P[i][1];
      if (x - r < x0) x0 = x - r;
      if (y - r < y0) y0 = y - r;
      if (x + r > x1) x1 = x + r;
      if (y + r > y1) y1 = y + r;
      parts.push(`M${fx(x - r)} ${fx(y)}a${fx(r)} ${fx(r)} 0 1 1 ${fx(2 * r)} 0a${fx(r)} ${fx(r)} 0 1 1 ${fx(-2 * r)} 0Z`);
      if (i > 0) {
        const ax = P[i - 1][0], ay = P[i - 1][1], ra = rs[i - 1];
        const dx = x - ax, dy = y - ay, L = Math.hypot(dx, dy);
        if (L > 1e-4) {
          const nx = -dy / L, ny = dx / L;
          parts.push(`M${fx(ax - nx * ra)} ${fx(ay - ny * ra)}L${fx(x - nx * r)} ${fx(y - ny * r)}L${fx(x + nx * r)} ${fx(y + ny * r)}L${fx(ax + nx * ra)} ${fx(ay + ny * ra)}Z`);
        }
      }
    }
    const d = parts.join('');
    g = { d, path: new Path2D(d), bbox: { x0, y0, x1, y1 }, rs };
    geomCache.set(it, g);
    return g;
  }
  // A fill is a closed outline, smoothed with quadratic curves through the
  // midpoints of its samples (each sample is a control point).
  function fillGeom(it) {
    let g = geomCache.get(it);
    if (g) return g;
    const P = it.points, n = P.length;
    const mid = (i) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const m0 = mid(n - 1);
    const parts = [`M${fx(m0[0])} ${fx(m0[1])}`];
    for (let i = 0; i < n; i++) {
      const m = mid(i);
      parts.push(`Q${fx(P[i][0])} ${fx(P[i][1])} ${fx(m[0])} ${fx(m[1])}`);
    }
    parts.push('Z');
    const d = parts.join('');
    g = { d, path: new Path2D(d), bbox: ptsBBox(P) };
    geomCache.set(it, g);
    return g;
  }
  function baseBBox(it) {
    if (it.type === 'image') return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
    if (it.type === 'fill') return fillGeom(it).bbox;
    return strokeGeom(it).bbox;
  }
  // Images and fills can carry `clip`: [{ out, pts }] world-space polygons (even-odd). Each
  // one keeps only what's inside it (out: false) or outside it (out: true); a lasso cut
  // through an image or fill makes two items sharing the same content with opposite clips.
  const bboxCache = new WeakMap();
  function itemBBox(it) {
    if (!it.clip) return baseBBox(it);
    let b = bboxCache.get(it);
    if (b) return b;
    b = { ...baseBBox(it) };
    for (const c of it.clip) {
      if (c.out) continue;
      const cb = ptsBBox(c.pts);
      b = { x0: Math.max(b.x0, cb.x0), y0: Math.max(b.y0, cb.y0), x1: Math.min(b.x1, cb.x1), y1: Math.min(b.y1, cb.y1) };
    }
    if (b.x1 < b.x0 || b.y1 < b.y0) b = { x0: b.x0, y0: b.y0, x1: b.x0, y1: b.y0 };
    else if (it.clip.some((c) => c.out)) b = sampledBBox(it, b);
    bboxCache.set(it, b);
    return b;
  }
  // Holes (out clips) can't be intersected as boxes; shrink to the visible area by sampling.
  function sampledBBox(it, b) {
    const N = 48, cw = (b.x1 - b.x0) / N, ch = (b.y1 - b.y0) / N;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        const x = b.x0 + (gx + 0.5) * cw, y = b.y0 + (gy + 0.5) * ch;
        if (!visibleAt(it, x, y)) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    if (x0 > x1) return b;
    return { x0: Math.max(b.x0, x0 - cw), y0: Math.max(b.y0, y0 - ch), x1: Math.min(b.x1, x1 + cw), y1: Math.min(b.y1, y1 + ch) };
  }
  const clipsPass = (it, x, y) => !it.clip || it.clip.every((c) => pointInPoly(x, y, c.pts) !== c.out);
  // Is world point (x, y) on the visible part of an image or fill?
  function visibleAt(it, x, y) {
    if (it.type === 'image') { if (x < it.x || x > it.x + it.w || y < it.y || y > it.y + it.h) return false; } else if (!pointInPoly(x, y, it.points)) return false;
    return clipsPass(it, x, y);
  }
  const clipPathCache = new WeakMap();
  function clipPath(c) {
    let p = clipPathCache.get(c);
    if (p) return p;
    p = new Path2D();
    if (c.out) p.rect(-1e7, -1e7, 2e7, 2e7);
    c.pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    clipPathCache.set(c, p);
    return p;
  }
  function linePts(a, b, p, size) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / Math.max(size * 0.3, 0.5)));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, p]);
    }
    return out;
  }
  // ---- cutting strokes (partial eraser, cut-through selection)
  // Parameter t along p→q where it crosses segment c→d, or -1.
  function segHit(px, py, qx, qy, cx, cy, dx, dy) {
    const rx = qx - px, ry = qy - py, sx = dx - cx, sy = dy - cy;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return -1;
    const t = ((cx - px) * sy - (cy - py) * sx) / den;
    const u = ((cx - px) * ry - (cy - py) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
  }
  function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
    if (segHit(ax, ay, bx, by, cx, cy, dx, dy) >= 0) return 0;
    return Math.min(distSeg(ax, ay, cx, cy, dx, dy), distSeg(bx, by, cx, cy, dx, dy), distSeg(cx, cy, ax, ay, bx, by), distSeg(dx, dy, ax, ay, bx, by));
  }
  // Insert the points where each segment i crosses a boundary (`cuts(i)` → sorted t's), then
  // group the pieces between them into runs, classified by `inside(x, y, radius)` at their
  // midpoints. Returns [{ pts, inside, cutStart, cutEnd }].
  function splitRuns(it, cuts, inside) {
    const P = it.points, rs = strokeGeom(it).rs, n = P.length;
    if (n === 1) return [{ pts: P, inside: inside(P[0][0], P[0][1], rs[0]), cutStart: false, cutEnd: false }];
    const Q = [P[0]], R = [rs[0]];
    for (let i = 0; i < n - 1; i++) {
      const a = P[i], b = P[i + 1];
      for (const t of cuts(i)) {
        Q.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        R.push(rs[i] + (rs[i + 1] - rs[i]) * t);
      }
      Q.push(b);
      R.push(rs[i + 1]);
    }
    const runs = [];
    let cur = null;
    for (let j = 0; j < Q.length - 1; j++) {
      const a = Q[j], b = Q[j + 1];
      const inn = inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (R[j] + R[j + 1]) / 2);
      if (cur && cur.inside === inn) { cur.pts.push(b); continue; }
      if (cur) { cur.cutEnd = true; runs.push(cur); }
      cur = { pts: [a, b], inside: inn, cutStart: j > 0, cutEnd: false };
    }
    runs.push(cur);
    return runs;
  }
  const strokePiece = (it, run) => ({
    ...it, id: uid(), points: run.pts,
    noTaperStart: run.cutStart || !!it.noTaperStart, noTaperEnd: run.cutEnd || !!it.noTaperEnd,
  });
  // Erase the parts of a stroke within R of eraser segment a→b. The stroke's own radius is
  // added so the visible ink stops at the eraser's edge. Returns the remaining pieces, or
  // null when the stroke isn't touched.
  function eraseStroke(it, a, b, R) {
    const P = it.points, rs = strokeGeom(it).rs;
    const inside = (x, y, r) => distSeg(x, y, a.x, a.y, b.x, b.y) <= R + r;
    const cuts = (i) => {
      const p = P[i], q = P[i + 1];
      if (segSegDist(p[0], p[1], q[0], q[1], a.x, a.y, b.x, b.y) > R + Math.max(rs[i], rs[i + 1])) return [];
      const f = (t) => inside(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, rs[i] + (rs[i + 1] - rs[i]) * t);
      const k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / Math.max(R * 0.25, 1e-3)));
      const out = [];
      let prev = f(0);
      for (let j = 1; j <= k; j++) {
        const v = f(j / k);
        if (v !== prev) {
          let lo = (j - 1) / k, hi = j / k;
          for (let s = 0; s < 14; s++) { const m = (lo + hi) / 2; if (f(m) === prev) lo = m; else hi = m; }
          out.push((lo + hi) / 2);
        }
        prev = v;
      }
      return out;
    };
    const runs = splitRuns(it, cuts, inside);
    if (runs.length === 1 && !runs[0].inside) return null;
    return runs.filter((r) => !r.inside && r.pts.length > 1).map((r) => strokePiece(it, r));
  }
  // Split a stroke along a selection polygon (exact segment crossings).
  function cutStrokeByPoly(it, poly, pb) {
    const P = it.points;
    const cuts = (i) => {
      const p = P[i], q = P[i + 1];
      if (Math.max(p[0], q[0]) < pb.x0 || Math.min(p[0], q[0]) > pb.x1 || Math.max(p[1], q[1]) < pb.y0 || Math.min(p[1], q[1]) > pb.y1) return [];
      const ts = [];
      for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
        const t = segHit(p[0], p[1], q[0], q[1], poly[k][0], poly[k][1], poly[j][0], poly[j][1]);
        if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
      }
      return ts.sort((x, y) => x - y);
    };
    return splitRuns(it, cuts, (x, y) => pointInPoly(x, y, poly));
  }
  // How much of an image's or fill's visible area a polygon covers, by sampling a grid.
  function coverage(it, poly) {
    const b = itemBBox(it), N = 16;
    let inn = 0, out = 0;
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        const x = b.x0 + ((gx + 0.5) / N) * (b.x1 - b.x0), y = b.y0 + ((gy + 0.5) / N) * (b.y1 - b.y0);
        if (!visibleAt(it, x, y)) continue;
        if (pointInPoly(x, y, poly)) inn++; else out++;
        if (inn && out) return 'some';
      }
    }
    return inn ? 'all' : 'none';
  }

  // Pull every sample toward the start→end chord by `s` (0 = freehand, 1 = ruler-straight).
  function straighten(pts, s, size) {
    const n = pts.length;
    if (s <= 0 || n < 3) return pts;
    const a = pts[0], b = pts[n - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return pts;
    if (s >= 1) return linePts(a, b, pts.reduce((sum, p) => sum + p[2], 0) / n, size);
    return pts.map((p) => {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
      const qx = a[0] + dx * t, qy = a[1] + dy * t;
      return [p[0] + (qx - p[0]) * s, p[1] + (qy - p[1]) * s, p[2]];
    });
  }

  // ---------------------------------------------------------------- images
  // An image item carries either `src` (a data URL: local mode, legacy files, not-yet-uploaded
  // imports) or `asset` ("<recordId>/<filename>" on the server). All loading goes through here.
  const imageCache = new Map();
  const imgKey = (it) => (it.asset ? `asset:${it.asset}` : it.src);
  function getImage(key) {
    let img = imageCache.get(key);
    if (!img) {
      img = new Image();
      img.onload = () => { img._ok = true; requestRender(); };
      img.onerror = () => { img._err = true; };
      imageCache.set(key, img);
      if (key.startsWith('asset:')) loadAsset(img, key.slice(6)); else img.src = key;
    }
    return img;
  }
  async function loadAsset(img, ref) {
    try {
      const [rid, file] = ref.split('/');
      img._blob = await InkAPI.fetchFile('assets', rid, file);
      img.src = URL.createObjectURL(img._blob);
    } catch (err) {
      console.warn('Image unavailable', ref, err);
      img._err = true;
      img.dispatchEvent(new Event('error'));
    }
  }
  // Forget failed server images so they're fetched again (e.g. after coming back online).
  function retryFailedImages() {
    for (const [k, img] of imageCache) if (img._err && k.startsWith('asset:')) imageCache.delete(k);
    requestRender();
  }
  function preloadImages() { for (const l of doc.layers) for (const it of l.items) if (it.type === 'image') getImage(imgKey(it)); }
  function ensureImagesLoaded() {
    const waits = [];
    for (const l of doc.layers) for (const it of l.items) {
      if (it.type !== 'image') continue;
      const img = getImage(imgKey(it));
      if (!img._ok && !img._err) {
        waits.push(new Promise((res) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        }));
      }
    }
    return Promise.all(waits);
  }

  // ---------------------------------------------------------------- drawing
  function drawItem(c, it) {
    if (it.clip) {
      c.save();
      for (const cl of it.clip) c.clip(clipPath(cl), 'evenodd');
      drawContent(c, it);
      c.restore();
    } else drawContent(c, it);
  }
  function drawContent(c, it) {
    if (it.type === 'stroke') {
      const b = BRUSHES[it.brush] || BRUSHES.pen;
      c.globalAlpha = it.opacity * b.alpha;
      c.globalCompositeOperation = b.multiply ? 'multiply' : 'source-over';
      c.fillStyle = it.color;
      c.fill(strokeGeom(it).path);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    } else if (it.type === 'fill') {
      c.globalAlpha = it.opacity;
      c.fillStyle = it.color;
      c.fill(fillGeom(it).path);
      c.globalAlpha = 1;
    } else if (it.type === 'image') {
      const img = getImage(imgKey(it));
      if (img._ok) c.drawImage(img, it.x, it.y, it.w, it.h);
      else if (showPlaceholders) { c.fillStyle = 'rgba(128,128,128,0.14)'; c.fillRect(it.x, it.y, it.w, it.h); }
    }
  }
  let showPlaceholders = false; // grey boxes for images still loading, on screen only
  function applyPreview(c) {
    c.translate(preview.ox + preview.dx, preview.oy + preview.dy);
    c.scale(preview.s, preview.s);
    c.translate(-preview.ox, -preview.oy);
  }

  // Draw the whole scene to a target canvas. T maps world -> target pixels.
  function drawScene(target, tctx, T, opts) {
    const { bg, live, cull, grid } = opts;
    showPlaceholders = live;
    const w = target.width, h = target.height;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalAlpha = 1;
    if (bg) { tctx.fillStyle = paper().bg; tctx.fillRect(0, 0, w, h); } else tctx.clearRect(0, 0, w, h);
    if (grid) drawGrid(tctx, T, cull);
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      const isActive = layer.id === doc.active;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, w, h);
      sctx.setTransform(T.a, 0, 0, T.a, T.e, T.f);
      let drew = false;
      // A partial erase in progress keeps its edited copy of the layer on the gesture.
      const items = live && isActive && gesture && gesture.items ? gesture.items : layer.items;
      for (const it of items) {
        if (live && hiddenIds.has(it.id)) continue;
        const moving = live && preview && isActive && selection.has(it.id);
        if (cull && !moving && !intersects(itemBBox(it), cull)) continue;
        if (moving) { sctx.save(); applyPreview(sctx); drawItem(sctx, it); sctx.restore(); } else drawItem(sctx, it);
        drew = true;
      }
      if (live && liveItem && isActive) { drawItem(sctx, liveItem); drew = true; }
      if (!drew) continue;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.globalAlpha = layer.opacity;
      tctx.drawImage(scratch, 0, 0);
      tctx.globalAlpha = 1;
    }
  }

  function drawGrid(c, T, vb) {
    const mode = prefs.grid;
    if (mode === 'none' || !vb) return;
    const s = T.a / dpr;
    let sp = 32;
    while (sp * s < 14) sp *= 2;
    while (sp * s > 112) sp /= 2;
    c.save();
    c.setTransform(T.a, 0, 0, T.a, T.e, T.f);
    const col = paper().grid;
    if (mode === 'dots') {
      c.fillStyle = col;
      const r = 1.25 / s;
      c.beginPath();
      for (let x = Math.floor(vb.x0 / sp) * sp; x <= vb.x1; x += sp) {
        for (let y = Math.floor(vb.y0 / sp) * sp; y <= vb.y1; y += sp) c.rect(x - r, y - r, r * 2, r * 2);
      }
      c.fill();
    } else {
      c.strokeStyle = col;
      c.lineWidth = 1 / s;
      c.beginPath();
      if (mode === 'lines') { lineFamily(c, vb, 0, sp); lineFamily(c, vb, 90, sp); } else {
        const a = sp * 0.8660254;
        lineFamily(c, vb, 90, a); lineFamily(c, vb, 30, a); lineFamily(c, vb, 150, a);
      }
      c.stroke();
    }
    c.restore();
  }
  function lineFamily(c, vb, deg, sp) {
    const t = (deg * Math.PI) / 180, dx = Math.cos(t), dy = Math.sin(t), nx = -dy, ny = dx;
    let nmin = Infinity, nmax = -Infinity, dmin = Infinity, dmax = -Infinity;
    for (const [x, y] of [[vb.x0, vb.y0], [vb.x1, vb.y0], [vb.x0, vb.y1], [vb.x1, vb.y1]]) {
      const pn = x * nx + y * ny, pd = x * dx + y * dy;
      nmin = Math.min(nmin, pn); nmax = Math.max(nmax, pn);
      dmin = Math.min(dmin, pd); dmax = Math.max(dmax, pd);
    }
    for (let k = Math.floor(nmin / sp); k <= Math.ceil(nmax / sp); k++) {
      const ox = nx * k * sp, oy = ny * k * sp;
      c.moveTo(ox + dx * dmin, oy + dy * dmin);
      c.lineTo(ox + dx * dmax, oy + dy * dmax);
    }
  }

  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  }
  function viewBox() {
    return { x0: -view.x / view.scale, y0: -view.y / view.scale, x1: (W - view.x) / view.scale, y1: (H - view.y) / view.scale };
  }
  function render() {
    renderQueued = false;
    if (!doc) return;
    if (gesture && gesture.dirty) {
      if (gesture.kind === 'draw') liveItem = buildLive(gesture);
      else if (gesture.kind === 'shape') liveItem = shapeItem(gesture);
      else if (gesture.kind === 'fill') liveItem = gesture.pts.length >= 3 ? fillItem(gesture) : null;
      gesture.dirty = false;
    }
    const T = { a: view.scale * dpr, e: view.x * dpr, f: view.y * dpr };
    drawScene(canvas, ctx, T, { bg: true, live: true, cull: viewBox(), grid: true });
    drawOverlay();
    updateSelBar();
  }

  function drawOverlay() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = paper().id === 'blueprint' || paper().id === 'slate';
    const accent = dark ? '#7fd3cb' : '#2f6f6a';
    if (gesture && gesture.kind === 'marquee') {
      const a = toScreen(gesture.a.x, gesture.a.y), b = toScreen(gesture.b.x, gesture.b.y);
      ctx.fillStyle = 'rgba(47,111,106,0.08)';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(Math.min(a.x, b.x) + 0.5, Math.min(a.y, b.y) + 0.5, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
    }
    if (gesture && gesture.kind === 'lasso' && gesture.pts.length > 1) {
      ctx.beginPath();
      gesture.pts.forEach(([x, y], i) => { const s = toScreen(x, y); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      ctx.closePath();
      ctx.fillStyle = 'rgba(47,111,106,0.08)';
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const sb = selBBoxScreen();
    if (sb) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(sb.x0, sb.y0, sb.x1 - sb.x0, sb.y1 - sb.y0);
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sb.x1, sb.y1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (prefs.tool === 'eraser' && hover && !spaceDown) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(31,36,48,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, prefs.sizes.eraser / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- coordinates
  const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale });
  const toScreen = (wx, wy) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y });
  function zoomAt(sx, sy, factor) {
    const s = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
    const w = toWorld(sx, sy);
    view.scale = s;
    view.x = sx - w.x * s;
    view.y = sy - w.y * s;
    viewChanged();
  }
  function zoomTo(s) { zoomAt(W / 2, H / 2, s / view.scale); }
  function contentBounds() {
    let b = null;
    for (const l of doc.layers) {
      if (!l.visible) continue;
      for (const it of l.items) { const bb = itemBBox(it); b = b ? union(b, bb) : { ...bb }; }
    }
    return b;
  }
  function fitContent() {
    const b = contentBounds();
    if (!b) { view = { x: W / 2, y: H / 2, scale: 1 }; } else {
      const m = 90;
      const s = clamp(Math.min((W - m * 2) / Math.max(1, b.x1 - b.x0), (H - m * 2) / Math.max(1, b.y1 - b.y0)), MIN_SCALE, 4);
      view.scale = s;
      view.x = W / 2 - ((b.x0 + b.x1) / 2) * s;
      view.y = H / 2 - ((b.y0 + b.y1) / 2) * s;
    }
    viewChanged();
  }
  let viewSaveTimer = null;
  function viewChanged() {
    hidePasteBar();
    $('#zoomLabel').textContent = `${Math.round(view.scale * 100)}%`;
    requestRender();
    clearTimeout(viewSaveTimer);
    viewSaveTimer = setTimeout(() => {
      try { localStorage.setItem('inkboard.view', JSON.stringify(view)); } catch (_) { /* ignore */ }
    }, 400);
  }

  // ---------------------------------------------------------------- history
  function snapshot() { return { layers: doc.layers.map((l) => ({ ...l, items: l.items.slice() })), active: doc.active }; }
  function restore(s) {
    doc.layers = s.layers.map((l) => ({ ...l, items: l.items.slice() }));
    doc.active = doc.layers.some((l) => l.id === s.active) ? s.active : doc.layers[doc.layers.length - 1].id;
  }
  // A cut-through selection splits items right away so the pieces can be selected, but stays
  // tentative: the next edit makes it permanent (and undoes together with that edit), while
  // dropping the selection puts the original items back.
  let pendingCut = null; // { before: snapshot taken before the first cut }
  function pushHistory(snap) {
    if (pendingCut) { snap = pendingCut.before; pendingCut = null; }
    history.past.push(snap);
    if (history.past.length > HISTORY_LIMIT) history.past.shift();
    history.future.length = 0;
  }
  function dropPendingCut() {
    if (!pendingCut) return;
    restore(pendingCut.before);
    pendingCut = null;
    selection.clear();
    changed({ save: false });
  }
  function commit(fn) { pushHistory(snapshot()); fn(); changed(); }
  function undo() {
    dropPendingCut();
    if (gesture || !history.past.length) return;
    history.future.push(snapshot());
    restore(history.past.pop());
    pruneSelection();
    changed();
  }
  function redo() {
    dropPendingCut();
    if (gesture || !history.future.length) return;
    history.past.push(snapshot());
    restore(history.future.pop());
    pruneSelection();
    changed();
  }
  function pruneSelection() {
    const ids = new Set(activeLayer().items.map((i) => i.id));
    for (const id of [...selection]) if (!ids.has(id)) selection.delete(id);
  }
  function changed(opts = {}) {
    requestRender();
    renderLayers();
    $('#undoBtn').disabled = !history.past.length;
    $('#redoBtn').disabled = !history.future.length;
    if (opts.save !== false) scheduleSave();
  }

  // ---------------------------------------------------------------- persistence (IndexedDB)
  const DB = (() => {
    let p = null;
    function open() {
      if (p) return p;
      p = new Promise((res, rej) => {
        if (!('indexedDB' in window)) { rej(new Error('IndexedDB unavailable')); return; }
        const r = indexedDB.open('inkboard', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      p.catch(() => { p = null; }); // let the next call retry instead of caching the failure
      return p;
    }
    async function get(k) {
      const db = await open();
      return new Promise((res, rej) => {
        const q = db.transaction('kv', 'readonly').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
    }
    async function set(k, v) {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    }
    async function del(k) {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete(k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    async function keys() {
      const db = await open();
      return new Promise((res, rej) => {
        const q = db.transaction('kv', 'readonly').objectStore('kv').getAllKeys();
        q.onsuccess = () => res(q.result.map(String));
        q.onerror = () => rej(q.error);
      });
    }
    return { get, set, del, keys };
  })();
  let saveTimer = null;
  let savePendingSince = 0;
  // Set when the stored drawing couldn't be read, so autosave can't overwrite it with something else.
  let autosaveOff = false;
  const setStatus = (t) => { $('#saveStatus').textContent = t; };
  function scheduleSave() {
    if (autosaveOff) { setStatus('Autosave off'); return; }
    editSeq++;
    setStatus('Editing…');
    // Save 700 ms after the last edit, but no later than 3 s after the first unsaved one.
    const now = Date.now();
    if (!saveTimer) savePendingSince = now;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, clamp(savePendingSince + 3000 - now, 0, 700));
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (autosaveOff) return;
    if (mode === 'server') {
      if (!current) return;
      try { await writeDraft(true); } catch (err) { console.warn('Could not keep a local copy', err); }
      schedulePush();
      return;
    }
    try {
      await DB.set('doc', serializeDoc());
      setStatus('Saved');
    } catch (err) {
      console.warn(err);
      setStatus('Not saved');
      toast('Couldn’t save in this browser (storage full?). Use Save project to keep a copy.', 6000);
    }
  }
  function serializeDoc() {
    return {
      version: 1, paper: doc.paper, active: doc.active,
      layers: doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, items: l.items })),
    };
  }
  // Returns { clip } with only well-formed polygons, or {} when there's nothing to keep.
  function normClip(clip) {
    if (!Array.isArray(clip)) return {};
    const out = clip.slice(0, 64).map((c) => (c && Array.isArray(c.pts) ? {
      out: !!c.out,
      pts: c.pts.filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1])).slice(0, 20000).map((p) => [+p[0], +p[1]]),
    } : null)).filter((c) => c && c.pts.length >= 3);
    return out.length ? { clip: out } : {};
  }
  function normItem(it) {
    if (!it || typeof it !== 'object') return null;
    if (it.type === 'stroke' && Array.isArray(it.points)) {
      const pts = it.points
        .filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]))
        .map((p) => [+p[0], +p[1], clamp(Number.isFinite(+p[2]) ? +p[2] : 0.5, 0, 1)]);
      if (!pts.length) return null;
      return {
        type: 'stroke', id: String(it.id || uid()),
        brush: BRUSHES[it.brush] ? it.brush : 'pen',
        color: isHex(it.color) ? it.color : '#1f2430',
        size: Math.max(0.01, +it.size || 2),
        opacity: clamp(+it.opacity || 1, 0.01, 1),
        noTaper: !!it.noTaper, points: pts,
        ...(it.noTaperStart ? { noTaperStart: true } : {}), ...(it.noTaperEnd ? { noTaperEnd: true } : {}),
      };
    }
    if (it.type === 'fill' && Array.isArray(it.points)) {
      const pts = it.points
        .filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]))
        .map((p) => [+p[0], +p[1]]);
      if (pts.length < 3) return null;
      return {
        type: 'fill', id: String(it.id || uid()),
        color: isHex(it.color) ? it.color : '#1f2430',
        opacity: clamp(+it.opacity || 1, 0.01, 1), points: pts, ...normClip(it.clip),
      };
    }
    if (it.type === 'image') {
      const base = {
        type: 'image', id: String(it.id || uid()),
        x: +it.x || 0, y: +it.y || 0, w: Math.max(0.1, +it.w || 100), h: Math.max(0.1, +it.h || 100),
        ...normClip(it.clip),
      };
      if (typeof it.src === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(it.src)) return { ...base, src: it.src };
      if (typeof it.asset === 'string' && /^[a-z0-9]{15}\/[\w.-]{1,200}$/.test(it.asset)) return { ...base, asset: it.asset };
    }
    return null;
  }
  function normalizeDoc(d) {
    if (!d || !Array.isArray(d.layers) || !d.layers.length) throw new Error('Not an Inkboard drawing');
    const layers = d.layers.map((l, i) => ({
      id: String(l.id || uid()),
      name: String(l.name || `Layer ${i + 1}`).slice(0, 60),
      visible: l.visible !== false,
      opacity: clamp(Number.isFinite(+l.opacity) ? +l.opacity : 1, 0, 1),
      items: (Array.isArray(l.items) ? l.items : []).map(normItem).filter(Boolean),
    }));
    return {
      version: 1,
      paper: PAPERS.some((p) => p.id === d.paper) ? d.paper : 'warm',
      layers,
      active: layers.some((l) => l.id === d.active) ? d.active : layers[layers.length - 1].id,
    };
  }

  // ---------------------------------------------------------------- server mode (library + sync)
  // Each drawing lives on the Inkboard server. Every save is first written to IndexedDB as a
  // draft, then uploaded, so a dirty draft survives offline periods and reloads. Uploads carry
  // revision = stored + 1; the server rejects anything else with 409 (edited elsewhere).
  let mode = 'local';            // 'local' (no backend) | 'server'
  let current = null;            // open server drawing: { id, title, folder, revision }
  let editSeq = 0, syncedSeq = 0; // edits made / edits covered by the last successful upload
  let pushPromise = null, pushAgain = false, pushTimer = null, retryDelay = 0, lastPush = 0;
  let conflictOpen = false, reauthing = false;
  const uploadedSrc = new Map(); // data URL -> asset ref, so undo/paste never re-uploads an image
  const failedSrc = new Set();   // images the server refused; they stay embedded

  const jsonBlob = (d) => new Blob([JSON.stringify(d)], { type: 'application/json' });
  const errText = (err) => (err && err.status === 0 ? 'Can’t reach the Inkboard server' : (err && err.message) || 'Something went wrong');
  const draftPrefix = () => `draft:${InkAPI.user.id}:`;
  function writeDraft(dirty) {
    if (!current) return Promise.resolve();
    const { id, title, folder, revision } = current;
    return DB.set(draftPrefix() + id, { id, title, folder, revision, dirty, doc: serializeDoc(), view: { ...view }, savedAt: Date.now() });
  }
  async function userDrafts() {
    if (!InkAPI.user) return [];
    try {
      const ks = (await DB.keys()).filter((k) => k.startsWith(draftPrefix()));
      return (await Promise.all(ks.map((k) => DB.get(k)))).filter((d) => d && d.doc);
    } catch (_) { return []; }
  }
  function dataURLToBlob(src) {
    const [head, b64] = src.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) });
  }
  // Upload embedded (data URL) images as assets and swap the items in place. This isn't an
  // edit, so it skips history; older snapshots still map through uploadedSrc.
  async function convertImages(d) {
    const pending = new Set();
    for (const l of d.layers) for (const it of l.items) {
      if (it.type === 'image' && it.src && !uploadedSrc.has(it.src) && !failedSrc.has(it.src)) pending.add(it.src);
    }
    for (const src of pending) {
      try {
        const rec = await InkAPI.uploadAsset(dataURLToBlob(src));
        const ref = `${rec.id}/${rec.file}`;
        uploadedSrc.set(src, ref);
        const img = imageCache.get(src);
        if (img && img._ok) imageCache.set(`asset:${ref}`, img);
      } catch (err) {
        if (err.status === 0 || err.status === 401 || err.status >= 500) throw err;
        console.warn('Image upload refused', err);
        failedSrc.add(src);
      }
    }
    const swap = (it) => {
      if (it.type !== 'image' || !it.src || !uploadedSrc.has(it.src)) return it;
      const { src, ...rest } = it; // keep everything else (position, clip, ...)
      return { ...rest, asset: uploadedSrc.get(src) };
    };
    for (const l of d.layers) if (l.items.some((it) => it.src && uploadedSrc.has(it.src))) l.items = l.items.map(swap);
  }
  async function makeThumbnail() {
    const TW = 480, TH = 360, pad = 16;
    const c = document.createElement('canvas');
    c.width = TW;
    c.height = TH;
    const cx = c.getContext('2d');
    const b = contentBounds();
    if (!b) { cx.fillStyle = paper().bg; cx.fillRect(0, 0, TW, TH); } else {
      const bw = Math.max(1, b.x1 - b.x0), bh = Math.max(1, b.y1 - b.y0);
      const k = Math.min((TW - pad * 2) / bw, (TH - pad * 2) / bh, 2);
      drawScene(c, cx, { a: k, e: TW / 2 - (b.x0 + bw / 2) * k, f: TH / 2 - (b.y0 + bh / 2) * k }, { bg: true, live: false, cull: null, grid: false });
      requestRender();
    }
    return new Promise((res) => c.toBlob(res, 'image/webp', 0.8));
  }

  // Record that the open drawing has changes the server doesn't: keep a draft, upload soon.
  function markDirty() {
    editSeq++;
    writeDraft(true).catch(() => { /* upload still proceeds */ });
    schedulePush(0);
  }
  function schedulePush(delay) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushToServer, delay !== undefined ? delay : Math.max(0, lastPush + 4000 - Date.now()));
  }
  function pushToServer() {
    if (pushPromise) { pushAgain = true; return pushPromise; }
    pushPromise = doPush().finally(() => {
      pushPromise = null;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    });
    return pushPromise;
  }
  async function doPush() {
    clearTimeout(pushTimer);
    if (mode !== 'server' || !current || editSeq === syncedSeq || conflictOpen) return;
    const target = current, seq = editSeq;
    lastPush = Date.now();
    setStatus('Saving…');
    try {
      await convertImages(doc);
      if (current !== target) return;
      const fields = { revision: target.revision + 1, data: jsonBlob(serializeDoc()) };
      const thumb = await makeThumbnail();
      if (thumb) fields.thumbnail = thumb;
      const rec = await InkAPI.updateDrawing(target.id, fields);
      target.revision = rec.revision;
      retryDelay = 0;
      if (current !== target) return;
      syncedSeq = seq;
      if (editSeq === seq) {
        setStatus('Saved');
        writeDraft(false).catch(() => { /* the server copy is what matters */ });
      } else pushAgain = true;
    } catch (err) {
      if (current !== target) return;
      if (err.status === 409) { setStatus('Not saved'); resolveConflict(); } else if (err.status === 401) setStatus('Sign in to sync');
      else if (err.status === 0 || err.status >= 500) {
        setStatus('Offline · kept on this device');
        retryDelay = clamp(retryDelay * 2, 5000, 60000);
        clearTimeout(pushTimer);
        pushTimer = setTimeout(pushToServer, retryDelay);
      } else {
        setStatus('Not saved');
        toast(`Couldn’t save: ${errText(err)}`, 6000);
      }
    }
  }
  // Write the draft and upload now; used before switching drawings or opening the library.
  async function flushCurrent() {
    if (mode !== 'server' || !current) return;
    if (saveTimer) await saveNow();
    if (editSeq !== syncedSeq) await pushToServer();
  }

  function askConflict() {
    return new Promise((resolve) => {
      const dlg = $('#conflictDialog');
      dlg.hidden = false;
      dlg.onclick = (e) => {
        const b = e.target.closest('[data-choice]');
        if (!b) return;
        dlg.hidden = true;
        dlg.onclick = null;
        resolve(b.dataset.choice);
      };
    });
  }
  async function resolveConflict() {
    if (conflictOpen || !current) return;
    conflictOpen = true;
    const target = current;
    const choice = await askConflict();
    conflictOpen = false;
    if (current !== target) return;
    try {
      if (choice === 'mine') {
        target.revision = (await InkAPI.getDrawing(target.id)).revision;
        syncedSeq = -1;
        schedulePush(0);
      } else if (choice === 'theirs') {
        await DB.del(draftPrefix() + target.id).catch(() => {});
        await openDrawing(target.id, { fresh: true, skipFlush: true });
      } else {
        const rec = await InkAPI.createDrawing({ title: `${target.title} (my copy)`.slice(0, 200), folder: target.folder || '' });
        await DB.del(draftPrefix() + target.id).catch(() => {});
        adopt(rec);
        markDirty();
        toast('Saved your version as a copy');
      }
    } catch (err) {
      toast(errText(err), 6000);
    }
  }

  function loadDocument(d, savedView) {
    abortGesture();
    pendingCut = null;
    doc = d;
    history.past.length = 0;
    history.future.length = 0;
    selection.clear();
    hidePasteBar();
    applyPaper();
    preloadImages();
    if (savedView && Number.isFinite(savedView.x) && Number.isFinite(savedView.y) && Number.isFinite(savedView.scale)) {
      view = { x: savedView.x, y: savedView.y, scale: clamp(savedView.scale, MIN_SCALE, MAX_SCALE) };
      viewChanged();
    } else fitContent();
    changed({ save: false });
  }
  // Make a server record the open drawing (the document is already in `doc`).
  function adopt(rec) {
    current = { id: rec.id, title: rec.title, folder: rec.folder || '', revision: rec.revision };
    editSeq = syncedSeq = 0;
    updateTitle();
    InkLibrary.hide();
  }
  function updateTitle() {
    $('#docTitle').textContent = current ? current.title : '';
    document.title = current ? `${current.title} – Inkboard` : 'Inkboard';
  }
  async function openDrawing(id, opts = {}) {
    if (!opts.skipFlush) await flushCurrent().catch(() => {});
    setStatus('Opening…');
    try {
      const rec = await InkAPI.getDrawing(id);
      let draft = null;
      if (!opts.fresh) draft = await DB.get(draftPrefix() + id).catch(() => null);
      // A dirty draft has edits not yet on the server; a clean one at the same revision is a cache.
      let data = draft && (draft.dirty || draft.revision === rec.revision) ? draft.doc : null;
      if (!data && rec.data) data = JSON.parse(await (await InkAPI.fetchFile('drawings', id, rec.data)).text());
      loadDocument(data ? normalizeDoc(data) : newDoc(), draft && draft.view);
      adopt(rec);
      if (draft && draft.dirty) {
        current.revision = draft.revision; // the server decides whether it's still current
        markDirty();
      } else setStatus('');
      return true;
    } catch (err) {
      console.warn(err);
      setStatus('');
      toast(err instanceof SyntaxError || /drawing/i.test(err.message) ? 'That drawing’s file is damaged' : errText(err), 6000);
      return false;
    }
  }
  async function newServerDrawing(folder, d, title) {
    try {
      await flushCurrent().catch(() => {});
      const fresh = d || newDoc();
      const rec = await InkAPI.createDrawing({ title: title || 'Untitled drawing', folder: folder || '', data: d ? undefined : jsonBlob(fresh) });
      loadDocument(fresh);
      adopt(rec);
      if (d) markDirty(); else setStatus('');
      return true;
    } catch (err) {
      toast(`Couldn’t create the drawing: ${errText(err)}`, 6000);
      return false;
    }
  }
  function closeCurrent() {
    current = null;
    clearTimeout(pushTimer);
    loadDocument(newDoc());
    updateTitle();
    setStatus('');
  }
  async function renameCurrent() {
    if (!current) return;
    const t = prompt('Rename drawing', current.title);
    const title = t && t.trim().slice(0, 200);
    if (!title || title === current.title) return;
    try {
      await InkAPI.updateDrawing(current.id, { title });
      current.title = title;
      updateTitle();
    } catch (err) { toast(errText(err)); }
  }
  async function showLibrary() {
    await flushCurrent().catch(() => {});
    InkLibrary.show(current ? current.folder : undefined);
  }

  // Upload drafts left dirty by earlier sessions (closed while offline). Ones whose drawing
  // changed on the server meanwhile are left alone; opening them shows the conflict dialog.
  async function syncDirtyDrafts() {
    for (const d of await userDrafts()) {
      if (!d.dirty || (current && d.id === current.id)) continue;
      try {
        const rec = await InkAPI.getDrawing(d.id);
        if (rec.revision !== d.revision) continue;
        const nd = normalizeDoc(d.doc);
        await convertImages(nd);
        const saved = await InkAPI.updateDrawing(d.id, { revision: d.revision + 1, data: jsonBlob(nd) });
        await DB.set(draftPrefix() + d.id, { ...d, doc: nd, revision: saved.revision, dirty: false });
      } catch (err) {
        console.warn('Draft sync failed', d.id, err);
      }
    }
  }
  async function offerLocalImport() {
    const flag = `inkboard.imported.${InkAPI.user.id}`;
    try { if (localStorage.getItem(flag)) return; } catch (_) { return; }
    let old = null;
    try { old = normalizeDoc(await DB.get('doc')); } catch (_) { return; }
    if (!old.layers.some((l) => l.items.length)) return;
    const banner = $('#libBanner');
    banner.hidden = false;
    const done = () => { banner.hidden = true; try { localStorage.setItem(flag, '1'); } catch (_) { /* ignore */ } };
    $('#libImportDismiss').onclick = done;
    $('#libImportLocal').onclick = async () => { if (await newServerDrawing('', old, 'Drawing from this browser')) done(); };
  }
  async function signOut() {
    const unsynced = (await userDrafts()).some((d) => d.dirty) || (current && editSeq !== syncedSeq);
    if (unsynced && !confirm('Some changes haven’t reached the server yet and will be lost if you sign out now. Sign out anyway?')) return;
    try { for (const k of (await DB.keys()).filter((key) => key.startsWith(draftPrefix()))) await DB.del(k); } catch (_) { /* ignore */ }
    InkAPI.logout();
    location.reload();
  }
  // Token expired mid-session: sign in again without losing the open drawing.
  function onUnauthorized() {
    if (reauthing) return;
    reauthing = true;
    const before = InkAPI.user && InkAPI.user.id;
    InkLibrary.showLogin('Your session expired. Sign in again to keep saving.').then((user) => {
      reauthing = false;
      if (user.id !== before) { location.reload(); return; }
      schedulePush(0);
      InkLibrary.refresh();
    });
  }

  async function startServer(detected) {
    if (detected === 'unreachable') {
      const r = await InkLibrary.showOffline((await userDrafts()).sort((a, b) => b.savedAt - a.savedAt).slice(0, 5));
      if (r.retry) return startServer(await InkAPI.detect());
      // Work on the local copy; uploads retry with backoff until the server is back.
      loadDocument(normalizeDoc(r.draft.doc), r.draft.view);
      adopt({ id: r.draft.id, title: r.draft.title, folder: r.draft.folder, revision: r.draft.revision });
      if (r.draft.dirty) markDirty();
      InkAPI.onUnauthorized = onUnauthorized;
      setStatus('Offline · kept on this device');
      return undefined;
    }
    if (InkAPI.user) {
      try { await InkAPI.refresh(); } catch (err) {
        if (err.status === 0 || err.status >= 500) return startServer('unreachable');
        InkAPI.logout();
      }
    }
    if (!InkAPI.user) await InkLibrary.showLogin();
    InkAPI.onUnauthorized = onUnauthorized;
    $('#menuUser').textContent = `(${InkAPI.user.username || InkAPI.user.email})`;
    syncDirtyDrafts();
    await InkLibrary.show(null);
    offerLocalImport();
    return undefined;
  }

  // ---------------------------------------------------------------- pointer input
  function pressureOf(e) {
    if (e.pointerType === 'pen') return e.pressure > 0 ? e.pressure : 0.2;
    return 0.5;
  }
  const touchList = () => [...pointers.entries()].filter(([, p]) => p.type === 'touch').map(([id, p]) => ({ id, ...p }));
  function activeLayerUsable() {
    const l = activeLayer();
    if (!l.visible) { toast(`“${l.name}” is hidden — show it to draw on it`); return false; }
    return true;
  }

  function onDown(e) {
    if (!doc) return; // still starting up
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const sx = e.clientX, sy = e.clientY;
    pointers.set(e.pointerId, { x: sx, y: sy, sx, sy, type: e.pointerType });
    closeMenus();

    if (e.pointerType === 'touch') {
      const touches = touchList();
      if (!tap || touches.length === 1) tap = { t: performance.now(), max: 0, moved: false };
      tap.max = Math.max(tap.max, touches.length);
      if (touches.length >= 2) {
        if (gesture && gesture.ptype === 'touch' && gesture.kind !== 'pinch') abortGesture();
        if (!gesture) startPinch();
        return;
      }
      if (prefs.pencilOnly) { if (!gesture) startPan(e); return; }
    }
    if (e.pointerType === 'pen' && !penSeen) {
      penSeen = true;
      if (!prefs.pencilOnly) {
        setPencilOnly(true);
        toast('Stylus detected — fingers now pan & zoom. Toggle with the stylus button.');
      }
    }
    if (gesture) return;
    if (e.button === 1 || spaceDown || prefs.tool === 'hand') { startPan(e); return; }
    startTool(e);
  }

  function startPan(e) {
    gesture = { kind: 'pan', id: e.pointerId, ptype: e.pointerType, lx: e.clientX, ly: e.clientY };
    canvas.style.cursor = 'grabbing';
  }
  function startPinch() {
    const ts = touchList().slice(0, 2);
    const c0 = { x: (ts[0].x + ts[1].x) / 2, y: (ts[0].y + ts[1].y) / 2 };
    const d0 = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y) || 1;
    gesture = { kind: 'pinch', ptype: 'touch', ids: [ts[0].id, ts[1].id], c0, d0, v0: { ...view } };
  }
  function pinchMove() {
    const g = gesture;
    const a = pointers.get(g.ids[0]), b = pointers.get(g.ids[1]);
    if (!a || !b) return;
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const s = clamp((g.v0.scale * d) / g.d0, MIN_SCALE, MAX_SCALE);
    const wx = (g.c0.x - g.v0.x) / g.v0.scale, wy = (g.c0.y - g.v0.y) / g.v0.scale;
    view.scale = s;
    view.x = c.x - wx * s;
    view.y = c.y - wy * s;
    viewChanged();
  }

  function startTool(e) {
    const w = toWorld(e.clientX, e.clientY);
    const tool = prefs.tool;
    const base = { id: e.pointerId, ptype: e.pointerType };
    if (DRAW_TOOLS.includes(tool)) {
      if (!activeLayerUsable()) return;
      const size = prefs.sizes[tool] / view.scale;
      gesture = {
        ...base, kind: 'draw', brush: tool, size, color: prefs.color,
        opacity: prefs.opacity[tool] / 100, straightness: clamp((prefs.straight[tool] || 0) / 100, 0, 1), raw: [],
        minSp: Math.max(0.6 / view.scale, size * (tool === 'marker' ? 0.18 : 0.12)),
        dirty: true, straight: false, shift: e.shiftKey, end: null,
        holdX: e.clientX, holdY: e.clientY, holdTimer: null,
      };
      addPoint(gesture, w.x, w.y, pressureOf(e));
      gesture.end = gesture.raw[0].slice();
      armHold(gesture);
      requestRender();
      return;
    }
    if (tool === 'shape') {
      if (!activeLayerUsable()) return;
      const brush = prefs.lastBrush;
      gesture = {
        ...base, kind: 'shape', shape: prefs.shape, a: w, b: w, brush,
        size: prefs.sizes[brush] / view.scale, color: prefs.color,
        opacity: prefs.opacity[brush] / 100, shift: e.shiftKey, dirty: true,
      };
      requestRender();
      return;
    }
    if (tool === 'fill') {
      if (!activeLayerUsable()) return;
      gesture = {
        ...base, kind: 'fill', pts: [[w.x, w.y]], color: prefs.color,
        opacity: prefs.opacity.fill / 100, minSp: 2.5 / view.scale, dirty: true,
      };
      requestRender();
      return;
    }
    if (tool === 'eraser') {
      if (!activeLayerUsable()) return;
      if (prefs.eraseMode === 'whole') {
        gesture = { ...base, kind: 'erase', last: w };
        eraseAlong(w, w);
      } else {
        gesture = { ...base, kind: 'erase', last: w, items: activeLayer().items, changed: false, touched: new Set(), cutStroke: false };
        eraseAlongPartial(gesture, w, w);
      }
      requestRender();
      return;
    }
    if (tool === 'select') selectDown(e, w);
  }

  function addPoint(g, wx, wy, p) {
    const pts = g.raw, last = pts[pts.length - 1];
    if (last) {
      const dx = wx - last[0], dy = wy - last[1];
      if (dx * dx + dy * dy < g.minSp * g.minSp) { last[2] = Math.max(last[2], p * 0.5 + last[2] * 0.5); return false; }
      wx = last[0] + dx * 0.7;
      wy = last[1] + dy * 0.7;
      p = last[2] + (p - last[2]) * 0.5;
    }
    pts.push([wx, wy, p]);
    return true;
  }
  function armHold(g) {
    clearTimeout(g.holdTimer);
    if (g.straight || g.shift) return;
    g.holdTimer = setTimeout(() => {
      if (gesture !== g) return;
      const a = g.raw[0], b = g.raw[g.raw.length - 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) * view.scale < 24) return;
      g.straight = true;
      g.end = b.slice();
      g.dirty = true;
      if (navigator.vibrate) navigator.vibrate(8);
      requestRender();
    }, 650);
  }
  function buildLive(g) {
    let pts;
    if (g.straight || g.shift) {
      const a = g.raw[0], b = g.end || a;
      pts = linePts(a, b, (a[2] + b[2]) / 2, g.size);
    } else pts = straighten(g.raw.slice(), g.straightness, g.size);
    return { type: 'stroke', id: 'live', brush: g.brush, color: g.color, size: g.size, opacity: g.opacity, noTaper: false, points: pts };
  }
  function fillItem(g) {
    return { type: 'fill', id: 'live', color: g.color, opacity: g.opacity, points: g.pts.slice() };
  }
  // Append a world point to a freeform path if it's far enough from the last one.
  function addPathPoint(g, w) {
    const last = g.pts[g.pts.length - 1];
    if (Math.hypot(w.x - last[0], w.y - last[1]) < g.minSp) return false;
    g.pts.push([w.x, w.y]);
    return true;
  }

  function shapeItem(g) {
    let ax = g.a.x, ay = g.a.y, bx = g.b.x, by = g.b.y;
    const p = 0.5;
    let pts = [];
    if (g.shape === 'line') {
      if (g.shift) {
        const ang = Math.round(Math.atan2(by - ay, bx - ax) / (Math.PI / 12)) * (Math.PI / 12);
        const L = Math.hypot(bx - ax, by - ay);
        bx = ax + Math.cos(ang) * L; by = ay + Math.sin(ang) * L;
      }
      pts = linePts([ax, ay, p], [bx, by, p], p, g.size);
    } else {
      if (g.shift) {
        const d = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        bx = ax + Math.sign(bx - ax || 1) * d;
        by = ay + Math.sign(by - ay || 1) * d;
      }
      if (g.shape === 'rect') {
        const c = [[ax, ay, p], [bx, ay, p], [bx, by, p], [ax, by, p], [ax, ay, p]];
        for (let i = 1; i < c.length; i++) {
          const seg = linePts(c[i - 1], c[i], p, g.size);
          pts = pts.concat(i === 1 ? seg : seg.slice(1));
        }
      } else {
        const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = Math.abs(bx - ax) / 2, ry = Math.abs(by - ay) / 2;
        const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
        const n = Math.max(24, Math.ceil(per / Math.max(g.size * 0.3, 0.5)));
        for (let i = 0; i <= n; i++) {
          const t = (i / n) * Math.PI * 2;
          pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, p]);
        }
      }
    }
    return {
      type: 'stroke', id: 'live', brush: g.brush, color: g.color, size: g.size,
      opacity: g.opacity, noTaper: g.shape !== 'line', points: pts,
    };
  }

  function hitItem(it, wx, wy, rad) {
    const bb = itemBBox(it);
    if (wx < bb.x0 - rad || wx > bb.x1 + rad || wy < bb.y0 - rad || wy > bb.y1 + rad) return false;
    if (it.clip && !clipsPass(it, wx, wy)) return false;
    if (it.type === 'image') return true;
    if (it.type === 'fill') {
      const P = it.points;
      if (pointInPoly(wx, wy, P)) return true;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        if (distSeg(wx, wy, P[j][0], P[j][1], P[i][0], P[i][1]) <= rad) return true;
      }
      return false;
    }
    const g = strokeGeom(it), P = it.points;
    if (P.length === 1) return Math.hypot(wx - P[0][0], wy - P[0][1]) <= g.rs[0] + rad;
    for (let i = 1; i < P.length; i++) {
      if (distSeg(wx, wy, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]) <= Math.max(g.rs[i - 1], g.rs[i]) + rad) return true;
    }
    return false;
  }
  function eraseAlong(a, b) {
    const layer = activeLayer();
    const rad = prefs.sizes.eraser / 2 / view.scale;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (rad * 0.5)));
    for (const it of layer.items) {
      if (it.type === 'image' || hiddenIds.has(it.id)) continue; // pictures/PDF pages are never erased
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (hitItem(it, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, rad)) { hiddenIds.add(it.id); break; }
      }
    }
  }

  // Partial eraser: cut every stroke on the active layer along eraser segment a→b. Works on
  // the gesture's copy of the layer (g.items), committed when the pointer lifts. Fills it
  // touches are erased whole, but only if the gesture doesn't touch any stroke, so rubbing out
  // ink drawn on a fill never deletes the fill. Images (incl. PDF pages) are never erased.
  function eraseAlongPartial(g, a, b) {
    const R = prefs.sizes.eraser / 2 / view.scale;
    const sb = { x0: Math.min(a.x, b.x) - R, y0: Math.min(a.y, b.y) - R, x1: Math.max(a.x, b.x) + R, y1: Math.max(a.y, b.y) + R };
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (R * 0.5)));
    // Every item is carried over: untouched ones as-is, cut strokes as their remaining pieces.
    const next = [];
    let cut = false;
    for (const it of g.items) {
      if (it.type === 'image' || !intersects(itemBBox(it), sb)) { next.push(it); continue; }
      if (it.type === 'fill') {
        if (!g.touched.has(it.id)) {
          for (let k = 0; k <= n; k++) {
            if (hitItem(it, a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, R)) { g.touched.add(it.id); break; }
          }
        }
        next.push(it);
        continue;
      }
      const pieces = eraseStroke(it, a, b, R);
      if (!pieces) { next.push(it); continue; }
      next.push(...pieces);
      cut = true;
    }
    if (cut) {
      g.items = next;
      g.changed = true;
      g.cutStroke = true;
    }
    // Preview: touched fills disappear while no stroke has been hit.
    hiddenIds.clear();
    if (!g.cutStroke) for (const id of g.touched) hiddenIds.add(id);
  }

  // ---------------------------------------------------------------- selection
  function selBBox() {
    if (!selection.size) return null;
    let b = null;
    for (const it of activeLayer().items) if (selection.has(it.id)) { const bb = itemBBox(it); b = b ? union(b, bb) : { ...bb }; }
    if (!b) return null;
    if (preview) {
      const m = (x, y) => [preview.ox + (x - preview.ox) * preview.s + preview.dx, preview.oy + (y - preview.oy) * preview.s + preview.dy];
      const [x0, y0] = m(b.x0, b.y0), [x1, y1] = m(b.x1, b.y1);
      b = { x0, y0, x1, y1 };
    }
    return b;
  }
  function selBBoxScreen() {
    const b = selBBox();
    if (!b) return null;
    const a = toScreen(b.x0, b.y0), c = toScreen(b.x1, b.y1), pad = 6;
    return { x0: a.x - pad, y0: a.y - pad, x1: c.x + pad, y1: c.y + pad };
  }
  function topHit(layer, w) {
    const rad = 6 / view.scale;
    for (let i = layer.items.length - 1; i >= 0; i--) if (hitItem(layer.items[i], w.x, w.y, rad)) return layer.items[i];
    return null;
  }
  function selectDown(e, w) {
    const base = { id: e.pointerId, ptype: e.pointerType };
    const sb = selBBoxScreen();
    if (sb) {
      if (Math.hypot(e.clientX - sb.x1, e.clientY - sb.y1) <= 18) {
        const b = selBBox();
        gesture = { ...base, kind: 'scale', ox: b.x0, oy: b.y0, base: Math.max(1e-6, (b.x1 - b.x0) + (b.y1 - b.y0)) };
        preview = { dx: 0, dy: 0, s: 1, ox: b.x0, oy: b.y0 };
        return;
      }
      if (!e.shiftKey && e.clientX >= sb.x0 && e.clientX <= sb.x1 && e.clientY >= sb.y0 && e.clientY <= sb.y1) {
        gesture = { ...base, kind: 'move', a: w };
        preview = { dx: 0, dy: 0, s: 1, ox: 0, oy: 0 };
        return;
      }
    }
    if (!e.shiftKey) dropPendingCut();
    const hit = topHit(activeLayer(), w);
    if (hit) {
      if (e.shiftKey) { if (selection.has(hit.id)) selection.delete(hit.id); else selection.add(hit.id); } else selection = new Set([hit.id]);
      if (selection.size) {
        gesture = { ...base, kind: 'move', a: w };
        preview = { dx: 0, dy: 0, s: 1, ox: 0, oy: 0 };
      }
      requestRender();
      return;
    }
    const wasEmpty = !selection.size;
    if (!e.shiftKey) selection.clear();
    if (prefs.selectMode === 'rect') gesture = { ...base, kind: 'marquee', a: w, b: w, wasEmpty };
    else gesture = { ...base, kind: 'lasso', pts: [[w.x, w.y]], minSp: 3 / view.scale, wasEmpty };
    requestRender();
  }
  // Lasso picks strokes/fills with at least half their points inside, and images whose centre is inside.
  function lassoSelect(layer, poly) {
    const lb = ptsBBox(poly);
    for (const it of layer.items) {
      if (!intersects(itemBBox(it), lb)) continue;
      if (it.type === 'image') {
        const b = itemBBox(it);
        if (pointInPoly((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, poly)) selection.add(it.id);
        continue;
      }
      let k = 0;
      for (const p of it.points) if (pointInPoly(p[0], p[1], poly)) k++;
      if (k * 2 >= it.points.length) selection.add(it.id);
    }
  }
  // Cut-through selection: strokes crossing the polygon are split and only the inside pieces
  // selected; images and fills crossing it become an outside and an inside copy with opposite
  // clips. The split stays tentative (pendingCut) until the selection is actually used.
  function cutSelect(layer, poly) {
    const pb = ptsBBox(poly);
    const clipPts = poly.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    const before = pendingCut ? pendingCut.before : snapshot();
    const out = [];
    let cut = false;
    for (const it of layer.items) {
      if (!intersects(itemBBox(it), pb)) { out.push(it); continue; }
      if (it.type === 'stroke') {
        const runs = cutStrokeByPoly(it, poly, pb);
        if (runs.length === 1) { out.push(it); if (runs[0].inside) selection.add(it.id); continue; }
        cut = true;
        for (const r of runs) { const p = strokePiece(it, r); out.push(p); if (r.inside) selection.add(p.id); }
        continue;
      }
      const cov = coverage(it, poly);
      if (cov !== 'some') { out.push(it); if (cov === 'all') selection.add(it.id); continue; }
      cut = true;
      const keep = { ...it, id: uid(), clip: [...(it.clip || []), { out: true, pts: clipPts }] };
      const take = { ...it, id: uid(), clip: [...(it.clip || []), { out: false, pts: clipPts }] };
      out.push(keep, take);
      selection.add(take.id);
    }
    if (!cut) return;
    pendingCut = { before };
    layer.items = out;
    changed({ save: false });
  }
  function transformItem(it, t) {
    const m = (x, y) => [t.ox + (x - t.ox) * t.s + t.dx, t.oy + (y - t.oy) * t.s + t.dy];
    const clip = it.clip ? { clip: it.clip.map((c) => ({ out: c.out, pts: c.pts.map((p) => m(p[0], p[1])) })) } : {};
    if (it.type === 'image') {
      const [x, y] = m(it.x, it.y);
      return { ...it, x, y, w: it.w * t.s, h: it.h * t.s, ...clip };
    }
    const points = it.points.map((p) => { const [x, y] = m(p[0], p[1]); return p.length > 2 ? [x, y, p[2]] : [x, y]; });
    if (it.type === 'fill') return { ...it, points, ...clip };
    return { ...it, size: it.size * t.s, points };
  }
  function updateSelBar() {
    const bar = $('#selBar');
    const sb = prefs.tool === 'select' && !(gesture && gesture.kind !== 'pan' && gesture.kind !== 'pinch') ? selBBoxScreen() : null;
    if (!sb) { bar.hidden = true; return; }
    bar.hidden = false;
    const bw = bar.offsetWidth || 164, bh = bar.offsetHeight || 44;
    let top = sb.y0 - bh - 10;
    if (top < 64) top = sb.y1 + 14;
    if (top > H - bh - 70) top = Math.max(64, H - bh - 70);
    bar.style.left = `${clamp((sb.x0 + sb.x1) / 2 - bw / 2, 8, W - bw - 8)}px`;
    bar.style.top = `${top}px`;
  }
  function deleteSelection() {
    if (!selection.size) return;
    const layer = activeLayer();
    commit(() => { layer.items = layer.items.filter((it) => !selection.has(it.id)); selection.clear(); });
  }
  function duplicateSelection() {
    if (!selection.size) return;
    const layer = activeLayer(), off = 20 / view.scale, t = { dx: off, dy: off, s: 1, ox: 0, oy: 0 };
    const copies = layer.items.filter((it) => selection.has(it.id)).map((it) => ({ ...transformItem(it, t), id: uid() }));
    commit(() => { layer.items = layer.items.concat(copies); selection = new Set(copies.map((c) => c.id)); });
  }
  function reorderSelection(toFront) {
    if (!selection.size) return;
    const layer = activeLayer();
    const sel = layer.items.filter((it) => selection.has(it.id)), rest = layer.items.filter((it) => !selection.has(it.id));
    commit(() => { layer.items = toFront ? rest.concat(sel) : sel.concat(rest); });
  }
  function recolorSelection(color) {
    const layer = activeLayer();
    const recolorable = (it) => selection.has(it.id) && it.type !== 'image';
    if (!layer.items.some((it) => recolorable(it) && it.color !== color)) return;
    commit(() => { layer.items = layer.items.map((it) => (recolorable(it) ? { ...it, color } : it)); });
  }

  // Clipboard. Items are immutable, so the clipboard can hold references to them.
  // Keyboard copy also puts JSON on the system clipboard so pasting works across tabs.
  let clip = null;     // { items, time, pastes }
  let lastBlur = 0;    // last time the window lost focus (something else may have been copied since)
  let pasteAt = null;  // world point for the tap-to-paste callout
  function copySelection() {
    if (!selection.size) return false;
    clip = { items: activeLayer().items.filter((it) => selection.has(it.id)), time: Date.now(), pastes: 0 };
    return true;
  }
  function cutSelection() { if (copySelection()) deleteSelection(); }
  const clipText = () => JSON.stringify({ app: 'inkboard-clip', items: clip ? clip.items : [] });
  function parseClipText(text) {
    if (!text || !text.startsWith('{"app":"inkboard-clip"')) return null;
    try {
      const d = JSON.parse(text);
      const items = Array.isArray(d.items) ? d.items.map(normItem).filter(Boolean) : [];
      return items.length ? items : null;
    } catch (_) { return null; }
  }
  // Paste centred on `at` (world), else offset from the originals if visible, else at the view centre.
  function pasteItems(items, at) {
    if (!items || !items.length || !activeLayerUsable()) return;
    let b = null;
    for (const it of items) { const bb = itemBBox(it); b = b ? union(b, bb) : { ...bb }; }
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    let dx, dy;
    if (at) { dx = at.x - cx; dy = at.y - cy; } else if (clip && items === clip.items && intersects(b, viewBox())) {
      clip.pastes++;
      dx = dy = (20 * clip.pastes) / view.scale;
    } else { const c = toWorld(W / 2, H / 2); dx = c.x - cx; dy = c.y - cy; }
    const t = { dx, dy, s: 1, ox: 0, oy: 0 };
    const copies = items.map((it) => ({ ...transformItem(it, t), id: uid() }));
    const layer = activeLayer();
    commit(() => { layer.items = layer.items.concat(copies); });
    setTool('select');
    selection = new Set(copies.map((c) => c.id));
    requestRender();
  }
  function pasteClip(at) {
    if (clip) pasteItems(clip.items, at);
    else toast('Nothing copied yet');
  }
  function showPasteBar(w) {
    pasteAt = w;
    const bar = $('#pasteBar');
    bar.hidden = false;
    const s = toScreen(w.x, w.y), bw = bar.offsetWidth || 90, bh = bar.offsetHeight || 44;
    bar.style.left = `${clamp(s.x - bw / 2, 8, W - bw - 8)}px`;
    bar.style.top = `${clamp(s.y - bh - 14, 64, H - bh - 70)}px`;
  }
  function hidePasteBar() {
    if (!pasteAt) return;
    pasteAt = null;
    $('#pasteBar').hidden = true;
  }
  function selectAll() {
    dropPendingCut();
    setTool('select');
    selection = new Set(activeLayer().items.map((i) => i.id));
    requestRender();
  }

  // ---------------------------------------------------------------- move / up
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (p) {
      if (tap && p.type === 'touch' && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 10) tap.moved = true;
      p.x = e.clientX; p.y = e.clientY;
    }
    if (!gesture) {
      if (e.pointerType !== 'touch') { hover = { x: e.clientX, y: e.clientY }; if (prefs.tool === 'eraser') requestRender(); }
      return;
    }
    if (gesture.kind === 'pinch') { if (gesture.ids.includes(e.pointerId)) pinchMove(); return; }
    if (gesture.id !== e.pointerId) return;
    hover = e.pointerType === 'touch' && prefs.tool !== 'eraser' ? null : { x: e.clientX, y: e.clientY };
    const g = gesture;
    switch (g.kind) {
      case 'pan':
        view.x += e.clientX - g.lx; view.y += e.clientY - g.ly;
        g.lx = e.clientX; g.ly = e.clientY;
        viewChanged();
        break;
      case 'draw': {
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        for (const ev of evs.length ? evs : [e]) {
          const w = toWorld(ev.clientX, ev.clientY);
          if (g.straight || g.shift) { g.end = [w.x, w.y, pressureOf(ev)]; g.dirty = true; } else if (addPoint(g, w.x, w.y, pressureOf(ev))) g.dirty = true;
        }
        if (Math.hypot(e.clientX - g.holdX, e.clientY - g.holdY) > 4) { g.holdX = e.clientX; g.holdY = e.clientY; armHold(g); }
        requestRender();
        break;
      }
      case 'shape':
        g.b = toWorld(e.clientX, e.clientY); g.shift = e.shiftKey; g.dirty = true;
        requestRender();
        break;
      case 'erase': {
        const w = toWorld(e.clientX, e.clientY);
        if (g.items) eraseAlongPartial(g, g.last, w); else eraseAlong(g.last, w);
        g.last = w;
        requestRender();
        break;
      }
      case 'move': {
        const w = toWorld(e.clientX, e.clientY);
        preview.dx = w.x - g.a.x; preview.dy = w.y - g.a.y;
        requestRender();
        break;
      }
      case 'scale': {
        const w = toWorld(e.clientX, e.clientY);
        preview.s = Math.max(0.05, ((w.x - g.ox) + (w.y - g.oy)) / g.base);
        requestRender();
        break;
      }
      case 'marquee':
        g.b = toWorld(e.clientX, e.clientY);
        requestRender();
        break;
      case 'lasso':
      case 'fill': {
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        for (const ev of evs.length ? evs : [e]) if (addPathPoint(g, toWorld(ev.clientX, ev.clientY))) g.dirty = true;
        requestRender();
        break;
      }
      default: break;
    }
  }

  function onUp(e) {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (p && p.type === 'touch' && tap && touchList().length === 0) {
      const t = tap; tap = null;
      if (!t.moved && performance.now() - t.t < 350) {
        if (gesture && gesture.kind === 'pinch') gesture = null;
        if (t.max === 2) { undo(); toast('Undo'); } else if (t.max === 3) { redo(); toast('Redo'); }
      }
    }
    if (!gesture) return;
    if (gesture.kind === 'pinch') { if (gesture.ids.includes(e.pointerId)) gesture = null; return; }
    if (gesture.id !== e.pointerId) return;
    finishGesture(e);
  }

  function abortGesture() {
    if (!gesture) return;
    clearTimeout(gesture.holdTimer);
    gesture = null;
    liveItem = null;
    preview = null;
    hiddenIds.clear();
    requestRender();
  }

  function finishGesture(e) {
    const g = gesture;
    gesture = null;
    const layer = activeLayer();
    switch (g.kind) {
      case 'pan': updateCursor(); break;
      case 'draw': {
        clearTimeout(g.holdTimer);
        if (!g.straight && !g.shift && e) {
          const w = toWorld(e.clientX, e.clientY), last = g.raw[g.raw.length - 1];
          if (Math.hypot(w.x - last[0], w.y - last[1]) > g.minSp * 0.5) g.raw.push([w.x, w.y, last[2]]);
        }
        const it = { ...buildLive(g), id: uid() };
        liveItem = null;
        commit(() => { layer.items = layer.items.concat([it]); });
        break;
      }
      case 'shape': {
        const it = { ...shapeItem(g), id: uid() };
        liveItem = null;
        if (Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y) * view.scale < 3) break;
        commit(() => { layer.items = layer.items.concat([it]); });
        break;
      }
      case 'erase':
        if (g.items) {
          hiddenIds.clear();
          const items = !g.cutStroke && g.touched.size ? g.items.filter((it) => !g.touched.has(it.id)) : g.items;
          if (items !== g.items || g.changed) commit(() => { layer.items = items; });
        } else if (hiddenIds.size) {
          const gone = new Set(hiddenIds);
          hiddenIds.clear();
          commit(() => { layer.items = layer.items.filter((it) => !gone.has(it.id)); });
        }
        break;
      case 'move':
      case 'scale': {
        const t = preview;
        preview = null;
        if (t && (Math.abs(t.dx) > 1e-6 || Math.abs(t.dy) > 1e-6 || Math.abs(t.s - 1) > 1e-6)) {
          commit(() => { layer.items = layer.items.map((it) => (selection.has(it.id) ? transformItem(it, t) : it)); });
        }
        break;
      }
      case 'fill': {
        liveItem = null;
        const b = ptsBBox(g.pts);
        if (g.pts.length < 3 || Math.max(b.x1 - b.x0, b.y1 - b.y0) * view.scale < 4) break;
        const it = { ...fillItem(g), id: uid() };
        commit(() => { layer.items = layer.items.concat([it]); });
        break;
      }
      case 'marquee': {
        const r = { x0: Math.min(g.a.x, g.b.x), y0: Math.min(g.a.y, g.b.y), x1: Math.max(g.a.x, g.b.x), y1: Math.max(g.a.y, g.b.y) };
        const big = (r.x1 - r.x0) * view.scale > 3 || (r.y1 - r.y0) * view.scale > 3;
        if (big && prefs.selectCut !== 'whole') cutSelect(layer, [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]);
        else if (big) {
          const inR = (x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
          for (const it of layer.items) {
            if (!intersects(itemBBox(it), r)) continue;
            if (it.type === 'image' || it.points.some((pt) => inR(pt[0], pt[1]))) selection.add(it.id);
          }
        } else if (g.wasEmpty && clip) showPasteBar(g.a);
        break;
      }
      case 'lasso': {
        const b = ptsBBox(g.pts);
        if (g.pts.length >= 3 && Math.max(b.x1 - b.x0, b.y1 - b.y0) * view.scale > 6) {
          if (prefs.selectCut === 'whole') lassoSelect(layer, g.pts); else cutSelect(layer, g.pts);
        }
        else if (g.wasEmpty && clip) showPasteBar({ x: g.pts[0][0], y: g.pts[0][1] });
        break;
      }
      default: break;
    }
    requestRender();
  }

  // ---------------------------------------------------------------- import / export
  function readAsDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  }
  function readAsText(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
  }
  function loadImage(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('Image failed to load')); img.src = src; });
  }
  async function makeImageItem(file, at, offset) {
    let src = await readAsDataURL(file);
    let img = await loadImage(src);
    let nw = img.naturalWidth || 512, nh = img.naturalHeight || 512;
    const isSvg = file.type === 'image/svg+xml';
    const webSafe = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type);
    if (isSvg || !webSafe || Math.max(nw, nh) > 2400) {
      // Rasterise SVGs (keeps exports reliable) and shrink very large photos to keep projects light.
      const k = isSvg ? Math.min(4, 2400 / Math.max(nw, nh)) : Math.min(1, 2400 / Math.max(nw, nh));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(nw * k));
      c.height = Math.max(1, Math.round(nh * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const keepAlpha = isSvg || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
      src = c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.9);
      if (isSvg) { /* keep display size based on intrinsic SVG size */ } else { nw = c.width; nh = c.height; }
      img = await loadImage(src);
    }
    img._ok = true;
    imageCache.set(src, img);
    const k = Math.min(1 / view.scale, (W / view.scale * 0.6) / nw, (H / view.scale * 0.6) / nh);
    const w = nw * k, h = nh * k;
    const c = at || toWorld(W / 2, H / 2);
    return { type: 'image', id: uid(), src, x: c.x - w / 2 + offset, y: c.y - h / 2 + offset, w, h };
  }
  async function importImageFiles(files, at) {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    if (!activeLayerUsable()) return;
    const layer = activeLayer(), added = [];
    let offset = 0;
    for (const f of imgs) {
      try { added.push(await makeImageItem(f, at, offset)); offset += 24 / view.scale; } catch (err) { console.warn(err); toast(`Couldn't import ${f.name}`); }
    }
    if (!added.length) return;
    commit(() => { layer.items = layer.items.concat(added); });
    setTool('select');
    selection = new Set(added.map((i) => i.id));
    requestRender();
  }
  async function importFiles(files, at) {
    files = [...files];
    await importImageFiles(files, at);
    for (const f of files.filter(isPdf)) await importPdf(f, at);
  }

  // PDF pages are rendered with the vendored pdf.js (loaded on first use) and placed as image items.
  const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const vendorURL = (p) => new URL(`vendor/pdfjs/${p}`, location.href).href;
  let pdfjsPromise = null;
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import('./vendor/pdfjs/pdf.min.mjs').then((m) => {
        m.GlobalWorkerOptions.workerSrc = vendorURL('pdf.worker.min.mjs');
        return m;
      });
      pdfjsPromise.catch(() => { pdfjsPromise = null; });
    }
    return pdfjsPromise;
  }
  async function importPdf(file, at) {
    if (!activeLayerUsable()) return;
    let task, pdf;
    try {
      const pdfjs = await loadPdfjs();
      task = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: vendorURL('cmaps/'), standardFontDataUrl: vendorURL('standard_fonts/'),
        wasmUrl: vendorURL('wasm/'), iccUrl: vendorURL('iccs/'),
      });
      pdf = await task.promise;
    } catch (err) {
      console.warn(err);
      if (task) task.destroy();
      toast(err && err.name === 'PasswordException' ? `${file.name} is password-protected` : `Couldn't open ${file.name}`);
      return;
    }
    try {
      const nums = pdf.numPages === 1 ? [1] : await choosePdfPages(pdf, file.name);
      if (!nums || !nums.length) return;
      toast(`Importing ${nums.length} page${nums.length > 1 ? 's' : ''}…`, 60000);
      const items = await renderPdfPages(pdf, nums, at);
      const layer = activeLayer();
      commit(() => { layer.items = layer.items.concat(items); });
      setTool('select');
      selection = new Set(items.map((i) => i.id));
      requestRender();
      toast(`Imported ${items.length} page${items.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.warn(err);
      toast(`Couldn't import ${file.name}`);
    } finally {
      task.destroy();
    }
  }
  // Pages go in a column, first page centred on `at` (or the view) and sized to fit the screen.
  async function renderPdfPages(pdf, nums, at) {
    const first = (await pdf.getPage(nums[0])).getViewport({ scale: 1 });
    const k = Math.min(96 / 72 / view.scale, (H * 0.8) / view.scale / first.height, (W * 0.8) / view.scale / first.width);
    const c = at || toWorld(W / 2, H / 2);
    let y = c.y - (first.height * k) / 2;
    const items = [];
    for (const n of nums) {
      const page = await pdf.getPage(n);
      const vp1 = page.getViewport({ scale: 1 });
      const w = vp1.width * k, h = vp1.height * k;
      // Enough pixels to stay sharp when zoomed in about 2x from here, capped at ~16 MP.
      const rs = Math.min(clamp((h * view.scale * dpr * 2) / vp1.height, 1.5, 4), Math.sqrt(16e6 / (vp1.width * vp1.height)));
      const vp = page.getViewport({ scale: rs });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width);
      cv.height = Math.ceil(vp.height);
      await page.render({ canvas: cv, viewport: vp }).promise;
      const png = cv.toDataURL('image/png'), jpg = cv.toDataURL('image/jpeg', 0.92);
      const src = png.length <= jpg.length ? png : jpg;
      page.cleanup();
      cv.width = cv.height = 0;
      const img = await loadImage(src);
      img._ok = true;
      imageCache.set(src, img);
      items.push({ type: 'image', id: uid(), src, x: c.x - w / 2, y, w, h });
      y += h + 24 / view.scale;
    }
    return items;
  }
  function choosePdfPages(pdf, name) {
    return new Promise((resolve) => {
      const dlg = $('#pdfDialog'), list = $('#pdfPages'), importBtn = $('#pdfImport'), allBtn = $('#pdfAll');
      const total = pdf.numPages, max = Math.min(total, PDF_MAX_PAGES);
      const chosen = new Set([1]), cells = [];
      const ac = new AbortController(), opt = { signal: ac.signal };
      let open = true;
      const sync = () => {
        cells.forEach((b, i) => b.classList.toggle('selected', chosen.has(i + 1)));
        importBtn.disabled = !chosen.size;
        importBtn.textContent = chosen.size ? `Import ${chosen.size} page${chosen.size > 1 ? 's' : ''}` : 'Import';
        allBtn.textContent = chosen.size >= max ? 'Select none' : (total > max ? `Select first ${max}` : 'Select all');
      };
      const finish = (result) => {
        if (!open) return;
        open = false;
        ac.abort();
        dlg.hidden = true;
        list.textContent = '';
        resolve(result);
      };
      $('#pdfTitle').textContent = name;
      $('#pdfInfo').textContent = `${total} pages — tap the ones to place on the canvas` + (total > max ? ` (up to ${max} at a time).` : '.');
      list.textContent = '';
      for (let n = 1; n <= total; n++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pdf-page';
        b.innerHTML = '<span class="thumb"></span><span class="num"></span>';
        b.querySelector('.num').textContent = n;
        b.addEventListener('click', () => {
          if (chosen.has(n)) chosen.delete(n);
          else if (chosen.size >= max) { toast(`Up to ${max} pages at a time`); return; } else chosen.add(n);
          sync();
        }, opt);
        list.appendChild(b);
        cells.push(b);
      }
      importBtn.addEventListener('click', () => finish([...chosen].sort((a, b) => a - b)), opt);
      $('#pdfCancel').addEventListener('click', () => finish(null), opt);
      allBtn.addEventListener('click', () => {
        if (chosen.size >= max) chosen.clear(); else for (let n = 1; n <= max; n++) chosen.add(n);
        sync();
      }, opt);
      dlg.addEventListener('click', (e) => { if (e.target === dlg) finish(null); }, opt);
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(null); }, opt);
      sync();
      dlg.hidden = false;
      // Thumbnails render one at a time in the background.
      (async () => {
        const px = 120 * Math.min(2, window.devicePixelRatio || 1);
        for (let n = 1; n <= total && open; n++) {
          try {
            const page = await pdf.getPage(n);
            const vp = page.getViewport({ scale: px / page.getViewport({ scale: 1 }).width });
            const cv = document.createElement('canvas');
            cv.width = Math.ceil(vp.width);
            cv.height = Math.ceil(vp.height);
            await page.render({ canvas: cv, viewport: vp }).promise;
            if (open) cells[n - 1].querySelector('.thumb').appendChild(cv);
          } catch (err) {
            if (open) console.warn(err);
          }
        }
      })();
    });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function renderExport(transparent) {
    const b = contentBounds();
    if (!b) { toast('Nothing to export yet'); return null; }
    await ensureImagesLoaded();
    const bw = b.x1 - b.x0 + EXPORT_PAD * 2, bh = b.y1 - b.y0 + EXPORT_PAD * 2;
    let k = 2;
    k = Math.min(k, 8192 / bw, 8192 / bh, Math.sqrt(36e6 / (bw * bh)));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bw * k));
    c.height = Math.max(1, Math.round(bh * k));
    const T = { a: k, e: (EXPORT_PAD - b.x0) * k, f: (EXPORT_PAD - b.y0) * k };
    drawScene(c, c.getContext('2d'), T, { bg: !transparent, live: false, cull: null, grid: false });
    requestRender();
    return { canvas: c, k, bw, bh };
  }
  async function exportPNG(transparent) {
    const r = await renderExport(transparent);
    if (!r) return;
    r.canvas.toBlob((blob) => { if (blob) download(blob, `inkboard-${stamp()}.png`); else toast('Export failed'); }, 'image/png');
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  }
  // Data URL for any image item (server assets are fetched), or null if unavailable.
  async function imageDataURL(it) {
    if (it.src) return it.src;
    const img = getImage(imgKey(it));
    if (!img._ok && !img._err) {
      await new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
    }
    return img._blob ? blobToDataURL(img._blob) : null;
  }
  // The document with every image embedded, for files that must stand alone (.inkb, SVG).
  async function portableDoc() {
    const d = serializeDoc();
    for (const l of d.layers) {
      const items = [];
      for (const it of l.items) {
        if (it.type !== 'image' || it.src) { items.push(it); continue; }
        const src = await imageDataURL(it);
        if (!src) continue;
        const { asset, ...rest } = it;
        items.push({ ...rest, src });
      }
      l.items = items;
    }
    return d;
  }
  async function exportSVG() {
    const b = contentBounds();
    if (!b) { toast('Nothing to export yet'); return; }
    const pd = await portableDoc();
    const x = b.x0 - EXPORT_PAD, y = b.y0 - EXPORT_PAD, w = b.x1 - b.x0 + EXPORT_PAD * 2, h = b.y1 - b.y0 + EXPORT_PAD * 2;
    const out = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${fx(x)} ${fx(y)} ${fx(w)} ${fx(h)}" width="${Math.round(w)}" height="${Math.round(h)}">`,
      `<rect x="${fx(x)}" y="${fx(y)}" width="${fx(w)}" height="${fx(h)}" fill="${paper().bg}"/>`,
    ];
    const defs = [];
    for (const l of pd.layers) {
      if (!l.visible) continue;
      out.push(`<g id="${escAttr(`layer-${l.id}`)}" data-name="${escAttr(l.name)}" opacity="${fx(l.opacity)}" style="isolation:isolate">`);
      for (const it of l.items) {
        // Clipped pieces: one nested <g clip-path> per clip polygon (even-odd, like the canvas).
        for (const c of it.clip || []) {
          const cid = `clip${defs.length}`, bb = baseBBox(it);
          const box = c.out ? `M${fx(bb.x0 - 10)} ${fx(bb.y0 - 10)}H${fx(bb.x1 + 10)}V${fx(bb.y1 + 10)}H${fx(bb.x0 - 10)}Z` : '';
          const poly = c.pts.map((p) => `${fx(p[0])} ${fx(p[1])}`).join('L');
          defs.push(`<clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${box}M${poly}Z"/></clipPath>`);
          out.push(`<g clip-path="url(#${cid})">`);
        }
        if (it.type === 'stroke') {
          const br = BRUSHES[it.brush] || BRUSHES.pen;
          out.push(`<path d="${strokeGeom(it).d}" fill="${escAttr(it.color)}" fill-opacity="${fx(it.opacity * br.alpha)}"${br.multiply ? ' style="mix-blend-mode:multiply"' : ''}/>`);
        } else if (it.type === 'fill') {
          out.push(`<path d="${fillGeom(it).d}" fill="${escAttr(it.color)}" fill-opacity="${fx(it.opacity)}"/>`);
        } else {
          const src = escAttr(it.src);
          out.push(`<image href="${src}" xlink:href="${src}" x="${fx(it.x)}" y="${fx(it.y)}" width="${fx(it.w)}" height="${fx(it.h)}" preserveAspectRatio="none"/>`);
        }
        for (let k = 0; k < (it.clip || []).length; k++) out.push('</g>');
      }
      out.push('</g>');
    }
    if (defs.length) out.splice(3, 0, `<defs>${defs.join('')}</defs>`);
    out.push('</svg>');
    download(new Blob([out.join('\n')], { type: 'image/svg+xml' }), `inkboard-${stamp()}.svg`);
  }
  // Minimal single-page PDF that embeds the drawing as a JPEG (DCTDecode).
  function buildPdf(jpeg, pxW, pxH, ptW, ptH) {
    const enc = new TextEncoder(), parts = [], offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
    const content = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
    obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    const xref = len;
    push('xref\n0 6\n0000000000 65535 f \n');
    for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function exportPDF() {
    const r = await renderExport(false);
    if (!r) return;
    const dataUrl = r.canvas.toDataURL('image/jpeg', 0.92);
    const bin = atob(dataUrl.split(',')[1]);
    const jpeg = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
    const ptW = fx(r.bw * 0.75), ptH = fx(r.bh * 0.75);
    download(buildPdf(jpeg, r.canvas.width, r.canvas.height, ptW, ptH), `inkboard-${stamp()}.pdf`);
  }

  async function saveProject() {
    const data = { app: 'inkboard', savedAt: new Date().toISOString(), ...(await portableDoc()) };
    const base = current ? current.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'drawing' : 'drawing';
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${base}-${stamp()}.inkb`);
    toast('Project saved to your downloads');
  }
  // Ctrl+S: in server mode, upload now instead of downloading a file.
  async function syncNow() {
    if (mode !== 'server') { saveProject(); return; }
    if (!current) return;
    await flushCurrent().catch(() => {});
    toast(editSeq === syncedSeq ? 'Saved' : 'Not saved yet. It will upload when the server is reachable.');
  }
  async function openProjectFile(file) {
    try {
      const d = normalizeDoc(JSON.parse(await readAsText(file)));
      if (mode === 'server') {
        const title = file.name.replace(/\.(inkb|json)$/i, '').slice(0, 200) || 'Imported drawing';
        if (await newServerDrawing(current ? current.folder : '', d, title)) toast(`Imported ${file.name} into your library`);
        return;
      }
      commit(() => { doc.layers = d.layers; doc.active = d.active; doc.paper = d.paper; selection.clear(); });
      applyPaper();
      preloadImages();
      fitContent();
      toast(`Opened ${file.name}`);
    } catch (err) {
      console.warn(err);
      toast(`Couldn't open ${file.name} — not an Inkboard project`);
    }
  }
  function newDrawing() {
    if (hasContent() && !confirm('Start a new drawing? (You can undo this.)')) return;
    const fresh = newDoc();
    commit(() => { doc.layers = fresh.layers; doc.active = fresh.active; selection.clear(); });
    view = { x: W / 2, y: H / 2, scale: 1 };
    viewChanged();
  }

  // ---------------------------------------------------------------- layers UI
  function renderLayers() {
    const list = $('#layerList');
    list.textContent = '';
    for (const layer of [...doc.layers].reverse()) {
      const row = document.createElement('div');
      row.className = `layer${layer.id === doc.active ? ' active' : ''}${layer.visible ? '' : ' hidden-layer'}`;
      row.innerHTML = `<button class="eye" title="${layer.visible ? 'Hide' : 'Show'} layer">${icon(layer.visible ? 'eye' : 'eyeOff')}</button><span class="lname"></span><span class="lcount"></span>`;
      row.querySelector('.lname').textContent = layer.name;
      row.querySelector('.lcount').textContent = layer.items.length;
      row.querySelector('.eye').addEventListener('click', (ev) => {
        ev.stopPropagation();
        commit(() => { layer.visible = !layer.visible; });
      });
      row.addEventListener('click', () => {
        if (doc.active === layer.id) return;
        dropPendingCut();
        doc.active = layer.id;
        selection.clear();
        changed({ save: true });
      });
      row.addEventListener('dblclick', () => {
        const name = prompt('Layer name', layer.name);
        if (name && name.trim() && name.trim() !== layer.name) commit(() => { layer.name = name.trim().slice(0, 60); });
      });
      list.appendChild(row);
    }
    const a = activeLayer();
    $('#layerOpacity').value = Math.round(a.opacity * 100);
    $('#layerOpacityOut').textContent = `${Math.round(a.opacity * 100)}%`;
    const idx = doc.layers.indexOf(a);
    $('#layerUp').disabled = idx >= doc.layers.length - 1;
    $('#layerDown').disabled = idx <= 0;
    $('#layerDel').disabled = doc.layers.length <= 1;
  }
  function addLayer() {
    const idx = doc.layers.indexOf(activeLayer());
    const l = newLayer(`Layer ${doc.layers.length + 1}`);
    commit(() => { doc.layers.splice(idx + 1, 0, l); doc.active = l.id; selection.clear(); });
  }
  function duplicateLayer() {
    const src = activeLayer(), idx = doc.layers.indexOf(src);
    const l = { ...newLayer(`${src.name} copy`), opacity: src.opacity, items: src.items.map((it) => ({ ...it, id: uid() })) };
    commit(() => { doc.layers.splice(idx + 1, 0, l); doc.active = l.id; selection.clear(); });
  }
  function deleteLayer() {
    if (doc.layers.length <= 1) return;
    const l = activeLayer(), idx = doc.layers.indexOf(l);
    commit(() => {
      doc.layers.splice(idx, 1);
      doc.active = doc.layers[Math.max(0, idx - 1)].id;
      selection.clear();
    });
    toast(`Deleted “${l.name}” — undo to restore`);
  }
  function moveLayer(dir) {
    const l = activeLayer(), idx = doc.layers.indexOf(l), j = idx + dir;
    if (j < 0 || j >= doc.layers.length) return;
    commit(() => { doc.layers.splice(idx, 1); doc.layers.splice(j, 0, l); });
  }

  // ---------------------------------------------------------------- tools & props UI
  function setTool(t) {
    if (t !== 'select') dropPendingCut();
    prefs.tool = t;
    if (DRAW_TOOLS.includes(t)) prefs.lastBrush = t;
    if (COLOR_TOOLS.includes(t)) prefs.color = prefs.colors[t];
    if (t !== 'select') selection.clear();
    $$('.toolrail [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    if (t !== 'shape') $('#shapeFly').hidden = true;
    if (t !== 'select') $('#selectFly').hidden = true;
    if (t !== 'eraser') $('#eraserFly').hidden = true;
    hidePasteBar();
    syncProps();
    updateCursor();
    savePrefs();
    requestRender();
  }
  function sizeKey() {
    const t = prefs.tool;
    if (DRAW_TOOLS.includes(t) || t === 'eraser') return t;
    if (t === 'shape') return prefs.lastBrush;
    return null;
  }
  function opacityKey() {
    const t = prefs.tool;
    if (DRAW_TOOLS.includes(t) || t === 'fill') return t;
    if (t === 'shape') return prefs.lastBrush;
    return null;
  }
  function syncProps() {
    const sk = sizeKey();
    const ok = !!sk;
    $('#sizeWrap').classList.toggle('disabled', !ok);
    const size = ok ? prefs.sizes[sk] : prefs.sizes[prefs.lastBrush];
    $('#sizeInput').value = size;
    $('#sizeOut').textContent = size;
    const dot = $('#sizeDot');
    const d = clamp(sk === 'marker' ? size * 1.6 : sk === 'pencil' ? size * 0.6 : size, 2, 24);
    dot.style.width = dot.style.height = `${d}px`;
    dot.style.background = sk === 'eraser' ? 'transparent' : prefs.color;
    dot.style.border = sk === 'eraser' ? '1.5px solid var(--muted)' : '0';
    const ok2 = opacityKey();
    $('#opacityWrap').classList.toggle('disabled', !ok2);
    const op = ok2 ? prefs.opacity[ok2] : 100;
    $('#opacityInput').value = op;
    $('#opacityOut').textContent = `${op}%`;
    const stk = DRAW_TOOLS.includes(prefs.tool) ? prefs.tool : null;
    $('#straightWrap').classList.toggle('disabled', !stk);
    const st = stk ? prefs.straight[stk] : 0;
    $('#straightInput').value = st;
    $('#straightOut').textContent = `${st}%`;
    $$('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.color.toLowerCase() === prefs.color.toLowerCase()));
    $('#colorInput').value = /^#[0-9a-f]{6}$/i.test(prefs.color) ? prefs.color : '#1f2430';
    for (const t of COLOR_TOOLS) $(`.toolrail [data-tool="${t}"] .tool-color`).style.background = prefs.colors[t];
    $$('#shapeFly [data-shape]').forEach((b) => b.classList.toggle('active', b.dataset.shape === prefs.shape));
    $$('#selectFly [data-select]').forEach((b) => b.classList.toggle('active', b.dataset.select === prefs.selectMode));
    $$('#selectFly [data-selcut]').forEach((b) => b.classList.toggle('active', b.dataset.selcut === prefs.selectCut));
    $$('#eraserFly [data-erase]').forEach((b) => b.classList.toggle('active', b.dataset.erase === prefs.eraseMode));
    updateCursor();
  }
  function makeSwatch(c, saved) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c;
    b.style.background = c;
    b.title = saved ? `${c} (long-press or right-click to remove)` : c;
    b.addEventListener('click', () => setColor(c, true));
    if (saved) {
      let timer = null;
      const cancel = () => clearTimeout(timer);
      b.addEventListener('pointerdown', () => { timer = setTimeout(() => removeSavedColor(c), 550); });
      b.addEventListener('pointerup', cancel);
      b.addEventListener('pointerleave', cancel);
      b.addEventListener('pointercancel', cancel);
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel(); removeSavedColor(c); });
    }
    return b;
  }
  function renderSavedColors() {
    const box = $('#savedSwatches');
    box.textContent = '';
    for (const c of prefs.savedColors) box.appendChild(makeSwatch(c, true));
    box.hidden = !prefs.savedColors.length;
    syncProps();
  }
  function saveCurrentColor() {
    const c = prefs.color.toLowerCase();
    if (prefs.savedColors.includes(c) || SWATCHES.includes(c)) { toast('That colour is already in your palette'); return; }
    prefs.savedColors = prefs.savedColors.concat(c).slice(-MAX_SAVED_COLORS);
    savePrefs();
    renderSavedColors();
    toast('Colour saved. Long-press or right-click it to remove.');
  }
  function removeSavedColor(c) {
    if (!prefs.savedColors.includes(c)) return;
    prefs.savedColors = prefs.savedColors.filter((x) => x !== c);
    savePrefs();
    renderSavedColors();
    toast('Colour removed');
  }
  function setColor(c, commitRecolor) {
    prefs.color = c;
    if (COLOR_TOOLS.includes(prefs.tool)) prefs.colors[prefs.tool] = c;
    savePrefs();
    syncProps();
    if (commitRecolor && prefs.tool === 'select' && selection.size) recolorSelection(c);
  }
  function changeSize(dir) {
    const sk = sizeKey();
    if (!sk) return;
    const v = prefs.sizes[sk];
    prefs.sizes[sk] = clamp(Math.round(dir > 0 ? Math.max(v + 1, v * 1.2) : Math.min(v - 1, v / 1.2)), 1, 100);
    savePrefs();
    syncProps();
    requestRender();
  }
  function updateCursor() {
    const t = prefs.tool;
    canvas.style.cursor = spaceDown || t === 'hand' ? 'grab' : t === 'select' ? 'default' : t === 'eraser' ? 'none' : dotCursor();
  }
  // Drawing cursor: a dot in the current colour, as wide as the brush but kept between 6 and 10 px, ringed so it shows on any paper.
  function dotCursor() {
    const sk = sizeKey();
    const d = clamp(sk ? prefs.sizes[sk] : 6, 6, 10);
    const color = /^#[0-9a-f]{6}$/i.test(prefs.color) ? prefs.color : '#1f2430';
    const s = d + 4, c = s / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
      `<circle cx="${c}" cy="${c}" r="${d / 2 + 1.5}" fill="rgba(0,0,0,0.35)"/>` +
      `<circle cx="${c}" cy="${c}" r="${d / 2 + 0.75}" fill="#fff"/>` +
      `<circle cx="${c}" cy="${c}" r="${d / 2}" fill="${color}"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.floor(c)} ${Math.floor(c)}, crosshair`;
  }
  function cycleGrid() {
    prefs.grid = GRIDS[(GRIDS.indexOf(prefs.grid) + 1) % GRIDS.length];
    savePrefs();
    syncGridBtn();
    toast(`Grid: ${GRID_NAMES[prefs.grid]}`);
    requestRender();
  }
  function syncGridBtn() {
    const b = $('#gridBtn');
    b.classList.toggle('on', prefs.grid !== 'none');
    b.title = `Grid: ${GRID_NAMES[prefs.grid]} (G)`;
  }
  function applyPaper() {
    const p = paper();
    document.documentElement.style.setProperty('--paper', p.bg);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
    requestRender();
  }
  function cyclePaper() {
    const i = PAPERS.findIndex((p) => p.id === doc.paper);
    doc.paper = PAPERS[(i + 1) % PAPERS.length].id;
    applyPaper();
    toast(`Paper: ${paper().name}`);
    scheduleSave();
  }
  function setPencilOnly(on) {
    prefs.pencilOnly = on;
    savePrefs();
    $('#pencilBtn').classList.toggle('on', on);
  }

  let toastTimer = null;
  function toast(msg, ms = 2400) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function closeMenus() {
    $('#fileMenu').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    $('#shapeFly').hidden = true;
    $('#selectFly').hidden = true;
    $('#eraserFly').hidden = true;
  }

  // ---------------------------------------------------------------- wiring
  function bindUI() {
    $$('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    for (const t of COLOR_TOOLS) $(`.toolrail [data-tool="${t}"]`).insertAdjacentHTML('beforeend', '<span class="tool-color"></span>');

    const sw = $('#swatches');
    for (const c of SWATCHES) sw.appendChild(makeSwatch(c, false));
    renderSavedColors();
    $('#saveColorBtn').addEventListener('click', saveCurrentColor);
    $('#colorInput').addEventListener('input', (e) => setColor(e.target.value, false));
    $('#colorInput').addEventListener('change', (e) => setColor(e.target.value, true));
    $('#sizeInput').addEventListener('input', (e) => {
      const sk = sizeKey();
      if (!sk) return;
      prefs.sizes[sk] = +e.target.value;
      savePrefs();
      syncProps();
      requestRender();
    });
    $('#opacityInput').addEventListener('input', (e) => {
      const ok = opacityKey();
      if (!ok) return;
      prefs.opacity[ok] = +e.target.value;
      savePrefs();
      syncProps();
    });
    $('#straightInput').addEventListener('input', (e) => {
      if (!DRAW_TOOLS.includes(prefs.tool)) return;
      prefs.straight[prefs.tool] = +e.target.value;
      savePrefs();
      syncProps();
    });

    // Tapping the active shape or select tool again opens its options flyout.
    const FLYOUTS = { shape: '#shapeFly', select: '#selectFly', eraser: '#eraserFly' };
    $$('.toolrail [data-tool]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.tool;
      if (FLYOUTS[t] && prefs.tool === t) {
        const fly = $(FLYOUTS[t]);
        const r = b.getBoundingClientRect();
        fly.style.left = `${r.right + 10}px`;
        fly.style.top = `${r.top - 2}px`;
        fly.hidden = !fly.hidden;
        return;
      }
      setTool(t);
    }));
    $$('#shapeFly [data-shape]').forEach((b) => b.addEventListener('click', () => {
      prefs.shape = b.dataset.shape;
      savePrefs();
      syncProps();
      $('#shapeFly').hidden = true;
    }));
    $$('#selectFly [data-select]').forEach((b) => b.addEventListener('click', () => {
      prefs.selectMode = b.dataset.select;
      savePrefs();
      syncProps();
    }));
    $$('#selectFly [data-selcut]').forEach((b) => b.addEventListener('click', () => {
      prefs.selectCut = b.dataset.selcut;
      savePrefs();
      syncProps();
      toast(prefs.selectCut === 'whole' ? 'Selecting whole objects' : 'Selection cuts through objects');
    }));
    $$('#eraserFly [data-erase]').forEach((b) => b.addEventListener('click', () => {
      prefs.eraseMode = b.dataset.erase;
      savePrefs();
      syncProps();
      $('#eraserFly').hidden = true;
      toast(prefs.eraseMode === 'whole' ? 'Eraser removes whole strokes and fills' : 'Eraser erases only what it touches');
    }));

    $('#menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = $('#fileMenu');
      m.hidden = !m.hidden;
      $('#menuBtn').setAttribute('aria-expanded', String(!m.hidden));
    });
    $('#fileMenu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      closeMenus();
      const a = b.dataset.action;
      if (a === 'new') { if (mode === 'server') newServerDrawing(current ? current.folder : ''); else newDrawing(); } else if (a === 'library') showLibrary();
      else if (a === 'logout') signOut();
      else if (a === 'open') $('#openInput').click();
      else if (a === 'save') saveProject();
      else if (a === 'import') $('#imageInput').click();
      else if (a === 'png') exportPNG(false);
      else if (a === 'png-t') exportPNG(true);
      else if (a === 'svg') exportSVG();
      else if (a === 'pdf') exportPDF();
      else if (a === 'help') $('#helpDialog').hidden = false;
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#fileMenu, #menuBtn, .flyout, .toolrail')) closeMenus();
      if (!e.target.closest('#pasteBar')) hidePasteBar();
    });
    $('#helpClose').addEventListener('click', () => { $('#helpDialog').hidden = true; });
    $('#helpDialog').addEventListener('click', (e) => { if (e.target.id === 'helpDialog') e.currentTarget.hidden = true; });

    $('#openInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openProjectFile(f); e.target.value = ''; });
    $('#imageInput').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });

    $('#libraryBtn').addEventListener('click', showLibrary);
    $('#insertBtn').addEventListener('click', () => $('#imageInput').click());
    $('#docTitle').addEventListener('click', renameCurrent);
    $('#moveCancel').addEventListener('click', () => { $('#moveDialog').hidden = true; });
    $('#undoBtn').addEventListener('click', undo);
    $('#redoBtn').addEventListener('click', redo);
    $('#zoomInBtn').addEventListener('click', () => zoomAt(W / 2, H / 2, 1.25));
    $('#zoomOutBtn').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.8));
    $('#zoomLabel').addEventListener('click', () => zoomTo(1));
    $('#fitBtn').addEventListener('click', fitContent);
    $('#gridBtn').addEventListener('click', cycleGrid);
    $('#paperBtn').addEventListener('click', cyclePaper);
    $('#pencilBtn').addEventListener('click', () => {
      setPencilOnly(!prefs.pencilOnly);
      toast(prefs.pencilOnly ? 'Stylus only: fingers pan & zoom' : 'Fingers draw too');
    });
    $('#layersBtn').addEventListener('click', () => {
      const p = $('#layersPanel');
      p.hidden = !p.hidden;
      $('#layersBtn').classList.toggle('on', !p.hidden);
    });

    $('#layerAdd').addEventListener('click', addLayer);
    $('#layerDup').addEventListener('click', duplicateLayer);
    $('#layerDel').addEventListener('click', deleteLayer);
    $('#layerUp').addEventListener('click', () => moveLayer(1));
    $('#layerDown').addEventListener('click', () => moveLayer(-1));
    const lo = $('#layerOpacity');
    lo.addEventListener('input', () => {
      if (!pendingLayerSnap) pendingLayerSnap = snapshot();
      activeLayer().opacity = lo.value / 100;
      $('#layerOpacityOut').textContent = `${lo.value}%`;
      requestRender();
    });
    lo.addEventListener('change', () => {
      if (pendingLayerSnap) { pushHistory(pendingLayerSnap); pendingLayerSnap = null; }
      changed();
    });

    $('#selBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sel]');
      if (!b) return;
      const a = b.dataset.sel;
      if (a === 'delete') deleteSelection();
      else if (a === 'copy' || a === 'cut') {
        copySelection();
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(clipText()).catch(() => { /* in-app clipboard still works */ });
        if (a === 'cut') deleteSelection();
        toast(a === 'cut' ? 'Cut. Tap empty canvas to paste.' : 'Copied. Tap empty canvas to paste.');
      } else if (a === 'dup') duplicateSelection();
      else if (a === 'front') reorderSelection(true);
      else if (a === 'back') reorderSelection(false);
    });
    $('#pasteBar').addEventListener('click', () => { const at = pasteAt; hidePasteBar(); pasteClip(at); });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', (e) => { if (!gesture && e.pointerType !== 'touch') { hover = null; requestRender(); } });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
      // A mouse-wheel notch is ~100px; cap each event so one notch zooms ~10%. Trackpad pinches send small deltas and stay smooth.
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-clamp(e.deltaY * unit, -10, 10) * 0.01));
      else { view.x -= e.deltaX * unit; view.y -= e.deltaY * unit; viewChanged(); }
    }, { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => { if (e.target === canvas) e.preventDefault(); });

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; updateCursor(); requestRender(); } });
    window.addEventListener('blur', () => { spaceDown = false; lastBlur = Date.now(); updateCursor(); });
    window.addEventListener('resize', resize);
    window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      if (saveTimer) saveNow();
      if (mode === 'server' && current && editSeq !== syncedSeq) pushToServer();
    });
    window.addEventListener('online', () => {
      retryFailedImages();
      if (mode === 'server' && current && editSeq !== syncedSeq) { retryDelay = 0; schedulePush(0); }
    });

    // drag & drop + paste
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('#dropHint').hidden = false; });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropHint').hidden = true; });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      $('#dropHint').hidden = true;
      const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
      const proj = files.find((f) => /\.(inkb|json)$/i.test(f.name));
      if (proj) openProjectFile(proj); else importFiles(files, toWorld(e.clientX, e.clientY));
    });

    // Clipboard events. If our own copy is newer than the last time the window lost
    // focus, nothing else can have been copied since, so it wins over the system clipboard.
    const onCopyCut = (e, cut) => {
      clipEventSeen = true;
      if (isTextField(e.target) || overlayOpen() || !selection.size) return;
      e.preventDefault();
      copySelection();
      try { e.clipboardData.setData('text/plain', clipText()); } catch (_) { /* in-app clipboard still works */ }
      if (cut) deleteSelection();
    };
    document.addEventListener('copy', (e) => onCopyCut(e, false));
    document.addEventListener('cut', (e) => onCopyCut(e, true));
    document.addEventListener('paste', (e) => {
      clipEventSeen = true;
      if (isTextField(e.target) || overlayOpen()) return;
      e.preventDefault();
      const dt = e.clipboardData;
      if (clip && clip.time > lastBlur) { pasteClip(); return; }
      const items = parseClipText(dt && dt.getData('text/plain'));
      if (items) { pasteItems(items); return; }
      const files = [...((dt && dt.files) || [])];
      if (files.length) { importFiles(files); return; }
      if (clip) pasteClip();
    });
  }

  function isTextField(el) {
    return !!(el && el.matches && el.matches('input:not([type=range]):not([type=color]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]), textarea, select'));
  }
  // Full-screen panels and dialogs that take over the keyboard and clipboard.
  const overlayOpen = () => ['#library', '#login', '#conflictDialog', '#moveDialog', '#pdfDialog'].some((s) => !$(s).hidden);

  // Set by the copy/cut/paste events. Some browsers skip those events when nothing on the
  // page is text-selected, so the keyboard shortcuts fall back to the in-app clipboard.
  let clipEventSeen = false;
  function onKey(e) {
    if (isTextField(e.target) || overlayOpen()) return;
    if (!$('#helpDialog').hidden) { if (e.key === 'Escape') $('#helpDialog').hidden = true; return; }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod) {
      if (k === 'c' || k === 'x' || k === 'v') {
        clipEventSeen = false;
        setTimeout(() => {
          if (clipEventSeen) return;
          if (k === 'c') copySelection(); else if (k === 'x') cutSelection(); else pasteClip();
        }, 50);
        return;
      }
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } else if (k === 'y') { e.preventDefault(); redo(); } else if (k === 's') { e.preventDefault(); syncNow(); } else if (k === 'o') { e.preventDefault(); $('#openInput').click(); } else if (k === 'd') { e.preventDefault(); duplicateSelection(); } else if (k === 'a') { e.preventDefault(); selectAll(); }
      return;
    }
    if (e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; updateCursor(); requestRender(); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'Escape') { abortGesture(); dropPendingCut(); selection.clear(); closeMenus(); hidePasteBar(); requestRender(); return; }
    const map = { b: 'pen', p: 'pencil', m: 'marker', e: 'eraser', l: 'shape', f: 'fill', v: 'select', h: 'hand' };
    if (map[k]) { setTool(map[k]); return; }
    if (k === 'i') { $('#imageInput').click(); return; }
    if (k === '[') changeSize(-1);
    else if (k === ']') changeSize(1);
    else if (k === 'g') cycleGrid();
    else if (k === '0') zoomTo(1);
    else if (k === '1') fitContent();
    else if (k === '=' || k === '+') zoomAt(W / 2, H / 2, 1.25);
    else if (k === '-') zoomAt(W / 2, H / 2, 0.8);
  }

  function resize() {
    const oldW = W, oldH = H;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    if (oldW && doc) { view.x += (W - oldW) / 2; view.y += (H - oldH) / 2; }
    requestRender();
  }

  async function init() {
    resize();
    bindUI();
    const detected = await InkAPI.detect();
    if (detected === 'local') { await initLocal(); return; }
    mode = 'server';
    document.body.classList.add('server');
    doc = newDoc();
    view = { x: W / 2, y: H / 2, scale: 1 };
    startUI();
    InkLibrary.init({
      icon, toast, signOut,
      userName: () => (InkAPI.user ? InkAPI.user.name || InkAPI.user.username || InkAPI.user.email : ''),
      currentId: () => (current ? current.id : null),
      openDrawing: (id) => openDrawing(id),
      newDrawing: (folder) => newServerDrawing(folder),
      renamed: (id, title) => { if (current && current.id === id) { current.title = title; updateTitle(); } },
      deleted: (id) => {
        DB.del(draftPrefix() + id).catch(() => {});
        if (current && current.id === id) closeCurrent();
      },
      checkCurrent: async () => {
        if (!current) return;
        try { await InkAPI.getDrawing(current.id); } catch (err) { if (err.status === 404) closeCurrent(); }
      },
    });
    await startServer(detected);
  }

  // Shared start-up once `doc` and `view` exist.
  function startUI() {
    applyPaper();
    setTool(prefs.tool);
    syncGridBtn();
    $('#pencilBtn').classList.toggle('on', prefs.pencilOnly);
    preloadImages();
    viewChanged();
    changed({ save: false });
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
    }
    window.__inkboard = {
      get doc() { return doc; }, get view() { return view; }, get selection() { return [...selection]; },
      get mode() { return mode; }, get current() { return current && { ...current, synced: editSeq === syncedSeq }; },
      exportSVG, renderExport, buildPdf, flush: flushCurrent,
    };
  }

  // No backend: a single drawing autosaved in this browser.
  async function initLocal() {
    let loaded = null, raw = null, warning = '';
    try { raw = await DB.get('doc'); } catch (err) {
      console.warn('Could not read saved drawing', err);
      autosaveOff = true;
      warning = 'Couldn’t open browser storage, so autosave is off. Use Save project to keep your work.';
    }
    if (raw) {
      try { loaded = normalizeDoc(raw); } catch (err) {
        console.warn('Saved drawing is unreadable', err);
        // Keep the unreadable data under its own key before autosave replaces `doc`.
        try {
          await DB.set(`doc-unreadable-${Date.now()}`, raw);
          warning = 'Your saved drawing couldn’t be read. A backup copy was kept in browser storage.';
        } catch (err2) {
          console.warn('Could not back up unreadable drawing', err2);
          autosaveOff = true;
          warning = 'Your saved drawing couldn’t be read, so autosave is off to protect it.';
        }
      }
    }
    doc = loaded || newDoc();
    let v = null;
    try { v = JSON.parse(localStorage.getItem('inkboard.view') || 'null'); } catch (_) { /* ignore */ }
    if (loaded && v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.scale)) {
      view = { x: v.x, y: v.y, scale: clamp(v.scale, MIN_SCALE, MAX_SCALE) };
    } else view = { x: W / 2, y: H / 2, scale: 1 };
    startUI();
    setStatus(autosaveOff ? 'Autosave off' : loaded ? 'Restored' : '');
    if (warning) toast(warning, 8000);
  }

  init();
})();
