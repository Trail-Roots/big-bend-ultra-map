// Finish-area geometry hand-traced on Erik's annotated satellite view (/workspace/finish-reference.png, 819 px wide display
// coordinates, north up), georeferenced by a least-squares affine fit on the My Map points visible in the image (<1 m residual).
// Surfaces are ONE shared-edge tiling: every ring is built from the named vertices in V, so neighbors share exact edges.
type P2 = [number, number];
// control points: image px (icon centers) -> KML lon/lat
const CTRL: [number, number, number, number][] = [
  [434, 90, -103.7571355, 29.2705449], [426, 200, -103.7571499, 29.2703689], [373, 234, -103.7572478, 29.2703151], [537, 263, -103.7569459, 29.2702709],
  [268, 356, -103.75744, 29.2701207], [434, 414, -103.757135, 29.2700261], [174, 328, -103.7576126, 29.2701642]];
function fit(): number[][] { // solve [x y 1]·M = [lon lat] by normal equations (3x3, Cramer)
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [[0, 0, 0], [0, 0, 0]];
  for (const [x, y, lo, la] of CTRL) { const r = [x, y, 1]; for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; b[0][i] += r[i] * lo; b[1][i] += r[i] * la; } }
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A); return b.map((bb) => [0, 1, 2].map((k) => det(A.map((row, i) => row.map((v, j) => (j === k ? bb[i] : v)))) / D));
}
const M = fit();
export const toLL = (p: P2): P2 => [M[0][0] * p[0] + M[0][1] * p[1] + M[0][2], M[1][0] * p[0] + M[1][1] * p[1] + M[1][2]];
export const REF_RESIDUAL_M = Math.max(...CTRL.map(([x, y, lo, la]) => { const q = toLL([x, y]); return Math.hypot((q[0] - lo) * 97000, (q[1] - la) * 110574); }));

// ---- named vertices (image px) ----
const bU = [260, 37], bL = Math.hypot(bU[0], bU[1]), bu: P2 = [bU[0] / bL, bU[1] / bL], bn: P2 = [-bu[1], bu[0]], BSIDE = 264; // building: ~47 m square, rotated with its roof edge
const bNW: P2 = [180, 405], bNE: P2 = [440, 442], add = (p: P2, v: P2, k: number): P2 => [p[0] + v[0] * k, p[1] + v[1] * k];
export const V: Record<string, P2> = {
  // park road north edge (W -> E)
  n0: [0, 60], n1: [100, 68], n2: [200, 80], n3: [300, 98], n4: [400, 127], n5: [500, 150], n6: [600, 168], n7: [700, 188], n8: [819, 210],
  // park road south edge east of the lot (E -> W) = picnic north side
  s8: [819, 258], C: [775, 249], s6: [700, 228], s5: [600, 205], s4: [540, 194], A: [522, 192],
  // lot east edge (N -> S) = picnic west side; then the drive south past the building
  e1: [518, 215], e2: [514, 260], e3: [503, 300], e4: [494, 340], B: [494, 447], d1: [492, 540], d0: bNE.map((v, i) => v + bn[i] * ((540 - bNE[1]) / bn[1])) as P2,
  // building NE corner, garden east edge, lot south edge (E -> W), lot west edge, park road south edge west of the lot
  bNE, g1: [440, 398], l4: [345, 396], l3: [340, 372], l2: [300, 368], l1: [158, 370], w1: [156, 140], w0: [150, 104], s1: [100, 98], s0: [0, 92],
  // shelter (red roof) — its NW face is the picnic area's SE boundary
  hN: [625, 382], hW: [543, 447], hS: [565, 470], hE: [650, 416],
  // building + garden
  bNW, bSE: add(bNE, bn, BSIDE * 1.0), bSW: add(bNW, bn, BSIDE), gW: [158, 405],
};
const ctrB = add(add(bNW, bu, bL / 2), bn, BSIDE / 2), cq = (a: number, b: number) => add(add(ctrB, bu, a * 67), bn, b * 67);
const ring = (...k: string[]) => k.map((n) => V[n]);
const ellipse = (c0: P2, c1: P2, w: number, n = 16): P2[] => { const m: P2 = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2], L = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2, u = [(c1[0] - c0[0]) / 2 / L, (c1[1] - c0[1]) / 2 / L], v = [-u[1], u[0]];
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * 2 * Math.PI; return [m[0] + u[0] * L * Math.cos(t) + v[0] * w / 2 * Math.sin(t), m[1] + u[1] * L * Math.cos(t) + v[1] * w / 2 * Math.sin(t)] as P2; }); };
// ---- surfaces (image px) ----
export const SURF_PX = {
  // road + lot + drive: ONE pavement polygon; the islands are holes cut out of it
  PAVE: ring('n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 's8', 'C', 's6', 's5', 's4', 'A', 'e1', 'e2', 'e3', 'e4', 'B', 'd1', 'd0', 'bNE', 'g1', 'l4', 'l3', 'l2', 'l1', 'w1', 'w0', 's1', 's0'),
  ISL_BIG: [[268, 135], [282, 122], [475, 162], [485, 175], [476, 188], [278, 152]] as P2[],
  ISL_W: ellipse([232, 221], [247, 271], 15), ISL_E: ellipse([412, 251], [428, 298], 17),
  // picnic: road south edge (A..C), shelter NW face (C..hN..hW), lot/drive east edge (B..A)
  PICNIC: ring('A', 's4', 's5', 's6', 'C', 'hN', 'hW', 'B', 'e4', 'e3', 'e2', 'e1'),
  SHED: ring('hW', 'hN', 'hE', 'hS'),
  // desert garden between the lot and the building (non-pavement)
  GARDEN: ring('l1', 'l2', 'l3', 'l4', 'g1', 'bNE', 'bNW', 'gW'),
  BLD_OUT: ring('bNW', 'bNE', 'd0', 'bSE', 'bSW'), BLD_IN: [cq(-1, -1), cq(1, -1), cq(1, 1), cq(-1, 1)],
  // gravel path from the lot edge across the picnic area to the shelter's NW face
  GRAVEL: [[494, 345], [540, 376], [585, 414]] as P2[],
  // park road centerline (between the traced edges) for the dashed centerline
  PARKRD_C: [[0, 76], [100, 83], [200, 96], [300, 110], [400, 136], [500, 167], [600, 186], [700, 208], [819, 233]] as P2[],
};
export const TR: Record<string, P2[]> = Object.fromEntries(Object.entries(SURF_PX).map(([k, v]) => [k, (v as P2[]).map(toLL)]));
