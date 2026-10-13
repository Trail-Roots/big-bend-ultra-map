// Time-of-day timeline (race day, Jan 17 2027): one row per distance with modelled runners-on-course density,
// start, cutoffs and finish; one row per aid station with its open window and modelled runners passing per 15 min.
// Data: content/timeline.json (scripts/timeline.ts). Night / civil twilight / daylight shading from the same file.
import { SHEET, f1, esc, gmapLink, finishFlag } from './util';
import type { Ctx } from './types';

export const clock = (m: number, short = true) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60, ap = h < 12 ? 'a' : 'p', h12 = h % 12 || 12;
  return short && mi === 0 ? `${h12}${ap}` : `${h12}:${String(mi).padStart(2, '0')}${ap}`;
};
export const cutMin = (t: string) => { const m = t.match(/^(\d+):(\d\d) (AM|PM)$/); if (!m) return null; return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]); };

export function renderTimeline(c: Ctx) {
  const T = c.timeline, st = c.layout.strips, W = st.w * SHEET.w, H = 5 * st.rh * SHEET.h, col = c.colors, ink = col.ink;
  const [t0, t1] = T.window, LX = 178, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX);
  const AX = 34, CR = 50, SH = 24, order: string[] = c.courses.order, sts: string[] = c.stations.order.flatMap((k: string) => (k === 'S/F' && T.finish_crowd ? [k, 'crowd'] : [k]));
  const SR = Math.min(36, (H - 50 - (AX + 4 + order.length * CR + SH)) / sts.length); // station rows shrink to keep the footer inside the fixed strip height
  const cTop = AX + 4, sTop = cTop + order.length * CR + SH, bottom = sTop + sts.length * SR;
  let s = `<rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/>`;
  // sky: night / civil twilight / daylight
  const sun = T.sun, d17 = sun.jan17, d18 = sun.jan18;
  const night = '#1f2a44', band = (a: number, b: number, op: number) => (b > a ? `<rect x="${f1(X(Math.max(a, t0)))}" y="0" width="${f1(X(Math.min(b, t1)) - X(Math.max(a, t0)))}" height="${f1(H)}" fill="${night}" fill-opacity="${op}"/>` : '');
  s += `<g class="sky">${band(t0, d17.dawn, 0.16)}${band(d17.dawn, d17.sunrise, 0.07)}${band(d17.sunset, d17.dusk, 0.07)}${band(d17.dusk, d18.dawn, 0.16)}${band(d18.dawn, d18.sunrise, 0.07)}</g>`;
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
  // course rows
  
  order.forEach((k, r) => {
    const C = T.courses[k], maxOn = Math.max(...C.on_course), y0 = cTop + r * CR, base = y0 + CR - 8, hgt = CR - 16, cc = c.courses.colors[k], B = T.bin_min;
    let g = `<text x="0" y="${f1(y0 + CR / 2)}" font-size="26" font-weight="700" fill="${cc}" dominant-baseline="central">${k}</text>`;
    const pts = C.on_course.map((v: number, i: number) => [X(t0 + (i + 0.5) * B), base - (v / maxOn) * hgt, t0 + (i + 0.5) * B]).filter((p: number[]) => p[2] > C.start); // nobody on course before the start
    g += `<path d="M${f1(X(C.start))},${f1(base)}L${pts.map((p: number[]) => `${f1(p[0])},${f1(p[1])}`).join('L')}L${f1(X(t1))},${f1(base)}Z" fill="${cc}" fill-opacity=".28" stroke="${cc}" stroke-width="1.6" stroke-linejoin="round"/>`;
    g += `<path d="M${f1(X(C.start))},${f1(base)}H${f1(X(t1))}" stroke="${cc}" stroke-width="1" stroke-opacity=".5"/>`;
    // start flag
    g += `<path d="M${f1(X(C.start))},${f1(base)}V${f1(y0 + 4)}" stroke="${ink}" stroke-width="2"/><path d="M${f1(X(C.start))},${f1(y0 + 4)}h14l-4,5 4,5h-14z" fill="${ink}"/><text x="${f1(X(C.start) - 5)}" y="${f1(y0 + 12)}" font-size="17" font-weight="700" text-anchor="end" fill="${ink}" stroke="#fff" stroke-width="4" paint-order="stroke">${clock(C.start)}</text>`;
    // cutoffs (station number + time) and finish cutoff
    for (const q of C.passes) {
      const tm = cutMin(q.cutoff); if (tm == null || q.mile === 0) continue;
      const t = tm < C.start ? tm + 1440 : tm, x = X(t), fin = q === C.passes[C.passes.length - 1];
      if (fin) g += finishFlag(x, base, y0 + 4, ink); else g += `<path d="M${f1(x)},${f1(base + 2)}V${f1(base - hgt - 2)}" stroke="#b3261e" stroke-width="2"/>`;
      g += `${fin ? `<text x="${f1(x + 18)}" y="${f1(y0 + 12)}" font-size="17" font-weight="700" fill="${ink}" stroke="#fff" stroke-width="4" paint-order="stroke">${clock(t)}</text>` : `<text x="${f1(x)}" y="${f1(base - hgt - 4)}" font-size="14" font-weight="700" text-anchor="middle" fill="#b3261e" stroke="#fff" stroke-width="3" paint-order="stroke">${q.station} ${clock(t)}</text>`}`;
    }
    s += `<g class="tlrow" data-course="${k}">${g}</g>`;
  });
  // stations
  s += `<text x="0" y="${f1(sTop - 6)}" font-size="17" font-weight="700" fill="${ink}">Aid stations · busiest times (model)</text>`;
    sts.forEach((k, r) => {
    const FC = T.finish_crowd, crowd = k === 'crowd', S = crowd ? { name: 'Finish area crowd', passes15: FC.present15, window: null, peak15: FC.peak15 } : T.stations[k], maxP = Math.max(...S.passes15), y0 = sTop + r * SR, base = y0 + SR - 6, hgt = SR - 12, B = T.bin_min;
    const lt = `<text x="0" y="${f1(y0 + SR / 2)}" font-size="19" font-weight="700" fill="${ink}" dominant-baseline="central">${crowd ? '' : esc(k) + ' '}<tspan font-weight="400">${esc(S.name)}</tspan></text>`;
    let g = crowd ? lt : gmapLink(c.stations.stations[k].lonlat, S.name, lt);
    S.passes15.forEach((v: number, i: number) => { if (!v) return; const x = X(t0 + i * B); g += `<rect x="${f1(x)}" y="${f1(y0 + 5)}" width="${f1(X(t0 + B) - X(t0) + 0.3)}" height="${f1(SR - 10)}" fill="#b3261e" fill-opacity="${(0.06 + 0.9 * Math.sqrt(v / maxP)).toFixed(2)}"/>`; }); // single-hue intensity ramp, no outlines
    // busiest window = contiguous run of ≥ half-peak bins around the peak (time only, no counts)
    const pi = Math.round((S.peak15.start - t0) / B); let a = pi, z = pi; while (a > 0 && S.passes15[a - 1] >= 0.5 * maxP) a--; while (z < S.passes15.length - 1 && S.passes15[z + 1] >= 0.5 * maxP) z++;
    const win = `${clock(t0 + a * B, false)}–${clock(t0 + (z + 1) * B, false)}`;
    g += `<text x="${f1(X(t0 + (z + 1) * B) + 6)}" y="${f1(y0 + 14)}" font-size="15" font-weight="700" fill="#7a1a14" stroke="#fff" stroke-width="4" paint-order="stroke">${win}</text>`;
    s += `<g class="tlst" data-station="${esc(k)}">${g}</g>`;
  });
  s += `<g class="tlcursor" style="display:none;pointer-events:none"><path d="M0,${AX}V${f1(bottom)}" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><rect class="tlbox" fill="#fff" fill-opacity=".92" stroke="#bbb" rx="4"/><text class="tlread" font-size="17" font-weight="700"></text></g>`;
  return `<svg class="strips timeline" data-t0="${t0}" data-t1="${t1}" data-lx="${LX}" data-rx="${f1(RX)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Race-day timeline: runners on course and at aid stations by time of day">${s}</svg>`;
}
