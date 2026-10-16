import { geoMercator, geoPath } from 'd3-geo';
export const R = 6378137, SHEET = { w: 36 * 72, h: 24 * 72 }; // sheet in points (1 in = 72 pt)
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const f1 = v => Math.round(v * 10) / 10;
/** Build a projection mapping the exported EPSG:3857 view window exactly onto a W x H point box (same as the PDF axes). */
export function viewProjection(view, W, H) {
  const [x0, x1] = view.x, [y0, y1] = view.y, k = W / (x1 - x0);
  const proj = geoMercator().scale(R * k).translate([-x0 * k, y1 * k]);
  // Project + simplify in page space (DP 0.15 pt ≈ 0.002 in: invisible at any print/screen size) and drop
  // geometries lying entirely off-view. Whole partially-visible lines are kept so dash phases don't move.
  const TOL = 0.15, PAD = 60;
  const ring = (cs: [number, number][], close = false) => {
    const P = simplifyPts(cs.map((q) => proj(q) as [number, number]), TOL);
    return 'M' + P.map((q) => `${f1(q[0])},${f1(q[1])}`).join('L') + (close ? 'Z' : '');
  };
  const vis = (cs: [number, number][]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of cs) { const [x, y] = proj(q) as [number, number]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return x1 >= -PAD && y1 >= -PAD && x0 <= W + PAD && y0 <= H + PAD;
  };
  const path = (f: { geometry: { type: string; coordinates: any } }) => {
    const g = f.geometry, c = g.coordinates;
    switch (g.type) {
      case 'LineString': return vis(c) ? ring(c) : '';
      case 'MultiLineString': return c.filter(vis).map((l) => ring(l)).join('');
      case 'Polygon': return vis(c[0]) ? c.map((r) => ring(r, true)).join('') : '';
      case 'MultiPolygon': return c.filter((p) => vis(p[0])).map((p) => p.map((r) => ring(r, true)).join('')).join('');
      default: return geoPath(proj).digits(1)(f as any) || '';
    }
  };
  /** Projected page-space polylines of a line feature (raw, unsimplified). */
  const lines = (f: { geometry: { type: string; coordinates: any } }): [number, number][][] => {
    const g = f.geometry, ls = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    return ls.filter(vis).map((l) => l.map((q) => proj(q) as [number, number]));
  };
  return { proj, path, lines, W, H, ppm: k, p: (ll) => proj(ll) };
}
export const ptsAttr = (P) => P.map(q => `${f1(q[0])},${f1(q[1])}`).join(' ');
export const lineD = (P) => 'M' + P.map(q => `${f1(q[0])},${f1(q[1])}`).join('L');
// matplotlib scales dash patterns by linewidth
export const dash = (pat, lw) => pat.map(v => f1(v * lw)).join(' ');
export const STYLE = {
  // on-course access patterns (pt, from make.py)
  on: {
    foot: { lw: 6, pat: [0.58, 0.25] }, foot_bike: { lw: 6, pat: [4, 0.6, 1.6, 0.6] },
    unpaved: { lw: 6, pat: [11.7, 0.83] }, '4x4': { lw: 6, pat: [7.3, 0.7], rail: 1.4 },
  },
  off: {
    unpaved: { lw: 3, pat: [14, 1.0], color: '#9b968e' }, foot_bike: { lw: 3, pat: [4, 0.6, 1.6, 0.6], color: '#9b968e' },
    '4x4': { lw: 3, pat: [8, 0.8], color: '#8f8a82', rail: 0.7 },
  },
};
// ---- shared marker symbols: one definition used by every map, the legend, strips and profile ----
// Base size = matplotlib s=2000 (r ≈ 22.4 pt); <use> elements scale it about the exact coordinate.
const BASE_S = 2000, BR = Math.sqrt(BASE_S) / 2;
export function markerDefs(colors: Record<string, string>) {
  const br = Math.sqrt(BASE_S * 0.33) / 2, pl = Math.sqrt(BASE_S * 0.11) / 2, t = pl * 0.36, d = BR * 0.95;
  const plus = `M${f1(d - pl)},${f1(-d - t)}h${f1(pl - t)}v${f1(-(pl - t))}h${f1(2 * t)}v${f1(pl - t)}h${f1(pl - t)}v${f1(2 * t)}h${f1(-(pl - t))}v${f1(pl - t)}h${f1(-2 * t)}v${f1(-(pl - t))}h${f1(-(pl - t))}z`;
  return `<svg class="defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>`
    + `<symbol id="mk-dot" overflow="visible"><circle r="${f1(BR)}" fill="${colors.ink}" stroke="${colors.cream}" stroke-width="2.9"/></symbol>`
    + `<symbol id="mk-ring" overflow="visible"><circle r="${f1(Math.sqrt(BASE_S * 1.8) / 2)}" fill="#fff" stroke="${colors.ring}" stroke-width="6.25"/></symbol>`
    + `<symbol id="mk-badge" overflow="visible"><circle cx="${f1(d)}" cy="${f1(-d)}" r="${f1(br)}" fill="${colors.aid_red}" stroke="#fff" stroke-width="1.54"/><path d="${plus}" fill="#fff"/></symbol>`
    + `<symbol id="mk-poi" overflow="visible"><circle r="10.2" fill="#fff" stroke="${colors.ink}" stroke-width="4"/></symbol>`
    + `</defs></svg>`;
}
/** station marker centred exactly on (x, y): optional spectator ring, dot, number, aid badge — all from the shared symbols */
export function station(x, y, lab, spec, { s = 2000, fs = 28, badge = true, colors = null as any, numberText = true, link = true }) {
  const k = Math.sqrt(s / BASE_S), sc = `transform="scale(${k.toFixed(4)})"`;
  let out = `<g class="marker"${lab ? ` data-station="${esc(lab)}"` : ''} data-ax="0" data-ay="0" transform="translate(${f1(x)} ${f1(y)})">`;
  if (spec) out += `<use href="#mk-ring" ${sc}/>`;
  out += `<use href="#mk-dot" ${sc}/>`;
  if (numberText && lab) out += `<text class="stnum" font-size="${lab.length === 1 ? fs : f1(fs * 0.6)}" text-anchor="middle" dominant-baseline="central">${esc(lab)}</text>`;
  if (badge) out += `<use href="#mk-badge" ${sc}/>`;
  out += '</g>';
  // PDF: the number graphic is an internal link to that station's print page (id station-<key>); on the web the click opens the lightbox (app.ts)
  return link && lab ? `<a class="stjump" href="#station-${encodeURIComponent(lab)}">${out}</a>` : out;
}
/** POI dot (Rincon, Sauceda, …) centred on (x, y) */
export const poiDot = (x: number, y: number, scale = 1) => `<use class="marker" href="#mk-poi" transform="translate(${f1(x)} ${f1(y)}) scale(${scale})"/>`;
/** Text block centred on (x,y) (matplotlib bbox centre), honouring ha for multi-line alignment. */
export function textBlock(x, y, p, cls = '') {
  const lines = String(p.text).split('\n'), fs = p.fs, lh = fs * (p.linespacing || 1.2) * 1.0;
  let anchor = 'middle', tx = x;
  if (p.ha === 'left' && lines.length > 1) { anchor = 'start'; tx = x - p.width_pt / 2; }
  if (p.ha === 'right' && lines.length > 1) { anchor = 'end'; tx = x + p.width_pt / 2; }
  const fam = /serif/i.test(p.family) && !/sans/i.test(p.family) ? 'serif' : 'sans';
  const halo = p.halo ? ` stroke="${p.halo.color}" stroke-width="${p.halo.width}" paint-order="stroke" stroke-linejoin="round"` : '';
  const op = p.alpha != null ? ` opacity="${p.alpha}"` : '';
  const y0 = y - (lines.length - 1) * lh / 2;
  const tsp = lines.map((l, i) => `<tspan x="${f1(tx)}" y="${f1(y0 + i * lh)}">${esc(l)}</tspan>`).join('');
  const rot = p.rotation ? ` transform="rotate(${-p.rotation} ${f1(x)} ${f1(y)})"` : '';
  return `<text class="${cls} f-${fam}" font-size="${fs}" fill="${p.color}" font-style="${p.style}" font-weight="${/bold|semibold|600|700/.test(p.weight) ? (p.weight === 'semibold' ? 600 : 700) : 400}" text-anchor="${anchor}" dominant-baseline="central"${halo}${op}${rot}>${tsp}</text>`;
}

/** Douglas–Peucker on projected points */
export function simplifyPts(P: [number, number][], tol: number): [number, number][] {
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st: [number, number][] = [[0, P.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!; let dm = -1, im = -1; const ax = P[a][0], ay = P[a][1], dx = P[b][0] - ax, dy = P[b][1] - ay, l2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { let t = l2 ? ((P[i][0] - ax) * dx + (P[i][1] - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(P[i][0] - ax - t * dx, P[i][1] - ay - t * dy); if (d > dm) { dm = d; im = i; } }
    if (dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); }
  }
  return P.filter((_, i) => keep[i]);
}

/** THE leader-line style — every pointer line on the site (station/POI labels, profile callouts, …) uses leaderLine(). */
export const LEADER = { color: '#333333', width: 1.8, gap: 3, minLen: 6 };
/** straight leader from point a to point b; each end stops `gap` outside an optional circle of radius ra / rb */
export function leaderLine(ax: number, ay: number, bx: number, by: number, ra = 0, rb = 0): string {
  const d = Math.hypot(bx - ax, by - ay), L = LEADER;
  if (!d || d - ra - rb - 2 * L.gap < L.minLen) return '';
  const ux = (bx - ax) / d, uy = (by - ay) / d, s0 = ra + L.gap, s1 = rb + L.gap;
  return `<path class="leader" d="M${f1(ax + ux * s0)},${f1(ay + uy * s0)}L${f1(bx - ux * s1)},${f1(by - uy * s1)}" fill="none" stroke="${L.color}" stroke-width="${L.width}" stroke-linecap="round"/>`;
}
/** Chaikin corner-cutting (endpoints kept). */
export function chaikin(P: [number, number][], iters = 2): [number, number][] {
  for (let k = 0; k < iters && P.length > 2; k++) {
    const Q: [number, number][] = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const [a, b] = [P[i], P[i + 1]];
      if (i > 0) Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (i < P.length - 2) Q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    Q.push(P[P.length - 1]); P = Q;
  }
  return P;
}
/** Merge a set of polylines (page space) into maximal continuous chains by joining shared endpoints, dropping exact duplicate lines. */
export function mergeChains(L: [number, number][][], eps = 0.5): [number, number][][] {
  const key = (q: [number, number]) => `${Math.round(q[0] / eps)},${Math.round(q[1] / eps)}`;
  const seen = new Set<string>(); let lines = L.filter(l => l.length > 1).filter(l => { const k = l.map(key).join(';'), r = [...l].reverse().map(key).join(';'); if (seen.has(k) || seen.has(r)) return false; seen.add(k); return true; });
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < lines.length; i++) for (let j = 0; j < lines.length; j++) {
      if (i === j) continue;
      const a = lines[i], b = lines[j], near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
      let m: [number, number][] | null = null;
      if (near(a[a.length - 1], b[0])) m = a.concat(b.slice(1));
      else if (near(a[a.length - 1], b[b.length - 1])) m = a.concat([...b].reverse().slice(1));
      else if (near(a[0], b[b.length - 1])) m = b.concat(a.slice(1));
      else if (near(a[0], b[0])) m = [...b].reverse().concat(a.slice(1));
      if (m) { lines = lines.filter((_, k) => k !== i && k !== j).concat([m]); merged = true; break outer; }
    }
  }
  return lines;
}

/** wrap SVG content in a Google Maps link to an exact [lon, lat] (new tab; also a live link in the PDF) */
// where: a calendar place name / address (preferred) or [lon, lat]
export const gmapLink = (where: [number, number] | string, title: string, inner: string) => `<a class="gmap" href="https://www.google.com/maps/search/?api=1&amp;query=${typeof where === "string" ? esc(encodeURIComponent(where)) : `${where[1].toFixed(6)},${where[0].toFixed(6)}`}" target="_blank" rel="noopener" style="cursor:pointer" aria-label="${esc(title)} on Google Maps"><title>${esc(title)} · open in Google Maps</title>${inner}</a>`;
/** checkered finish flag (same pole / size as the start flag): pole from (x, base) up to top, 14×10 flag in a 4×3 checker */
export const finishFlag = (x: number, base: number, top: number, ink = '#2a2a2a') => {
  let s = `<path d="M${f1(x)},${f1(base)}V${f1(top)}" stroke="${ink}" stroke-width="2"/><rect x="${f1(x)}" y="${f1(top)}" width="14" height="10.5" fill="#fff" stroke="${ink}" stroke-width="1"/>`;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) s += `<rect x="${f1(x + i * 3.5)}" y="${f1(top + j * 3.5)}" width="3.5" height="3.5" fill="${ink}"/>`;
  return s;
};
/** 4x4 track as a tire tread (Erik's reference): two rows of slanted blocks forming chevrons along the line, a small gap down the middle.
 *  lines = polylines in page units; w = tread width; one chevron every `gap` units. */
export function tireTrack(lines: number[][][], color: string, w = 7, gap = 4.2, casing?: string) {
  const hw = w / 2, mid = w * 0.12, dep = w * 0.34, sw = Math.max(0.9, w * 0.32);
  let chev = '', cas = '';
  for (const l of lines) { let acc = gap / 2;
    for (let i = 1; i < l.length; i++) { const [ax, ay] = l[i - 1], [bx, by] = l[i], L = Math.hypot(bx - ax, by - ay); if (!L) continue; const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
      while (acc <= L) { const px = ax + tx * acc, py = ay + ty * acc;
        for (const sgn of [1, -1]) chev += `M${f1(px - tx * dep + sgn * nx * hw)},${f1(py - ty * dep + sgn * ny * hw)}L${f1(px - tx * dep * (mid / hw) + sgn * nx * mid)},${f1(py - ty * dep * (mid / hw) + sgn * ny * mid)}`;
        acc += gap; }
      acc -= L; } }
  if (casing) cas = `<path d="${lines.filter((l) => l.length > 1).map((l) => 'M' + l.map((q) => `${f1(q[0])},${f1(q[1])}`).join('L')).join('')}" class="ln" stroke="${casing}" stroke-width="${f1(w + 4)}"/>`;
  return chev ? cas + `<path d="${chev}" fill="none" stroke="${color}" stroke-width="${f1(sw)}" stroke-linecap="butt"/>` : '';
}

/** offset a polyline sideways by o (page units; miter-averaged normals) */
export function offsetLine(l: number[][], o: number): number[][] {
  const n = l.length, N = (i: number) => { const a = l[Math.max(0, i - 1)], b = l[Math.min(n - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
  return l.map((p, i) => { const [nx, ny] = N(i); return [p[0] + nx * o, p[1] + ny * o]; });
}
/** unpaved double track: two thin dashed lines with an EMPTY (transparent) gap between them, so the background / race band shows through */
export function doubleTrack(lines: number[][][], color: string, w: number, rail: number, pat: number[]) {
  const t = (w - rail) / 2, o = rail / 2 + t / 2; let d = '';
  for (const l of lines) if (l.length > 1) for (const s of [o, -o]) d += 'M' + offsetLine(l, s).map((q) => `${f1(q[0])},${f1(q[1])}`).join('L');
  return d ? `<path d="${d}" class="ln" fill="none" stroke="${color}" stroke-width="${f1(t)}" stroke-dasharray="${dash(pat, w)}" stroke-linecap="butt"/>` : '';
}
/** race-colour band opacity: SSOT for the fill under each race's elevation profile and the route bands on the maps (they match) */
export const BAND_OP = 0.15;
/** map route bands: SOLID light tint = race colour blended over white at BAND_TINT (reads on the topo; same hue family as the elevation fill) */
export const BAND_TINT = 0.45;
export const tint = (hex: string, a: number) => { const h = hex.replace('#', ''), v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return '#' + v.map((x) => Math.round(255 + (x - 255) * a).toString(16).padStart(2, '0')).join(''); };
