// Content pipeline: raw inputs in /sources -> /content (GeoJSON/JSON consumed by /site).
// Run: bun run content
import fs from 'node:fs';
import path from 'node:path';
import { alongRoute, type ArrowsFile } from './lib/arrows';
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
const NAME: Record<string, string> = { 'S/F': 'Start / Finish', '1': 'Waterhole', '2': 'Mines', '3': 'Shutup', '4': 'Solitario', '5': 'Contrabando' };
const KN: Record<string, string> = { 'S/F': 'Start / Finish Line', '1': 'Waterhole Aid', '2': 'Whit Roy Aid', '3': 'Right Hand Shutup Aid', '4': 'Solitario Aid', '5': 'Contrabando Aid' };
const SPEC = new Set(['S/F', '5']);
const RINCON: XY = [-103.8572918, 29.4076521];
// opening-hours rule: earliest start + miles × pace (min/mile), rounded to nearest 15 min, never before 5a
const PACE = (st: string) => (st === '1' || st === '2' ? 4 : 5);
const SF_HOURS = '4:30a - 1a'; // opens 1 h before the earliest start (100K 5:30a per RunSignup)
// sheet station names -> station ids
const SHEET_ID: Record<string, string> = { 'Barton Warnock': 'S/F', Finish: 'S/F', Waterhole: '1', 'Whit Roy': '2', 'Right Hand Shutup': '3', 'Paso al Solitario': '4', Contrabando: '5', Contabando: '5' };

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
for (const k of ORDER) {
  const p = gpx(k);
  const d = [0]; for (let i = 1; i < p.length; i++) d.push(d[i - 1] + hav([p[i - 1].lat, p[i - 1].lon], [p[i].lat, p[i].lon]));
  G[k] = { lat: p.map((q) => q.lat), lon: p.map((q) => q.lon), d, el: p.map((q) => q.ele ?? 0) };
  const dist = S[k][S[k].length - 1][1];
  const rt = cleanCourse(p); RT[k] = rt; RMI[k] = routeMiles(k, rt);
  w(`courses/${k}.geojson`, fc([{ type: 'Feature', properties: { course: k, color: C[k], distance_mi: dist, mi: RMI[k].map((v) => Math.round(v * 1e4) / 1e4) }, geometry: { type: 'LineString', coordinates: ll(rt) } }]));
}

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

w('stations.json', { order: ['S/F', '1', '2', '3', '4', '5'], stations: Object.fromEntries(['S/F', '1', '2', '3', '4', '5'].map((k) => [k, { name: NAME[k], kml: KN[k], lonlat: ll([merc(SLL[k])])[0], hours: HRS[k] ?? null, spectator: SPEC.has(k), elevation_ft: Math.round(STEL[k] ?? 0) }])) });
w('cutoffs.json', Object.fromEntries(ORDER.map((k) => [k, S[k].map(([station, mile, cutoff]) => ({ station, mile, cutoff }))])));
// Strava route URL: only taken from the source GPX metadata (<link href="https://www.strava.com/routes/...">); never invented
const strava = (k: Course) => { const m = fs.readFileSync(path.join(SRC, 'gpx', `${k}.gpx`), 'utf8').match(/https?:\/\/(?:www\.)?strava\.com\/routes\/\d+/); return m ? m[0].replace(/^http:/, 'https:') : null; };
w('courses.json', { order: ORDER, colors: C, courses: Object.fromEntries(ORDER.map((k) => [k, { distance_mi: S[k][S[k].length - 1][1], start: S[k][0][2], color: C[k], stravaUrl: strava(k), gpx: `gpx/big-bend-ultra-${k.toLowerCase()}.gpx` }])) });
w('colors.json', { cream: '#ffffff', ink: '#2a2a2a', mute: '#7d766b', ring: '#111111', road: '#5d5850', aid_red: '#c4161c', park: '#5f8a5a', offcourse: '#9b968e', offcourse_4x4: '#8f8a82', minis_network: '#b9b3aa', minis_next: '#a9a299', boundary: '#8e8e8e', bar: '#9c2f1e' });

// elevation profiles: GPX distance remapped so station passes land on sheet mileage
function passes(q: XY[], s: XY, n: number) {
  const dd = q.map((p) => hyp(p, s)), idx: number[] = [], wd = Math.floor(dd.length * 0.03);
  for (let j = 0; j < n; j++) {
    const m = dd.slice(); for (const i0 of idx) for (let i = Math.max(0, i0 - wd); i < Math.min(m.length, i0 + wd); i++) m[i] = Infinity;
    let b = 0; for (let i = 1; i < m.length; i++) if (m[i] < m[b]) b = i; idx.push(b);
  }
  return { idx: idx.sort((a, b) => a - b), dd };
}
const EVP: [number, number, string][] = []; let rincon: { mi: number; ft: number }[] = [];
for (const k of ORDER) {
  const g = G[k], d0 = g.d.map((v) => v / 1609.34), e = g.el.map((v) => v * 3.281), q = g.lat.map((la, i) => merc([g.lon[i], la]));
  const mid = S[k].slice(1, -1), labs = [...new Set(mid.map((x) => x[0]))];
  let kn: [number, number][] = [[0, 0], [d0[d0.length - 1], S[k][S[k].length - 1][1]]];
  for (const lab of labs) { const mis = mid.filter((x) => x[0] === lab).map((x) => x[1]); const { idx } = passes(q, merc(SLL[lab]), mis.length); idx.forEach((i, j) => kn.push([d0[i], mis[j]])); }
  kn.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const d = d0.map((v) => interp(v, kn.map((a) => a[0]), kn.map((a) => a[1])));
  for (const lab of labs) { const { idx } = passes(q, merc(SLL[lab]), mid.filter((x) => x[0] === lab).length); for (const i of idx) EVP.push([d[i], STEL[lab], lab]); }
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
w('profiles/callouts.json', { callouts, rincon });

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
for (const f of ['network.geojson', 'labels.geojson', 'area_labels.geojson', 'station_labels.geojson', 'poi_labels.geojson', 'pois.geojson', 'zoomboxes.geojson', 'layout.json', 'site.json']) fs.copyFileSync(path.join(SRC, 'curated', f), path.join(OUT, f));
fs.cpSync(path.join(SRC, 'hillshade'), path.join(OUT, 'hillshade'), { recursive: true });
fs.cpSync(path.join(SRC, 'logos'), OUT, { recursive: true });

// station labels (sources/curated/station_labels.geojson) only hold position/alignment; name + hours text comes from stations.json
console.log('content written:', Object.entries(HRS).map(([k, v]) => `${k} ${v}`).join(' | '));
