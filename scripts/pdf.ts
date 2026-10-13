// Print the built site to dist/big-bend-ultra-2027-map.pdf (US Letter) with headless Chromium — same CSS as browser print.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from '../tools/serve';
const D = path.resolve(import.meta.dir, '..', 'dist'), OUT = path.join(D, 'big-bend-ultra-2027-map.pdf');
const srv = serveDist(0), b = await chromium.launch();
try {
  const p = await b.newPage(); await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
} finally { await b.close(); srv.stop(true); }
console.log('pdf', path.relative(process.cwd(), OUT), (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
