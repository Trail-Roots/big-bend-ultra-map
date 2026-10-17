// Parking plan (letter page): Erik's drawing sources/floorplan.svg at the full parking-stretch zoom; see site/lib/floorplan-svg.ts
import { renderParkingPlan, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'parking-plan', title: 'Parking plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Parking · Barton Warnock Visitor Center</h2>${renderParkingPlan()}
${planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.gate(), 'Restricted entry gate'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories']])}
<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="infobox"><b>Only Bibbed Runners Allowed On Course</b></p></article>`;
}
