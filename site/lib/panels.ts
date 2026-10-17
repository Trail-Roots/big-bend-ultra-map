import { clock, cutMin } from './timeline';
import { finishFlag, leaderLine, SHEET, viewProjection, esc, f1, lineD, dash, station } from './util';
import { hillImage, chevron, DART, ARROW_HALO } from './mainmap';
/** '5:00 AM' -> '5a', '8:30 AM' -> '8:30a' (minutes only when non-zero) */
/** '5:00 AM' -> '5:00a' (full time, as shown on the bibs) */
export const startFull = (t: string) => { const [hm, ap] = t.split(' '), [h, m] = hm.split(':'); return `${Number(h)}:${m}${ap === 'PM' ? 'p' : 'a'}`; };
export const startShort = (t: string) => { const [hm, ap] = t.split(' '), [h, m] = hm.split(':'); return `${Number(h)}${m === '00' ? '' : ':' + m}${ap === 'PM' ? 'p' : 'a'}`; };
// ---- start-time bib (fixed 86 x 72 pt for every course) ----
export type BibStyle = 'band' | 'stopwatch' | 'flag' | 'bandtime';
/** default start indicator: a 'START' header band like a real race bib */
export const BIB_STYLE: BibStyle = 'band';
export const BIB = { w: 86, h: 72, pad: 6, rx: 7 };
// 12 x 12 unit icons (ink)
const ICON: Record<string, string> = {
  stopwatch: '<circle cx="6" cy="7" r="4.6" fill="none" stroke-width="1.6"/><path d="M4.6,0.6h2.8M6,0.6v1.8M6,7V4.3M9.6,2.6l1,-1" fill="none" stroke-width="1.5" stroke-linecap="round"/>',
  flag: '<path d="M1.6,0.6V11.6" fill="none" stroke-width="1.5" stroke-linecap="round"/><path d="M2.3,1h3v2.2h-3zM5.3,1h3v2.2h-3zM8.3,1h2.8v2.2h-2.8zM2.3,3.2h3v2.2h-3zM5.3,3.2h3v2.2h-3zM8.3,3.2h2.8v2.2h-2.8z" fill="none" stroke-width=".7"/><path d="M2.3,1h3v2.2h-3zM8.3,1h2.8v2.2h-2.8zM5.3,3.2h3v2.2h-3z" stroke="none"/>',
};
const tw = (t: string, fs: number) => t.length * fs * 0.64;
export function bib(k: string, start: string, cc: string, W: number, H: number, col: Record<string, string>, style: BibStyle = BIB_STYLE, at?: [number, number]) {
  const B = BIB, t = startFull(start), ink = col.ink;
  const bx = at ? at[0] : W * 0.97 - B.w, by = at ? at[1] : H * 0.03, inner = B.w - 2 * B.pad;
  let g = `<g class="bib bib-${style}"><rect x="${f1(bx)}" y="${f1(by)}" width="${B.w}" height="${B.h}" rx="${B.rx}" fill="${cc}"/>`;
  const txt = (x: number, y: number, fs: number, fill: string, v: string, anchor = 'middle', extra = '') => `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(fs)}" font-weight="700" fill="${fill}" text-anchor="${anchor}" dominant-baseline="central"${extra}>${v}</text>`;
  const fitFs = (v: string, max: number, room: number) => Math.min(max, room / (tw(v, 1) || 1));
  if (style === 'band') {
    // course name on top, white time pill, black START band along the bottom edge
    const bandH = 15, clip = `bb${k}${style}`, bandY = by + B.h - bandH, pillH = 20, py = bandY - 5 - pillH;
    g += `<clipPath id="${clip}"><rect x="${f1(bx)}" y="${f1(by)}" width="${B.w}" height="${B.h}" rx="${B.rx}"/></clipPath><rect x="${f1(bx)}" y="${f1(bandY)}" width="${B.w}" height="${bandH}" fill="${ink}" clip-path="url(#${clip})"/>`;
    g += txt(bx + B.w / 2, bandY + bandH / 2 + 0.5, fitFs('START', 10.5, inner), '#fff', 'START', 'middle', ' letter-spacing="1"');
    g += txt(bx + B.w / 2, by + 2 + (py - by - 2) / 2, fitFs(k, 24, inner), '#fff', k);
    g += `<rect x="${f1(bx + B.pad)}" y="${f1(py)}" width="${f1(inner)}" height="${pillH}" rx="4" fill="#fff"/>` + txt(bx + B.w / 2, py + pillH / 2, fitFs(t, 15, inner - 8), ink, t);
  } else if (style === 'bandtime') {
    const bandH = 15, clip = `bb${k}${style}`;
    g += `<clipPath id="${clip}"><rect x="${f1(bx)}" y="${f1(by)}" width="${B.w}" height="${B.h}" rx="${B.rx}"/></clipPath><rect x="${f1(bx)}" y="${f1(by)}" width="${B.w}" height="${bandH}" fill="${ink}" clip-path="url(#${clip})"/>`;
    const bandTxt = `START ${t}`;
    g += txt(bx + B.w / 2, by + bandH / 2 + 0.5, fitFs(bandTxt, 10.5, inner), '#fff', bandTxt, 'middle', ' letter-spacing="1"');
    g += txt(bx + B.w / 2, by + bandH + (B.h - bandH) / 2, fitFs(k, 28, inner), '#fff', k);
  } else {
    const pillH = 25, py = by + B.h - B.pad - pillH, isz = pillH - 8, sc = isz / 12, gap = 4;
    g += txt(bx + B.w / 2, by + B.pad + (py - by - B.pad) / 2, fitFs(k, 26, inner), '#fff', k);
    const fsT = fitFs(t, 15, inner - 10 - isz - gap), cw = isz + gap + tw(t, fsT), gx = bx + (B.w - cw) / 2;
    g += `<rect x="${f1(bx + B.pad)}" y="${f1(py)}" width="${f1(inner)}" height="${pillH}" rx="4" fill="#fff"/>`
      + `<g transform="translate(${f1(gx)} ${f1(py + 4)}) scale(${sc.toFixed(3)})" fill="${ink}" stroke="${ink}">${ICON[style]}</g>` + txt(gx + isz + gap, py + pillH / 2, fsT, ink, t, 'start');
  }
  return g + `<title>${k} start time ${t}</title></g>`;
}
// ---- mini bib: same family as the full bib (course colour, rounded corners, bold white distance), distance only, no START band ----
export const MINIBIB = { w: 54, h: 26, rx: 4 };
/** mini bib with top-left at (x, y); scale multiplies the whole bib. Used everywhere a distance is shown except the mini maps. */
export function miniBib(k: string, cc: string, x: number, y: number, _col?: Record<string, string>, scale = 1) {
  const B = MINIBIB, w = B.w * scale, h = B.h * scale, fs = Math.min(16, (w - 8 * scale) / (tw(k, 1) || 1)) * (scale > 0 ? 1 : 1);
  return `<g class="bib bib-mini"><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(B.rx * scale)}" fill="${cc}"/><text x="${f1(x + w / 2)}" y="${f1(y + h / 2 + 0.5)}" font-size="${f1(Math.min(16 * scale, fs))}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${k}</text></g>`;
}
/** standalone inline SVG of the mini bib (HTML contexts: layer toggles, hover readout) */
export const miniBibSvg = (k: string, cc: string, scale = 1) => `<svg class="minibib" width="${f1(MINIBIB.w * scale)}" height="${f1(MINIBIB.h * scale)}" viewBox="0 0 ${f1(MINIBIB.w * scale)} ${f1(MINIBIB.h * scale)}" aria-label="${k}">${miniBib(k, cc, 0, 0, undefined, scale)}</svg>`;
const short = t => t.toLowerCase().replace(' am', 'a').replace(' pm', 'p');
export function renderMini(c, k) {
  const view = c.layout.views[k], W = view.fig[2] * SHEET.w, H = view.fig[3] * SHEET.h, V = viewProjection(view, W, H), col = c.colors, O = c.courses.order;
  const lw = 0.4; let s = `<g class="topo">${hillImage(c, k, V)}</g>`;
  for (const f of c.network.features.filter(f => f.properties.cls === 'paved')) { const d = V.path(f); s += `<path d="${d}" class="ln" stroke="#fff" stroke-width="${14 * lw}"/><path d="${d}" class="ln" stroke="#333" stroke-width="${10 * lw}"/><path d="${d}" class="ln" stroke="#fff" stroke-width="${f1(2.2 * lw)}" stroke-dasharray="${dash([6, 5], 2.2 * lw)}" stroke-linecap="butt"/>`; }
  for (const f of c.network.features.filter(f => f.properties.cls === 'connector')) { const d = V.path(f); s += `<path d="${d}" class="ln" stroke="${col.cream}" stroke-width="${12 * lw}" stroke-linecap="butt"/><path d="${d}" class="ln" stroke="#000" stroke-width="${7 * lw}"/>`; }
  for (const q of O) s += `<path d="${V.path(c.courseGeo[q].features[0])}" class="ln" stroke="${col.minis_network}" stroke-width="5"/>`;
  const i = O.indexOf(k), nx = O[i + 1], pv = O[i - 1];
  if (nx) s += `<path d="${V.path(c.courseGeo[nx].features[0])}" class="ln" stroke="${col.minis_next}" stroke-width="3"/>`;
  if (pv) s += `<path d="${V.path(c.courseGeo[pv].features[0])}" class="ln" stroke="${c.courses.colors[pv]}" stroke-opacity=".5" stroke-width="3.5"/>`;
  const d = V.path(c.courseGeo[k].features[0]);
  s += `<path d="${d}" class="ln" stroke="#fff" stroke-width="10.5"/><path d="${d}" class="ln" stroke="${c.courses.colors[k]}" stroke-width="7.5"/>`;
  // (no zoom boxes on mini maps)
  for (const f of c.arrows.features.filter(f => f.properties.map === k)) s += chevron(f, V, col);
  if (k === '10K') s += turnaround(c, V);
  for (const st of c.cutoffs[k]) { const [x, y] = V.p(c.stations.stations[st.station].lonlat); s += station(x, y, st.station, c.stations.stations[st.station].spectator, { s: 1280, fs: 23, badge: false, colors: col }); }
  s = `<g class="zv">${s}</g>`; // zoom/pan content (bib stays fixed)
  s += bib(k, c.courses.courses[k].start, c.courses.colors[k], W, H, col);
  return `<svg class="mini" data-mini="${k}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} course map"><defs><clipPath id="mc${k}"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#mc${k})">${s}</g><rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#b8ae9c" stroke-width="1.6"/></svg>`;
}
export function turnaround(c, V, label = true) {
  const f = c.pois.features.find(f => f.properties.kind === 'turnaround'), [p, q] = f.geometry.coordinates.map(V.p), col = c.courses.colors['10K'];
  let v = [p[0] - q[0], p[1] - q[1]]; const n0 = Math.hypot(...v); v = [v[0] / n0, v[1] / n0]; const n = [v[1], -v[0]]; // arrive on the RIGHT of the path, loop, return on the right (US keep-right)
  const h = 15 * 1.4, r = h * 0.75, L = h * 0.9, P = (a, b, s1, s2) => [a[0] + b[0] * s1 + n[0] * s2, a[1] + b[1] * s1 + n[1] * s2];
  const U = [P(p, v, -L, -r)]; for (let i = 0; i <= 40; i++) { const t = -Math.PI / 2 + Math.PI * i / 40; U.push(P(p, v, r * Math.cos(t), r * Math.sin(t))); } U.push(P(p, v, -L * 0.55, r));
  // black U-turn: same dart head + halo as the course arrows, with a matching black tail
  const u = 13.7 * 1.5, tw = u * 0.32, halo = ARROW_HALO * 2 * u, tip = P(p, v, -L * 0.55 - u * 0.6, r), d = [-v[0], -v[1]];
  const head = DART.map(([x, y]) => [tip[0] + ((x - 0.6) * d[0] - y * d[1]) * u, tip[1] + ((x - 0.6) * d[1] + y * d[0]) * u]);
  const hd = `M${head.map((q) => `${f1(q[0])},${f1(q[1])}`).join('L')}Z`;
  const lx = p[0] - 1, ly = p[1] + 95;
  return `<g class="turn"><path d="${lineD(U)}" fill="none" stroke="#fff" stroke-width="${f1(tw + halo)}" stroke-linejoin="round" stroke-linecap="round"/><path d="${hd}" fill="#fff" stroke="#fff" stroke-width="${f1(halo)}" stroke-linejoin="round"/><path d="${lineD(U)}" fill="none" stroke="#111111" stroke-width="${f1(tw)}" stroke-linejoin="round"/><path d="${hd}" fill="#111111"/>${label ? `<path d="M${f1(p[0])},${f1(p[1] + 8)}L${f1(lx)},${f1(ly - 22)}" stroke="${col}" stroke-width="1.2"/><text x="${f1(lx)}" y="${f1(ly)}" font-size="18" font-style="italic" font-weight="700" fill="${col}" text-anchor="middle" stroke="#fff" stroke-width="5" paint-order="stroke"><tspan x="${f1(lx)}" dy="-0.6em">10K</tspan><tspan x="${f1(lx)}" dy="1.2em">turnaround</tspan></text>` : ''}</g>`;
}
export function renderStrips(c) {
  const st = c.layout.strips, W = st.w * SHEET.w, RH = st.rh * SHEET.h, col = c.colors, [a, b] = st.xlim;
  const X = v => (v - a) / (b - a) * W, Y = v => (1 - (v + 1) / 2) * RH;
  let s = '';
  c.courses.order.forEach((k, r) => {
    const S = c.cutoffs[k], P = []; S.forEach(q => P.push(P.length ? Math.max(q.mile, P[P.length - 1] + 8.2) : q.mile));
    let g = miniBib(k, c.courses.colors[k], 0, Y(0.22) - MINIBIB.h * 0.75, col, 1.5) + `<text class="dist" x="0" y="${f1(Y(-0.42))}" font-size="22" fill="${col.ink}" dominant-baseline="central">${S[S.length - 1].mile}m</text>`;
    g += `<path d="M${f1(X(0))},${f1(Y(0))}H${f1(X(P[P.length - 1]))}" stroke="${c.courses.colors[k]}" stroke-width="7" stroke-linecap="round"/>`;
    S.forEach((q, i) => {
      g += station(X(P[i]), Y(0), q.station, c.stations.stations[q.station].spectator, { s: 950, fs: 24, badge: false, colors: col });
      g += `<text class="dist" x="${f1(X(P[i]))}" y="${f1(Y(0.32))}" font-size="24" text-anchor="middle" fill="${col.mute}">${q.mile}m</text>`;
      if (q.cutoff !== 'TBD') g += `<text x="${f1(X(P[i]))}" y="${f1(Y(-0.32))}" font-size="30" font-weight="700" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">${short(q.cutoff)}</text>`;
    });
    s += `<g class="strip" data-course="${k}" transform="translate(0 ${f1(r * RH)})">${g}</g>`;
  });
  return `<svg class="strips" viewBox="0 0 ${f1(W)} ${f1(5 * RH)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Station closing times per course">${s}</svg>`;
}
/** page-1 elevation chart for the visible races (race filter). All five = the established layout (layout.json limits, curated callouts);
 *  a subset is rescaled to its longest visible route and re-placed (same placement rule as scripts/content.ts). Returns the inner body + scale. */
/** station icon size on the page-1 elevation chart: renders at the main-map legend icon size (950 x (9.8/17.1)^2, measured on screen) */
const PST = 312;
export function profileBody(c, vis?: string[]) {
  const L = c.layout, W = L.elev[2] * SHEET.w, H = L.elev[3] * SHEET.h, col = c.colors, O: string[] = c.courses.order, pr = c.profiles;
  const V = vis ?? O, all = V.length === O.length, longest = O.find((k) => V.includes(k)) ?? O[0];
  const D = c.courses.courses[longest].distance_mi, ftAll = (V.length ? V : O).flatMap((k) => pr[k].ft as number[]), fmin = Math.min(...ftAll), fmax = Math.max(...ftAll);
  const [x0, x1] = all ? L.elev_xlim : [-D * 5.5 / 62, D * 63 / 62];
  const [y0, y1] = all ? L.elev_ylim : [Math.floor((fmin - 170) / 100) * 100, Math.ceil((fmax + Math.max(500, (fmax - fmin) * 0.55)) / 100) * 100];
  const X = v => (v - x0) / (x1 - x0) * W, Y = v => (1 - (v - y0) / (y1 - y0)) * H;
  let s = `<rect width="${f1(W)}" height="${f1(H)}" fill="${col.cream}"/>`;
  const span = y1 - y0, ys = span > 2400 ? 1000 : span > 1200 ? 500 : span > 500 ? 200 : 100, yt: number[] = [];
  { const off = ys === 1000 ? 500 : 0; for (let v = Math.ceil((y0 + 0.05 * span - off) / ys) * ys + off; v < y1 - 0.15 * span; v += ys) yt.push(v); }
  for (const tk of all ? [2500, 3500, 4500] : yt) s += `<path d="M0,${f1(Y(tk))}H${f1(W)}" stroke="#d9d9d9" stroke-width="1"/><text class="yax" x="0" y="${f1(Y(tk) - 6)}" font-size="19" fill="${col.mute}">${tk.toLocaleString('en-US')} ft</text>`;
  s += `<path d="M0,${f1(H)}H${f1(W)}" stroke="${col.ink}" stroke-width="1"/>`;
  const step = D > 30 ? 10 : D > 12 ? 5 : D > 6 ? 2 : 1, minor = D > 12 ? 1 : 0;
  if (minor) for (let v = 1; v < x1; v++) if (v % step) s += `<path d="M${f1(X(v))},${f1(H)}v6" stroke="#c8c8c8" stroke-width="1"/>`;
  for (let v = 0; v <= D + 0.01; v += step) s += `<path d="M${f1(X(v))},${f1(H)}v10" stroke="${col.mute}" stroke-width="1"/><text class="dist" x="${f1(X(v))}" y="${f1(H + 10)}" font-size="19" text-anchor="middle" dominant-baseline="hanging" fill="${col.mute}">${v}m</text>`;
  const pts = k => pr[k].mi.map((m, i) => [X(m), Y(pr[k].ft[i])]);
  if (V.includes(longest)) { const pl = pts(longest), base = Math.max(y0, Math.min(2200, y0)); s += `<path data-course="${longest}" d="${lineD(pl)}L${f1(pl[pl.length - 1][0])},${f1(Y(base))}L${f1(pl[0][0])},${f1(Y(base))}z" fill="${col.shade}" fill-opacity="${col.shade_op}"/>`; }
  for (const k of O) if (V.includes(k)) s += `<path class="ln prof" data-course="${k}" d="${lineD(pts(k))}" stroke="${c.courses.colors[k]}" stroke-width="${k === '100K' ? 4 : 3}"/>`;
  const lgx = W - 46 - MINIBIB.w, lgy = 16; s += `<rect x="${lgx - 10}" y="${lgy - 6}" width="${W - lgx + 10}" height="${O.length * 32 + 10}" fill="#fff" fill-opacity=".9"/>`;
  // legend keeps every race; hidden races at low opacity, clickable (app.ts toggles the race)
  O.forEach((k, i) => { s += `<g class="plegend" data-legend="${k}" opacity="${V.includes(k) ? 1 : 0.18}" style="cursor:pointer"><rect x="${lgx - 6}" y="${lgy + i * 32}" width="${W - lgx + 6}" height="30" fill="#fff" fill-opacity="0"/><path d="M${lgx},${lgy + 14 + i * 32}h36" stroke="${c.courses.colors[k]}" stroke-width="4"/>` + miniBib(k, c.courses.colors[k], lgx + 46, lgy + 14 + i * 32 - 13, col) + '</g>'; });
  let callouts = pr.callouts.callouts;
  if (!all) { // re-place station badges for the visible races only (thresholds scaled to this chart's ranges)
    const sx = (x1 - x0) / 68.5, sy = (y1 - y0) / 3200, grp: [number[], number, string][] = [];
    for (const [x, y, lab] of (pr.callouts.evp as [number, number, string, string][]).filter((e) => V.includes(e[3])).sort((p, q) => p[0] - q[0])) { const G = grp[grp.length - 1]; if (G && G[2] === lab && Math.abs(G[0][G[0].length - 1] - x) < 0.4 * sx) G[0].push(x); else grp.push([[x], y, lab]); }
    const placed: number[][] = []; callouts = [];
    for (const [xs, y, lab] of grp) { const x = xs.reduce((p, v) => p + v, 0) / xs.length; let bx = x, by = y;
      outer: for (const dy of [380, -380, 680, -680, 980]) for (const dx of [0, 0.9, -0.9, 1.6, -1.6]) { bx = x + dx * sx; by = y + dy * sy; if (by > y0 + 150 * sy && by < y1 - 250 * sy && placed.every(([px, py]) => Math.abs(bx - px) > 1.8 * sx || Math.abs(by - py) > 260 * sy)) break outer; }
      placed.push([bx, by]); callouts.push({ xs, y, bx, by, lab }); } }
  for (const q of callouts) {
    for (const x of q.xs) s += leaderLine(X(q.bx), Y(q.by), X(x), Y(q.y), Math.sqrt(PST) / 2, 3) + `<circle cx="${f1(X(x))}" cy="${f1(Y(q.y))}" r="3" fill="${col.ink}"/>`;
    s += `<g class="pcall" data-st="${q.lab}" data-mi="${(q.xs.reduce((a, b) => a + b, 0) / q.xs.length).toFixed(2)}">` + station(X(q.bx), Y(q.by), q.lab, c.stations.stations[q.lab].spectator, { s: PST, fs: 14, badge: false, colors: col }) + '</g>';
  }
  if (V.includes('100K')) for (const r of pr.callouts.rincon) s += `<circle cx="${f1(X(r.mi))}" cy="${f1(Y(r.ft))}" r="6.3" fill="#fff" stroke="${col.ink}" stroke-width="3"/>`;
  return { s, x: [x0, x1], y: [y0, y1], W, H };
}
export function renderProfile(c) {
  const p = profileBody(c);
  return `<svg class="profile" viewBox="0 0 ${f1(p.W)} ${f1(p.H + 40)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elevation profiles"><g class="pbody">${p.s}</g></svg>`;
}
