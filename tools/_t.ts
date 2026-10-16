import { chromium } from 'playwright';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('ERR', String(e)));
await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
await p.click('.navlayers > summary'); for (const k of ['100K','55K','35K','20K','10K']) await p.uncheck(`input[data-race="${k}"]`);
await p.click('.navlayers > summary'); await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/allun.png' });
console.log(await p.evaluate(() => { const m = document.querySelector('svg.mainmap')!; return [m.getAttribute('viewBox'), getComputedStyle(m).display, (m.querySelector('g.zv') as any)?.getAttribute('transform')]; }));
await b.close(); srv.stop(true);
