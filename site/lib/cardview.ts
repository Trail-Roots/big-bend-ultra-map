// Race-card map frame (SSOT for site/lib/racemap.ts and tools/cardhill.ts): the race view re-fit to the card's exact square aspect
// (route view contained, frame grown on the short side), so the whole route sits inside the card and one generated relief image covers the frame.
// Extra height goes mostly ABOVE the route, keeping the top-left corner (north arrow) and top-right (bib) clear.
export const CARD_ASPECT = 1; // square
export function cardView(view: { x: number[]; y: number[] }) {
  const cx = (view.x[0] + view.x[1]) / 2, cy = (view.y[0] + view.y[1]) / 2, rw = view.x[1] - view.x[0], rh = view.y[1] - view.y[0], w = Math.max(rw, rh * CARD_ASPECT), h = w / CARD_ASPECT;
  const y0 = view.y[0] - (h - rh) * 0.15; // y grows north: 15 % of the slack below the route, 85 % above
  return { x: [cx - w / 2, cx + w / 2], y: [y0, y0 + h] };
}
