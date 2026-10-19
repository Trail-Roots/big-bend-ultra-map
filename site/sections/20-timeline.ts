import { renderTimeline } from '../lib/timeline';
import type { Ctx } from '../lib/types';
// Race-day timeline: busiest times at the aid stations (heat map) + runners on course (stacked chart). Its own section:
// collapsible on the web (neutral disclosure, expanded by default), always expanded in print (one landscape letter page).
export const meta = { id: 'timeline', title: 'Race-day timeline' };
export function render(c: Ctx) {
  return `<div class="doc tlpage">
  <div class="tl-head"><h2>Race-day timeline</h2><button type="button" class="tl-toggle ui" aria-expanded="true" aria-controls="tl-body"><span class="tl-chev" aria-hidden="true"></span><span class="tl-lab">Hide</span></button></div>
  <p class="note tl-note">Busiest times at each aid station (modelled per 15 min) and runners on course through race day.</p>
  <div class="tlbox" id="tl-body">${renderTimeline(c)}</div>
</div>`;
}
