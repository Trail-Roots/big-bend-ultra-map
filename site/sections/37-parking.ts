// Parking plan (letter page): parking strips follow the road (KML polygons give extent + side only); see site/lib/floorplan.ts
import { fpSwatch as S } from '../lib/floorplan';
import { renderParkingPlan } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'parking-plan', title: 'Parking plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Parking · Barton Warnock Visitor Center</h2>${renderParkingPlan(c)}
${planLegend([[S.area('rgba(59,130,246,.26)', 'rgb(29,78,216)'), 'Parking zone (space counts are estimates)'], [S.area('rgb(239,68,68)', '#fff', true), 'No parking (this side of FM 170)'], [S.area('rgb(233,223,198)', 'rgb(15,23,42)'), 'Trail / course route — runners on course; do not block'], [S.area('rgba(228,211,42,.35)', 'rgb(146,64,14)'), 'Drop-off zone'], [S.area('rgb(139,146,154)', 'rgb(71,82,94)'), 'Paved road / lot'], [S.area('rgb(233,238,244)', 'rgb(90,101,114)'), 'Building']])}
<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b> Base drawing by Erik (sources/floorplan.svg); scale approximate.</p></article>`;
}
