import { SHEET, viewProjection, esc, f1, lineD, dash, station } from './util';
import { hillImage, chevron } from './mainmap';
/** '5:00 AM' -> '5a', '8:30 AM' -> '8:30a' (minutes only when non-zero) */
export const startShort = (t: string) => { const [hm, ap] = t.split(' '), [h, m] = hm.split(':'); return `${Number(h)}${m === '00' ? '' : ':' + m}${ap === 'PM' ? 'p' : 'a'}`; };
// monochrome revolver-style starter pistol, barrel pointing up (fired into the air); 12 x 16 units
const GUN = 'M3.2,0h2.4v1h.6v6.2h2.6v1h-.6v2.8l4,4.6-2.6,1.4-3.4-4.6h-1.2v1.4c0,.9-1.8,.9-1.8,0V11H2V7.2h1.2z';
const GUN_W = 12, GUN_H = 16;
/** bib template: fixed size for every course; course on top, white pill with pistol + start time, text scaled to fit with padding */
export const BIB = { w: 86, h: 72, pad: 7, rx: 7, top: 26, time: 15, pillH: 25 };
export function bib(k: string, start: string, cc: string, W: number, H: number, col: Record<string, string>) {
  const B = BIB, tw = (t: string, fs: number) => t.length * fs * 0.64, t = startShort(start);
  const bx = W * 0.97 - B.w, by = H * 0.03, inner = B.w - 2 * B.pad;
  const fsTop = Math.min(B.top, inner / (tw(k, 1) || 1));
  const px = bx + B.pad - 2, pw = B.w - 2 * (B.pad - 2), py = by + B.h - B.pad + 2 - B.pillH;
  const gh = B.pillH - 8, gs = gh / GUN_H, gw = GUN_W * gs, gap = 4;
  const fsT = Math.min(B.time, (pw - 10 - gw - gap) / (tw(t, 1) || 1));
  const cw = gw + gap + tw(t, fsT), gx = px + (pw - cw) / 2, gy = py + 4;
  return `<g class="bib"><rect x="${f1(bx)}" y="${f1(by)}" width="${B.w}" height="${B.h}" rx="${B.rx}" fill="${cc}"/>`
    + `<text x="${f1(bx + B.w / 2)}" y="${f1(by + B.pad + (py - by - B.pad) / 2)}" font-size="${f1(fsTop)}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${k}</text>`
    + `<rect x="${f1(px)}" y="${f1(py)}" width="${f1(pw)}" height="${B.pillH}" rx="4" fill="#fff"/>`
    + `<path d="${GUN}" transform="translate(${f1(gx)} ${f1(gy)}) scale(${gs.toFixed(3)})" fill="${col.ink}"><title>start time</title></path>`
    + `<text x="${f1(gx + gw + gap)}" y="${f1(py + B.pillH / 2)}" font-size="${f1(fsT)}" font-weight="700" fill="${col.ink}" dominant-baseline="central"><title>start time</title>${t}</text></g>`;
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
  s += bib(k, c.courses.courses[k].start, c.courses.colors[k], W, H, col);
  return `<svg class="mini" data-mini="${k}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} course map"><defs><clipPath id="mc${k}"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#mc${k})">${s}</g><rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#b8ae9c" stroke-width="1.6"/></svg>`;
}
function turnaround(c, V) {
  const f = c.pois.features.find(f => f.properties.kind === 'turnaround'), [p, q] = f.geometry.coordinates.map(V.p), col = c.courses.colors['10K'];
  let v = [p[0] - q[0], p[1] - q[1]]; const n0 = Math.hypot(...v); v = [v[0] / n0, v[1] / n0]; const n = [-v[1], v[0]];
  const h = 15 * 1.4, r = h * 0.75, L = h * 0.9, P = (a, b, s1, s2) => [a[0] + b[0] * s1 + n[0] * s2, a[1] + b[1] * s1 + n[1] * s2];
  const U = [P(p, v, -L, -r)]; for (let i = 0; i <= 40; i++) { const t = -Math.PI / 2 + Math.PI * i / 40; U.push(P(p, v, r * Math.cos(t), r * Math.sin(t))); } U.push(P(p, v, -L * 0.55, r));
  const hw = r * 0.75, b0 = P(p, v, -L * 0.55, r), hd = [[b0[0] + n[0] * hw, b0[1] + n[1] * hw], P(p, v, -(L * 0.55 + hw * 1.3), r), [b0[0] - n[0] * hw, b0[1] - n[1] * hw]];
  const lx = p[0] - 1, ly = p[1] + 95;
  return `<g class="turn"><path d="${lineD(U)}" fill="none" stroke="#fff" stroke-width="${f1(15 * .4 + 5)}" stroke-linejoin="round"/><path d="${lineD(U)}" fill="none" stroke="${col}" stroke-width="6" stroke-linejoin="round"/><path d="${lineD(hd)}z" fill="${col}" stroke="#fff" stroke-width="2"/><path d="M${f1(p[0])},${f1(p[1] + 8)}L${f1(lx)},${f1(ly - 22)}" stroke="${col}" stroke-width="1.2"/><text x="${f1(lx)}" y="${f1(ly)}" font-size="18" font-style="italic" font-weight="700" fill="${col}" text-anchor="middle" stroke="#fff" stroke-width="5" paint-order="stroke"><tspan x="${f1(lx)}" dy="-0.6em">10K</tspan><tspan x="${f1(lx)}" dy="1.2em">turnaround</tspan></text></g>`;
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
  for (let v = 0; v <= 60; v += 10) s += `<text class="dist" x="${f1(X(v))}" y="${f1(H + 10)}" font-size="24" text-anchor="middle" dominant-baseline="hanging" fill="${col.ink}">${v}m</text>`;
  const O = c.courses.order, pr = c.profiles;
  const pts = k => pr[k].mi.map((m, i) => [X(m), Y(pr[k].ft[i])]);
  const p100 = pts('100K'); s += `<path d="${lineD(p100)}L${f1(p100[p100.length - 1][0])},${f1(Y(2200))}L${f1(p100[0][0])},${f1(Y(2200))}z" fill="#888" fill-opacity=".10"/>`;
  for (const k of O) s += `<path class="ln prof" data-course="${k}" d="${lineD(pts(k))}" stroke="${c.courses.colors[k]}" stroke-width="${k === '100K' ? 4 : 3}"/>`;
  // legend upper right
  const lgx = W - 140, lgy = 16; s += `<rect x="${lgx - 10}" y="${lgy - 6}" width="140" height="${O.length * 32 + 10}" fill="#fff" fill-opacity=".9"/>`;
  O.forEach((k, i) => { s += `<path d="M${lgx},${lgy + 14 + i * 32}h36" stroke="${c.courses.colors[k]}" stroke-width="4"/><text x="${lgx + 46}" y="${lgy + 14 + i * 32}" font-size="22" dominant-baseline="central" fill="${col.ink}">${k}</text>`; });
  for (const q of pr.callouts.callouts) {
    for (const x of q.xs) s += `<path d="M${f1(X(x))},${f1(Y(q.y))}L${f1(X(q.bx))},${f1(Y(q.by))}" stroke="#555" stroke-width="1.2"/><circle cx="${f1(X(x))}" cy="${f1(Y(q.y))}" r="3" fill="${col.ink}"/>`;
    s += station(X(q.bx), Y(q.by), q.lab, c.stations.stations[q.lab].spectator, { s: 950, fs: 24, badge: false, colors: col });
  }
  for (const r of pr.callouts.rincon) s += `<circle cx="${f1(X(r.mi))}" cy="${f1(Y(r.ft))}" r="6.3" fill="#fff" stroke="${col.ink}" stroke-width="3"/>`;
  return `<svg class="profile" viewBox="0 0 ${f1(W)} ${f1(H + 40)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elevation profiles">${s}</svg>`;
}
