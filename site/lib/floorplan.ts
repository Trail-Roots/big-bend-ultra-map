// Finish-area floor plan (architectural look, true scale): footprints drawn in local ground meters from Erik's logistics
// My Map points (content/logistics.json) + OSM roads / lot; no aerial. Sizes are assumptions (see ASSUME) until confirmed.
import TR from './finish-trace.json';
import { Scene, textOb, circleOb, lineOb, polyOb, type Pt } from './collide';
import { esc, f1, textBlock, leaderLine, gmapLink, station } from './util';

export const FT = 0.3048;
const GATE_EAST_M = 24; // gate set just past the Y in the entrance road (east of the KML point)
const DROP_FT = 10; // drop-off lane width along the FM 170 edge
/** assumed footprints (feet) and orientations — listed in the report for Erik */
export const ASSUME = {
  radio: { w: 8.5, l: 35, along: 'southeast curb of the large island' }, restroom: { unit: 4, gap: 1, n: 12, along: 'west loop road' },
  medic: { w: 10, l: 10, along: 'south loop road' }, water: { w: 4, l: 4 },
  arch: { span: 24, along: 'parallel to Big Bend St Park Rd' }, gate: { span: 18 },
};
// picnic area: the section east of the visitor-center loop road, south of the entry road and north of the small outbuilding (OSM + aerial)
const BW_OUT: [number, number][] = [[-103.757697, 29.270026], [-103.757117, 29.270026], [-103.757117, 29.26952], [-103.757697, 29.26952]];
const BW_IN: [number, number][] = [[-103.757535, 29.269872], [-103.75728, 29.269872], [-103.75728, 29.269655], [-103.757535, 29.269655]];
const FRAME = [-103.7593, 29.26935, -103.75645, 29.27078]; // lon/lat: tight around the finish-area features incl. the drop-off
export const C = { ground: '#f8f6f1', grid: '#ebe6dc', road: '#c4c2bd', roadEdge: '#a39c90', lot: '#c4c2bd', bld: '#d9d2c4', bldEdge: '#3d3a35', ink: '#2a2a2a', dirt: '#efe8da', pave: '#c4c2bd', curb: '#9d978c', island: '#d5dfc2', islandEdge: '#8a9478', mute: '#7d776d', picnic: '#e2ecd6', picnicEdge: '#5f8a5a', rest: '#dce8f6', restEdge: '#2a62a8', rv: '#e9ebef', amber: '#d08a10', red: '#c4161c', blue: '#2a62a8' };

function makeBase(c, FRAME: number[], gridM: number, id = "fp", W = 1200, o: { ground?: string; road?: string; edge?: string; lot?: boolean; grid?: string; osmBld?: boolean; skipWays?: number[]; extraWays?: any[] } = {}) {
  const lat0 = 29.2702, lon0 = -103.7575, kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110574;
  const gm = (q: [number, number]) => [(q[0] - lon0) * kx, (q[1] - lat0) * ky] as [number, number]; // ground meters, y up
  const [fx0, fy0] = gm([FRAME[0], FRAME[1]]), [fx1, fy1] = gm([FRAME[2], FRAME[3]]);
  const s = W / (fx1 - fx0), H = Math.round((fy1 - fy0) * s); // px per meter
  const pm = (m: [number, number]) => [(m[0] - fx0) * s, (fy1 - m[1]) * s] as [number, number];
  const P = (q: [number, number]) => pm(gm(q));
  const d = (cs: [number, number][], close = false) => 'M' + cs.map((q) => P(q).map(f1).join(',')).join('L') + (close ? 'Z' : '');
  const L = c.logistics, osm = [...L.osm.features, ...(o.extraWays ?? [])], pt = (n: string) => L.placemarks.find((p) => p.name === n && p.kind === 'point')!.coords[0] as [number, number];
  // rectangle footprint centred on ground point m, w across x l along the angle a (radians, ground frame), as px path
  const rect = (m: [number, number], w: number, l: number, a: number) => { const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    return [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]].map(([p, q]) => pm([m[0] + ux * p + vx * q, m[1] + uy * p + vy * q])); };
  const poly = (ps: [number, number][]) => 'M' + ps.map((p) => p.map(f1).join(',')).join('L') + 'Z';
  const ang = (a: [number, number], b: [number, number]) => { const A = gm(a), B = gm(b); return Math.atan2(B[1] - A[1], B[0] - A[0]); };
  const way = (id: number) => osm.find((f) => f.properties.osm_id === id).geometry.coordinates as [number, number][];
  let g = `<defs><clipPath id="${id}clip"><rect width="${W}" height="${H}"/></clipPath><pattern id="${id}hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V8" stroke="${C.amber}" stroke-width="2" stroke-opacity=".55"/></pattern>
<pattern id="${id}bld" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V7" stroke="#b9b1a2" stroke-width="1.2"/></pattern></defs><g clip-path="url(#${id}clip)"><rect width="${W}" height="${H}" fill="${o.ground ?? C.ground}"/>`;
  // 10 m grid (architectural sheet feel)
  for (let x = Math.ceil(fx0 / gridM) * gridM; x < fx1; x += gridM) { const X = (x - fx0) * s; g += `<path d="M${f1(X)},0V${H}" stroke="${o.grid ?? C.grid}" stroke-width="1"/>`; }
  for (let y = Math.ceil(fy0 / gridM) * gridM; y < fy1; y += gridM) { const Y = (fy1 - y) * s; g += `<path d="M0,${f1(Y)}H${W}" stroke="${o.grid ?? C.grid}" stroke-width="1"/>`; }
  // paved lot, roads (true widths), FM 170 centre line
  if (o.lot !== false) for (const f of osm) if (f.properties.amenity === 'parking' && f.geometry.type === 'Polygon') g += `<path d="${d(f.geometry.coordinates[0], true)}" fill="${C.lot}" stroke="${C.roadEdge}" stroke-width="1.2"/>`;
  const RW: Record<string, number> = { secondary: 10, service: 5.5, track: 3.5, residential: 6.5 };
  for (const pass of [0, 1]) for (const f of osm) { const h = f.properties.highway; if (!(h in RW) || f.geometry.type !== 'LineString' || o.skipWays?.includes(f.properties.osm_id)) continue;
    const w = RW[h] * s; g += `<path d="${d(f.geometry.coordinates)}" fill="none" stroke="${pass ? (o.road ?? C.road) : (o.edge ?? C.roadEdge)}" stroke-width="${f1(pass ? w : w + 2.4)}" stroke-linejoin="round" stroke-linecap="${pass ? 'round' : 'butt'}"/>`; }
  for (const f of osm) { const h = f.properties.highway; if (!['secondary', 'service', 'residential'].includes(h) || f.geometry.type !== 'LineString' || o.skipWays?.includes(f.properties.osm_id)) continue; const dl = Math.max(3 * s, 6), gp = Math.max(6 * s, 9); g += `<path d="${d(f.geometry.coordinates)}" fill="none" stroke="#fff" stroke-width="${h === 'secondary' ? 1.8 : 1.2}" stroke-dasharray="${f1(dl)} ${f1(gp)}"/>`; } // white dashed centerlines
  for (const f of osm) if (f.properties.highway === 'path') g += `<path d="${d(f.geometry.coordinates)}" fill="none" stroke="#a39782" stroke-width="1.6" stroke-dasharray="1 4" stroke-linecap="round"/>`;
  // buildings
  if (o.osmBld !== false) for (const f of osm) if (f.properties.building && f.geometry.type === 'Polygon') g += `<path d="${d(f.geometry.coordinates[0], true)}" fill="${C.bld}" stroke="${C.bldEdge}" stroke-width="1.6"/>`;
  g += `<path d="${d(BW_OUT, true)}${d(BW_IN, true)}" fill="${C.bld}" fill-rule="evenodd" stroke="${C.bldEdge}" stroke-width="2.6"/><path d="${d(BW_OUT, true)}${d(BW_IN, true)}" fill="url(#${id}bld)" fill-rule="evenodd"/>`;
  // paved road bands (px) for masking areas and for the area-vs-road build check
  const roads = osm.filter((f) => f.properties.highway in RW && f.geometry.type === 'LineString' && !o.skipWays?.includes(f.properties.osm_id)).map((f) => ({ h: f.properties.highway as string, pts: (f.geometry.coordinates as [number, number][]).map(P), w: RW[f.properties.highway] * s + 2.4 }));
  const roadMask = (mid: string, keep: (h: string) => boolean = () => true) => `<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${roads.filter((r) => keep(r.h)).map((r) => `<path d="M${r.pts.map((q) => q.map(f1).join(',')).join('L')}" fill="none" stroke="#000" stroke-width="${f1(r.w)}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}</mask>`;
  return { lat0, lon0, gm, pm, P, d, s, W, H, fx0, fy0, fx1, fy1, g, osm, L, pt, rect, poly, ang, way, RW, roads, roadMask };
}
/** build check: no area polygon may overlap any road band (sampled every 2 px; areas clipped by a road mask are exempt by construction) */
function checkAreasOffRoads(name: string, B, areas: { id: string; pts: number[][]; skip?: (h: string) => boolean }[]) {
  const bad: string[] = [], dseg = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
  const pip = (p: number[], poly: number[][]) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
  for (const A of areas) { const xs = A.pts.map((q) => q[0]), ys = A.pts.map((q) => q[1]), X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
    // only road segments whose band can reach the area's bbox
    const segs: [number[], number[], number, string][] = []; for (const r of B.roads) { if (A.skip?.(r.h)) continue; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], m = r.w / 2;
      if (Math.max(a[0], b[0]) + m < X0 || Math.min(a[0], b[0]) - m > X1 || Math.max(a[1], b[1]) + m < Y0 || Math.min(a[1], b[1]) - m > Y1) continue; segs.push([a, b, m - 1.5, r.h]); } }
    if (!segs.length) continue;
    outer: for (let x = X0; x <= X1; x += 2) for (let y = Y0; y <= Y1; y += 2) { if (x < 0 || y < 0 || x > B.W || y > B.H) continue; const near = segs.filter((q) => dseg([x, y], q[0], q[1]) < q[2]); if (!near.length || !pip([x, y], A.pts)) continue;
      bad.push(`${A.id} overlaps ${near[0][3]} road at ${x.toFixed(0)},${y.toFixed(0)}`); break outer; } }
  if (bad.length) throw new Error(`[roads:${name}] ` + bad.join('; '));
  console.log(`  roads: ${name} OK (${areas.length} areas off the road bands)`); }
/** north arrow, ft scale bar, grid note, frame */
function furniture(W: number, H: number, s: number, ft: number[], gridNote: string) {
  let out = '';
  const nx = W - 38, ny = 44; out += `<g><circle cx="${nx}" cy="${ny}" r="21" fill="#fff" stroke="${C.grid}"/><path d="M${nx},${ny - 15}L${nx + 7},${ny + 9}L${nx},${ny + 4}L${nx - 7},${ny + 9}Z" fill="${C.ink}"/><text x="${nx}" y="${ny + 34}" class="f-serif" font-size="15" text-anchor="middle" fill="${C.ink}">N</text></g>`;
  const fpx = (v: number) => v * FT * s, sw = fpx(ft[ft.length - 1]), sx = W - 34 - sw, sy = H - 26;
  out += `<rect x="${f1(sx - 12)}" y="${f1(sy - 30)}" width="${f1(sw + 44)}" height="42" rx="4" fill="#fff" stroke="${C.grid}"/>`;
  ft.slice(0, -1).forEach((v, i) => { out += `<rect x="${f1(sx + fpx(v))}" y="${sy - 6}" width="${f1(fpx(ft[i + 1]) - fpx(v))}" height="6" fill="${i % 2 ? '#fff' : C.ink}" stroke="${C.ink}" stroke-width="1.1"/>`; });
  ft.forEach((v, i) => { out += `<text x="${f1(sx + fpx(v))}" y="${sy - 11}" font-size="13" text-anchor="middle" fill="${C.ink}">${v}${i === ft.length - 1 ? ' ft' : ''}</text>`; });
  return out + `<text x="12" y="${H - 12}" font-size="12" fill="#8a8580">${gridNote}</text><rect width="${W}" height="${H}" fill="none" stroke="#000" stroke-width="1.6"/>`;
}
const lbl = (x: number, y: number, text: string, o: any = {}) => textBlock(x, y, { text, fs: o.fs ?? 17, color: o.color ?? C.ink, style: o.style ?? 'normal', weight: 'bold', family: 'sans', halo: { color: o.halo ?? '#fff', width: 4.5 }, ha: 'center', linespacing: 1.15, rotation: o.rot });
const fm170 = (B) => { const a = B.osm.find((f) => f.properties.highway === 'secondary' && B.P(f.geometry.coordinates[0])[0] < B.W).geometry.coordinates as [number, number][]; return a; };
function fmGeo(B, t: number) { const ws = B.osm.filter((f) => f.properties.highway === 'secondary'); let best: [number, number][] | null = null, bl = 0;
  for (const w of ws) { const cs = w.geometry.coordinates.map(B.P); for (let i = 1; i < cs.length; i++) { const a = cs[i - 1], b = cs[i]; if ([a, b].some(([x, y]) => x < 40 || y < 40 || x > B.W - 40 || y > B.H - 40)) continue; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = [a, b]; } } }
  if (!best) return null; const [a, b] = best; let an = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (an > 90) an -= 180; if (an < -90) an += 180;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, an }; }
function fmLabel(B, t: number) { const ws = B.osm.filter((f) => f.properties.highway === 'secondary'); let best: [number, number][] | null = null, bl = 0;
  for (const w of ws) { const cs = w.geometry.coordinates.map(B.P); for (let i = 1; i < cs.length; i++) { const a = cs[i - 1], b = cs[i]; if ([a, b].some(([x, y]) => x < 40 || y < 40 || x > B.W - 40 || y > B.H - 40)) continue; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = [a, b]; } } }
  if (!best) return ''; const [a, b] = best; let an = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (an > 90) an -= 180; if (an < -90) an += 180;
  return lbl(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 'FM 170', { fs: 16, color: '#5d5850', rot: -an }); }
void fm170;
/** 5-minute drop-off: clean lane along the FM 170 edge (KML polygon gives extent + side), trimmed short of entrance driveways */
function dropBand(B, drop) { const { gm, pm, osm, RW } = B;
const RT = roadTools(B), ln = RT.lines[0], cs2 = RT.cum(ln.pts), pr = (drop.coords as [number, number][]).map((q) => RT.project(ln.pts, cs2, gm(q)));
    const S0 = Math.min(...pr.map((q) => q[1])), S1 = Math.max(...pr.map((q) => q[1])), side = Math.sign(pr.reduce((t, q) => t + q[2], 0)) || 1, o1 = RT.RWm.secondary / 2 + 0.3, o2 = o1 + DROP_FT * FT, inn: [number, number][] = [], out: [number, number][] = [];
    const off = (sv: number, o: number): [number, number] => { const p = RT.at(ln.pts, cs2, sv), t = RT.tan(ln.pts, cs2, sv); return [p[0] - t[1] * o * side, p[1] + t[0] * o * side]; };
    // trim both ends so the lane stops short of any entrance driveway (≥ 3 m clear of other roads' edges)
    const others = osm.filter((f) => f.properties.highway in RW && f.properties.highway !== 'secondary' && f.geometry.type === 'LineString').map((f) => ({ w: RW[f.properties.highway], pts: (f.geometry.coordinates as [number, number][]).map(gm) }));
    const clear = (sv: number) => [o1, o2].every((o) => { const p = off(sv, o); return others.every(({ w, pts }) => pts.every((_, i) => i === 0 || RT.project([pts[i - 1], pts[i]], [0, 1], p)[0] > w / 2 + 3)); });
    let s0 = S0, s1 = S1; while (s1 > s0 && !clear(s1)) s1 -= 0.5; while (s0 < s1 && !clear(s0)) s0 += 0.5;
    for (let sv = s0; sv <= s1 + 1e-6; sv += 1) { inn.push(off(sv, o1)); out.push(off(sv, o2)); }
    const band = 'M' + [...inn, ...out.reverse()].map((q) => pm(q).map(f1).join(',')).join('L') + 'Z', cx = drop.coords.reduce((t, q) => t + q[0], 0) / drop.coords.length, cy = drop.coords.reduce((t, q) => t + q[1], 0) / drop.coords.length;
  return { band, ring: [...inn, ...out], where: [cx, cy] as [number, number], anchor: pm(off((s0 + s1) / 2, (o1 + o2) / 2)) }; }
export function renderFinishPlan(c, labels: Record<string, [number, number]>) {
  const B = makeBase(c, FRAME, 10, 'fp', 1200, { ground: C.dirt, grid: '#e3dac8', road: C.pave, edge: C.curb, lot: false, osmBld: false, skipWays: [321566200, 1452473490, 15134664] /* lot-internal OSM ways + the OSM park road, replaced by traced geometry */, extraWays: [{ type: 'Feature', properties: { highway: 'service', osm_id: -1, name: 'Big Bend St Park Rd (traced)' }, geometry: { type: 'LineString', coordinates: (TR as any).PARKRD } }] }), { gm, pm, P, d, s, W, H, osm, L, pt, rect, poly, ang, way, RW } = B; let g = B.g;
  // surfaces traced from Erik's annotated satellite view (georeferenced on the My Map points, <1 m residual)
  const TRc = TR as Record<string, [number, number][]>;
  g += `<defs>${B.roadMask('fpmask')}</defs><path mask="url(#fpmask)" d="${d(TRc.LOT, true)}" fill="${C.pave}" stroke="${C.curb}" stroke-width="1.4" stroke-linejoin="round"/>`;
  for (const k of ['ISL_BIG', 'ISL_W', 'ISL_E']) g += `<path d="${d(TRc[k], true)}" fill="${C.island}" stroke="${C.islandEdge}" stroke-width="2" stroke-linejoin="round"/>`;
  // simulated stall stripes (white on pavement, 9 ft o.c., 18 ft deep): a double row between the two small islands, and a
  // single head-in row along the paved edge in front of the Barton Warnock entrance (skipping the Medic tent footprint)
  const stallZones: Pt[][] = [], SD = 18 * FT, SW = 9 * FT;
  const stallRow = (A: [number, number], Bp: [number, number], sides: number[], t0: number, t1: number, skip: (q: [number, number]) => boolean = () => false) => {
    const L0 = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), u = [(Bp[0] - A[0]) / L0, (Bp[1] - A[1]) / L0], n = [-u[1], u[0]]; let dd = '';
    const at2 = (t: number, o: number): [number, number] => [A[0] + u[0] * t + n[0] * o, A[1] + u[1] * t + n[1] * o];
    for (const sd of sides) { for (let t = t0; t <= L0 - t1 + 1e-6; t += SW) { const p0 = at2(t, 0), p1 = at2(t, sd * SD); if (skip(p0) || skip(p1) || skip(at2(t, sd * SD / 2))) continue; dd += `M${pm(p0).map(f1)}L${pm(p1).map(f1)}`; }
      stallZones.push([at2(t0, 0), at2(L0 - t1, 0), at2(L0 - t1, sd * SD), at2(t0, sd * SD)].map(pm) as Pt[]); }
    if (sides.length > 1) dd += `M${pm(at2(t0, 0)).map(f1)}L${pm(at2(L0 - t1, 0)).map(f1)}`;
    g += `<path d="${dd}" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/>`; };
  { const cW = TRc.ISL_W.map(gm), cE = TRc.ISL_E.map(gm), ctr = (v: [number, number][]) => [v.reduce((t, q) => t + q[0], 0) / v.length, v.reduce((t, q) => t + q[1], 0) / v.length] as [number, number];
    stallRow(ctr(cW), ctr(cE), [1, -1], 2.2, 2.2);
    const lot = TRc.LOT.map(gm), med = gm(pt('Medic')), mr = (ASSUME.medic.w * FT) * 0.75 + 1;
    stallRow(lot[10], lot[9], [-1], 4, 4, (q) => Math.hypot(q[0] - med[0], q[1] - med[1]) < mr + 2.5); }
  g += `<path d="${d(TRc.SHED, true)}" fill="${C.bld}" stroke="${C.bldEdge}" stroke-width="1.6"/>`;
  // course into the finish (100K GPX), clipped to the frame
  const cs = c.courseGeo['100K'].features[0].geometry.coordinates as [number, number][], tail: [number, number][] = [];
  for (let i = cs.length - 1; i >= 0; i--) { tail.unshift(cs[i]); const [x, y] = P(cs[i]); if (x < -30 || y < -30 || x > W + 30 || y > H + 30) break; }
  const col = c.courses.colors['100K'];
  g += `<path d="${d(tail)}" fill="none" stroke="#fff" stroke-width="${f1(1.6 * s + 4)}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".9"/><path d="${d(tail)}" fill="none" stroke="#111" stroke-width="${f1(1.6 * s)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  { const n = tail.length, i = Math.max(0, Math.min(n - 2, Math.floor(n * 0.5))), [ax, ay] = P(tail[i]), [bx, by] = P(tail[i + 1]), a = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    g += `<g transform="translate(${f1(ax)} ${f1(ay)}) rotate(${f1(a)})"><path d="M-8,-9L8,0L-8,9L-4,0Z" fill="#111" stroke="#fff" stroke-width="2" paint-order="stroke"/></g>`; }
  const items: { minor?: boolean; key: string; label: string; where: [number, number] | string; shape: string; anchor: [number, number]; r: number }[] = [];
  const sfPlace = c.stations.stations['S/F'].place;
  // drop-off area polygon
  const drop = L.placemarks.find((p) => p.name === '5 Min Dropoff Area');
  let dropRing: number[][] | null = null;
  if (drop) { const { band, where, anchor, ring } = dropBand(B, drop); dropRing = ring.map(pm);
    items.push({ key: 'dropoff', label: '5-minute drop-off', where, shape: `<path d="${band}" fill="#f6e2b0" fill-opacity=".85"/><path d="${band}" fill="url(#fphatch)" stroke="${C.amber}" stroke-width="2" stroke-linejoin="round"/>`, anchor, r: 0 }); }
  // picnic area: the whole triangle of different-coloured ground east of the lot (low prominence)
  { const PP = TRc.PICNIC, cx = PP.reduce((t, q) => t + q[0], 0) / PP.length, cy = PP.reduce((t, q) => t + q[1], 0) / PP.length;
    // gravel path across the picnic triangle to the shelter (distinct gravel tone, ~1.5 m wide)
    const gravel = `<path d="${d(TRc.GRAVEL)}" fill="none" stroke="#b9ab8e" stroke-width="${f1(1.8 * s + 2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d(TRc.GRAVEL)}" fill="none" stroke="#e6dcc6" stroke-width="${f1(1.8 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    items.push({ minor: true, key: 'picnic', label: 'Picnic area', where: pt('Picnic Area'), shape: `<path mask="url(#fpmask)" d="${d(PP, true)}" fill="${C.picnic}" fill-opacity=".75" stroke="${C.picnicEdge}" stroke-opacity=".6" stroke-width="1.4" stroke-dasharray="6 4" stroke-linejoin="round"/>${gravel}`, anchor: P([cx, cy]), r: 0 }); }
  // orientations from nearby roads
  const aisle = way(1452473490), loop = way(321566200), aAisle = ang(aisle[0], aisle[1]), aWest = ang(loop[1], loop[2]), aSouth = ang(loop[2], loop[3]);
  // Radio Command: vehicle footprint parked against the southeast side of the large island, parallel to its curb (drive lane left clear)
  { const I = TRc.ISL_BIG.map(gm), e0 = I[5], e1 = I[4], aI = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]), A = ASSUME.radio, L0 = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
    const along = L0 - A.l * FT / 2 - 3, nx = Math.sin(aI), ny = -Math.cos(aI), gap = A.w * FT / 2 + 0.6; // 3 m short of the island's east tip
    const m: [number, number] = [e0[0] + Math.cos(aI) * along + nx * gap, e0[1] + Math.sin(aI) * along + ny * gap], ps = rect(m, A.w * FT, A.l * FT, aI);
    const cab = rect([m[0] + Math.cos(aI) * (A.l * FT / 2 - 0.9), m[1] + Math.sin(aI) * (A.l * FT / 2 - 0.9)], A.w * FT - 0.5, 1.2, aI);
    items.push({ key: 'radio', label: 'Radio Command', where: pt('Radio Command'), shape: `<path d="${poly(ps)}" fill="${C.rv}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="${poly(cab)}" fill="#9aa3b0"/>`, anchor: pm(m), r: 8 }); }
  // Medic tent: canopy with the usual X ridge lines
  for (const [key, name, A, a, fill, lab] of [['medic', 'Medic', ASSUME.medic, aSouth, '#fdeeee', 'Medic']] as const) {
    const m = gm(pt(name)), ps = rect(m, A.w * FT, A.l * FT, a);
    let sh = `<path d="${poly(ps)}" fill="${fill}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${ps[0].map(f1)}L${ps[2].map(f1)}M${ps[1].map(f1)}L${ps[3].map(f1)}" stroke="${C.ink}" stroke-width=".8" stroke-opacity=".5"/>`;
    if (key === 'medic') { const [x, y] = pm(m); sh += `<path d="M${f1(x - 1.6)},${f1(y - 5)}h3.2v3.4h3.4v3.2h-3.4v3.4h-3.2v-3.4h-3.4v-3.2h3.4z" fill="${C.red}"/>`; }
    items.push({ key, label: lab, where: pt(name), shape: sh, anchor: pm(m), r: (A.w * FT * s) / 2 + 2 });
  }
  // Portable restrooms: a row of 12 units along the west loop road
  { const m = gm(pt('Portable Restrooms')), A = ASSUME.restroom, u = A.unit * FT, gp = A.gap * FT, len = A.n * u + (A.n - 1) * gp; let sh = '';
    for (let i = 0; i < A.n; i++) { const o = -len / 2 + u / 2 + i * (u + gp); sh += `<path d="${poly(rect([m[0] + Math.cos(aWest) * o, m[1] + Math.sin(aWest) * o], u, u, aWest))}" fill="${C.rest}" stroke="${C.restEdge}" stroke-width="1.1"/>`; }
    items.push({ key: 'restrooms', label: 'Portable restrooms (12)', where: pt('Portable Restrooms'), shape: sh, anchor: pm(m), r: 6 }); }
  // Water hose: small spigot pad
  { const m = gm(pt('Water hose')), A = ASSUME.water, ps = rect(m, A.w * FT, A.l * FT, aSouth), [x, y] = pm(m);
    items.push({ minor: true, key: 'water', label: 'Water hose', where: pt('Water hose'), shape: `<path d="${poly(ps)}" fill="#7d9cc4" stroke="#fff" stroke-width="1"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.max(4, A.w * FT * s * 0.8))}" fill="none" stroke="#7d9cc4" stroke-width="1.2"/>`, anchor: [x, y], r: 7 }); }
  // nearest road segment (ground frame) to a point -> foot point + angle
  const nearestRoad = (q: [number, number]) => { const p = gm(q); let best: [number, [number, number], number, number] = [Infinity, p, 0, 0];
    for (const f of osm) { if (!(f.properties.highway in RW) || f.geometry.type !== 'LineString') continue; const g2 = (f.geometry.coordinates as [number, number][]).map(gm);
      for (let i = 1; i < g2.length; i++) { const [a, b] = [g2[i - 1], g2[i]], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), fx = a[0] + t * dx, fy = a[1] + t * dy, dd = Math.hypot(p[0] - fx, p[1] - fy);
        if (dd < best[0]) best = [dd, [fx, fy], Math.atan2(dy, dx), RW[f.properties.highway]]; } }
    return best; };
  // Start / Finish: arch across the course at the S/F point (posts + checkered banner), perpendicular to the course
  { const q = pt('Start / Finish Line'), m = gm(q); let k = 0, bd = Infinity; tail.forEach((t, i) => { const dd = Math.hypot(...(gm(t).map((v, j) => v - m[j]) as [number, number])); if (dd < bd) { bd = dd; k = i; } });
    void k; const a = nearestRoad(q)[2], half = (ASSUME.arch.span * FT) / 2, ux = Math.cos(a), uy = Math.sin(a);
    const e1 = pm([m[0] - ux * half, m[1] - uy * half]), e2 = pm([m[0] + ux * half, m[1] + uy * half]), n = 8; let chk = '';
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p0 = [e1[0] + (e2[0] - e1[0]) * t0, e1[1] + (e2[1] - e1[1]) * t0], p1 = [e1[0] + (e2[0] - e1[0]) * t1, e1[1] + (e2[1] - e1[1]) * t1]; chk += `<path d="M${p0.map(f1)}L${p1.map(f1)}" stroke="${i % 2 ? '#fff' : C.ink}" stroke-width="5"/>`; }
    items.push({ key: 'sf', label: 'Start / Finish arch', where: sfPlace ?? q, shape: `<path d="M${e1.map(f1)}L${e2.map(f1)}" stroke="${C.ink}" stroke-width="8" stroke-linecap="butt"/>${chk}<rect x="${f1(e1[0] - 4)}" y="${f1(e1[1] - 4)}" width="8" height="8" fill="${C.ink}"/><rect x="${f1(e2[0] - 4)}" y="${f1(e2[1] - 4)}" width="8" height="8" fill="${C.ink}"/>`, anchor: pm(m), r: 10 }); }
  // Restricted access: gate across the nearest road
  { const q0 = pt('Restricted Access'), q = q0, [, foot, a0, hw] = nearestRoad([q0[0] + GATE_EAST_M / 97100, q0[1]]), a = a0 + Math.PI / 2, half = hw / 2 + 0.6, ux = Math.cos(a), uy = Math.sin(a);
    const e1 = pm([foot[0] - ux * half, foot[1] - uy * half]), e2 = pm([foot[0] + ux * half, foot[1] + uy * half]), mid = pm(foot);
    // swing gate: two leaves meeting in the middle, posts at the ends, red/white barrier stripes
    let sh = `<path d="M${e1.map(f1)}L${e2.map(f1)}" stroke="${C.red}" stroke-width="5"/>`;
    for (let i = 1; i < 6; i += 2) { const t0 = i / 6, t1 = (i + 1) / 6; sh += `<path d="M${f1(e1[0] + (e2[0] - e1[0]) * t0)},${f1(e1[1] + (e2[1] - e1[1]) * t0)}L${f1(e1[0] + (e2[0] - e1[0]) * t1)},${f1(e1[1] + (e2[1] - e1[1]) * t1)}" stroke="#fff" stroke-width="5"/>`; }
    sh += `<circle cx="${f1(e1[0])}" cy="${f1(e1[1])}" r="4.5" fill="${C.ink}"/><circle cx="${f1(e2[0])}" cy="${f1(e2[1])}" r="4.5" fill="${C.ink}"/>`;
    items.push({ key: 'gate', label: 'Restricted access', where: q, shape: sh, anchor: mid, r: 8 }); }
  // Barton Warnock (label inside the building)
  g += `</g>`;
  let shapes = '', lbls = '';
  // collision scene: course line (buffered), every footprint/symbol (hull of its drawn geometry), labels, leaders, road label
  const sc = new Scene('finish plan', W, H), hullOf = (svg: string): Pt[] => { const ps: Pt[] = []; for (const m of svg.matchAll(/(?:d="|[ML])\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) ps.push([+m[1], +m[2]]);
    for (const m of svg.matchAll(/<(?:circle) cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) { const [x, y, r] = [+m[1], +m[2], +m[3]]; ps.push([x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]); }
    for (const m of svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) { const [x, y, w, h] = [+m[1], +m[2], +m[3], +m[4]]; ps.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]); }
    ps.sort((u, v) => u[0] - v[0] || u[1] - v[1]); const cr = (o: Pt, u: Pt, v: Pt) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]), lo: Pt[] = [], up: Pt[] = [];
    for (const q of ps) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of [...ps].reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return [...lo.slice(0, -1), ...up.slice(0, -1)]; };
  sc.add(lineOb('route', tail.map((q) => P(q) as Pt), (1.6 * s) / 2 + 3, 'line'));
  stallZones.forEach((z, i) => sc.add(polyOb(`stalls${i}`, z, 'zone')));
  for (const it of items) { const h = hullOf(it.shape); if (h.length > 2) { const o = polyOb(it.key + ':icon', h, it.key === 'dropoff' || it.key === 'picnic' ? 'zone' : 'icon'); o.caps = h.map((p, i) => ({ a: p, b: h[(i + 1) % h.length], r: 2 })); sc.add(o); } }
  const bw = P([-103.757407, 29.269773]), BWT = 'Barton Warnock\nVisitor Center'; sc.add(textOb('bw:label', bw[0], bw[1] + 70, BWT, 19));
  for (const it of items) {
    shapes += gmapLink(it.where, it.label, `<g class="fp-${it.key}">${it.shape}</g>`);
    const pref = labels[it.key] ?? [0, -24], fs = it.minor ? 13 : 17, inside = pref[0] === 0 && pref[1] === 0;
    const r = sc.place(it.key + ':label', it.anchor, pref as Pt, (x, y) => textOb('', x, y, it.label, fs), { iconR: it.r, leader: !inside, ignore: (q) => inside && q.id === it.key + ':icon' });
    if (r.leader) lbls += leaderLine(r.leader[0][0], r.leader[0][1], r.leader[1][0], r.leader[1][1]);
    lbls += textBlock(r.x, r.y, { text: it.label, fs, color: it.key === 'dropoff' ? '#8a5a00' : it.minor ? C.mute : C.ink, style: it.key === 'dropoff' || it.minor ? 'italic' : 'normal', weight: it.minor ? 'normal' : 'bold', family: 'sans', halo: { color: '#fff', width: 4.5 }, ha: 'center' });
  }
  lbls += gmapLink(sfPlace ?? [-103.757522, 29.269797], 'Barton Warnock Visitor Center', textBlock(bw[0], bw[1] + 70, { text: BWT, fs: 19, color: C.ink, style: 'normal', weight: 'bold', family: 'sans', halo: { color: C.bld, width: 4 }, ha: 'center', linespacing: 1.15 }));
  { const F = fmGeo(B, 0.5); if (F) { let ok = false; const a = F.an * Math.PI / 180;
    for (const t of [0, 40, -40, 80, -80, 120, -120]) { const x = F.x + Math.cos(a) * t, y = F.y + Math.sin(a) * t, ob = textOb('fmlabel', x, y, 'FM 170', 16, F.an); if (!sc.inFrame(ob) || sc.hit(ob, (q) => q.id === 'dropoff:icon')) continue; sc.add(ob); lbls += lbl(x, y, 'FM 170', { fs: 16, color: '#5d5850', rot: -F.an }); ok = true; break; }
    if (!ok) throw new Error('[collide:finish plan] no room for FM 170 label'); } }
  checkAreasOffRoads('finish plan', B, [...['ISL_BIG', 'ISL_W', 'ISL_E', 'SHED'].map((k) => ({ id: k, pts: TRc[k].map(P) })), ...(dropRing ? [{ id: 'dropoff', pts: dropRing }] : [])]);
  const nOb = sc.audit((a, b) => a.id.split(':')[0] === b.id.split(':')[0] || (a.id === 'sf:icon' && b.id === 'route') || (a.id === 'fmlabel' && b.id === 'dropoff:icon') || (a.kind === 'zone' && b.kind === 'icon'));
  console.log(`  collide: finish plan OK (${nOb} objects, route buffered)`);
  let out = g + shapes + lbls + furniture(W, H, s, [0, 25, 50, 100], 'Grid 10 m (≈33 ft) · footprints to scale');
  return `<svg class="siteplan floorplan" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Finish area floor plan">${out}</svg>`;
}
export const fpSwatch = {
  rect: (fill: string, stroke: string, x = false) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="2" y="2" width="26" height="16" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>${x ? `<path d="M2,2L28,18M28,2L2,18" stroke="${stroke}" stroke-width=".8" stroke-opacity=".5"/>` : ''}</svg>`,
  restrooms: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<rect x="${2 + i * 7}" y="6" width="6" height="8" fill="${C.rest}" stroke="${C.restEdge}" stroke-width="1"/>`).join('')}</svg>`,
  arch: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M3,10H27" stroke="${C.ink}" stroke-width="7"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${3 + i * 4},10h4" stroke="${i % 2 ? '#fff' : C.ink}" stroke-width="4"/>`).join('')}</svg>`,
  gate: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M4,10H26" stroke="${C.red}" stroke-width="5"/><path d="M8,10h4M16,10h4" stroke="#fff" stroke-width="5"/><circle cx="4" cy="10" r="3.5" fill="${C.ink}"/><circle cx="26" cy="10" r="3.5" fill="${C.ink}"/></svg>`,
  course: (col: string) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M2,10H28" stroke="#fff" stroke-width="6"/><path d="M2,10H28" stroke="${col}" stroke-width="3"/></svg>`,
  area: (fill: string, stroke: string, dash = false, hatch = false) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="2" y="2" width="26" height="16" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.8"${dash ? ' stroke-dasharray="4 2.5"' : ''}/>${hatch ? `<path d="M6,18L18,2M14,18L26,2" stroke="${stroke}" stroke-width="1.5" stroke-opacity=".6"/>` : ''}</svg>`,
  road: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M2,10H28" stroke="${C.roadEdge}" stroke-width="9"/><path d="M2,10H28" stroke="${C.road}" stroke-width="7"/><path d="M3,10H28" stroke="#fff" stroke-width="1.2" stroke-dasharray="4 4"/></svg>`,
  water: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><circle cx="15" cy="10" r="6" fill="none" stroke="${C.blue}" stroke-width="1.6"/><rect x="12.5" y="7.5" width="5" height="5" fill="${C.blue}"/></svg>`,
  bld: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="2" y="2" width="26" height="16" fill="${C.bld}" stroke="${C.bldEdge}" stroke-width="2"/></svg>`,
};
void esc;

// ---------------- parking plan ----------------
// KML "Parking" polygons only say WHICH road stretch has parking (start/end and side); the strips are drawn as clean bands
// offset from the OSM road centerline: shoulder gap 2 ft, depth 20 ft, simulated stall stripes every 9 ft (real lots are dirt).
export const PARK = { gapFt: 5, depthFt: 20, stallFt: 9 };
const PFRAME = [-103.76125, 29.26835, -103.75125, 29.27425];
const PICON = (slash: boolean) => slash
  // standard No Parking sign: white disc, black P, red ring + red diagonal slash over the P
  ? `<circle r="13" fill="#fff" stroke="${C.red}" stroke-width="3.2"/><text y="1" font-size="17" font-weight="800" fill="#111" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif">P</text><path d="M-9.2,-9.2L9.2,9.2" stroke="${C.red}" stroke-width="3.2"/>`
  : `<rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fff"/><rect x="-12" y="-12" width="24" height="24" rx="4" fill="${C.blue}"/><text y="1" font-size="17" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">P</text>`;
/** every course's GPX line inside the frame, black with a white casing (runners on course near S/F) */
/** 100K route inside the frame, outbound leg only (the return leg is the same path; GPX differences are routing noise) */
function routePts(c, B): Pt[] { const { P, W, H } = B; const runs: Pt[][] = []; let cur: Pt[] = [];
  for (const q of c.courseGeo['100K'].features[0].geometry.coordinates as [number, number][]) { const p = P(q) as Pt; if (p[0] > -60 && p[1] > -60 && p[0] < W + 60 && p[1] < H + 60) cur.push(p); else { if (cur.length > 1) runs.push(cur); cur = []; } }
  if (cur.length > 1) runs.push(cur); return runs[0] ?? []; }
function courseRoutes(c, B) { const dd = 'M' + routePts(c, B).map((p) => p.map(f1).join(',')).join('L');
  return `<path d="${dd}" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".9"/><path d="${dd}" fill="none" stroke="#111" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`; }
type V = [number, number];
function roadTools(B) {
  const { gm, osm } = B;
  // road centerlines in ground meters; FM 170's OSM ways chained into one line
  const lines: { h: string; pts: V[] }[] = [];
  const sec = osm.filter((f) => f.properties.highway === 'secondary' && f.geometry.type === 'LineString').map((f) => (f.geometry.coordinates as V[]).map(gm));
  let chain = sec.shift() ?? []; const near = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1;
  while (sec.length) { const i = sec.findIndex((w) => near(w[0], chain[chain.length - 1]) || near(w[w.length - 1], chain[chain.length - 1]) || near(w[0], chain[0]) || near(w[w.length - 1], chain[0])); if (i < 0) break;
    let w = sec.splice(i, 1)[0]; if (near(w[w.length - 1], chain[chain.length - 1]) || near(w[0], chain[0])) w = w.reverse();
    chain = near(w[0], chain[chain.length - 1]) ? [...chain, ...w.slice(1)] : [...w.slice(0, -1), ...chain]; }
  lines.push({ h: 'secondary', pts: chain });
  for (const f of osm) if (['service', 'residential', 'track'].includes(f.properties.highway) && f.geometry.type === 'LineString') lines.push({ h: f.properties.highway, pts: (f.geometry.coordinates as V[]).map(gm) });
  const cum = (pts: V[]) => { const a = [0]; for (let i = 1; i < pts.length; i++) a.push(a[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return a; };
  const project = (pts: V[], cs: number[], p: V) => { let best = [Infinity, 0, 0]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    const fx = a[0] + t * dx, fy = a[1] + t * dy, dd = Math.hypot(p[0] - fx, p[1] - fy); if (dd < best[0]) best = [dd, cs[i - 1] + t * Math.sqrt(L2), Math.sign(dx * (p[1] - a[1]) - dy * (p[0] - a[0]))]; } return best; };
  const at = (pts: V[], cs: number[], sv: number): V => { let i = 1; while (i < cs.length - 1 && cs[i] < sv) i++; const t = (sv - cs[i - 1]) / (cs[i] - cs[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; };
  // smoothed unit tangent: chord over ±10 m (no kinks from OSM vertices)
  const tan = (pts: V[], cs: number[], sv: number): V => { const a = at(pts, cs, Math.max(0, sv - 10)), b = at(pts, cs, Math.min(cs[cs.length - 1], sv + 10)), n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / n, (b[1] - a[1]) / n]; };
  const RWm: Record<string, number> = { secondary: 10, service: 5.5, track: 3.5, residential: 6.5 };
  return { lines, cum, project, at, tan, RWm };
}
export function renderParkingPlan(c, labels: Record<string, [number, number]>) {
  const B = makeBase(c, PFRAME, 50, 'pk'), { gm, pm, P, d, s, W, H, osm, L } = B; let g = B.g;
  const { lines, cum, project, at, tan, RWm } = roadTools(B);
  const sc = new Scene('parking plan', W, H), base = (id: string) => id.split(':')[0];
  let strips = '', top = '', fmSide = 0; // top = icons + labels + leaders (drawn above everything)
  const labelQ: (() => void)[] = [], iconQ0: (() => void)[] = []; // labels are placed after every icon / line / zone is registered
  const T = (id: string, text: string, fs: number, rot = 0) => (x: number, y: number) => textOb(id, x, y, text, fs, rot);
  // course route (100K, outbound leg only) — protected line, ~3 px halo buffer
  const rp = routePts(c, B); if (process.env.CDEBUG) console.log('route', JSON.stringify(rp.filter((p) => p[1] > 180 && p[1] < 340).map((p) => p.map(Math.round)))); sc.add(lineOb('route', rp, 1.3 + 4, 'line'));
  L.placemarks.filter((p) => p.kind === 'polygon' && p.name === 'Parking').forEach((pg, k) => {
    const vs = (pg.coords as V[]).map(gm); let best: any = null;
    for (const ln of lines) { const cs = cum(ln.pts), pr = vs.map((v) => project(ln.pts, cs, v)), md = pr.reduce((t, q) => t + q[0], 0) / pr.length; if (!best || md < best.md) best = { ln, cs, pr, md }; }
    const { ln, cs, pr } = best, s0 = Math.min(...pr.map((q) => q[1])), s1 = Math.max(...pr.map((q) => q[1])), side = Math.sign(pr.reduce((t, q) => t + q[2], 0)) || 1;
    if (ln.h === 'secondary') fmSide = side;
    const o1 = RWm[ln.h] / 2 + PARK.gapFt * FT, o2 = o1 + PARK.depthFt * FT, inner: V[] = [], outer: V[] = [];
    const off = (sv: number, o: number): V => { const p = at(ln.pts, cs, sv), t = tan(ln.pts, cs, sv); return [p[0] - t[1] * o * side, p[1] + t[0] * o * side]; };
    for (let sv = s0; sv <= s1 + 1e-6; sv += 2) { inner.push(off(sv, o1)); outer.push(off(sv, o2)); }
    const ring = [...inner, ...outer.reverse()].map(pm), band = 'M' + ring.map((q) => q.map(f1).join(',')).join('L') + 'Z';
    sc.add(polyOb(`strip${k + 1}`, ring as Pt[], 'zone'));
    let ticks = ''; const st = PARK.stallFt * FT, n = Math.floor((s1 - s0) / st);
    for (let i = 0; i <= n; i++) { const sv = s0 + i * st, a = pm(off(sv, o1)), b = pm(off(sv, o2)); ticks += `M${a.map(f1)}L${b.map(f1)}`; }
    strips += gmapLink([pg.coords.reduce((t, q) => t + q[0], 0) / pg.coords.length, pg.coords.reduce((t, q) => t + q[1], 0) / pg.coords.length], `Parking strip ${k + 1}`, `<path mask="url(#pkmask)" d="${band}" fill="#dfe7f2" stroke="${C.blue}" stroke-width="1.6" stroke-linejoin="round"/><path mask="url(#pkmask)" d="${ticks}" stroke="${C.blue}" stroke-width=".8" stroke-opacity=".55"/>`);
    // strip runs off the plan edge -> small "parking continues" arrow just inside the frame (no extra stalls drawn)
    { const inF = (q: number[]) => q[0] > 14 && q[0] < W - 14 && q[1] > 14 && q[1] < H - 14, om = (o1 + o2) / 2, edgeD = (q: number[]) => Math.min(q[0], q[1], W - q[0], H - q[1]);
      for (const [sEnd, dir] of [[s0, -1], [s1, 1]] as const) { if (inF(pm(off(sEnd, om))) && edgeD(pm(off(sEnd, om))) > 80) continue;
        let sv = sEnd; while (Math.abs(sv - (s0 + s1) / 2) > 1 && !inF(pm(off(sv + dir * 30, om)))) sv -= dir * 2; sv -= dir * 6;
        const a = pm(off(sv, o2 + 7)), b = pm(off(sv + dir * 14, o2 + 7)), an = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, id = `cont${k}${dir}`;
        const ux = Math.cos(an * Math.PI / 180), uy = Math.sin(an * Math.PI / 180);
        sc.add(lineOb(id + ':icon', [[b[0] - ux * 22, b[1] - uy * 22], [b[0], b[1]]], 5, 'icon'));
        top += `<g transform="translate(${f1(b[0])} ${f1(b[1])}) rotate(${f1(an)})" opacity=".9"><path d="M-22,0H-2" stroke="${C.blue}" stroke-width="2"/><path d="M0,0L-8,-5L-8,5Z" fill="${C.blue}"/></g>`;
        const lp = pm(off(sv - dir * 30, o2 + 32)), anc: Pt = [b[0] - ux * 11, b[1] - uy * 11];
        labelQ.push(() => { const r = sc.place(id + ':label', anc, [lp[0] - anc[0], lp[1] - anc[1]], T(id, 'Parking continues', 11), { leader: false, rings: [20, 28, 36, 46, 58] }); top += lbl(r.x, r.y, 'Parking continues', { fs: 11, color: C.blue, style: 'italic' }); }); } }
    const mid = pm(off((s0 + s1) / 2, o2 + 9)), [ox, oy] = labels[`strip${k + 1}`] ?? [0, 0], t = tan(ln.pts, cs, (s0 + s1) / 2);
    let an = Math.atan2(-t[1], t[0]) * 180 / Math.PI; if (an > 90) an -= 180; if (an < -90) an += 180; const txt = `≈${n} spaces`;
    labelQ.push(() => { const r = sc.place(`strip${k + 1}lbl:label`, mid as Pt, [ox, oy], T('', txt, 14, an), { leader: false }); top += lbl(r.x, r.y, txt, { fs: 14, color: C.blue, style: 'italic', rot: -an }); });
  });
  g += `<defs>${B.roadMask('pkmask')}</defs>` + strips;
  g += courseRoutes(c, B);
  // No-parking shoulder: full length of FM 170 on the side opposite the venue / parking
  { const ln = lines[0], cs = cum(ln.pts), sd = -(fmSide || 1), o1 = RWm.secondary / 2 + PARK.gapFt * FT, o2 = o1 + PARK.depthFt * FT, inner: V[] = [], outer: V[] = [], tot = cs[cs.length - 1];
    const off = (sv: number, o: number): V => { const p = at(ln.pts, cs, sv), t = tan(ln.pts, cs, sv); return [p[0] - t[1] * o * sd, p[1] + t[0] * o * sd]; };
    for (let sv = 0; sv <= tot; sv += 2) { inner.push(off(sv, o1)); outer.push(off(sv, o2)); }
    const ring = [...inner, ...outer.reverse()].map(pm), band = 'M' + ring.map((q) => q.map(f1).join(',')).join('L') + 'Z';
    sc.add(polyOb('npshoulder', ring as Pt[], 'zone'));
    g += `<defs><pattern id="pknph" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${C.red}" stroke-width="1.3" stroke-opacity=".55"/></pattern></defs><path mask="url(#pkmask)" d="${band}" fill="#f6dede" fill-opacity=".7"/><path mask="url(#pkmask)" d="${band}" fill="url(#pknph)" stroke="${C.red}" stroke-width="1" stroke-opacity=".7" stroke-linejoin="round"/>`;
    // signs at intervals just outside the shoulder band (slid along the road until clear), plus one note
    const inF = (q: number[]) => q[0] > 30 && q[0] < W - 30 && q[1] > 30 && q[1] < H - 30;
    const vis: number[] = []; for (let sv = 0; sv <= tot; sv += 5) if (inF(pm(at(ln.pts, cs, sv)))) vis.push(sv);
    const sA = vis[0] ?? 0, sB = vis[vis.length - 1] ?? tot, sAt = (f: number) => sA + (sB - sA) * f;
    const pairP: number[] = [];
    for (const [i, f] of [0.15, 0.5, 0.85].entries()) { let done = false;
      for (const df of [0, 0.02, -0.02, 0.04, -0.04, 0.06, -0.06, 0.08, -0.08]) { const q = pm(off(sAt(f + df), o2 + 12)), ob = circleOb(`npsign${i}:icon`, q[0], q[1], 11);
        if (!inF(q) || sc.hit(ob, (o) => o.id === 'npshoulder')) continue; sc.add(ob); top += `<g transform="translate(${f1(q[0])} ${f1(q[1])}) scale(.8)">${PICON(true)}</g>`; done = true; pairP.push(sAt(f + df)); break; }
      if (!done) throw new Error('[collide:parking plan] no room for no-parking sign ' + i); }
    // matching blue Parking sign directly opposite each No Parking sign / zone (parking side of FM 170, just outside the stalls)
    const npPt = L.placemarks.find((p) => p.kind === 'point' && p.name === 'No Parking'); if (npPt) pairP.push(project(ln.pts, cs, gm(npPt.coords[0]))[1]);
    const offP = (sv: number, o: number): V => { const p = at(ln.pts, cs, sv), t = tan(ln.pts, cs, sv), sp = fmSide || 1; return [p[0] - t[1] * o * sp, p[1] + t[0] * o * sp]; };
    iconQ0.push(() => pairP.forEach((sv, i) => { let done = false;
      for (const ds of [0, 6, -6, 12, -12, 18, -18, 26, -26, 34, -34]) for (const o of [o2 + 12, o2 + 18]) { if (done) break; const q = pm(offP(sv + ds, o)), ob = circleOb(`ppair${i}:icon`, q[0], q[1], 12);
        if (!inF(q) || sc.hit(ob, (x) => x.id.startsWith('strip'))) continue; sc.add(ob); top += `<g transform="translate(${f1(q[0])} ${f1(q[1])}) scale(.8)">${PICON(false)}</g>`; done = true; }
      if (!done) throw new Error('[collide:parking plan] no room for paired Parking sign ' + i); }));
    const [nx, ny] = labels.noPark ?? [0, 0], np = pm(off(sAt(0.3), o2 + 70)), NT = 'No parking on this side of FM 170\nDo not cross the highway · vehicles may be towed or ticketed';
    labelQ.push(() => { const r = sc.place('npnote:label', np as Pt, [nx, ny], T('', NT, 13), { leader: false }); top += lbl(r.x, r.y, NT, { fs: 13, color: C.red }); }); }
  // drop-off lane
  const drop = L.placemarks.find((p) => p.name === '5 Min Dropoff Area');
  if (drop) { const DB = dropBand(B, drop); sc.add(polyOb('dropoff', DB.ring.map(pm) as Pt[], 'zone'));
    g += gmapLink(drop.coords[0], '5-minute drop-off', `<path d="${DB.band}" fill="#f6e2b0" fill-opacity=".85"/><path d="${DB.band}" fill="url(#pkhatch)" stroke="${C.amber}" stroke-width="2" stroke-linejoin="round"/>`);
    const [ax, ay] = DB.anchor, [ox, oy] = labels.dropoff ?? [-70, 0];
    labelQ.push(() => { const r = sc.place('dropoff:label', [ax, ay], [ox, oy], T('', '5-minute\ndrop-off', 17), { leader: false }); top += lbl(r.x, r.y, '5-minute\ndrop-off', { color: '#8a5a00', style: 'italic' }); }); }
  // FM 170 road label (protected)
  { const F = fmGeo(B, 0.28); if (F) { const a = F.an * Math.PI / 180, nx = -Math.sin(a), ny = Math.cos(a), cands: Pt[] = [];
      for (const d of [36, 44, 52, -36, -44, -52]) for (const t of [0, 30, -30, 60, -60]) cands.push([nx * d + Math.cos(a) * t, ny * d + Math.sin(a) * t]);
      labelQ.unshift(() => { for (const [ox, oy] of cands) { const ob = textOb('fmlabel', F.x + ox, F.y + oy, 'FM 170', 16, F.an, 'label'); if (!sc.inFrame(ob) || sc.hit(ob)) continue; sc.add(ob); top += lbl(F.x + ox, F.y + oy, 'FM 170', { fs: 16, color: '#5d5850', rot: -F.an }); return; }
        throw new Error('[collide:parking plan] no room for FM 170 label'); }); } }
  // point markers: Parking, No parking (park entrance), Start / Finish, Barton Warnock (reference)
  const seen: Record<string, number> = {}, sfPlace = c.stations.stations['S/F'].place, iconQ: (() => void)[] = [];
  for (const p of L.placemarks.filter((p) => p.kind === 'point' && ['Parking', 'No Parking', 'Start / Finish Line', 'Barton Warnock'].includes(p.name))) {
    const key = (p.name + (seen[p.name] = (seen[p.name] ?? 0) + 1)).replace(/[^A-Za-z0-9]/g, ''), [x, y] = P(p.coords[0]), [ox, oy] = labels[p.name + seen[p.name]] ?? [0, -30];
    const lab = p.name === 'Start / Finish Line' ? 'Start / Finish' : p.name === 'Barton Warnock' ? 'Barton Warnock\nVisitor Center' : 'Parking';
    const where = p.name === 'Start / Finish Line' || p.name === 'Barton Warnock' ? sfPlace ?? p.coords[0] : p.coords[0];
    if (p.name === 'Barton Warnock') { labelQ.push(() => { const r = sc.place(key + ':label', [x, y], [ox, oy], T('', lab, 15), { leader: false, rings: [10, 20, 30] }); top += gmapLink(where, 'Barton Warnock Visitor Center', lbl(r.x, r.y, lab, { fs: 15 })); }); continue; }
    if (p.name === 'No Parking') { // park entrance: the whole drivable entrance surface as ONE tinted no-parking shape; sign + label placed clear of it
      const R = 35 * s, cid = `pknpz${seen[p.name]}`, pts: number[][] = [], hw = 3.5 * s, inR = (q: number[]) => Math.hypot(q[0] - x, q[1] - y) <= R;
      for (const f of osm) { const h = f.properties.highway, isLot = f.properties.amenity === 'parking' && f.geometry.type === 'Polygon';
        if (!isLot && (!['service', 'residential', 'track', 'unclassified'].includes(h) || f.geometry.type !== 'LineString')) continue;
        const cs = (isLot ? f.geometry.coordinates[0] : f.geometry.coordinates).map(P);
        for (let i = 1; i < cs.length; i++) { const [a1, b1] = [cs[i - 1], cs[i]], L = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1, nx = -(b1[1] - a1[1]) / L, ny = (b1[0] - a1[0]) / L;
          for (let t = 0; t <= 1; t += 2 / L) { const q = [a1[0] + (b1[0] - a1[0]) * t, a1[1] + (b1[1] - a1[1]) * t]; if (!inR(q)) continue; const e = isLot ? 0 : hw; pts.push([q[0] + nx * e, q[1] + ny * e], [q[0] - nx * e, q[1] - ny * e]); } } }
      pts.sort((u, v) => u[0] - v[0] || u[1] - v[1]); const cr = (o: number[], u: number[], v: number[]) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]); const lo: number[][] = [], up: number[][] = [];
      for (const q of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (const q of [...pts].reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      const hull = [...lo.slice(0, -1), ...up.slice(0, -1)].filter(inR) as Pt[];
      if (hull.length > 2) { sc.add(polyOb('npentrance', hull, 'zone')); g += `<defs><clipPath id="${cid}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(R)}"/></clipPath></defs><defs>${B.roadMask(cid + 'm', (h) => h === 'secondary')}</defs><path mask="url(#${cid}m)" clip-path="url(#${cid})" d="M${[...lo.slice(0, -1), ...up.slice(0, -1)].map((q) => q.map(f1).join(',')).join('L')}Z" fill="#f3d4d4" stroke="${C.red}" stroke-opacity=".55" stroke-width="1.4" stroke-linejoin="round"/>`
        // the main road stays uncovered: redraw FM 170 (edge, gray pavement, white centerline) on top of the zone
        let fm = ''; for (const f of osm) if (f.properties.highway === 'secondary' && f.geometry.type === 'LineString') { const dd = d(f.geometry.coordinates), w = B.RW.secondary * s;
          fm += `<path d="${dd}" fill="none" stroke="${C.roadEdge}" stroke-width="${f1(w + 2.4)}" stroke-linejoin="round"/><path d="${dd}" fill="none" stroke="${C.road}" stroke-width="${f1(w)}" stroke-linejoin="round"/><path d="${dd}" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="${f1(Math.max(3 * s, 6))} ${f1(Math.max(6 * s, 9))}"/>`; }
        g += `<g clip-path="url(#${cid})">${fm}${courseRoutes(c, B)}</g>`; }
      iconQ.push(() => { const r = sc.place(key + ':icon', [x, y], [ox, oy], (X, Y) => circleOb('', X, Y, 13), { leader: false, rings: [40, 52, 64, 78, 95, 115] });
        top += gmapLink(where, 'No parking — park entrance', `<g transform="translate(${f1(r.x)} ${f1(r.y)}) scale(.85)">${PICON(true)}</g>`);
        labelQ.unshift(() => { const q = sc.place(key + ':label', [r.x, r.y], [0, -22], T('', 'No parking at park entrance', 13), { leader: false, rings: [22, 26, 32, 40, 50, 62, 76] }); top += lbl(q.x, q.y, 'No parking at park entrance', { fs: 13, color: C.red }); }); });
      continue; }
    if (p.name === 'Start / Finish Line') { sc.add(circleOb(key + ':icon', x, y, 17)); top += gmapLink(where, lab, station(x, y, 'S/F', true, { s: 1000, fs: 20, badge: false, colors: c.colors }));
      labelQ.push(() => { const r = sc.place(key + ':label', [x, y], [ox, oy], T('', lab, 17), { iconR: 17 }); if (r.leader) top += leaderLine(r.leader[0][0], r.leader[0][1], r.leader[1][0], r.leader[1][1]); top += lbl(r.x, r.y, lab); }); continue; }
    // Parking icon: at the KML point unless that touches the route / a label / a zone (strips excepted) -> nearest clear spot
    iconQ.push(() => { const r = sc.place(key + ':icon', [x, y], labels[key + 'icon'] ?? [0, 0], (X, Y) => circleOb('', X, Y, 15), { leader: false, ignore: (o) => o.id.startsWith('strip'), rings: [16, 22, 28, 36, 46] });
      if (process.env.CDEBUG) console.log('icon', key, x, y, '->', r.x, r.y);
      top += gmapLink(where, lab, `<g transform="translate(${f1(r.x)} ${f1(r.y)})">${PICON(false)}</g>`);
      labelQ.push(() => { const q = sc.place(key + ':label', [r.x, r.y], [ox, oy], T('', lab, 17), { iconR: 15, leaderIgnore: (o) => o.id.startsWith('strip') }); if (q.leader) top += leaderLine(q.leader[0][0], q.leader[0][1], q.leader[1][0], q.leader[1][1]); top += lbl(q.x, q.y, lab); }); });
  }
  checkAreasOffRoads('parking plan', B, sc.obs.filter((o) => o.kind === 'zone' && o.poly && o.id !== 'npentrance' && !o.id.startsWith('strip') && o.id !== 'npshoulder') /* strips + shoulder are road-masked by construction */.map((o) => ({ id: o.id, pts: o.poly! })));
  iconQ.forEach((f) => f()); iconQ0.forEach((f) => f()); while (labelQ.length) labelQ.shift()!();
  // strict audit: icons may sit on their own parking strip; S/F sits on the route by definition; leaders touch their own icon/label
  const n = sc.audit((a, b) => ((a.kind === 'icon' || a.kind === 'leader') && a.id.startsWith('Parking') && b.id.startsWith('strip')) || (a.id.startsWith('StartFinish') && a.kind === 'icon' && b.id === 'route') || base(a.id) === base(b.id) || (a.id.startsWith('npsign') && b.id === 'npshoulder') || (a.id.startsWith('ppair') && b.id.startsWith('strip')));
  console.log(`  collide: parking plan OK (${n} objects, route buffered)`);
  g += `</g>`;
  return `<svg class="siteplan floorplan" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Parking plan">${g}${top}${furniture(W, H, s, [0, 250, 500, 1000], `Grid 50 m (≈164 ft) · stalls ${PARK.depthFt} ft deep, ${PARK.gapFt} ft dirt buffer from the pavement edge, stalls every ${PARK.stallFt} ft (simulated)`)}</svg>`;
}
export const pkSwatch = {
  noPark: () => `<svg width="30" height="14"><defs><pattern id="swnp" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${C.red}" stroke-width="1" stroke-opacity=".6"/></pattern></defs><rect x="1" y="3" width="28" height="8" fill="#f6dede"/><rect x="1" y="3" width="28" height="8" fill="url(#swnp)" stroke="${C.red}" stroke-width=".8"/></svg>`,
  strip: () => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="2" y="5" width="26" height="10" fill="#dfe7f2" stroke="${C.blue}" stroke-width="1.4"/><path d="M6,5V15M10,5V15M14,5V15M18,5V15M22,5V15M26,5V15" stroke="${C.blue}" stroke-width=".8" stroke-opacity=".6"/></svg>`,
  p: (slash = false) => `<svg viewBox="-15 -15 30 30" width="22" height="22" aria-hidden="true">${PICON(slash)}</svg>`,
};
