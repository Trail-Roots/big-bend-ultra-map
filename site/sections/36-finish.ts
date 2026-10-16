// Finish-area floor plan (letter page): Erik's drawing sources/floorplan.svg at the finish-area zoom; see site/lib/floorplan-svg.ts
import { renderFinishPlan, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan()}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.picnic(), 'Picnic area'], [SW.shelter(), 'Picnic shelter'], [SW.gate(), 'Restricted entry gate'], [SW.dropoff(), 'Drop-off zone'], [SW.noParkZone(), 'No parking zone']])}
<div class="ui fp-heatctl"><span class="fp-hkey" aria-hidden="true"></span><span class="fp-hlab">Runners off course here (waiting to start / finished), modelled</span><input type="range" class="fp-range" min="${c.timeline.window[0]}" max="${c.timeline.window[1] - 15}" step="15" value="${c.timeline.courses['100K'].start - 45}" aria-label="Time of day"><output class="fp-read"></output></div><script type="application/json" id="idledata">${JSON.stringify({ t0: c.timeline.window[0], bin: c.timeline.bin_min, v: c.timeline.finish_crowd.inactive15 })}</script>
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b></p></article>`;
}
