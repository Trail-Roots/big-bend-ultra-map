// Content pipeline: raw inputs in /sources -> /content (GeoJSON/JSON consumed by /site).
// Run: bun run content
import fs from 'node:fs';
import path from 'node:path';
import { alongRoute, type ArrowsFile } from './lib/arrows';
import { loadMyMap, MYMAP_KML } from './lib/mymap';
import { loadCalendar, inRaceYear, raceMin, CAL_ICS } from './lib/calendar';
import { type XY, merc, unmerc, ll, r6, hyp, cumlen, interpolate, simplify, simplifyTP, chaikin, hav, interp, fc } from './lib/geo';

const ROOT = path.resolve(import.meta.dir, '..');
const SRC = path.join(ROOT, 'sources'), OUT = path.join(ROOT, 'content');
const rd = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');
const rj = (p: string) => JSON.parse(rd(p));
const w = (n: string, o: unknown) => { const f = path.join(OUT, n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };

// ---------- constants (palette / station naming) ----------
export const ORDER = ['100K', '55K', '35K', '20K', '10K'] as const;
type Course = (typeof ORDER)[number];
const C: Record<Course, string> = { '100K': '#d6336c', '55K': '#e8891c', '35K': '#3d8b3d', '20K': '#1f6fb2', '10K': '#7b3fa0' };
const NAME: Record<string, string> = { 'S/F': 'Start / Finish', '1': 'Waterhole', '2': 'Contrabando', '3': 'Whit Roy', '4': 'Shutup', '5': 'Solitario' };
// long (full) names: official race-sheet names; Start/Finish from the race calendar location
const LONG: Record<string, string> = { 'S/F': 'Barton Warnock Visitor Center', '1': 'At Buena Suerte Rd', '2': 'West Contrabando', '3': 'Whit Roy Mine', '4': 'Righthand Shutup', '5': 'Paso al Solitario' };
const KN: Record<string, string> = { 'S/F': 'Start / Finish Line', '1': 'Waterhole Aid', '2': 'Contrabando Aid', '3': 'Whit Roy Aid', '4': 'Right Hand Shutup Aid', '5': 'Solitario Aid' };
const SPEC = new Set(['S/F', '2']);
const RINCON: XY = [-103.8572918, 29.4076521];
// opening-hours rule: earliest start + miles × pace (min/mile), rounded to nearest 15 min, never before 5a
const PACE = (st: string) => (st === '1' || st === '3' ? 4 : 5);
const SF_HOURS = '4:30a - 1a'; // opens 1 h before the earliest start (100K 5:30a per RunSignup)
// sheet station names -> station ids
const SHEET_ID: Record<string, string> = { 'Barton Warnock': 'S/F', Finish: 'S/F', Waterhole: '1', 'Whit Roy': '3', 'Whit Roy Mine': '3', 'Right Hand Shutup': '4', 'Paso al Solitario': '5', Contrabando: '2', Contabando: '2' };

// ---------- official stations sheet (CSV export of the Google Sheet) ----------
function csvRows(t: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
type Stop = [string, number, string];
const S = {} as Record<Course, Stop[]>;
{
  let cur: Course | null = null;
  for (const r of csvRows(rd('sheet.csv'))) {
    if ((ORDER as readonly string[]).includes(r[0]) && r[1] === 'Mileage') { cur = r[0] as Course; S[cur] = []; continue; }
    if (!cur || !r[0]) { cur = r[0] ? cur : null; continue; }
    const id = SHEET_ID[r[0].trim()];
    if (!id) continue; // e.g. 10K "Turn Around ** No Aid Station **"
    S[cur].push([id, Number(r[1]), r[3].trim() || 'TBD']);
  }
}

// ---------- logistics My Map (KML) station points ----------
const kml = rd('logistics.kml');
const PTS: { folder: string; name: string; pt: XY }[] = [];
for (const [, f, body] of kml.matchAll(/<Folder>\s*<name>(.*?)<\/name>([\s\S]*?)<\/Folder>/g))
  for (const [, n, pb] of body.matchAll(/<Placemark>\s*<name>(.*?)<\/name>([\s\S]*?)<\/Placemark>/g)) {
    if (pb.includes('<LineString>')) continue;
    const c = pb.match(/<coordinates>\s*([^<]*)<\/coordinates>/);
    if (c) { const [x, y] = c[1].trim().split(/\s+/)[0].split(',').map(Number); PTS.push({ folder: f, name: n.trim(), pt: [x, y] }); }
  }
const kpt = (n: string) => { const p = PTS.find((x) => x.folder === 'Aid' && x.name === n); if (!p) throw new Error('KML point ' + n); return p.pt; };
const SLL: Record<string, XY> = Object.fromEntries(Object.entries(KN).map(([k, n]) => [k, kpt(n)]));
SLL.RIN = RINCON;
// Shutup (Righthand Shutup): true aid-station location from Erik (Oct 16 2026), overrides the My Map point
// precise station coordinates from Erik (Oct 16 2026), used for markers, mileage snapping and every station map link
SLL['3'] = [-103.81807186482354, 29.344005493038026];
SLL['2'] = [-103.84562511477459, 29.300372549553572];
SLL['5'] = [-103.80359661347411, 29.491795134487283];
SLL['S/F'] = [-103.75718815843129, 29.270539792542188];
SLL['4'] = [-103.86327034213237, 29.445718309498755];
const PRECISE = new Set(['S/F', '2', '3', '4', '5']);
const STEL: Record<string, number> = Object.fromEntries(Object.entries(rj('stel.json') as Record<string, number>).map(([k, v]) => [k, v * 3.281])); // m -> ft (SRTM 30 m via opentopodata, cached)

// ---------- GPX ----------
function gpx(k: Course) {
  const t = rd(`gpx/${k}.gpx`); const out: { lat: number; lon: number; ele: number | null }[] = [];
  for (const m of t.matchAll(/<trkpt([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt([^>]*)\/>/g)) {
    const a = m[1] ?? m[3], lat = Number(a.match(/lat="([-\d.]+)"/)![1]), lon = Number(a.match(/lon="([-\d.]+)"/)![1]);
    const e = (m[2] ?? '').match(/^\s*<ele>([-\d.]+)<\/ele>/);
    out.push({ lat, lon, ele: e ? Number(e[1]) : null });
  }
  return out;
}
// GPS cleanup: dedupe, remove spikes, DP ~10 m ground, Chaikin smoothing x2, resample every 12 m, then DP 2.5 m
function cleanCourse(pts: { lat: number; lon: number }[]): XY[] {
  let xy = pts.map((p) => merc([p.lon, p.lat]));
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  xy = xy.filter((p, i) => i === 0 || hyp(xy[i - 1], p) > 1.0);
  for (let it = 0; it < 5; it++) {
    const sp: number[] = [];
    for (let i = 1; i < xy.length - 1; i++) {
      const v1 = [xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]], v2 = [xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]];
      const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
      const ca = (v1[0] * v2[0] + v1[1] * v2[1]) / Math.max(l1 * l2, 1e-9);
      if (ca < -0.6 && Math.min(l1, l2) < 60) sp.push(i - 1);
    }
    if (!sp.length) break;
    const del = new Set(sp.filter((_, j) => j % 2 === 0).map((i) => i + 1));
    xy = xy.filter((_, i) => !del.has(i));
  }
  xy = simplifyTP(xy, 4 / Math.cos((lat * Math.PI) / 180));
  xy = chaikin(xy, 2);
  const cum = cumlen(xy), L = cum[cum.length - 1], rs: XY[] = [];
  for (let s = 0; s < L; s += 12) rs.push(interpolate(xy, cum, s));
  rs.push(xy[xy.length - 1]);
  return simplifyTP(rs, 2.5);
}

// ---------- time helpers ----------
const t2 = (t: string) => { const [hm, ap] = t.split(' '); const [h, m] = hm.split(':').map(Number); return (h % 12 + (ap === 'PM' ? 12 : 0)) * 60 + m; };
const tm = (t: string) => { const h0 = t2(t), h = Math.floor(h0 / 60); return h0 + (h < 5 ? 1440 : 0); };
const hm = (m: number) => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60); return mm === 0 ? `${h % 12 || 12}` : `${h % 12 || 12}:${String(mm).padStart(2, '0')}`; };
const hmx = (m: number) => hm(m) + (Math.floor(m / 60) % 24 < 12 ? 'a' : 'p');
const roundHalfEven = (x: number) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1; };
const ampm = (t: string) => t.toLowerCase().replace(' am', 'a').replace(' pm', 'p');

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
const RT = {} as Record<Course, XY[]>, RMI = {} as Record<Course, number[]>;
/** sheet mileage at every route vertex: route length remapped piecewise-linearly so station passes land on the sheet miles */
function routeMiles(k: Course, rt: XY[]) {
  const cum = cumlen(rt).map((v) => v / 1609.34), mid = S[k].slice(1, -1);
  const kn: [number, number][] = [[0, 0], [cum[cum.length - 1], S[k][S[k].length - 1][1]]];
  for (const lab of new Set(mid.map((x) => x[0]))) { const mis = mid.filter((x) => x[0] === lab).map((x) => x[1]); passes(rt, merc(SLL[lab]), mis.length).idx.forEach((i, j) => kn.push([cum[i], mis[j]])); }
  kn.sort((a, b) => a[0] - b[0]);
  return cum.map((v) => interp(v, kn.map((a) => a[0]), kn.map((a) => a[1])));
}
const G = {} as Record<Course, { lat: number[]; lon: number[]; d: number[]; el: number[] }>;
const P0 = {} as Record<Course, ReturnType<typeof gpx>>;
for (const k of ORDER) {
  const p = gpx(k); P0[k] = p;
  const d = [0]; for (let i = 1; i < p.length; i++) d.push(d[i - 1] + hav([p[i - 1].lat, p[i - 1].lon], [p[i].lat, p[i].lon]));
  G[k] = { lat: p.map((q) => q.lat), lon: p.map((q) => q.lon), d, el: p.map((q) => q.ele ?? 0) };
}
// ---------- GPX is the source of truth for mileage ----------
// Each sheet stop (order, station, cutoff time) is located on the GPX track (nearest passes, in order); its mile is the GPX
// cumulative distance there. The sheet's own mileage column is only compared (soft check, printed as a warning).
const SHEET_MI = {} as Record<Course, number[]>, MI_WARN: string[] = [];
for (const k of ORDER) {
  const g = G[k], d0 = g.d.map((v) => v / 1609.34), q = g.lat.map((la, i) => merc([g.lon[i], la]));
  SHEET_MI[k] = S[k].map((x) => x[1]);
  const mid = S[k].slice(1, -1), gm = S[k].map(() => 0); gm[gm.length - 1] = d0[d0.length - 1];
  for (const lab of new Set(mid.map((x) => x[0]))) { const at = mid.map((x, i) => [x, i + 1] as const).filter(([x]) => x[0] === lab).map(([, i]) => i); passes(q, merc(SLL[lab]), at.length).idx.forEach((ix, j) => (gm[at[j]] = d0[ix])); }
  S[k].forEach((x, i) => { const m = Math.round(gm[i] * 100) / 100; if (Math.abs(m - x[1]) > 0.1) MI_WARN.push(`${k} ${x[0]} sheet ${x[1]} mi vs GPX ${m} mi`); x[1] = m; });
}
if (MI_WARN.length) console.warn('SOFT CHECK (mileage, sheet vs GPX — GPX wins):\n  ' + MI_WARN.join('\n  '));
for (const k of ORDER) {
  const p = P0[k];
  const dist = S[k][S[k].length - 1][1];
  const rt = cleanCourse(p); RT[k] = rt; RMI[k] = routeMiles(k, rt);
  w(`courses/${k}.geojson`, fc([{ type: 'Feature', properties: { course: k, color: C[k], distance_mi: dist, mi: RMI[k].map((v) => Math.round(v * 1e4) / 1e4) }, geometry: { type: 'LineString', coordinates: ll(rt) } }]));
}

const CALD = await loadCalendar(SRC), EV = CALD.events.filter(inRaceYear);
// ---------- cutoffs: the race calendar is AUTHORITATIVE (Erik, Oct 16 2026) ----------
// every "<race> Cutoff@<station>" event sets that station visit's cutoff (the visit with the nearest sheet time; TBD-only -> the last visit)
const CUT_RE: Record<string, RegExp> = { '1': /Waterhole|Alpha/i, '2': /Contrabando|Delta/i, '3': /Whit ?Roy|Bravo/i, '4': /Right ?hand Shutup/i, '5': /Solitario/i };
const CUT_CHANGES: string[] = [];
{ const clk0 = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`; };
  for (const k of ORDER) for (const e of EV.filter((e) => new RegExp(`\\b${k} Cutoff@`).test(e.summary)).sort((a, b) => +a.start! - +b.start!)) {
    const where = e.summary.split('@')[1], sid = Object.entries(CUT_RE).find(([, re]) => re.test(where))?.[0];
    if (!sid) throw new Error(`calendar cutoff '${e.summary}' names no known aid station`);
    const t = Math.round(raceMin(e.start!)), vis = S[k].map((x, i) => [x, i] as const).slice(1, -1).filter(([x]) => x[0] === sid);
    if (!vis.length) throw new Error(`calendar cutoff '${e.summary}': ${k} has no visit to station ${sid}`);
    const known = vis.filter(([x]) => x[2] !== 'TBD'), pick = known.length ? known.sort((a, b) => Math.abs(tm(a[0][2]) - t) - Math.abs(tm(b[0][2]) - t))[0] : vis[vis.length - 1];
    const was = pick[0][2], now = clk0(t); if (was !== now) { CUT_CHANGES.push(`${k} | ${sid} @ mi ${pick[0][1]} | ${was} | ${now}`); S[k][pick[1]] = [pick[0][0], pick[0][1], now]; }
  } }
if (CUT_CHANGES.length) console.log('cutoffs from calendar (race | station | sheet | calendar):\n  ' + CUT_CHANGES.join('\n  '));
// station hours
const CLOSE: Record<string, string> = {};
for (const k of ORDER) for (const [l, , c] of S[k].slice(1)) if (c !== 'TBD' && (!(l in CLOSE) || tm(c) > tm(CLOSE[l]))) CLOSE[l] = c;
for (const l in CLOSE) CLOSE[l] = ampm(CLOSE[l]);
const OPEN: Record<string, number> = {};
for (const k of ORDER) {
  const st = t2(S[k][0][2]);
  for (const [l, mi] of S[k].slice(1, -1)) { const o = Math.max(300, roundHalfEven((st + PACE(l) * mi) / 15) * 15); if (!(l in OPEN) || o < OPEN[l]) OPEN[l] = o; }
}
const HRS: Record<string, string> = {};
for (const l in OPEN) if (l in CLOSE) HRS[l] = `${hmx(OPEN[l])} - ${CLOSE[l].replace(':00', '')}`;
HRS['S/F'] = SF_HOURS;
// ---------- race calendar (authoritative for places and times) ----------
const GH = !!process.env.GITHUB_ACTIONS, soft: string[] = [], hard: string[] = [];
const warn = (m: string) => { soft.push(m); console.warn((GH ? '::warning title=Data check::' : 'SOFT CHECK: ') + m); };
const fail = (m: string) => { hard.push(m); console.error((GH ? '::error title=Timing check::' : 'TIMING CHECK FAILED: ') + m); };
// station <- calendar events (by summary); place = the event LOCATION text (place name / address, or coordinates when that is all it gives)
const ST_RE: Record<string, RegExp> = { 'S/F': /Race Start|Finish/, '1': /Waterhole|Alpha/i, '2': /Contrabando|Delta/i, '3': /Whit ?Roy|Bravo/i, '4': /Right ?hand Shutup/i, '5': /Solitario/i };
const CAL: Record<string, { place?: string; lat?: number; lon?: number }> = {};
for (const [k, re] of Object.entries(ST_RE)) {
  const locs = EV.filter((e) => re.test(e.summary) && e.location).map((e) => e.location), uniq = [...new Set(locs)];
  if (!uniq.length) { warn(`calendar: no location for station ${k} (${NAME[k]})`); continue; }
  if (uniq.length > 1) warn(`calendar: several locations for station ${k}: ${uniq.join(' | ')} — using the most frequent`);
  const loc = uniq.sort((a, b) => locs.filter((x) => x === b).length - locs.filter((x) => x === a).length)[0], m = loc.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  CAL[k] = m ? { lat: +m[1], lon: +m[2] } : { place: loc };
}
// timing checks: starts and finishes are HARD (build fails), cutoffs and sun times are soft
const clk = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`; };
for (const k of ORDER) {
  const st = EV.find((e) => new RegExp(`\\b${k} Race Start`).test(e.summary)), fi = EV.find((e) => new RegExp(`\\b${k} Finish`).test(e.summary));
  const sStart = t2(S[k][0][2]), sFin = tm(S[k][S[k].length - 1][2]);
  if (!st) fail(`${k}: no start event in the race calendar`); else if (Math.round(raceMin(st.start!)) !== sStart) fail(`${k} start: calendar ${clk(raceMin(st.start!))} vs race sheet ${S[k][0][2]}`);
  if (!fi) fail(`${k}: no finish event in the race calendar`); else if (Math.round(raceMin(fi.start!)) !== sFin) fail(`${k} finish cutoff: calendar ${clk(raceMin(fi.start!))} vs race sheet ${S[k][S[k].length - 1][2]}`);
  for (const e of EV.filter((e) => new RegExp(`\\b${k} Cutoff@`).test(e.summary))) {
    const where = e.summary.split('@')[1], sid = Object.entries(ST_RE).find(([id, re]) => id !== 'S/F' && re.test(where))?.[0];
    if (!sid) { warn(`calendar cutoff '${e.summary}' does not name a known aid station`); continue; }
    const t = Math.round(raceMin(e.start!)), sheet = S[k].slice(1, -1).filter((x) => x[0] === sid);
    if (!sheet.some((x) => x[2] !== 'TBD' && tm(x[2]) === t)) fail(`${k} cutoff at ${LONG[sid]}: calendar ${clk(t)} vs race sheet ${sheet.map((x) => x[2]).join(' / ') || 'none'}`);
  }
}
const CAL_SUN = Object.fromEntries(['Sunrise', 'Sunset'].map((n) => [n, EV.find((e) => e.summary.includes(n))?.start]).filter(([, d]) => d).map(([n, d]) => [n, raceMin(d as Date)]));

w('stations.json', { order: ['S/F', '1', '2', '3', '4', '5'], stations: Object.fromEntries(['S/F', '1', '2', '3', '4', '5'].map((k) => [k, { name: NAME[k], kml: KN[k], lonlat: ll([merc(SLL[k])])[0], long: LONG[k], ...(CAL[k]?.place ? { place: CAL[k].place } : {}), link_lonlat: PRECISE.has(k) || CAL[k]?.lat == null ? SLL[k] : [CAL[k].lon, CAL[k].lat] /* map links always use coordinates */, hours: HRS[k] ?? null, spectator: SPEC.has(k), elevation_ft: Math.round(STEL[k] ?? 0) }])) });
w('cutoffs.json', Object.fromEntries(ORDER.map((k) => [k, S[k].map(([station, mile, cutoff]) => ({ station, mile, cutoff }))])));
// Strava route URL: only taken from the source GPX metadata (<link href="https://www.strava.com/routes/...">); never invented
const strava = (k: Course) => { const m = fs.readFileSync(path.join(SRC, 'gpx', `${k}.gpx`), 'utf8').match(/https?:\/\/(?:www\.)?strava\.com\/routes\/\d+/); return m ? m[0].replace(/^http:/, 'https:') : null; };
w('courses.json', { order: ORDER, colors: C, courses: Object.fromEntries(ORDER.map((k) => [k, { distance_mi: S[k][S[k].length - 1][1], start: S[k][0][2], color: C[k], stravaUrl: strava(k), gpx: `gpx/big-bend-ultra-${k.toLowerCase()}.gpx` }])) });
w('colors.json', { cream: '#ffffff', shade: '#888888', shade_op: 0.17, ink: '#2a2a2a', mute: '#737373', ring: '#111111', road: '#5d5850', aid_red: '#c4161c', park: '#5f8a5a', offcourse: '#9b968e', offcourse_4x4: '#8f8a82', minis_network: '#b9b3aa', minis_next: '#a9a299', boundary: '#8e8e8e', bar: '#9c2f1e' });

// elevation profiles: GPX distance remapped so station passes land on sheet mileage
function passes(q: XY[], s: XY, n: number) {
  const dd = q.map((p) => hyp(p, s)), idx: number[] = [], wd = Math.floor(dd.length * 0.03);
  for (let j = 0; j < n; j++) {
    const m = dd.slice(); for (const i0 of idx) for (let i = Math.max(0, i0 - wd); i < Math.min(m.length, i0 + wd); i++) m[i] = Infinity;
    let b = 0; for (let i = 1; i < m.length; i++) if (m[i] < m[b]) b = i; idx.push(b);
  }
  return { idx: idx.sort((a, b) => a - b), dd };
}
const EVP: [number, number, string][] = [], EVPK: [number, number, string, string][] = []; let rincon: { mi: number; ft: number }[] = [];
for (const k of ORDER) {
  const g = G[k], d0 = g.d.map((v) => v / 1609.34), e = g.el.map((v) => v * 3.281), q = g.lat.map((la, i) => merc([g.lon[i], la]));
  const mid = S[k].slice(1, -1), labs = [...new Set(mid.map((x) => x[0]))];
  let kn: [number, number][] = [[0, 0], [d0[d0.length - 1], S[k][S[k].length - 1][1]]];
  for (const lab of labs) { const mis = mid.filter((x) => x[0] === lab).map((x) => x[1]); const { idx } = passes(q, merc(SLL[lab]), mis.length); idx.forEach((i, j) => kn.push([d0[i], mis[j]])); }
  kn.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  void kn; const d = d0; // GPX distance as is (source of truth)
  for (const lab of labs) { const { idx } = passes(q, merc(SLL[lab]), mid.filter((x) => x[0] === lab).length); for (const i of idx) { EVP.push([d[i], STEL[lab], lab]); EVPK.push([Math.round(d[i] * 1000) / 1000, Math.round(STEL[lab] * 10) / 10, lab, k]); } }
  if (k === '100K') { const { idx } = passes(q, merc(SLL.RIN), 1); rincon = [{ mi: Math.round(d[idx[0]] * 100) / 100, ft: Math.round(STEL.RIN) }]; }
  const n = Math.min(d.length, 1500), ii = [...new Set(Array.from({ length: n }, (_, j) => Math.trunc(n === 1 ? 0 : (j * (d.length - 1)) / (n - 1))))];
  w(`profiles/${k}.json`, { course: k, mi: ii.map((i) => Math.round(d[i] * 1000) / 1000), ft: ii.map((i) => Math.round(e[i])) });
}
// profile callout badges: merge same-station points, then nearest free slot above/below
const grp: [number[], number, string][] = [];
for (const [x, y, lab] of EVP.map((v, i) => [v, i] as const).sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1]).map((a) => a[0])) {
  const L = grp[grp.length - 1];
  if (L && L[2] === lab && Math.abs(L[0][L[0].length - 1] - x) < 0.4) L[0].push(x); else grp.push([[x], y, lab]);
}
const placed: XY[] = [], callouts: unknown[] = [];
for (const [xs, y, lab] of grp) {
  const x = xs.reduce((s, v) => s + v, 0) / xs.length; let bx = x, by = y;
  outer: for (const dy of [380, -380, 680, -680, 980]) for (const dx of [0, 0.9, -0.9, 1.6, -1.6]) {
    bx = x + dx; by = y + dy;
    if (by > 2350 && by < 5150 && placed.every(([px, py]) => Math.abs(bx - px) > 1.8 || Math.abs(by - py) > 260)) break outer;
  }
  placed.push([bx, by]); callouts.push({ xs, y, bx, by, lab });
}
w('profiles/callouts.json', { callouts, rincon, evp: EVPK }); // evp: every station pass per course (mi, ft, station, course) for the filtered elevation chart

// direction arrows: sources/arrows.json lists mile markers per course and map (show true/false); geometry comes from the route
const layout = rj('curated/layout.json');
const AR = rj('arrows.json') as ArrowsFile;
const arrows: unknown[] = [];
for (const k of ORDER) for (const [map, list] of Object.entries(AR.courses[k] ?? {})) for (const m of list) {
  if (!m.show) continue;
  const { at, dir } = alongRoute(RT[k], RMI[k], m.mile);
  arrows.push({ type: 'Feature', properties: { map, course: k, mile: m.mile, size_pt: AR.size_pt[map === 'main' ? 'main' : 'mini'] }, geometry: { type: 'LineString', coordinates: ll([[at[0] - dir[0] * 20, at[1] - dir[1] * 20], at]) } });
}
w('arrows.geojson', fc(arrows));

// park: boundary ways / polygon / inholdings, simplified (DP 2 m in Web Mercator ≈ 1.7 m ground — below one print pixel)
const simp = (ring: XY[], tol = 2) => ll(simplify(ring.map(merc), tol));
const park = rj('curated/park.geojson');
for (const f of park.features) {
  const g = f.geometry;
  if (g.type === 'LineString') g.coordinates = simp(g.coordinates);
  else if (g.type === 'Polygon') g.coordinates = g.coordinates.map((r: XY[]) => simp(r));
}
w('park.geojson', park);

// curated layers (hand-placed decisions frozen from the approved PDF): copied verbatim
for (const f of ['network.geojson', 'labels.geojson', 'area_labels.geojson', 'station_labels.geojson', 'poi_labels.geojson', 'pois.geojson', 'zoomboxes.geojson', 'layout.json', 'site.json', 'regional.geojson']) fs.copyFileSync(path.join(SRC, 'curated', f), path.join(OUT, f));
// background roads / trails that run ALONG an official route (any race GPX; GPX = source of truth) are clipped out so the route is not double-marked
// (e.g. La Posta Rd, the Piedmontoya tracks, the Solitario road toward Shutup). Buffer CLIP_M around every route, clipped only where a line stays inside it for ALONG_MIN or more (parallel duplicates; crossings stay); kept pieces that touch a clipped
// stretch are extended to the nearest route point so branches / crossings still meet the route cleanly; slivers shorter than CLIP_MIN between two
// clipped stretches are dropped. Paved highways and the connector are never clipped. The untouched curated lines stay in network_full.geojson
// (the milestone strips name on-course segments from the overlapping named roads).
{ const CLIP_M = 150, CLIP_MIN = 80, ALONG_MIN = 300, net = JSON.parse(fs.readFileSync(path.join(OUT, 'network.geojson'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'network_full.geojson'), JSON.stringify(net));
  // background park trails (OpenStreetMap, tools/osm-trails.ts): subdued foot trails shown only when zoomed to the 1 mi scale bar (bg); clipped along the routes like the rest
  { const pt = path.join(ROOT, 'sources/curated/park_trails.geojson'); if (fs.existsSync(pt)) for (const f of JSON.parse(fs.readFileSync(pt, 'utf8')).features) net.features.push({ type: 'Feature', properties: { cls: 'foot_bike', on_course: false, name: f.properties.name, bg: true }, geometry: f.geometry }); }
  const kx = 111320 * Math.cos((29.3 * Math.PI) / 180), ky = 110540, P = (c: number[]) => [c[0] * kx, c[1] * ky], U = (p: number[]) => [+(p[0] / kx).toFixed(6), +(p[1] / ky).toFixed(6)];
  const segs: number[][][] = ORDER.flatMap((k: string) => { const l = JSON.parse(fs.readFileSync(path.join(OUT, 'courses', `${k}.geojson`), 'utf8')).features[0].geometry.coordinates as number[][]; return l.slice(1).map((q, i) => [P(l[i]), P(q)]); });
  const near = (p: number[]) => { let m = Infinity, best = p; for (const [a, b] of segs) { if (Math.min(a[0], b[0]) - m > p[0] || Math.max(a[0], b[0]) + m < p[0] || Math.min(a[1], b[1]) - m > p[1] || Math.max(a[1], b[1]) + m < p[1]) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0, q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < m) { m = d; best = q; } } return { d: m, q: best }; };
  const out: unknown[] = []; let cut = 0;
  for (const f of net.features) { if (f.properties.on_course || f.properties.cls === 'paved' || f.properties.cls === 'connector' || f.geometry.type !== 'LineString') { out.push(f); continue; }
    // densify to ~5 m so clip boundaries are precise
    const src = (f.geometry.coordinates as number[][]).map(P), pts: number[][] = [src[0]];
    for (let i = 1; i < src.length; i++) { const a = src[i - 1], b = src[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5)); for (let j = 1; j <= n; j++) pts.push(j === n ? b : [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
    const bg = !!f.properties.bg, cm = bg ? 40 : CLIP_M, am = bg ? 60 : ALONG_MIN; // OSM park trails share the GPX tread: tighter buffer, any shared stretch
    const nr = pts.map(near), keep = nr.map((r) => r.d >= cm);
    if (!keep.some(Boolean)) { cut++; continue; } // the whole line lies on a route: drop it
    // only stretches that run ALONG a route for at least ALONG_MIN are clipped; shorter near-route stretches are crossings / junction approaches: kept
    for (let i = 0; i < pts.length;) { if (keep[i]) { i++; continue; } let j = i, L = 0; while (j + 1 < pts.length && !keep[j + 1]) { L += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; }
      if (L < am) for (let k = i; k <= j; k++) keep[k] = true; i = j + 1; }
    if (keep.every(Boolean)) { out.push(f); continue; }
    const runs: { i: number; j: number }[] = []; for (let i = 0; i < pts.length;) { if (!keep[i]) { i++; continue; } let j = i; while (j + 1 < pts.length && keep[j + 1]) j++; runs.push({ i, j }); i = j + 1; }
    const len = (r: { i: number; j: number }) => { let L = 0; for (let k = r.i + 1; k <= r.j; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return L; };
    // simplify the kept original vertices back (only the original vertices + the cut points) to keep the file small
    const orig = new Set<number[]>(src);
    for (const r of runs) { const both = r.i > 0 && r.j < pts.length - 1; if (both && len(r) < CLIP_MIN) continue;
      const line = pts.slice(r.i, r.j + 1).filter((q, k, a) => k === 0 || k === a.length - 1 || orig.has(q));
      if (r.i > 0) line.unshift(nr[r.i - 1].q); if (r.j < pts.length - 1) line.push(nr[r.j + 1].q);
      if (line.length >= 2) out.push({ ...f, properties: { ...f.properties, clipped: true }, geometry: { type: 'LineString', coordinates: line.map(U) } }); }
    cut++; }
      // named paved roads (FM 170, ...) render as ONE continuous path each: chain their ways end to end (reversing as needed, shared
      // endpoints deduped) so casing, fill and dash run through every joint. The Contrabando connector stub is not drawn.
      { const near = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * ky) < 3, by: Record<string, any[]> = {}, rest: any[] = [];
        for (const f of out as any[]) { if (f.properties.cls === 'connector') continue; if (f.properties.cls === 'paved' && f.properties.name && f.geometry.type === 'LineString') (by[f.properties.name] ??= []).push(f); else rest.push(f); }
        for (const [name, fs0] of Object.entries(by)) { const pool = fs0.map((f) => f.geometry.coordinates as number[][]), chains: number[][][] = [];
          while (pool.length) { let c = pool.shift()!.slice(), grew = true;
            while (grew) { grew = false; for (let i = 0; i < pool.length; i++) { const p = pool[i], a = c[0], z = c[c.length - 1];
              if (near(z, p[0])) c = c.concat(p.slice(1)); else if (near(z, p[p.length - 1])) c = c.concat(p.slice().reverse().slice(1)); else if (near(a, p[p.length - 1])) c = p.slice(0, -1).concat(c); else if (near(a, p[0])) c = p.slice().reverse().slice(0, -1).concat(c); else continue;
              pool.splice(i, 1); grew = true; break; } }
            chains.push(c); }
          for (const c of chains) rest.push({ ...fs0[0], properties: { ...fs0[0].properties }, geometry: { type: 'LineString', coordinates: c } });
          console.log(`network: ${name} ${fs0.length} ways -> ${chains.length} path${chains.length > 1 ? 's' : ''}`); }
        out.length = 0; out.push(...rest); }
  net.features = out; fs.writeFileSync(path.join(OUT, 'network.geojson'), JSON.stringify(net)); console.log(`network: ${cut} background lines clipped along the routes (${CLIP_M} m buffer)`); }
fs.cpSync(path.join(SRC, 'hillshade'), path.join(OUT, 'hillshade'), { recursive: true });
fs.cpSync(path.join(SRC, 'logos'), OUT, { recursive: true });

// station labels (sources/curated/station_labels.geojson) only hold position/alignment; name + hours text comes from stations.json
console.log('content written:', Object.entries(HRS).map(([k, v]) => `${k} ${v}`).join(' | '));
if (GH) for (const m of MI_WARN) console.warn('::warning title=Mileage check::' + m);
// ---------- logistics site plans (Erik's Google My Maps KML + OSM basemap snapshot) ----------
{ const MM = await loadMyMap(SRC), FA = [-103.7640, 29.2660, -103.7500, 29.2760]; // Barton Warnock area
  const near = (p: { coords: [number, number][] }) => p.coords.every(([x, y]) => x >= FA[0] && x <= FA[2] && y >= FA[1] && y <= FA[3]);
  const keep = MM.placemarks.filter((p) => near(p) && !/proposed parking|bus route/i.test(p.name) && ['Aid', 'Transportation'].includes(p.folder));
  w('logistics.json', { source: MYMAP_KML, fetched: MM.fetched, placemarks: keep, osm: rj('curated/finish_osm.geojson') });
  console.log('logistics:', keep.map((p) => p.name).join(', ')); }
// race-weekend calendar events for the site calendar viewer (sections/10-map.ts): times straight from the authoritative race calendar
// the web / embed calendar lists EVERY feed event that has not ended (registration, deadlines, race weekend, post-race...): no date window or type
// filter here; only events that ended more than 60 days before this build are left out of the file (the viewer hides ended events at run time)
const CAL_ALL = CALD.events.filter((e) => e.start && +(e.end ?? e.start) >= Date.now() - 60 * 864e5);
w('calendar.json', { source: CAL_ICS, fetched: CALD.fetched, events: [...CAL_ALL].sort((a, b) => +a.start! - +b.start! || a.summary.localeCompare(b.summary)).map((e) => ({ s: e.summary, a: raceMin(e.start!), b: e.end ? raceMin(e.end) : null, loc: e.location, d: e.description })) });
w('checks.json', { calendar: CAL_ICS, calendar_fetched: CALD.fetched, calendar_sun: CAL_SUN, soft: [...MI_WARN.map((m) => 'mileage (sheet vs GPX, GPX used): ' + m), ...soft], hard });
if (hard.length) { console.error(`${hard.length} timing conflict(s) between the race sheet and the race calendar — fix before publishing.`); process.exit(1); }
