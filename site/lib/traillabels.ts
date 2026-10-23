// Race-page trail names: each trail / road the race uses (site/lib/sequence.ts) gets one italic name that follows the route beside the line,
// on a fairly straight stretch, clear of every drawn line, marker, arrow and already-placed label. Fallbacks: smaller text, then a horizontal
// name in clear space with a short leader line. Every name must be placed (the build fails otherwise); never on or crowding a line.
import { trailSequence } from './sequence';
import { offsetLine, f1, esc } from './util';
/** even resample (12 pts) + 4 passes of [1,2,1] smoothing: GPS jitter would make the name wobble */
function smooth(L: number[][]) { const cum = [0]; for (let i = 1; i < L.length; i++) cum.push(cum[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1])); const T = cum[cum.length - 1], N = 12; let r: number[][] = [];
  for (let j = 0; j <= N; j++) { const t = T * j / N; let i = cum.findIndex((v) => v >= t); if (i < 1) i = 1; const u = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); r.push([L[i - 1][0] + (L[i][0] - L[i - 1][0]) * u, L[i - 1][1] + (L[i][1] - L[i - 1][1]) * u]); }
  for (let p = 0; p < 4; p++) r = r.map((q, i) => i === 0 || i === N ? q : [(r[i - 1][0] + 2 * q[0] + r[i + 1][0]) / 4, (r[i - 1][1] + 2 * q[1] + r[i + 1][1]) / 4]); return r; }
/** extend both ends along the tangent so the glyph run is never clipped by a short path */
function ext(l: number[][], e: number) { const n = l.length, a = l[0], b = l[1], y = l[n - 1], z = l[n - 2]; const u = (p: number[], q: number[]) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; return [(p[0] - q[0]) / d * e, (p[1] - q[1]) / d * e]; }; const s = u(a, b), t = u(y, z); return [[a[0] + s[0], a[1] + s[1]], ...l, [y[0] + t[0], y[1] + t[1]]]; }
type Bx = { x0: number; x1: number; y0: number; y1: number };
export const TRAIL_FS = 21;
export function trailLabels(c, k: string, V, W: number, H: number, pts: [number, number][], ob: Bx[], placed: Bx[]) {
  const G = 16, grid = new Map<string, [number, number][]>();
  for (const p of pts) { const key = `${Math.floor(p[0] / G)},${Math.floor(p[1] / G)}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(p); }
  const nearLine = (x: number, y: number, r: number) => { for (let gx = Math.floor((x - r) / G); gx <= Math.floor((x + r) / G); gx++) for (let gy = Math.floor((y - r) / G); gy <= Math.floor((y + r) / G); gy++) for (const [px, py] of grid.get(`${gx},${gy}`) ?? []) if ((px - x) ** 2 + (py - y) ** 2 < r * r) return true; return false; };
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], seq = trailSequence(c, k);
  const names = [...new Set(seq.map((s) => s.name).filter((n): n is string => !!n && !/^Start area|^Cross FM 170/.test(n)))];
  let out = "", n = 0; const miss: string[] = [], tiers: string[] = [];
  const hitBox = (x: number, y: number, pad: number) => [...ob, ...placed].some((q) => x > q.x0 - pad && x < q.x1 + pad && y > q.y0 - pad && y < q.y1 + pad);
  const occ = (name: string, only?: (x: any) => boolean) => seq.filter((x) => x.name === name && (!only || only(x))).sort((a, b) => (b.b - b.a) - (a.b - a.a)).map((s) => co.slice(s.i0, s.i1 + 1).map((p) => V.p(p) as number[])).filter((L) => L.length >= 2);
  const txt = (fs: number) => `class="f-serif" font-size="${fs}" font-style="italic" fill="#5d5850" stroke="#fff" stroke-width="${fs < 20 ? 4 : 5}" paint-order="stroke" stroke-linejoin="round"`;
  // 1) follow the trail beside the line (full size, then smaller and slightly curvier for short segments)
  const follow = (name: string, FS: number, minCh: number, only?: (x: any) => boolean) => { const cw = FS * 0.5, R = FS * 0.55, w = name.length * cw + 8;
    for (const L of occ(name, only)) {
      const cum = [0]; for (let i = 1; i < L.length; i++) cum.push(cum[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
      const tot = cum[cum.length - 1]; if (tot < w * 1.1) continue;
      const starts: number[] = []; for (let t = (tot - w) / 2, d = 0; d <= (tot - w) / 2; d += 6) { starts.push(t - d); if (d) starts.push(t + d); }
      for (const t0 of starts) {
        const i0 = cum.findIndex((v) => v >= t0), i1 = cum.findIndex((v) => v >= t0 + w); if (i0 < 0 || i1 < 0 || i1 - i0 < 1) continue;
        const sub = L.slice(Math.max(0, i0 - 1), i1 + 1), ch = Math.hypot(sub[sub.length - 1][0] - sub[0][0], sub[sub.length - 1][1] - sub[0][1]);
        if (ch < w * minCh) continue;
        for (const o of [R + 10, -(R + 10), R + 15, -(R + 15), R + 22, -(R + 22), R + 30, -(R + 30), R + 40, -(R + 40)]) {
          let l = offsetLine(smooth(sub), o); if (l[l.length - 1][0] < l[0][0]) l = l.reverse();
          const samp: number[][] = []; for (let i = 1; i < l.length; i++) { const m = Math.max(1, Math.ceil(Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]) / 4)); for (let j = 0; j <= m; j++) samp.push([l[i - 1][0] + (l[i][0] - l[i - 1][0]) * j / m, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * j / m]); }
          const b = { x0: Math.min(...samp.map((p) => p[0])) - R, x1: Math.max(...samp.map((p) => p[0])) + R, y0: Math.min(...samp.map((p) => p[1])) - R, y1: Math.max(...samp.map((p) => p[1])) + R };
          if (b.x0 < 6 || b.y0 < 6 || b.x1 > W - 6 || b.y1 > H - 6) continue;
          if (samp.some(([x, y]) => nearLine(x, y, R + 3))) continue;
          if (samp.some(([x, y]) => hitBox(x, y, R + 2))) continue;
          const id = `tl${k}-${n++}`; placed.push(b);
          out += `<g class="traillab"><path id="${id}" d="M${ext(l, w * 0.35).map((p) => `${f1(p[0])},${f1(p[1])}`).join("L")}" fill="none"/><text ${txt(FS)} dominant-baseline="central"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(name)}</textPath></text></g>`;
          return true; } } }
    return false; };
  // 2) horizontal name in clear space with a short leader line to the trail (leader may touch only its own anchor end)
  const leader = (name: string, FS: number, rMax: number, only?: (x: any) => boolean) => { const tw = name.length * FS * 0.5 + 6, th = FS * 1.15;
    for (const L of occ(name, only)) { const anchors = [0.5, 0.35, 0.65, 0.2, 0.8].map((q) => L[Math.min(L.length - 1, Math.floor(L.length * q))]);
      for (const [ax, ay] of anchors) for (let r = 34; r <= rMax; r += 12) for (let d = 0; d < 16; d++) { const t = d / 16 * 2 * Math.PI, cx = ax + Math.cos(t) * r, cy = ay + Math.sin(t) * r;
        const b = { x0: cx - tw / 2, x1: cx + tw / 2, y0: cy - th / 2, y1: cy + th / 2 };
        if (b.x0 < 6 || b.y0 < 6 || b.x1 > W - 6 || b.y1 > H - 6) continue;
        let bad = false; for (let x = b.x0 - 4; x <= b.x1 + 4 && !bad; x += 4) for (let y = b.y0 - 4; y <= b.y1 + 4 && !bad; y += 4) if (nearLine(x, y, 3) || hitBox(x, y, 3)) bad = true; if (bad) continue;
        // leader: from 7px off the anchor to the nearest box edge point
        const ex = Math.max(b.x0, Math.min(ax, b.x1)), ey = Math.max(b.y0, Math.min(ay, b.y1)), dl = Math.hypot(ex - ax, ey - ay); if (dl < 14) continue;
        const sx = ax + (ex - ax) / dl * 7, sy = ay + (ey - ay) / dl * 7;
        for (let j = 0; j <= 1 && !bad; j += 4 / dl) { const x = sx + (ex - sx) * j, y = sy + (ey - sy) * j; if (Math.hypot(x - ax, y - ay) > 14 && nearLine(x, y, 4)) bad = true; if (hitBox(x, y, 1)) bad = true; } if (bad) continue;
        placed.push(b); n++;
        out += `<g class="traillab"><path d="M${f1(sx)},${f1(sy)}L${f1(ex)},${f1(ey)}" stroke="#5d5850" stroke-width="1.6" fill="none"/><text ${txt(FS)} x="${f1(cx)}" y="${f1(cy)}" text-anchor="middle" dominant-baseline="central">${esc(name)}</text></g>`;
        return true; } }
    return false; };
  const put = (name: string, only?: (x: any) => boolean) => follow(name, TRAIL_FS, 0.86, only) ? "full" : follow(name, 16, 0.8, only) ? "small" : leader(name, 16, 160, only) ? "leader" : leader(name, 14, 320, only) ? "leader-small" : "";
  // trails at the start (first 3 mi out of the start area) are labeled at the start, on every map that uses them (Erik)
  const START_MI = 3, early = new Set(seq.filter((x) => x.name && x.a < START_MI && !/^Start area|^Cross FM 170/.test(x.name)).map((x) => x.name!));
  // required labels first (one per trail; early trails at the start)
  for (const name of names) if (!early.has(name)) { const t = put(name); if (!t) miss.push(name); else if (t !== "full") tiers.push(name + ":" + t); }
  for (const name of names) if (early.has(name)) { const t = put(name, (x) => x.a < START_MI) || put(name); if (!t) miss.push(name); else tiers.push(name + "@start:" + t); }
  if (tiers.length) console.log(`  racemap ${k}: fallback labels ${tiers.join(", ")}`);
  console.log(`  racemap ${k}: ${names.length - miss.length}/${names.length} trail names placed${miss.length ? ' (no clear spot: ' + miss.join(', ') + ')' : ''}`);
  if (miss.length) throw new Error(`racemap ${k}: trail names not placed: ${miss.join(", ")}`);
  return out;
}
