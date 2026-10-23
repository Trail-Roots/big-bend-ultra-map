// Every place along a race where another path meets the route (OSM ways in sources/curated/route_trails.geojson + the map's own network lines):
// a path that runs on the route and then leaves it, or touches it and goes away, makes a branch. Branch side (left / right) comes from the GPX
// heading vs the branch direction; only stated when clearly to one side (20-160 deg off the heading).
import fs from 'node:fs'; import path from 'node:path';
import { trailName } from './sequence';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), X = (p: number[]) => [p[0] * 111320 * k0, p[1] * 110540];
const ON = 18, AWAY = 45, FAR = 90; // m: a path vertex within ON of the route is on it; the branch direction is read where the path is AWAY m off it
export type Branch = { name: string; side: 'left' | 'right' | null; B?: number[] };
export type JEv = { mile: number; i: number; branches: Branch[] };
type L = { name: string; d: number[][] };
let LINES: L[] | null = null;
function lines(c: Ctx): L[] {
  if (LINES) return LINES;
  const seen = new Set<string>(), out: L[] = [];
  const add = (f: any) => { const id = f.properties?.osm; if (id && seen.has(id)) return; if (id) seen.add(id);
    const cs = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const c of cs) { const d: number[][] = []; for (let i = 1; i < c.length; i++) { const a = X(c[i - 1]), b = X(c[i]), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (let t = 0; t < n; t++) d.push([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); } if (c.length) d.push(X(c[c.length - 1]));
      out.push({ name: f.properties?.name ? trailName(f.properties.name) : 'an unnamed path', d }); } };
  for (const f of JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../../sources/curated/route_trails.geojson'), 'utf8')).features) add(f);
  for (const f of (c as any).networkFull.features) if (!f.properties?.on_course) add(f); // on_course lines are the race routes themselves (drawn), not branches
  return (LINES = out);
}
export function routeBranches(c: Ctx, k: string): JEv[] {
  const f = c.courseGeo[k].features[0], co = (f.geometry.coordinates as number[][]).map(X), mi = f.properties.mi as number[];
  const G = 40, grid = new Map<string, number[]>(); co.forEach((p, i) => { const key = `${Math.floor(p[0] / G)},${Math.floor(p[1] / G)}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(i); });
  const near = (p: number[], r: number) => { const o: number[] = []; for (let gx = Math.floor((p[0] - r) / G); gx <= Math.floor((p[0] + r) / G); gx++) for (let gy = Math.floor((p[1] - r) / G); gy <= Math.floor((p[1] + r) / G); gy++) for (const i of grid.get(`${gx},${gy}`) ?? []) if (Math.hypot(co[i][0] - p[0], co[i][1] - p[1]) < r) o.push(i); return o; };
  const dist = (p: number[]) => { let b = Infinity; for (const i of near(p, AWAY + 10)) b = Math.min(b, Math.hypot(co[i][0] - p[0], co[i][1] - p[1])); return b; };
  const ev: JEv[] = [];
  for (const l of lines(c)) {
    const dd = l.d.map(dist), on = dd.map((d) => d < ON);
    if (!on.some(Boolean)) continue;
    // attach points: a vertex on the route next to one off it; the branch heads toward the first vertex >= AWAY m off the route
    for (let j = 0; j < l.d.length; j++) { if (!on[j]) continue;
      for (const dir of [-1, 1]) { const q = j + dir; if (q < 0 || q >= l.d.length || on[q]) continue;
        // a real branch gets FAR m away from the route before it comes back (GPS / mapping offsets of the same trail wander off and rejoin)
        let t = q, mx = 0, tb = -1; while (t >= 0 && t < l.d.length && !on[t]) { mx = Math.max(mx, dd[t]); if (tb < 0 && dd[t] >= AWAY) tb = t; if (mx >= FAR) break; t += dir; } if (mx < FAR || tb < 0) continue; t = tb;
        const A = l.d[j], B = l.d[t];
        // each pass of the route by this point (out-and-back courses pass twice)
        const idx = near(A, ON + 6).sort((a, b) => a - b), passes: number[][] = []; for (const i of idx) { const p = passes[passes.length - 1]; if (p && i - p[p.length - 1] < 15) p.push(i); else passes.push([i]); }
        for (const ps of passes) { const i = ps.reduce((b, x) => Math.hypot(co[x][0] - A[0], co[x][1] - A[1]) < Math.hypot(co[b][0] - A[0], co[b][1] - A[1]) ? x : b, ps[0]);
          const i0 = Math.max(0, i - 4), i1 = Math.min(co.length - 1, i + 4), h = [co[i1][0] - co[i0][0], co[i1][1] - co[i0][1]], v = [B[0] - co[i][0], B[1] - co[i][1]];
          const ang = Math.atan2(h[0] * v[1] - h[1] * v[0], h[0] * v[0] + h[1] * v[1]) * 180 / Math.PI, a = Math.abs(ang);
          ev.push({ mile: mi[i], i, branches: [{ B, name: l.name, side: a > 20 && a < 160 ? (ang > 0 ? 'left' : 'right') : null }] }); } } }
  }
  // the route itself leaving / joining a path also shows up as a "branch" of that path; merge events within 0.03 mi
  ev.sort((a, b) => a.mile - b.mile); const out: JEv[] = [];
  for (const e of ev) { const p = out[out.length - 1]; if (p && e.mile - p.mile < 0.03) { p.branches.push(...e.branches); } else out.push({ ...e, branches: [...e.branches] }); }
  // same physical branch drawn twice (OSM way + map line): direction points within 35 m -> keep one, prefer a named one
  for (const e of out) { const o: Branch[] = []; for (const b of e.branches.sort((x, y) => +(x.name === 'an unnamed path') - +(y.name === 'an unnamed path'))) if (!o.some((x) => Math.hypot(x.B![0] - b.B![0], x.B![1] - b.B![1]) < 35)) o.push(b); e.branches = o; }
  return out;
}
