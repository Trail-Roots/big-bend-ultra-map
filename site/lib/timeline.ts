// Time-of-day timeline (race day, Jan 17 2027): one row per distance with modelled runners-on-course density,
// start, cutoffs and finish; one row per aid station with its open window and modelled runners passing per 15 min.
// Data: content/timeline.json (scripts/timeline.ts). Night / civil twilight / daylight shading from the same file.
import { SHEET, f1, esc, gmapLink, finishFlag, station } from './util';
import type { Ctx } from './types';

export const clock = (m: number, short = true) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60, ap = h < 12 ? 'a' : 'p', h12 = h % 12 || 12;
  return short && mi === 0 ? `${h12}${ap}` : `${h12}:${String(mi).padStart(2, '0')}${ap}`;
};
export const cutMin = (t: string) => { const m = t.match(/^(\d+):(\d\d) (AM|PM)$/); if (!m) return null; return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]); };

export function renderTimeline(c: Ctx) {
  const T = c.timeline, st = c.layout.strips, W = st.w * SHEET.w, H = 5 * st.rh * SHEET.h, col = c.colors, ink = col.ink;
  const [t0, t1] = T.window, LX = 2, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX);
  const AX = 34, CR = 50, SH = 24, order: string[] = c.courses.order, sts: string[] = c.stations.order, PADL = 14;
  const SR = Math.min(36, (H - 50 - (AX + 4 + order.length * CR + SH)) / sts.length); // station rows shrink to keep the footer inside the fixed strip height
  const cTop = AX + 4, sTop = cTop + order.length * CR + SH, bottom = sTop + sts.length * SR;
  let s = `<rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/>`;
  // sky: night / civil twilight / daylight
  const sun = T.sun, d17 = sun.jan17, d18 = sun.jan18;
  const night = "#1f2a44", band = (a: number, b: number, op: number) => (Math.min(b, t1) > Math.max(a, t0) ? `<rect x="${f1(X(Math.max(a, t0)))}" y="0" width="${f1(X(Math.min(b, t1)) - X(Math.max(a, t0)))}" height="${f1(H)}" fill="${night}" fill-opacity="${op}"/>` : '');
  // night shading blends through civil twilight (no hard edges): full at dawn−20 min / dusk+20 min, clear at sunrise+10 / sunset−10
  void band; const N = 0.17, keys: [number, number][] = [[t0, N], [d17.dawn - 20, N], [d17.sunrise + 10, 0], [d17.sunset - 10, 0], [d17.dusk + 20, N], [d18.dawn - 20, N], [d18.sunrise + 10, 0]];
  const stops = keys.map(([t, o]) => `<stop offset="${Math.min(1, Math.max(0, (X(t) - X(t0)) / (X(t1) - X(t0)))).toFixed(4)}" stop-color="${night}" stop-opacity="${o}"/>`).join('');
  s += `<defs><linearGradient id="skygrad" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs><rect class="sky" x="${f1(X(t0))}" y="0" width="${f1(X(t1) - X(t0))}" height="${f1(H)}" fill="url(#skygrad)"/>`;
  // hour grid + axis
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) {
    const x = X(t), major = t % 120 === 0;
    s += `<path d="M${f1(x)},${AX}V${f1(bottom)}" stroke="${major ? '#d6d0c4' : '#ece8e0'}" stroke-width="1"/>`;
    if (major) s += `<text x="${f1(x)}" y="${AX - 10}" font-size="21" text-anchor="${x < 24 ? "start" : "middle"}" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`;
  }
  if (t1 > 1440) s += `<text x="${f1(X(1440) + 4)}" y="${AX - 10}" font-size="15" fill="${col.mute}" dx="22">Mon</text>`;
  // sunrise / sunset markers
  const sunMark = (t: number, lab: string) => { const x = X(t), y = bottom + 14, up = lab === 'Sunrise'; let rays = ''; for (let i = 0; i < 5; i++) { const a = Math.PI * (i / 4); rays += `M${f1(x + Math.cos(a) * 9)},${f1(y - Math.sin(a) * 9)}L${f1(x + Math.cos(a) * 13)},${f1(y - Math.sin(a) * 13)}`; } return `<path d="M${f1(x)},${AX}V${f1(bottom)}" stroke="#d08a1e" stroke-width="2" stroke-dasharray="6 4"/><g class="sun"><title>${lab} ${clock(t, false)}</title><path d="M${f1(x - 7)},${f1(y)}a7,7 0 0 1 14,0z" fill="#f2a93b"/><path d="${rays}" stroke="#f2a93b" stroke-width="2" stroke-linecap="round"/><path d="M${f1(x - 14)},${f1(y)}h28" stroke="#a86a10" stroke-width="1.5"/><text x="${f1(x + 17)}" y="${f1(y)}" font-size="17" font-weight="700" fill="#a86a10" stroke="#fff" stroke-width="4" paint-order="stroke">${up ? '↑' : '↓'}${clock(t, false)}</text></g>`; };
  s += sunMark(d17.sunrise, 'Sunrise') + sunMark(d17.sunset, 'Sunset');
  {
    const B = T.bin_min, n = T.courses[order[0]].on_course.length, top = cTop + 24, base = sTop - SH - 6, hgt = base - top;
    // time grid: 15-min bin centres plus an explicit zero anchor just before each gun and the gun itself, so every band is exactly 0
    // until its race starts and rises vertically at the gun (no linear ramp back to the previous bin centre). Straight segments, no smoothing.
    const cen = (i: number) => t0 + (i + 0.5) * B, EPS = 0.01;
    const ts = [...new Set([...Array.from({ length: n }, (_, i) => cen(i)), ...order.flatMap((k) => [T.courses[k].start - EPS, T.courses[k].start])])].sort((p, q) => p - q);
    const valAt = (k: string, t: number) => { const C = T.courses[k], v = C.on_course as number[]; if (t < C.start) return 0;
      const i1 = v.findIndex((_, i) => cen(i) >= t); if (i1 < 0) return v[n - 1] || 0; if (i1 === 0 || cen(i1 - 1) < C.start) return v[i1] || 0; // before the first centre after the gun: that bin's value
      const f = (t - cen(i1 - 1)) / B; return (v[i1 - 1] || 0) * (1 - f) + (v[i1] || 0) * f; };
    const acc = ts.map(() => 0), maxT = Math.max(...ts.map((t) => order.reduce((q, k) => q + valAt(k, t), 0)));
    const xs = ts.map((t) => X(t)), Y = (v: number) => base - (v / maxT) * hgt;
    s += `<path d="M${f1(LX)},${f1(base)}H${f1(RX)}" stroke="${ink}" stroke-width="1"/>`;
    for (let v = 0; v <= maxT; v += maxT > 400 ? 200 : 100) s += `<path d="M${f1(LX)},${f1(Y(v))}H${f1(RX)}" stroke="#ece8e0" stroke-width="1"/>`;
    let bands = '', tops = '';
    order.forEach((k) => {
      const C = T.courses[k], cc = c.courses.colors[k], lo = acc.slice();
      ts.forEach((t, i) => { acc[i] += valAt(k, t); });
      // build check: this race's band has zero height at every sampled time before its gun
      ts.forEach((t, i) => { if (t < C.start && Math.abs(Y(acc[i]) - Y(lo[i])) > 1e-9) throw new Error(`[timeline] ${k} band is above zero before its ${clock(C.start)} start`); });
      const upper = xs.map((x, i) => `${f1(x)},${f1(Y(acc[i]))}`), lower = xs.map((x, i) => `${f1(x)},${f1(Y(lo[i]))}`).reverse();
      bands += `<g class="tlrow" data-course="${k}"><path d="M${upper.join('L')}L${lower.join('L')}Z" fill="${cc}" fill-opacity=".55" stroke="none"/></g>`;
      // course-colour line along the top edge of this race's band, drawn after every fill so no band covers it
      tops += `<path d="M${upper.join('L')}" class="ln" data-course="${k}" fill="none" stroke="${cc}" stroke-width="2.6" stroke-linejoin="round"/>`;
    });
    // build check on the rendered geometry: before the first gun the stacked total sits exactly on the baseline
    ts.forEach((t, i) => { if (t < Math.min(...order.map((k) => T.courses[k].start)) && f1(Y(acc[i])) !== f1(base)) throw new Error('[timeline] runners on course before the first start'); });
    console.log(`timeline: every race band is 0 until its gun (${ts.length} samples, gun anchors)`);
    s += bands + tops;
    // date in the chart's top-right corner (no left label column); build fails if any race band reaches it
    { const dw = 10 * 21 * 0.6, dx1 = RX - 6, dx0 = dx1 - dw, dy = top - 4; s += `<text x="${f1(dx1)}" y="${f1(dy)}" font-size="21" font-weight="700" text-anchor="end" fill="${ink}" stroke="#fff" stroke-width="4" paint-order="stroke">Sun Jan 17</text>`;
      xs.forEach((x, i) => { if (x > dx0 - 4 && x < dx1 + 4 && Y(acc[i]) < dy + 6) throw new Error('[timeline] date label overlaps the chart'); }); }
  }
  // stations
  // intensity: S/F (start/finish crowd) on its own scale (its own max); every other aid station shares ONE scale, normalized to the busiest non-S/F station and 15-min slot
  const GMAX = Math.max(...sts.filter((k) => k !== 'S/F' && T.stations[k]).map((k) => Math.max(...T.stations[k].passes15)));
  // cutoff icons / lines placed so far (all rows), for the overlap check
  type Bx = { x0: number; x1: number; y0: number; y1: number };
  const CW = 3, ticons: Bx[] = [], cplaced: { b: Bx; segs: Bx[]; row: [number, number] }[] = [], hitB = (p: Bx, q: Bx, m: number) => p.x0 < q.x1 + m && q.x0 < p.x1 + m && p.y0 < q.y1 + m && q.y0 < p.y1 + m;
    sts.forEach((k, r) => {
    const FC = T.finish_crowd, sf = k === 'S/F' && FC, S = sf ? { name: 'Start / Finish', passes15: FC.present15, window: null, peak15: FC.peak15 } : T.stations[k], maxP = Math.max(...S.passes15), y0 = sTop + r * SR, base = y0 + SR - 6, hgt = SR - 12, B = T.bin_min;
    const ms = Math.min(950, (SR - 6) ** 2 / 1.8), mr = Math.sqrt(ms * 1.8) / 2;
    let g = (sf ? `<title>Start / Finish shaded on its own scale (peak ${Math.round(maxP)} people); aid stations share one scale</title>` : "");
    S.passes15.forEach((v: number, i: number) => { if (!v) return; const x = X(t0 + i * B); g += `<rect x="${f1(x)}" y="${f1(y0 + 5)}" width="${f1(X(t0 + B) - X(t0) + 0.3)}" height="${f1(SR - 10)}" fill="#b3261e" fill-opacity="${(0.06 + 0.9 * Math.min(1, v / (sf ? maxP : GMAX))).toFixed(2)}"/>`; }); // single-hue intensity ramp, no outlines
    // cutoffs: no icons (the row names the station). Each cutoff is a short vertical line in its RACE's course colour, confined to this row
    // at the cutoff time; races sharing this station and time split the row height into equal segments. Thin white halo for legibility on the heat cells.
    const cm = new Map<number, string[]>();
    for (const kk of order) { const C = T.courses[kk]; for (const q of C.passes) { if (q.station !== k || q.mile === 0) continue; const tm = cutMin(q.cutoff); if (tm == null) continue; const t = tm < C.start ? tm + 1440 : tm; if (t >= t0 && t <= t1) (cm.get(t) ?? cm.set(t, []).get(t)!).push(kk); } }
    const rowLo = y0 + 3, rowHi = y0 + SR - 3;
    for (const t of [...cm.keys()].sort((p, q) => p - q)) { const ks = cm.get(t)!, tx = X(t), sh = (rowHi - rowLo) / ks.length;
      g += `<g class="tlcut"><title>${esc(S.name)} cutoff ${clock(t, false)} (${ks.join(', ')})</title>` + ks.map((kk, j) => { const ya = rowLo + j * sh + (j ? 0.75 : 0), yb = rowLo + (j + 1) * sh - (j < ks.length - 1 ? 0.75 : 0);
        cplaced.push({ b: { x0: tx - CW / 2, x1: tx + CW / 2, y0: ya, y1: yb }, segs: [], row: [rowLo, rowHi] });
        return `<path d="M${f1(tx)},${f1(ya)}V${f1(yb)}" stroke="#fff" stroke-width="${CW + 2}"/><path d="M${f1(tx)},${f1(ya)}V${f1(yb)}" stroke="${c.courses.colors[kk]}" stroke-width="${CW}"/>`; }).join('') + '</g>'; }
    // station number icon INSET at the row's left edge, over the first (early, light) cells on an opaque white disc; nudged along the row
    // until it clears every cutoff mark in this row (icons may sit on heat cells, never on cutoff marks; the build fails otherwise)
    const iy = y0 + SR / 2, mine = cplaced.filter((P) => P.row[0] === y0 + 3); let ix = LX + mr + 1 + 5.5; // disc edge ~3-4 px (5.5 units) in from the chart's left edge
    const clear = (x: number) => mine.every((P) => P.b.x1 + 2 < x - mr - 1 || P.b.x0 - 2 > x + mr + 1);
    while (!clear(ix) && ix < RX - mr) ix += 1; if (!clear(ix)) throw new Error(`[timeline] no clear spot for the ${k} row icon`);
    ticons.push({ x0: ix - mr - 1, x1: ix + mr + 1, y0: iy - mr - 1, y1: iy + mr + 1 });
    g += gmapLink(c.stations.stations[k].place ?? c.stations.stations[k].link_lonlat ?? c.stations.stations[k].lonlat, S.name, `<circle cx="${f1(ix)}" cy="${f1(iy)}" r="${f1(mr + 1)}" fill="#fff"/>` + station(ix, iy, k, c.stations.stations[k].spectator, { s: ms, fs: Math.sqrt(ms / 950) * 24, badge: false, colors: c.colors }));
    s += `<g class="tlst" data-station="${esc(k)}">${g}</g>`;
  });
  // build check: every cutoff mark stays inside its own station row; no mark touches another
  cplaced.forEach((P, i) => { for (const g2 of [P.b, ...P.segs]) if (g2.y0 < P.row[0] - 0.01 || g2.y1 > P.row[1] + 0.01) throw new Error('[timeline] a cutoff line/icon enters another station row');
    cplaced.forEach((Q, j) => { if (i !== j && (hitB(P.b, Q.b, 0.5) || Q.segs.some((g2) => hitB(g2, P.b, 0.5)))) throw new Error('[timeline] cutoff marks overlap'); }); });
  cplaced.forEach((P) => { if (ticons.some((I) => hitB(I, P.b, 1))) throw new Error('[timeline] a station icon touches a cutoff mark'); });
  console.log(`timeline: ${ticons.length} inset station icons clear of cutoff marks; ${cplaced.length} cutoff marks, each inside its own station row, no overlaps`);
  s += `<g class="tlcursor" style="display:none;pointer-events:none"><path d="M0,${AX}V${f1(bottom)}" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><g class="tip"><rect class="tlbox" fill="#fff" fill-opacity=".94" stroke="#bbb" rx="4"/><text class="tlread" font-size="17" font-weight="700"></text></g></g>`;
  return `<svg class="strips timeline" data-t0="${t0}" data-t1="${t1}" data-lx="${LX}" data-stop="${f1(sTop)}" data-sr="${f1(SR)}" data-stations="${sts.join(',')}" data-rx="${f1(RX)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Race-day timeline: runners on course and at aid stations by time of day">${s}</svg>`;
}
