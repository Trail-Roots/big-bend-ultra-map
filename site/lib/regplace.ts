// Greedy label placement for the regional map (PDF page + web zoomed-out view), in "display" units (PDF sheet units / web viewBox units at
// the maximum zoom-out). Every label box must clear: other labels, point markers, every drawn line (roads, routes, county lines, park
// boundary, river, runways, leaders) and the frame furniture, with padding. Required labels fall back to a leader line; optional ones drop.
export type Pt = [number, number];
export type Box = [number, number, number, number];
const segBox = (ax: number, ay: number, bx: number, by: number, b: Box) => {
  // Liang-Barsky clip of segment a-b against box b
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - b[0]], [dx, b[2] - ax], [-dy, ay - b[1]], [dy, b[3] - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
};
const segSeg = (a: Pt, b: Pt, c: Pt, d: Pt) => { const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const grow = (b: Box, p: number): Box => [b[0] - p, b[1] - p, b[2] + p, b[3] + p];
const boxBox = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const boxCirc = (b: Box, x: number, y: number, r: number) => { const dx = Math.max(b[0] - x, 0, x - b[2]), dy = Math.max(b[1] - y, 0, y - b[3]); return dx * dx + dy * dy < r * r; };
export class Space {
  why = ''; segs: number[][] = []; grid = new Map<number, number[]>(); circ: [number, number, number][] = []; boxes: Box[] = [];
  constructor(public cell = 40) {}
  private key(i: number, j: number) { return i * 100003 + j; }
  line(p: Pt[]) { for (let i = 1; i < p.length; i++) this.seg(p[i - 1], p[i]); }
  seg(a: Pt, b: Pt) {
    const k = this.segs.push([a[0], a[1], b[0], b[1]]) - 1, c = this.cell;
    for (let i = Math.floor(Math.min(a[0], b[0]) / c); i <= Math.floor(Math.max(a[0], b[0]) / c); i++) for (let j = Math.floor(Math.min(a[1], b[1]) / c); j <= Math.floor(Math.max(a[1], b[1]) / c); j++) { const q = this.key(i, j); (this.grid.get(q) || this.grid.set(q, []).get(q)!).push(k); }
  }
  /** true if box b (grown by pad) touches anything */
  hit(b: Box, pad: number, lines = true) {
    const g = grow(b, pad);
    this.why = 'box'; for (const o of this.boxes) if (boxBox(g, o)) return true;
    for (const [x, y, r] of this.circ) if (boxCirc(g, x, y, r)) { this.why = 'mark'; return true; }
    if (lines) { const c = this.cell, seen = new Set<number>();
      for (let i = Math.floor(g[0] / c); i <= Math.floor(g[2] / c); i++) for (let j = Math.floor(g[1] / c); j <= Math.floor(g[3] / c); j++) for (const k of this.grid.get(this.key(i, j)) || []) { if (seen.has(k)) continue; seen.add(k); const s = this.segs[k]; if (segBox(s[0], s[1], s[2], s[3], g)) { this.why = 'line'; return true; } } }
    return false;
  }
  /** leader a-b: must not cross label boxes or markers (other than the own marker at a) */
  leaderOk(a: Pt, b: Pt, pad: number, own: number) {
    for (const o of this.boxes) if (segBox(a[0], a[1], b[0], b[1], grow(o, pad))) return false;
    for (let i = 0; i < this.circ.length; i++) { const [x, y, r] = this.circ[i]; if (i === own || Math.hypot(x - a[0], y - a[1]) < r + 120) continue; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); if (Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y) < r + pad) return false; }
    return true;
  }
}
export const pip = (p: Pt, r: Pt[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
export const crosses = (a: Pt, b: Pt, lines: Pt[][]) => lines.some((l) => l.some((q, i) => i > 0 && segSeg(a, b, l[i - 1], q)));
export type Lab = { id: string; w: number; h: number; req: boolean;
  kind: 'point' | 'line' | 'area'; at: Pt; r?: number; own?: number; path?: Pt[]; t?: number; R?: number; domain?: Pt[][]; inside?: Pt[][]; lead?: boolean; lmax?: number };
export type Placed = { id: string; box: Box; a: 'start' | 'end' | 'middle'; lead?: [Pt, Pt]; forced?: boolean };
/** place labels in the given order; frame = allowed area; pad = clearance */
export function place(sp: Space, labs: Lab[], frame: Box, pad: number) {
  const out: Placed[] = [], inF = (b: Box) => b[0] >= frame[0] && b[1] >= frame[1] && b[2] <= frame[2] && b[3] <= frame[3];
  for (const L of labs) {
    const { w, h } = L, mk = (cx: number, cy: number): Box => [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
    const st: Record<string, number> = {}, ok = (b: Box) => { if (!inF(b)) { st.frame = (st.frame || 0) + 1; return false; } if (sp.hit(b, pad)) { st[sp.why] = (st[sp.why] || 0) + 1; return false; } return true; };
    let best: Placed | null = null;
    const lead = (x: number, y: number, r0: number, own: number, dmax = 40) => {
      const r = r0 + pad * 1.5, f = Math.min(Math.max(h, 14), 28);
      for (const d of [0.6, 1, 1.5, 2, 2.6, 3.3, 4, 5, 6, 7.5, 9, 11, 13, 16, 20, 24, 29, 34, 40].filter((q) => q <= dmax).map((q) => q * f)) for (let k = 0; k < 36; k++) {
        const th = (Math.ceil(k / 2) * 10 * (k % 2 ? 1 : -1)) * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
        for (const sgn of [1, -1]) { const vx = ux * sgn, vy = uy, he = Math.abs(vx) * w / 2 + Math.abs(vy) * h / 2;
          // try right/left then rotate: th sweeps around both sides
          for (const sh of [0, 0.25, -0.25, 0.45, -0.45]) { const cx = x + vx * (r + d + he) - vy * sh * w, cy = y + vy * (r + d + he) + vx * sh * h, b = mk(cx, cy), a: Placed['a'] = vx > 0.35 ? 'start' : vx < -0.35 ? 'end' : 'middle';
          const q: Pt = [Math.max(b[0], Math.min(b[2], x)), Math.max(b[1], Math.min(b[3], y))], dq = Math.hypot(q[0] - x, q[1] - y) || 1, qq: Pt = [q[0] - (q[0] - x) / dq * pad, q[1] - (q[1] - y) / dq * pad];
          if (ok(b) && sp.leaderOk([x + vx * r0, y + vy * r0], qq, pad * 0.5, own)) return { id: L.id, box: b, a, lead: [[x, y], qq] as [Pt, Pt] }; } } }
      return null; };
    if (L.kind === 'point') {
      const [x, y] = L.at, r = (L.r || 0) + pad * 1.5;
      const C: [number, number, Placed['a']][] = [[x + r + w / 2, y, 'start'], [x - r - w / 2, y, 'end'], [x + r * 0.7 + w / 2, y - r * 0.7 - h / 2, 'start'], [x + r * 0.7 + w / 2, y + r * 0.7 + h / 2, 'start'], [x - r * 0.7 - w / 2, y - r * 0.7 - h / 2, 'end'], [x - r * 0.7 - w / 2, y + r * 0.7 + h / 2, 'end'], [x, y - r - h / 2, 'middle'], [x, y + r + h / 2, 'middle']];
      for (const [cx, cy, a] of C) { const b = mk(cx, cy); if (ok(b)) { best = { id: L.id, box: b, a }; break; } }
      if (!best && L.lead !== false) best = lead(x, y, L.r || 0, L.own ?? -1, L.lmax ?? (L.lead ? 24 : 12));
    } else if (L.kind === 'line') {
      const P = L.path!, seg = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1])), tot = seg.reduce((s, v) => s + v, 0);
      const at = (t: number): [Pt, Pt] => { let r = t * tot; for (let i = 0; i < seg.length; i++) { if (r <= seg[i]) { const u = r / (seg[i] || 1); return [[P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u], [(P[i + 1][0] - P[i][0]) / (seg[i] || 1), (P[i + 1][1] - P[i][1]) / (seg[i] || 1)]]; } r -= seg[i]; } return [P.at(-1)!, [1, 0]]; };
      const ts = Array.from({ length: 33 }, (_, i) => 0.04 + i * 0.0287).sort((a, b) => Math.abs(a - (L.t ?? 0.5)) - Math.abs(b - (L.t ?? 0.5)));
      search: for (const t of ts) { const [[px, py], [tx, ty]] = at(t); for (const sd of [1, -1]) for (const g of [0.25, 0.6, 1.0, 1.6]) {
        const nx = -ty * sd, ny = tx * sd, he = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2, d = he + pad * 2 + g * h, b = mk(px + nx * d, py + ny * d);
        if (ok(b)) { best = { id: L.id, box: b, a: 'middle' }; break search; } } }
      if (!best && L.req) for (const t of ts.slice(0, 12)) { const [[px, py]] = at(t); best = lead(px, py, 0, -1, 9); if (best) break; }
    } else {
      const [x, y] = L.at, R = (L.R ?? 4 * h) * 1.8, st = Math.max(4, h * 0.35), C: [number, number][] = [];
      for (let i = -R; i <= R; i += st) for (let j = -R; j <= R; j += st) if (i * i + j * j <= R * R) C.push([x + i, y + j]);
      C.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
      for (const pass of [0, 1]) { if (best || (pass && !L.inside)) break; for (const [cx, cy] of C) { const b = mk(cx, cy); if (ok(b) && !(L.domain && crosses([x, y], [cx, cy], L.domain)) && !(!pass && L.inside && !L.inside.some((r) => pip([cx, cy], r)))) { best = { id: L.id, box: b, a: 'middle' }; break; } } }
    }
    if (!best && process.env.RDEBUG) console.log('  fail', L.id, JSON.stringify(L.at), JSON.stringify(frame), JSON.stringify(st), Math.round(L.w), Math.round(L.h));
    if (!best) { if (!L.req) continue; const b = L.kind === 'point' ? mk(L.at[0] + (L.r || 0) + pad + w / 2, L.at[1]) : mk(L.at[0], L.at[1]); best = { id: L.id, box: b, a: L.kind === 'point' ? 'start' : 'middle', forced: true }; }
    sp.boxes.push(best.box); if (best.lead) sp.seg(best.lead[0], best.lead[1]);
    out.push(best);
  }
  return out;
}
