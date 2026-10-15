// Index Erik's floor-plan drawing (sources/floorplan.svg) for the build: samples every drawn outline and text box into
// root SVG units (sources/floorplan.index.json), so the plans can collision-check our overlay labels against the drawing
// without a browser at build time. Re-run after replacing the SVG:  bun scripts/floorplan-index.ts
import { chromium } from 'playwright';
const HIDE = ['layer-water-spigot', 'layer-picnic-area']; // replaced by our own labels (readability / pavement-edge fixes)
const s = await Bun.file('sources/floorplan.svg').text();
const br = await chromium.launch(); const pg = await br.newPage();
await pg.setContent(`<body>${s.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '')}</body>`);
const out = await pg.evaluate((HIDE) => {
  const root = document.querySelector('svg')!, rm = root.getCTM()!.inverse(), R = (v: number) => Math.round(v * 10) / 10;
  const hidden = (el: Element) => HIDE.some((h) => el.closest('#' + h));
  const lines: number[][][] = [], texts: number[][][] = [];
  for (const el of root.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')) {
    const g = el as SVGGeometryElement; if (hidden(el)) continue; const L = g.getTotalLength(); if (!(L > 0) || L > 20000) continue; // skip the 24000-unit page frame
    const m = rm.multiply(g.getCTM()!), n = Math.max(2, Math.ceil(L / 3)), pts: number[][] = [];
    for (let i = 0; i <= n; i++) { const q = g.getPointAtLength((L * i) / n).matrixTransform(m); pts.push([R(q.x), R(q.y)]); }
    lines.push(pts); }
  for (const t of root.querySelectorAll('text')) { if (hidden(t)) continue; const b = (t as SVGTextElement).getBBox(), m = rm.multiply((t as SVGTextElement).getCTM()!);
    texts.push([[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]].map(([x, y]) => { const p = root.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(m); return [R(q.x), R(q.y)]; })); }
  return { lines, texts }; }, HIDE);
await br.close();
await Bun.write('sources/floorplan.index.json', JSON.stringify({ hide: HIDE, ...out }));
console.log(`floorplan index: ${out.lines.length} outlines, ${out.texts.length} texts`);
