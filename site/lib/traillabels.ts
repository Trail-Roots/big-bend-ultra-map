// Race-page trail names: each trail / road the race uses (site/lib/sequence.ts) gets one italic name that follows the route beside the line,
// on a fairly straight stretch, clear of every drawn line, marker, arrow and already-placed label. Names with no clean spot are skipped
// and logged (never forced onto a line).
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
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], seq = trailSequence(c, k), FS = TRAIL_FS, cw = FS * 0.5, R = FS * 0.55;
  const names = [...new Set(seq.map((s) => s.name).filter((n): n is string => !!n && !/^Start area|^Cross FM 170/.test(n)))];
  let out = '', n = 0; const miss: string[] = [];
  for (const name of names) {
    const w = name.length * cw + 8; let done = false;
    // longest occurrences first
    for (const s of seq.filter((x) => x.name === name).sort((a, b) => (b.b - b.a) - (a.b - a.a))) {
      const L = co.slice(s.i0, s.i1 + 1).map((p) => V.p(p) as number[]); if (L.length < 2) continue;
      const cum = [0]; for (let i = 1; i < L.length; i++) cum.push(cum[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
      const tot = cum[cum.length - 1]; if (tot < w * 1.1) continue;
      // candidate windows from the middle outward
      const starts: number[] = []; for (let t = (tot - w) / 2, d = 0; d <= (tot - w) / 2; d += 8) { starts.push(t - d); if (d) starts.push(t + d); }
      for (const t0 of starts) {
        const i0 = cum.findIndex((v) => v >= t0), i1 = cum.findIndex((v) => v >= t0 + w); if (i0 < 0 || i1 < 0 || i1 - i0 < 1) continue;
        const sub = L.slice(Math.max(0, i0 - 1), i1 + 1), ch = Math.hypot(sub[sub.length - 1][0] - sub[0][0], sub[sub.length - 1][1] - sub[0][1]);
        if (ch < w * 0.86) continue; // too curvy for a legible name
        for (const o of [22, -22, 28, -28, 35, -35, 44, -44, 54, -54]) {
          let l = offsetLine(smooth(sub), o); if (l[l.length - 1][0] < l[0][0]) l = l.reverse();
          const samp: number[][] = []; for (let i = 1; i < l.length; i++) { const m = Math.max(1, Math.ceil(Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]) / 4)); for (let j = 0; j <= m; j++) samp.push([l[i - 1][0] + (l[i][0] - l[i - 1][0]) * j / m, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * j / m]); }
          const b = { x0: Math.min(...samp.map((p) => p[0])) - R, x1: Math.max(...samp.map((p) => p[0])) + R, y0: Math.min(...samp.map((p) => p[1])) - R, y1: Math.max(...samp.map((p) => p[1])) + R };
          if (b.x0 < 6 || b.y0 < 6 || b.x1 > W - 6 || b.y1 > H - 6) continue;
          if (samp.some(([x, y]) => nearLine(x, y, R + 3))) continue;
          if ([...ob, ...placed].some((q) => samp.some(([x, y]) => x > q.x0 - R - 2 && x < q.x1 + R + 2 && y > q.y0 - R - 2 && y < q.y1 + R + 2))) continue;
          const id = `tl${k}-${n++}`; placed.push(b);
          out += `<g class="traillab"><path id="${id}" d="M${ext(l, w * 0.35).map((p) => `${f1(p[0])},${f1(p[1])}`).join('L')}" fill="none"/><text class="f-serif" font-size="${FS}" font-style="italic" fill="#5d5850" stroke="#fff" stroke-width="5" paint-order="stroke" stroke-linejoin="round" dominant-baseline="central"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(name)}</textPath></text></g>`;
          done = true; break;
        }
        if (done) break;
      }
      if (done) break;
    }
    if (!done) miss.push(name);
  }
  console.log(`  racemap ${k}: ${names.length - miss.length}/${names.length} trail names placed${miss.length ? ' (no clear spot: ' + miss.join(', ') + ')' : ''}`);
  return out;
}
