import { stationLabel, poiLabel, areaLabel } from './labels';
import { chaikin, mergeChains, simplifyPts, leaderLine, poiDot, SHEET, viewProjection, esc, f1, lineD, dash, STYLE, station, textBlock, gmapLink } from './util';
// user-toggleable layers (off-course roads, access styles, arrows, aid stations, distances and all labels are always shown)
const LAYERS: [string, string, boolean][] = [
  ['topo', 'Topo shading', true], ['park', 'Park boundary', true],
  ['courses', 'Routes per course', false], ['zoom', 'Zoom boxes', true], ['pois', 'POIs', true], ['dots', 'Runner dots (model)', true],
];
export const mainLayers = LAYERS;
/** logo width in sheet pt — identical to the header logo above the mini maps (1.45 in) */
export const LOGO_PT = 1.45 * 72;
export function hillImage(c, key, V) {
  const h = c.layout.hillshade[key], [bx0, by0, bx1, by1] = h.bounds_3857, k = V.ppm, x0 = c.layout.views[key].x[0], y1 = c.layout.views[key].y[1];
  return `<image href="${h.file}" x="${f1((bx0 - x0) * k)}" y="${f1((y1 - by1) * k)}" width="${f1((bx1 - bx0) * k)}" height="${f1((by1 - by0) * k)}" preserveAspectRatio="none"/>`;
}
export function renderMain(c) {
  const fig = c.layout.views.main.fig, W = fig[2] * SHEET.w, H = fig[3] * SHEET.h, V = viewProjection(c.layout.views.main, W, H), col = c.colors;
  const g = {}; const add = (k, s) => (g[k] = (g[k] || '') + s);
  add('topo', hillImage(c, 'main', V));
  // park
  for (const f of c.park.features) {
    const p = f.properties;
    if (p.kind === 'park') add('park', `<path d="${V.path(f)}" fill="${col.park}" fill-opacity=".06" fill-rule="evenodd"/>`);
  }
  for (const f of c.park.features) if (f.properties.kind === 'boundary')
    add('park', `<path d="${V.path(f)}" fill="none" stroke="${col.boundary}" stroke-opacity=".9" stroke-width="2.6" stroke-dasharray="${dash([0.6, 2.6], 2.6)}" stroke-linecap="round"/>`);
  for (const f of c.areaLabels.features) add('park', areaLabel(f, V.p));
  // roads
  const net = c.network.features;
  for (const f of net.filter(f => f.properties.cls === 'paved')) { const d = V.path(f); add('roads', `<path d="${d}" class="ln" stroke="#fff" stroke-width="14"/><path d="${d}" class="ln" stroke="#333" stroke-width="10"/><path d="${d}" class="ln" stroke="#fff" stroke-width="2.2" stroke-dasharray="${dash([6, 5], 2.2)}" stroke-linecap="butt"/>`); }
  for (const f of net.filter(f => f.properties.cls === 'connector')) { const d = V.path(f); add('roads', `<path d="${d}" class="ln" stroke="${col.cream}" stroke-width="12" stroke-linecap="butt"/><path d="${d}" class="ln" stroke="#000" stroke-width="7"/>`); }
  for (const f of net.filter(f => !f.properties.on_course && STYLE.off[f.properties.cls])) {
    const s = STYLE.off[f.properties.cls], d = V.path(f);
    add('roads', `<path d="${d}" class="ln" data-name="${esc(f.properties.name || '')}" stroke="${s.color}" stroke-width="${s.lw}" stroke-dasharray="${dash(s.pat, s.lw)}" stroke-linecap="butt"/>` + (s.rail ? `<path d="${d}" class="ln" stroke="#fff" stroke-width="${s.rail}" stroke-linecap="butt"/>` : ''));
  }
  // on-course access runs: casing first, then patterns (draw order as in make.py)
  const on = net.filter(f => f.properties.on_course);
  let cas = '', pat = '';
  // Dash patterns restart per path and get garbled on GPS jitter: per access class, merge contiguous pieces into
  // single continuous chains (shared sections drawn once), simplify (DP 1.5 pt) and Chaikin-smooth in page space.
  const smoothD = (cls: string) => mergeChains(on.filter(f => f.properties.cls === cls).flatMap(f => V.lines(f)))
    .map(l => 'M' + chaikin(simplifyPts(l, 1.5), 2).map(q => `${f1(q[0])},${f1(q[1])}`).join('L')).join('');
  const D: Record<string, string> = Object.fromEntries(['foot_bike', 'unpaved', '4x4', 'foot'].map(k => [k, smoothD(k)]));
  for (const cls of ['foot_bike', 'unpaved', '4x4']) if (D[cls]) cas += `<path d="${D[cls]}" class="ln" stroke="#fff" stroke-width="12"/>`;
  for (const cls of ['foot_bike', 'unpaved', '4x4', 'foot']) if (D[cls]) {
    const s = STYLE.on[cls], d = D[cls];
    pat += `<path d="${d}" class="ln" stroke="${col.ink}" stroke-width="${s.lw}" stroke-dasharray="${dash(s.pat, s.lw)}" stroke-linecap="butt"/>` + (s.rail ? `<path d="${d}" class="ln" stroke="#fff" stroke-width="${s.rail}" stroke-linecap="butt"/>` : '');
  }
  add('access', cas + pat);
  // optional colored course overlays (off by default; PDF shows access styles)
  for (const k of c.courses.order) add('courses', `<g class="course" data-course="${k}"><path d="${V.path(c.courseGeo[k].features[0])}" class="ln" stroke="${c.courses.colors[k]}" stroke-width="5" stroke-opacity=".85"/></g>`);
  // zoom boxes
  for (const f of c.zoom.features) add('zoom', `<path d="${V.path(f)}" fill="none" stroke="${f.properties.color}" stroke-width="2.4" stroke-dasharray="${dash([5, 3], 2.4)}"/>`);
  // arrows
  for (const f of c.arrows.features.filter(f => f.properties.map === 'main')) add('arrows', chevron(f, V, col));
  // stations
  for (const k of c.stations.order) {
    const s = c.stations.stations[k], [x, y] = V.p(s.lonlat);
    add('stations', gmapLink(s.lonlat, k === 'S/F' ? s.name : `Aid station ${k} · ${s.name}`, station(x, y, k, s.spectator, k === 'S/F' ? { s: 2900, fs: 34, colors: col } : { colors: col })));
  }
  // POIs
  for (const f of c.pois.features) if (f.geometry.type === 'Point') { const [x, y] = V.p(f.geometry.coordinates); add('pois', gmapLink(f.geometry.coordinates, f.properties.name ?? 'Point of interest', poiDot(x, y))); }
  // labels
  for (const f of c.labels.features) {
    const p = f.properties;
    if (p.kind === 'curved') { add('labels', curvedLabel(f, V, col)); continue; }
    const [x, y] = V.p(f.geometry.coordinates);
    let lead = '';
    if (p.leader) { const P = p.leader.coords.map(V.p); lead = leaderLine(P[0][0], P[0][1], P[P.length - 1][0], P[P.length - 1][1]); }
    const layer = p.kind === 'station_number' || p.kind === 'station_label' ? 'stations' : p.kind === 'zoombox_label' ? 'zoom' : 'labels';
    if (p.kind === 'station_label' || p.kind === 'poi_label') continue; // replaced by the label templates below
    if (p.kind === 'station_number') continue; // numbers are part of the station marker template
    add(layer === 'stations' ? 'stationLabels' : layer, lead + textBlock(x, y, p));
  }
  // standard station + POI label templates
  const rad = (k: string) => (k === 'S/F' ? Math.sqrt(2900 * 1.8) / 2 : c.stations.stations[k].spectator ? Math.sqrt(2000 * 1.8) / 2 : Math.sqrt(2000) / 2);
  for (const f of c.stationLabels.features) add('stationLabels', stationLabel(c, f, V.p, rad));
  for (const f of c.poiLabels.features) add('pois', poiLabel(f, V.p, 10.2));
  // frame furniture: scale bar, north arrow, logo, legend
  const sb = c.layout.scalebar, sx = (sb.x - c.layout.views.main.x[0]) * V.ppm, sy = (c.layout.views.main.y[1] - sb.y) * V.ppm, m5 = sb.m5 * V.ppm, tick = H * 0.006;
  let fur = `<g class="scalebar" stroke="${col.ink}" stroke-width="3"><path d="M${f1(sx)},${f1(sy)}h${f1(m5)}M${f1(sx)},${f1(sy)}v${f1(-tick)}M${f1(sx + m5 / 2)},${f1(sy)}v${f1(-tick)}M${f1(sx + m5)},${f1(sy)}v${f1(-tick)}" fill="none"/></g>`;
  fur += `<text x="${f1(sx)}" y="${f1(sy + H * .008)}" font-size="26" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">0</text><text x="${f1(sx + m5)}" y="${f1(sy + H * .008)}" font-size="26" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">5m</text>`;
  // north arrow: small and subtle
  const nx = W * 0.05, ny = H * 0.04, na = H * 0.012, nc = col.mute;
  fur += `<g class="north" opacity=".8"><line x1="${f1(nx)}" y1="${f1(ny + na)}" x2="${f1(nx)}" y2="${f1(ny - na)}" stroke="${nc}" stroke-width="1.6"/><path d="M${f1(nx - 5)},${f1(ny - na + 6)}L${f1(nx)},${f1(ny - na - 3)}L${f1(nx + 5)},${f1(ny - na + 6)}z" fill="${nc}"/><text x="${f1(nx)}" y="${f1(ny + na + 14)}" class="f-serif" font-size="17" text-anchor="middle" fill="${nc}">N</text></g>`;
  fur += `<a href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><image class="maplogo" href="logo_ink_crop.png" x="${f1(W * 0.08)}" y="${f1(H * (1 - 0.985))}" width="${f1(LOGO_PT)}" height="${f1(LOGO_PT * 776 / 730)}" preserveAspectRatio="xMidYMid meet"/></a>`;
  fur += legend(c, W, H);
  const order = ['topo', 'park', 'roads', 'access', 'courses', 'zoom', 'arrows', 'stations', 'pois', 'stationLabels', 'labels', 'dots'];
  const vis = Object.fromEntries(LAYERS.map(l => [l[0], l[2]]));
  const grp = order.map(k => `<g class="layer" data-layer="${k}"${(vis[k] === false) ? ' style="display:none"' : ''}>${g[k] || ''}</g>`).join('\n');
  return `<svg class="mainmap" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Big Bend Ultra main course map"><defs><clipPath id="mclip"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#mclip)"><g class="zv">${grp}</g></g>${fur}<rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#000" stroke-width="1.6"/></svg>`;
}
/** notched arrowhead (dart), centred on the route point and pointing along the route.
 *  Normalised shape pointing +x: tip (0.6,0), top-back (-0.5,-0.5), notch (-0.28,0), bottom-back (-0.5,0.5) — length:height 1.1:1. */
export const DART: [number, number][] = [[0.6, 0], [-0.5, -0.5], [-0.28, 0], [-0.5, 0.5]];
/** white halo thickness as a fraction of arrow height */
export const ARROW_HALO = 0.3;
export function chevron(f, V, col) {
  const [b, c] = f.geometry.coordinates.map(V.p), p = f.properties, dx = c[0] - b[0], dy = c[1] - b[1], n0 = Math.hypot(dx, dy) || 1;
  const ux = dx / n0, uy = dy / n0, u = p.size_pt * 1.5, cx0 = (0.6 - 0.5) / 2; // centre the shape's length on the route point
  const pts = DART.map(([x, y]) => [c[0] + ((x - cx0) * ux - y * uy) * u, c[1] + ((x - cx0) * uy + y * ux) * u]);
  const sw = ARROW_HALO * 2 * u; // halo extends ARROW_HALO × arrow height outside the shape; paint-order keeps it behind the fill
  return `<path class="arrow" d="M${pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join('L')}Z" fill="#111111" stroke="#ffffff" stroke-width="${f1(sw)}" stroke-linejoin="round" paint-order="stroke"/>`;
}
let cid = 0;
function curvedLabel(f, V, col) {
  const P = f.geometry.coordinates.map(V.p), p = f.properties, id = `cl${cid++}`;
  // extend both ends so textPath never truncates; text is centred on the original char span
  const ext = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1], n = Math.hypot(dx, dy) || 1; return [a[0] + dx / n * 60, a[1] + dy / n * 60]; };
  const Q = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])];
  return `<path id="${id}" d="${lineD(Q)}" fill="none" stroke="none"/><text class="f-serif curved" font-size="${p.fs}" font-style="italic" fill="${p.color}" stroke="${col.cream}" stroke-width="5" paint-order="stroke" stroke-linejoin="round" dominant-baseline="central"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(p.text)}</textPath></text>`;
}
function legend(c, W, H) {
  const [lx, ly, lw, lh] = c.layout.legend_axes, x0 = lx * W, y0 = (1 - ly - lh) * H, w = lw * W, h = lh * H, col = c.colors;
  const items = [['fm', 'Paved'], ['zt', 'Unpaved'], ['z4', '4x4'], ['za', 'Foot + bike'], ['zn', 'Foot only'], ['pk', 'Park boundary'], ['aid', 'Aid station'], ['ring', 'Spectator access'],
    ...c.stations.order.map(k => ['st' + k, c.stations.stations[k].name]), ['rin', 'Point of interest']];
  let s = `<g class="legend"><rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(w)}" height="${f1(h)}" fill="#fff" fill-opacity=".85"/>`;
  const sw = 0.16 * w;
  // whole-cycle swatch: stretch pattern so the swatch shows only whole dashes (same rule as make.py _swl)
  const whole = (lw_, pat) => { const P = pat.reduce((a, b) => a + b) * lw_, g = pat[pat.length - 1] * lw_, n = Math.max(1, Math.round((sw + g) / P)), fct = (sw + g) / (n * P); return pat.map(v => f1(v * lw_ * fct)).join(' '); };
  items.forEach(([kk, txt], i) => {
    const y = y0 + (1 - (0.965 - i * 0.0662)) * h, x = x0 + 0.04 * w, L = `M${f1(x)},${f1(y)}h${f1(sw)}`;
    if (kk === 'pk') s += `<path d="${L}" stroke="${col.boundary}" stroke-width="2.6" stroke-dasharray="${dash([0.6, 2.6], 2.6)}" stroke-linecap="round"/>`;
    else if (kk === 'fm') s += `<path d="${L}" stroke="#333" stroke-width="10"/><path d="${L}" stroke="#fff" stroke-width="2.2" stroke-dasharray="${dash([6, 5], 2.2)}"/>`;
    else if (kk === 'za') s += `<path d="${L}" stroke="${col.ink}" stroke-width="6" stroke-dasharray="${whole(6, [4, .6, 1.6, .6])}"/>`;
    else if (kk === 'zt') s += `<path d="${L}" stroke="${col.ink}" stroke-width="6" stroke-dasharray="${whole(6, [11.7, .83])}"/>`;
    else if (kk === 'z4') s += `<path d="${L}" stroke="${col.ink}" stroke-width="6" stroke-dasharray="${whole(6, [7.3, .7])}"/><path d="${L}" stroke="#fff" stroke-width="1.9"/>`;
    else if (kk === 'zn') s += `<path d="${L}" stroke="${col.ink}" stroke-width="6" stroke-dasharray="${whole(6, [0.58, 0.25])}"/>`;
    else if (kk === 'rin') s += poiDot(x + sw / 2, y, 0.85);
    else if (kk === 'ring') s += station(x + sw / 2, y, '', true, { s: 420, badge: false, colors: col });
    else if (kk === 'aid') s += station(x + sw / 2, y, '', false, { s: 420, colors: col });
    else if (kk.startsWith('st')) { const k = kk.slice(2); s += gmapLink(c.stations.stations[k].lonlat, c.stations.stations[k].name, station(x + sw / 2, y, k, c.stations.stations[k].spectator, { s: 520, fs: 17, badge: false, colors: col })); }
    s += `<text x="${f1(x0 + 0.25 * w)}" y="${f1(y)}" font-size="21" dominant-baseline="central" fill="${col.ink}">${esc(txt)}</text>`;
  });
  return s + '</g>';
}
