// Regional mode of the main map (SSOT data + styles of mainmap.ts at a wider extent): highways, towns, hospital, Rio Grande, park boundary,
// race routes in race colours, aid stations as small markers and drive times. No hillshade, no trail labels.
// Used by (a) the PDF-only regional page (renderRegional, own projection) and (b) the web main map when zoomed out past the default frame
// (regionFrag: same layer in main-map coordinates, lazy-loaded by zoom.ts; strokes non-scaling, texts counter-scaled by zoom.ts).
// Data: content/regional.geojson (from sources/curated/regional.geojson, fetched once by tools/regional-fetch.ts; never in CI).
import { R, f1, esc, simplifyPts, station, viewProjection } from './util';
import { northG } from './north';
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
  for (const f of F.filter((f) => f.properties.kind === 'county')) for (const l of f.geometry.coordinates) s += ln(l, '#b0b0b0', 0.9, ` stroke-dasharray="${f1(6 * o.sw)} ${f1(2.5 * o.sw)} ${f1(1 * o.sw)} ${f1(2.5 * o.sw)}"`);
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
  counties: [['BREWSTER COUNTY', -103.45, 30.02], ['PRESIDIO COUNTY', -104.4, 30.05], ['JEFF DAVIS COUNTY', -104.25, 30.47]] as [string, number, number][] };
/** labels + point symbols of the regional layer (drawn above the race routes) */
export function regionTop(c: Ctx, proj: P, o: { fs: number; sw: number; web: boolean }) {
  const F = (c as any).regional.features as any[], halo = `stroke="#fff" stroke-width="${f1(o.fs * 0.28)}" paint-order="stroke" stroke-linejoin="round"`;
  const txt = (x: number, y: number, s: string, ex = '', fs = o.fs, a = 'middle') => `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(fs)}" text-anchor="${a}" dominant-baseline="central" ${halo} ${ex}>${s}</text>`;
  let s = '';
  const along = (cs: [number, number][], t: number) => { const P = cs.map(proj); let L = 0; const seg = P.slice(1).map((q, i) => { const l = Math.hypot(q[0] - P[i][0], q[1] - P[i][1]); L += l; return l; }); let r = t * L; for (let i = 0; i < seg.length; i++) { if (r <= seg[i]) { const u = r / (seg[i] || 1); return [P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u]; } r -= seg[i]; } return P.at(-1)!; };
  // road names on the legs (no drive times here: they are shown at the points)
  const done = new Set<string>();
  for (const f of F.filter((f) => (f.properties.kind === 'road' || f.properties.kind === 'parkroad' || f.properties.kind === 'namedroad') && LEG_LAB[f.properties.name])) {
    const L = LEG_LAB[f.properties.name], [x, y] = along(f.geometry.coordinates, L.t), p = f.properties, fs = o.fs * 0.82;
    const t = p.kind === 'road' ? `<tspan font-weight="700" fill="#555">${esc(p.ref)}</tspan>` : p.kind === 'namedroad' ? `<tspan font-style="italic">${esc(p.name)}</tspan>`
      : `<tspan font-style="italic">${esc(p.label || 'Park road')} (dirt)</tspan>`;
    if (p.kind === 'road' && done.has(p.ref + L.t)) continue; done.add(p.ref + L.t);
    s += txt(x + L.dx * fs, y + L.dy * fs, t, `class="rg-drive" fill="#6b6b6b"`, fs, L.a);
  }
  // airstrips (OSM aeroway): small subdued runway marker; public fields labelled
  for (const f of F.filter((f) => f.properties.kind === 'airstrip')) { const [x, y] = proj(f.geometry.coordinates), t = AIR_LAB[f.properties.label] || [0.6, 0, 'start'];
    s += `<g class="rg-pt rg-air" data-ax="${f1(x)}" data-ay="${f1(y)}">${f.properties.label ? txt(x + t[0] * o.fs, y + t[1] * o.fs, esc(f.properties.label), 'fill="#7a7a7a" font-style="italic"', o.fs * 0.72, t[2]) : ''}</g>`; }
  // towns, hospital
  for (const f of F.filter((f) => f.properties.kind === 'town')) { const [x, y] = proj(f.geometry.coordinates), t = TOWN_LAB[f.properties.name] || [0.6, 0, 'start'], big = ['Alpine', 'Marfa', 'Presidio'].includes(f.properties.name);
    s += `<g class="rg-pt rg-town" data-ax="${f1(x)}" data-ay="${f1(y)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(o.fs * (big ? 0.3 : 0.22))}" fill="#333" stroke="#fff" stroke-width="${f1(o.fs * 0.08)}"/>${txt(x + t[0] * o.fs, y + t[1] * o.fs, esc(f.properties.name), `fill="#222"${big ? ' font-weight="700"' : ''}`, o.fs * (big ? 1.1 : 0.9), t[2])}${f.properties.name === 'Sauceda' ? drives(F, 'Sauceda', ['FM 170', 'Hospital', 'S/F']).map((r, i) => txt(x + t[0] * o.fs, y + t[1] * o.fs - o.fs * (1.1 + (2 - i) * 0.85), r, 'class="rg-drive" fill="#6b6b6b"', o.fs * 0.75, t[2])).join('') : ''}</g>`; }
  for (const f of F.filter((f) => f.properties.kind === 'hospital')) { const [x, y] = proj(f.geometry.coordinates), h = o.fs * 0.9;
    s += `<g class="rg-pt rg-hosp" data-ax="${f1(x)}" data-ay="${f1(y)}"><rect x="${f1(x - h / 2)}" y="${f1(y - h / 2)}" width="${f1(h)}" height="${f1(h)}" rx="${f1(h * 0.15)}" fill="#c4161c" stroke="#fff" stroke-width="${f1(o.fs * 0.08)}"/><path d="M${f1(x - h * 0.28)},${f1(y)}h${f1(h * 0.56)}M${f1(x)},${f1(y - h * 0.28)}v${f1(h * 0.56)}" stroke="#fff" stroke-width="${f1(h * 0.2)}"/>${txt(x + h * 0.85, y - o.fs * 0.1, 'Big Bend Regional Medical Center', 'fill="#b3261e" font-weight="700"', o.fs * 0.8, 'start')}${txt(x + h * 0.85, y + o.fs * 0.85, 'Hospital', 'fill="#6b6b6b"', o.fs * 0.75, 'start')}${drives(F, 'Hospital', ['Sauceda', 'S/F']).map((r, i) => txt(x + h * 0.85, y + o.fs * (1.7 + i * 0.85), r, 'class="rg-drive" fill="#6b6b6b"', o.fs * 0.75, 'start')).join('')}</g>`; }
  // country / river names
  { const [x, y] = proj(RLAB.mexico); s += txt(x, y, 'MEXICO', 'fill="#9a9a9a" font-weight="700" letter-spacing="3"', o.fs * 1.05); }
  { const [x, y] = proj([-103.42, 29.75]); s += txt(x, y, 'TEXAS', 'fill="#9a9a9a" font-weight="700" letter-spacing="3"', o.fs * 1.05); }
  { const [x, y] = proj([-104.47, 29.66]); s += txt(x, y, 'Rio Grande', 'fill="#6f8ea3" font-style="italic"', o.fs * 0.85); }
  { const [x, y] = proj(RLAB.park); s += `<g class="rg-pt" data-ax="${f1(x)}" data-ay="${f1(y)}">` + txt(x, y, 'BIG BEND RANCH', 'class="rg-park" fill="#7c8a72" font-weight="700" letter-spacing="2"', o.fs * 0.85) + txt(x, y + o.fs * 0.95, 'STATE PARK', 'class="rg-park" fill="#7c8a72" font-weight="700" letter-spacing="2"', o.fs * 0.85) + '</g>'; }
  for (const [n, lo, la] of RLAB.counties) { const [x, y] = proj([lo, la]); s += txt(x, y, n, 'class="rg-county" fill="#a3a3a3" letter-spacing="2"', o.fs * 0.7); }
  // cell towers (OSM-mapped, communication:mobile_phone=yes): small mast symbol, no coverage drawn
  for (const f of F.filter((f) => f.properties.kind === 'celltower')) { const [x, y] = proj(f.geometry.coordinates), h = o.fs * 0.55;
    s += `<g class="rg-pt rg-tower" data-ax="${f1(x)}" data-ay="${f1(y)}"><path d="M${f1(x - h * 0.3)},${f1(y + h * 0.5)}L${f1(x)},${f1(y - h * 0.5)}L${f1(x + h * 0.3)},${f1(y + h * 0.5)}M${f1(x - h * 0.15)},${f1(y)}h${f1(h * 0.3)}" fill="none" stroke="#777" stroke-width="${f1(o.fs * 0.08)}" stroke-linejoin="round"/></g>`; }
  // Start / Finish: drive times to the hospital, Sauceda and the towns (block in open ground with a thin leader to the marker)
  { const SF = (c as any).stations.stations['S/F'].lonlat, [ax, ay] = proj(SF), [x, y] = proj([RLAB.sf[0], RLAB.sf[1]]), a = RLAB.sf[2], rows = drives(F, 'S/F', ['Hospital', 'Sauceda', 'Lajitas', 'Terlingua', 'Study Butte', 'Presidio', 'Marfa', 'Alpine']), lh = o.fs * 0.85, cw = o.fs * 13, half = Math.ceil(rows.length / 2);
    s += `<path class="rg-lead" d="M${f1(ax)},${f1(ay)}L${f1(x + cw * 2)},${f1(y)}" stroke="#9a9a9a" stroke-width="${f1(o.web ? 0.8 : o.fs * 0.05)}" fill="none"${o.web ? ' vector-effect="non-scaling-stroke"' : ''}/><g class="rg-pt rg-sfd" data-ax="${f1(x)}" data-ay="${f1(y)}">${txt(x, y, 'Drive times from Start / Finish', 'fill="#444" font-weight="700"', o.fs * 0.78, a)}${rows.map((r, i) => txt(x + (i >= half ? cw : 0), y + lh * ((i % half) + 1), r, 'class="rg-drive" fill="#6b6b6b"', o.fs * 0.75, a)).join('')}</g>`; }
  return s;
}
/** drive-time table rows from the Start / Finish (OSRM on OSM roads) */
export const driveRows = (c: Ctx) => ((c as any).regional.features as any[]).filter((f) => f.properties.kind === 'drive').map((f) => [f.properties.to, hm(f.properties.min), Math.round(f.properties.mi) + ' mi']);
/** web: regional layer in MAIN map coordinates (lazy-loaded fragment; shown only when zoomed out past the default frame) */
export function regionFrag(c: Ctx, mainProj: P, kmin: number) {
  const o = { fs: 15, sw: 1.2, tol: 0.4 / kmin, web: true };
  const L = regionLayer(c, mainProj, o);
  return `<g class="rg-lines">${L.lines}</g><g class="rg-top">${regionTop(c, mainProj, o)}</g>`;
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
  const lx = W * 0.39, ly = H * 0.335; const it: [string, string][] = [['hw', 'Highway'], ['pr', 'Park road (dirt)'], ['rr', 'Race routes'], ['aid', 'Aid station · Start / Finish'], ['h', 'Hospital'], ['t', 'Town'], ['a', 'Airport / airstrip (runway)'], ['pk', 'Big Bend Ranch State Park'], ['co', 'County line'], ['ct', 'Cell tower (OSM-mapped; not a coverage map)'], ['rv', 'Rio Grande (US–Mexico border)']];
  let lg = `<g class="legend"><rect x="${f1(lx - 10)}" y="${f1(ly - 14)}" width="${f1(W * 0.32)}" height="${f1(it.length * 20 + 14)}" fill="#fff" fill-opacity=".92" stroke="#bbb"/>`;
  it.forEach(([k, t], i) => { const y = ly + 2 + i * 20, x = lx, P = `M${f1(x)},${f1(y)}h34`;
    lg += k === 'hw' ? `<path d="${P}" stroke="#fff" stroke-width="4.1"/><path d="${P}" stroke="#8a8a8a" stroke-width="2.4"/>` : k === 'pr' ? `<path d="${P}" stroke="#8a8a8a" stroke-width="1.6" stroke-dasharray="3.6 2.4"/>` : k === 'rr' ? c.courses.order.map((q, j) => `<path d="M${f1(x + j * 7)},${f1(y)}h6" stroke="${c.courses.colors[q]}" stroke-width="3"/>`).join('')
      : k === 'aid' ? station(x + 17, y, '', false, { s: 300, colors: col, link: false }) : k === 'h' ? `<rect x="${f1(x + 11)}" y="${f1(y - 6)}" width="12" height="12" rx="2" fill="#c4161c"/>` : k === 'a' ? `<path d="M${f1(x + 8)},${f1(y + 4)}L${f1(x + 26)},${f1(y - 4)}" stroke="#7d7d7d" stroke-width="3.4"/>` : k === 'co' ? `<path d="${P}" stroke="#b0b0b0" stroke-width="1.2" stroke-dasharray="7.8 3.2 1.3 3.2"/>` : k === 'ct' ? `<path d="M${f1(x + 14)},${f1(y + 5)}L${f1(x + 17)},${f1(y - 5)}L${f1(x + 20)},${f1(y + 5)}M${f1(x + 15.5)},${f1(y)}h3" fill="none" stroke="#777" stroke-width="1.4"/>` : k === 't' ? `<circle cx="${f1(x + 17)}" cy="${f1(y)}" r="4" fill="#333"/>`
      : k === 'pk' ? `<rect x="${f1(x)}" y="${f1(y - 6)}" width="34" height="12" fill="${col.park}" fill-opacity=".1" stroke="${col.boundary}" stroke-width="1.2" stroke-dasharray="1.2 3"/>` : `<path d="${P}" stroke="#9fb6c6" stroke-width="2"/>`;
    lg += `<text x="${f1(x + 44)}" y="${f1(y)}" font-size="13" dominant-baseline="central" fill="${col.ink}">${t}</text>`; });
  lg += '</g>';

  return `<svg class="regionmap" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Big Bend Ultra regional map"><defs><clipPath id="rclip"><rect width="${W}" height="${H}"/></clipPath></defs><rect width="${W}" height="${H}" fill="#fff"/><g clip-path="url(#rclip)">${L.lines}${net}${rr}${st}${regionTop(c, proj, o)}</g>${fur}${lg}<rect width="${W}" height="${H}" fill="none" stroke="#000" stroke-width="1.6"/></svg>`;
}

/** web: regional box in main-map units + minimum zoom (fills the frame) -> "x0 y0 x1 y1 kmin" on svg.mainmap */
export function regionData(_c: Ctx, V: any, W: number, H: number) {
  const a = V.p(REGION.sw), b = V.p(REGION.ne), x0 = a[0], x1 = b[0], y0 = b[1], y1 = a[1], kmin = Math.min(W / (x1 - x0), H / (y1 - y0)) /* whole regional box fits when fully zoomed out */;
  return [x0, y0, x1, y1].map(f1).join(' ') + ' ' + kmin.toFixed(4);
}
