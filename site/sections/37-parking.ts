// Parking plan (letter page): parking strips follow the road (KML polygons give extent + side only); see site/lib/floorplan.ts
import { renderParkingPlan, pkSwatch, fpSwatch as S, C, PARK } from '../lib/floorplan';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'parking-plan', title: 'Parking plan' };
const LABELS: Record<string, [number, number]> = {
  noPark: [-90, -70], strip1: [40, -28], strip2: [-90, 62], strip3: [0, 0], 'Parking1': [60, 20], 'Parking2': [60, 16], 'No Parking1': [0, -30], 'Start / Finish Line1': [0, -32], 'Barton Warnock1': [0, 40], dropoff: [-66, 6],
};
export function render(c) {
  return `<article class="doc plan"><h2>Parking · Barton Warnock Visitor Center</h2>${renderParkingPlan(c, LABELS)}
${planLegend([[pkSwatch.strip(), `Parking strip (stalls ${PARK.stallFt} ft, simulated)`], [pkSwatch.p(), 'Parking'], [pkSwatch.p(true), 'No parking'], [pkSwatch.noPark(), 'No-parking shoulder (opposite side of FM 170)'], [S.area('#f6e2b0', C.amber, false, true), '5-minute drop-off'], [S.bld(), 'Building'], [S.road(), 'Paved road / lot']])}
<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="note">Parking strips follow the road edge on the stretches marked in the logistics map; stall lines are simulated (lots are dirt). Space counts are estimates at ${PARK.stallFt} ft per car. Click any item for Google Maps. Roads: © OpenStreetMap contributors.</p></article>`;
}
