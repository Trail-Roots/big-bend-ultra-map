// Build-time collision scene for the floor plans: every icon, label, leader and protected line (course route, road labels,
// gates, no-parking zones) is a set of capsules (segment + radius) and optional polygons. Labels/icons are auto-placed on the
// first collision-free candidate; anything that cannot be placed, or any overlap left at the end, FAILS THE BUILD.
export type Pt = [number, number];
export type Cap = { a: Pt; b: Pt; r: number };
export type Ob = { id: string; caps: Cap[]; poly?: Pt[]; kind: string };

const segDist = (p1: Pt, p2: Pt, q1: Pt, q2: Pt) => {
  const d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [q2[0] - q1[0], q2[1] - q1[1]], r = [p1[0] - q1[0], p1[1] - q1[1]];
  const a = d1[0] ** 2 + d1[1] ** 2, e = d2[0] ** 2 + d2[1] ** 2, f = d2[0] * r[0] + d2[1] * r[1];
  let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) return Math.hypot(r[0], r[1]);
  if (a < 1e-9) t = Math.min(1, Math.max(0, f / e));
  else { const c = d1[0] * r[0] + d1[1] * r[1];
    if (e < 1e-9) s = Math.min(1, Math.max(0, -c / a));
    else { const b = d1[0] * d2[0] + d1[1] * d2[1], den = a * e - b * b; s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } } }
  return Math.hypot(p1[0] + d1[0] * s - q1[0] - d2[0] * t, p1[1] + d1[1] * s - q1[1] - d2[1] * t);
};
const pip = (p: Pt, poly: Pt[]) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const capsHit = (A: Cap[], B: Cap[]) => A.some((p) => B.some((q) => segDist(p.a, p.b, q.a, q.b) < p.r + q.r));
const polyCaps = (poly: Pt[], r = 0.5): Cap[] => poly.map((p, i) => ({ a: p, b: poly[(i + 1) % poly.length], r }));
const capPts = (cs: Cap[]) => cs.flatMap((c) => [c.a, c.b, [(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2] as Pt]);
export function obHit(o: Ob, q: Ob) {
  if (capsHit(o.caps, q.caps)) return true;
  if (q.poly && (capPts(o.caps).some((p) => pip(p, q.poly!)) || capsHit(o.caps, polyCaps(q.poly)))) return true;
  if (o.poly && (capPts(q.caps).some((p) => pip(p, o.poly!)) || capsHit(q.caps, polyCaps(o.poly)))) return true;
  return false;
}
/** text footprint (bold sans ≈0.6 em per char, halo included); rot = screen rotation in degrees */
export function textOb(id: string, x: number, y: number, text: string, fs: number, rot = 0, kind = 'label'): Ob {
  const lines = text.split('\n'), lh = fs * 1.15, n = lines.length, a = (rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), caps: Cap[] = [];
  const R = (dx: number, dy: number): Pt => [x + dx * ca - dy * sa, y + dx * sa + dy * ca];
  lines.forEach((l, i) => { const w = Math.max(fs, l.length * fs * 0.6), dy = (i - (n - 1) / 2) * lh, r = lh / 2 + 1.5; caps.push({ a: R(-w / 2 + r, dy), b: R(w / 2 - r, dy), r }); });
  return { id, caps, kind };
}
export const circleOb = (id: string, x: number, y: number, r: number, kind = 'icon'): Ob => ({ id, caps: [{ a: [x, y], b: [x, y], r }], kind });
export const lineOb = (id: string, pts: Pt[], r: number, kind = 'line'): Ob => ({ id, caps: pts.slice(1).map((p, i) => ({ a: pts[i], b: p, r })), kind });
export const polyOb = (id: string, poly: Pt[], kind = 'zone'): Ob => ({ id, caps: [], poly, kind });

export class Scene {
  obs: Ob[] = []; name: string; W: number; H: number;
  constructor(name: string, W: number, H: number) { this.name = name; this.W = W; this.H = H; }
  add(o: Ob) { this.obs.push(o); return o; }
  inFrame(o: Ob, m = 4) { return o.caps.every((c) => [c.a, c.b].every((p) => p[0] - c.r > m && p[1] - c.r > m && p[0] + c.r < this.W - m && p[1] + c.r < this.H - m)); }
  hit(o: Ob, ignore: (q: Ob) => boolean = () => false) { return this.obs.find((q) => q.id !== o.id && !ignore(q) && obHit(o, q)); }
  /** first free candidate around `anchor` (preferred offset first, then rings); returns offset + optional leader */
  place(id: string, anchor: Pt, pref: Pt, make: (x: number, y: number) => Ob, o: { ignore?: (q: Ob) => boolean; leaderIgnore?: (q: Ob) => boolean; iconR?: number; leader?: boolean; rings?: number[] } = {}) {
    const ig = o.ignore ?? (() => false), cands: Pt[] = [pref];
    for (const d of o.rings ?? [Math.hypot(...pref), 24, 34, 46, 60, 76, 95, 120, 150]) for (let k = 0; k < 24; k++) { const a = (k / 24) * 2 * Math.PI; cands.push([d * Math.cos(a), d * Math.sin(a)]); }
    for (const [ox, oy] of cands) {
      const lb = make(anchor[0] + ox, anchor[1] + oy); lb.id = id; if (process.env.CDEBUG && ox === pref[0] && oy === pref[1]) console.log('pref', id, !this.inFrame(lb) ? 'frame' : this.hit(lb, ig)?.id);
      if (!this.inFrame(lb) || this.hit(lb, ig)) continue;
      let ld: Ob | null = null; const r = o.iconR ?? 0;
      if (o.leader !== false && Math.hypot(ox, oy) > r + 26) { // leader from icon edge to the nearest point of the label footprint
        const end = nearestOn(lb, anchor), dd = Math.hypot(end[0] - anchor[0], end[1] - anchor[1]); if (dd > r + 4) {
          const u = [(end[0] - anchor[0]) / dd, (end[1] - anchor[1]) / dd], a: Pt = [anchor[0] + u[0] * (r + 3), anchor[1] + u[1] * (r + 3)], b: Pt = [end[0] - u[0] * 3, end[1] - u[1] * 3];
          ld = lineOb(id + ':leader', [a, b], 1, 'leader'); if (this.hit(ld, (q) => ig(q) || (o.leaderIgnore ?? (() => false))(q) || q.id === id || q.id === id.replace(/:label$/, ':icon'))) continue; } }
      this.add(lb); if (ld) this.add(ld); return { x: anchor[0] + ox, y: anchor[1] + oy, leader: ld ? [ld.caps[0].a, ld.caps[0].b] as [Pt, Pt] : null };
    }
    const why = new Map<string, number>(); for (const [ox, oy] of cands) { const lb = make(anchor[0] + ox, anchor[1] + oy); lb.id = id; const h = !this.inFrame(lb) ? 'frame' : this.hit(lb, ig)?.id ?? 'leader'; why.set(h, (why.get(h) ?? 0) + 1); }
    throw new Error(`[collide:${this.name}] no collision-free spot for ${id}; blocked by ${[...why].map(([k, v]) => k + '×' + v).join(', ')}`);
  }
  /** strict final audit: every pair of non-line objects, and every object vs protected lines/zones */
  audit(allowed: (a: Ob, b: Ob) => boolean = () => false) {
    const bad: string[] = [];
    for (let i = 0; i < this.obs.length; i++) for (let j = i + 1; j < this.obs.length; j++) { const a = this.obs[i], b = this.obs[j];
      if ((a.kind === 'line' || a.kind === 'zone') && (b.kind === 'line' || b.kind === 'zone')) continue;
      if (allowed(a, b) || allowed(b, a)) continue; if (obHit(a, b)) bad.push(`${a.id} × ${b.id}`); }
    if (bad.length) throw new Error(`[collide:${this.name}] overlaps:\n  ` + bad.join('\n  '));
    return this.obs.length;
  }
}
function nearestOn(o: Ob, p: Pt): Pt { let best: Pt = o.caps[0].a, bd = Infinity;
  for (const c of o.caps) { const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - c.a[0]) * dx + (p[1] - c.a[1]) * dy) / L2)), q: Pt = [c.a[0] + dx * t, c.a[1] + dy * t], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d - c.r < bd) { bd = d - c.r; best = [q[0] + ((p[0] - q[0]) / (d || 1)) * c.r, q[1] + ((p[1] - q[1]) / (d || 1)) * c.r]; } }
  return best; }
