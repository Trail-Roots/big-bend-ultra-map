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
  return { proj, path, W, H, ppm: k, p: (ll) => proj(ll) };
}
export const ptsAttr = (P) => P.map(q => `${f1(q[0])},${f1(q[1])}`).join(' ');
export const lineD = (P) => 'M' + P.map(q => `${f1(q[0])},${f1(q[1])}`).join('L');
// matplotlib scales dash patterns by linewidth
export const dash = (pat, lw) => pat.map(v => f1(v * lw)).join(' ');
export const STYLE = {
  // on-course access patterns (pt, from make.py)
  on: {
    foot: { lw: 6, pat: [1.17, 0.5] }, foot_bike: { lw: 6, pat: [4, 0.6, 1.6, 0.6] },
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
export function station(x, y, lab, spec, { s = 2000, fs = 28, badge = true, colors = null as any, numberText = true }) {
  const k = Math.sqrt(s / BASE_S), sc = `transform="scale(${k.toFixed(4)})"`;
  let out = `<g class="marker" transform="translate(${f1(x)} ${f1(y)})">`;
  if (spec) out += `<use href="#mk-ring" ${sc}/>`;
  out += `<use href="#mk-dot" ${sc}/>`;
  if (numberText && lab) out += `<text class="stnum" font-size="${lab.length === 1 ? fs : f1(fs * 0.6)}" text-anchor="middle" dominant-baseline="central">${esc(lab)}</text>`;
  if (badge) out += `<use href="#mk-badge" ${sc}/>`;
  return out + '</g>';
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
