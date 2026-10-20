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
  // static image of the cards embed for hosts that strip scripts/iframes (RunSignup): dist/cards-embed.png + .jpg, 1200 px wide
  { const q = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 }); await q.goto(`http://localhost:${srv.port}/cards-embed.html`, { waitUntil: 'networkidle' }); await q.addStyleTag({ content: 'body,body *{font-family:"Liberation Sans","Noto Sans",Arial,sans-serif!important}' }); // CI has no system-ui font and falls back to wide DejaVu, which wraps card text await q.evaluate(() => document.fonts.ready);
    const h = await q.evaluate(() => Math.ceil(Math.max(...[...document.body.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom + scrollY)) + 4));
    for (const [t, o] of [['png', {}], ['jpeg', { quality: 82 }]] as const) await q.screenshot({ path: path.join(D, 'cards-embed.' + (t === 'png' ? 'png' : 'jpg')), type: t, clip: { x: 0, y: 0, width: 1200, height: h }, ...o });
    const w = await q.evaluate(() => document.documentElement.scrollWidth); if (w > 1200) throw new Error('[cards-embed image] page wider than 1200 px: ' + w);
    await q.close(); console.log('cards embed image', (fs.statSync(path.join(D, 'cards-embed.png')).size / 1024).toFixed(0) + ' KB png', (fs.statSync(path.join(D, 'cards-embed.jpg')).size / 1024).toFixed(0) + ' KB jpg'); }
} finally { await b.close(); srv.stop(true); }
console.log('pdf', path.relative(process.cwd(), OUT), (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
// print images for embed.js: a host page can't print the cross-origin iframe (it comes out blank), so embed.js prints these page images instead
{ const P = path.join(D, 'print'); fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P);
  const r = Bun.spawnSync(['pdftoppm', '-r', '150', '-jpeg', '-jpegopt', 'quality=82', OUT, path.join(P, 'p')]); if (r.exitCode) throw new Error('pdftoppm failed: ' + r.stderr);
  const info = new TextDecoder().decode(Bun.spawnSync(['pdfinfo', '-f', '1', '-l', '99', OUT]).stdout), pages = [...info.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+)/g)].map((m) => +m[1] > +m[2] ? 'L' : 'P');
  const files = fs.readdirSync(P).filter((f) => f.endsWith('.jpg')).sort();
  if (files.length !== pages.length) throw new Error(`print images ${files.length} != pages ${pages.length}`);
  fs.writeFileSync(path.join(P, 'pages.json'), JSON.stringify(files.map((f, i) => ({ src: 'print/' + f, o: pages[i] }))));
  // expected page sequence (README): map | access + elevation | calendar | timeline | 5 race pages | 2 plans | 6 station pages
  const EXPECT = 'PLPL' + 'LLLLL' + 'PP' + 'PPPPPP'; if (pages.join('') !== EXPECT) throw new Error(`[pdf] page sequence ${pages.join('')} != expected ${EXPECT}`);
  console.log('print images', files.length, pages.join('')); }
// PDF check: every aid-station print page carries its visible primary coordinates link text ("Map: lat, lng")
{ const st = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/stations.json'), 'utf8')), txt = new TextDecoder().decode(Bun.spawnSync(['pdftotext', '-layout', OUT, '-']).stdout);
  const miss = st.order.filter((k: string) => { const L = st.stations[k].link_lonlat ?? st.stations[k].lonlat; return !txt.includes(`Map: ${L[1].toFixed(5)}, ${L[0].toFixed(5)}`); });
  if (miss.length) throw new Error('[pdf] station pages without coordinates link: ' + miss.join(', '));
  console.log('pdf station coord links', st.order.length, 'ok'); }
// PDF check: the Register (RunSignup) line prints only while the site is a DRAFT (same flag as the watermark)
{ const draft = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/site.json'), 'utf8')).draft === true, txt = new TextDecoder().decode(Bun.spawnSync(['pdftotext', '-f', '2', '-l', '2', OUT, '-']).stdout);
  if (txt.includes('runsignup.com/Race/Register') !== draft) throw new Error('[pdf] Register line on page 2 must be ' + (draft ? 'present (draft)' : 'absent (final)'));
  console.log('pdf register line', draft ? 'present (draft)' : 'absent (final)'); }
// PDF check: every aid-station page is a named destination for the internal links from station number graphics
{ const raw = fs.readFileSync(OUT).toString('latin1'), st = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/stations.json'), 'utf8'));
  const name = (k: string) => '/station-' + encodeURIComponent(k).replace(/%/g, '#25');
  const miss = st.order.filter((k: string) => !new RegExp(name(k).replace(/[#/]/g, '\\$&') + ' ?\\[').test(raw)), links = (raw.match(/\/Dest \/station-/g) || []).length;
  if (miss.length || !links) throw new Error('[pdf] station page destinations missing: ' + miss.join(', ') + ' links ' + links);
  console.log('pdf internal station links', links, '-> 6 station pages'); }
