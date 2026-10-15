// Logistics site plans (finish area, parking) at Barton Warnock: muted USGS aerial + OSM roads at true widths + Erik's
// Google My Maps logistics placemarks (content/logistics.json). Shared marker / label / leader conventions with the main map.
import fs from 'node:fs';
import path from 'node:path';
import { esc, f1, station, textBlock, leaderLine, gmapLink } from './util';

const R = 6378137, MX = (lon: number) => (lon * Math.PI / 180) * R, MY = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
const AER = path.join(import.meta.dir, '..', '..', 'sources', 'curated', 'aerial');
export const INK = '#2a2a2a', BLUE = '#2a62a8', AMBER = '#d08a10', RED = '#c4161c';
type Opts = { plan: 'finish' | 'parking'; W: number; labels: Record<string, [number, number]>; scaleFt: number[] };
type Mark = { name: string; lonlat: [number, number]; icon: string; label: string };

// ---- icons: 15 px radius round badges (dark ink, white pictogram); red for medic / restricted / no parking ----
const badge = (fill: string, glyph: string, r = 15) => `<circle r="${r + 2.5}" fill="#fff"/><circle r="${r}" fill="${fill}"/>${glyph}`;
export const ICONS: Record<string, string> = {
  main: badge(INK, `<path d="M-9,6L0,-8L9,6Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M0,-1V6" stroke="#fff" stroke-width="2.4"/>`),
  radio: badge(INK, `<path d="M0,-3V9M-4,9H4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cy="-4" r="2.4" fill="#fff"/><path d="M-6,-9a8,8 0 0 0 0,10M6,-9a8,8 0 0 1 0,10" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`),
  medic: badge(RED, `<path d="M-3,-9h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#fff"/>`),
  restroom: badge(INK, `<text y="1" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">WC</text>`),
  picnic: badge(INK, `<path d="M-9,-4H9M-6,-4L-9,8M6,-4L9,8M-8,3H8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
  water: badge(INK, `<path d="M0,-10C4,-4 7,-1 7,3A7,7 0 0 1 -7,3C-7,-1 -4,-4 0,-10Z" fill="#fff"/>`),
  restricted: badge(RED, `<rect x="-9" y="-2.6" width="18" height="5.2" rx="1" fill="#fff"/>`),
  parking: `<rect x="-17" y="-17" width="34" height="34" rx="6" fill="#fff"/><rect x="-14.5" y="-14.5" width="29" height="29" rx="4.5" fill="${BLUE}"/><text y="1" font-size="21" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">P</text>`,
  noparking: `<rect x="-17" y="-17" width="34" height="34" rx="6" fill="#fff"/><rect x="-14.5" y="-14.5" width="29" height="29" rx="4.5" fill="${BLUE}"/><text y="1" font-size="21" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">P</text><circle r="12.5" fill="none" stroke="${RED}" stroke-width="3.6"/><path d="M-8.8,-8.8L8.8,8.8" stroke="${RED}" stroke-width="3.6"/>`,
  building: badge('#6f675b', `<path d="M-8,8V-3L0,-9L8,-3V8Z" fill="#fff"/><rect x="-2.5" y="2" width="5" height="6" fill="#6f675b"/>`),
};
const ICON_R: Record<string, number> = { parking: 17, noparking: 17 };
const ICON_FOR: Record<string, [string, string]> = { // KML name -> [icon, label]
  'Main': ['main', 'Main tent'], 'Radio Command': ['radio', 'Radio Command'], 'Medic': ['medic', 'Medic'], 'Portable Restrooms': ['restroom', 'Portable restrooms'],
  'Picnic Area': ['picnic', 'Picnic area'], 'Water hose': ['water', 'Water hose'], 'Restricted Access': ['restricted', 'Restricted access'],
  'Parking': ['parking', 'Parking'], 'No Parking': ['noparking', 'No parking'], 'Barton Warnock': ['building', 'Barton Warnock\nVisitor Center'],
};
// Barton Warnock Visitor Center footprint, traced from the USGS orthoimage (not in OpenStreetMap): outer square with courtyard
const BW_OUT: [number, number][] = [[-103.757697, 29.270026], [-103.757117, 29.270026], [-103.757117, 29.26952], [-103.757697, 29.26952]];
const BW_IN: [number, number][] = [[-103.757535, 29.269872], [-103.75728, 29.269872], [-103.75728, 29.269655], [-103.757535, 29.269655]];

export function renderPlan(c, o: Opts) {
  const meta = JSON.parse(fs.readFileSync(path.join(AER, `${o.plan}.json`), 'utf8')), [b0, b1, b2, b3] = meta.bbox_3857 as number[];
  const W = o.W, H = Math.round(W * (b3 - b1) / (b2 - b0)), X = (lon: number) => ((MX(lon) - b0) / (b2 - b0)) * W, Y = (lat: number) => ((b3 - MY(lat)) / (b3 - b1)) * H;
  const P = (q: [number, number]) => [X(q[0]), Y(q[1])] as [number, number];
  const lat0 = 29.2705, pxPerM = W / ((b2 - b0) * Math.cos(lat0 * Math.PI / 180)); // ground meters -> px
  const d = (cs: [number, number][], close = false) => 'M' + cs.map((q) => P(q).map(f1).join(',')).join('L') + (close ? 'Z' : '');
  const L = c.logistics;
  let s = `<defs><filter id="aer-${o.plan}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.6"/><feColorMatrix type="saturate" values="0.3"/><feComponentTransfer><feFuncR type="linear" slope=".42" intercept=".57"/><feFuncG type="linear" slope=".42" intercept=".56"/><feFuncB type="linear" slope=".42" intercept=".52"/></feComponentTransfer></filter>
<clipPath id="clip-${o.plan}"><rect width="${W}" height="${H}"/></clipPath>
<pattern id="hatch-${o.plan}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0,0V9" stroke="${AMBER}" stroke-width="2.2" stroke-opacity=".55"/></pattern></defs>`;
  s += `<g clip-path="url(#clip-${o.plan})"><rect width="${W}" height="${H}" fill="#f4f1ea"/><image href="plans/${o.plan}_muted.jpg" width="${W}" height="${H}" preserveAspectRatio="none"/>`;
  // roads at true widths: casing, fill; FM 170 with yellow centre line
  const osm = L.osm.features, hw = (f) => f.properties.highway;
  const roadW: Record<string, number> = { secondary: 10, residential: 6.5, service: 5.5, track: 3.5 };
  for (const pass of ['case', 'fill', 'center'] as const) for (const f of osm) {
    const h = hw(f); if (!h || f.geometry.type !== 'LineString' || !(h in roadW)) continue;
    const w = Math.max(roadW[h] * pxPerM, h === 'secondary' ? 7 : 3.2), unp = f.properties.surface === 'unpaved' || h === 'track', dd = d(f.geometry.coordinates);
    if (pass === 'case') s += `<path d="${dd}" fill="none" stroke="${unp ? '#b9ab8f' : '#8f887c'}" stroke-width="${f1(w + 2.6)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pass === 'fill') s += `<path d="${dd}" fill="none" stroke="${unp ? '#ece2cc' : '#ffffff'}" stroke-width="${f1(w)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pass === 'center' && h === 'secondary') s += `<path d="${dd}" fill="none" stroke="#e0b422" stroke-width="${f1(Math.max(1.2, 0.25 * pxPerM))}" stroke-dasharray="${f1(3 * pxPerM)} ${f1(9 * pxPerM)}"/>`;
  }
  for (const f of osm) if (hw(f) === 'path' && f.geometry.type === 'LineString') s += `<path d="${d(f.geometry.coordinates)}" fill="none" stroke="#8d806a" stroke-width="1.8" stroke-dasharray="1 4" stroke-linecap="round"/>`;
  // building footprints (OSM) + Barton Warnock (traced)
  for (const f of osm) if (f.properties.building && f.geometry.type === 'Polygon') s += `<path d="${d(f.geometry.coordinates[0], true)}" fill="#ddd5c6" stroke="#8a8173" stroke-width="1.4"/>`;
  s += `<path d="${d(BW_OUT, true)}${d(BW_IN, true)}" fill="#d6cdbb" fill-rule="evenodd" stroke="#6f675b" stroke-width="2"/>`;
  // areas
  const areas = L.placemarks.filter((p) => p.kind === 'polygon');
  for (const a of areas) {
    if (a.name === 'Parking' && o.plan === 'parking') s += `<path d="${d(a.coords, true)}" fill="${BLUE}" fill-opacity=".2" stroke="${BLUE}" stroke-width="2.4" stroke-linejoin="round"/>`;
    if (a.name === '5 Min Dropoff Area') s += `<path d="${d(a.coords, true)}" fill="#f6e2b0" fill-opacity=".75"/><path d="${d(a.coords, true)}" fill="url(#hatch-${o.plan})" stroke="${AMBER}" stroke-width="2.4" stroke-linejoin="round"/>`;
  }
  // course approaching the finish (finish plan): last part of the 100K GPX line inside the frame, with an arrow
  if (o.plan === 'finish') {
    const cs = c.courseGeo['100K'].features[0].geometry.coordinates as [number, number][], tail: [number, number][] = [];
    for (let i = cs.length - 1; i >= 0; i--) { const [x, y] = P(cs[i]); tail.unshift(cs[i]); if (x < -40 || y < -40 || x > W + 40 || y > H + 40) break; }
    const col = c.courses.colors['100K'], cw = Math.max(6, 2.2 * pxPerM);
    s += `<path d="${d(tail)}" fill="none" stroke="#fff" stroke-width="${f1(cw + 5)}" stroke-linejoin="round" stroke-linecap="round"/><path d="${d(tail)}" fill="none" stroke="${col}" stroke-width="${f1(cw)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const n = tail.length, ia = Math.min(n - 2, Math.floor(n * 0.6)), [ax, ay] = P(tail[ia]), [bx, by] = P(tail[ia + 1]), ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    s += `<g transform="translate(${f1(ax)} ${f1(ay)}) rotate(${f1(ang)})"><path d="M-9,-11L9,0L-9,11L-4,0Z" fill="${col}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke"/></g>`;
  }
  // road name along FM 170 + entrance labels where a driveway meets FM 170
  const fm = osm.filter((f) => hw(f) === 'secondary' && f.geometry.type === 'LineString').map((f) => f.geometry.coordinates.map(P) as [number, number][]);
  { const segs = fm.flatMap((l) => l.slice(1).map((q, i) => [l[i], q] as const)).filter(([a, b]) => [a, b].every(([x, y]) => x > 60 && x < W - 60 && y > 60 && y < H - 60));
    const sg = segs.sort((p, q) => Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) - Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]))[0];
    if (sg) { const [[x0, y0], [x1, y1]] = sg; let a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI; if (a > 90) a -= 180; if (a < -90) a += 180;
      const t = o.plan === 'finish' ? 0.2 : 0.5, lx = x0 + (x1 - x0) * t, ly = y0 + (y1 - y0) * t;
      s += textBlock(lx, ly, { text: 'FM 170', fs: 17, color: '#5d5850', style: 'normal', weight: 'bold', family: 'sans', halo: { color: '#fff', width: 4 }, ha: 'center', rotation: -a }); } }
  { const segD = (p: [number, number], a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    const ents: [number, number, number, number][] = [], tol = 14 * pxPerM, markPx = L.placemarks.filter((p) => p.kind === 'point').map((p) => P(p.coords[0]));
    for (const f of osm) { const h = hw(f); if (!h || h === 'secondary' || h === 'path' || f.geometry.type !== 'LineString') continue; const cs = f.geometry.coordinates;
      for (const q of [cs[0], cs[cs.length - 1]]) { const p = P(q); if (p[0] < 30 || p[1] < 30 || p[0] > W - 30 || p[1] > H - 30) continue;
        let hit: [number, number][] | null = null; for (const l of fm) l.slice(1).forEach((b, i) => { if (!hit && segD(p, l[i], b) < tol) hit = [l[i], b]; });
        if (!hit || ents.some((e) => Math.hypot(e[0] - p[0], e[1] - p[1]) < 60 * pxPerM) || markPx.some((m) => Math.hypot(m[0] - p[0], m[1] - p[1]) < 50)) continue;
        // label on the far side of the driveway from the highway
        const [a, b] = hit as [number, number][], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy); let nx = -dy / n, ny = dx / n;
        const other = P(q === cs[0] ? cs[Math.min(cs.length - 1, 1)] : cs[cs.length - 2]); if ((other[0] - p[0]) * nx + (other[1] - p[1]) * ny < 0) { nx = -nx; ny = -ny; }
        ents.push([p[0], p[1], nx, ny]); } }
    for (const [x0, y0, nx, ny] of ents) s += textBlock(x0 + nx * 30, y0 + ny * 30, { text: 'Entrance', fs: 14, color: '#5d5850', style: 'italic', weight: 'bold', family: 'sans', halo: { color: '#fff', width: 3.5 }, ha: 'center' }); }
  s += `</g>`;
  // markers + labels
  const pts = L.placemarks.filter((p) => p.kind === 'point'), marks: Mark[] = [];
  const want = o.plan === 'finish' ? ['Start / Finish Line', 'Main', 'Radio Command', 'Medic', 'Portable Restrooms', 'Picnic Area', 'Water hose', 'Restricted Access', 'Barton Warnock'] : ['Parking', 'No Parking', 'Start / Finish Line', 'Barton Warnock'];
  for (const p of pts) if (want.includes(p.name)) marks.push({ name: p.name, lonlat: p.coords[0], icon: p.name === 'Start / Finish Line' ? 'sf' : ICON_FOR[p.name][0], label: p.name === 'Start / Finish Line' ? 'Start / Finish' : ICON_FOR[p.name][1] });
  // area labels (as marks without icons): drop-off zone; parking lots numbered by size
  for (const a of areas.filter((a) => a.name === '5 Min Dropoff Area')) { const cx = a.coords.reduce((t, q) => t + q[0], 0) / a.coords.length, cy = a.coords.reduce((t, q) => t + q[1], 0) / a.coords.length; marks.push({ name: 'dropoff', lonlat: [cx, cy], icon: '', label: '5-minute\ndrop-off' }); }
  const sfPlace = c.stations.stations['S/F'].place;
  const seen: Record<string, number> = {}, LBL: string[] = [], MK: string[] = [];
  for (const m of marks) {
    const key = m.name + (seen[m.name] = (seen[m.name] ?? 0) + 1), [x, y] = P(m.lonlat), off = o.labels[key] ?? [26, -22];
    const r = m.icon === 'sf' ? 28 : m.icon ? (ICON_R[m.icon] ?? 17.5) * 1.2 : 0;
    const where = m.name === 'Start / Finish Line' || m.name === 'Barton Warnock' ? sfPlace ?? m.lonlat : m.lonlat;
    let g = m.icon === 'sf' ? station(x, y, 'S/F', true, { s: 1700, fs: 26, badge: false, colors: c.colors }) : m.icon ? `<g transform="translate(${f1(x)} ${f1(y)}) scale(1.2)">${ICONS[m.icon]}</g>` : '';
    if (g) MK.push(gmapLink(where, m.label.replace('\n', ' '), g));
    const tx = x + off[0], ty = y + off[1], lines = m.label.split('\n'), area = !m.icon;
    const tw = Math.max(...lines.map((l) => l.length)) * (area ? 10.6 : 10.4) + 8, th = lines.length * 22 + 4;
    if (m.icon && Math.hypot(off[0], off[1]) > r + 30) { // leader to the label box edge
      const ex = Math.max(tx - tw / 2, Math.min(x, tx + tw / 2)), ey = Math.max(ty - th / 2, Math.min(y, ty + th / 2));
      LBL.push(leaderLine(x, y, ex, ey, r, 0));
    }
    LBL.push(textBlock(tx, ty, { text: m.label, fs: area ? 19 : 18.5, color: area ? '#8a5a00' : INK, style: area ? 'italic' : 'normal', weight: 'bold', family: 'sans', halo: { color: '#fff', width: 4.5 }, ha: 'center', linespacing: 1.15 }));
  }
  s += LBL.join('') + MK.join('');
  // north arrow (top right), scale bar in feet (bottom right)
  const nx = W - 40, ny = 46;
  s += `<g opacity=".9"><circle cx="${nx}" cy="${ny}" r="22" fill="#fff" fill-opacity=".85"/><path d="M${nx},${ny - 16}L${nx + 7},${ny + 9}L${nx},${ny + 4}L${nx - 7},${ny + 9}Z" fill="${INK}"/><text x="${nx}" y="${ny + 34}" class="f-serif" font-size="16" text-anchor="middle" fill="${INK}" stroke="#fff" stroke-width="4" paint-order="stroke">N</text></g>`;
  const ft = o.scaleFt, fpx = (v: number) => v * 0.3048 * pxPerM, sw = fpx(ft[ft.length - 1]), sx = W - 30 - sw, sy = H - 30;
  s += `<rect x="${f1(sx - 12)}" y="${f1(sy - 30)}" width="${f1(sw + 42)}" height="44" rx="4" fill="#fff" fill-opacity=".88"/>`;
  ft.slice(0, -1).forEach((v, i) => { s += `<rect x="${f1(sx + fpx(v))}" y="${sy - 6}" width="${f1(fpx(ft[i + 1]) - fpx(v))}" height="6" fill="${i % 2 ? '#fff' : INK}" stroke="${INK}" stroke-width="1.2"/>`; });
  ft.forEach((v, i) => { s += `<text x="${f1(sx + fpx(v))}" y="${sy - 11}" font-size="13" text-anchor="middle" fill="${INK}">${v}${i === ft.length - 1 ? ' ft' : ''}</text>`; });
  s += `<rect width="${W}" height="${H}" fill="none" stroke="#000" stroke-width="1.6"/>`;
  return `<svg class="siteplan" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${o.plan === 'finish' ? 'Finish area plan' : 'Parking plan'}">${s}</svg>`;
}
/** HTML legend under each plan (same items as drawn) */
export function planLegend(items: [string, string][]) {
  return `<ul class="planlegend">${items.map(([sw, t]) => `<li>${sw}<span>${esc(t)}</span></li>`).join('')}</ul>`;
}
export const sw = {
  icon: (k: string) => `<svg viewBox="-19 -19 38 38" width="26" height="26" aria-hidden="true">${ICONS[k]}</svg>`,
  area: (fill: string, stroke: string, hatch = false) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="17" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="2.2"/>${hatch ? `<path d="M6,18L18,2M14,18L26,2M-2,18L10,2" stroke="${stroke}" stroke-width="1.6" stroke-opacity=".6"/>` : ''}</svg>`,
  line: (col: string, w = 6, cas = '#fff') => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><path d="M2,10H28" stroke="${cas}" stroke-width="${w + 4}"/><path d="M2,10H28" stroke="${col}" stroke-width="${w}"/></svg>`,
  sf: () => `<svg viewBox="-19 -19 38 38" width="26" height="26" aria-hidden="true"><circle r="16" fill="#fff" stroke="#111" stroke-width="3.2"/><circle r="11" fill="${INK}"/><text font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">S/F</text></svg>`,
};
