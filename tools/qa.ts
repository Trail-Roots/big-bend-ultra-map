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
    // every station lightbox must show a visible primary coordinates link (google.com/maps?q=lat,lng, text "Map: lat, lng")
    const noCoord: string[] = [];
    for (const k of ['S/F', '1', '2', '3', '4', '5']) {
      await p.evaluate((k) => document.querySelector(`a.stlink[data-station="${k}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })), k); await p.waitForTimeout(250);
      const ok = await p.evaluate(() => { const a = document.querySelector<HTMLAnchorElement>('#stationbox[open] a.st-coord'); if (!a) return false; const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
        return r.width > 20 && r.height > 8 && cs.visibility !== 'hidden' && cs.display !== 'none' && /maps\?q=-?\d+\.\d+,-?\d+\.\d+$/.test(a.href) && /^Map: -?\d+\.\d+, -?\d+\.\d+$/.test(a.textContent!.trim()); });
      if (!ok) noCoord.push(k); await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
    // heat maps: ONE source (heatSeries) — station lightbox / print rows match the page-1 row cell for cell (same bins, same bins); race pages are subsets at the same x
    if (w === 1440) { const bad = await p.evaluate(() => { const out: string[] = []; const cells = (g: Element | null) => g ? [...g.querySelectorAll('rect.hc')].map((r) => { const W = (r.ownerSVGElement as SVGSVGElement).viewBox.baseVal.width; void W; return r.getAttribute('data-i') + '@' + r.getAttribute('fill-opacity'); }) : [];
      for (const k of ['S/F', '1', '2', '3', '4', '5']) { const main = cells(document.querySelector(`svg.timeline g.tlst[data-station="${k}"]`)).join(',');
        const t = document.getElementById(`st-${k === 'S/F' ? 'SF' : k}`) as HTMLTemplateElement, st = cells(t.content.querySelector('svg.stheat g.tlst')).join(','), pr = cells(document.querySelector(`.sec-stpages .stpage[data-st="${k}"] svg.stheat g.tlst`)).join(',');
        if (st !== main) out.push(k + ' lightbox'); if (pr !== main) out.push(k + ' print');
        document.querySelectorAll(`svg.raceheat g.tlst[data-station="${k}"]`).forEach((g) => { const m = new Set(main.split(',').map((x) => x.split('@')[0])); if (cells(g).some((x) => !m.has(x.split('@')[0]))) out.push(k + ' race ' + g.closest('svg')!.getAttribute('data-course')); }); }
      return out; }); if (bad.length) throw new Error('[qa] heat rows differ from page 1: ' + bad.join(', ')); console.log('heat rows match page 1 cell for cell (6 stations; lightbox, print, race pages)'); }
    if (noCoord.length) throw new Error(`[qa ${w}] station lightbox without visible coordinates link: ${noCoord.join(', ')}`);
    await p.click('.navlayers > summary');
    await p.uncheck('input[data-race="100K"]'); await p.uncheck('input[data-race="20K"]'); await p.waitForTimeout(600); await p.screenshot({ path: `${out}-${w}-panel.png` }); await p.click('.navlayers > summary');
    await p.locator('svg.profile').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${out}-${w}-filter.png` }); await p.click('[data-open-plan="fin"]'); await p.waitForTimeout(400); await p.screenshot({ path: `${out}-${w}-finish.png` }); await p.keyboard.press('Escape');
    // milestone strips: every label inside its frame (no clipped text) in every rendered variant; print variant checked under print media
    const msClip = (sel: string) => p.evaluate((sel) => { const bad: string[] = []; document.querySelectorAll<SVGSVGElement>(sel).forEach((svg) => { const R = svg.getBoundingClientRect(); if (!R.width) return; svg.querySelectorAll<SVGGraphicsElement>('text').forEach((t) => { const b = t.getBoundingClientRect(); if (b.left < R.left - 0.5 || b.right > R.right + 0.5 || b.top < R.top - 0.5 || b.bottom > R.bottom + 0.5) bad.push(svg.getAttribute('class') + ' ' + svg.dataset.course + ': ' + t.textContent); }); }); return bad; }, sel); /* screen rects: catches text in transformed groups (station numbers) too */
    for (const v of ['msl-w', 'msl-c', 'msl-p']) { if (v === 'msl-p') await p.emulateMedia({ media: 'print' }); const bad = await msClip('svg.msline.' + v); if (v === 'msl-p') await p.emulateMedia({ media: 'screen' }); if (bad.length) throw new Error('[qa] milestone text clipped: ' + [...new Set(bad)].slice(0, 8).join(' | ')); }
    { const vis = await p.evaluate(() => [...document.querySelectorAll<SVGSVGElement>('svg.msline')].filter((s) => s.getBoundingClientRect().width > 0).map((s) => { const r = s.getBoundingClientRect(), pr = s.closest('figure')!.getBoundingClientRect(); return Math.abs(r.width - pr.width); })); if (vis.some((d) => d > 1)) throw new Error('[qa] milestone strip narrower than its figure'); }
    console.log(w, 'station coord links 6/6', 'overflow', ov, 'overflow(lightbox)', ov2, 'errors', errs.length ? errs : 'none');
    await p.close();
  }
} finally { await b.close(); srv.stop(true); }
