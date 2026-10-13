// Smooth map position markers: each course marker eases toward its target *mile* every animation frame, so it
// travels along the route (positions interpolated between the 0.05 mi samples), never in a straight line.
// Low latency (time constant ~60 ms); prefers-reduced-motion snaps instead of easing; big jumps (> 4 mi) snap.
type M = { g: SVGElement };
export type Samples = number[][]; // [mile, ft, main x, main y, mini x, mini y, ...] every 0.05 mi
/** position on the route at a fractional mile (linear between neighbouring 0.05 mi samples) */
export function routeAt(s: Samples, mile: number) {
  const x = Math.max(0, Math.min(s.length - 1, mile / 0.05)), i = Math.floor(x), j = Math.min(s.length - 1, i + 1), u = x - i;
  return s[i].map((v, n) => v + (s[j][n] - v) * u);
}
export function makeGlide(courses: Record<string, { s: Samples }>, mains: Record<string, M>, minis: Record<string, M>, zoomOf: (svg: Element | null) => number) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, TAU = 60, SNAP = 4;
  const tgt: Record<string, number | null> = {}, cur: Record<string, number | null> = {};
  let raf = 0, last = 0;
  const draw = (k: string) => {
    const m = cur[k], a = mains[k], b = minis[k];
    if (m == null) { if (a) a.g.style.display = 'none'; if (b) b.g.style.display = 'none'; return; }
    const p = routeAt(courses[k].s, m);
    if (a) { a.g.style.display = ''; a.g.setAttribute('transform', `translate(${p[2]} ${p[3]}) scale(${1 / zoomOf(a.g.ownerSVGElement)})`); }
    if (b) { b.g.style.display = ''; b.g.setAttribute('transform', `translate(${p[4]} ${p[5]}) scale(${1 / zoomOf(b.g.ownerSVGElement)})`); }
  };
  const frame = (t: number) => {
    raf = 0; const dt = last ? Math.min(100, t - last) : 16; last = t; let moving = false;
    for (const k in tgt) {
      const g = tgt[k], c = cur[k];
      if (g == null) cur[k] = null;
      else if (c == null || reduced || Math.abs(g - c) > SNAP) cur[k] = g;
      else { const n = c + (g - c) * (1 - Math.exp(-dt / TAU)); if (Math.abs(g - n) < 0.002) cur[k] = g; else { cur[k] = n; moving = true; } }
      draw(k);
    }
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  return {
    /** set (or clear with null) the target mile of one course */
    set(k: string, mile: number | null) { tgt[k] = mile; kick(); },
    clear() { for (const k in tgt) tgt[k] = null; kick(); },
    /** re-draw at the current positions (after zoom) */
    redraw() { for (const k in cur) draw(k); },
  };
}
