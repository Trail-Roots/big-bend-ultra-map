// Print / PDF only: regional map (wider view of the main map in its regional mode), printed last next to Operations (scripts/pdf.ts moves it).
import type { Ctx } from '../lib/types';
import { renderRegional } from '../lib/regional';
export const meta = { id: 'regional', title: 'Regional map', print: true };
export function render(c: Ctx) {
  return `<div class="rgpage"><h2 class="rg-h">Regional map · getting to the race</h2>${renderRegional(c)}</div>`;
}
