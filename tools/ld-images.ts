// Event JSON-LD images: 16:9, 4:3 and 1:1 crops of a race photo from trailroots.com/big-bend-ultra (Squarespace CDN, 2500w source)
// -> site/public/ld/. Run: bun tools/ld-images.ts   (Playwright canvas, no extra deps)
import { chromium } from 'playwright'; import fs from 'fs'; import path from 'path';
const SRC = 'https://images.squarespace-cdn.com/content/v1/651066e0f885437899933f03/1731683754769-U8SEHQMGWD4RA9Z5LLNB/BigBendUltra2024-497.jpg?format=2500w';
const OUT = path.join(import.meta.dir, '../site/public/ld');
// [name, aspect w/h, output width, focus x 0..1, focus y 0..1] (the runner on the trail stays in frame; crops keep the race watermark whole, bottom right)
const CROPS: [string, number, number, number, number][] = [['bbu-16x9.jpg', 16 / 9, 1920, .5, 1], ['bbu-4x3.jpg', 4 / 3, 1600, 1, .5], ['bbu-1x1.jpg', 1, 1200, 1, .5]];
const buf = Buffer.from(await (await fetch(SRC)).arrayBuffer());
const b = await chromium.launch(), p = await b.newPage();
for (const [n, a, ow, fx, fy] of CROPS) {
  const data = await p.evaluate(async ({ src, a, ow, fx, fy }) => { const img = new Image(); img.src = src; await img.decode(); const W = img.naturalWidth, H = img.naturalHeight;
    let cw = W, ch = W / a; if (ch > H) { ch = H; cw = H * a; } const cx = Math.max(0, Math.min(W - cw, fx * W - cw / 2)), cy = Math.max(0, Math.min(H - ch, fy * H - ch / 2));
    const c = document.createElement('canvas'); c.width = ow; c.height = Math.round(ow / a); c.getContext('2d')!.drawImage(img, cx, cy, cw, ch, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .85); },
    { src: 'data:image/jpeg;base64,' + buf.toString('base64'), a, ow, fx, fy });
  fs.writeFileSync(path.join(OUT, n), Buffer.from(data.split(',')[1], 'base64')); console.log(n, ow + 'x' + Math.round(ow / a));
}
await b.close();
