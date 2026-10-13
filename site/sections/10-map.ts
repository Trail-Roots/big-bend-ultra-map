import { renderMain, mainLayers } from '../lib/mainmap';
import { renderMini, renderProfile } from '../lib/panels';
import { esc, SHEET } from '../lib/util';
export const meta = { id: 'map', title: 'Course & Access Map' };
import type { Ctx } from '../lib/types';
import { hoverData } from '../lib/hover';
import { renderTimeline } from '../lib/timeline';
// Print = US Letter portrait, 2 pages: p1 the main map, p2 the side panel (header, mini maps, timelines, profile).
// Panels keep their 36x24 in design-sheet geometry (inches) and each page is uniformly zoomed to fit the printable area.
/** live site; links in the PDF must be absolute */
export const SITE_URL = 'https://trail-roots.github.io/big-bend-ultra-map/';
export const LETTER = { w: 8.5, h: 11, margin: 0.4 };
type Box = [number, number, number, number]; // sheet fractions [x0, y0 (from bottom), w, h]
const inch = (b: Box) => ({ l: b[0] * 36, t: (1 - b[1] - b[3]) * 24, w: b[2] * 36, h: b[3] * 24 });
/** best letter orientation for a w x h in block: largest uniform zoom inside equal 0.4in margins, centred */
function place(w: number, h: number) {
  const opt = (pw: number, ph: number, orient: string) => { const W = pw - 2 * LETTER.margin, H = ph - 2 * LETTER.margin, z = Math.min(W / w, H / h); return { z, orient, mx: (W - w * z) / 2, my: (H - h * z) / 2 }; };
  const a = opt(LETTER.w, LETTER.h, 'portrait'), b = opt(LETTER.h, LETTER.w, 'landscape');
  return a.z >= b.z ? a : b;
}
export function render(c: Ctx) {
  const L = c.layout, hdr = L.header, st = L.strips;
  const toggles = mainLayers.map(([k, lab, on]) => `<label><input type="checkbox" data-layer="${k}"${on ? ' checked' : ''}> ${lab}</label>`).join('')
    + `<span class="sub">${c.courses.order.map(k => `<label class="ck" style="--c:${c.courses.colors[k]}"><input type="checkbox" data-course="${k}" checked> ${k}</label>`).join('')}</span>`;
  const minis = c.courses.order.map(k => `<figure class="minibox" id="pb-m${k}">${renderMini(c, k)}<figcaption class="minilinks">${c.courses.courses[k].stravaUrl ? `<a href="${esc(c.courses.courses[k].stravaUrl)}" target="_blank" rel="noopener" title="${k} route on Strava">Strava</a>` : ''}<a href="${SITE_URL}${esc(c.courses.courses[k].gpx)}" download title="Download the ${k} GPX"><svg class="dlico" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1v5.2M2.6 4.2 5 6.6l2.4-2.4M1.5 8.6h7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>.GPX</a></figcaption></figure>`).join('');
  const stripBox = [st.rx, st.top - 5 * st.rh, st.w, 5 * st.rh];
  const evb = L.elev, evBox = [evb[0], evb[1] - 40 / SHEET.h, evb[2], evb[3] + 40 / SHEET.h];
  const notice = hdr[2].text.split('\n');
  const mainIn = inch(L.views.main.fig);
  const side: [string, Box][] = [['pb-hdr', [L.logo[0], L.logo[1], 0.51, L.logo[3]]], ...c.courses.order.map((k) => [`pb-m${k}`, L.views[k].fig] as [string, Box]), ['pb-strips', stripBox as Box], ['pb-prof', evBox as Box]];
  const si = side.map(([id, b]) => [id, inch(b)] as const), ox = Math.min(...si.map(([, b]) => b.l)), oy = Math.min(...si.map(([, b]) => b.t));
  const sw = Math.max(...si.map(([, b]) => b.l + b.w)) - ox, sh = Math.max(...si.map(([, b]) => b.t + b.h)) - oy + 0.5;
  const P1 = place(mainIn.w, mainIn.h), P2 = place(sw, sh); // each page fitted on its own
  const px = (b: { l: number; t: number; w: number; h: number }) => `{left:${(b.l - ox).toFixed(3)}in;top:${(b.t - oy).toFixed(3)}in;width:${b.w.toFixed(3)}in;height:${b.h.toFixed(3)}in}`;
  // margins inside a zoomed box are zoomed too, so divide the centring offsets by z
  const pg = (sel: string, name: string, w: number, h: number, P: ReturnType<typeof place>) => `@page ${name}{size:letter ${P.orient};margin:${LETTER.margin}in}`
    + `@media print{${sel}{page:${name};width:${w.toFixed(3)}in;height:${h.toFixed(3)}in;zoom:${P.z.toFixed(4)};margin:${(P.my / P.z).toFixed(4)}in ${(P.mx / P.z).toFixed(4)}in!important}}`;
  const css = pg('#pb-main', 'pmain', mainIn.w, mainIn.h, P1) + pg('.side', 'pside', sw, sh, P2) + `@media print{${si.map(([id, b]) => `#${id}${px(b)}`).join('')}}`;
  return `<style>${css}</style>
<details class="ui layers" open><summary>Map layers</summary><div class="toggles">${toggles}</div></details>
<div class="sheet">
  <section class="main" id="pb-main">${renderMain(c)}</section>
  <aside class="side">
    <header class="hdr" id="pb-hdr">
      <a class="logo" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><img src="logo_ink_crop.png" alt="Trail Roots Running – Big Bend Ultra"></a>
      <div class="titles"><h1>${esc(hdr[0].text)}</h1><p class="subtitle">${esc(hdr[1].text)}</p></div>
      <div class="notice"><strong>${esc(notice[0])}</strong>${notice.slice(1).map(l => `<br>${/^\(\d/.test(l) ? `<span class="dist">${esc(l)}</span>` : esc(l)}`).join('')}</div>
    </header>
    <div class="minis">${minis}</div>
    <div class="stripsbox" id="pb-strips">${renderTimeline(c)}</div>
    <div class="profilebox" id="pb-prof">${renderProfile(c)}</div>
    <div class="printfoot">trailroots.com/big-bend-ultra</div>
  </aside>
  <script type="application/json" id="hoverdata">${JSON.stringify(hoverData(c))}</script>
  <a class="footlink" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener">trailroots.com/big-bend-ultra</a>
</div>`;
}
