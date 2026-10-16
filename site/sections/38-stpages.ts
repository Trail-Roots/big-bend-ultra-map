// Print / PDF only: aid-station detail pages after the floor plans, one station per portrait letter page
// (zoomed map filled in by site/app.ts from the main map, hours, amenities, cutoffs, busiest-times row; no photo).
import { stCard } from './45-stations';
import type { Ctx } from '../lib/types';
export const meta = { id: 'stpages', title: 'Aid station details', print: true };
export function render(c: Ctx) {
  return c.stations.order.map((k) => `<div class="stpage" id="station-${k}" data-st="${k}"><article class="stcard">${stCard(c, k, true)}</article></div>`).join('');
}
