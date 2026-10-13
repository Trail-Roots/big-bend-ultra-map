import { SHEET, viewProjection, esc, f1, lineD, dash, STYLE, station, textBlock } from './util';
const LAYERS = [
  ['topo', 'Topo shading', true], ['park', 'Park boundary', true], ['zones', 'Access zones', false], ['roads', 'Roads (off-course)', true],
  ['access', 'Access styles (on-course)', true], ['courses', 'Routes per course', false], ['zoom', 'Zoom boxes', true], ['arrows', 'Direction arrows', true],
  ['stations', 'Aid stations', true], ['pois', 'POIs', true], ['labels', 'Labels', true],
];
export const mainLayers = LAYERS;
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
  const zc: Record<string, string> = { '4x4': '#e9d4a5', 'foot + bike': '#d49564', 'foot only': '#b05c51' };
  for (const f of c.zones.features) add('zones', `<path d="${V.path(f)}" fill="${zc[f.properties.zone] || '#ccc'}" fill-opacity=".35" stroke="${zc[f.properties.zone]}" stroke-width="1.5"><title>${esc(f.properties.zone)}</title></path>`);
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
  for (const f of on) if (f.properties.cls !== 'foot') cas += `<path d="${V.path(f)}" class="ln" stroke="#fff" stroke-width="12"/>`;
  for (const cls of ['foot_bike', 'unpaved', '4x4', 'foot']) for (const f of on.filter(f => f.properties.cls === cls)) {
    const s = STYLE.on[cls], d = V.path(f);
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
    add('stations', station(x, y, k, s.spectator, k === 'S/F' ? { s: 2900, fs: 34, colors: col, numberText: false } : { colors: col, numberText: false }));
  }
  // POIs
  for (const f of c.pois.features) if (f.properties.kind === 'rincon') { const [x, y] = V.p(f.geometry.coordinates); add('pois', `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.sqrt(420) / 2)}" fill="#fff" stroke="${col.ink}" stroke-width="4"/>`); }
  // labels
  for (const f of c.labels.features) {
    const p = f.properties;
    if (p.kind === 'curved') { add('labels', curvedLabel(f, V, col)); continue; }
    const [x, y] = V.p(f.geometry.coordinates);
    let lead = '';
    if (p.leader) lead = `<path d="${lineD(p.leader.coords.map(V.p))}" fill="none" stroke="${p.leader.color}" stroke-width="${p.leader.lw}"/>`;
    const layer = p.kind === 'station_number' || p.kind === 'station_label' ? 'stations' : p.kind === 'zoombox_label' ? 'zoom' : p.kind === 'poi_label' ? 'pois' : 'labels';
    if (p.kind === 'station_number') { add('stations', `<text x="${f1(x)}" y="${f1(y)}" class="stnum" font-size="${p.fs}" text-anchor="middle" dominant-baseline="central">${esc(p.text)}</text>`); continue; }
    add(layer === 'stations' ? 'stationLabels' : layer, lead + textBlock(x, y, p));
  }
  // frame furniture: scale bar, north arrow, logo, legend
  const sb = c.layout.scalebar, sx = (sb.x - c.layout.views.main.x[0]) * V.ppm, sy = (c.layout.views.main.y[1] - sb.y) * V.ppm, m5 = sb.m5 * V.ppm, tick = H * 0.006;
  let fur = `<g class="scalebar" stroke="${col.ink}" stroke-width="3"><path d="M${f1(sx)},${f1(sy)}h${f1(m5)}M${f1(sx)},${f1(sy)}v${f1(-tick)}M${f1(sx + m5 / 2)},${f1(sy)}v${f1(-tick)}M${f1(sx + m5)},${f1(sy)}v${f1(-tick)}" fill="none"/></g>`;
  fur += `<text x="${f1(sx)}" y="${f1(sy + H * .008)}" font-size="26" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">0</text><text x="${f1(sx + m5)}" y="${f1(sy + H * .008)}" font-size="26" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">5m</text>`;
  const nx = W * 0.06, ny = H * 0.05;
  fur += `<g class="north"><line x1="${f1(nx)}" y1="${f1(ny + H * .03)}" x2="${f1(nx)}" y2="${f1(ny - H * .02)}" stroke="${col.ink}" stroke-width="3"/><path d="M${f1(nx - 9)},${f1(ny - H * .02 + 4)}L${f1(nx)},${f1(ny - H * .03)}L${f1(nx + 9)},${f1(ny - H * .02 + 4)}z" fill="${col.ink}"/><text x="${f1(nx)}" y="${f1(ny + H * .045)}" class="f-serif" font-size="30" text-anchor="middle" fill="${col.ink}">N</text></g>`;
  fur += `<a href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><image href="logo_ink_crop.png" x="${f1(W * 0.08)}" y="${f1(H * (1 - 0.985))}" width="${f1(W * 0.1)}" height="${f1(H * 0.1)}" preserveAspectRatio="xMidYMid meet"/></a>`;
  fur += legend(c, W, H);
  const order = ['topo', 'park', 'zones', 'roads', 'access', 'courses', 'zoom', 'arrows', 'stations', 'pois', 'stationLabels', 'labels'];
  const vis = Object.fromEntries(LAYERS.map(l => [l[0], l[2]]));
  const grp = order.map(k => `<g class="layer" data-layer="${k === 'stationLabels' ? 'stations' : k}"${(vis[k] === false) ? ' style="display:none"' : ''}>${g[k] || ''}</g>`).join('\n');
  return `<svg class="mainmap" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Big Bend Ultra main course map"><defs><clipPath id="mclip"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#mclip)">${grp}</g>${fur}<rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#000" stroke-width="1.6"/></svg>`;
}
export function chevron(f, V, col) {
  const P = f.geometry.coordinates.map(V.p), d = lineD(P), p = f.properties;
  return `<path d="${d}" fill="none" stroke="${col.ink}" stroke-width="${f1(p.outline_pt)}" stroke-linecap="round" stroke-linejoin="miter"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${f1(p.lw_pt)}" stroke-linecap="round" stroke-linejoin="miter"/>`;
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
  const items = [['zn', 'Foot only'], ['za', 'Foot + bike'], ['z4', '4x4'], ['zt', 'Unpaved'], ['fm', 'Paved'], ['pk', 'Park boundary'], ['aid', 'Aid station'], ['ring', 'Spectator access'],
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
    else if (kk === 'zn') s += `<path d="${L}" stroke="${col.ink}" stroke-width="6" stroke-dasharray="${whole(6, [1.17, .5])}"/>`;
    else if (kk === 'rin') s += `<circle cx="${f1(x + sw / 2)}" cy="${f1(y)}" r="${f1(Math.sqrt(300) / 2)}" fill="#fff" stroke="${col.ink}" stroke-width="3"/>`;
    else if (kk === 'ring') s += station(x + sw / 2, y, '', true, { s: 420, badge: false, colors: col });
    else if (kk === 'aid') s += station(x + sw / 2, y, '', false, { s: 420, colors: col });
    else if (kk.startsWith('st')) { const k = kk.slice(2); s += station(x + sw / 2, y, k, c.stations.stations[k].spectator, { s: 520, fs: 17, badge: false, colors: col }); }
    s += `<text x="${f1(x0 + 0.25 * w)}" y="${f1(y)}" font-size="21" dominant-baseline="central" fill="${col.ink}">${esc(txt)}</text>`;
  });
  return s + '</g>';
}
