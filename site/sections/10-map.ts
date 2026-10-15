import { renderMain, mainLayers } from '../lib/mainmap';
import { renderProfile } from '../lib/panels';
import { esc, SHEET } from '../lib/util';
export const meta = { id: 'map', title: 'Course & Access Map' };
import type { Ctx } from '../lib/types';
import { hoverData } from '../lib/hover';
import { renderTimeline } from '../lib/timeline';
// Print = one US Letter landscape page: main map (left half) + header, timeline / heat map and elevation (right half). Mini maps live on the course pages.
// Panels keep their 36x24 in design-sheet geometry (inches) and each page is uniformly zoomed to fit the printable area.
/** live site; links in the PDF must be absolute */
export const SITE_URL = 'https://trail-roots.github.io/big-bend-ultra-map/';
export const LETTER = { w: 8.5, h: 11, margin: 0.28 };
type Box = [number, number, number, number]; // sheet fractions [x0, y0 (from bottom), w, h]
const inch = (b: Box) => ({ l: b[0] * 36, t: (1 - b[1] - b[3]) * 24, w: b[2] * 36, h: b[3] * 24 });
/** best letter orientation for a w x h in block: largest uniform zoom inside equal 0.28in margins, centred */
function place(w: number, h: number, force?: 'portrait' | 'landscape') {
  const opt = (pw: number, ph: number, orient: string) => { const W = pw - 2 * LETTER.margin, H = ph - 2 * LETTER.margin, z = Math.min(W / w, H / h); return { z, orient, mx: (W - w * z) / 2, my: (H - h * z) / 2 }; };
  const a = opt(LETTER.w, LETTER.h, 'portrait'), b = opt(LETTER.h, LETTER.w, 'landscape');
  return force ? (force === 'portrait' ? a : b) : a.z >= b.z ? a : b;
}
export function render(c: Ctx) {
  const L = c.layout, hdr = L.header, st = L.strips;
  const toggles = mainLayers.map(([k, lab, on]) => `<label><input type="checkbox" data-layer="${k}"${on ? ' checked' : ''}> ${lab}</label>`).join('');
  const stripBox = [st.rx, st.top - 5 * st.rh, st.w, 5 * st.rh];
  const evb = L.elev, evBox = [evb[0], evb[1] - 40 / SHEET.h, evb[2], evb[3] + 40 / SHEET.h];
  const notice = hdr[2].text.split('\n');
  const mainIn = inch(L.views.main.fig);
  // one landscape letter page, split ~50/50: main map left half; right half = header, timeline / heat map, elevation (charts drawn larger: scale K)
  const strIn = inch(stripBox as Box), evIn = inch(evBox as Box), hdIn = inch([L.logo[0], L.logo[1], st.w, L.logo[3]] as Box);
  const GAPIN = 0.2, HALF = (LETTER.h - 2 * LETTER.margin - GAPIN) / 2, Z = Math.min(HALF / mainIn.w, (LETTER.w - 2 * LETTER.margin) / mainIn.h);
  const K = mainIn.w / strIn.w, cx0 = mainIn.w + GAPIN / Z, colH = K * (hdIn.h + 0.25 + (evIn.t - strIn.t) + evIn.h), c0 = Math.max(0, (mainIn.h - colH) / 2);
  const p1: [string, { l: number; t: number; w: number; h: number }][] = [['pb-main', { l: 0, t: 0, w: mainIn.w, h: mainIn.h }],
    ['pb-hdr', { l: cx0, t: c0, w: K * hdIn.w, h: K * hdIn.h }],
    ['pb-strips', { l: cx0, t: c0 + K * (hdIn.h + 0.25), w: K * strIn.w, h: K * strIn.h }], ['pb-prof', { l: cx0, t: c0 + K * (hdIn.h + 0.25 + evIn.t - strIn.t), w: K * evIn.w, h: K * evIn.h }]];
  const w1 = Math.max(...p1.map(([, q]) => q.l + q.w)), h1 = mainIn.h;
  const P1 = { ...place(w1, h1, 'landscape') };
  const px = (b: { l: number; t: number; w: number; h: number }, x0 = 0, y0 = 0) => `{left:${(b.l - x0).toFixed(3)}in;top:${(b.t - y0).toFixed(3)}in;width:${b.w.toFixed(3)}in;height:${b.h.toFixed(3)}in}`;
  // the header is HTML laid out in sheet inches: zoom it by K (zoom also scales its own box, so its box is given unscaled)
  const hdrCss = (q: { l: number; t: number; w: number; h: number }) => `{left:${(q.l / K).toFixed(3)}in;top:${(q.t / K).toFixed(3)}in;width:${(q.w / K).toFixed(3)}in;height:${(q.h / K).toFixed(3)}in;zoom:${K.toFixed(4)}}`;
  // margins inside a zoomed box are zoomed too, so divide the centring offsets by z
  const pg = (sel: string, name: string, w: number, h: number, P: ReturnType<typeof place>) => `@page ${name}{size:letter ${P.orient};margin:${LETTER.margin}in}`
    + `@media print{${sel}{page:${name};width:${w.toFixed(3)}in;height:${h.toFixed(3)}in;zoom:${P.z.toFixed(4)};margin:${(P.my / P.z).toFixed(4)}in ${(P.mx / P.z).toFixed(4)}in!important}}`;
  // screen paper view: the same page-1 geometry in % of the 11 x 8.5 in sheet (margins included), so the screen sheet mirrors the PDF page
  const M = LETTER.margin, pct = (q: { l: number; t: number; w: number; h: number }) => `{left:${((M + P1.mx + q.l * P1.z) / LETTER.h * 100).toFixed(3)}%;top:${((M + P1.my + q.t * P1.z) / LETTER.w * 100).toFixed(3)}%;width:${(q.w * P1.z / LETTER.h * 100).toFixed(3)}%;height:${(q.h * P1.z / LETTER.w * 100).toFixed(3)}%}`;
  const css = pg('.pg1', 'pmain', w1, h1, P1) + `@media print{${p1.map(([id, q]) => `#${id}${id === 'pb-hdr' ? hdrCss(q) : px(q)}`).join('')}}`
    + `@media screen and (min-width:1100px){${p1.map(([id, q]) => `html:not(.embed) #${id}${pct(q)}`).join('')}}`;
  return `<style>${css}</style>
<details class="ui layers" open><summary>Map layers</summary><div class="toggles">${toggles}</div></details>
<div class="sheet">
  <div class="pg1">
  <section class="main" id="pb-main">${renderMain(c)}</section>
  <div class="charts">
    <header class="hdr" id="pb-hdr">
      <a class="logo" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><img src="logo_ink_crop.png" alt="Trail Roots Running – Big Bend Ultra"></a>
      <div class="titles"><h1>${esc(hdr[0].text)}</h1><p class="subtitle">${esc(hdr[1].text)}</p></div>
      <div class="notice"><strong>${esc(notice[0])}</strong>${notice.slice(1).map(l => `<br>${/^\(\d/.test(l) ? `<span class="dist">${esc(l)}</span>` : esc(l)}`).join('')}</div>
    </header>
    <div class="stripsbox" id="pb-strips">${renderTimeline(c)}<div class="minilinks callinks"><span class="calnote">Save race day to your phone (times + GPS, works offline):</span><a href="https://calendar.google.com/calendar/u/0?cid=Njc1ZWZhYmI1ZmY0MDE1OTZlNDk5Mzg5YWRiNzdiZTU4YTUxODhkMWFkOTc1MjE1MzgxZDUzNjI1OWVlMTU0NkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t" target="_blank" rel="noopener" title="Subscribe to the Race: Big Bend Ultra Google Calendar"><span class="calico" aria-hidden="true">+</span>Google Calendar</a><a href="webcal://calendar.google.com/calendar/ical/675efabb5ff401596e499389adb77be58a5188d1ad975215381d536259ee1546%40group.calendar.google.com/public/basic.ics" title="Subscribe in Apple / iCal (public calendar feed)">iCal / Apple</a></div></div>
    <div class="profilebox" id="pb-prof">${renderProfile(c)}</div>
  </div>
  </div>
  <script type="application/json" id="hoverdata">${JSON.stringify(hoverData(c))}</script>
</div>`;
}
