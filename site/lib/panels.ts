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
  if (nx) {
    const zb = c.zoom.features.find(f => f.properties.course === nx);
    s += `<g class="zoombox"><path d="${V.path(zb)}" fill="none" stroke="${zb.properties.color}" stroke-width="1.8" stroke-dasharray="${dash([4, 2], 1.8)}"/>`;
    const ring = zb.geometry.coordinates[0], [bx, by] = V.p(ring[2]);
    s += `<text x="${f1(bx)}" y="${f1(by - 2)}" font-size="14" font-weight="700" text-anchor="end" fill="${zb.properties.color}" stroke="${col.cream}" stroke-width="4" paint-order="stroke">${nx}</text></g>`;
  }
  for (const f of c.arrows.features.filter(f => f.properties.map === k)) s += chevron(f, V, col);
  if (k === '10K') s += turnaround(c, V);
  for (const st of c.cutoffs[k]) { const [x, y] = V.p(c.stations.stations[st.station].lonlat); s += station(x, y, st.station, c.stations.stations[st.station].spectator, { s: 1280, fs: 23, badge: false, colors: col }); }
  s = `<g class="zv">${s}</g>`; // zoom/pan content (bib stays fixed)
  s += bib(k, c.courses.courses[k].start, c.courses.colors[k], W, H, col);
  return `<svg class="mini" data-mini="${k}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} course map"><defs><clipPath id="mc${k}"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#mc${k})">${s}</g><rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#b8ae9c" stroke-width="1.6"/></svg>`;
}
function turnaround(c, V) {
  const f = c.pois.features.find(f => f.properties.kind === 'turnaround'), [p, q] = f.geometry.coordinates.map(V.p), col = c.courses.colors['10K'];
  let v = [p[0] - q[0], p[1] - q[1]]; const n0 = Math.hypot(...v); v = [v[0] / n0, v[1] / n0]; const n = [-v[1], v[0]];
  const h = 15 * 1.4, r = h * 0.75, L = h * 0.9, P = (a, b, s1, s2) => [a[0] + b[0] * s1 + n[0] * s2, a[1] + b[1] * s1 + n[1] * s2];
  const U = [P(p, v, -L, -r)]; for (let i = 0; i <= 40; i++) { const t = -Math.PI / 2 + Math.PI * i / 40; U.push(P(p, v, r * Math.cos(t), r * Math.sin(t))); } U.push(P(p, v, -L * 0.55, r));
  // black U-turn: same dart head + halo as the course arrows, with a matching black tail
  const u = 13.7 * 1.5, tw = u * 0.32, halo = ARROW_HALO * 2 * u, tip = P(p, v, -L * 0.55 - u * 0.6, r), d = [-v[0], -v[1]];
  const head = DART.map(([x, y]) => [tip[0] + ((x - 0.6) * d[0] - y * d[1]) * u, tip[1] + ((x - 0.6) * d[1] + y * d[0]) * u]);
  const hd = `M${head.map((q) => `${f1(q[0])},${f1(q[1])}`).join('L')}Z`;
  const lx = p[0] - 1, ly = p[1] + 95;
  return `<g class="turn"><path d="${lineD(U)}" fill="none" stroke="#fff" stroke-width="${f1(tw + halo)}" stroke-linejoin="round" stroke-linecap="round"/><path d="${hd}" fill="#fff" stroke="#fff" stroke-width="${f1(halo)}" stroke-linejoin="round"/><path d="${lineD(U)}" fill="none" stroke="#111111" stroke-width="${f1(tw)}" stroke-linejoin="round"/><path d="${hd}" fill="#111111"/><path d="M${f1(p[0])},${f1(p[1] + 8)}L${f1(lx)},${f1(ly - 22)}" stroke="${col}" stroke-width="1.2"/><text x="${f1(lx)}" y="${f1(ly)}" font-size="18" font-style="italic" font-weight="700" fill="${col}" text-anchor="middle" stroke="#fff" stroke-width="5" paint-order="stroke"><tspan x="${f1(lx)}" dy="-0.6em">10K</tspan><tspan x="${f1(lx)}" dy="1.2em">turnaround</tspan></text></g>`;
}
export function renderStrips(c) {
  const st = c.layout.strips, W = st.w * SHEET.w, RH = st.rh * SHEET.h, col = c.colors, [a, b] = st.xlim;
  const X = v => (v - a) / (b - a) * W, Y = v => (1 - (v + 1) / 2) * RH;
  let s = '';
  c.courses.order.forEach((k, r) => {
    const S = c.cutoffs[k], P = []; S.forEach(q => P.push(P.length ? Math.max(q.mile, P[P.length - 1] + 8.2) : q.mile));
    let g = `<text x="0" y="${f1(Y(0.22))}" font-size="36" font-weight="700" fill="${c.courses.colors[k]}" dominant-baseline="central">${k}</text><text class="dist" x="0" y="${f1(Y(-0.42))}" font-size="22" fill="${col.ink}" dominant-baseline="central">${S[S.length - 1].mile}m</text>`;
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
export function renderProfile(c) {
  const L = c.layout, W = L.elev[2] * SHEET.w, H = L.elev[3] * SHEET.h, [x0, x1] = L.elev_xlim, [y0, y1] = L.elev_ylim, col = c.colors;
  const X = v => (v - x0) / (x1 - x0) * W, Y = v => (1 - (v - y0) / (y1 - y0)) * H;
  let s = `<rect width="${f1(W)}" height="${f1(H)}" fill="${col.cream}"/>`;
  for (const t of [2500, 3500, 4500]) s += `<path d="M0,${f1(Y(t))}H${f1(W)}" stroke="#d8d0c0" stroke-width="1"/><text x="12" y="${f1(Y(t) - 6)}" font-size="24" fill="${col.ink}">${t.toLocaleString('en-US')} ft</text>`;
  s += `<path d="M0,${f1(H)}H${f1(W)}" stroke="${col.ink}" stroke-width="1"/>`;
  for (let v = 1; v < x1; v++) if (v % 10) s += `<path d="M${f1(X(v))},${f1(H)}v6" stroke="#c9c2b6" stroke-width="1"/>`; // minor 1 mi ticks
  for (let v = 0; v <= 60; v += 10) s += `<path d="M${f1(X(v))},${f1(H)}v10" stroke="${col.ink}" stroke-width="1"/><text class="dist" x="${f1(X(v))}" y="${f1(H + 10)}" font-size="24" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">${v}m</text>`;
  const O = c.courses.order, pr = c.profiles;
  const pts = k => pr[k].mi.map((m, i) => [X(m), Y(pr[k].ft[i])]);
  const p100 = pts('100K'); s += `<path d="${lineD(p100)}L${f1(p100[p100.length - 1][0])},${f1(Y(2200))}L${f1(p100[0][0])},${f1(Y(2200))}z" fill="#888" fill-opacity=".10"/>`;
  for (const k of O) s += `<path class="ln prof" data-course="${k}" d="${lineD(pts(k))}" stroke="${c.courses.colors[k]}" stroke-width="${k === '100K' ? 4 : 3}"/>`;
  // legend upper right
  const lgx = W - 140, lgy = 16; s += `<rect x="${lgx - 10}" y="${lgy - 6}" width="140" height="${O.length * 32 + 10}" fill="#fff" fill-opacity=".9"/>`;
  O.forEach((k, i) => { s += `<path d="M${lgx},${lgy + 14 + i * 32}h36" stroke="${c.courses.colors[k]}" stroke-width="4"/><text x="${lgx + 46}" y="${lgy + 14 + i * 32}" font-size="22" dominant-baseline="central" fill="${col.ink}">${k}</text>`; });
  for (const q of pr.callouts.callouts) {
    for (const x of q.xs) s += leaderLine(X(q.bx), Y(q.by), X(x), Y(q.y), Math.sqrt(950) / 2, 3) + `<circle cx="${f1(X(x))}" cy="${f1(Y(q.y))}" r="3" fill="${col.ink}"/>`;
    s += station(X(q.bx), Y(q.by), q.lab, c.stations.stations[q.lab].spectator, { s: 950, fs: 24, badge: false, colors: col });
  }
  // cutoff times (time of day, per course colour) beside each station badge + finish cutoff at each course end; greedy collision-free placement
  const BR = Math.sqrt(950) / 2 + 4, boxes: number[][] = pr.callouts.callouts.map((q) => [X(q.bx) - BR, Y(q.by) - BR, X(q.bx) + BR, Y(q.by) + BR]);
  boxes.push([lgx - 10, lgy - 6, lgx + 130, lgy + O.length * 32 + 4]);
  for (const k of O) { const P = pts(k); for (let i = 0; i < P.length; i += 4) boxes.push([P[i][0] - 2, P[i][1] - 3, P[i][0] + 2, P[i][1] + 3]); } // keep text off the profile lines
  const hit = (b: number[]) => b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const FS = 19, LH = 21, cw = FS * 0.56, labs: string[] = [];
  const place = (ax: number, ay: number, rows: { t: string; fill: string; flag?: boolean }[], ar: number) => {
    const w = Math.max(...rows.map((r) => r.t.length * cw + (r.flag ? 19 : 0))), h = rows.length * LH;
    const cand: number[][] = [];
    for (const d of [0, 14, 28, 44, 62, 84, 110, 140, 180]) for (const [cx, cy] of [[ar + 4 + d, -h / 2], [-ar - 4 - w - d, -h / 2], [-w / 2, -ar - 4 - h - d], [-w / 2, ar + 4 + d], [ar + 2 + d, -ar - h - d], [-ar - 2 - w - d, -ar - h - d]]) cand.push([ax + cx, ay + cy]);
    const c = cand.find(([x, y]) => !hit([x - 2, y - 2, x + w + 2, y + h + 2])); if (!c) return;
    const [x, y] = c; boxes.push([x - 2, y - 2, x + w + 2, y + h + 2]);
    const far = Math.hypot(x + w / 2 - ax, y + h / 2 - ay) > ar + Math.max(w, h) / 2 + 20;
    let g = far ? leaderLine(x + w / 2 < ax ? x + w : x, Math.max(y, Math.min(y + h, ay)), ax, ay, 0, ar) : '';
    rows.forEach((r, i) => { if (r.flag) g += finishFlag(x + 1, y + (i + 1) * LH - 1, y + i * LH + 3, col.ink); g += `<text x="${f1(x + (r.flag ? 19 : 0))}" y="${f1(y + (i + 0.8) * LH)}" font-size="${FS}" font-weight="700" fill="${r.fill}" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(r.t)}</text>`; });
    labs.push(`<g class="cutlab">${g}</g>`);
  };
  const cut = (k: string, st: { cutoff: string }) => { const m = cutMin(st.cutoff); return m == null ? null : clock(m < cutMin(c.cutoffs[k][0].cutoff)! ? m + 1440 : m, false); };
  for (const q of pr.callouts.callouts) {
    const rows = O.flatMap((k) => c.cutoffs[k].filter((st) => st.station === q.lab && q.xs.some((x) => Math.abs(x - st.mile) < 0.05)).map((st) => cut(k, st)).filter(Boolean).map((t) => ({ t: t!, fill: c.courses.colors[k] })));
    if (rows.length) place(X(q.bx), Y(q.by), rows, BR - 4);
  }
  for (const k of O) { const L2 = c.cutoffs[k][c.cutoffs[k].length - 1], t = cut(k, L2), P = pts(k), e = P[P.length - 1]; if (t) place(e[0], e[1], [{ t, fill: c.courses.colors[k], flag: true }], 4); }
  s += labs.join('');
  for (const r of pr.callouts.rincon) s += `<circle cx="${f1(X(r.mi))}" cy="${f1(Y(r.ft))}" r="6.3" fill="#fff" stroke="${col.ink}" stroke-width="3"/>`;
  return `<svg class="profile" viewBox="0 0 ${f1(W)} ${f1(H + 40)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elevation profiles">${s}</svg>`;
}
