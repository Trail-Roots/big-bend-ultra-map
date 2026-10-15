import { cutMin } from './timeline';
// Data for the elevation-profile hover: per course, samples every 0.05 mi of
// [mile, ft, main-map x, y, mini-map x, y, cumulative gain ft] in each SVG's own viewBox units.
import { SHEET, viewProjection } from './util';
import { miniBib, MINIBIB } from './panels';
import type { Ctx } from './types';

const lerp = (x: number, xs: number[], ys: number[]) => {
  if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1);
};
/** cumulative elevation gain over 0.05 mi samples: ±0.25 mi moving average, then a 10 ft hysteresis so GPS noise does not count as climbing */
export const GAIN = { halfWin: 5, threshold: 10 };
/** small seeded PRNG (mulberry32) so bootstrapped dots are stable between builds */
const rng = (key: string) => { let h = 2166136261; for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
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
    courses[k] = { color: c.courses.colors[k], dist, s, bib: miniBib(k, c.courses.colors[k], 0, 0, c.colors, 0.85),
      // cutoffs as [mile, minutes after the start] for the "pace to make the next cutoff" readout
      cut: (() => { const st = cutMin(c.courses.courses[k].start)!; return c.cutoffs[k].slice(1).map((q: any) => { let m = cutMin(q.cutoff); if (m == null) return null; if (m < st) m += 1440; return [q.mile, m - st, q.station]; }).filter(Boolean); })() } as any;
  }
  (courses as any)._bibw = MINIBIB.w * 0.85; (courses as any)._bibh = MINIBIB.h * 0.85;
  const W = L.elev[2] * SHEET.w, H = L.elev[3] * SHEET.h;
  // time model for the race-day timeline / auto-play / runner dots (content/timeline.json)
  const TL = c.timeline, time = { t0: TL.window[0], t1: TL.window[1], bin: TL.bin_min, sun: TL.sun.jan17, courses: Object.fromEntries(c.courses.order.map((k) => {
    const C = TL.courses[k], fin = C.finish_s.map((v: number) => Math.round(v / 6) / 10), mid = C.passes[Math.floor(C.passes.length / 2)].mile;
    const midFit = C.curves.fitOf[Math.floor(C.curves.fitOf.length / 2)];
    let T: number[] = [...fin, ...new Array(C.dnf).fill(Math.round(C.q50 / 6) / 10)], stop: number[] = [...fin.map(() => -1), ...new Array(C.dnf).fill(mid)], fit: number[] = [...C.curves.fitOf, ...new Array(C.dnf).fill(midFit)];
    // expected runners N != 2026 starters: bootstrap whole 2026 runners (seeded, ±1% time jitter) so the dots keep the 2026 clustering
    const N = C.expected_starters ?? T.length;
    if (N !== T.length) { const r = rng(k), idx = Array.from({ length: N }, (_, i) => (i < T.length && N > T.length ? i : Math.floor(r() * T.length)));
      T = idx.map((i, j) => (j < T.length && N > T.length ? T[i] : Math.round(T[i] * (1 + (r() - 0.5) * 0.02) * 10) / 10)); stop = idx.map((i) => stop[i]); fit = idx.map((i) => fit[i]); }
    // mass-start crossing delay (same as scripts/timeline.ts): never before the gun, 0..2 min after, skewed early
    const off = T.map((_, i) => 2 * ((i + 0.5) / T.length) ** 2);
    return [k, { start: C.start, T, off, stop, fit, curves: C.curves.byFit, med: C.q50 / 60, medFit: midFit, on: C.on_course, rec: { T: C.record.s / 60, year: C.record.year, fit: C.curves.fitOf[0] }, fin }];
  })) };
  return { profile: { W, H, x: L.elev_xlim, y: L.elev_ylim }, courses, time };
}
