// Parking plan (letter page): from Erik's Google My Maps logistics map; see site/lib/siteplan.ts
import { renderPlan, planLegend, sw, BLUE, AMBER } from '../lib/siteplan';
export const meta = { id: 'parking-plan', title: 'Parking plan' };
const LABELS: Record<string, [number, number]> = {
  'Parking1': [72, 12], 'Parking2': [74, 6], 'No Parking1': [0, -36], 'Start / Finish Line1': [-10, -44], 'Barton Warnock1': [0, 52], 'dropoff1': [-70, 0],
};
export function render(c) {
  return `<article class="doc plan"><h2>Parking · Barton Warnock Visitor Center</h2>${renderPlan(c, { plan: 'parking', W: 1200, labels: LABELS, scaleFt: [0, 250, 500, 1000] })}
${planLegend([[sw.area('#c9d6ea', BLUE), 'Parking area'], [sw.icon('parking'), 'Parking'], [sw.icon('noparking'), 'No parking'], [sw.area('#f6e2b0', AMBER, true), '5-minute drop-off'], [sw.sf(), 'Start / Finish line'], [sw.icon('building'), 'Barton Warnock Visitor Center'], [sw.line('#fff', 7, '#8f887c'), 'FM 170 / paved road'], [sw.line('#ece2cc', 5, '#b9ab8f'), 'Unpaved road / entrance']])}
<p class="note">Click a marker for Google Maps. Locations: Big Bend Ultra logistics map (Google My Maps). Aerial: USGS The National Map. Roads: © OpenStreetMap contributors.</p></article>`;
}
