// Seeds sources/curated/area_labels.geojson: places each area label (Private / Big Bend Ranch State Park) at the
// NOTE: private:contrabando, private:mines-east and private:northeast are hand-set in sources/curated/area_labels.geojson
// (centre of the largest unshaded parcel region); re-running this script overwrites them.
// visual centre of its area's visible part (pole of inaccessibility on a distance raster), clear of routes, labels,
// markers and the map edge. Obstacles come from the rendered main map itself (topo + park layers hidden), so
// anything drawn counts. Run after a build: bun scripts/place-area-labels.ts && bun run build
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from '../tools/serve';
import { R } from '../site/lib/util';

const ROOT = path.resolve(import.meta.dir, '..'), J = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const L = J('content/layout.json'), park = J('content/park.geojson').features, st = J('content/stations.json').stations;
const priv = park.filter((f) => f.properties.kind === 'private'), parkPoly = park.find((f) => f.properties.kind === 'park');
const PARK = 'Big Bend Ranch State Park';
const browser = await chromium.launch(), srv = serveDist(0, path.join(ROOT, 'dist'));
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`http://localhost:${srv.port}/`); await page.evaluate(() => document.fonts.ready);
const vb = await page.evaluate(() => { const s = document.querySelector('svg.mainmap') as SVGSVGElement; return { W: s.viewBox.baseVal.width, H: s.viewBox.baseVal.height }; });
await page.evaluate(({ W, H }) => {
  const s = document.querySelector('svg.mainmap') as SVGSVGElement; s.style.width = W + 'px'; s.style.height = H + 'px'; s.style.maxWidth = 'none'; s.style.boxShadow = 'none';
  s.querySelectorAll('g.layer[data-layer="topo"], g.layer[data-layer="park"]').forEach((g) => ((g as SVGElement).style.display = 'none'));
}, vb);
await page.setViewportSize({ width: Math.ceil(vb.W) + 100, height: Math.ceil(vb.H) + 100 });
const png = PNG.sync.read(await page.locator('svg.mainmap').screenshot());
const W = png.width, H = png.height, sx = W / vb.W;
// measured text sizes (viewBox units) for the shared area-label template
const measure = await page.evaluate((ts: string[]) => {
  const s = document.querySelector('svg.mainmap') as SVGSVGElement, NS = 'http://www.w3.org/2000/svg';
  return ts.map((t) => { const e = document.createElementNS(NS, 'text'); e.setAttribute('font-size', '19'); e.setAttribute('font-style', 'italic'); e.setAttribute('class', 'f-serif'); e.textContent = t; s.appendChild(e); const w = e.getBBox().width; e.remove(); return w; });
}, ['Private', PARK, 'Big Bend Ranch', 'State Park']);
await browser.close(); srv.stop(true);
const TW: Record<string, number> = { Private: measure[0], [PARK]: measure[1], 'Big Bend Ranch': measure[2], 'State Park': measure[3] };

// ---- rasters at 1 px = 1/sx units: obstacles -> distance transform ----
const N = W * H, INF = 1e9, obs = new Float64Array(N);
for (let i = 0; i < N; i++) { const r = png.data[i * 4], g = png.data[i * 4 + 1], b = png.data[i * 4 + 2]; obs[i] = r < 236 || g < 236 || b < 236 ? 0 : INF; }
for (let x = 0; x < W; x++) { obs[x] = 0; obs[(H - 1) * W + x] = 0; } for (let y = 0; y < H; y++) { obs[y * W] = 0; obs[y * W + W - 1] = 0; }
function edt(f: Float64Array) { // exact squared EDT (Felzenszwalb), returns distances in px
  const out = new Float64Array(N), tmp = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1), d = new Float64Array(Math.max(W, H));
  const pass = (get: (i: number) => number, set: (i: number, x: number) => void, n: number) => {
    for (let i = 0; i < n; i++) tmp[i] = get(i);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) { let s; do { const p = v[k]; s = (tmp[q] + q * q - (tmp[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) k--; else break; } while (k >= 0); k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + tmp[p]; }
    for (let i = 0; i < n; i++) set(i, d[i]);
  };
  const a = Float64Array.from(f, (x) => (x === 0 ? 0 : INF));
  for (let x = 0; x < W; x++) pass((y) => a[y * W + x], (y, val) => (a[y * W + x] = val), H);
  for (let y = 0; y < H; y++) pass((x) => a[y * W + x], (x, val) => (out[y * W + x] = Math.sqrt(val)), W);
  return out;
}
const dObs = edt(obs);
// projection (same as the renderer): lon/lat -> viewBox units
const [x0, x1] = L.views.main.x, [y0, y1] = L.views.main.y, k = vb.W / (x1 - x0);
const P = ([lon, lat]: number[]) => [((R * lon * Math.PI) / 180 - x0) * k, (y1 - R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) * k];
const U = (px: number, py: number) => { const X = x0 + px / k, Y = y1 - py / k; return [+((X / R) * 180 / Math.PI).toFixed(6), +((2 * Math.atan(Math.exp(Y / R)) - Math.PI / 2) * 180 / Math.PI).toFixed(6)]; };
function fillMask(polys: any[], holes: any[]) { // even-odd scanline fill in px; 1 = inside area
  const m = new Uint8Array(N);
  const rings = (fs: any[]) => fs.flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat())).map((r: number[][]) => r.map((q) => P(q).map((v) => v * sx)));
  const draw = (rs: number[][][], val: number) => {
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (const r of rs) for (let i = 0; i < r.length - 1; i++) { const [ax, ay] = r[i], [bx, by] = r[i + 1]; if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x < Math.min(W, xs[i + 1] - 0.5); x++) m[y * W + x] = val;
    }
  };
  draw(rings(polys), 1); if (holes.length) draw(rings(holes), 0);
  return m;
}
// what to label. region: optional extra constraint in map units (relative to stations)
type Spec = { text: string[]; area: string; polys: any[]; holes: any[]; inside?: boolean; region?: (x: number, y: number) => boolean };
const S3 = P(st['3'].lonlat), S4 = P(st['4'].lonlat), S5 = P(st['5'].lonlat);
const SPECS: Spec[] = [
  { text: ['Private'], area: 'private:contrabando', polys: [priv[0]], holes: [] },
  { text: ['Private'], area: 'private:waterhole', polys: [priv[1]], holes: [] },
  { text: ['Private'], area: 'private:east', polys: [priv[2], priv[4]], holes: [] },
  { text: ['Private'], area: 'private:northeast', polys: [priv[3], priv[5]], holes: [] },
  // park name on both sides of the route: the open country west of the course, and the negative space right of Shutup
  { text: ['Big Bend Ranch', 'State Park'], area: 'park:west', polys: [parkPoly], holes: priv, inside: true, region: (x, y) => x < S5[0] - 80 && y > S3[1] - 300 && y < S5[1] - 120 },
  { text: ['Big Bend Ranch', 'State Park'], area: 'park:shutup', polys: [parkPoly], holes: priv, inside: true, region: (x, y) => x > S3[0] + 40 && x < S4[0] - 20 && y > S4[1] && y < S3[1] + 120 },
];
const out: any[] = [];
for (const sp of SPECS) {
  const mask = fillMask(sp.polys, sp.holes), dIn = edt(Float64Array.from(mask, (v) => (v ? INF : 0)));
  const lines = sp.text, lw = Math.max(...lines.map((t) => TW[t])) * sx, lh = 19 * 1.2 * sx, bh = lh * lines.length;
  let best: { s: number; x: number; y: number } | null = null;
  const STEP = 3, GAP = 8 * sx;
  for (let cy = bh / 2; cy < H - bh / 2; cy += STEP) for (let cx = lw / 2; cx < W - lw / 2; cx += STEP) {
    if (!mask[Math.round(cy) * W + Math.round(cx)]) continue;
    if (sp.region && !sp.region(cx / sx, cy / sx)) continue;
    let cObs = INF, out_ = false; const cIn = dIn[Math.round(cy) * W + Math.round(cx)];
    for (let yy = cy - bh / 2; yy <= cy + bh / 2 + 0.01 && cObs > 0; yy += Math.max(1, bh / 4)) for (let xx = cx - lw / 2; xx <= cx + lw / 2 + 0.01; xx += 4) {
      const i = Math.round(yy) * W + Math.round(xx); if (dObs[i] < cObs) cObs = dObs[i]; if (!mask[i]) out_ = true;
    }
    if (cObs < GAP || (sp.inside && out_)) continue;
    const s = Math.min(cIn, 2 * cObs) + 0.001 * cObs; // pole of inaccessibility (label centre) of the visible area, kept off obstacles
    if (!best || s > best.s) best = { s, x: cx, y: cy };
  }
  if (!best) { console.log('no clear spot for', sp.area); continue; }
  out.push({ type: 'Feature', properties: { area: sp.area, text: lines.join('\n') }, geometry: { type: 'Point', coordinates: U(best.x / sx, best.y / sx) } });
  // the placed label is an obstacle for the next one
  for (let yy = Math.floor(best.y - bh / 2); yy <= best.y + bh / 2; yy++) for (let xx = Math.floor(best.x - lw / 2); xx <= best.x + lw / 2; xx++) obs[yy * W + xx] = 0;
  dObs.set(edt(obs));
  console.log(sp.area, lines.join(' / '), 'clear', (best.s / sx).toFixed(1), 'at', out.at(-1).geometry.coordinates);
}
fs.writeFileSync(path.join(ROOT, 'sources/curated/area_labels.geojson'), JSON.stringify({ type: 'FeatureCollection', features: out }, null, 1) + '\n');
