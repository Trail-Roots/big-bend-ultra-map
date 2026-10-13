import { renderMain, mainLayers } from '../lib/mainmap.mjs';
import { renderMini, renderStrips, renderProfile } from '../lib/panels.mjs';
import { esc, SHEET } from '../lib/util.mjs';
export const meta = { path: 'index.html', title: 'Course & Access Map', nav: 'Map' };
// sheet fraction box -> absolute print placement (inches, from top-left of the 36x24 sheet)
const box = b => `{left:${(b[0] * 36).toFixed(3)}in;top:${((1 - b[1] - b[3]) * 24).toFixed(3)}in;width:${(b[2] * 36).toFixed(3)}in;height:${(b[3] * 24).toFixed(3)}in}`;
export function render(c) {
  const L = c.layout, hdr = L.header, st = L.strips;
  const toggles = mainLayers.map(([k, lab, on]) => `<label><input type="checkbox" data-layer="${k}"${on ? ' checked' : ''}> ${lab}</label>`).join('')
    + `<span class="sub">${c.courses.order.map(k => `<label class="ck" style="--c:${c.courses.colors[k]}"><input type="checkbox" data-course="${k}" checked> ${k}</label>`).join('')}</span>`;
  const minis = c.courses.order.map(k => `<figure class="minibox" id="pb-m${k}">${renderMini(c, k)}</figure>`).join('');
  const stripBox = [st.rx, st.top - 5 * st.rh, st.w, 5 * st.rh];
  const evb = L.elev, evBox = [evb[0], evb[1] - 40 / SHEET.h, evb[2], evb[3] + 40 / SHEET.h];
  const notice = hdr[2].text.split('\n');
  const css = `@media print{#pb-main${box(L.views.main.fig)}#pb-hdr${box([L.logo[0], L.logo[1], 0.51, L.logo[3]])}${c.courses.order.map(k => `#pb-m${k}${box(L.views[k].fig)}`).join('')}#pb-strips${box(stripBox)}#pb-prof${box(evBox)}}`;
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
  </aside>
  <a class="footlink" href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener">trailroots.com/big-bend-ultra</a>
</div>`;
}
