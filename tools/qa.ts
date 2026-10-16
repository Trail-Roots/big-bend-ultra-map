// QA: screenshots at 1440 / 390 / 360, horizontal-overflow check, race-card + station lightboxes, race filter, console errors.
import { chromium } from 'playwright';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch(), out = process.argv[2] ?? '/tmp/qa';
try {
  for (const w of [1440, 390, 360]) {
    const p = await b.newPage({ viewport: { width: w, height: w > 1000 ? 900 : 800 } }); const errs: string[] = [];
    p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.screenshot({ path: `${out}-${w}-top.png` });
    await p.locator('.racecards').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${out}-${w}-cards.png` });
    await p.click('.racecard[data-course="55K"] .rc-full'); await p.waitForTimeout(300);
    const ov2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await p.screenshot({ path: `${out}-${w}-racebox.png` }); await p.keyboard.press('Escape');
    await p.evaluate(() => document.querySelector("svg.timeline a.stlink[data-station=\"4\"]")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}-${w}-stbox.png` }); await p.keyboard.press('Escape');
    await p.locator('.layers').scrollIntoViewIfNeeded();
    await p.uncheck('input[data-race="100K"]'); await p.uncheck('input[data-race="20K"]'); await p.waitForTimeout(200);
    await p.locator('svg.timeline').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${out}-${w}-filter.png` });
    console.log(w, 'overflow', ov, 'overflow(lightbox)', ov2, 'errors', errs.length ? errs : 'none');
    await p.close();
  }
} finally { await b.close(); srv.stop(true); }
