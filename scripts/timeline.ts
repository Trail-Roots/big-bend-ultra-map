// Time-of-day timeline model -> content/timeline.json
// Inputs: sources/results/runsignup-163892.json (scripts/fetch-results.ts), content/{courses,cutoffs,stations}.json, content/profiles/*.json
// Everything numeric comes from those files; modelling choices are listed in `assumptions` and written to the JSON.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dir, '..'), J = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const RS = J('sources/results/runsignup-163892.json'), courses = J('content/courses.json'), cutoffs = J('content/cutoffs.json'), stations = J('content/stations.json');
const ORDER: string[] = courses.order;
const DATE = { y: 2027, m: 1, d: 17 }, TZ_OFFSET_H = -6; // America/Chicago in January = CST (UTC-6)
const SITE = { lat: 29.47, lon: -103.95, name: 'Big Bend Ranch State Park' };
const BIN = 15; // minutes

// ---------- sun (NOAA solar position equations) -> minutes after local midnight of Jan 17 ----------
function sunTimes(y: number, m: number, d: number, lat: number, lon: number, zenith: number) {
  const rad = Math.PI / 180, jd = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5;
  const calc = (rise: boolean) => {
    let t = 720 - 4 * lon; // first guess: solar noon, minutes UTC
    for (let i = 0; i < 3; i++) {
      const T = (jd + t / 1440 - 2451545) / 36525;
      const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T), e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
      const lam = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad);
      const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60, eps = eps0 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * rad);
      const dec = Math.asin(Math.sin(eps * rad) * Math.sin(lam * rad));
      const yv = Math.tan((eps / 2) * rad) ** 2;
      const eqt = 4 / rad * (yv * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * yv * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * yv * yv * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
      const ha = Math.acos(Math.cos(zenith * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
      t = 720 - 4 * (lon + (rise ? ha : -ha)) - eqt;
    }
    return t + TZ_OFFSET_H * 60; // local minutes after midnight
  };
  return { rise: calc(true), set: calc(false) };
}
const day = (d: number) => { const s = sunTimes(DATE.y, DATE.m, d, SITE.lat, SITE.lon, 90.833), c = sunTimes(DATE.y, DATE.m, d, SITE.lat, SITE.lon, 96); return { sunrise: s.rise, sunset: s.set, dawn: c.rise, dusk: c.set }; };
const d17 = day(17), d18 = day(18);
const sun = { site: SITE, tz: 'America/Chicago (CST, UTC-6)', method: 'NOAA solar equations; sunrise/sunset at zenith 90.833°, civil twilight at 96°', jan17: d17, jan18: { ...Object.fromEntries(Object.entries(d18).map(([k, v]) => [k, v + 1440])) } };

// ---------- results -> per-2027-distance finish-time distributions ----------
// 2026 events have the same names/start times as 2027 (100K, 55k, 35k, 20k, 10k); older years ran different
// distances (50M, 50K, 30K) and are kept for volume history only.
const MAP: Record<string, Record<string, string>> = { '10K': { '10K': '10K', '10k': '10K' }, '20K': { '20K': '20K', '20k': '20K' } };
const evKey = (name: string) => name.toUpperCase().replace(/\s+/g, '');
const history = RS.events.filter((e: any) => e.year < 2027 && e.result_sets.length).map((e: any) => {
  const s = e.result_sets[0], st = s.status, dnf = st.DNF ?? 0, dns = st.DNS ?? 0, fin = s.finish_s.length;
  const k = evKey(e.name), same = e.year >= 2026 && ORDER.includes(k), mapped = ORDER.includes(k) ? k : ({ '50M': '100K', '50K': '55K', '30K': '35K' } as any)[k];
  return { year: e.year, event: e.name, event_id: e.event_id, maps_to: mapped ?? null, same_course: same || ['10K', '20K'].includes(k), finishers: fin, dnf: st.DNF ?? null, dns: st.DNS ?? null, starters: fin + dnf, status_recorded: Object.keys(st).length > 0 };
});
void MAP;
const caps = Object.fromEntries(RS.events.filter((e: any) => e.year === 2027).map((e: any) => [evKey(e.name), { cap: e.participant_cap ? Number(e.participant_cap) : null, runsignup_start: e.start_time }]));
// expected 2027 runners per course: sources/curated/site.json "expectedRunners" (default = 2026 starters). Counts scale by N / 2026 starters,
// which is the expectation of resampling N runners from the 2026 empirical finish-time distribution (shape unchanged).
const SITECFG = J('sources/curated/site.json'), EXP: Record<string, number> = SITECFG.expectedRunners ?? {};
const dist: Record<string, any> = {};
for (const k of ORDER) {
  const e26 = RS.events.find((e: any) => e.year === 2026 && evKey(e.name) === k), s = e26.result_sets[0];
  const fin: number[] = s.finish_s, dnf = s.status.DNF ?? 0, q = (p: number) => fin[Math.min(fin.length - 1, Math.floor(p * fin.length))];
  // expected 2027 starters: registrant counts are not public (RunSignup participants API: Permission Denied) ->
  // historical starters for this exact event (2026 = the only year on the current courses, except 10K/20K which also ran 2019-2025 on similar courses)
  dist[k] = { source_event: `${e26.year} ${s.name}`, finish_s: fin, finishers: fin.length, dnf, starters: fin.length + dnf, expected_starters: EXP[k] ?? fin.length + dnf, expected_basis: EXP[k] != null ? 'sources/curated/site.json expectedRunners' : '2026 starters (finishers + DNF); 2027 registrant counts not publicly accessible', scale: (EXP[k] ?? fin.length + dnf) / (fin.length + dnf), q10: q(0.1), q50: q(0.5), q90: q(0.9) };
}

// ---------- pace model along each course ----------
// Grade-adjusted pace on the 0.25 mi-smoothed profile. Factor vs flat pace for a reference (~20 min/mi average) runner:
//   uphill   1 + up·g (g ≤ 0.15), then + steepUp·(g − 0.15) (power-hiking steep climbs)
//   downhill max(downFloor, 1 + down·g); beyond −10 % it slows again (+3·(−g − 0.1)) for steep / technical descents
// The grade terms are deliberately strong (uphill ≥ 14 per unit grade, steep-up ≥ 6) so the elevation profile visibly drives dot pace;
// totals stay anchored because every runner is normalised to their real finish time.
// Fitness: a runner's deviation from flat is scaled by s = (avg pace / 20 min/mi)^beta, clamped 0.4–1.5 (faster runners less affected).
// Fatigue (100K/55K only): × (1 + fatigue · mile/total). Climb fatigue (all courses): × (1 + climbFat · cumulative gain / 10,000 ft),
// so pace slows with elevation gained, not just with distance.
// Aid-station dwell: base `dwell` minutes scaled by race position (0.5× at the start .. 1.5× at the finish: short stops early, longer late)
// and halved when the previous aid-station visit was less than 3 mi earlier.
// Every runner's total time is normalised to their real 2026 finish time.
const lerp = (x: number, xs: number[], ys: number[]) => { if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1]; let lo = 0, hi = xs.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1); };
const start = (k: string) => { const [hm, ap] = courses.courses[k].start.split(' '), [h, mi] = hm.split(':').map(Number); return (h % 12 + (ap === 'PM' ? 12 : 0)) * 60 + mi; };
type Params = { up: number; steepUp: number; down: number; downFloor: number; beta: number; fatigue: number; climbFat: number; dwell: number };
const grade: Record<string, { mi: number[]; g: number[]; cg: number[] }> = {};
for (const k of ORDER) {
  const p = J(`content/profiles/${k}.json`), mi: number[] = p.mi, ft: number[] = p.ft, n = mi.length;
  const sm = ft.map((_, i) => { let t = 0, c = 0; for (let j = Math.max(0, i - 40); j < Math.min(n, i + 40); j++) if (Math.abs(mi[j] - mi[i]) <= 0.25) { t += ft[j]; c++; } return t / c; });
  const g = [0]; for (let i = 1; i < n; i++) { const dm = mi[i] - mi[i - 1]; g.push(dm > 0 ? (sm[i] - sm[i - 1]) / (dm * 5280) : 0); }
  const cg = [0]; for (let i = 1; i < n; i++) cg.push(cg[i - 1] + Math.max(0, sm[i] - sm[i - 1]));
  grade[k] = { mi, g, cg } as any;
}
const baseF = (g: number, P: Params) => g >= 0 ? (g <= 0.15 ? 1 + P.up * g : 1 + P.up * 0.15 + P.steepUp * (g - 0.15)) : Math.max(P.downFloor, 1 + P.down * g) + (g < -0.1 ? 3 * (-g - 0.1) : 0); // steep descents slow again (braking, technical footing) beyond −10 %
const fit = (paceMinMi: number, P: Params) => Math.min(1.5, Math.max(0.4, (paceMinMi / 20) ** P.beta));
const cache = new Map<string, { mi: number[]; e: number[] }>();
/** moving-time fraction reached at each profile sample (0..1), for fitness s */
function curve(k: string, s: number, P: Params) {
  const key = `${k}|${s.toFixed(2)}|${P.up},${P.steepUp},${P.down},${P.fatigue},${P.climbFat}`; let c = cache.get(key); if (c) return c;
  const { mi, g, cg } = grade[k], tot = mi[mi.length - 1], fat = k === '100K' || k === '55K' ? P.fatigue : 0;
  const e = [0]; for (let i = 1; i < mi.length; i++) e.push(e[i - 1] + (mi[i] - mi[i - 1]) * (1 + (baseF(g[i], P) - 1) * s) * (1 + fat * (mi[i] / tot)) * (1 + P.climbFat * (cg[i] / 10000)));
  c = { mi, e: e.map((v) => v / e[e.length - 1]) }; cache.set(key, c); return c;
}
const stopMiles = (k: string): number[] => cutoffs[k].filter((c: any) => c.mile > 0 && c.mile < courses.courses[k].distance_mi - 0.01).map((c: any) => c.mile);
/** dwell minutes at each aid-station visit: shorter early, halved right after another visit */
const dwells = (k: string, P: Params) => { const D = courses.courses[k].distance_mi, m = stopMiles(k); return m.map((x, i) => P.dwell * (0.5 + x / D) * (i > 0 && x - m[i - 1] < 3 ? 0.5 : 1)); };
const dwellBefore = (k: string, mile: number, P: Params) => { const m = stopMiles(k), d = dwells(k, P); let t = 0; m.forEach((x, i) => { if (x < mile - 1e-6) t += d[i]; }); return t; };
/** elapsed minutes when a runner with finish time T (min) arrives at `mile` */
function arrive(k: string, T: number, mile: number, P: Params) {
  const D = courses.courses[k].distance_mi, s = Math.round(fit(T / D, P) * 20) / 20, c = curve(k, s, P), mov = T - dwellBefore(k, Infinity, P);
  return dwellBefore(k, mile, P) + mov * lerp(mile, c.mi, c.e);
}
// ---------- validate / tune against 2026 timing-mat splits ----------
// RunSignup 2026 "Lap 1" / "Lap 2" are cumulative times at the Waterhole mat on the way out (mile 5.1) and back (finish − 5.1 mi);
// "Lap 3" = finish. Implausible laps (≤4 % or ≥98 % of finish, or out of order) are ignored.
const VAL: { k: string; T: number; pts: [number, number][] }[] = [];
for (const k of ORDER) {
  const e = RS.events.find((x: any) => x.year === 2026 && x.name.toUpperCase().replace(/\s+/g, '') === k), set = e?.result_sets[0];
  if (!set?.splits?.length) continue;
  const D = courses.courses[k].distance_mi, w = cutoffs[k].filter((c: any) => c.station === '1').map((c: any) => c.mile);
  if (w.length < 2) continue; // 10K has no Waterhole visit
  for (const r of set.splits) {
    const T = r.finish_s / 60, [l1, l2] = [r.laps[0], r.laps[1]].map((v: number | null) => (v == null ? null : v / 60)), pts: [number, number][] = [];
    if (l1 && l1 > 0.04 * T && l1 < 0.6 * T) pts.push([w[0], l1]);
    if (l2 && l2 > 0.4 * T && l2 < 0.98 * T && (!l1 || l2 > l1)) pts.push([w[w.length - 1], l2]);
    if (pts.length) VAL.push({ k, T, pts });
  }
  void D;
}
const score = (P: Params) => { let s = 0, n = 0; for (const v of VAL) for (const [m, a] of v.pts) { s += Math.abs(arrive(v.k, v.T, m, P) - a); n++; } return s / n; };
const GRID = { up: [14, 16, 18], steepUp: [6, 8], down: [2.5, 3.5, 4.5], downFloor: [0.62], beta: [0.5, 1, 1.5], fatigue: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2], climbFat: [0, 0.05, 0.1, 0.2], dwell: [0, 2, 4, 6, 8] };
let best: { P: Params; err: number } | null = null;
for (const up of GRID.up) for (const steepUp of GRID.steepUp) for (const down of GRID.down) for (const beta of GRID.beta) for (const fatigue of GRID.fatigue) for (const climbFat of GRID.climbFat) for (const dwell of GRID.dwell) {
  const P = { up, steepUp, down, downFloor: 0.62, beta, fatigue, climbFat, dwell }, err = score(P); if (!best || err < best.err) best = { P, err };
}
const PAR = best!.P;
const noFitnessErr = score({ ...best!.P, beta: 0 });
const baselineErr = score({ up: 8, steepUp: 8, down: 3, downFloor: 0.8, beta: 0, fatigue: 0, climbFat: 0, dwell: 0 });
const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const validation = ORDER.flatMap((k) => {
  const rows = VAL.filter((v) => v.k === k); if (!rows.length) return [];
  const miles = [...new Set(rows.flatMap((r) => r.pts.map((p) => p[0])))];
  return miles.map((m) => { const P2 = rows.flatMap((r) => r.pts.filter((p) => p[0] === m).map((p) => ({ a: p[1], p: arrive(k, r.T, m, PAR) }))); return { course: k, station: 'Waterhole', mile: m, n: P2.length, actual_median_min: +med(P2.map((x) => x.a)).toFixed(1), predicted_median_min: +med(P2.map((x) => x.p)).toFixed(1), median_abs_error_min: +med(P2.map((x) => Math.abs(x.a - x.p))).toFixed(1) }; });
});
// calibration check: reference 20 min/mi runner on the 100K
const pace20 = (() => { const c = grade['100K'], s = fit(20, PAR); let w = 0; for (let i = 1; i < c.mi.length; i++) w += (c.mi[i] - c.mi[i - 1]) * (1 + (baseF(c.g[i], PAR) - 1) * s); const flat = (20 * c.mi[c.mi.length - 1]) / w; const at = (g: number) => +(flat * (1 + (baseF(g, PAR) - 1) * s)).toFixed(1); return { flat: +flat.toFixed(1), down_10pct: at(-0.1), down_15pct: at(-0.15), up_8pct: at(0.08), up_20pct: at(0.2) }; })();
const fracAt = (k: string, mile: number, T: number) => arrive(k, T, mile, PAR) / T;
/** client curves: elapsed-fraction -> mile, per fitness class (s rounded to 0.1), including aid-station dwell as flat steps for a typical runner of that class */
function curvesFor(k: string) {
  const D = courses.courses[k].distance_mi, cls = new Map<string, number[]>();
  for (const s0 of dist[k].finish_s) { const T = s0 / 60, s = (Math.round(fit(T / D, PAR) * 10) / 10).toFixed(1); (cls.get(s) ?? cls.set(s, []).get(s)!).push(T); }
  const out: Record<string, { mi: number[]; f: number[] }> = {};
  for (const [s, Ts] of cls) {
    const T = med(Ts), c = curve(k, Math.round(Number(s) * 20) / 20, PAR), mov = T - dwellBefore(k, Infinity, PAR), dw = dwells(k, PAR), mi: number[] = [], f: number[] = [];
    const stops = cutoffs[k].filter((q: any) => q.mile > 0 && q.mile < D - 0.01).map((q: any) => q.mile);
    for (let i = 0; i < c.mi.length; i += 10) { const m = c.mi[i]; mi.push(+m.toFixed(3)); f.push(+((dwellBefore(k, m, PAR) + mov * c.e[i]) / T).toFixed(5)); }
    stops.forEach((st: number, j: number) => { const t0 = arrive(k, T, st, PAR) / T; mi.push(st, st); f.push(+t0.toFixed(5), +(t0 + dw[j] / T).toFixed(5)); });
    const ord = mi.map((m, i) => [m, f[i]]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); ord.push([D, 1]);
    out[s] = { mi: ord.map((x) => x[0]), f: ord.map((x) => x[1]) };
  }
  return { fitOf: dist[k].finish_s.map((s0: number) => (Math.round(fit(s0 / 60 / D, PAR) * 10) / 10).toFixed(1)), byFit: out };
}
// ---------- simulate: one runner per 2026 finisher (scaled to expected starters) ----------
// DNF runners (assumption): they follow the median finisher's pace and stop at the course's middle aid-station visit.
const T0 = Math.floor(Math.min(...ORDER.map(start), d17.dawn) / 60) * 60 - 60, T1 = 26 * 60; // window: 1 h before first start .. 2:00 next day
const nb = Math.ceil((T1 - T0) / BIN), bins = (n: number) => new Array(n).fill(0);
const out: any = { source: RS.source, fetched: RS.fetched, generated: new Date().toISOString(), date: '2027-01-17', window: [T0, T1], bin_min: BIN, sun, caps, history, courses: {}, stations: {} };
const stBins: Record<string, number[]> = Object.fromEntries(stations.order.map((s: string) => [s, bins(nb)]));
const stByCourse: Record<string, Record<string, number[]>> = {};
// Start/Finish heat row = runners actually crossing the line per 15 min (start crossings, mid-race pass-throughs, finishes); no early-arrival or
// lingering model. Runners NOT on course but at the finish area (waiting to start / done) are a separate series (inactive15) for the floor-plan overlay:
// arrive 15-75 min before their start (triangular, mode 45 min before), finishers stay 60-120 min (uniform) after finishing.
const PRE = 0, LINGER = 0, PASS_LINGER = 0, crowd = bins(nb), crowdBy: Record<string, number[]> = {}, idle = bins(nb), idleBy: Record<string, number[]> = {};
const ARR = { lo: 15, mode: 45, hi: 75 }, STAY = { lo: 60, hi: 120 };
const triQ = (u: number) => { const { lo, mode, hi } = ARR, F = (mode - lo) / (hi - lo); return u < F ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode)); };
const idleSpan = (k: string, a: number, b: number) => { for (let bb = 0; bb < nb; bb++) { const t = T0 + (bb + 0.5) * BIN; if (t >= a && t < b) { idle[bb] += W8[k]; (idleBy[k] ??= bins(nb))[bb] += W8[k]; } } };
const W8: Record<string, number> = Object.fromEntries(ORDER.map((k) => [k, dist[k].scale]));
void PRE; void LINGER; void PASS_LINGER;
/** one line crossing at minute a -> its 15-min bin */
const presence = (k: string, a: number) => { const b = Math.floor((a - T0) / BIN); if (b >= 0 && b < nb) { crowd[b] += W8[k]; (crowdBy[k] ??= bins(nb))[b] += W8[k]; } };
// mass-start crossing delay: nobody crosses before the gun; 0..2 min after it, skewed early (quantile u -> 2*u^2 min), deterministic per runner
const startDelay = (i: number, n: number) => 2 * ((i + 0.5) / n) ** 2;
const runners: Record<string, { T: number; stop?: number }[]> = {};
for (const k of ORDER) {
  const D = dist[k], SG = start(k), cuts = cutoffs[k], total = courses.courses[k].distance_mi;
  const midStop = cuts[Math.floor(cuts.length / 2)].mile;
  const R: { T: number; stop?: number }[] = D.finish_s.map((s: number) => ({ T: s / 60 }));
  for (let i = 0; i < D.dnf; i++) R.push({ T: D.q50 / 60, stop: midStop });
  runners[k] = R;
  if (R.some((_, i) => startDelay(i, R.length) < 0 || startDelay(i, R.length) > 2)) throw new Error(`[timeline] ${k}: a start before the gun`);
  const onCourse = bins(nb); stByCourse[k] = {};
  R.forEach((r, ri) => { const S0 = SG + startDelay(ri, R.length);
    // a DNF runner drops at their aid station but stays counted on course until that station visit's cutoff (when the sweep / transport brings
    // runners in), not the moment they stop: every DNF dropping at the same instant made the bands fall before anyone had finished
    const dropAt = r.stop != null ? S0 + r.T * fracAt(k, r.stop, r.T) : 0, cutQ = r.stop != null ? cuts.find((c: any) => Math.abs(c.mile - r.stop!) < 1e-6) : null;
    const cutT = cutQ && /\d/.test(cutQ.cutoff) ? (() => { const m = cutQ.cutoff.match(/^(\d+):(\d\d) (AM|PM)$/); let v = (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]); if (v < SG) v += 1440; return v; })() : null;
    const endMin = r.stop != null ? Math.max(dropAt, cutT ?? dropAt) : S0 + r.T;
    for (let b = 0; b < nb; b++) { const t = T0 + (b + 0.5) * BIN; if (t >= S0 && t <= endMin) onCourse[b] += W8[k]; }
    presence(k, S0); if (r.stop == null) presence(k, S0 + r.T);
    for (const c of cuts) { if (c.station === 'S/F' && c.mile > 0 && c.mile < total - 0.01 && (r.stop == null || c.mile <= r.stop)) presence(k, S0 + r.T * fracAt(k, c.mile, r.T)); }
    // inactive runners at the finish area (deterministic quantiles per runner)
    const u = (ri + 0.5) / R.length, v = ((ri * 0.618034) % 1);
    idleSpan(k, SG - triQ(u), SG); if (r.stop == null) idleSpan(k, S0 + r.T, S0 + r.T + STAY.lo + v * (STAY.hi - STAY.lo));
    for (const c of cuts) { if (c.mile === 0 || (r.stop != null && c.mile > r.stop)) continue; const t = S0 + r.T * fracAt(k, c.mile, r.T), b = Math.floor((t - T0) / BIN); if (b >= 0 && b < nb) { stBins[c.station][b] += W8[k]; (stByCourse[k][c.station] ??= bins(nb))[b] += W8[k]; } }
  });
  const S0 = SG;
  const pass = cuts.map((c: any) => ({ station: c.station, mile: c.mile, cutoff: c.cutoff, first: S0 + arrive(k, D.finish_s[0] / 60, c.mile, PAR), median: S0 + arrive(k, D.q50 / 60, c.mile, PAR), last: S0 + arrive(k, D.finish_s[D.finish_s.length - 1] / 60, c.mile, PAR) }));
  // course record: fastest finish on this course. 35K/55K/100K were new in 2026 (2026 only); 10K/20K kept their names and courses 2019-2026
  const recYears = RS.events.filter((e: any) => evKey(e.name) === k && e.year < 2027 && (e.year >= 2026 || ['10K', '20K'].includes(k)) && e.result_sets[0]?.finish_s.length);
  const rec = recYears.map((e: any) => ({ s: e.result_sets[0].finish_s[0], year: e.year })).sort((a: any, b: any) => a.s - b.s)[0];
  const record = { ...rec, years: recYears.map((e: any) => e.year).sort() };
  onCourse.forEach((v, i) => (onCourse[i] = Math.round(v)));
  out.courses[k] = { start: S0, distance_mi: total, ...Object.fromEntries(Object.entries(D).filter(([kk]) => kk !== 'finish_s')), finish_s: D.finish_s, on_course: onCourse, record, passes: pass, curves: curvesFor(k) };
}
const parseHours = (h: string) => { const t = (s: string) => { const m = s.trim().match(/^(\d+)(?::(\d\d))?([ap])$/)!; let H = Number(m[1]) % 12 + (m[3] === 'p' ? 12 : 0); return H * 60 + Number(m[2] ?? 0); }; const [a, b] = h.split('-').map(t); return [a, b < a ? b + 1440 : b]; };
const rnd = (a: number[]) => a.forEach((v, i) => (a[i] = Math.round(v)));
for (const s of stations.order) rnd(stBins[s]); for (const k of ORDER) Object.values(stByCourse[k]).forEach(rnd); rnd(crowd); Object.values(crowdBy).forEach(rnd); rnd(idle); Object.values(idleBy).forEach(rnd);
for (const s of stations.order) {
  const B = stBins[s], peak = B.reduce((bi, v, i) => (v > B[bi] ? i : bi), 0), b30 = bins(Math.ceil(nb / 2)); B.forEach((v, i) => (b30[i >> 1] += v));
  const p30 = b30.reduce((bi, v, i) => (v > b30[bi] ? i : bi), 0);
  out.stations[s] = { name: stations.stations[s].name, hours: stations.stations[s].hours, window: stations.stations[s].hours ? parseHours(stations.stations[s].hours) : null, passes15: B, by_course15: Object.fromEntries(ORDER.filter((k) => stByCourse[k][s]).map((k) => [k, stByCourse[k][s]])), total_passes: B.reduce((a, b) => a + b, 0), peak15: { start: T0 + peak * BIN, count: B[peak] }, peak30: { start: T0 + p30 * 30, count: b30[p30] } };
}
{ const pk = crowd.reduce((bi, v, i) => (v > crowd[bi] ? i : bi), 0), half = crowd.map((v, i) => [v, i]).filter(([v]) => v >= 0.5 * crowd[pk]).map(([, i]) => i);
  out.finish_crowd = { name: 'Start / Finish', present15: crowd, by_course15: crowdBy, inactive15: idle, inactive_by_course15: idleBy, inactive_model: { arrive_before_start_min: ARR, stay_after_finish_min: STAY }, peak15: { start: T0 + pk * BIN, count: crowd[pk] }, above_half_peak: { from: T0 + half[0] * BIN, to: T0 + (half[half.length - 1] + 1) * BIN }, above_quarter_peak: (() => { const q = crowd.map((v, i) => [v, i]).filter(([v]) => v >= 0.25 * crowd[pk]).map(([, i]) => i); return { from: T0 + q[0] * BIN, to: T0 + (q[q.length - 1] + 1) * BIN }; })() }; }
out.pace_model = { params: PAR, grid: GRID, validation, mean_abs_error_min: +best!.err.toFixed(1), previous_model_mean_abs_error_min: +baselineErr.toFixed(1), same_without_fitness_scaling_min: +noFitnessErr.toFixed(1), beta_note: 'beta ≥ 0.5 enforced (faster runners less affected, per spec); the splits alone slightly prefer beta = 0', reference_runner_20min_mi: pace20, validated_points: VAL.reduce((a, v) => a + v.pts.length, 0) };
out.assumptions = [
  'Expected runners per course = sources/curated/site.json expectedRunners (default 2026 starters). All counts (on course, aid-station passes, finish crowd) are the 2026-shaped simulation scaled by N / 2026 starters, i.e. the expected value of resampling N runners from the 2026 finish-time distribution. Map dots bootstrap whole 2026 runners (seeded, ±1% time jitter) when N differs, keeping 2026 clustering.',
  'Start: nobody crosses the line before the gun; each runner starts 0-2 min after it (mass-start crossing delay, skewed early: runner quantile u -> 2u² min, faster runners nearer the front).',
  `Start / Finish heat row: runners crossing the line per 15 min (start crossings, mid-race pass-throughs, finishes), like every other station (passes, no early-arrival or lingering model). Finish-area floor-plan overlay (inactive runners): each runner arrives ${ARR.lo}-${ARR.hi} min before their start (triangular, mode ${ARR.mode}); finishers stay ${STAY.lo}-${STAY.hi} min after finishing. DNF runners stay counted on course until the cutoff of the station where they drop.`,
  'Finish-time distributions per 2027 distance = 2026 RunSignup results for the identically named event (same start times); one simulated runner per 2026 finisher.',
  'Expected 2027 starters = 2026 starters (finishers + DNF): 2027 registrant counts are not public (RunSignup participants endpoint returns Permission Denied). 2027 caps from RunSignup are shown for reference only.',
  'Pre-2026 years ran 50M / 50K / 30K (plus 10K, 20K) on different courses: used for volume history only, not for times.',
  `Pace along the course: grade-adjusted curve on the 0.25 mi-smoothed profile (see pace_model.params), deviation from flat scaled by fitness (avg pace / 20 min/mi)^beta; fatigue on 100K/55K; climb fatigue ${PAR.climbFat} per 10,000 ft gained; aid-station dwell ${PAR.dwell} min base, scaled 0.5× (start) to 1.5× (finish) by race position and halved when the previous visit was < 3 mi earlier; each runner normalised to their real 2026 finish time. Parameters tuned by grid search against 2026 Waterhole timing-mat splits (pace_model.validation).`,
  'DNF runners follow the 2026 median finisher pace and stop at the middle aid-station visit of their course.',
  'Start times and station hours/cutoffs from the race sheet (content/); Start times match RunSignup 2027 (race 163892): 100K 5:30a, 55K 7a, 35K 8a, 20K 8:30a, 10K 9a.',
];
fs.writeFileSync(path.join(ROOT, 'content/timeline.json'), JSON.stringify(out) + '\n');
const hm = (m: number) => { const d = m >= 1440 ? ' (+1)' : ''; m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}${d}`; };
console.log('sun 17:', 'dawn', hm(d17.dawn), 'rise', hm(d17.sunrise), 'set', hm(d17.sunset), 'dusk', hm(d17.dusk));
for (const k of ORDER) console.log(k, 'starters', dist[k].starters, 'q10/50/90', [dist[k].q10, dist[k].q50, dist[k].q90].map((s) => hm(s / 60)).join(' '));
for (const s of stations.order) { const o = out.stations[s]; console.log(s, o.name, 'passes', o.total_passes, 'peak30', hm(o.peak30.start), o.peak30.count, 'peak15', hm(o.peak15.start), o.peak15.count, 'hours', o.hours); }

console.log('params', JSON.stringify(PAR), 'err', best!.err.toFixed(1), 'beta0', noFitnessErr.toFixed(1), 'old', baselineErr.toFixed(1), 'ref20', JSON.stringify(pace20));
console.table(validation);
// soft check: modelled sunrise/sunset vs the race calendar's Sunrise/Sunset events (content/checks.json from content.ts)
{ const ck = J('content/checks.json'), cs = ck.calendar_sun ?? {}, GH = !!process.env.GITHUB_ACTIONS;
  for (const [n, mine] of [['Sunrise', d17.sunrise], ['Sunset', d17.sunset]] as [string, number][]) {
    if (cs[n] == null) { console.warn('SOFT CHECK: race calendar has no ' + n + ' event'); continue; }
    if (Math.abs(cs[n] - mine) > 3) { const m = `${n}: race calendar ${hm(cs[n])} vs computed ${hm(mine)}`; console.warn((GH ? '::warning title=Sun check::' : 'SOFT CHECK: ') + m); ck.soft.push(m); }
  }
  fs.writeFileSync(path.join(ROOT, 'content/checks.json'), JSON.stringify(ck) + '\n'); }
