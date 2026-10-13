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
const dist: Record<string, any> = {};
for (const k of ORDER) {
  const e26 = RS.events.find((e: any) => e.year === 2026 && evKey(e.name) === k), s = e26.result_sets[0];
  const fin: number[] = s.finish_s, dnf = s.status.DNF ?? 0, q = (p: number) => fin[Math.min(fin.length - 1, Math.floor(p * fin.length))];
  // expected 2027 starters: registrant counts are not public (RunSignup participants API: Permission Denied) ->
  // historical starters for this exact event (2026 = the only year on the current courses, except 10K/20K which also ran 2019-2025 on similar courses)
  dist[k] = { source_event: `${e26.year} ${s.name}`, finish_s: fin, finishers: fin.length, dnf, starters: fin.length + dnf, expected_starters: fin.length + dnf, expected_basis: '2026 starters (finishers + DNF); 2027 registrant counts not publicly accessible', q10: q(0.1), q50: q(0.5), q90: q(0.9) };
}

// ---------- pace model along each course ----------
// grade-adjusted pace: time per mile ∝ 1 + 8·g uphill, max(0.8, 1 + 3·g) downhill (g = smoothed grade), so a runner's
// fraction of total effort reached at mile m is E(m)/E(total); runner finishing in T is at E⁻¹(t/T).
const start = (k: string) => { const [hm, ap] = courses.courses[k].start.split(' '), [h, mi] = hm.split(':').map(Number); return (h % 12 + (ap === 'PM' ? 12 : 0)) * 60 + mi; };
const effort: Record<string, { mi: number[]; e: number[] }> = {};
for (const k of ORDER) {
  const p = J(`content/profiles/${k}.json`), mi: number[] = p.mi, ft: number[] = p.ft, n = mi.length;
  const sm = ft.map((_, i) => { let t = 0, c = 0; for (let j = 0; j < n; j++) if (Math.abs(mi[j] - mi[i]) <= 0.25) { t += ft[j]; c++; } return t / c; });
  const e = [0]; for (let i = 1; i < n; i++) { const dm = mi[i] - mi[i - 1]; const g = dm > 0 ? (sm[i] - sm[i - 1]) / (dm * 5280) : 0; e.push(e[i - 1] + dm * (g >= 0 ? 1 + 8 * g : Math.max(0.8, 1 + 3 * g))); }
  effort[k] = { mi, e: e.map((v) => v / e[n - 1]) };
}
const lerp = (x: number, xs: number[], ys: number[]) => { if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return ys[ys.length - 1]; let lo = 0, hi = xs.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; } return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1); };
const fracAt = (k: string, mile: number) => lerp(mile, effort[k].mi, effort[k].e);
const mileAt = (k: string, frac: number) => lerp(frac, effort[k].e, effort[k].mi);

// ---------- simulate: one runner per 2026 finisher (scaled to expected starters) ----------
// DNF runners (assumption): they follow the median finisher's pace and stop at the course's middle aid-station visit.
const T0 = Math.floor(Math.min(...ORDER.map(start), d17.dawn) / 60) * 60 - 60, T1 = 26 * 60; // window: 1 h before first start .. 2:00 next day
const nb = Math.ceil((T1 - T0) / BIN), bins = (n: number) => new Array(n).fill(0);
const out: any = { source: RS.source, fetched: RS.fetched, generated: new Date().toISOString(), date: '2027-01-17', window: [T0, T1], bin_min: BIN, sun, caps, history, courses: {}, stations: {} };
const stBins: Record<string, number[]> = Object.fromEntries(stations.order.map((s: string) => [s, bins(nb)]));
const stByCourse: Record<string, Record<string, number[]>> = {};
const runners: Record<string, { T: number; stop?: number }[]> = {};
for (const k of ORDER) {
  const D = dist[k], S0 = start(k), cuts = cutoffs[k], total = courses.courses[k].distance_mi;
  const midStop = cuts[Math.floor(cuts.length / 2)].mile;
  const R: { T: number; stop?: number }[] = D.finish_s.map((s: number) => ({ T: s / 60 }));
  for (let i = 0; i < D.dnf; i++) R.push({ T: D.q50 / 60, stop: midStop });
  runners[k] = R;
  const onCourse = bins(nb); stByCourse[k] = {};
  for (const r of R) {
    const endMin = r.stop != null ? S0 + r.T * fracAt(k, r.stop) : S0 + r.T;
    for (let b = 0; b < nb; b++) { const t = T0 + (b + 0.5) * BIN; if (t >= S0 && t <= endMin) onCourse[b]++; }
    for (const c of cuts) { if (c.mile === 0 || (r.stop != null && c.mile > r.stop)) continue; const t = S0 + r.T * fracAt(k, c.mile), b = Math.floor((t - T0) / BIN); if (b >= 0 && b < nb) { stBins[c.station][b]++; (stByCourse[k][c.station] ??= bins(nb))[b]++; } }
  }
  const pass = cuts.map((c: any) => ({ station: c.station, mile: c.mile, cutoff: c.cutoff, first: S0 + D.finish_s[0] / 60 * fracAt(k, c.mile), median: S0 + D.q50 / 60 * fracAt(k, c.mile), last: S0 + D.finish_s[D.finish_s.length - 1] / 60 * fracAt(k, c.mile) }));
  out.courses[k] = { start: S0, distance_mi: total, ...Object.fromEntries(Object.entries(D).filter(([kk]) => kk !== 'finish_s')), finish_s: D.finish_s, on_course: onCourse, passes: pass, effort: { mi: effort[k].mi.filter((_, i) => i % 15 === 0).concat(total), e: effort[k].e.filter((_, i) => i % 15 === 0).concat(1).map((v) => +v.toFixed(4)) } };
}
const parseHours = (h: string) => { const t = (s: string) => { const m = s.trim().match(/^(\d+)(?::(\d\d))?([ap])$/)!; let H = Number(m[1]) % 12 + (m[3] === 'p' ? 12 : 0); return H * 60 + Number(m[2] ?? 0); }; const [a, b] = h.split('-').map(t); return [a, b < a ? b + 1440 : b]; };
for (const s of stations.order) {
  const B = stBins[s], peak = B.reduce((bi, v, i) => (v > B[bi] ? i : bi), 0), b30 = bins(Math.ceil(nb / 2)); B.forEach((v, i) => (b30[i >> 1] += v));
  const p30 = b30.reduce((bi, v, i) => (v > b30[bi] ? i : bi), 0);
  out.stations[s] = { name: stations.stations[s].name, hours: stations.stations[s].hours, window: stations.stations[s].hours ? parseHours(stations.stations[s].hours) : null, passes15: B, by_course15: Object.fromEntries(ORDER.filter((k) => stByCourse[k][s]).map((k) => [k, stByCourse[k][s]])), total_passes: B.reduce((a, b) => a + b, 0), peak15: { start: T0 + peak * BIN, count: B[peak] }, peak30: { start: T0 + p30 * 30, count: b30[p30] } };
}
out.assumptions = [
  'Finish-time distributions per 2027 distance = 2026 RunSignup results for the identically named event (same start times); one simulated runner per 2026 finisher.',
  'Expected 2027 starters = 2026 starters (finishers + DNF): 2027 registrant counts are not public (RunSignup participants endpoint returns Permission Denied). 2027 caps from RunSignup are shown for reference only.',
  'Pre-2026 years ran 50M / 50K / 30K (plus 10K, 20K) on different courses: used for volume history only, not for times.',
  'Pace along the course: grade-adjusted (time/mile ∝ 1+8g uphill, max(0.8, 1+3g) downhill on a 0.25 mi-smoothed profile); every runner keeps the same relative pace profile, scaled to their finish time. No fatigue or aid-station stop time.',
  'DNF runners follow the 2026 median finisher pace and stop at the middle aid-station visit of their course.',
  'Start times and station hours/cutoffs from the race sheet (content/); RunSignup lists the 2027 100K start as 05:30 while the sheet says 5:00 AM — the sheet is used.',
];
fs.writeFileSync(path.join(ROOT, 'content/timeline.json'), JSON.stringify(out) + '\n');
const hm = (m: number) => { const d = m >= 1440 ? ' (+1)' : ''; m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}${d}`; };
console.log('sun 17:', 'dawn', hm(d17.dawn), 'rise', hm(d17.sunrise), 'set', hm(d17.sunset), 'dusk', hm(d17.dusk));
for (const k of ORDER) console.log(k, 'starters', dist[k].starters, 'q10/50/90', [dist[k].q10, dist[k].q50, dist[k].q90].map((s) => hm(s / 60)).join(' '));
for (const s of stations.order) { const o = out.stations[s]; console.log(s, o.name, 'passes', o.total_passes, 'peak30', hm(o.peak30.start), o.peak30.count, 'peak15', hm(o.peak15.start), o.peak15.count, 'hours', o.hours); }
