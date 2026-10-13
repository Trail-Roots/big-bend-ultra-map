// Crop each station / POI label area of the main map: bun tools/labelcrops.ts <distDir> <outPrefix>
import { chromium } from 'playwright';
import { serveDist } from './serve';
const [dir, out] = process.argv.slice(2);
const srv = serveDist(0, dir), b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
// svg-space boxes (pt) around each label + its station
const boxes: Record<string, [number, number, number, number]> = {
  waterhole: [740, 1080, 1000, 1270], mines: [660, 940, 900, 1110], shutup: [460, 440, 760, 560], solitario: [740, 80, 980, 260],
  contrabando: [270, 1240, 640, 1390], startfinish: [680, 1340, 1100, 1560], rincon: [500, 650, 800, 760], sauceda: [20, 340, 320, 480],
};
const svg = p.locator('svg.mainmap');
const vb = await svg.evaluate((s: SVGSVGElement) => { const r = s.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, k: r.width / s.viewBox.baseVal.width }; });
for (const [n, [x0, y0, x1, y1]] of Object.entries(boxes))
  await p.screenshot({ path: `${out}-${n}.png`, fullPage: true, clip: { x: vb.x + x0 * vb.k, y: vb.y + y0 * vb.k, width: (x1 - x0) * vb.k, height: (y1 - y0) * vb.k } });
await b.close(); srv.stop(true); console.log('crops', out);
