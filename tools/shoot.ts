// Screenshots via headless Chromium: bun run shots [outdir=previews]
import { chromium } from 'playwright';
import { serveDist } from './serve';
const out = process.argv[2] ?? 'previews';
const srv = serveDist(8788, process.argv[3]), U = `http://localhost:${srv.port}/`;
const b = await chromium.launch();
let p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); await p.goto(U, { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}/desktop.png`, fullPage: true }); await p.screenshot({ path: `${out}/desktop-fold.png` });
p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }); await p.goto(U, { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}/mobile.png`, fullPage: true });
await b.close(); srv.stop(true); console.log('shots ->', out);
