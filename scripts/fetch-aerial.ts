// Aerial backdrops for the logistics site plans: USGS National Map orthoimagery (public domain), exported in Web Mercator.
// bun scripts/fetch-aerial.ts -> sources/curated/aerial/<plan>.jpg + <plan>.json (bbox in EPSG:3857). Committed; the build reads the copies.
import fs from 'node:fs';
import path from 'node:path';
const R = 6378137, mx = (lon: number) => (lon * Math.PI / 180) * R, my = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
export const PLANS: Record<string, { ll: [number, number, number, number]; px: number }> = {
  finish: { ll: [-103.75955, 29.26905, -103.75625, 29.27115], px: 1800 },
  parking: { ll: [-103.76125, 29.26835, -103.75125, 29.27425], px: 1800 },
};
const DIR = path.join(import.meta.dir, '..', 'sources', 'curated', 'aerial'); fs.mkdirSync(DIR, { recursive: true });
for (const [k, p] of Object.entries(PLANS)) {
  const b = [mx(p.ll[0]), my(p.ll[1]), mx(p.ll[2]), my(p.ll[3])], h = Math.round((p.px * (b[3] - b[1])) / (b[2] - b[0]));
  const url = `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export?bbox=${b.join(',')}&bboxSR=3857&imageSR=3857&size=${p.px},${h}&format=jpg&f=image`;
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(path.join(DIR, `${k}.jpg`), Buffer.from(await r.arrayBuffer()));
  fs.writeFileSync(path.join(DIR, `${k}.json`), JSON.stringify({ source: 'USGS The National Map — USGSImageryOnly (public domain)', bbox_3857: b, size: [p.px, h], fetched: new Date().toISOString() }));
  console.log(k, p.px, h);
}
// muted backdrop baked into the JPEG (light blur, low saturation, white wash) so the PDF embeds a plain image, not an SVG filter
{ const { chromium } = await import('playwright'); const b = await chromium.launch(), p = await b.newPage();
  for (const k of Object.keys(PLANS)) {
    const src = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, `${k}.jpg`)).toString('base64');
    const out: string = await p.evaluate(async (src) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d')!;
      g.filter = 'blur(1.4px) saturate(0.3)'; g.drawImage(im, 0, 0); g.filter = 'none'; g.fillStyle = 'rgba(247,243,234,0.58)'; g.fillRect(0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.82); }, src);
    fs.writeFileSync(path.join(DIR, `${k}_muted.jpg`), Buffer.from(out.split(',')[1], 'base64'));
  }
  await b.close(); }
