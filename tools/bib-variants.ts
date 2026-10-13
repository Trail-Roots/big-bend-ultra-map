// Mockup sheet of start-indicator bib variants at actual on-page bib size: bun tools/bib-variants.ts
import { chromium } from 'playwright';
import fs from 'node:fs';
import { bib, BIB, type BibStyle } from '../site/lib/panels';
import { serveDist } from './serve';
const courses = JSON.parse(fs.readFileSync('content/courses.json', 'utf8')), colors = JSON.parse(fs.readFileSync('content/colors.json', 'utf8'));
const styles: [BibStyle, string][] = [['band', 'A · START band + time'], ['bandtime', 'B · START + time in band'], ['stopwatch', 'C · stopwatch + time'], ['flag', 'D · start flag + time']];
// actual size: same px-per-pt as the mini maps on a 1600 px desktop
const srv = serveDist(0), b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
const k = await p.$eval('svg.mini', (s: any) => s.getBoundingClientRect().width / s.viewBox.baseVal.width);
const gw = (BIB.w + 14) * courses.order.length, gh = BIB.h + 30;
let html = `<body style="margin:12px;font:13px DejaVu Sans,sans-serif;background:#fff"><link rel="stylesheet" href="styles.css">`;
for (const [st, label] of styles) {
  let g = ''; courses.order.forEach((c: string, i: number) => (g += bib(c, courses.courses[c].start, courses.colors[c], 0, 0, colors, st, [i * (BIB.w + 14), 22])));
  html += `<div style="margin:6px 0 14px"><b>${label}</b>${st === 'band' ? ' (default)' : ''}<br><svg viewBox="0 0 ${gw} ${gh}" width="${gw * k}" height="${gh * k}">${g}</svg></div>`;
}
html += `<p style="color:#777">actual size at 1600 px desktop (${k.toFixed(2)} px per pt); print size is 86×72 pt × page zoom</p></body>`;
fs.writeFileSync('dist/_bibs.html', html);
await p.goto(`http://localhost:${srv.port}/_bibs.html`, { waitUntil: 'networkidle' });
await p.setViewportSize({ width: Math.ceil(gw * k + 40), height: 600 });
await p.screenshot({ path: 'previews/start-indicator-variants.png', fullPage: true });
fs.rmSync('dist/_bibs.html'); await b.close(); srv.stop(true); console.log('previews/start-indicator-variants.png', k.toFixed(2));
