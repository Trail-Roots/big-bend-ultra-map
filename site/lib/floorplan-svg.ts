// Both floor plans render from ONE drawing: Erik's sources/floorplan.svg (4100×2900 units, roads/lot/parking/no-parking/
// labels already drawn). Each plan is a different viewBox (zoom) of that file; we only add what the drawing lacks (Medic
// tent, readable Picnic / Water hose labels, north arrow, approximate scale) and collision-check those against the drawing
// using sources/floorplan.index.json (outlines + text boxes, regenerate with `bun scripts/floorplan-index.ts`).
import fs from 'node:fs';
import path from 'node:path';
import { Scene, textOb, circleOb, lineOb, polyOb, type Pt } from './collide';
import { f1, textBlock } from './util';
import { C, furniture } from './floorplan';

const ROOT = path.resolve(import.meta.dir, '..', '..');
const RAW = fs.readFileSync(path.join(ROOT, 'sources/floorplan.svg'), 'utf8');
const IDX: { hide: string[]; lines: number[][][]; texts: number[][][] } = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources/floorplan.index.json'), 'utf8'));

// Geo-reference (SVG units -> local meters east/north of -103.757, 29.27), least-squares affine on features drawn in the
// SVG vs the logistics My Map points. The drawing is illustrative, not surveyed, so each plan uses the fit for its own area.
const LON0 = -103.757, LAT0 = 29.27, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KY = 110574;
type Ctl = [number, number, number, number];
const CTL_FINISH: Ctl[] = [[1455, 1967, -103.7571355, 29.2705449], [1275, 2145, -103.7576126, 29.2701642], [1510, 2248, -103.757135, 29.2700261], [1502, 2042, -103.7571499, 29.2703689], [1089, 1920, -103.7580237, 29.27062]]; // S/F arch, restrooms, water, radio, gate
const CTL_WIDE: Ctl[] = [[1455, 1967, -103.7571355, 29.2705449], [1089, 1920, -103.7580237, 29.27062], [2962, 697, -103.7536258, 29.2732307], [3758, 670, -103.7516575, 29.273116], [3075, 658, -103.7534948, 29.2733032], [110, 2631, -103.7605933, 29.2691318]]; // + parking strip ends
function fit(ctl: Ctl[]) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [[0, 0, 0], [0, 0, 0]];
  for (const [x, y, lo, la] of ctl) { const r = [x, y, 1], t = [(lo - LON0) * KX, (la - LAT0) * KY]; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; b[0][i] += r[i] * t[0]; b[1][i] += r[i] * t[1]; } }
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A), M = b.map((bb) => [0, 1, 2].map((k) => det(A.map((row, i) => row.map((v, j) => (j === k ? bb[i] : v)))) / D));
  const fwd = (x: number, y: number) => [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
  const inv = (lon: number, lat: number): Pt => { const X = (lon - LON0) * KX - M[0][2], Y = (lat - LAT0) * KY - M[1][2], d = M[0][0] * M[1][1] - M[0][1] * M[1][0]; return [(X * M[1][1] - Y * M[0][1]) / d, (M[0][0] * Y - M[1][0] * X) / d]; };
  const res = Math.max(...ctl.map(([x, y, lo, la]) => { const q = fwd(x, y); return Math.hypot(q[0] - (lo - LON0) * KX, q[1] - (la - LAT0) * KY); }));
  const mPerUnit = (Math.hypot(M[0][0], M[1][0]) + Math.hypot(M[0][1], M[1][1])) / 2;
  return { inv, res, mPerUnit };
}

/** the drawing, ids prefixed per plan (two copies live on one page), replaced layers hidden */
function base(pfx: string) {
  let s = RAW.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '');
  s = s.slice(s.indexOf('>', s.indexOf('<svg')) + 1, s.lastIndexOf('</svg>'));
  for (const h of IDX.hide) s = s.replace(`id="${h}"`, `id="${h}" display="none"`);
  return s.replace(/\sid="([^"]+)"/g, ` id="${pfx}-$1"`).replace(/\saffinity:id="[^"]*"/g, '');
}

type View = { x: number; y: number; w: number; h: number };
function frame(name: string, pfx: string, vb: View, W: number) {
  const H = Math.round((W * vb.h) / vb.w), k = W / vb.w, U = (p: number[]): Pt => [(p[0] - vb.x) * k, (p[1] - vb.y) * k];
  const sc = new Scene(name, W, H), inside = (p: Pt) => p[0] > -20 && p[1] > -20 && p[0] < W + 20 && p[1] < H + 20;
  // the drawing as obstacles: every outline (labels may not cross an edge -> each sits on one solid fill) and every text box
  IDX.lines.forEach((l, i) => { const pts = l.map(U); if (pts.some(inside)) sc.add(lineOb('svg:edge' + i, pts, 0.6, 'svgline')); });
  IDX.texts.forEach((t, i) => { const pts = t.map(U); if (pts.some(inside)) sc.add(polyOb('svg:text' + i, pts, 'svgtext')); });
  const svg = (inner: string) => `<svg class="siteplan floorplan" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}"><svg x="0" y="0" width="${W}" height="${H}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid slice" style="fill-rule:evenodd;clip-rule:evenodd">${base(pfx)}</svg>${inner}</svg>`;
  return { W, H, k, U, sc, svg };
}
const audit = (sc: Scene, right = sc.W) => { const W = right, H = sc.H; sc.add(circleOb('north', sc.W - 38, 50, 28)); sc.add(polyOb('scalebar', [[W - 250, H - 58], [W - 18, H - 58], [W - 18, H - 12], [W - 250, H - 12]], 'icon')); return sc.audit((a, b) => a.kind === 'svgline' && b.kind === 'svgline' || a.kind === 'svgtext' && b.kind === 'svgtext' || a.kind === 'svgline' && b.kind === 'svgtext' || a.kind === 'leader' && b.kind === 'svgline' || ((a.kind === 'icon') && (b.kind === 'svgline' || b.kind === 'svgtext') && (a.id.startsWith('medic') || a.id.startsWith('water')))); }; // markers sit at their real spot on the drawing

// ---------------- finish plan ----------------
export const FINISH_VIEW: View = { x: 1010, y: 1690, w: 830, h: 650 }; // S/F + lot + picnic + building front, with the gate and drop-off at the Y
export function renderFinishPlan(c: any) {
  const G = fit(CTL_FINISH), F = frame('finish plan', 'fp', FINISH_VIEW, 1200), { U, k, sc } = F; let out = '';
  const L = c.logistics, pt = (n: string) => L.placemarks.find((p: any) => p.name === n && p.kind === 'point')!.coords[0] as [number, number];
  const pxPerM = k / G.mPerUnit;
  // Medic tent (10×10 ft) at its My Map point — the drawing has no medic
  const m = U(G.inv(...pt('Medic'))), hs = (10 * 0.3048 * pxPerM) / 2;
  out += `<rect x="${f1(m[0] - hs)}" y="${f1(m[1] - hs)}" width="${f1(2 * hs)}" height="${f1(2 * hs)}" fill="#fdeeee" stroke="${C.ink}" stroke-width="1.6"/><path d="M${f1(m[0] - hs)},${f1(m[1] - hs)}L${f1(m[0] + hs)},${f1(m[1] + hs)}M${f1(m[0] + hs)},${f1(m[1] - hs)}L${f1(m[0] - hs)},${f1(m[1] + hs)}" stroke="${C.ink}" stroke-width=".8"/><path d="M${f1(m[0] - 1.6)},${f1(m[1] - 5)}h3.2v3.4h3.4v3.2h-3.4v3.4h-3.2v-3.4h-3.4v-3.2h3.4z" fill="${C.red}"/>`;
  sc.add(circleOb('medic:icon', m[0], m[1], hs * 1.2));
  // water hose: the drawing's spigot marker at the building's NE corner (its faint label + leader are replaced)
  const w = U([1498, 2236]); out += `<circle cx="${f1(w[0])}" cy="${f1(w[1])}" r="7" fill="#fff" stroke="${C.blue}" stroke-width="2"/><rect x="${f1(w[0] - 2.6)}" y="${f1(w[1] - 2.6)}" width="5.2" height="5.2" fill="${C.blue}"/>`;
  sc.add(circleOb('water:icon', w[0], w[1], 8));
  const lab = (id: string, at: Pt, pref: Pt, text: string, fs: number, halo: string, color: string, o: any = {}) => {
    const r = sc.place(id + ':label', at, pref, (x, y) => textOb(id, x, y, text, fs), { iconR: o.iconR ?? 0, leader: o.leader, rings: o.rings ?? [Math.hypot(...pref), 30, 45, 60, 80, 100, 130, 160, 200], ignore: o.ignore, leaderIgnore: (q) => q.kind === 'svgline' });
    if (r.leader) out += `<path d="M${r.leader[0].map(f1).join(',')}L${r.leader[1].map(f1).join(',')}" stroke="${C.ink}" stroke-width="1.3"/>`;
    out += textBlock(r.x, r.y, { text, fs, color, style: 'normal', weight: 'bold', family: 'sans', halo: { color: halo, width: 4.5 }, ha: 'center' }); };
  lab('medic', m, [-hs - 40, 0], 'Medic', 17, '#fff', C.ink, { iconR: hs + 2 });
  lab('water', w, [70, 26], 'Water hose', 16, '#fff', C.ink, { iconR: 8 });
  // picnic area: readable label inside the picnic fill (rgb(105,90,70) @ .75 over white), on that single solid background
  lab('picnic', U([1645, 2108]), [0, 0], 'Picnic area', 17, '#8f8374', '#fff', { leader: false, rings: [0, 10, 20, 30] });
  const n = audit(sc);
  console.log(`  collide: finish plan OK (${n} objects incl. the drawing's outlines/texts; georef ${G.res.toFixed(1)} m, ${G.mPerUnit.toFixed(3)} m/unit)`);
  return F.svg(out + furniture(F.W, F.H, pxPerM, [0, 25, 50, 100], 'Base drawing: sources/floorplan.svg · scale approximate'));
}

// ---------------- parking plan ----------------
export const PARKING_VIEW: View = { x: 0, y: 0, w: 4100, h: 2900 }; // the whole parking stretch along FM 170, both property lines
export function renderParkingPlan(_c: any) {
  const G = fit(CTL_WIDE), F = frame('parking plan', 'pk', PARKING_VIEW, 1200);
  const SB = 860; // scale bar in the empty ground south of the building (the property line runs down the right edge)
  const n = audit(F.sc, SB);
  console.log(`  collide: parking plan OK (${n} objects; georef ${G.res.toFixed(1)} m, ${G.mPerUnit.toFixed(3)} m/unit)`);
  return F.svg(furniture(F.W, F.H, F.k / G.mPerUnit, [0, 100, 200, 400], 'Base drawing: sources/floorplan.svg · scale approximate', SB));
}
