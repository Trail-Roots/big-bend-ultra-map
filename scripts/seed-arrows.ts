// One-off / re-seed tool: builds sources/arrows.json (mile markers per course & map) from the approved frozen arrows
// in sources/arrows_approved.json. Run after `bun run content` so routes carry mileage: bun scripts/seed-arrows.ts
import fs from 'node:fs';
import path from 'node:path';
import { type XY, merc, hyp } from './lib/geo';
import { alongRoute, type ArrowsFile, type Marker } from './lib/arrows';

const ROOT = path.resolve(import.meta.dir, '..'), J = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ORDER = ['100K', '55K', '35K', '20K', '10K'];
const layout = J('content/layout.json'), stations = J('content/stations.json').stations;
const views = layout.views as Record<string, { x: number[]; y: number[]; fig: number[] }>;
const ppm = (m: string) => (views[m].fig[2] * 36 * 72) / (views[m].x[1] - views[m].x[0]); // pt per metre
const inView = (m: string, p: XY, padPt = 12) => { const v = views[m], d = padPt / ppm(m); return p[0] > v.x[0] + d && p[0] < v.x[1] - d && p[1] > v.y[0] + d && p[1] < v.y[1] - d; };
const R: Record<string, { rt: XY[]; mi: number[]; dist: number }> = {};
for (const k of ORDER) { const f = J(`content/courses/${k}.geojson`).features[0]; R[k] = { rt: f.geometry.coordinates.map(merc), mi: f.properties.mi, dist: f.properties.distance_mi }; }
const INT = 0.1;
// approved arrows -> map, tip, direction, size
const mapOf = (bd: number[]) => Object.entries(views).reduce((b, [k, v]) => { const s = v.fig.reduce((a, u, i) => a + Math.abs(u - bd[i]), 0); return s < b[1] ? ([k, s] as [string, number]) : b; }, ['', Infinity] as [string, number])[0];
const appr = (J('sources/arrows_approved.json') as [number[], XY[], number, number][]).map(([bd, p], i) => {
  const tip = p[1], mid: XY = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2], n = hyp(mid, tip), map = mapOf(bd);
  const d: XY = [(tip[0] - mid[0]) / n, (tip[1] - mid[1]) / n], h = hyp(p[0], p[1]) / Math.hypot(1.1, 1);
  const ctr: XY = [tip[0] - d[0] * 0.55 * h * 1.45, tip[1] - d[1] * 0.55 * h * 1.45]; // chevron centre = point on the route
  return { i: i + 1, map, tip: ctr, dir: [(tip[0] - mid[0]) / n, (tip[1] - mid[1]) / n] as XY, armPt: hyp(p[0], p[1]) * 1.45 * ppm(map) };
});
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const size_pt = { main: Math.round(avg(appr.filter((a) => a.map === 'main').map((a) => a.armPt)) * 10) / 10, mini: Math.round(avg(appr.filter((a) => a.map !== 'main').map((a) => a.armPt)) * 10) / 10 };
// candidates on a regular mile grid
type Cand = Marker & { course: string; map: string; at: XY; dir: XY };
const cands: Cand[] = [];
for (const k of ORDER) for (const map of ['main', k]) {
  if (!views[map]) continue;
  for (let m = INT; m < R[k].dist - INT / 2; m += INT) {
    const mile = Math.round(m * 100) / 100, { at, dir } = alongRoute(R[k].rt, R[k].mi, mile);
    if (inView(map, at)) cands.push({ course: k, map, mile, show: false, reason: '', at, dir });
  }
}
// seed: each approved arrow -> nearest same-direction candidate (prefer the longest course on shared trail)
const unmatched: string[] = [];
for (const a of appr) {
  const pool = cands.filter((c) => c.map === a.map && c.dir[0] * a.dir[0] + c.dir[1] * a.dir[1] > 0.5).map((c) => ({ c, d: hyp(c.at, a.tip) }));
  if (!pool.length) { unmatched.push(`#${a.i} (${a.map}): no same-direction route`); continue; }
  const best = Math.min(...pool.map((q) => q.d)), pick = pool.filter((q) => q.d <= best + 15).sort((x, y) => ORDER.indexOf(x.c.course) - ORDER.indexOf(y.c.course) || x.d - y.d)[0];
  if (pick.d > 260) { unmatched.push(`#${a.i} (${a.map}): nearest marker ${pick.d.toFixed(0)} m away`); continue; }
  if (pick.c.show) { unmatched.push(`#${a.i} (${a.map}): same marker as another approved arrow (${pick.c.course} mi ${pick.c.mile})`); continue; }
  pick.c.show = true; pick.c.reason = `approved #${a.i} (moved ${pick.d.toFixed(0)} m)`;
}
// reasons for everything else
const near = (c: Cand) => {
  const k = ppm(c.map), sz = c.map === 'main' ? size_pt.main : size_pt.mini;
  const stOn = c.map === 'main' ? Object.values(stations) : J(`content/cutoffs.json`)[c.map].map((q: any) => stations[q.station]);
  const st = stOn.some((s: any) => hyp(merc(s.lonlat), c.at) * k < (c.map === 'main' ? 30 : 20) + sz);
  const ar = cands.some((o) => o !== c && o.show && o.map === c.map && hyp(o.at, c.at) * k < sz * 3);
  return { st, ar };
};
for (const c of cands) {
  const { st, ar } = near(c);
  if (c.show) { if (st) c.reason += ' — note: close to an aid station'; continue; }
  c.reason = st ? 'collides with aid station' : ar ? 'too close to a shown arrow' : 'not in approved set';
}
const out: ArrowsFile = { interval_mi: INT, size_pt, courses: {} };
for (const c of cands) ((out.courses[c.course] ??= {})[c.map] ??= []).push({ mile: c.mile, show: c.show, reason: c.reason });
fs.writeFileSync(path.join(ROOT, 'sources/arrows.json'), JSON.stringify(out, null, 1));
console.log('size_pt', size_pt, 'candidates', cands.length, 'shown', cands.filter((c) => c.show).length, 'approved', appr.length);
for (const u of unmatched) console.log('UNMATCHED', u);
for (const c of cands.filter((c) => c.show)) console.log('SHOWN', c.map, c.course, c.mile, c.reason);
