// Finish-area floor plan (letter page): Erik's drawing sources/floorplan.svg at the finish-area zoom; see site/lib/floorplan-svg.ts
import { renderFinishPlan, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan()}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.picnic(), 'Picnic area'], [SW.shelter(), 'Picnic shelter'], [SW.gate(), 'Restricted entry gate'], [SW.dropoff(), 'Drop-off zone'], [SW.noParkZone(), 'No parking zone']])}
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b></p></article>`;
}
