// Finish-area floor plan (letter page): Erik's drawing sources/floorplan.svg at the finish-area zoom; see site/lib/floorplan-svg.ts
import { renderFinishPlan, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
import { renderIdleHeat } from '../lib/timeline';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan()}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.dropoff(), 'Drop-off zone'], [SW.noParkZone(), 'No parking zone']])}
<figure class="idlebox"><figcaption>Runners off course at the start / finish (waiting to start or finished) · modelled: arrive 15–75 min before their start, stay 1–2 h after finishing</figcaption>${renderIdleHeat(c)}</figure></article>`;
}
