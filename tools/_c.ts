import { chromium } from 'playwright';
import { serveDist } from './serve';
const [out, mode] = [process.argv[2], process.argv[3] ?? ''];
const srv = serveDist(0), b = await chromium.launch(), p = await b.newPage({ viewport: { width: 2400, height: 3000 }, deviceScaleFactor: 4 });
await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
const bb = (await p.locator('svg.mainmap g.marker').nth(3).boundingBox())!;
await p.evaluate((m) => { document.querySelectorAll('g.layer[data-layer="dots"] circle').forEach(c => c.remove()); if (m.includes('noarrow')) document.querySelectorAll('svg.mainmap .arrow').forEach(e => (e as any).style.display = 'none'); if (m.includes('course')) document.querySelectorAll('svg.mainmap g.layer[data-layer="courses"], svg.mainmap g.course').forEach(e => (e as any).style.display = ''); }, mode);
await p.screenshot({ path: out, clip: { x: bb.x + 40, y: bb.y - 90, width: 200, height: 110 } });
await b.close(); srv.stop(true);
