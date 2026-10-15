// Shared hover-tooltip placement for every in-SVG readout (elevation charts, race charts, timeline / heat map).
// The tooltip is a <g> whose content is laid out from its own origin. placeTip() puts it beside the anchor point, flipping
// right -> left and below -> above when there is not enough room, then clamps it inside the visible area: the intersection of the
// SVG's on-screen box and the viewport (inside an embed iframe the viewport IS the iframe), so it is never clipped.
export function placeTip(svg: SVGSVGElement, tip: SVGGraphicsElement, ax: number, ay: number, gap = 12) {
  tip.removeAttribute('transform');
  const ctm = svg.getScreenCTM(); if (!ctm) return;
  const inv = ctm.inverse(), r = svg.getBoundingClientRect(), M = 4;
  const vx0 = Math.max(r.left, M), vy0 = Math.max(r.top, M), vx1 = Math.min(r.right, innerWidth - M), vy1 = Math.min(r.bottom, innerHeight - M);
  const p0 = new DOMPoint(vx0, vy0).matrixTransform(inv), p1 = new DOMPoint(vx1, vy1).matrixTransform(inv);
  const X0 = Math.min(p0.x, p1.x), X1 = Math.max(p0.x, p1.x), Y0 = Math.min(p0.y, p1.y), Y1 = Math.max(p0.y, p1.y);
  const b = tip.getBBox(), w = b.width, h = b.height;
  let x = ax + gap; if (x + w > X1 && ax - gap - w >= X0) x = ax - gap - w; // flip left
  let y = ay + gap; if (y + h > Y1 && ay - gap - h >= Y0) y = ay - gap - h; // flip above
  x = Math.max(X0, Math.min(x, X1 - w)); y = Math.max(Y0, Math.min(y, Y1 - h)); // clamp
  tip.setAttribute('transform', `translate(${(x - b.x).toFixed(1)} ${(y - b.y).toFixed(1)})`);
}
