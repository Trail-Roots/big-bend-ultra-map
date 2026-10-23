// LOCAL ONLY (not in CI): measure the embed reserved-height table and write site/embed-heights.json (committed).
// Re-run after any layout change that can change the embed height:  bun run site && bun tools/heights.ts && bun run site
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch();
try {
  // embed.js reserves the iframe's real height before it loads (no layout shift on the host): ?view=embed&h=auto content height per width
  // per container width AND host viewport height (the layout uses the host's vh), so a phone or a short laptop gets its own exact height
  { const HT: number[][] = [], HH = Array.from({ length: 16 }, (_, i) => 550 + i * 50), q = await b.newPage({ viewport: { width: 1920, height: 900 } });
    // measured as the iframe document itself sees it: ?view=embed&h=auto with the host viewport set (as embed.js passes it), the frame's own
    // viewport iterated to the fixed point the loader would settle on (frame height = reported content height)
    await q.goto(`http://localhost:${srv.port}/?view=embed&h=auto&hw=1920&hh=900`, { waitUntil: 'networkidle' }); await q.evaluate(() => document.fonts.ready);
    const W: number[] = []; for (let w = 300; w < 560; w += 5) W.push(w); for (let w = 560; w <= 1300; w += 20) W.push(w); // phones: 5 px steps (text wrapping makes height a step function of width) W.push(1440, 1600, 1920);
    const measure = async (w: number, hw: number, hh: number) => { await q.evaluate(([hw, hh]) => { const r = document.documentElement.style; r.setProperty('--host-vw', hw / 100 + 'px'); r.setProperty('--host-vh', hh / 100 + 'px'); }, [hw, hh]);
      let h = 0, fh = 100; for (let t = 0; t < 8; t++) { await q.setViewportSize({ width: w, height: fh }); await q.evaluate(() => dispatchEvent(new Event('resize'))); await q.waitForTimeout(150);
        h = await q.evaluate(() => document.documentElement.scrollHeight); if (h === fh) break; fh = h; } return h; };
    // S: height change per px of host width beyond the container (a host page with side margins: its vw is wider than the frame)
    const S: number[] = [];
    for (const w of W) { const row = [w]; for (const hh of HH) row.push(await measure(w, w, hh)); HT.push(row);
      S.push(+(((await measure(w, w + 50, 900)) - row[1 + HH.indexOf(900)]) / 50).toFixed(3)); }
    await q.close();
    fs.writeFileSync(path.join(import.meta.dir, '../site/embed-heights.json'), JSON.stringify({ hh: HH, w: HT, s: S }) + '\n'); console.log('embed heights', HT.map((x) => x.join(':')).join(' ')); }
} finally { await b.close(); srv.stop(true); }
