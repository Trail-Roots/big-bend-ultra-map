// Regional mode of the main map (SSOT data + styles of mainmap.ts at a wider extent): highways, towns, hospital, Rio Grande, park boundary,
// race routes in race colours, aid stations as small markers and drive times. No hillshade, no trail labels.
// Used by (a) the PDF-only regional page (renderRegional, own projection) and (b) the web main map when zoomed out past the default frame
// (regionFrag: same layer in main-map coordinates, lazy-loaded by zoom.ts; strokes non-scaling, texts counter-scaled by zoom.ts).
// Data: content/regional.geojson (from sources/curated/regional.geojson, fetched once by tools/regional-fetch.ts; never in CI).
import { R, f1, esc, simplifyPts, station, viewProjection } from './util';
import { northG } from './north';
import { textW } from './fontw';
import { Space, place, type Pt, type Box, type Lab } from './regplace';
import type { Ctx } from './types';
const m3857 = ([lon, lat]: [number, number]) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
/** regional extent (lon / lat): Alpine + the hospital to Lajitas, Presidio to Study Butte */
export const REGION = { sw: [-104.62, 29.13] as [number, number], ne: [-103.27, 30.49] as [number, number] };
export const regionBox3857 = () => { const a = m3857(REGION.sw), b = m3857(REGION.ne); return { x: [a[0], b[0]], y: [a[1], b[1]] }; };
/** drive time label: rounded to the nearest 5 min */
export const hm = (min: number) => { const m = Math.max(5, Math.round(min / 5) * 5), h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`; };
// label placement per road leg: t = position along the leg, (dx, dy) = offset of the label anchor in 'em' of the label font, a = text-anchor
const LEG_LAB: Record<string, { t: number; dx: number; dy: number; a: string }> = {
  'Study Butte – Alpine': { t: 0.45, dx: 0.7, dy: 0, a: 'start' }, 'Presidio – Marfa': { t: 0.5, dx: -0.7, dy: 0, a: 'end' },
  'Marfa – Alpine': { t: 0.5, dx: 0, dy: -1.1, a: 'middle' }, 'Presidio – park road (end of pavement)': { t: 0.5, dx: -7, dy: 4.5, a: 'start' },
  'Lone Star Ranch Rd': { t: 0.9, dx: 0.3, dy: 1.0, a: 'start' },
  'End of pavement – Sauceda': { t: 0.3, dx: 0, dy: -1.1, a: 'middle' },
};
const TOWN_LAB: Record<string, [number, number, string]> = { Alpine: [-0.6, 0.6, 'end'], Marfa: [-0.6, -0.5, 'end'], Presidio: [-0.6, 0.4, 'end'], Redford: [-0.6, 0.35, 'end'], Lajitas: [-0.6, 0.9, 'end'], Terlingua: [0, -0.9, 'middle'], 'Study Butte': [0.6, 0.9, 'start'], Sauceda: [-0.6, -0.5, 'end'] };
const AIR_LAB: Record<string, [number, number, string]> = { 'Alpine-Casparis Airport': [-0.5, -0.7, 'end'], 'Marfa Airport': [0.5, -0.6, 'start'], 'Presidio Lely Airport': [0.5, -0.5, 'start'], 'Lajitas Airport': [0.5, 2.0, 'start'], 'Sauceda airstrip': [0.5, 0.6, 'start'], 'Terlingua Ranch Airport': [-0.5, -0.6, 'end'] };
type P = (q: [number, number]) => [number, number];
/** the regional layer; fs = label font size, sw = stroke unit (both in output units); web = non-scaling strokes */
export function regionLayer(c: Ctx, proj: P, o: { fs: number; sw: number; tol: number; web: boolean; inner?: boolean }) {
  const F = (c as any).regional.features as any[], col = c.colors, ve = o.web ? ' vector-effect="non-scaling-stroke"' : '';
  const d = (cs: [number, number][]) => 'M' + simplifyPts(cs.map(proj), o.tol).map((q) => `${f1(q[0])},${f1(q[1])}`).join('L');
  const ln = (cs: [number, number][], st: string, w: number, ex = '') => `<path d="${d(cs)}" fill="none" stroke="${st}" stroke-width="${f1(w * o.sw)}" stroke-linejoin="round" stroke-linecap="round"${ex}${ve}/>`;
  const halo = `stroke="#fff" stroke-width="${f1(o.fs * 0.28)}" paint-order="stroke" stroke-linejoin="round"`;
  const txt = (x: number, y: number, s: string, ex = '', fs = o.fs, a = 'middle') => `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(fs)}" text-anchor="${a}" dominant-baseline="central" ${halo} ${ex}>${s}</text>`;
  let s = '';
  // county lines (OSM admin_level 6): faint gray dash-dot, distinct from the dotted park boundary
  const rvP = F.filter((f) => f.properties.kind === 'river').flatMap((f) => f.geometry.coordinates).flat() as number[][], onRiver = (l: number[][]) => l.length > 2 && l.every((p) => rvP.some((q) => Math.abs(q[0] - p[0]) < 0.004 && Math.abs(q[1] - p[1]) < 0.004));
  for (const f of F.filter((f) => f.properties.kind === 'county')) for (const l of f.geometry.coordinates) if (!onRiver(l)) s += ln(l, '#c6c6c6', 0.7, ` stroke-dasharray="${f1(6 * o.sw)} ${f1(2.5 * o.sw)} ${f1(1 * o.sw)} ${f1(2.5 * o.sw)}"`);
  // Rio Grande = the international border
  for (const f of F.filter((f) => f.properties.kind === 'river')) for (const l of f.geometry.coordinates) s += ln(l, '#9fb6c6', 1.6);
  // park boundary (subtle; full outline — the main map only draws the part in its frame)
  if (!o.inner) for (const f of c.park.features) if (f.properties.kind === 'park') s += `<path d="${f.geometry.coordinates.map((r: [number, number][]) => d(r) + 'Z').join('')}" fill="${col.park}" fill-opacity=".07" stroke="${col.boundary}" stroke-width="${f1(1 * o.sw)}" stroke-dasharray="${f1(1 * o.sw)} ${f1(2.5 * o.sw)}" stroke-linecap="round"${ve}/>`;
  // highways: casing + gray line (neutral); park dirt road: dashed
  const roads = F.filter((f) => f.properties.kind === 'road'), park = F.filter((f) => f.properties.kind === 'parkroad');
  for (const f of roads) s += ln(f.geometry.coordinates, '#fff', 3.4);
  for (const f of roads) s += ln(f.geometry.coordinates, '#8a8a8a', 2);
  for (const f of park) s += ln(f.geometry.coordinates, '#8a8a8a', 1.3, ` stroke-dasharray="${f1(3 * o.sw)} ${f1(2 * o.sw)}"`);
  for (const f of F.filter((f) => f.properties.kind === 'airstrip')) for (const r of f.properties.runways || []) s += ln(r, '#7d7d7d', 2.6, ' stroke-linecap="butt"');
  return { lines: s, F, txt, d, ln };
}
/** drive times at the points: from -> rows "to  time · mi" (OSRM on OSM roads; park dirt road 5 min/mi) */
const DN: Record<string, string> = { 'S/F': 'Start / Finish', Hospital: 'Hospital' };
const drives = (F: any[], from: string, to: string[]) => to.map((t) => [t, F.find((f) => f.properties.kind === 'drive' && ((f.properties.from === from && f.properties.to === t) || (f.properties.from === t && f.properties.to === from)))]).filter((q) => q[1]).map(([t, f]) => `${esc(DN[t] || t)}: ${hm(f.properties.min)} · ${Math.round(f.properties.mi)} mi`);
/** placement (lon / lat of the block's anchor, text-anchor) of the Start / Finish drive-time block, county names, park name, Mexico */
export const RLAB = { sf: [-104.555, 29.19, 'start'] as [number, number, string], mexico: [-103.93, 29.16] as [number, number], park: [-104.07, 29.41] as [number, number],
  counties: [['BREWSTER COUNTY', -103.6, 29.8], ['PRESIDIO COUNTY', -104.4, 30.05], ['JEFF DAVIS COUNTY', -104.2, 30.62]] as [string, number, number][] };
/** closed county rings (lon/lat) from the curated county boundary pieces; sides outside the regional extent are closed with far-away corners */
export function countyRings(F: any[]): Record<string, number[][]> {
  const seg = (n: string) => F.find((f) => f.properties.kind === 'county' && f.properties.name === n).geometry.coordinates as number[][][];
  const chain = (L: number[][][]) => { const r = L.map((l) => l.slice()), out = r.shift()!; while (r.length) { const e = out.at(-1)!; let bi = 0, bd = 1e9, rev = false;
    r.forEach((l, i) => { const d0 = Math.hypot(l[0][0] - e[0], l[0][1] - e[1]), d1 = Math.hypot(l.at(-1)![0] - e[0], l.at(-1)![1] - e[1]); if (d0 < bd) { bd = d0; bi = i; rev = false; } if (d1 < bd) { bd = d1; bi = i; rev = true; } });
    const l = r.splice(bi, 1)[0]; out.push(...(rev ? l.reverse() : l)); } return out; };
  const pres = chain(seg('Presidio County')), jdS = chain(seg('Jeff Davis County').filter((l) => l[0][1] < 30.7 && l.at(-1)![1] < 30.7)); // JD south edge (Presidio + Brewster sides)
  if (jdS[0][0] > jdS.at(-1)![0]) jdS.reverse(); // west -> east
  const east = pres.filter((p) => p[0] > -103.83).sort((a, b) => a[1] - b[1]); // Presidio's east edge, south -> north
  return { 'PRESIDIO COUNTY': pres, 'JEFF DAVIS COUNTY': [...jdS, [jdS.at(-1)![0], 31.5], [-105.5, 31.5], [-105.5, jdS[0][1]]],
    'BREWSTER COUNTY': [...east, ...jdS.filter((p) => p[0] >= -103.81), [-102.5, 30.67], [-102.5, 28.5], [east[0][0], 28.5]] };
}
/** Mexico = south of the Rio Grande (closed far to the south) */
export const mexRing = (riv: number[][]) => { const r = riv[0][0] < riv.at(-1)![0] ? riv : riv.slice().reverse(); return [...r, [r.at(-1)![0] + 1, 27.5], [r[0][0] - 1, 27.5]]; };
/** small upright airplane silhouette, unit size centred on 0,0 (airstrip symbol) */
/** small gas pump centred on (x, y), height t */
export const PUMP = (x: number, y: number, t: number, sw: number) => `<rect x="${f1(x - t * 0.36)}" y="${f1(y - t * 0.45)}" width="${f1(t * 0.5)}" height="${f1(t * 0.9)}" rx="${f1(t * 0.06)}" fill="#6b6b6b" stroke="#fff" stroke-width="${f1(sw)}"/><rect x="${f1(x - t * 0.27)}" y="${f1(y - t * 0.36)}" width="${f1(t * 0.32)}" height="${f1(t * 0.22)}" fill="#fff"/><path d="M${f1(x + t * 0.14)},${f1(y - t * 0.2)}h${f1(t * 0.14)}v${f1(t * 0.5)}h${f1(t * 0.1)}v${f1(-t * 0.62)}" fill="none" stroke="#6b6b6b" stroke-width="${f1(t * 0.08)}"/>`;
/** textPath guide: extend both ends along their end tangents (glyphs past a path end are not drawn; the placer already checked the space) */
const extendPath = (q: Pt[]): Pt[] => { if (q.length < 2) return q; const e = (a: Pt, b: Pt): Pt => { const dx = a[0] - b[0], dy = a[1] - b[1], m = Math.hypot(dx, dy) || 1, L = q.reduce((s, p, i) => i ? s + Math.hypot(p[0] - q[i - 1][0], p[1] - q[i - 1][1]) : 0, 0) * 0.4; return [a[0] + dx / m * L, a[1] + dy / m * L]; }; return [e(q[0], q[1]), ...q, e(q.at(-1)!, q.at(-2)!)]; };
/** runway tier by FAA id (FAA 5010 data via AirNav, checked Oct 2026): 'L' = paved runway of 5,000 ft or more, 'S' = shorter or unpaved strip.
 *  E38 Alpine-Casparis 6,002 ft asphalt · MRF Marfa 6,203 ft asphalt · KPRS Presidio Lely 5,200 ft asphalt · T89 Lajitas 6,501 ft concrete
 *  3T9 Sauceda (Big Bend Ranch SP) 5,500 ft asphalt/gravel, loose stones · 1E2 Terlingua Ranch 4,700 ft gravel/dirt, poor */
const AIR_TIER: Record<string, 'L' | 'S'> = { E38: 'L', MRF: 'L', KPRS: 'L', T89: 'L', '3T9': 'S', '1E2': 'S' };
/** single-engine propeller plane (top view: straight wing, slim fuselage, small tail, prop bar) — unpaved airstrip symbol */
export const PROP = (x: number, y: number, t: number) => { const P = (q: number[][]) => 'M' + q.map(([a, b]) => `${f1(x + a * t)},${f1(y + b * t)}`).join('L') + 'Z'; return P([[0.06, -0.4], [0.06, -0.2], [0.5, -0.2], [0.5, -0.04], [0.06, -0.04], [0.04, 0.3], [0.2, 0.3], [0.2, 0.42], [-0.2, 0.42], [-0.2, 0.3], [-0.04, 0.3], [-0.06, -0.04], [-0.5, -0.04], [-0.5, -0.2], [-0.06, -0.2], [-0.06, -0.4]]) + P([[-0.22, -0.5], [0.22, -0.5], [0.22, -0.44], [-0.22, -0.44]]); };
export const PLANE = (x: number, y: number, t: number) => { const q = [[0, -0.5], [0.07, -0.42], [0.07, -0.1], [0.5, 0.12], [0.5, 0.21], [0.07, 0.09], [0.06, 0.32], [0.2, 0.42], [0.2, 0.49], [0, 0.44], [-0.2, 0.49], [-0.2, 0.42], [-0.06, 0.32], [-0.07, 0.09], [-0.5, 0.21], [-0.5, 0.12], [-0.07, -0.1], [-0.07, -0.42]]; return 'M' + q.map(([a, b]) => `${f1(x + a * t)},${f1(y + b * t)}`).join('L') + 'Z'; };
/** placement environment: display = (output - o0) * s (web: viewBox units at the max zoom-out; PDF: sheet units); frame + obstacles in display units */
export type Env = { s: number; o0: Pt; frame: Box; lines: Pt[][]; marks: [number, number, number][]; boxes: Box[]; sfCols?: number; drives?: boolean; rowK?: number; tag?: string; qa?: boolean };
type Ln = { s: string; plain: string; fs: number; b?: boolean; i?: boolean; ls?: number; fill: string; cls?: string; ic?: ('fuel' | 'hosp')[] };
/** labels + point symbols of the regional layer (drawn above the race routes); every label placed by regplace.ts (no label on any line or marker) */
export function regionTop(c: Ctx, proj: P, o: { fs: number; sw: number; web: boolean }, env: Env) {
  const F = (c as any).regional.features as any[], fs = o.fs, S = env.s, [ox, oy] = env.o0;
  const D = (q: [number, number]): Pt => { const p = proj(q); return [(p[0] - ox) * S, (p[1] - oy) * S]; }, Out = (p: Pt): Pt => [p[0] / S + ox, p[1] / S + oy];
  const halo = `stroke="#fff" stroke-width="${f1(fs * 0.3)}" stroke-opacity=".95" paint-order="stroke" stroke-linejoin="round"`;
  const sp = new Space(Math.max(30, fs * 2));
  for (const l of env.lines) sp.line(l);
  for (const f of F) { const k = f.properties.kind, g = f.geometry; if (!g) continue;
    if (['county', 'river'].includes(k)) for (const l of g.coordinates) sp.line(l.map(D));
    if (['road', 'parkroad'].includes(k)) sp.line(g.coordinates.map(D));
    if (k === 'airstrip') for (const r of f.properties.runways || []) sp.line(r.map(D)); }
  const parkRings: Pt[][] = []; for (const f of c.park.features) if (f.properties.kind === 'park') for (const r of f.geometry.coordinates) { const q = r.map(D); parkRings.push(q); sp.line(q); }
  for (const m of env.marks) sp.circ.push(m);
  for (const b of env.boxes) sp.boxes.push(b);
  // point symbols (no labels here)
  let sym = '';
  const towns = F.filter((f) => f.properties.kind === 'town'), BIG = ['Alpine', 'Marfa', 'Presidio'], own: Record<string, number> = {};
  const grp = (a: Pt, inner: string, cls = '', lid = '') => { const A = Out(a); return `<g class="rg-pt${cls}"${lid ? ` data-lid="${esc(lid)}"` : ''} data-ax="${f1(A[0])}" data-ay="${f1(A[1])}">${inner}</g>`; };
  const L0 = (a: Pt, p: Pt): Pt => { const A = Out(a); return [A[0] + p[0] - a[0], A[1] + p[1] - a[1]]; } // group-local coords of display point p (group anchored at a)
  for (const f of towns) { const a = D(f.geometry.coordinates), r = fs * (BIG.includes(f.properties.name) ? 0.3 : 0.24), A = Out(a); own[f.properties.name] = sp.circ.push([a[0], a[1], r]) - 1;
    sym += grp(a, `<circle cx="${f1(A[0])}" cy="${f1(A[1])}" r="${f1(r)}" fill="#222" stroke="#fff" stroke-width="${f1(fs * 0.09)}"/>`, ' rg-town'); }
  const hosp = F.find((f) => f.properties.kind === 'hospital'), ha = D(hosp.geometry.coordinates), h = fs * 0.9;
  /* hospital: no own marker; red cross + name + drive times ride in the Alpine label */
  // fuel (curated from OSM amenity=fuel): one pump per town that has fuel, beside the town marker (first free spot around it)
  const FUEL = new Set(F.filter((f) => f.properties.kind === 'fuel').map((f) => f.properties.town)); // fuel pump drawn inline beside these town names
  // airstrips: traced runway stays; a small plane icon sits beside it (first free spot perpendicular to the runway)
  for (const f of F.filter((f) => f.properties.kind === 'airstrip')) { const rw = (f.properties.runways || [])[0], c0 = D(f.geometry.coordinates), big = AIR_TIER[f.properties.code] === 'L', t = fs * (big ? 1.2 : 0.75);
    let ux = 1, uy = 0; if (rw) { const a = D(rw[0]), b = D(rw.at(-1)); const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; ux = (b[0] - a[0]) / L; uy = (b[1] - a[1]) / L; }
    const half = rw ? Math.max(...rw.map((q: any) => { const p = D(q); return Math.hypot(p[0] - c0[0], p[1] - c0[1]); })) : 0; let at: Pt | null = null;
    for (const d of [0.75, 1.1, 1.5, 2, 2.6, 3.3, 4]) for (const sd of [-1, 1]) for (const al of [0, 0.5, -0.5, 1, -1]) { if (at) break; const p: Pt = [c0[0] - uy * sd * d * t + ux * al * half, c0[1] + ux * sd * d * t + uy * al * half]; if (!sp.hit([p[0] - t / 2, p[1] - t / 2, p[0] + t / 2, p[1] + t / 2], fs * 0.12)) at = p; }
    if (!at) { at = [c0[0] - uy * 0.75 * t, c0[1] + ux * 0.75 * t]; console.warn('[regional] airstrip icon crowded:', f.properties.label); }
    sp.circ.push([at[0], at[1], t * 0.55]); const A = Out(at);
    sym += grp(at, `<path d="${(big ? PLANE : PROP)(A[0], A[1], t)}" fill="#6b6b6b" stroke="#fff" stroke-width="${f1(fs * 0.06)}" stroke-linejoin="round"/>`, big ? ' rg-plane rg-plane-l' : ' rg-plane'); }
  // labels: content
  const T = (s: string, k: number, x: Partial<Ln> = {}): Ln => ({ s: esc(s), plain: s, fs: fs * k, fill: '#444', ...x });
  const ICW = (l: Ln) => (l.ic?.length || 0) * l.fs * 1.15, wOf = (l: Ln) => textW(l.plain, l.fs, l.b, l.i, l.ls || 0) + ICW(l), lh = (l: Ln) => l.fs * 1.24;
  type Item = Lab & { L: Ln[]; cols?: number };
  const items: Item[] = [], blk = (id: string, L: Ln[], x: Omit<Lab, 'id' | 'w' | 'h'>, cols = 1): Item => {
    let w: number, hh: number; const nt = L.findIndex((l) => l.cls === 'rg-drive'); if (cols === 2 && nt > 0) { const ti = L.slice(0, nt), rows = L.slice(nt), half = Math.ceil(rows.length / 2), cw = Math.max(...rows.map(wOf)); w = Math.max(...ti.map(wOf), rows.length > 1 ? cw * 2 + fs * 1.5 : cw); hh = ti.reduce((q, l) => q + lh(l), 0) + half * lh(rows[0]); }
    else { w = Math.max(...L.map(wOf)) * (nt >= 0 ? 1.06 : 1) /* drive rows render a little wider at small sizes */; hh = L.reduce((s, l) => s + lh(l), 0); }
    return { id, L, w, h: hh, cols, ...x } as Item; };
  const row = (s: string) => T(env.rowK ? s.replace(/ h( |$| ·)/g, 'h$1').replace(/ min/g, 'm') : s, env.rowK ?? 0.82, { fill: '#4a4a4a', cls: 'rg-drive' });
  const SF = (c as any).stations.stations['S/F'].lonlat, sfa = D(SF);
  // web zoomed-out frame is narrow: compact block (2-line title, 1 column, nearby towns dropped: they sit right beside the S/F)
  const road = (f: any) => f.geometry.coordinates.map(D) as Pt[];
  { const sq = D(F.find((f) => f.properties.kind === 'town' && f.properties.name === 'Sauceda').geometry.coordinates), x = sq[0], y = sq[1] + fs * 2.6; /* pinned just south of Sauceda (the Sauceda label + drive times sit north of it) */ items.push(blk('park', [T('BIG BEND RANCH', 0.62, { fill: '#9aa392', ls: 2.5 }), T('STATE PARK', 0.62, { fill: '#9aa392', ls: 2.5 })], { kind: 'area', at: [x, y], R: fs * 3, inside: parkRings, req: true })); }
  // the area north of FM 170 between Lajitas and Study Butte (Lajitas, Terlingua, Study Butte labels sit below the highway, still north of the river)
  const BELOW170 = ['Lajitas', 'Terlingua', 'Study Butte'], n170: Pt[] = (() => { const r = F.find((f) => f.properties.kind === 'road' && f.properties.name === 'Lajitas – Study Butte').geometry.coordinates as number[][], a = r[0], b = r.at(-1)!;
    return [[-104.6, a[1]], [a[0] - 0.06, a[1]], ...r, [b[0] + 0.3, b[1]], [b[0] + 0.3, 31.5], [-104.6, 31.5]].map((q) => D(q as any)); })();
  for (const f of towns.filter((f) => ['Presidio', 'Redford'].includes(f.properties.name))) { const n = f.properties.name, big = BIG.includes(n); /* placed first, close down-left (SW) of the marker on the US side */
    items.push(blk(n, [T(n, big ? 1.15 : 1.0, { b: big, fill: '#222', ic: [...(FUEL.has(n) ? ['fuel' as const] : []), ...(n === 'Alpine' ? ['hosp' as const] : [])] })], { kind: 'point', at: D(f.geometry.coordinates), r: fs * (big ? 0.3 : 0.24), own: own[n], req: true, lmax: 8, near: true, pref: 'sw' })); }
  const sau = towns.find((f) => f.properties.name === 'Sauceda');
  items.push(blk('Sauceda', [T('Sauceda', 1.0, { b: true, fill: '#222' }), ...(env.drives === false ? [] : drives(F, 'Sauceda', ['FM 170', 'Hospital', 'S/F']).flatMap((s) => s.split(': ').map((p, i) => i ? p : p + ':')).map(row))], { kind: 'point', at: D(sau.geometry.coordinates), r: fs * 0.24, own: own.Sauceda, req: true, lmax: 8, pref: 'n', near: true }));
  { const f = F.find((f) => f.properties.kind === 'parkroad'); if (f) items.push(blk('parkroad', [T(`${f.properties.label || 'Park road'} (dirt)`, 0.6, { i: true, fill: '#4a4a4a' })], { kind: 'line', at: [0, 0], path: road(f), t: 0.35, req: true })); }
  const sfT = [T('Drive times from Start / Finish', env.rowK ? 0.8 : 0.88, { b: true, fill: '#222' })];
  if (env.drives !== false) items.push(blk('sf', [...sfT, ...drives(F, 'S/F', ['Hospital', 'Sauceda', 'Lajitas', 'Terlingua', 'Study Butte', 'Presidio', 'Marfa', 'Alpine']).map(row)], { kind: 'point', at: sfa, r: env.marks.find((m) => Math.hypot(m[0] - sfa[0], m[1] - sfa[1]) < 2)?.[2] ?? fs, req: true, lead: true, lmax: 70 }, 2));
  const hospL = [T('Big Bend Regional', 0.8, { b: true, fill: '#a3201a' }), T('Medical Center', 0.8, { b: true, fill: '#a3201a' }), ...(env.drives === false ? [] : drives(F, 'Hospital', ['Sauceda', 'S/F']).flatMap((s) => s.split(': ').map((p, i) => i ? p : p + ':')).map(row))];
  for (const f of towns.filter((f) => !['Sauceda', 'Presidio', 'Redford'].includes(f.properties.name)).sort((a, b) => +BIG.includes(b.properties.name) - +BIG.includes(a.properties.name) || +(b.properties.name === 'Terlingua') - +(a.properties.name === 'Terlingua'))) { const n = f.properties.name, big = BIG.includes(n);
    items.push(blk(n, [T(n, big ? 1.15 : 1.0, { b: big, fill: '#222', ic: [...(FUEL.has(n) ? ['fuel' as const] : []), ...(n === 'Alpine' ? ['hosp' as const] : [])] }), ...(n === 'Alpine' ? hospL : [])], { kind: 'point', at: D(f.geometry.coordinates), r: fs * (big ? 0.3 : 0.24), own: own[n], req: true, always: n !== 'Alpine', lmax: BELOW170.includes(n) ? 13 : n === 'Alpine' ? 14 : 8, near: BELOW170.includes(n), relax: BELOW170.includes(n), outside: BELOW170.includes(n) ? [n170] : undefined })); }
  { const f = F.find((f) => f.properties.kind === 'namedroad'); if (f) { const mk = (id: string, txt: string) => blk(id, [T(txt, 0.36, { i: true, fill: '#4a4a4a' })], { kind: 'line', at: [0, 0], path: ((p: Pt[]) => { /* the road is shorter than its name: extend both ends along the end tangents so the text can run past them */ const ex = (a: Pt, b: Pt): Pt => { const dx = a[0] - b[0], dy = a[1] - b[1], m = Math.hypot(dx, dy) || 1; return [a[0] + dx / m * fs * 3.2, a[1] + dy / m * fs * 3.2]; }; return [ex(p[0], p[Math.min(3, p.length - 1)]), ...p, ex(p.at(-1)!, p[Math.max(0, p.length - 4)])]; })(road(f)), t: 0.5, req: false, grp: 'ls', tight: true }); const rp = road(f), mid = rp[Math.floor(rp.length / 2)]; items.push(mk('lonestar', 'Lonestar Rd.'), mk('lonestar-s', 'Lonestar'), blk('lonestar-p', [T('Lonestar', 0.36, { i: true, fill: '#4a4a4a' })], { kind: 'point', at: mid, r: fs * 0.1, req: true, grp: 'ls', lmax: 4, near: true, pref: 'n' })); /* "Lonestar Rd." beside the road where it fits, else "Lonestar", else a point label with a short leader (north preferred) */ } }
  const cl: Pt[][] = []; for (const f of F.filter((f) => f.properties.kind === 'county')) for (const l of f.geometry.coordinates) cl.push(l.map(D));
  // each area label must lie wholly inside its own polygon (county rings built from the curated county lines, closed outside the map)
  const CR = countyRings(F), riv = F.filter((f) => f.properties.kind === 'river').flatMap((f) => f.geometry.coordinates).sort((a: any, b: any) => b.length - a.length)[0] as number[][];
  { const pres = CR['PRESIDIO COUNTY'], pb = pres.filter((p) => p[0] > -103.83 && p[1] > 29.3 && p[1] < 30.4).sort((a, b) => a[1] - b[1]), pj = CR['JEFF DAVIS COUNTY'].filter((p) => p[0] < -103.79 && p[1] < 30.7).sort((a, b) => a[0] - b[0]);
    const R = (n: string) => CR[n].map((q) => D(q as any)), others = (n: string) => Object.keys(CR).filter((k) => k !== n).map(R);
    for (const [n, path] of [['BREWSTER COUNTY', pb], ['PRESIDIO COUNTY', pb], ['JEFF DAVIS COUNTY', pj]] as [string, number[][]][]) items.push(blk(n, [T(n, 0.72, { fill: '#9a9a9a', ls: 2 })], { kind: 'line', at: [0, 0], path: path.map((q) => D(q as any)), t: 0.5, req: n === 'BREWSTER COUNTY', outside: others(n) })); }
  const refs = new Map<string, any>(); for (const f of F.filter((f) => f.properties.kind === 'road' && f.properties.ref)) { const q = refs.get(f.properties.ref); if (!q || f.geometry.coordinates.length > q.geometry.coordinates.length) refs.set(f.properties.ref, f); }
  for (const [r, f] of refs) items.push(blk('ref ' + r, [T(r, 0.85, { b: true, fill: '#555' })], { kind: 'line', at: [0, 0], path: road(f), t: 0.5, req: false }));
  items.push(blk('MEXICO', [T('MEXICO', 1.05, { b: true, fill: '#999', ls: 3 })], { kind: 'area', at: [env.frame[0] + (env.frame[2] - env.frame[0]) * 0.2, env.frame[3] - (env.frame[2] - env.frame[0]) * 0.12], R: fs * 20, inside: [mexRing(riv).map(D)], req: false }));
  items.push(blk('TEXAS', [T('TEXAS', 1.05, { b: true, fill: '#999', ls: 3 })], { kind: 'area', at: D([-104.45, 30.05]), R: fs * 5, req: false /* open area west of US 67 */ }));
  { const rv = F.filter((f) => f.properties.kind === 'river').flatMap((f) => f.geometry.coordinates).sort((a: any, b: any) => b.length - a.length)[0]; if (rv) items.push(blk('Rio Grande', [T('Rio Grande', 0.88, { i: true, fill: '#5b7d93' })], { kind: 'line', at: [0, 0], path: rv.map(D), t: 0.3, req: false })); }
  if (0) for (const f of F.filter((f) => f.properties.kind === 'airstrip' && f.properties.label)) items.push(blk('air ' + f.properties.label, [T(f.properties.label, 0.6, { i: true, fill: '#555' })], { lmax: 8, always: true, side: /Casparis/.test(f.properties.label) ? 1 : undefined, kind: 'point', at: D(f.geometry.coordinates), r: Math.max(fs * 0.3, ...(f.properties.runways || []).flat().map((q: any) => { const p = D(q), a = D(f.geometry.coordinates); return Math.hypot(p[0] - a[0], p[1] - a[1]); })), req: false }));
  { const mx = [mexRing(F.filter((f) => f.properties.kind === 'river').flatMap((f) => f.geometry.coordinates).sort((a: any, b: any) => b.length - a.length)[0]).map(D)]; for (const it of items) if (!['MEXICO', 'Rio Grande', 'sf'].includes(it.id)) it.outside = [...mx, ...(it.outside || [])]; /* the S/F drive-time panel may use the open Mexico side (not a place label) */ }
  const pl = place(sp, items, env.frame, fs * 0.32), byId = new Map(items.map((q) => [q.id, q]));
  // labels: output
  let s = '';
  const tx = (x: number, y: number, l: Ln, a: string) => `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(l.fs)}" text-anchor="${a}" dominant-baseline="central" ${halo} fill="${l.fill}"${l.b ? ' font-weight="700"' : ''}${l.i ? ' font-style="italic"' : ''}${l.ls ? ` letter-spacing="${l.ls}"` : ''}${l.cls ? ` class="${l.cls}"` : ''}>${l.s}</text>`;
  let tpN = 0;
  for (const p of pl) { if (p.tp) { const it = byId.get(p.id)!, l = it.L[0], id = `rgtp-${o.web ? 'w' + (env.tag || '') : 'p'}${tpN++}`, d = 'M' + extendPath(p.tp).map((q) => Out(q).map(f1).join(',')).join('L'), fz = o.web ? l.fs : l.fs / S;
      s += `<path id="${id}" d="${d}" fill="none" stroke="none"/><text class="rg-road" data-lid="${esc(p.id)}" font-size="${f1(fz)}" dy="${(p.side! * (0.62 + fs * 0.32 * 1.2 / l.fs)).toFixed(2)}em" dominant-baseline="central" ${halo.replace(/stroke-width="([\d.]+)"/, (_, v) => `stroke-width="${f1(o.web ? +v * l.fs / fs : +v * l.fs / fs / S)}"`)} fill="${l.fill}"${l.b ? ' font-weight="700"' : ''}${l.i ? ' font-style="italic"' : ''}${l.ls ? ` letter-spacing="${l.ls}"` : ''}><textPath href="#${id}" startOffset="50%" text-anchor="middle">${l.s}</textPath></text>`; continue; } const it = byId.get(p.id)!, a: Pt = it.kind === 'point' ? it.at : [(p.box[0] + p.box[2]) / 2, (p.box[1] + p.box[3]) / 2], b = p.box; let inner = '';
    if (p.lead) { const q = L0(a, p.lead[1]), A = L0(a, p.lead[0]); inner += `<path class="rg-lead" d="M${f1(A[0])},${f1(A[1])}L${f1(q[0])},${f1(q[1])}" stroke="#8a8a8a" stroke-width="${f1(o.web ? 1 : fs * 0.06)}" fill="none"${o.web ? ' vector-effect="non-scaling-stroke"' : ''}/>`; }
    const nt = it.L.findIndex((l) => l.cls === 'rg-drive');
    if (it.cols === 2 && nt > 0) { const rows = it.L.slice(nt), half = Math.ceil(rows.length / 2), cw = Math.max(...rows.map(wOf)) + fs * 1.5; let y = b[1]; for (const l of it.L.slice(0, nt)) { const t0 = L0(a, [b[0], y + lh(l) / 2]); inner += tx(t0[0], t0[1], l, 'start'); y += lh(l); }
      rows.forEach((l, i) => { const q = L0(a, [b[0] + (i >= half ? cw : 0), y + lh(l) * ((i % half) + 0.5)]); inner += tx(q[0], q[1], l, 'start'); }); }
    else { let y = b[1]; for (const l of it.L) { const iw = ICW(l), tw = wOf(l) - iw, x = p.a === 'start' ? b[0] : p.a === 'end' ? b[2] - iw : (b[0] + b[2]) / 2 - iw / 2, q = L0(a, [x, y + lh(l) / 2]); inner += tx(q[0], q[1], l, p.a);
      for (const [k, ic] of (l.ic || []).entries()) { const ex = (p.a === 'start' ? x + tw : p.a === 'end' ? x : x + tw / 2) + k * l.fs * 1.15, c = L0(a, [ex + l.fs * 0.6, y + lh(l) / 2]), t = l.fs * 0.9; inner += ic === 'fuel' ? `<g class="rg-fuel">${PUMP(c[0], c[1], t, fs * 0.04)}</g>` : `<g class="rg-hosp"><rect x="${f1(c[0] - t / 2)}" y="${f1(c[1] - t / 2)}" width="${f1(t)}" height="${f1(t)}" rx="${f1(t * 0.15)}" fill="#c4161c"/><path d="M${f1(c[0] - t * 0.28)},${f1(c[1])}h${f1(t * 0.56)}M${f1(c[0])},${f1(c[1] - t * 0.28)}v${f1(t * 0.56)}" stroke="#fff" stroke-width="${f1(t * 0.2)}"/></g>`; }
      y += lh(l); } }
    s += grp(a, inner, ' rg-lab', p.id); }
  if (o.web === false) { const miss = items.filter((q) => q.req && !pl.some((p) => (q.grp ? (p as any).grp === q.grp : p.id === q.id) && !p.forced)).map((q) => q.id); if (miss.length) console.warn('[regional] forced labels:', miss.join(', ')); }
  else { const miss = items.filter((q) => q.req && !pl.some((p) => (q.grp ? (p as any).grp === q.grp : p.id === q.id) && !p.forced)).map((q) => q.id); if (miss.length) console.warn('[regional web] forced labels:', miss.join(', ')); }
  const dropped = items.filter((q) => !q.req && !pl.some((p) => p.id === q.id)).map((q) => q.id); if (dropped.length) console.log(`[regional${o.web ? ' web' : ''}] dropped optional labels:`, dropped.join(', '));
  // QA sidecar for tools/region-labels-check.ts (local only, not deployed): containment rings in output coordinates
  if (env.qa !== false) try { require('fs').mkdirSync('node_modules/.cache', { recursive: true }); require('fs').writeFileSync(`node_modules/.cache/rg-check-${o.web ? 'web' : 'pdf'}.json`, JSON.stringify({ county: Object.fromEntries(Object.entries(CR).map(([k, r]) => [k, r.map((q) => Out(D(q as any)))])), park: parkRings.map((r) => r.map(Out)), mexico: mexRing(riv).map((q) => Out(D(q as any))) })); } catch {}
  return sym + s;
}
/** drive-time table rows from the Start / Finish (OSRM on OSM roads) */
export const driveRows = (c: Ctx) => ((c as any).regional.features as any[]).filter((f) => f.properties.kind === 'drive').map((f) => [f.properties.to, hm(f.properties.min), Math.round(f.properties.mi) + ' mi']);
/** web: regional layer in MAIN map coordinates (lazy-loaded fragment; shown only when zoomed out past the default frame) */
const geomLines = (g: any): [number, number][][] => !g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
/** web overlays over the main map at the max zoom-out (fractions of the viewBox WIDTH, desktop + phone union): day/night badge, zoom buttons, logo, north arrow, scale bar */
const WEB_UI: Box[] = [[0.29, 0, 0.71, 0.095], [0.91, 0, 1, 0.3], [0.07, 0, 0.18, 0.125], [0, 0, 0.05, 0.085], [0, 1.355, 0.32, 1.43]];
export function regionFrag(c: Ctx, mainProj: P, rb: number[], W: number, H: number) {
  const kmin = rb[4], o = { fs: 21, sw: 1.2, tol: 0.4 / kmin, web: true };
  const L = regionLayer(c, mainProj, o);
  // labels are counter-scaled (constant on-screen offset from their anchor), the map is not: a placement made for the max zoom-out would drift onto
  // lines at closer zooms. So placement is recomputed per zoom band (k = kmin * 1.5^n < 1); zoom.ts shows the band with the largest kb <= k.
  const bands: number[] = []; for (let k = kmin; k < 0.999 && bands.length < 6; k *= 1.5) bands.push(k);
  let top = '';
  bands.forEach((kb, bi) => {
    const Dp = (q: [number, number]): Pt => { const p = mainProj(q); return [(p[0] - rb[0]) * kb, (p[1] - rb[1]) * kb]; };
    const lines: Pt[][] = [];
    for (const f of c.network.features) if (!f.properties.bg) for (const l of geomLines(f.geometry)) lines.push(l.map(Dp));
    for (const f of c.park.features) if (f.properties.kind === 'boundary') for (const l of geomLines(f.geometry)) lines.push(l.map(Dp));
    for (const k of c.courses.order) for (const f of c.courseGeo[k].features) for (const l of geomLines(f.geometry)) lines.push(l.map(Dp));
    for (const f of c.zoom?.features || []) for (const l of geomLines(f.geometry)) lines.push(l.map(Dp)); // main-map zoom boxes show in the zoomed-out view too
    const marks: [number, number, number][] = c.stations.order.map((k: string) => { const p = Dp(c.stations.stations[k].lonlat); return [p[0], p[1], k === 'S/F' ? 40 : 33]; });
    const f = kb / kmin, env: Env = { s: kb, o0: [rb[0], rb[1]], frame: [8, 8, W * f - 8, H * f - 8], rowK: 0.82, lines, marks, boxes: bi === 0 ? WEB_UI.map((b) => b.map((v) => v * W) as Box) : [], tag: 'b' + bi, qa: bi === 0 };
    top += `<g class="rg-top" data-kb="${kb.toFixed(5)}"${bi ? ' style="display:none"' : ''}>${regionTop(c, mainProj, o, env)}</g>`;
  });
  return `<g class="rg-lines">${L.lines}</g>${top}`;
}
/** PDF regional page: the main-map renderer in regional mode (own projection over REGION) */
export function renderRegional(c: Ctx, W = 1143, H = 1418) {
  const b = regionBox3857(), cx = (b.x[0] + b.x[1]) / 2, cy = (b.y[0] + b.y[1]) / 2, hw = (b.x[1] - b.x[0]) / 2, hh = hw * H / W;
  const view = { x: [cx - hw, cx + hw], y: [cy - hh, cy + hh] }, V = viewProjection(view, W, H), proj = V.p as P, col = c.colors, o = { fs: 19, sw: 1.3, tol: 0.4, web: false };
  const L = regionLayer(c, proj, o);
  // race routes in race colours, longest first (shared sections: shortest race on top, as on the main map)
  let rr = ''; for (const k of c.courses.order) rr += `<path d="${V.path(c.courseGeo[k].features[0])}" fill="none" stroke="${c.courses.colors[k]}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  // in-park roads of the main map (network), simple thin gray (dirt) — FM 170 comes from the regional highway layer
  let net = ''; for (const f of c.network.features.filter((f: any) => !f.properties.bg && !f.properties.on_course && f.properties.cls !== 'paved')) net += `<path d="${V.path(f)}" fill="none" stroke="#b3b3b3" stroke-width="1"/>`;
  // aid stations + Start / Finish: small markers (main-map marker template, scaled down); labels = numbers inside the markers
  let st = ''; for (const k of c.stations.order) { const s = c.stations.stations[k], [x, y] = V.p(s.lonlat); st += station(x, y, k, s.spectator, k === 'S/F' ? { s: 520, fs: 9, colors: col, link: false } : { s: 300, fs: 9, colors: col, link: false }); }
  // furniture: scale bar (20 mi), north arrow, legend, drive-time table
  const mi = 1609.344 * V.ppm / Math.cos(((REGION.sw[1] + REGION.ne[1]) / 2) * Math.PI / 180) /* sheet units per mile at mid-latitude */;
  const sx = W * 0.05, sy = H * 0.1, w20 = 20 * mi;
  let fur = `<g class="scalebar"><path stroke="${col.ink}" stroke-width="2" fill="none" d="M${f1(sx)},${f1(sy)}h${f1(w20)}M${f1(sx)},${f1(sy)}v-7M${f1(sx + w20 / 2)},${f1(sy)}v-7M${f1(sx + w20)},${f1(sy)}v-7"/>`;
  fur += [[0, '0'], [w20 / 2, '10'], [w20, '20 mi']].map(([dx, t]) => `<text x="${f1(sx + (dx as number))}" y="${f1(sy + 6)}" font-size="13" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">${t}</text>`).join('') + '</g>';
  fur += northG(W, W * 0.015, W * 0.015);
  // legend
  const lx = W * 0.035, ly = H * 0.14; const it: [string, string][] = [['hw', 'Highway'], ['pr', 'Park road (dirt)'], ['rr', 'Race routes'], ['aid', 'Aid station · Start / Finish'], ['h', 'Hospital'], ['t', 'Town'], ['a', 'Dirt/gravel airstrip'], ['a2', 'Paved airport'], ['fu', 'Fuel'], ['pk', 'Big Bend Ranch State Park'], ['co', 'County line'], ['rv', 'Rio Grande (US–Mexico border)']];
  let lg = `<g class="legend"><rect x="${f1(lx - 10)}" y="${f1(ly - 14)}" width="${f1(W * 0.32)}" height="${f1(it.length * 20 + 14)}" fill="#fff" fill-opacity=".92" stroke="#bbb"/>`;
  it.forEach(([k, t], i) => { const y = ly + 2 + i * 20, x = lx, P = `M${f1(x)},${f1(y)}h34`;
    lg += k === 'hw' ? `<path d="${P}" stroke="#fff" stroke-width="4.1"/><path d="${P}" stroke="#8a8a8a" stroke-width="2.4"/>` : k === 'pr' ? `<path d="${P}" stroke="#8a8a8a" stroke-width="1.6" stroke-dasharray="3.6 2.4"/>` : k === 'rr' ? c.courses.order.map((q, j) => `<path d="M${f1(x + j * 7)},${f1(y)}h6" stroke="${c.courses.colors[q]}" stroke-width="3"/>`).join('')
      : k === 'aid' ? station(x + 17, y, '', false, { s: 300, colors: col, link: false }) : k === 'h' ? `<rect x="${f1(x + 11)}" y="${f1(y - 6)}" width="12" height="12" rx="2" fill="#c4161c"/>` : k === 'a' ? `<path d="M${f1(x + 6)},${f1(y + 4)}L${f1(x + 20)},${f1(y - 3)}" stroke="#7d7d7d" stroke-width="3.4"/><path d="${PROP(x + 29, y, 13)}" fill="#6b6b6b"/>` : k === 'a2' ? `<path d="M${f1(x + 4)},${f1(y + 4)}L${f1(x + 18)},${f1(y - 3)}" stroke="#7d7d7d" stroke-width="3.4"/><path d="${PLANE(x + 30, y, 18)}" fill="#6b6b6b"/>` : k === 'fu' ? PUMP(x + 17, y, 15, 1) : k === 'co' ? `<path d="${P}" stroke="#b0b0b0" stroke-width="1.2" stroke-dasharray="7.8 3.2 1.3 3.2"/>` : k === 't' ? `<circle cx="${f1(x + 17)}" cy="${f1(y)}" r="4" fill="#333"/>`
      : k === 'pk' ? `<rect x="${f1(x)}" y="${f1(y - 6)}" width="34" height="12" fill="${col.park}" fill-opacity=".1" stroke="${col.boundary}" stroke-width="1.2" stroke-dasharray="1.2 3"/>` : `<path d="${P}" stroke="#9fb6c6" stroke-width="2"/>`;
    lg += `<text x="${f1(x + 44)}" y="${f1(y)}" font-size="13" dominant-baseline="central" fill="${col.ink}">${t}</text>`; });
  lg += '</g>';

  return `<svg class="regionmap" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Big Bend Ultra regional map"><defs><clipPath id="rclip"><rect width="${W}" height="${H}"/></clipPath></defs><rect width="${W}" height="${H}" fill="#fff"/><g clip-path="url(#rclip)">${L.lines}${net}${rr}${st}${regionTop(c, proj, o, { s: 1, o0: [0, 0], frame: [6, 6, W - 6, H - 6], lines: [...c.network.features.filter((f: any) => !f.properties.bg && !f.properties.on_course && f.properties.cls !== 'paved').flatMap((f: any) => geomLines(f.geometry)), ...c.courses.order.flatMap((k: string) => c.courseGeo[k].features.flatMap((f: any) => geomLines(f.geometry)))].map((l) => l.map((q) => proj(q) as Pt)), marks: c.stations.order.map((k: string) => { const p = proj(c.stations.stations[k].lonlat); return [p[0], p[1], k === 'S/F' ? 17 : 13] as [number, number, number]; }), boxes: [[lx - 14, ly - 18, lx + W * 0.32, ly + it.length * 20 + 4], [sx - 24, sy - 14, sx + w20 + 34, sy + 26], [0, 0, W * 0.09, W * 0.13]] })}</g>${fur}${lg}<rect width="${W}" height="${H}" fill="none" stroke="#000" stroke-width="1.6"/></svg>`;
}

/** web: regional box in main-map units + minimum zoom (fills the frame) -> "x0 y0 x1 y1 kmin" on svg.mainmap */
/** max zoom-out = tight frame around Presidio, Marfa, Alpine and the hospital (+ the default course frame), small margin, at the map's aspect */
export function regionData(c: Ctx, V: any, W: number, H: number) {
  const F = (c as any).regional.features as any[], P = F.filter((f) => (f.properties.kind === 'town' && ['Presidio', 'Marfa', 'Alpine'].includes(f.properties.name)) || f.properties.kind === 'hospital').map((f) => V.p(f.geometry.coordinates));
  P.push([0, 0], [W, H]);
  let x0 = Math.min(...P.map((p) => p[0])), x1 = Math.max(...P.map((p) => p[0])), y0 = Math.min(...P.map((p) => p[1])), y1 = Math.max(...P.map((p) => p[1]));
  const m = 0.05 * Math.max(x1 - x0, y1 - y0); x0 -= m; x1 += m; y0 -= m; y1 += m * 5; /* room above the hospital for its label block */ // extra room below the S/F for its drive-time block
  const k = Math.min(W / (x1 - x0), H / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = W / k / 2, hh = H / k / 2;
  return [cx - hw, cy - hh, cx + hw, cy + hh].map(f1).join(' ') + ' ' + k.toFixed(4);
}
