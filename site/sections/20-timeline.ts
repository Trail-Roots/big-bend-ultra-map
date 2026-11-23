import { renderTimeline } from '../lib/timeline';
import { renderCalendar } from '../lib/calview';
import { renderParkingViewer, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';

import type { Ctx } from '../lib/types';
import { icon } from '../lib/icons';
// (history) Web: ONE section with a right-aligned view toggle (Race calendar = default | Race timeline | Race parking | Race finish); only the active
// view shows. The calendar view has a race filter (one race + universal events). Print: unchanged, this section prints only the race-day
// timeline page (always expanded); the calendar prints from the map section (page 3) and the plans from 36-finish / 37-parking.
export const meta = { id: 'timeline', title: 'Flow' };
export const VW_AR_D = 1.634, VW_AR_N = 0.703;
const NOTICES = `<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="infobox"><b>Only Bibbed Runners Allowed On Course</b></p>`;
/** race-day views in the map sheet's calendar slot (#pb-cal): Race calendar (default) or Flow, switched from the top nav.
 *  Venue is the parking map lightbox (#planbox), zoomable; the finish-area plan stays on its print page. The calendar follows the shared race selection. Web only except the
 *  calendar itself (its print grid is page 3). The web timeline is a copy (gradient ids suffixed); the print timeline page is this section. */
export function renderViews(c: Ctx) {
  // web copies sized to fill the views box exactly: 'd' (>560 px wide; box aspect 1.634, fixed by the sheet geometry) and 'n' (phones, portrait);
  // an inline script keeps only the one for this screen BEFORE app.js runs / first paint (no layout shift); ids suffixed, shared symbols untouched
  const copy = (sfx: string, opt: { w?: number; ar: number }) => { const t0 = renderTimeline(c, opt), own = new Set([...t0.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    return t0.replace(/id="([^"]+)"/g, `id="$1-${sfx}"`).replace(/url\(#([^)]+)\)/g, (m, id) => own.has(id) ? `url(#${id}-${sfx})` : m).replace(/href="#([^"]+)"/g, (m, id) => own.has(id) ? `href="#${id}-${sfx}"` : m); };
  const tlw = `<div class="vw-tlv vw-tl-d">${copy('wd', { ar: VW_AR_D })}</div><div class="vw-tlv vw-tl-n">${copy('wn', { w: 560, ar: VW_AR_N })}</div><script>(function(){var n=matchMedia('(max-width:560px)').matches,r=document.querySelector(n?'.vw-tl-d':'.vw-tl-n');r&&r.remove()})()</script>`;
  return `<div class="vw" data-view="cal">
  <div class="vw-pane vw-cal on" id="vw-cal">${renderCalendar(c)}</div>
  <div class="ui vw-pane vw-tl" id="vw-tl"><div class="vw-tlbox">${tlw}</div></div>
</div>
<dialog class="lightbox planbox" id="planbox" aria-label="Venue map"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body">
<div class="plan pl-site" data-plan="site">
<h3 class="pl-title">Venue map · Parking · Barton Warnock Visitor Center</h3>
${NOTICES}
<section class="pl-block" id="plan-parking">${renderParkingViewer()}${PARK_LEG()}</section>
</div></div></dialog>`;
}
const PARK_LEG = () => planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.gate(), 'Restricted entry gate'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories']]);
/** print-only race-day timeline page (always expanded); hidden on screen (the web shows the timeline in the map sheet's views) */
export function render(c: Ctx) {
  return `<div class="doc tlpage"><div class="tl-head"><h2>Flow</h2></div>
  <p class="note tl-note">Busiest times at each aid station (modelled per 15 min) and runners on course through race day.</p>
  <div class="tlbox" id="tl-body">${renderTimeline(c)}</div></div>`;
}
