// Direction-arrow helpers shared by the content pipeline and the seeding tool.
import { type XY, interp, cumlen, interpolate } from './geo';
export type Marker = { mile: number; show: boolean; reason: string };
export interface ArrowsFile {
  interval_mi: number;
  size_pt: { main: number; mini: number };
  /** course -> map ('main' or the course's own mini map) -> mile markers (data only, never drawn as text) */
  courses: Record<string, Record<string, Marker[]>>;
}
/** position + unit direction (EPSG:3857) at sheet-mile `mi` along a route whose vertices carry sheet miles */
export function alongRoute(rt: XY[], rmi: number[], mi: number, win = 60) {
  const cum = cumlen(rt), s = interp(mi, rmi, cum);
  const at = interpolate(rt, cum, s), a = interpolate(rt, cum, s - win), b = interpolate(rt, cum, s + win);
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  return { at, dir: [dx / n, dy / n] as XY };
}
