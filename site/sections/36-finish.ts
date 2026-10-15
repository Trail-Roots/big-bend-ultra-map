// Finish-area plan (letter page): from Erik's Google My Maps logistics map; see site/lib/siteplan.ts
import { renderPlan, planLegend, sw, AMBER } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
// label offsets (px from the marker), tuned against the rendered plan
const LABELS: Record<string, [number, number]> = {
  'Start / Finish Line1': [-104, -30], 'Main1': [-70, -40], 'Radio Command1': [114, 2], 'Medic1': [-92, 16], 'Portable Restrooms1': [-118, -20],
  'Picnic Area1': [76, 26], 'Water hose1': [62, 30], 'Restricted Access1': [100, -22], 'Barton Warnock1': [0, 64], 'dropoff1': [0, 0],
};
export function render(c) {
  const col = c.courses.colors['100K'];
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderPlan(c, { plan: 'finish', W: 1200, labels: LABELS, scaleFt: [0, 50, 100, 200] })}
${planLegend([[sw.sf(), 'Start / Finish line'], [sw.line(col), '100K course to the finish'], [sw.icon('main'), 'Main tent'], [sw.icon('radio'), 'Radio Command'], [sw.icon('medic'), 'Medic'], [sw.icon('restroom'), 'Portable restrooms'], [sw.icon('picnic'), 'Picnic area'], [sw.icon('water'), 'Water hose'], [sw.icon('restricted'), 'Restricted access'], [sw.area('#f6e2b0', AMBER, true), '5-minute drop-off'], [sw.area('#d6cdbb', '#6f675b'), 'Barton Warnock Visitor Center'], [sw.line('#fff', 7, '#8f887c'), 'FM 170 / paved road']])}
<p class="note">Click a marker for Google Maps. Locations: Big Bend Ultra logistics map (Google My Maps). Aerial: USGS The National Map. Roads: © OpenStreetMap contributors.</p></article>`;
}
