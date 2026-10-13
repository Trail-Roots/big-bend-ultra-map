// Data for the elevation-profile hover: per course, samples every 0.05 mi of
// [mile, ft, main-map x, y, mini-map x, y, cumulative gain ft] in each SVG's own viewBox units.
import { SHEET, viewProjection } from './util';
import type { Ctx } from './types';

const lerp = (x: number, xs: number[], ys: number[]) => {
  if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1);
};
/** cumulative elevation gain over 0.05 mi samples: ±0.25 mi moving average, then a 10 ft hysteresis so GPS noise does not count as climbing */
export const GAIN = { halfWin: 5, threshold: 10 };
export function cumGain(ft: number[]) {
  const n = ft.length, sm = ft.map((_, i) => { let t = 0, c = 0; for (let j = Math.max(0, i - GAIN.halfWin); j <= Math.min(n - 1, i + GAIN.halfWin); j++) { t += ft[j]; c++; } return t / c; });
  const out: number[] = []; let a = sm[0], gain = 0;
  for (const v of sm) {
    if (v - a >= GAIN.threshold) { gain += v - a; a = v; } else if (a - v >= GAIN.threshold) a = v;
    out.push(Math.round(gain));
  }
  return out;
}
export function hoverData(c: Ctx) {
  const L = c.layout, view = (k: string) => { const v = L.views[k]; return viewProjection(v, v.fig[2] * SHEET.w, v.fig[3] * SHEET.h); };
  const VM = view('main'), r1 = (v: number) => Math.round(v * 10) / 10;
  const courses: Record<string, { color: string; dist: number; s: number[][] }> = {};
  for (const k of c.courses.order) {
    const f = c.courseGeo[k].features[0], mi: number[] = f.properties.mi, co: [number, number][] = f.geometry.coordinates, VK = view(k), pr = c.profiles[k];
    const lon = co.map((q) => q[0]), lat = co.map((q) => q[1]), dist = f.properties.distance_mi, s: number[][] = [];
    for (let m = 0; m <= dist + 1e-9; m += 0.05) {
      const ll: [number, number] = [lerp(m, mi, lon), lerp(m, mi, lat)], a = VM.p(ll), b = VK.p(ll);
      s.push([Math.round(m * 100) / 100, Math.round(lerp(m, pr.mi, pr.ft)), r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1])]);
    }
    const g = cumGain(s.map((q) => lerp(q[0], pr.mi, pr.ft)));
    s.forEach((q, i) => q.push(g[i]));
    courses[k] = { color: c.courses.colors[k], dist, s };
  }
  const W = L.elev[2] * SHEET.w, H = L.elev[3] * SHEET.h;
  return { profile: { W, H, x: L.elev_xlim, y: L.elev_ylim }, courses };
}
