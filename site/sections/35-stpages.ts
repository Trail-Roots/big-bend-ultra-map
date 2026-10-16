// Print / PDF only: aid-station detail pages after the race pages, two stations per portrait letter page
// (zoomed map filled in by site/app.ts from the main map, hours, amenities, cutoffs, busiest-times row; no photo).
import { stCard } from './45-stations';
import type { Ctx } from '../lib/types';
export const meta = { id: 'stpages', title: 'Aid station details', print: true };
export function render(c: Ctx) {
  const o = c.stations.order, pages: string[][] = [];
  for (let i = 0; i < o.length; i += 2) pages.push(o.slice(i, i + 2));
  return pages.map((pg) => `<div class="stpage">${pg.map((k) => `<article class="stcard">${stCard(c, k, true)}</article>`).join('')}</div>`).join('');
}
