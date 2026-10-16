// Race-card map frame (SSOT for site/lib/racemap.ts and tools/cardhill.ts): the race view re-fit to the card's exact aspect
// (route height kept, frame widened), so the whole route sits inside the card and one generated relief image covers the frame.
export const CARD_ASPECT = 330 / 240;
export function cardView(view: { x: number[]; y: number[] }) {
  const cx = (view.x[0] + view.x[1]) / 2, cy = (view.y[0] + view.y[1]) / 2, h = (view.y[1] - view.y[0]) * 1.0, w = h * CARD_ASPECT;
  return { x: [cx - w / 2, cx + w / 2], y: [cy - h / 2, cy + h / 2] };
}
