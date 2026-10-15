// Time-of-day timeline (race day, Jan 17 2027): one row per distance with modelled runners-on-course density,
// start, cutoffs and finish; one row per aid station with its open window and modelled runners passing per 15 min.
// Data: content/timeline.json (scripts/timeline.ts). Night / civil twilight / daylight shading from the same file.
import { SHEET, f1, esc, gmapLink, finishFlag, station } from './util';
import { miniBib, MINIBIB } from './panels';
import type { Ctx } from './types';

export const clock = (m: number, short = true) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60, ap = h < 12 ? 'a' : 'p', h12 = h % 12 || 12;
  return short && mi === 0 ? `${h12}${ap}` : `${h12}:${String(mi).padStart(2, '0')}${ap}`;
};
export const cutMin = (t: string) => { const m = t.match(/^(\d+):(\d\d) (AM|PM)$/); if (!m) return null; return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]); };

export function renderTimeline(c: Ctx) {
  const T = c.timeline, st = c.layout.strips, W = st.w * SHEET.w, H = 5 * st.rh * SHEET.h, col = c.colors, ink = col.ink;
  const [t0, t1] = T.window, LX = 196, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX);
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
    if (major) s += `<text x="${f1(x)}" y="${AX - 10}" font-size="21" text-anchor="middle" fill="${ink}">${t % 1440 === 0 ? '12a' : clock(t)}</text>`;
  }
  s += `<text x="0" y="${AX - 10}" font-size="21" font-weight="700" fill="${ink}">Sun Jan 17</text>`;
  if (t1 > 1440) s += `<text x="${f1(X(1440) + 4)}" y="${AX - 10}" font-size="15" fill="${col.mute}" dx="22">Mon</text>`;
  // sunrise / sunset markers
  const sunMark = (t: number, lab: string) => { const x = X(t), y = bottom + 14, up = lab === 'Sunrise'; let rays = ''; for (let i = 0; i < 5; i++) { const a = Math.PI * (i / 4); rays += `M${f1(x + Math.cos(a) * 9)},${f1(y - Math.sin(a) * 9)}L${f1(x + Math.cos(a) * 13)},${f1(y - Math.sin(a) * 13)}`; } return `<path d="M${f1(x)},${AX}V${f1(bottom)}" stroke="#d08a1e" stroke-width="2" stroke-dasharray="6 4"/><g class="sun"><title>${lab} ${clock(t, false)}</title><path d="M${f1(x - 7)},${f1(y)}a7,7 0 0 1 14,0z" fill="#f2a93b"/><path d="${rays}" stroke="#f2a93b" stroke-width="2" stroke-linecap="round"/><path d="M${f1(x - 14)},${f1(y)}h28" stroke="#a86a10" stroke-width="1.5"/><text x="${f1(x + 17)}" y="${f1(y)}" font-size="17" font-weight="700" fill="#a86a10" stroke="#fff" stroke-width="4" paint-order="stroke">${up ? '↑' : '↓'}${clock(t, false)}</text></g>`; };
  s += sunMark(d17.sunrise, 'Sunrise') + sunMark(d17.sunset, 'Sunset');
  {
    const B = T.bin_min, n = T.courses[order[0]].on_course.length, top = cTop + 36, base = cTop + order.length * CR - 6, hgt = base - top;
    const acc = new Array(n).fill(0), tot = acc.map((_, i) => order.reduce((q, k) => q + (T.courses[k].on_course[i] || 0), 0)), maxT = Math.max(...tot);
    const xs = acc.map((_, i) => X(t0 + (i + 0.5) * B)), Y = (v: number) => base - (v / maxT) * hgt;
    s += `<path d="M${f1(LX)},${f1(base)}H${f1(RX)}" stroke="${ink}" stroke-width="1"/>`;
    for (let v = 0; v <= maxT; v += maxT > 400 ? 200 : 100) s += `<path d="M${f1(LX)},${f1(Y(v))}H${f1(RX)}" stroke="#ece8e0" stroke-width="1"/><text x="${f1(LX - 6)}" y="${f1(Y(v) + 5)}" font-size="13" text-anchor="end" fill="${col.mute}">${v}</text>`;
    let bands = '';
    order.forEach((k) => {
      const C = T.courses[k], cc = c.courses.colors[k], lo = acc.slice();
      C.on_course.forEach((v: number, i: number) => { acc[i] += t0 + (i + 0.5) * B > C.start ? v : 0; });
      const upper = xs.map((x, i) => `${f1(x)},${f1(Y(acc[i]))}`), lower = xs.map((x, i) => `${f1(x)},${f1(Y(lo[i]))}`).reverse();
      bands += `<g class="tlrow" data-course="${k}"><path d="M${upper.join('L')}L${lower.join('L')}Z" fill="${cc}" fill-opacity=".55" stroke="none"/><path d="M${upper.join('L')}" class="ln" stroke="${cc}" stroke-width="1.8"/></g>`;
    });
    s += bands + `<text x="${PADL}" y="${f1(top - 8)}" font-weight="700" font-size="14" fill="${col.mute}">Runners on course</text>`;
    // legend: mini bibs, top = last in the stack
    const lh = (base - top) / order.length;
    [...order].reverse().forEach((k, r) => { s += miniBib(k, c.courses.colors[k], PADL, top + r * lh + lh / 2 - MINIBIB.h / 2, c.colors); });
    // starts (flag + time) and final cutoffs (finish flag + time), one label per distinct time
    const rowEnd = [-1e9, -1e9]; // start labels on two staggered rows so no two touch
    order.forEach((k) => { const C = T.courses[k], x = X(C.start), ri = rowEnd[0] < x ? 0 : 1, ry = top - 30 + ri * 15; rowEnd[ri] = x + 14 + clock(C.start).length * 8 + 4; s += `<path d="M${f1(x)},${f1(base)}V${f1(ry - 8)}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M${f1(x)},${f1(ry - 9)}h12l-4,4 4,4h-12z" fill="${c.courses.colors[k]}"/>`;
      s += `<text x="${f1(x + 14)}" y="${f1(ry + 4)}" font-size="13" font-weight="700" fill="${ink}" stroke="#fff" stroke-width="3" paint-order="stroke">${clock(C.start)}</text>`; });
    const fins = new Map<number, string[]>();
    order.forEach((k) => { const C = T.courses[k], q = C.passes[C.passes.length - 1], tm = cutMin(q.cutoff); if (tm == null) return; const t = tm < C.start ? tm + 1440 : tm; fins.set(t, [...(fins.get(t) ?? []), k]); });
    for (const [t, ks] of fins) { const x = X(t); s += `<path d="M${f1(x)},${f1(base)}V${f1(top - 2)}" stroke="${ink}" stroke-width="1.6"><title>${ks.join(', ')} final cutoff ${clock(t, false)}</title></path>` + finishFlag(x, top - 2, top - 18, ink) + `<text x="${f1(x + 16)}" y="${f1(top - 6)}" font-size="14" font-weight="700" fill="${ink}" stroke="#fff" stroke-width="3" paint-order="stroke">${clock(t)}</text>`; }
  }
  // stations
  s += `<text x="${PADL}" y="${f1(sTop - 6)}" font-size="17" font-weight="700" fill="${ink}">Busiest times</text><path d="M${PADL + 172},${f1(sTop - 20)}v16" stroke="#111" stroke-width="4"/><path d="M${PADL + 172},${f1(sTop - 20)}v16" stroke="#fff" stroke-width="2"/><text x="${PADL + 178}" y="${f1(sTop - 6)}" font-size="14" fill="${col.mute}">opens</text><path d="M${PADL + 230},${f1(sTop - 20)}v16" stroke="#111" stroke-width="2.4"/><text x="${PADL + 236}" y="${f1(sTop - 6)}" font-size="14" fill="${col.mute}">cutoff</text>`;
  // one global intensity scale: share of all runners, normalized to the busiest aid station and 15-min slot (Waterhole); never per station
  const GMAX = Math.max(...sts.filter((k) => k !== 'S/F' && T.stations[k]).map((k) => Math.max(...T.stations[k].passes15)));
    sts.forEach((k, r) => {
    const FC = T.finish_crowd, sf = k === 'S/F' && FC, S = sf ? { name: 'Start / Finish', passes15: FC.present15, window: null, peak15: FC.peak15 } : T.stations[k], maxP = Math.max(...S.passes15), y0 = sTop + r * SR, base = y0 + SR - 6, hgt = SR - 12, B = T.bin_min;
    const ms = Math.min(950, (SR - 4) ** 2 / 1.8), mr = Math.sqrt(ms * 1.8) / 2, lt = station(PADL + mr, y0 + SR / 2, k, c.stations.stations[k].spectator, { s: ms, fs: Math.sqrt(ms / 950) * 24, badge: false, colors: c.colors }) + `<text x="${f1(PADL + 2 * mr + 8)}" y="${f1(y0 + SR / 2)}" font-size="19" fill="${ink}" dominant-baseline="central">${esc(S.name)}</text>`;
    let g = gmapLink(c.stations.stations[k].place ?? c.stations.stations[k].link_lonlat ?? c.stations.stations[k].lonlat, S.name, lt);
    S.passes15.forEach((v: number, i: number) => { if (!v) return; const x = X(t0 + i * B); g += `<rect x="${f1(x)}" y="${f1(y0 + 5)}" width="${f1(X(t0 + B) - X(t0) + 0.3)}" height="${f1(SR - 10)}" fill="#b3261e" fill-opacity="${(0.06 + 0.9 * Math.min(1, v / GMAX)).toFixed(2)}"/>`; }); // single-hue intensity ramp, no outlines
    // simple lines: station opening (green) and every cutoff at this station, all courses (red)
    const win = T.stations[k]?.window as [number, number] | null, cuts = new Set<number>();
    for (const kk of order) { const C = T.courses[kk]; for (const q of C.passes) { if (q.station !== k || q.mile === 0) continue; const tm = cutMin(q.cutoff); if (tm != null) cuts.add(tm < C.start ? tm + 1440 : tm); } }
    const vl = (t: number, colr: string, title: string, w = 2.4) => t >= t0 && t <= t1 ? `<path d="M${f1(X(t))},${f1(y0 + 3)}V${f1(y0 + SR - 3)}" stroke="${colr}" stroke-width="${w}"><title>${title}</title></path>` : '';
    // opens = white line with a thin dark edge; cutoff = solid black (neutral: course colors mean distances)
    if (win) g += vl(win[0], '#111', `${S.name} opens ${clock(win[0], false)}`, 4) + vl(win[0], '#fff', `${S.name} opens ${clock(win[0], false)}`, 2);
    for (const t of cuts) g += vl(t, '#111', `${S.name} cutoff ${clock(t, false)}`);
    s += `<g class="tlst" data-station="${esc(k)}">${g}</g>`;
  });
  s += `<g class="tlcursor" style="display:none;pointer-events:none"><path d="M0,${AX}V${f1(bottom)}" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><rect class="tlbox" fill="#fff" fill-opacity=".92" stroke="#bbb" rx="4"/><text class="tlread" font-size="17" font-weight="700"></text></g>`;
  return `<svg class="strips timeline" data-t0="${t0}" data-t1="${t1}" data-lx="${LX}" data-stop="${f1(sTop)}" data-sr="${f1(SR)}" data-stations="${sts.join(',')}" data-rx="${f1(RX)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Race-day timeline: runners on course and at aid stations by time of day">${s}</svg>`;
}
