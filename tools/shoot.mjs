// Screenshots + print-to-PDF via headless Chromium. Usage: node tools/shoot.mjs (serves ./dist on :8787)
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const D = path.resolve('dist'), types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(D, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8787);
const b = await chromium.launch(); const U = 'http://localhost:8787/';
let p = await b.newPage({ viewport: { width: 1600, height: 1000 } }); await p.goto(U, { waitUntil: 'networkidle' }); await p.screenshot({ path: 'previews/desktop.png', fullPage: true });
await p.screenshot({ path: 'previews/desktop-fold.png' });
p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }); await p.goto(U, { waitUntil: 'networkidle' }); await p.screenshot({ path: 'previews/mobile.png', fullPage: true });
p = await b.newPage(); await p.goto(U, { waitUntil: 'networkidle' }); await p.emulateMedia({ media: 'print' });
await p.pdf({ path: 'previews/print-36x24.pdf', preferCSSPageSize: true, printBackground: true });
await p.goto(U + '?paper=tabloid', { waitUntil: 'networkidle' }); await p.pdf({ path: 'previews/print-tabloid.pdf', preferCSSPageSize: true, printBackground: true });
await b.close(); srv.close(); console.log('done');
