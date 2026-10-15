// Finish-area floor plan (letter page): true-scale footprints from Erik's logistics My Map; see site/lib/floorplan.ts
import { renderFinishPlan, fpSwatch as S, C } from '../lib/floorplan';
import { planLegend } from '../lib/siteplan';
export const meta = { id: 'finish-plan', title: 'Finish area plan' };
// label offsets (px from each footprint's anchor); [0, 0] = centred inside
const LABELS: Record<string, [number, number]> = {
  dropoff: [0, 0], picnic: [0, 0], radio: [110, -46], main: [-70, -40], medic: [-40, 46], restrooms: [-120, 0], water: [74, 30], sf: [-60, -46], gate: [0, -36],
};
export function render(c) {
  return `<article class="doc plan"><h2>Finish area · Barton Warnock Visitor Center</h2>${renderFinishPlan(c, LABELS)}
${planLegend([[S.arch(), 'Start / Finish arch'], [S.course(c.courses.colors['100K']), 'Course into the finish'], [S.rect('#fff', C.ink, true), 'Canopy tent (Main 20×20 ft)'], [S.rect('#fdeeee', C.ink, true), 'Medic tent (10×10 ft)'], [S.rect(C.rv, C.ink), 'Radio Command RV'], [S.restrooms(), 'Portable restrooms'], [S.area(C.picnic, C.picnicEdge, true), 'Picnic area'], [S.water(), 'Water hose'], [S.gate(), 'Gate · restricted access'], [S.area('#f6e2b0', C.amber, false, true), '5-minute drop-off'], [S.bld(), 'Building'], [S.road(), 'Paved road / lot']])}
<p class="note">Footprints to scale; sizes and orientations are planning assumptions. Click any item for Google Maps. Locations: Big Bend Ultra logistics map (Google My Maps). Roads: © OpenStreetMap contributors.</p></article>`;
}
