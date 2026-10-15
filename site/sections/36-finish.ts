// Finish-area floor plan (letter page): true-scale footprints from Erik's logistics My Map; see site/lib/floorplan.ts
import { fpSwatch as S, C } from '../lib/floorplan';
import { renderFinishPlan } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan(c)}
${planLegend([[S.arch(), 'Start / Finish line'], [S.area('rgb(233,223,198)', 'rgb(15,23,42)'), 'Trail / course route (dark line) — runners on course; do not block'], [S.rect('#f8fafc', 'rgb(30,41,59)'), 'Radio Command vehicle'], [S.restrooms(), 'Lavatories (portable restrooms)'], [S.rect('#fdeeee', C.ink, true), 'Medic tent (10×10 ft)'], [S.water(), 'Water hose'], [S.area('rgb(143,131,116)', 'rgb(74,55,40)'), 'Picnic area'], [S.gate(), 'Restricted entry gate'], [S.area('rgba(228,211,42,.35)', 'rgb(146,64,14)'), 'Drop-off zone'], [S.area('rgb(139,146,154)', 'rgb(71,82,94)'), 'Pavement (road / lot)'], [S.area('rgb(233,238,244)', 'rgb(90,101,114)'), 'Building']])}
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b> Base drawing by Erik (sources/floorplan.svg); scale approximate. The Medic tent is placed from the Big Bend Ultra logistics map (Google My Maps).</p></article>`;
}
