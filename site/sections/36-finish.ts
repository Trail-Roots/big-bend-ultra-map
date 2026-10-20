// Finish-area floor plan (letter page): Erik's drawing sources/floorplan.svg at the finish-area zoom; see site/lib/floorplan-svg.ts
// Web: ONE floor-plan viewer (finish + parking, pan / zoom, Finish line / Full view buttons, merged legend); print keeps the two plan pages
// (this page = finish area, 37-parking.ts = parking; the parking section is print-only).
import { renderFinishPlan, renderPlanViewer, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
import { renderIdleHeat } from '../lib/timeline';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
export function render(c) {
  return `<article class="doc plan"><h2 class="fp-print">Finish area · Barton Warnock Visitor Center</h2><h2 class="fp-web">Floor plan · Barton Warnock Visitor Center</h2>
<div class="fp-print">${renderFinishPlan()}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.noParkZone(), 'No parking zone']])}</div>
<div class="fp-web">${renderPlanViewer()}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking']])}
<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="infobox"><b>Only Bibbed Runners Allowed On Course</b></p></div>
<figure class="idlebox"><figcaption>Runners off course at the start / finish (waiting to start or finished) · modelled: arrive 15–75 min before their start, stay 1–2 h after finishing</figcaption>${renderIdleHeat(c)}</figure></article>`;
}
