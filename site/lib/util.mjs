import { geoMercator, geoPath } from 'd3-geo';
export const R = 6378137, SHEET = { w: 36 * 72, h: 24 * 72 }; // sheet in points (1 in = 72 pt)
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const f1 = v => Math.round(v * 10) / 10;
/** Build a projection mapping the exported EPSG:3857 view window exactly onto a W x H point box (same as the PDF axes). */
export function viewProjection(view, W, H) {
  const [x0, x1] = view.x, [y0, y1] = view.y, k = W / (x1 - x0);
  const proj = geoMercator().scale(R * k).translate([-x0 * k, y1 * k]);
  const path = geoPath(proj).digits(1);
  return { proj, path, W, H, ppm: k, p: ll => proj(ll) };
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
export function station(x, y, lab, spec, { s = 2000, fs = 28, badge = true, colors, numberText = true }) {
  const r = Math.sqrt(s) / 2, out = [];
  if (spec) { const lw = Math.max(2.5, s / 320); out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.sqrt(s * 1.8) / 2)}" fill="#fff" stroke="${colors.ring}" stroke-width="${lw}"/>`); }
  out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${colors.ink}" stroke="${colors.cream}" stroke-width="${Math.max(1.5, s / 700)}"/>`);
  if (numberText && lab) out.push(`<text x="${f1(x)}" y="${f1(y)}" class="stnum" font-size="${lab.length === 1 ? fs : f1(fs * 0.6)}" text-anchor="middle" dominant-baseline="central">${esc(lab)}</text>`);
  if (badge) {
    const d = r * 0.95, bx = x + d, by = y - d, br = Math.sqrt(s * 0.33) / 2, pl = Math.sqrt(s * 0.11) / 2, t = pl * 0.36;
    out.push(`<g class="badge"><circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(br)}" fill="${colors.aid_red}" stroke="#fff" stroke-width="${f1(Math.max(1.2, s / 1300))}"/><path d="M${f1(bx - pl)},${f1(by - t)}h${f1(pl - t)}v${f1(-(pl - t))}h${f1(2 * t)}v${f1(pl - t)}h${f1(pl - t)}v${f1(2 * t)}h${f1(-(pl - t))}v${f1(pl - t)}h${f1(-2 * t)}v${f1(-(pl - t))}h${f1(-(pl - t))}z" fill="#fff"/></g>`);
  }
  return out.join('');
}
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
