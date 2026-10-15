// Finish-area floor plan (letter page): true-scale footprints from Erik's logistics My Map; see site/lib/floorplan.ts
import { renderFinishPlan, fpSwatch as S, C } from '../lib/floorplan';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
// label offsets (px from each footprint's anchor); [0, 0] = centred inside
const LABELS: Record<string, [number, number]> = {
  dropoff: [0, 0], picnic: [0, 0], radio: [110, -46], medic: [-40, 46], restrooms: [-152, 0], water: [74, 30], sf: [-118, -50], gate: [0, -36],
};
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan(c, LABELS)}
${planLegend([[S.arch(), 'Start / Finish arch'], [S.course('#111'), 'Course route — runners on course; do not block'], [S.rect('#fdeeee', C.ink, true), 'Medic tent (10×10 ft)'], [S.rect(C.rv, C.ink), 'Radio Command (8.5×35 ft vehicle)'], [S.restrooms(), 'Portable restrooms'], [S.area(C.picnic, C.picnicEdge, true), 'Picnic area'], [S.area('#e6dcc6', '#b9ab8e'), 'Gravel path'], [S.water(), 'Water hose'], [S.gate(), 'Restricted access (gate across the entrance)'], [S.area('#f6e2b0', C.amber, false, true), '5-minute drop-off'], [S.bld(), 'Building'], [S.area(C.pave, C.curb), 'Pavement (road / lot)'], [S.area(C.island, C.islandEdge), 'Planted island (curbed)'], [S.area(C.dirt, '#cfc4ad'), 'Dirt / native ground']])}
<p class="note"><b>Runners on course — walking to/from your car, do not block the route.</b> Footprints to scale; sizes and orientations are planning assumptions. Click any item for Google Maps. Locations: Big Bend Ultra logistics map (Google My Maps). Roads: © OpenStreetMap contributors.</p></article>`;
}
