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

// ---- named vertices (image px, traced on the reference and checked by overlay) ----
export const V: Record<string, P2> = {
  // park road north curb (W -> E)
  n0: [0, 60], n1: [100, 68], n2: [200, 74], n3: [300, 82], n4: [400, 108], n5: [500, 140], n6: [600, 160], n7: [700, 180], n8: [819, 205],
  // park road south curb east of the lot (E -> W) = picnic north side
  s8: [819, 258], C: [772, 250], s6: [689, 228], s5: [607, 207], s4: [560, 196], A: [526, 190],
  // lot east curb (N -> S) = picnic west side
  e1: [518, 205], e2: [512, 235], e3: [503, 285], e4: [499, 335], e5: [499, 368], B: [500, 440],
  // lot south edge = north face of the garden band (E -> W), lot west curb (S -> N), park road south curb west of the lot
  bNE: [439, 442], bNW: [182, 404], l0: [156, 398], w3: [158, 330], w2: [159, 200], w1: [157, 155], w0: [150, 130], c0: [135, 112], s1: [100, 100], s0: [0, 94],
  // shelter (red roof); its NW face is the picnic area's SE boundary
  hN: [624, 381], hW: [544, 437], hS: [560, 468], hE: [652, 416],
  // garden band south face = building roof north face
  bSE0: [439, 465], bSW0: [182, 428],
};
{ const u = [V.bSE0[0] - V.bSW0[0], V.bSE0[1] - V.bSW0[1]], L = Math.hypot(u[0], u[1]), n: P2 = [-u[1] / L, u[0] / L], K = 259; // ~46 m square roof
  V.bSE = [V.bSE0[0] + n[0] * K, V.bSE0[1] + n[1] * K]; V.bSW = [V.bSW0[0] + n[0] * K, V.bSW0[1] + n[1] * K]; }
const ring = (...k: string[]) => k.map((n) => V[n]);
const ellipse = (c0: P2, c1: P2, w: number, n = 16): P2[] => { const m: P2 = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2], L = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2, u = [(c1[0] - c0[0]) / 2 / L, (c1[1] - c0[1]) / 2 / L], v = [-u[1], u[0]];
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * 2 * Math.PI; return [m[0] + u[0] * L * Math.cos(t) + v[0] * w / 2 * Math.sin(t), m[1] + u[1] * L * Math.cos(t) + v[1] * w / 2 * Math.sin(t)] as P2; }); };
// ---- surfaces (image px) ----
export const SURF_PX = {
  // park road + lot: ONE pavement polygon; the islands are holes cut out of it
  PAVE: ring('n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 's8', 'C', 's6', 's5', 's4', 'A', 'e1', 'e2', 'e3', 'e4', 'e5', 'B', 'bNE', 'bNW', 'l0', 'w3', 'w2', 'w1', 'w0', 'c0', 's1', 's0'),
  ISL_BIG: [[264, 136], [276, 124], [472, 160], [484, 174], [468, 192], [276, 150]] as P2[],
  ISL_W: ellipse([231, 226], [245, 275], 17), ISL_E: ellipse([412, 252], [426, 298], 17),
  // picnic: road south curb (A..C), diagonal SE side down to the shelter (C..hN), shelter NW face (hN..hW), south side to the lot curb (hW..B), lot east curb (B..A)
  PICNIC: ring('A', 's4', 's5', 's6', 'C', 'hN', 'hW', 'B', 'e5', 'e4', 'e3', 'e2', 'e1'),
  SHED: ring('hW', 'hN', 'hE', 'hS'),
  // red-roofed desert garden band along the building's north face (non-pavement)
  GARDEN: ring('bNW', 'bNE', 'bSE0', 'bSW0'),
  BLD_OUT: ring('bSW0', 'bSE0', 'bSE', 'bSW'),
  // gravel path (white curb line in the image) from the lot curb across the picnic area toward the shelter
  GRAVEL: [[499, 340], [545, 372], [586, 406]] as P2[],
  // park road centerline for the dashed white line
  PARKRD_C: [[0, 77], [100, 84], [200, 91], [300, 101], [400, 125], [500, 163], [600, 183], [700, 203], [819, 231]] as P2[],
};
export const TR: Record<string, P2[]> = Object.fromEntries(Object.entries(SURF_PX).map(([k, v]) => [k, (v as P2[]).map(toLL)]));
