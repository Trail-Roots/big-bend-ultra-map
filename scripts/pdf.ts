// Print the built site to dist/big-bend-ultra-2027-map.pdf (US Letter) with headless Chromium — same CSS as browser print.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from '../tools/serve';
import * as mupdf from 'mupdf'; // PDF -> JPEG print images + text checks (WASM; no poppler / apt in CI)
const D = path.resolve(import.meta.dir, '..', 'dist'), OUT = path.join(D, 'big-bend-ultra-2027-map.pdf');
// PDF render is skipped when its inputs are unchanged (CI restores dist outputs from actions/cache; see .github/workflows/pages.yml)
const srv = serveDist(0), b = await chromium.launch();
try {
  const p = await b.newPage(); await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready); await p.emulateMedia({ media: 'print' });
  // Operations (race-day timeline) prints last: move its section to the end of the page before rendering
  await p.evaluate(() => { const t = document.getElementById('timeline'); if (t) t.parentElement!.appendChild(t); });
  await p.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  // one PDF per course page (same CSS as "Print this course")
  for (const k of await p.$$eval('.coursepage', (e) => e.map((x) => (x as HTMLElement).dataset.course!))) {
    await p.evaluate((k) => { document.body.classList.add('printone'); document.querySelectorAll('.coursepage').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.course === k)); }, k);
    await p.pdf({ path: path.join(D, `course-${k}.pdf`), preferCSSPageSize: true, printBackground: true });
  }
  await p.evaluate(() => document.body.classList.remove('printone'));
  // thumbnails for the limited cards embed (cards-embed.html): each race card map as a small JPEG (Playwright only, no ffmpeg on CI)
  { const C = path.join(D, 'cards'); fs.mkdirSync(C, { recursive: true }); await p.emulateMedia({ media: 'screen' }); const q = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 }); await q.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' }); await q.addStyleTag({ content: '.rc-full{display:none!important}' });
    for (const k of await q.$$eval('.racecard', (e) => e.map((x) => (x as HTMLElement).dataset.course!))) { const el = q.locator(`.racecard[data-course="${k}"] .rc-map`); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(C, k + '.jpg'), type: 'jpeg', quality: 72 }); }
    await q.close(); console.log('cards embed thumbnails', fs.readdirSync(C).length); }
  // static image for hosts that strip scripts/iframes (RunSignup hotlinks dist/cards-embed.png/.jpg): the combined elevation profile (all races), 1200 CSS px wide at 2x
  { const q = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 }); await q.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' }); await q.evaluate(() => document.fonts.ready);
    // the profile alone on a blank white page (the live layout would overlap it at this size); hover layer off
    await q.evaluate(() => { const sv = document.querySelector('#pb-prof svg.profile')!.cloneNode(true) as SVGSVGElement, d = document.createElement('div'); d.id = 'solo';
      document.body.querySelectorAll(':scope > *').forEach((e) => (e as HTMLElement).style.display = 'none'); d.appendChild(sv); const ft = document.createElement('div'); ft.className = 'solofoot'; ft.innerHTML = '<span class="btn">Full race details at trailroots.com →</span>'; d.appendChild(ft); document.body.appendChild(d); window.scrollTo(0, 0); });
    await q.addStyleTag({ content: 'html,body{background:#fff!important;margin:0!important;padding:0!important}#solo{position:absolute;left:0;top:0;box-sizing:border-box;width:1200px;padding:12px;background:#fff}#solo svg.profile{display:block;width:1176px!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;box-shadow:none!important}#solo .solofoot{display:flex;justify-content:flex-end;align-items:center;margin-top:8px;font:400 15px/1.35 "Liberation Sans","Noto Sans",Arial,sans-serif;color:#666}#solo .solofoot .btn{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;background:#f4f4f4;border:1px solid #d4d4d4;border-radius:6px;color:#2a2a2a;font-weight:600;font-size:15px}#solo .hover,#solo .hov,#solo [class*="tip"]{display:none!important}' }); await q.mouse.move(1500, 990); await q.waitForTimeout(300);
    const el = q.locator("#solo"), bb = (await el.boundingBox())!; if (Math.round(bb.width) !== 1200) throw new Error('[cards-embed image] profile width ' + bb.width);
    await el.screenshot({ path: path.join(D, 'cards-embed.png'), type: 'png' }); await el.screenshot({ path: path.join(D, 'cards-embed.jpg'), type: 'jpeg', quality: 85 });
    await q.close(); console.log('cards embed image (elevation profile)', (fs.statSync(path.join(D, 'cards-embed.png')).size / 1024).toFixed(0) + ' KB png', (fs.statSync(path.join(D, 'cards-embed.jpg')).size / 1024).toFixed(0) + ' KB jpg'); }
} finally { await b.close(); srv.stop(true); }
console.log('pdf', path.relative(process.cwd(), OUT), (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
const pdfText = (n?: number) => { const doc = mupdf.Document.openDocument(fs.readFileSync(OUT), 'application/pdf'); let t = ''; for (let i = 0; i < doc.countPages(); i++) if (!n || i === n - 1) t += doc.loadPage(i).toStructuredText('preserve-whitespace').asText() + '\n'; return t; };
// print images for embed.js: a host page can't print the cross-origin iframe (it comes out blank), so embed.js prints these page images instead
{ const P = path.join(D, 'print'); fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P);
  const doc = mupdf.Document.openDocument(fs.readFileSync(OUT), 'application/pdf'), pages: string[] = [], files: string[] = [];
  for (let i = 0; i < doc.countPages(); i++) { const pg = doc.loadPage(i), [x0, y0, x1, y1] = pg.getBounds(), f = `p-${String(i + 1).padStart(2, '0')}.jpg`; pages.push(x1 - x0 > y1 - y0 ? 'L' : 'P');
    fs.writeFileSync(path.join(P, f), pg.toPixmap(mupdf.Matrix.scale(150 / 72, 150 / 72), mupdf.ColorSpace.DeviceRGB, false, true).asJPEG(82)); files.push(f); }
  if (files.length !== pages.length) throw new Error(`print images ${files.length} != pages ${pages.length}`);
  fs.writeFileSync(path.join(P, 'pages.json'), JSON.stringify(files.map((f, i) => ({ src: 'print/' + f, o: pages[i] }))));
  // expected page sequence (README): map | access + elevation | calendar | 5 race pages | 2 plans | 6 station pages | operations
  const EXPECT = 'PLP' + 'LLLLL' + 'PP' + 'PPPPPP' + 'L'; if (pages.join('') !== EXPECT) throw new Error(`[pdf] page sequence ${pages.join('')} != expected ${EXPECT}`);
  console.log('print images', files.length, pages.join('')); }
// PDF check: every aid-station print page carries its visible primary coordinates link text ("Map: lat, lng")
{ const st = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/stations.json'), 'utf8')), txt = pdfText();
  const miss = st.order.filter((k: string) => { const L = st.stations[k].link_lonlat ?? st.stations[k].lonlat; return !txt.includes(`Map: ${L[1].toFixed(5)}, ${L[0].toFixed(5)}`); });
  if (miss.length) throw new Error('[pdf] station pages without coordinates link: ' + miss.join(', '));
  console.log('pdf station coord links', st.order.length, 'ok'); }
// PDF check: the Register (RunSignup) line prints only while the site is a DRAFT (same flag as the watermark)
{ const draft = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/site.json'), 'utf8')).draft === true, txt = pdfText(2);
  if (txt.includes('runsignup.com/Race/Register') !== draft) throw new Error('[pdf] Register line on page 2 must be ' + (draft ? 'present (draft)' : 'absent (final)'));
  console.log('pdf register line', draft ? 'present (draft)' : 'absent (final)'); }
// PDF check: every aid-station page is a named destination for the internal links from station number graphics
{ const raw = fs.readFileSync(OUT).toString('latin1'), st = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/stations.json'), 'utf8'));
  const name = (k: string) => '/station-' + encodeURIComponent(k).replace(/%/g, '#25');
  const miss = st.order.filter((k: string) => !new RegExp(name(k).replace(/[#/]/g, '\\$&') + ' ?\\[').test(raw)), links = (raw.match(/\/Dest \/station-/g) || []).length;
  if (miss.length || !links) throw new Error('[pdf] station page destinations missing: ' + miss.join(', ') + ' links ' + links);
  console.log('pdf internal station links', links, '-> 6 station pages'); }
