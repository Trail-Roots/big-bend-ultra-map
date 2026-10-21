import { renderMain, mainLayers } from '../lib/mainmap';
import { renderProfile } from '../lib/panels';
import { icon } from '../lib/icons';
import { esc, SHEET } from '../lib/util';
export const meta = { id: 'map', title: 'Course & Access Map' };
import type { Ctx } from '../lib/types';
import { hoverData } from '../lib/hover';
import { TEMP_AVG } from '../lib/timeline';
import { renderViews } from './20-timeline';
// Print: page 1 = main map only; page 2 = header (course access notice) + elevation profile; page 3 = race-day calendar (portrait, full race day).
// The timeline / heat map is its own section (20-timeline.ts). Screen paper view keeps map | header, elevation, calendar on one landscape sheet.
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
/** navbar "Layers" button: map layer toggles + race filter in one dropdown panel (build.ts puts it in the sticky navbar) */
export function layersNav(c: Ctx) {
  const toggles = mainLayers.map(([k, lab, on]) => `<label><input type="checkbox" data-layer="${k}"${on ? ' checked' : ''}> ${lab}</label>`).join('');
  return `<details class="ui layers navlayers"><summary>${icon('layers')}Layers</summary><div class="lpanel"><div class="toggles">${toggles}</div><div class="toggles racefilter" role="group" aria-label="Show races"><span class="rf-lab">Races</span><label class="ck rf-all"><input type="checkbox" data-race-all checked> All</label>${c.courses.order.map((k) => `<label class="ck" style="--c:${c.courses.colors[k]}"><input type="checkbox" data-race="${k}"> ${k}</label>`).join('')}</div></div></details>`;
}
export function render(c: Ctx) {
  const L = c.layout, hdr = L.header, st = L.strips;
  const stripBox = [st.rx, st.top - 5 * st.rh, st.w, 5 * st.rh];
  const evb = L.elev, evBox = [evb[0], evb[1] - 40 / SHEET.h, evb[2], evb[3] + 40 / SHEET.h];
  const notice = hdr[2].text.split('\n');
  const mainIn = inch(L.views.main.fig);
  // one landscape letter page, split ~50/50: main map left half; right half = header, timeline / heat map, elevation (charts drawn larger: scale K)
  const strIn = inch(stripBox as Box), evIn = inch(evBox as Box), hdIn = inch([L.logo[0], L.logo[1], st.w, L.logo[3]] as Box);
  const GAPIN = 0.2, HALF = (LETTER.h - 2 * LETTER.margin - GAPIN) / 2, Z = Math.min(HALF / mainIn.w, (LETTER.w - 2 * LETTER.margin) / mainIn.h);
  const K = mainIn.w / strIn.w, cx0 = mainIn.w + GAPIN / Z, GS = 0.15, CALH = 0.45, colH = K * (hdIn.h + 0.25 + evIn.h + GS + strIn.h + CALH), c0 = Math.max(0, (mainIn.h - colH) / 2);
  const p1: [string, { l: number; t: number; w: number; h: number }][] = [['pb-main', { l: 0, t: 0, w: mainIn.w, h: mainIn.h }],
    ['pb-hdr', { l: cx0, t: c0, w: K * hdIn.w, h: K * hdIn.h }],
    ['pb-prof', { l: cx0, t: c0 + K * (hdIn.h + 0.25), w: K * evIn.w, h: K * evIn.h }], ['pb-cal', { l: cx0, t: c0 + K * (hdIn.h + 0.25 + evIn.h + GS), w: K * strIn.w, h: K * strIn.h }]]; // screen: elevation above the race-day calendar; subscribe row below it (CALH)
  const w1 = Math.max(...p1.map(([, q]) => q.l + q.w)), h1 = mainIn.h;
  const P1 = { ...place(w1, h1, 'landscape') }; // screen paper-view geometry (unchanged sheet)
  // print: map alone (best orientation), then header + elevation on their own page
  const PM = place(mainIn.w, mainIn.h), hq = p1[1][1], pq = p1[2][1], ox = hq.l, oy = hq.t;
  const q2: [string, typeof hq][] = [['pb-hdr', { ...hq, l: 0, t: 0 }], ['pb-prof', { ...pq, l: pq.l - ox, t: pq.t - oy }]];
  const w2 = Math.max(...q2.map(([, q]) => q.l + q.w)), h2 = Math.max(...q2.map(([, q]) => q.t + q.h)), P2 = place(w2, h2);
  // DRAFT watermark inside a zoomed page box: undo the zoom and the centring margins so it spans the printable area
  const wm = (sel: string, P: ReturnType<typeof place>) => { const pw = (P.orient === 'portrait' ? LETTER.w : LETTER.h) - 2 * LETTER.margin, ph = (P.orient === 'portrait' ? LETTER.h : LETTER.w) - 2 * LETTER.margin; return `html body ${sel}::after{left:${(-P.mx / P.z).toFixed(4)}in;top:${(-P.my / P.z).toFixed(4)}in;width:${(pw / P.z).toFixed(4)}in!important;height:${(ph / P.z).toFixed(4)}in!important}`; };
  const px = (b: { l: number; t: number; w: number; h: number }, x0 = 0, y0 = 0) => `{left:${(b.l - x0).toFixed(3)}in;top:${(b.t - y0).toFixed(3)}in;width:${b.w.toFixed(3)}in;height:${b.h.toFixed(3)}in}`;
  // the header is HTML laid out in sheet inches: zoom it by K (zoom also scales its own box, so its box is given unscaled)
  const hdrCss = (q: { l: number; t: number; w: number; h: number }) => `{left:${(q.l / K).toFixed(3)}in;top:${(q.t / K).toFixed(3)}in;width:${(q.w / K).toFixed(3)}in;height:${(q.h / K).toFixed(3)}in;zoom:${K.toFixed(4)}}`;
  // margins inside a zoomed box are zoomed too, so divide the centring offsets by z
  const pg = (sel: string, name: string, w: number, h: number, P: ReturnType<typeof place>) => `@page ${name}{size:letter ${P.orient};margin:${LETTER.margin}in}`
    + `@media print{${sel}{page:${name};width:${w.toFixed(3)}in;height:${h.toFixed(3)}in;zoom:${P.z.toFixed(4)};margin:${(P.my / P.z).toFixed(4)}in ${(P.mx / P.z).toFixed(4)}in!important}}`;
  // screen paper view: the same page-1 geometry in % of the 11 x 8.5 in sheet (margins included), so the screen sheet mirrors the PDF page
  const M = LETTER.margin, pct = (q: { l: number; t: number; w: number; h: number }) => `{left:${((M + P1.mx + q.l * P1.z) / LETTER.h * 100).toFixed(3)}%;top:${((M + P1.my + q.t * P1.z) / LETTER.w * 100).toFixed(3)}%;width:${(q.w * P1.z / LETTER.h * 100).toFixed(3)}%;height:${(q.h * P1.z / LETTER.w * 100).toFixed(3)}%}`;
  const css = pg('.sec-map #pb-main', 'pmain', mainIn.w, mainIn.h, PM) + pg('.sec-map .charts', 'pacc', w2, h2, P2) + `@media print{${q2.map(([id, q]) => `#${id}${id === 'pb-hdr' ? hdrCss(q) : px(q)}`).join('')}${wm('.sec-map #pb-main', PM)}${wm('.sec-map .charts', P2)}}`
    + `@media screen and (min-width:1100px){${p1.map(([id, q]) => `html #${id}${pct(q)}`).join('')}}`;
  return `<style>${css}</style>

<div class="sheet">
  <div class="pg1">
  <section class="main" id="pb-main">${renderMain(c)}</section>
  <div class="charts">
    <header class="hdr" id="pb-hdr">
      <a class="logo" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><img src="logo_ink_crop.png" alt="Trail Roots Running – Big Bend Ultra"></a>
      <div class="titles"><h1>${esc(hdr[0].text)}</h1><p class="subtitle">${esc(hdr[1].text)}</p><!--regprint--></div>
      <div class="notice"><strong>${esc(notice[0])}</strong>${notice.slice(1).map(l => `<br>${/^\(\d/.test(l) ? `<span class="dist">${esc(l)}</span>` : esc(l)}`).join('')}</div>
    </header>
    <div class="profilebox" id="pb-prof">${renderProfile(c)}</div>
  </div>
    <div class="calbox" id="pb-cal">${renderViews(c)}</div>
  </div>
  <script type="application/json" id="hoverdata">${JSON.stringify(hoverData(c))}</script><script type="application/json" id="heatdata">${JSON.stringify(Object.fromEntries(c.stations.order.map((k) => [k, k === 'S/F' ? c.timeline.finish_crowd.by_course15 : c.timeline.stations[k].by_course15])))}</script><script type="application/json" id="tempdata">${JSON.stringify({ s: TEMP_AVG })}</script>
</div>`;
}

