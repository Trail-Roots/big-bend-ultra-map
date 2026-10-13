import { renderMain, mainLayers } from '../lib/mainmap';
import { renderMini, renderStrips, renderProfile } from '../lib/panels';
import { esc, SHEET } from '../lib/util';
export const meta = { path: 'index.html', title: 'Course & Access Map', nav: 'Map' };
import type { Ctx } from '../lib/types';
// Print = US Letter portrait, 2 pages: p1 the main map, p2 the side panel (header, mini maps, timelines, profile).
// Panels keep their 36x24 in design-sheet geometry (inches) and each page is uniformly zoomed to fit the printable area.
export const LETTER = { w: 8.5, h: 11, margin: 0.25 };
const PW = LETTER.w - 2 * LETTER.margin, PH = LETTER.h - 2 * LETTER.margin;
type Box = [number, number, number, number]; // sheet fractions [x0, y0 (from bottom), w, h]
const inch = (b: Box) => ({ l: b[0] * 36, t: (1 - b[1] - b[3]) * 24, w: b[2] * 36, h: b[3] * 24 });
const fit = (w: number, h: number) => Math.min(PW / w, PH / h);
export function render(c: Ctx) {
  const L = c.layout, hdr = L.header, st = L.strips;
  const toggles = mainLayers.map(([k, lab, on]) => `<label><input type="checkbox" data-layer="${k}"${on ? ' checked' : ''}> ${lab}</label>`).join('')
    + `<label><input type="checkbox" data-dist checked> Distances</label>`
    + `<span class="sub">${c.courses.order.map(k => `<label class="ck" style="--c:${c.courses.colors[k]}"><input type="checkbox" data-course="${k}" checked> ${k}</label>`).join('')}</span>`;
  const minis = c.courses.order.map(k => `<figure class="minibox" id="pb-m${k}">${renderMini(c, k)}</figure>`).join('');
  const stripBox = [st.rx, st.top - 5 * st.rh, st.w, 5 * st.rh];
  const evb = L.elev, evBox = [evb[0], evb[1] - 40 / SHEET.h, evb[2], evb[3] + 40 / SHEET.h];
  const notice = hdr[2].text.split('\n');
  const mainIn = inch(L.views.main.fig), z1 = fit(mainIn.w, mainIn.h);
  const side: [string, Box][] = [['pb-hdr', [L.logo[0], L.logo[1], 0.51, L.logo[3]]], ...c.courses.order.map((k) => [`pb-m${k}`, L.views[k].fig] as [string, Box]), ['pb-strips', stripBox as Box], ['pb-prof', evBox as Box]];
  const si = side.map(([id, b]) => [id, inch(b)] as const), ox = Math.min(...si.map(([, b]) => b.l)), oy = Math.min(...si.map(([, b]) => b.t));
  const sw = Math.max(...si.map(([, b]) => b.l + b.w)) - ox, sh = Math.max(...si.map(([, b]) => b.t + b.h)) - oy + 0.5, z2 = fit(sw, sh);
  const px = (b: { l: number; t: number; w: number; h: number }) => `{left:${(b.l - ox).toFixed(3)}in;top:${(b.t - oy).toFixed(3)}in;width:${b.w.toFixed(3)}in;height:${b.h.toFixed(3)}in}`;
  const css = `@media print{#pb-main{width:${mainIn.w.toFixed(3)}in;height:${mainIn.h.toFixed(3)}in;zoom:${z1.toFixed(4)}}`
    + `.side{width:${sw.toFixed(3)}in;height:${sh.toFixed(3)}in;zoom:${z2.toFixed(4)}}${si.map(([id, b]) => `#${id}${px(b)}`).join('')}}`;
  return `<style>${css}</style>
<details class="ui layers" open><summary>Map layers</summary><div class="toggles">${toggles}</div></details>
<div class="sheet">
  <section class="main" id="pb-main">${renderMain(c)}</section>
  <aside class="side">
    <header class="hdr" id="pb-hdr">
      <a class="logo" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><img src="logo_ink_crop.png" alt="Trail Roots Running – Big Bend Ultra"></a>
      <div class="titles"><h1>${esc(hdr[0].text)}</h1><p class="subtitle">${esc(hdr[1].text)}</p></div>
      <div class="notice"><strong>${esc(notice[0])}</strong>${notice.slice(1).map(l => `<br>${esc(l)}`).join('')}</div>
    </header>
    <div class="minis">${minis}</div>
    <div class="stripsbox" id="pb-strips">${renderStrips(c)}</div>
    <div class="profilebox" id="pb-prof">${renderProfile(c)}</div>
    <div class="printfoot">trailroots.com/big-bend-ultra</div>
  </aside>
  <a class="footlink" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener">trailroots.com/big-bend-ultra</a>
</div>`;
}
