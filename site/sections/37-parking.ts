// Parking plan (letter page): Erik's drawing sources/floorplan.svg at the full parking-stretch zoom; see site/lib/floorplan-svg.ts
import { renderParkingPlan, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'parking-plan', title: 'Parking plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Parking · Barton Warnock Visitor Center</h2>${renderParkingPlan()}
${planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.pavement(), 'Pavement (road / lot)'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.dropoff(), 'Drop-off zone'], [SW.gate(), 'Restricted entry gate'], [SW.picnic(), 'Picnic area'], [SW.shelter(), 'Picnic shelter'], [SW.building(), 'Building'], [SW.band(), 'Planter band'], [SW.island(), 'Planted island'], [SW.stalls(), 'Stall striping / wheel stops'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.terrain(), 'Terrain'], [SW.tree(), 'Tree / shrub'], [SW.boundary(), 'Property boundary'], [SW.wireFence(), 'Barbed-wire fence'], [SW.pillarFence(), 'Stone-pillar fence']])}
<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b></p></article>`;
}
