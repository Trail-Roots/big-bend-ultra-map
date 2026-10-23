// Every place along a race where another path meets the route (OSM ways in sources/curated/route_trails.geojson + the map's own network lines):
// a path that runs on the route and then leaves it, or touches it and goes away, makes a branch. Branch side (left / right) comes from the GPX
// heading vs the branch direction; only stated when clearly to one side (20-160 deg off the heading).
import fs from 'node:fs'; import path from 'node:path';
import { trailSequence } from './sequence';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), X = (p: number[]) => [p[0] * 111320 * k0, p[1] * 110540];
const ON = 25, AWAY = 45, FAR = 90; // m: a path vertex within ON of the route is on it; the branch direction is read where the path is AWAY m off it
export type Branch = { race?: string; name: string; side: 'left' | 'right' | null; B?: number[] };
export type JEv = { mile: number; i: number; branches: Branch[] };
// branch sources = the OTHER races' GPX routes only (Erik: list junctions where races diverge / rejoin, not roads no race uses)
type L = { race: string; d: number[][]; nm: string[] };
function lines(c: Ctx, k: string): L[] {
  return c.courses.order.filter((r: string) => r !== k).map((r: string) => { const co = (c.courseGeo[r].features[0].geometry.coordinates as number[][]).map(X), nm: string[] = new Array(co.length).fill("the unnamed segment");
    for (const sg of trailSequence(c, r)) for (let i = sg.i0; i <= sg.i1; i++) nm[i] = sg.name ?? "the unnamed segment"; return { race: r, d: co, nm }; });
}
export function routeBranches(c: Ctx, k: string): JEv[] {
  const f = c.courseGeo[k].features[0], co = (f.geometry.coordinates as number[][]).map(X), mi = f.properties.mi as number[];
  const G = 40, grid = new Map<string, number[]>(); co.forEach((p, i) => { const key = `${Math.floor(p[0] / G)},${Math.floor(p[1] / G)}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(i); });
  const near = (p: number[], r: number) => { const o: number[] = []; for (let gx = Math.floor((p[0] - r) / G); gx <= Math.floor((p[0] + r) / G); gx++) for (let gy = Math.floor((p[1] - r) / G); gy <= Math.floor((p[1] + r) / G); gy++) for (const i of grid.get(`${gx},${gy}`) ?? []) if (Math.hypot(co[i][0] - p[0], co[i][1] - p[1]) < r) o.push(i); return o; };
  const dist = (p: number[]) => { let b = Infinity; for (const i of near(p, AWAY + 10)) b = Math.min(b, Math.hypot(co[i][0] - p[0], co[i][1] - p[1])); return b; };
  const ev: JEv[] = [];
  // per pass of OUR route: "on / off" is measured only against our route within 0.4 mi of that pass, so a race that diverges here and
  // meets our route again much later (e.g. on a shared return trail) still counts as diverging here
  const dW = (p: number[], m: number) => { let b = Infinity; for (const i of near(p, FAR + 10)) if (Math.abs(mi[i] - m) < 0.4) b = Math.min(b, Math.hypot(co[i][0] - p[0], co[i][1] - p[1])); return b; };
  for (const l of lines(c, k)) {
    const seen = new Set<string>();
    for (let j = 0; j < l.d.length; j++) { const A = l.d[j], idx = near(A, ON).sort((x, y) => x - y); if (!idx.length) continue;
      const passes: number[][] = []; for (const i of idx) { const p = passes[passes.length - 1]; if (p && i - p[p.length - 1] < 15) p.push(i); else passes.push([i]); }
      for (const ps of passes) { const i = ps.reduce((b, x) => Math.hypot(co[x][0] - A[0], co[x][1] - A[1]) < Math.hypot(co[b][0] - A[0], co[b][1] - A[1]) ? x : b, ps[0]), m = mi[i];
        for (const dir of [-1, 1]) { const q = j + dir; if (q < 0 || q >= l.d.length || dW(l.d[q], m) < ON) continue;
          // a real divergence gets FAR m away from this stretch of our route before coming back (GPS offsets of a shared trail rejoin quickly)
          let t = q, mx = 0, tb = -1; while (t >= 0 && t < l.d.length) { const d = dW(l.d[t], m); if (d < ON) break; mx = Math.max(mx, d); if (tb < 0 && d >= AWAY) tb = t; if (mx >= FAR) break; t += dir; } if (mx < FAR || tb < 0) continue;
          const key = `${Math.round(m * 50)}|${dir}`; if (seen.has(key)) continue; seen.add(key);
          const B = l.d[tb], i0 = Math.max(0, i - 4), i1 = Math.min(co.length - 1, i + 4), h = [co[i1][0] - co[i0][0], co[i1][1] - co[i0][1]], v = [B[0] - co[i][0], B[1] - co[i][1]];
          const ang = Math.atan2(h[0] * v[1] - h[1] * v[0], h[0] * v[0] + h[1] * v[1]) * 180 / Math.PI, a = Math.abs(ang);
          ev.push({ mile: m, i, branches: [{ B, race: l.race, name: l.nm[tb], side: a > 20 && a < 160 ? (ang > 0 ? 'left' : 'right') : null }] }); } } }
  }
  // the route itself leaving / joining a path also shows up as a "branch" of that path; merge events within 0.03 mi
  ev.sort((a, b) => a.mile - b.mile); const out: JEv[] = [];
  for (const e of ev) { const p = out[out.length - 1]; if (p && e.mile - p.mile < 0.03) { p.branches.push(...e.branches); } else out.push({ ...e, branches: [...e.branches] }); }
  // same physical branch drawn twice (OSM way + map line): direction points within 35 m -> keep one, prefer a named one
  for (const e of out) { const o: Branch[] = []; for (const b of e.branches.sort((x, y) => +(x.name === 'an unnamed path') - +(y.name === 'an unnamed path'))) if (!o.some((x) => x.race === b.race && x.name === b.name)) o.push(b); e.branches = o; }
  return out;
}
