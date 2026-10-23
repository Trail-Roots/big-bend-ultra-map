// Local-only QA (not CI): regional map labels vs lines, point markers, other labels and the frame edge.
// Web: main map fully zoomed out at desktop + phone size. PDF: the regional page SVG from dist/index.html.
// usage: bun tools/region-labels-check.ts [--shot]
import { chromium, type Page } from 'playwright';
import { serveDist } from './serve';
const CLEAR = +(process.env.CLEAR ?? 2); // px clearance around each label box
// containment rings (output coords) written by the build to node_modules/.cache/rg-check-{web,pdf}.json
const RINGS = { web: await Bun.file('node_modules/.cache/rg-check-web.json').json(), pdf: await Bun.file('node_modules/.cache/rg-check-pdf.json').json() };
const audit = (root: string, rings: any) => (p: Page) => p.evaluate(([sel, clr, R]) => {
  const svg = document.querySelector(sel as string) as SVGSVGElement, sr = svg.getBoundingClientRect(), c = +clr;
  const skip = (e: Element) => !!e.closest('g.legend, g.scalebar, g.north, g.marker, use, g.zctl, defs, clipPath, [data-layer="dots"], [data-layer="tint"]');
  const vis = (e: Element) => (e as any).checkVisibility ? (e as any).checkVisibility({ checkVisibilityCSS: true }) : true;
  const boxes = (t: SVGTextElement): DOMRect[] => { if (!t.querySelector('textPath')) return [t.getBoundingClientRect()]; const m = t.getScreenCTM()!, o: DOMRect[] = [];
    for (let k = 0; k < t.getNumberOfChars(); k++) { let e: DOMRect; try { e = t.getExtentOfChar(k); } catch { continue; } if (!e.width) continue; const q = [[e.x, e.y], [e.x + e.width, e.y], [e.x, e.y + e.height], [e.x + e.width, e.y + e.height]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const xs = q.map((v) => v[0]), ys = q.map((v) => v[1]); o.push(new DOMRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))); } return o; };
  const uni = (rs: DOMRect[]) => { const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top)); return new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t); };
  const ov = (a: DOMRect, b: DOMRect, p = 0) => a.left < b.right + p && b.left < a.right + p && a.top < b.bottom + p && b.top < a.bottom + p;
  const T = [...svg.querySelectorAll('text')].filter((t) => !skip(t) && vis(t) && (t.textContent || '').trim()).map((t) => { const b0 = t.getBoundingClientRect(), rs = b0.width ? boxes(t) : []; return { el: t, s: (t.textContent || '').trim().slice(0, 34), rs, r: rs.length ? uni(rs) : b0 }; }).filter((a) => a.r.width > 0 && a.r.right > sr.left && a.r.left < sr.right && a.r.bottom > sr.top && a.r.top < sr.bottom);
  const out: string[] = [];
  for (const a of T) if (a.r.left < sr.left - 0.5 || a.r.right > sr.right + 0.5 || a.r.top < sr.top - 0.5 || a.r.bottom > sr.bottom + 0.5) out.push(`CLIPPED ${a.s}`);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { if (ov(T[i].r, T[j].r) && T[i].rs.some((a) => T[j].rs.some((b) => ov(a, b)))) out.push(`LABEL ${T[i].s} x ${T[j].s}`); }
  const G = [...svg.querySelectorAll('path, line, polyline, polygon')].filter((e) => !skip(e) && vis(e) && getComputedStyle(e).stroke !== 'none' && parseFloat(getComputedStyle(e).strokeWidth) > 0 && getComputedStyle(e).strokeOpacity !== '0') as SVGGeometryElement[];
  for (const g of G) {
    let len = 0; try { len = g.getTotalLength(); } catch { continue; }
    const m = g.getScreenCTM(); if (!m || !len) continue;
    const sc = Math.hypot(m.a, m.b), n = Math.min(20000, Math.ceil(len * sc / 1.5)), own = g.closest('g.rg-pt');
    const near = T.filter((t) => !(own && own.contains(t.el)));
    const hit = new Set<string>();
    for (let k = 0; k <= n; k++) { const q = g.getPointAtLength(len * k / n), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
      if (x < sr.left || x > sr.right || y < sr.top || y > sr.bottom) continue;
      for (const t of near) if (x > t.r.left - c && x < t.r.right + c && y > t.r.top - c && y < t.r.bottom + c && t.rs.some((r) => x > r.left - c && x < r.right + c && y > r.top - c && y < r.bottom + c)) hit.add(t.s); }
    const id = (g.closest('[data-layer]')?.getAttribute('data-layer') ? 'layer:' + g.closest('[data-layer]')!.getAttribute('data-layer') + ' ' : '') + (g.getAttribute('class') || g.closest('[class]')?.getAttribute('class') || g.tagName).slice(0, 24);
    for (const h of hit) out.push(`LINE ${h} x ${id}`);
  }
  // point markers (towns, hospital, towers, stations, S/F, runways drawn as rects/circles/uses) vs labels of other groups
  const M = [...svg.querySelectorAll('circle, rect, use, g.marker, g.rg-plane path')].filter((e) => !e.closest('g.legend, g.scalebar, g.north, defs, clipPath, [data-layer="tint"], g.marker g.marker') && vis(e) && !(e.parentElement?.closest('g.marker') && e.tagName !== 'g'))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.width < 60 && r.height < 60);
  for (const { e, r } of M) { const own = e.closest('g.rg-pt');
    for (const t of T) if (!(own && own.contains(t.el)) && t.rs.some((q) => ov(r, q, c)))
      out.push(`MARK ${t.s} x ${(e.getAttribute('class') || e.closest('[class]')?.getAttribute('class') || e.tagName).slice(0, 24)}`); }
  // area labels inside their own polygon; BREWSTER COUNTY required; every US label north of the border (only MEXICO, the Rio Grande and the S/F drive-time panel may sit south)
  const Rg = R as any, pip = (x: number, y: number, r: number[][]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
  const labs = [...svg.querySelectorAll('[data-lid]')].filter(vis);
  if (!labs.some((e) => e.getAttribute('data-lid') === 'BREWSTER COUNTY')) out.push('MISSING BREWSTER COUNTY');
  for (const e of labs) { const id = e.getAttribute('data-lid')!, m = e.parentElement!.getScreenCTM()!.inverse(), pts: [number, number][] = [];
    for (const t of (e.tagName === 'text' ? [e] : [...e.querySelectorAll('text')]) as SVGTextElement[]) for (const r of boxes(t)) { for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]) pts.push([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]); }
    const allIn = (rs: number[][][]) => pts.every(([x, y]) => rs.some((r) => pip(x, y, r)));
    if (Rg.county[id] && !allIn([Rg.county[id]])) out.push(`AREA ${id} not inside its county`);
    if (id === 'park' && !allIn(Rg.park)) out.push('AREA park label not inside the park');
    if (id === 'MEXICO' && !allIn([Rg.mexico])) out.push('AREA MEXICO not south of the border');
    if (!['MEXICO', 'Rio Grande', 'sf'].includes(id) && pts.some(([x, y]) => pip(x, y, Rg.mexico))) out.push(`BORDER ${id} label south of the border`); }
  const np = svg.querySelectorAll('g.rg-plane').length, nf = svg.querySelectorAll('g.rg-fuel').length;
  if (np !== 6) out.push(`ICONS ${np} airstrip icons (want 6)`); if (nf !== 5) out.push(`ICONS ${nf} fuel icons (want 5)`);
  return [...new Set(out)];
}, [root, CLEAR, rings] as const);
const srv = serveDist(0), b = await chromium.launch(), url = `http://localhost:${srv.port}/`, shot = process.argv.includes('--shot');
let bad = 0;
for (const [name, w, h] of [['desktop', 1400, 1000], ['phone', 390, 844]] as const) {
  const p = await b.newPage({ viewport: { width: w, height: h } }); await p.goto(url, { waitUntil: 'networkidle' });
  const host = p.locator('svg.mainmap').first(); await host.scrollIntoViewIfNeeded();
  // every zoom-out step: hospital / Alpine / airstrip icons must never collide
  const step: string[] = [];
  for (let i = 0; i < 10; i++) { await p.locator('.zctl button[data-z="out"]').first().click(); await p.waitForTimeout(450);
    if (await p.locator('svg.mainmap g.rg-top').first().isVisible().catch(() => false)) for (const q of await audit('svg.mainmap', RINGS.web)(p)) if (/^(MARK|LABEL|LINE) (Big Bend Regional|Medical Center|Alpine)( x|$)|x (Big Bend Regional|Medical Center|Alpine)$/.test(q)) step.push(`step ${i + 1}: ${q}`); }
  await p.waitForTimeout(1200);
  const r = [...new Set([...step.filter((q) => !/step 10:/.test(q)), ...await audit('svg.mainmap', RINGS.web)(p)])]; bad += r.length; console.log(`web ${name}:`, r.length ? r : 'ok');
  if (shot) await host.screenshot({ path: `/tmp/rg-${name}.png` }); await p.close();
}
{ const html = await Bun.file('dist/index.html').text(), m = html.match(/<svg class="regionmap"[\s\S]*?<\/svg>(?=<\/div>)/);
  const p = await b.newPage({ viewport: { width: 1143, height: 1418 } }); await p.setContent(`<style>body{margin:0;font-family:sans-serif}</style>${m![0]}`); await p.waitForTimeout(300);
  const r = await audit('svg.regionmap', RINGS.pdf)(p); bad += r.length; console.log('pdf page:', r.length ? r : 'ok'); await p.close(); }
await b.close(); srv.stop(true); process.exit(bad ? 1 : 0);
