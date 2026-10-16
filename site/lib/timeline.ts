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
  const AX = 34, CR = 50, SH = 24, TR = 24, order: string[] = c.courses.order, sts: string[] = c.stations.order, PADL = 14; void PADL;
  const VOL = order.length * CR + SH; // volume chart block (incl. room for the date at its top-left)
  const SR = Math.min(36, (H - 50 - (AX + 4 + TR + VOL + 8)) / sts.length); // station rows shrink to keep the footer inside the fixed strip height
  // order top -> bottom: hour axis, temperatures, aid-station heat map rows, runners-on-course volume chart
  const sTop = AX + 4 + TR, vTop = sTop + sts.length * SR + 8, bottom = vTop + VOL - 6;
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
    s += `<path d="M${f1(x)},${AX}V${f1(bottom)}" stroke="${major ? '#d4d4d4' : '#ececec'}" stroke-width="1"/>`;
    if (major) s += `<text x="${f1(x)}" y="${AX - 10}" font-size="21" text-anchor="${x < 24 ? "start" : "middle"}" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`;
  }
  if (t1 > 1440) s += `<text x="${f1(X(1440) + 4)}" y="${AX - 10}" font-size="15" fill="${col.mute}" dx="22">Mon</text>`;
  // sunrise / sunset markers
  const sunMark = (t: number, lab: string) => { const x = X(t), y = bottom + 14, up = lab === 'Sunrise'; let rays = ''; for (let i = 0; i < 5; i++) { const a = Math.PI * (i / 4); rays += `M${f1(x + Math.cos(a) * 9)},${f1(y - Math.sin(a) * 9)}L${f1(x + Math.cos(a) * 13)},${f1(y - Math.sin(a) * 13)}`; } return `<path d="M${f1(x)},${AX}V${f1(bottom)}" stroke="#d08a1e" stroke-width="2" stroke-dasharray="6 4"/><g class="sun"><title>${lab} ${clock(t, false)}</title><path d="M${f1(x - 7)},${f1(y)}a7,7 0 0 1 14,0z" fill="#f2a93b"/><path d="${rays}" stroke="#f2a93b" stroke-width="2" stroke-linecap="round"/><path d="M${f1(x - 14)},${f1(y)}h28" stroke="#a86a10" stroke-width="1.5"/><text x="${f1(x + 17)}" y="${f1(y)}" font-size="17" font-weight="700" fill="#a86a10" stroke="#fff" stroke-width="4" paint-order="stroke">${up ? '↑' : '↓'}${clock(t, false)}</text></g>`; };
  s += sunMark(d17.sunrise, 'Sunrise') + sunMark(d17.sunset, 'Sunset');
  {
    const B = T.bin_min, n = T.courses[order[0]].on_course.length, top = vTop + 30, base = bottom, hgt = base - top;
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
    // date at the volume chart's top-left corner (the left edge is the start of the race day); build fails if any race band reaches it
    { const dw = 10 * 21 * 0.6, dx0 = LX + 6, dx1 = dx0 + dw, dy = top - 6; s += `<text class="tldate" x="${f1(dx0)}" y="${f1(dy)}" font-size="21" font-weight="700" text-anchor="start" fill="${ink}" stroke="#fff" stroke-width="4" paint-order="stroke">Sun Jan 17</text>`;
      xs.forEach((x, i) => { if (x > dx0 - 4 && x < dx1 + 4 && Y(acc[i]) < dy + 6) throw new Error('[timeline] date label overlaps the chart'); }); }
    s += `<script type="application/json" class="tldata">${JSON.stringify({ xs: xs.map((x) => +x.toFixed(1)), v: Object.fromEntries(order.map((k) => [k, ts.map((tt) => +valAt(k, tt).toFixed(2))])), base, hgt })}</script>`;
  }
  // temperatures (2026 race day at the Start / Finish, hourly; sources/temps.json): one small reading under each 2-hour tick
  s += tempRow(X, t0, t1, AX + 4 + TR - 7, col.mute);
  s += heatRows(c, { X, LX, RX, sTop, SR, sts, races: order, t0, t1 });
  s += `<g class="tlcursor" style="display:none;pointer-events:none"><path d="M0,${AX}V${f1(bottom)}" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><g class="tip"><rect class="tlbox" fill="#fff" fill-opacity=".94" stroke="#bbb" rx="4"/><text class="tlread" font-size="17" font-weight="700"></text></g></g>`;
  return `<svg class="strips timeline" data-t0="${t0}" data-t1="${t1}" data-lx="${LX}" data-stop="${f1(sTop)}" data-sr="${f1(SR)}" data-sbot="${f1(sTop + sts.length * SR)}" data-stations="${sts.join(',')}" data-rx="${f1(RX)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Race-day timeline: runners on course and at aid stations by time of day">${s}</svg>`;
}

import temps from '../../sources/temps.json';
/** °F at minute m of Jan 17 (CST), linear between hourly readings */
export const tempAt = (m: number) => { const h = temps.hourly as number[][]; const i = h.findIndex((p) => p[0] >= m); if (i <= 0) return h[Math.max(0, i)][1]; const [ma, va] = h[i - 1], [mb, vb] = h[i]; return va + ((vb - va) * (m - ma)) / (mb - ma); };
function tempRow(X: (t: number) => number, t0: number, t1: number, y: number, mute: string) {
  let s = '<g class="temps">';
  for (let t = Math.ceil(t0 / 120) * 120; t <= t1; t += 120) { const x = X(t); if (x < 24 || x > X(t1) - 18) continue; s += `<text x="${f1(x)}" y="${f1(y)}" font-size="15" text-anchor="middle" fill="${mute}">${Math.round(tempAt(t))}°</text>`; }
  return s + `<text x="${f1(X(t0) + 2)}" y="${f1(y)}" font-size="13" fill="${mute}">°F</text></g>`;
}
/** multi-step heat ramp (cream -> amber -> red -> deep red), v in 0..1; sqrt-scaled by the caller so quiet stations still read */
export const heat = (v: number) => { const S = [[255, 244, 222], [247, 182, 92], [214, 72, 40], [140, 18, 18], [74, 8, 8]], x = Math.min(1, Math.max(0, v)) * (S.length - 1), i = Math.min(S.length - 2, Math.floor(x)), f = x - i; return 'rgb(' + S[i].map((a, j) => Math.round(a + (S[i + 1][j] - a) * f)).join(',') + ')'; };
type HO = { X: (t: number) => number; LX: number; RX: number; sTop: number; SR: number; sts: string[]; races: string[]; t0: number; t1: number; only?: string; gmaxFrom?: string[]; series?: number[]; title?: string };
/** aid-station heat map rows: modelled people per 15 min (S/F on its own scale, aid stations share one), cutoff marks per race confined to the row */
export function heatRows(c: Ctx, o: HO) {
  const T = c.timeline, { X, LX, RX, sTop, SR, sts, races: order, t0, t1 } = o, B = T.bin_min, FC = T.finish_crowd;
  const series = (k: string) => { if (o.series) return o.series; const sf = k === 'S/F', S = sf ? FC : T.stations[k]; if (!S) return null; const by = S.by_course15 as Record<string, number[]>, base = sf ? S.present15 : S.passes15;
    return o.only ? (by?.[o.only] ?? base.map(() => 0)) : base; };
  const GMAX = Math.max(1, ...(o.gmaxFrom ?? sts).filter((k) => k !== 'S/F').map((k) => Math.max(0, ...(series(k) ?? [0]))));
  type Bx = { x0: number; x1: number; y0: number; y1: number };
  const CW = 9, ticons: Bx[] = [], cplaced: { b: Bx; row: [number, number] }[] = [], hitB = (p: Bx, q: Bx, m: number) => p.x0 < q.x1 + m && q.x0 < p.x1 + m && p.y0 < q.y1 + m && q.y0 < p.y1 + m;
  const pid = (kk: string) => `cutpat${o.only ?? ''}-${kk}`;
  let s = `<defs>${order.map((kk) => `<pattern id="${pid(kk)}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.6" height="6" fill="${c.courses.colors[kk]}" fill-opacity=".8"/></pattern>`).join('')}</defs>`;
  sts.forEach((k, r) => {
    const sf = k === 'S/F', v15 = series(k) ?? [], maxP = Math.max(1, ...v15), y0 = sTop + r * SR, name = sf ? 'Start / Finish' : T.stations[k]?.name ?? c.stations.stations[k].name;
    const ms = Math.min(950, (SR - 6) ** 2 / 1.8), mr = Math.sqrt(ms * 1.8) / 2;
    let g = o.title ? `<title>${esc(o.title)}</title>` : sf ? `<title>Start / Finish shaded on its own scale (peak ${Math.round(maxP)} people); aid stations share one scale</title>` : '';
    v15.forEach((v: number, i: number) => { if (!v) return; const x = X(t0 + i * B); if (x > RX) return; g += `<rect class="hc" data-i="${i}" x="${f1(x)}" y="${f1(y0 + 4)}" width="${f1(X(t0 + B) - X(t0) + 0.3)}" height="${f1(SR - 8)}" fill="#b3261e" fill-opacity="${(0.06 + 0.9 * Math.sqrt(Math.min(1, v / maxP))).toFixed(2)}"/>`; });
    // cutoffs: a thick bar in the race colour with white diagonal "barrier" slashes, white edge, confined to this row; races sharing a station + time split the row
    const cm = new Map<number, string[]>();
    for (const kk of order) { const C = T.courses[kk]; for (const q of C.passes) { if (q.station !== k || q.mile === 0) continue; const tm = cutMin(q.cutoff); if (tm == null) continue; const t = tm < C.start ? tm + 1440 : tm; if (t >= t0 && t <= t1) (cm.get(t) ?? cm.set(t, []).get(t)!).push(kk); } }
    const rowLo = y0 + 2, rowHi = y0 + SR - 2;
    for (const t of [...cm.keys()].sort((p, q) => p - q)) { const ks = cm.get(t)!, tx = X(t), sh = (rowHi - rowLo) / ks.length;
      g += `<g class="tlcut"><title>${esc(name)} cutoff ${clock(t, false)} (${ks.join(', ')})</title>` + ks.map((kk, j) => { const ya = rowLo + j * sh + (j ? 0.75 : 0), yb = rowLo + (j + 1) * sh - (j < ks.length - 1 ? 0.75 : 0);
        cplaced.push({ b: { x0: tx - CW / 2, x1: tx + CW / 2, y0: ya, y1: yb }, row: [rowLo, rowHi] });
        return `<rect data-course="${kk}" x="${f1(tx - CW / 2)}" y="${f1(ya)}" width="${CW}" height="${f1(yb - ya)}" fill="url(#${pid(kk)})"/>`; }).join('') + '</g>'; }
    // station number icon inset at the row's left edge on a white disc, nudged right until it clears every cutoff mark in this row
    const iy = y0 + SR / 2, mine = cplaced.filter((P) => P.row[0] === rowLo); let ix = LX + mr + 1 + 5.5;
    const clear = (x: number) => mine.every((P) => P.b.x1 + 3 < x - mr - 1 || P.b.x0 - 3 > x + mr + 1);
    while (!clear(ix) && ix < RX - mr) ix += 1; if (!clear(ix)) throw new Error(`[timeline] no clear spot for the ${k} row icon`);
    ticons.push({ x0: ix - mr - 1, x1: ix + mr + 1, y0: iy - mr - 1, y1: iy + mr + 1 });
    const stn = c.stations.stations[k];
    g += `<a class="stlink" href="#station-${encodeURIComponent(k)}" data-station="${esc(k)}" aria-label="${esc(stn.name)} aid station details"><circle cx="${f1(ix)}" cy="${f1(iy)}" r="${f1(mr + 1)}" fill="#fff"/>` + station(ix, iy, k, stn.spectator, { s: ms, fs: Math.sqrt(ms / 950) * 24, badge: false, colors: c.colors }) + '</a>';
    const cl = [...cm.entries()].flatMap(([tt, ks]) => ks.map((kk) => [tt, kk]));
    s += `<g class="tlst" data-station="${esc(k)}" data-cuts='${JSON.stringify(cl)}' data-cw="${f1((CW / (RX - LX)) * (t1 - t0))}">${g}</g>`;
  });
  cplaced.forEach((P, i) => { if (P.b.y0 < P.row[0] - 0.01 || P.b.y1 > P.row[1] + 0.01) throw new Error('[timeline] a cutoff mark enters another station row');
    cplaced.forEach((Q, j) => { if (i !== j && hitB(P.b, Q.b, 0.5)) throw new Error('[timeline] cutoff marks overlap'); }); });
  cplaced.forEach((P) => { if (ticons.some((I) => hitB(I, P.b, 1))) throw new Error('[timeline] a station icon touches a cutoff mark'); });
  console.log(`heat rows${o.only ? ' ' + o.only : ''}: ${ticons.length} rows, ${cplaced.length} cutoff marks inside their own rows, no overlaps`);
  return s;
}
/** race page: heat map limited to one race (its stations, its runners, its cutoffs), same time axis style */
export function renderRaceHeat(c: Ctx, k: string) {
  const T = c.timeline, C = T.courses[k], col = c.colors, ink = col.ink, W = 900;
  const sts = c.stations.order.filter((s) => s === 'S/F' || C.passes.some((q: any) => q.station === s));
  const lastT = Math.max(...C.passes.map((q: any) => q.last ?? 0), C.start + 60), t0 = Math.floor((C.start - 30) / 60) * 60, t1 = Math.min(T.window[1], Math.ceil((lastT + 45) / 60) * 60);
  const AX = 30, SR = 30, LX = 2, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX), sTop = AX + 6, H = sTop + sts.length * SR + 4;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  const step = t1 - t0 > 720 ? 120 : 60;
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) { const x = X(t), major = t % step === 0; s += `<path d="M${f1(x)},${AX}V${f1(H - 4)}" stroke="${major ? '#d4d4d4' : '#ececec'}"/>`; if (major && x > 20 && x < W - 20) s += `<text x="${f1(x)}" y="${AX - 9}" font-size="17" text-anchor="middle" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`; }
  s += heatRows(c, { X, LX, RX, sTop, SR, sts, races: [k], t0, t1, only: k });
  return `<svg class="raceheat" data-course="${k}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} aid-station heat map">${s}</svg>`;
}
/** station lightbox: that one station's heat-map row (all races) with its cutoffs, over the station's own day */
export function renderStationHeat(c: Ctx, k: string) {
  const T = c.timeline, col = c.colors, ink = col.ink, W = 900, races = c.courses.order.filter((r) => T.courses[r].passes.some((q: any) => q.station === k));
  const S = k === 'S/F' ? T.finish_crowd : T.stations[k], v: number[] = k === 'S/F' ? S.present15 : S.passes15, B = T.bin_min;
  const nz = v.map((x, i) => (x ? i : -1)).filter((i) => i >= 0), first = T.window[0] + (nz[0] ?? 0) * B, last = T.window[0] + ((nz[nz.length - 1] ?? 0) + 1) * B;
  const t0 = Math.max(T.window[0], Math.floor((first - 30) / 60) * 60), t1 = Math.min(T.window[1], Math.ceil((last + 30) / 60) * 60);
  const AX = 30, SR = 40, LX = 2, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX), sTop = AX + 6, H = sTop + SR + 4, step = t1 - t0 > 720 ? 120 : 60;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) { const x = X(t), major = t % step === 0; s += `<path d="M${f1(x)},${AX}V${f1(H - 4)}" stroke="${major ? '#d4d4d4' : '#ececec'}"/>`; if (major && x > 20 && x < W - 20) s += `<text x="${f1(x)}" y="${AX - 9}" font-size="17" text-anchor="middle" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`; }
  // shading scale shared with page 1 (aid stations share one scale; S/F its own)
  s += heatRows(c, { X, LX, RX, sTop, SR, sts: [k], races, t0, t1, gmaxFrom: c.stations.order });
  return `<svg class="stheat" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(c.stations.stations[k].name)} busiest times">${s}</svg>`;
}

/** finish-area page: one heat row of runners off course at the Start / Finish (waiting to start / finished), same style and time axis as page 1 */
export function renderIdleHeat(c: Ctx) {
  const T = c.timeline, col = c.colors, ink = col.ink, W = 900, [t0, t1] = T.window, AX = 30, SR = 40, LX = 2, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX), sTop = AX + 6, H = sTop + SR + 4;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let t = Math.ceil(t0 / 60) * 60; t <= t1; t += 60) { const x = X(t), major = t % 120 === 0; s += `<path d="M${f1(x)},${AX}V${f1(H - 4)}" stroke="${major ? '#d4d4d4' : '#ececec'}"/>`; if (major && x > 20 && x < W - 20) s += `<text x="${f1(x)}" y="${AX - 9}" font-size="17" text-anchor="middle" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`; }
  s += heatRows(c, { X, LX, RX, sTop, SR, sts: ['S/F'], races: [], t0, t1, series: T.finish_crowd.inactive15, title: 'Runners off course at the Start / Finish (modelled)' });
  return `<svg class="idleheat" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Runners off course at the Start / Finish by time of day">${s}</svg>`;
}
