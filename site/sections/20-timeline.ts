import { renderTimeline, renderIdleHeat } from '../lib/timeline';
import { renderCalendar } from '../lib/calview';
import { renderParkingViewer, renderFinishViewer, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';

import type { Ctx } from '../lib/types';
import { icon } from '../lib/icons';
// (history) Web: ONE section with a right-aligned view toggle (Race calendar = default | Race timeline | Race parking | Race finish); only the active
// view shows. The calendar view has a race filter (one race + universal events). Print: unchanged, this section prints only the race-day
// timeline page (always expanded); the calendar prints from the map section (page 3) and the plans from 36-finish / 37-parking.
export const meta = { id: 'timeline', title: 'Operations' };
export const VW_AR_D = 1.634, VW_AR_N = 0.703;
const VIEWS: [string, string][] = [['cal', 'Race calendar'], ['tl', 'Operations']];
const NOTICES = `<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="infobox"><b>Only Bibbed Runners Allowed On Course</b></p>`;
/** race-day views, rendered INSIDE the map sheet's calendar slot (#pb-cal, under the elevation chart): right-aligned tabs (Race calendar = default |
 *  Operations), Parking / Finish buttons; the calendar follows the shared race selection (elevation legend / Layers races); plan previews open the plan lightbox (#planbox). Web only except the
 *  calendar itself (its print grid is page 3). The web timeline is a copy (gradient ids suffixed); the print timeline page is this section. */
export function renderViews(c: Ctx) {
  const tabs = `<div class="ui vw-tabs" role="tablist" aria-label="Race day views">${VIEWS.map(([k, t], i) => `<button type="button" role="tab" class="vw-tab" id="vw-tab-${k}" data-view="${k}" aria-controls="vw-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join('')}</div>`;
  // web copies sized to fill the views box exactly: 'd' (>560 px wide; box aspect 1.634, fixed by the sheet geometry) and 'n' (phones, portrait);
  // an inline script keeps only the one for this screen BEFORE app.js runs / first paint (no layout shift); ids suffixed, shared symbols untouched
  const copy = (sfx: string, opt: { w?: number; ar: number }) => { const t0 = renderTimeline(c, opt), own = new Set([...t0.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    return t0.replace(/id="([^"]+)"/g, `id="$1-${sfx}"`).replace(/url\(#([^)]+)\)/g, (m, id) => own.has(id) ? `url(#${id}-${sfx})` : m).replace(/href="#([^"]+)"/g, (m, id) => own.has(id) ? `href="#${id}-${sfx}"` : m); };
  const tlw = `<div class="vw-tlv vw-tl-d">${copy('wd', { ar: VW_AR_D })}</div><div class="vw-tlv vw-tl-n">${copy('wn', { w: 560, ar: VW_AR_N })}</div><script>(function(){var n=matchMedia('(max-width:560px)').matches,r=document.querySelector(n?'.vw-tl-d':'.vw-tl-n');r&&r.remove()})()</script>`;
  const plans = `<div class="ui vw-plans"><button type="button" class="vw-plan" data-open-plan="park" aria-label="Open the parking plan full screen">${icon('expand')}Parking</button><button type="button" class="vw-plan" data-open-plan="fin" aria-label="Open the finish area plan full screen">${icon('expand')}Finish</button></div>`;
  return `<div class="vw" data-view="cal"><div class="ui vw-bar">${plans}${tabs}</div>
  <div class="vw-pane vw-cal on" id="vw-cal" role="tabpanel" aria-labelledby="vw-tab-cal">${renderCalendar(c)}${CAL_LINKS}</div>
  <div class="ui vw-pane vw-tl" id="vw-tl" role="tabpanel" aria-labelledby="vw-tab-tl"><div class="vw-tlbox">${tlw}</div></div>
</div>
<dialog class="lightbox planbox" id="planbox" aria-label="Site plan"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body">
<div class="plan pl-one" data-plan="park"><h3>Parking · Barton Warnock Visitor Center</h3>${renderParkingViewer()}${PARK_LEG()}${NOTICES}</div>
<div class="plan pl-one" data-plan="fin" hidden><h3>Finish area · Barton Warnock Visitor Center</h3>${renderFinishViewer()}${FIN_LEG()}${NOTICES}
<figure class="idlebox"><figcaption>Runners off course at the start / finish (waiting to start or finished) · modelled: arrive 15–75 min before their start, stay 1–2 h after finishing</figcaption>${renderIdleHeat(c)}</figure></div></div></dialog>`;
}
const PARK_LEG = () => planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.gate(), 'Restricted entry gate'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories']]);
const FIN_LEG = () => planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.noParkZone(), 'No parking zone']]);
/** print-only race-day timeline page (always expanded); hidden on screen (the web shows the timeline in the map sheet's views) */
export function render(c: Ctx) {
  return `<div class="doc tlpage"><div class="tl-head"><h2>Operations</h2></div>
  <p class="note tl-note">Busiest times at each aid station (modelled per 15 min) and runners on course through race day.</p>
  <div class="tlbox" id="tl-body">${renderTimeline(c)}</div></div>`;
}
export const CAL_LINKS = `<div class="minilinks callinks"><span class="calnote">Save the race calendar to your phone (works offline):</span><a href="https://calendar.google.com/calendar/u/0?cid=Njc1ZWZhYmI1ZmY0MDE1OTZlNDk5Mzg5YWRiNzdiZTU4YTUxODhkMWFkOTc1MjE1MzgxZDUzNjI1OWVlMTU0NkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t" target="_blank" rel="noopener" title="Subscribe to the Race: Big Bend Ultra Google Calendar">${icon('calendar')}Google Calendar</a><a href="webcal://calendar.google.com/calendar/ical/675efabb5ff401596e499389adb77be58a5188d1ad975215381d536259ee1546%40group.calendar.google.com/public/basic.ics" title="Subscribe in Apple / iCal (public calendar feed)">${icon('calendar')}Apple Calendar .ical</a></div>`;
