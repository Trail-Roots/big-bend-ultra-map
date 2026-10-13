// Time-of-day timeline (race day, Jan 17 2027): one row per distance with modelled runners-on-course density,
// start, cutoffs and finish; one row per aid station with its open window and modelled runners passing per 15 min.
// Data: content/timeline.json (scripts/timeline.ts). Night / civil twilight / daylight shading from the same file.
import { SHEET, f1, esc } from './util';
import type { Ctx } from './types';

export const clock = (m: number, short = true) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60, ap = h < 12 ? 'a' : 'p', h12 = h % 12 || 12;
  return short && mi === 0 ? `${h12}${ap}` : `${h12}:${String(mi).padStart(2, '0')}${ap}`;
};
const cutMin = (t: string) => { const m = t.match(/^(\d+):(\d\d) (AM|PM)$/); if (!m) return null; return (Number(m[1]) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]); };

export function renderTimeline(c: Ctx) {
  const T = c.timeline, st = c.layout.strips, W = st.w * SHEET.w, H = 5 * st.rh * SHEET.h, col = c.colors, ink = col.ink;
  const [t0, t1] = T.window, LX = 178, RX = W - 8, X = (t: number) => LX + ((t - t0) / (t1 - t0)) * (RX - LX);
  const AX = 34, CR = 50, SH = 24, order: string[] = c.courses.order, sts: string[] = c.stations.order.flatMap((k: string) => (k === 'S/F' && T.finish_crowd ? [k, 'crowd'] : [k]));
  const SR = Math.min(36, (H - 50 - (AX + 4 + order.length * CR + SH)) / sts.length); // station rows shrink to keep the footer inside the fixed strip height
  const cTop = AX + 4, sTop = cTop + order.length * CR + SH, bottom = sTop + sts.length * SR;
  let s = `<rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/>`;
  // sky: night / civil twilight / daylight
  const sun = T.sun, d17 = sun.jan17, d18 = sun.jan18;
  const night = '#1f2a44', band = (a: number, b: number, op: number) => (b > a ? `<rect x="${f1(X(Math.max(a, t0)))}" y="${AX}" width="${f1(X(Math.min(b, t1)) - X(Math.max(a, t0)))}" height="${f1(bottom - AX)}" fill="${night}" fill-opacity="${op}"/>` : '');
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
  const sunMark = (t: number, lab: string) => `<path d="M${f1(X(t))},${AX}V${f1(bottom)}" stroke="#d08a1e" stroke-width="2" stroke-dasharray="6 4"/><g transform="translate(${f1(X(t))} ${AX + 2})"><circle r="7" cy="0" fill="#f2a93b" stroke="#fff" stroke-width="2"/></g><text x="${f1(X(t))}" y="${f1(bottom + 20)}" text-anchor="middle" font-size="17" font-weight="700" fill="#a86a10" stroke="#fff" stroke-width="4" paint-order="stroke">${lab} ${clock(t, false)}</text>`;
  s += sunMark(d17.sunrise, 'sunrise') + sunMark(d17.sunset, 'sunset');
  // course rows
  
  order.forEach((k, r) => {
    const C = T.courses[k], maxOn = Math.max(...C.on_course), y0 = cTop + r * CR, base = y0 + CR - 8, hgt = CR - 16, cc = c.courses.colors[k], B = T.bin_min;
    let g = `<text x="0" y="${f1(y0 + 18)}" font-size="26" font-weight="700" fill="${cc}" dominant-baseline="central">${k}</text><text x="0" y="${f1(y0 + 40)}" font-size="15" fill="${col.mute}" dominant-baseline="central">~${C.expected_starters} runners</text>`;
    const pk = C.on_course.indexOf(maxOn), pkt = t0 + pk * T.bin_min;
    const pts = C.on_course.map((v: number, i: number) => [X(t0 + (i + 0.5) * B), base - (v / maxOn) * hgt]);
    g += `<path d="M${f1(X(t0))},${f1(base)}L${pts.map((p: number[]) => `${f1(p[0])},${f1(p[1])}`).join('L')}L${f1(X(t1))},${f1(base)}Z" fill="${cc}" fill-opacity=".28" stroke="${cc}" stroke-width="1.6" stroke-linejoin="round"/>`;
    g += `<path d="M${f1(X(C.start))},${f1(base)}H${f1(X(t1))}" stroke="${cc}" stroke-width="1" stroke-opacity=".5"/>`;
    g += `<text x="${f1(X(pkt + 30) + 6)}" y="${f1(base - 6)}" font-size="14" fill="${ink}" stroke="#fff" stroke-width="3" paint-order="stroke">peak ${maxOn} on course</text>`;
    // start flag
    g += `<path d="M${f1(X(C.start))},${f1(base)}V${f1(y0 + 4)}" stroke="${ink}" stroke-width="2"/><path d="M${f1(X(C.start))},${f1(y0 + 4)}h14l-4,5 4,5h-14z" fill="${ink}"/><text x="${f1(X(C.start) - 5)}" y="${f1(y0 + 12)}" font-size="17" font-weight="700" text-anchor="end" fill="${ink}" stroke="#fff" stroke-width="4" paint-order="stroke">${clock(C.start)}</text>`;
    // cutoffs (station number + time) and finish cutoff
    for (const q of C.passes) {
      const tm = cutMin(q.cutoff); if (tm == null || q.mile === 0) continue;
      const t = tm < C.start ? tm + 1440 : tm, x = X(t), fin = q === C.passes[C.passes.length - 1];
      g += `<path d="M${f1(x)},${f1(base + 2)}V${f1(base - hgt - 2)}" stroke="${fin ? ink : '#b3261e'}" stroke-width="${fin ? 3 : 2}"/>`;
      g += `<text x="${f1(x)}" y="${f1(base - hgt - 4)}" font-size="14" font-weight="700" text-anchor="middle" fill="${fin ? ink : '#b3261e'}" stroke="#fff" stroke-width="3" paint-order="stroke">${fin ? 'finish ' + clock(t) : q.station + ' ' + clock(t)}</text>`;
    }
    s += `<g class="tlrow" data-course="${k}">${g}</g>`;
  });
  // stations
  s += `<text x="0" y="${f1(sTop - 6)}" font-size="17" font-weight="700" fill="${ink}">Aid stations · open window · runners passing per 15 min (model; red = busy, ≥ half of that station's peak)</text>`;
    sts.forEach((k, r) => {
    const FC = T.finish_crowd, crowd = k === 'crowd', S = crowd ? { name: 'Finish area crowd', passes15: FC.present15, window: null, peak15: FC.peak15 } : T.stations[k], maxP = Math.max(...S.passes15), y0 = sTop + r * SR, base = y0 + SR - 6, hgt = SR - 12, B = T.bin_min;
    let g = `<text x="0" y="${f1(y0 + SR / 2)}" font-size="19" font-weight="700" fill="${ink}" dominant-baseline="central">${crowd ? '' : esc(k) + ' '}<tspan font-weight="400">${esc(S.name)}</tspan></text>`;
    if (S.window) g += `<rect x="${f1(X(S.window[0]))}" y="${f1(y0 + 3)}" width="${f1(X(S.window[1]) - X(S.window[0]))}" height="${f1(SR - 6)}" rx="5" fill="#f3efe7" stroke="#cfc6b6" stroke-width="1"/>`;
    S.passes15.forEach((v: number, i: number) => { if (!v) return; const h = Math.max(1.5, Math.sqrt(v / maxP) * hgt), x = X(t0 + i * B); g += `<rect x="${f1(x + 0.6)}" y="${f1(base - h)}" width="${f1(X(t0 + B) - X(t0) - 1.2)}" height="${f1(h)}" fill="${v >= 0.5 * maxP ? '#b3261e' : ink}" fill-opacity="${(0.3 + 0.7 * v / maxP).toFixed(2)}"/>`; });
    const pk = S.peak15, px = X(pk.start + B / 2);
    g += `<text x="${f1(Math.max(px, X(S.window ? S.window[0] : t0)) + 10)}" y="${f1(y0 + 14)}" font-size="15" font-weight="700" fill="#b3261e" stroke="#fff" stroke-width="4" paint-order="stroke">${crowd ? `peak ${pk.count} present @ ${clock(pk.start, false)} · ≥ ½ peak ${clock(FC.above_half_peak.from, false)}–${clock(FC.above_half_peak.to, false)} · finishers linger ~1 h` : `peak ${pk.count}/15 min @ ${clock(pk.start, false)}`}</text>`;
    s += `<g class="tlst" data-station="${esc(k)}">${g}</g>`;
  });
  s += `<text x="0" y="${f1(bottom + 40)}" font-size="13" fill="${col.mute}">Model from 2026 RunSignup results (fetched ${T.fetched.slice(0, 10)}); shading: night · civil twilight · day at ${T.sun.site.lat}°N ${-T.sun.site.lon}°W</text>`;
  s += `<g class="tlcursor" style="display:none;pointer-events:none"><path d="M0,${AX}V${f1(bottom)}" stroke="#111" stroke-width="1.5" stroke-dasharray="4 3"/><rect class="tlbox" fill="#fff" fill-opacity=".92" stroke="#bbb" rx="4"/><text class="tlread" font-size="17" font-weight="700"></text></g>`;
  return `<svg class="strips timeline" data-t0="${t0}" data-t1="${t1}" data-lx="${LX}" data-rx="${f1(RX)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Race-day timeline: runners on course and at aid stations by time of day">${s}</svg>`;
}
