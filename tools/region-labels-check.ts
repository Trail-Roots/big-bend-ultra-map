// Local-only QA (not CI): regional map labels vs lines, point markers, other labels and the frame edge.
// Web: main map fully zoomed out at desktop + phone size. PDF: the regional page SVG from dist/index.html.
// usage: bun tools/region-labels-check.ts [--shot]
import { chromium, type Page } from 'playwright';
import { serveDist } from './serve';
const CLEAR = +(process.env.CLEAR ?? 2); // px clearance around each label box
const audit = (root: string) => (p: Page) => p.evaluate(([sel, clr]) => {
  const svg = document.querySelector(sel as string) as SVGSVGElement, sr = svg.getBoundingClientRect(), c = +clr;
  const skip = (e: Element) => !!e.closest('g.legend, g.scalebar, g.north, g.marker, use, g.zctl, defs, clipPath, [data-layer="dots"], [data-layer="tint"]');
  const vis = (e: Element) => (e as any).checkVisibility ? (e as any).checkVisibility({ checkVisibilityCSS: true }) : true;
  const T = [...svg.querySelectorAll('text')].filter((t) => !skip(t) && vis(t) && (t.textContent || '').trim()).map((t) => ({ el: t, s: (t.textContent || '').trim().slice(0, 34), r: t.getBoundingClientRect() })).filter((a) => a.r.width > 0 && a.r.right > sr.left && a.r.left < sr.right && a.r.bottom > sr.top && a.r.top < sr.bottom);
  const out: string[] = [];
  for (const a of T) if (a.r.left < sr.left - 0.5 || a.r.right > sr.right + 0.5 || a.r.top < sr.top - 0.5 || a.r.bottom > sr.bottom + 0.5) out.push(`CLIPPED ${a.s}`);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i].r, b = T[j].r; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`LABEL ${T[i].s} x ${T[j].s}`); }
  const G = [...svg.querySelectorAll('path, line, polyline, polygon')].filter((e) => !skip(e) && vis(e) && getComputedStyle(e).stroke !== 'none' && parseFloat(getComputedStyle(e).strokeWidth) > 0 && getComputedStyle(e).strokeOpacity !== '0') as SVGGeometryElement[];
  for (const g of G) {
    let len = 0; try { len = g.getTotalLength(); } catch { continue; }
    const m = g.getScreenCTM(); if (!m || !len) continue;
    const sc = Math.hypot(m.a, m.b), n = Math.min(20000, Math.ceil(len * sc / 1.5)), own = g.closest('g.rg-pt');
    const near = T.filter((t) => !(own && own.contains(t.el)));
    const hit = new Set<string>();
    for (let k = 0; k <= n; k++) { const q = g.getPointAtLength(len * k / n), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
      if (x < sr.left || x > sr.right || y < sr.top || y > sr.bottom) continue;
      for (const t of near) if (x > t.r.left - c && x < t.r.right + c && y > t.r.top - c && y < t.r.bottom + c) hit.add(t.s); }
    const id = (g.getAttribute('class') || g.closest('[class]')?.getAttribute('class') || g.tagName).slice(0, 24);
    for (const h of hit) out.push(`LINE ${h} x ${id}`);
  }
  // point markers (towns, hospital, towers, stations, S/F, runways drawn as rects/circles/uses) vs labels of other groups
  const M = [...svg.querySelectorAll('circle, rect, use, g.marker')].filter((e) => !e.closest('g.legend, g.scalebar, g.north, defs, clipPath, [data-layer="tint"], g.marker g.marker') && vis(e) && !(e.parentElement?.closest('g.marker') && e.tagName !== 'g'))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.width < 60 && r.height < 60);
  for (const { e, r } of M) { const own = e.closest('g.rg-pt');
    for (const t of T) if (!(own && own.contains(t.el)) && r.left < t.r.right + c && t.r.left < r.right + c && r.top < t.r.bottom + c && t.r.top < r.bottom + c)
      out.push(`MARK ${t.s} x ${(e.getAttribute('class') || e.closest('[class]')?.getAttribute('class') || e.tagName).slice(0, 24)}`); }
  return [...new Set(out)];
}, [root, CLEAR] as const);
const srv = serveDist(0), b = await chromium.launch(), url = `http://localhost:${srv.port}/`, shot = process.argv.includes('--shot');
let bad = 0;
for (const [name, w, h] of [['desktop', 1400, 1000], ['phone', 390, 844]] as const) {
  const p = await b.newPage({ viewport: { width: w, height: h } }); await p.goto(url, { waitUntil: 'networkidle' });
  const host = p.locator('svg.mainmap').first(); await host.scrollIntoViewIfNeeded();
  for (let i = 0; i < 10; i++) { await p.locator('.zctl button[data-z="out"]').first().click(); await p.waitForTimeout(120); }
  await p.waitForTimeout(1200);
  const r = await audit('svg.mainmap')(p); bad += r.length; console.log(`web ${name}:`, r.length ? r : 'ok');
  if (shot) await host.screenshot({ path: `/tmp/rg-${name}.png` }); await p.close();
}
{ const html = await Bun.file('dist/index.html').text(), m = html.match(/<svg class="regionmap"[\s\S]*?<\/svg>(?=<\/div>)/);
  const p = await b.newPage({ viewport: { width: 1143, height: 1418 } }); await p.setContent(`<style>body{margin:0;font-family:sans-serif}</style>${m![0]}`); await p.waitForTimeout(300);
  const r = await audit('svg.regionmap')(p); bad += r.length; console.log('pdf page:', r.length ? r : 'ok'); await p.close(); }
await b.close(); srv.stop(true); process.exit(bad ? 1 : 0);
