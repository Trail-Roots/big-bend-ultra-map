// One-off generator: relief for race-page maps whose view was extended to clear the top-left corner (site/lib/racemap.ts clearCorner),
// same method / tone as tools/cardhill.ts. Input: dist/race-views.json (RACEHILL=1 bun site/build.ts). Output: sources/hillshade/race-<race>.png + race-views.json
import fs from 'node:fs'; import { PNG } from 'pngjs'; const RV = JSON.parse(fs.readFileSync('dist/race-views.json', 'utf8'));
const L = JSON.parse(fs.readFileSync('content/layout.json', 'utf8')), R = 6378137, OW = 2400;
const tiles = new Map<string, PNG>();
async function tile(z: number, x: number, y: number) { const k = `${z}/${x}/${y}`; if (!tiles.has(k)) { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`); tiles.set(k, PNG.sync.read(Buffer.from(await r.arrayBuffer()))); } return tiles.get(k)!; }
for (const k of Object.keys(RV)) {
  const v = RV[k], W = OW, H = Math.round(OW * (v.y[1] - v.y[0]) / (v.x[1] - v.x[0])), mpp = (v.x[1] - v.x[0]) / W;
  const z = Math.min(14, Math.max(9, Math.round(Math.log2((2 * Math.PI * R) / 256 / (mpp * 0.9))))), n = 2 ** z, ts = (2 * Math.PI * R) / n;
  const need = new Set<string>(); for (const X of [v.x[0], v.x[1]]) for (const Y of [v.y[0], v.y[1]]) need.add(`${Math.floor((X + Math.PI * R) / ts)},${Math.floor((Math.PI * R - Y) / ts)}`);
  const tx0 = Math.floor((v.x[0] + Math.PI * R) / ts), tx1 = Math.floor((v.x[1] + Math.PI * R) / ts), ty0 = Math.floor((Math.PI * R - v.y[1]) / ts), ty1 = Math.floor((Math.PI * R - v.y[0]) / ts);
  for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) await tile(z, tx, ty);
  // bilinear between DEM pixels (nearest-pixel sampling made terraces on the small, zoomed-in frames)
  const px1 = (gx: number, gy: number) => { const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256), t = tiles.get(`${z}/${tx}/${ty}`)!, i = ((gy - ty * 256) * 256 + (gx - tx * 256)) * 4; return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768; };
  const elev = (X: number, Y: number) => { const gx = ((X + Math.PI * R) / ts) * 256 - 0.5, gy = ((Math.PI * R - Y) / ts) * 256 - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), u = gx - x0, v = gy - y0;
    return (px1(x0, y0) * (1 - u) + px1(x0 + 1, y0) * u) * (1 - v) + (px1(x0, y0 + 1) * (1 - u) + px1(x0 + 1, y0 + 1) * u) * v; };
  const E = new Float32Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) E[j * W + i] = elev(v.x[0] + (i + 0.5) * mpp, v.y[1] - (j + 0.5) * mpp);
  const ground = mpp * Math.cos((29.4 * Math.PI) / 180), az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180, out = new PNG({ width: W, height: H });
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const e = (a: number, b: number) => E[Math.min(H - 1, Math.max(0, b)) * W + Math.min(W - 1, Math.max(0, a))];
    const dzdx = (e(i + 1, j) - e(i - 1, j)) / (2 * ground) * 1.6, dzdy = (e(i, j + 1) - e(i, j - 1)) / (2 * ground) * 1.6, slope = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx);
    const sh = Math.max(0, Math.sin(alt) * Math.cos(slope) + Math.cos(alt) * Math.sin(slope) * Math.cos(az - Math.PI / 2 - asp)), g = Math.max(205, Math.min(254, Math.round(244 + (sh - Math.sin(alt)) * 95))), o = (j * W + i) * 4;
    out.data[o] = out.data[o + 1] = out.data[o + 2] = Math.round(255 - (255 - g) * 0.6) /* lighter: matches the race-page relief jpgs */; out.data[o + 3] = 255; }
  fs.writeFileSync(`sources/hillshade/race-${k}.png`, PNG.sync.write(out, { colorType: 0 })); console.log(k, W, H, 'z', z, fs.statSync(`sources/hillshade/race-${k}.png`).size);
}
fs.writeFileSync('sources/hillshade/race-views.json', JSON.stringify(RV)); void L;
