// Small geometry toolkit (replaces pyproj / shapely / numpy bits the old Python pipeline used).
export type XY = [number, number];
const R = 6378137;
/** EPSG:4326 lon/lat -> EPSG:3857 metres */
export const merc = ([lon, lat]: XY): XY => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
/** EPSG:3857 -> lon/lat */
export const unmerc = ([x, y]: XY): XY => [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];
export const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
export const ll = (P: XY[]): XY[] => P.map((p) => unmerc(p).map(r6) as XY);
export const hyp = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function cumlen(P: XY[]): number[] {
  const c = [0];
  for (let i = 1; i < P.length; i++) c.push(c[i - 1] + hyp(P[i - 1], P[i]));
  return c;
}
/** point at distance s along polyline (shapely LineString.interpolate, clamped) */
export function interpolate(P: XY[], cum: number[], s: number): XY {
  if (s <= 0) return P[0];
  const L = cum[cum.length - 1];
  if (s >= L) return P[P.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t];
}
function segDist(p: XY, a: XY, b: XY) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** Douglas–Peucker */
export function simplify(P: XY[], tol: number): XY[] {
  if (P.length < 3) return P.slice();
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st: [number, number][] = [[0, P.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!; let dm = -1, im = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist(P[i], P[a], P[b]); if (d > dm) { dm = d; im = i; } }
    if (dm > tol) { keep[im] = 1; st.push([a, im], [im, b]); }
  }
  return P.filter((_, i) => keep[i]);
}
export function chaikin(c: XY[], it = 2): XY[] {
  for (let k = 0; k < it; k++) {
    const o: XY[] = [c[0]];
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i], b = c[i + 1];
      o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    o.push(c[c.length - 1]); c = o;
  }
  return c;
}
/** haversine metres between [lat,lon] pairs */
export function hav(a: XY, b: XY) {
  const d2r = Math.PI / 180, dl = (b[0] - a[0]) * d2r, dn = (b[1] - a[1]) * d2r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d2r) * Math.cos(b[0] * d2r) * Math.sin(dn / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}
/** numpy.interp */
export function interp(x: number, xp: number[], fp: number[]) {
  if (x <= xp[0]) return fp[0];
  const n = xp.length; if (x >= xp[n - 1]) return fp[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xp[m] <= x) lo = m; else hi = m; }
  return fp[lo] + ((fp[hi] - fp[lo]) * (x - xp[lo])) / (xp[hi] - xp[lo] || 1);
}
export const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features });

// ---- topology-preserving Douglas–Peucker (port of GEOS TopologyPreservingSimplifier for one line) ----
type Seg = [XY, XY];
class Grid {
  m = new Map<string, Seg[]>();
  constructor(public c: number) {}
  private keys([a, b]: Seg) { const k: string[] = [], c = this.c; for (let x = Math.floor(Math.min(a[0], b[0]) / c); x <= Math.floor(Math.max(a[0], b[0]) / c); x++) for (let y = Math.floor(Math.min(a[1], b[1]) / c); y <= Math.floor(Math.max(a[1], b[1]) / c); y++) k.push(x + ',' + y); return k; }
  add(s: Seg) { for (const k of this.keys(s)) { let l = this.m.get(k); if (!l) this.m.set(k, (l = [])); l.push(s); } }
  remove(s: Seg) { for (const k of this.keys(s)) { const l = this.m.get(k); if (l) { const i = l.indexOf(s); if (i >= 0) l.splice(i, 1); } } }
  query(s: Seg) { const o = new Set<Seg>(); for (const k of this.keys(s)) for (const q of this.m.get(k) ?? []) o.add(q); return o; }
}
const eq = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];
const orient = (a: XY, b: XY, c: XY) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
const onSeg = (p: XY, a: XY, b: XY) => Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
/** true if segments intersect at a point that is interior to at least one of them (GEOS isInteriorIntersection) */
function interiorX([a, b]: Seg, [c, d]: Seg): boolean {
  if ((eq(a, c) && eq(b, d)) || (eq(a, d) && eq(b, c))) return true; // equalsTopo
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if (o1 * o2 > 0 || o3 * o4 > 0) return false;
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) { // collinear
    const pts = [c, d, a, b].filter((p, i) => (i < 2 ? onSeg(p, a, b) : onSeg(p, c, d)));
    if (!pts.length) return false;
    return pts.some((p) => !((eq(p, a) || eq(p, b)) && (eq(p, c) || eq(p, d)))) ;
  }
  // proper or endpoint-touching single point
  let p: XY;
  if (o1 === 0) p = c; else if (o2 === 0) p = d; else if (o3 === 0) p = a; else if (o4 === 0) p = b;
  else return true; // proper crossing
  return !((eq(p, a) || eq(p, b)) && (eq(p, c) || eq(p, d)));
}
export function simplifyTP(P: XY[], tol: number): XY[] {
  if (P.length < 3) return P.slice();
  let ext = 0; for (let i = 1; i < P.length; i++) ext = Math.max(ext, hyp(P[i - 1], P[i]));
  const cell = Math.max(ext, tol * 4, 1);
  const inIdx = new Grid(cell), outIdx = new Grid(cell), inSegs: Seg[] = [];
  for (let i = 0; i < P.length - 1; i++) { const s: Seg = [P[i], P[i + 1]]; (s as any).i = i; inSegs.push(s); inIdx.add(s); }
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const rec = (i: number, j: number) => {
    if (j === i + 1) return;
    let dm = -1, k = -1;
    for (let q = i + 1; q < j; q++) { const d = segDistE(P[q], P[i], P[j]); if (d > dm) { dm = d; k = q; } }
    let ok = dm <= tol;
    if (ok) {
      const cand: Seg = [P[i], P[j]];
      for (const s of outIdx.query(cand)) if (interiorX(s, cand)) { ok = false; break; }
      if (ok) for (const s of inIdx.query(cand)) { const si = (s as any).i; if (si >= i && si < j) continue; if (interiorX(s, cand)) { ok = false; break; } }
      if (ok) { outIdx.add(cand); for (let q = i; q < j; q++) inIdx.remove(inSegs[q]); return; }
    }
    keep[k] = 1; rec(i, k); rec(k, j);
  };
  rec(0, P.length - 1);
  return P.filter((_, i) => keep[i]);
}
function segDistE(p: XY, a: XY, b: XY) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
