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
// PDF check: every aid-station page is a named destination for the internal links from station number graphics
{ const raw = fs.readFileSync(OUT).toString('latin1'), st = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../content/stations.json'), 'utf8'));
  const name = (k: string) => '/station-' + encodeURIComponent(k).replace(/%/g, '#25');
  const miss = st.order.filter((k: string) => !new RegExp(name(k).replace(/[#/]/g, '\\$&') + ' ?\\[').test(raw)), links = (raw.match(/\/Dest \/station-/g) || []).length;
  if (miss.length || !links) throw new Error('[pdf] station page destinations missing: ' + miss.join(', ') + ' links ' + links);
  console.log('pdf internal station links', links, '-> 6 station pages'); }
