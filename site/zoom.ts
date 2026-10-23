// Web-only zoom & pan for the main map and the mini maps.
// The map content sits in <g class="zv">; legend, logo, bib and frame stay outside and never move.
// Markers, arrows and labels are counter-scaled about their anchor so they keep a constant on-screen size.
import { icon } from './lib/icons';
const MAX = 8;
type Z = { kmin: number; rb: number[] | null; rgState?: 0 | 1 | 2; svg: SVGSVGElement; g: SVGGElement; W: number; H: number; k: number; tx: number; ty: number; items: { el: SVGGraphicsElement; base: string; cx: number; cy: number }[]; texts: { el: SVGTextElement; fs: number; sw: number }[] };
const Zs = new Map<SVGSVGElement, Z>();
/** current zoom factor of an svg (1 when not zoomable) */
export const zoomOf = (svg: Element | null) => (svg && Zs.get(svg as SVGSVGElement)?.k) || 1;

const COUNTER = 'g.rg-pt, g.marker, use.marker, path.arrow, g.stlabel, g.poilabel, g.turn, g.zoombox text, text';
function collect(z: Z, root: Element = z.g) {
  const seen = new Set<Element>();
  root.querySelectorAll<SVGGraphicsElement>(COUNTER).forEach((el) => {
    // skip anything already inside a counter-scaled group
    for (let p: Element | null = el.parentElement; p && p !== z.g; p = p.parentElement) if (seen.has(p)) return;
    if (el.closest('g.layer[data-layer="topo"]')) return;
    seen.add(el);
    if (el.tagName === 'text' && el.querySelector('textPath')) { const t = el as SVGTextElement; z.texts.push({ el: t, fs: parseFloat(t.getAttribute('font-size') || '16'), sw: parseFloat(t.getAttribute('stroke-width') || '0') }); return; }
    let cx: number, cy: number;
    if (el.dataset.ax) { cx = +el.dataset.ax; cy = +(el.dataset.ay || 0); }
    else if (el.tagName === 'text' && el.hasAttribute('x')) { cx = parseFloat(el.getAttribute('x')!); cy = parseFloat(el.getAttribute('y')!); }
    else { try { const b = el.getBBox(); cx = b.x + b.width / 2; cy = b.y + b.height / 2; } catch { return; } }
    z.items.push({ el, base: el.getAttribute('transform') || '', cx, cy });
  });
}
function apply(z: Z) {
  const { k } = z;
  // k >= 1: pan inside the default frame; k < 1 (regional mode): pan inside the regional box
  const [bx0, by0, bx1, by1] = k < 1 && z.rb ? z.rb : [0, 0, z.W, z.H];
  const cl = (t: number, S: number, a: number, b: number) => k * (b - a) >= S ? Math.min(-k * a, Math.max(S - k * b, t)) : (S - k * (a + b)) / 2;
  z.tx = cl(z.tx, z.W, bx0, bx1); z.ty = cl(z.ty, z.H, by0, by1);
  z.svg.classList.toggle('zreg', k < 1); if (k < 1) loadRegion(z);
  if (k === 1) z.g.removeAttribute('transform'); else z.g.setAttribute('transform', `translate(${z.tx} ${z.ty}) scale(${k})`);
  for (const it of z.items) {
    if (k === 1) { if (it.base) it.el.setAttribute('transform', it.base); else it.el.removeAttribute('transform'); continue; }
    const m = k < 1 && it.el.matches('g.marker') ? 0.55 : 1; /* regional mode: smaller station markers */
    it.el.setAttribute('transform', `${it.base} translate(${it.cx} ${it.cy}) scale(${m / k}) translate(${-it.cx} ${-it.cy})`);
  }
  for (const t of z.texts) { t.el.setAttribute('font-size', String(t.fs / k)); if (t.sw) t.el.setAttribute('stroke-width', String(t.sw / k)); }
  scaleBar(z);
  bgLabels(z);
  z.svg.dispatchEvent(new CustomEvent('zoomchange'));
  const ctl = z.svg.parentElement?.querySelector('.zctl'); ctl?.classList.toggle('zoomed', k !== 1);
}
/** scale bar follows the zoom: longest "nice" length (miles) that fits the bar's original width */
function scaleBar(z: Z) {
  const g = z.svg.querySelector<SVGGElement>('g.scalebar'); if (!g) return;
  const sx = +g.dataset.sx!, sy = +g.dataset.sy!, ppmi = +g.dataset.ppmi! * z.k, tick = +g.dataset.tick!, max = +g.dataset.max!;
  const L = [50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1].find((m) => m * ppmi <= max * 1.05) ?? 0.1, w = L * ppmi;
  z.svg.classList.toggle('z1mi', L <= 1); g.querySelector('path')!.setAttribute('d', `M${sx},${sy}h${w}M${sx},${sy}v${-tick}M${sx + w / 2},${sy}v${-tick}M${sx + w},${sy}v${-tick}`);
  const t = g.querySelectorAll('text'); t[1].setAttribute('x', String(sx + w)); t[1].textContent = `${L} mi`;
}
/** background trails (.bgtr, shown at the 1 mi scale bar) must never sit under a curved label: slide each curved label along its own path to the first
 * offset whose glyphs clear every visible background-trail point and the dashed zoom-box lines (labels never cover data); back to the centre when the trails are hidden */
const bgPts = new WeakMap<Z, number[][]>();
function bgLabels(z: Z) {
  const on = z.svg.classList.contains('z1mi');
  let P = bgPts.get(z); if (on && !P) { P = []; for (const p of z.g.querySelectorAll<SVGPathElement>('.bgtr path, [data-layer="zoom"] path')) { const L = p.getTotalLength(); for (let d = 0; d <= L; d += 4) { const q = p.getPointAtLength(d); P.push([q.x, q.y]); } } bgPts.set(z, P); }
  for (const t of z.texts) { const tp = t.el.querySelector('textPath'); if (!tp) continue; if (!on || !P!.length) { tp.setAttribute('startOffset', '50%'); continue; }
    const r = (t.fs / z.k) * 0.75 + 3 / z.k, hit = () => { const n = t.el.getNumberOfChars(); for (let i = 0; i < n; i++) { let c: DOMPoint; try { c = t.el.getStartPositionOfChar(i); } catch { continue; } for (const q of P!) if (Math.abs(q[0] - c.x) < r && Math.abs(q[1] - c.y) < r) return true; } return false; };
    for (const o of [50, 40, 60, 30, 70, 20, 80, 10, 90]) { tp.setAttribute('startOffset', o + '%'); if (!hit()) break; } } }
/** regional layer (dist/region.svg): fetched once, the first time the map is zoomed out past the default frame */
function loadRegion(z: Z) {
  if (z.rgState) return; z.rgState = 1;
  const host = z.g.querySelector('g.layer[data-layer="region"]'); if (!host) return;
  fetch(new URL('region.svg', document.baseURI)).then((r) => r.ok ? r.text() : '').then((t) => { if (!t) { z.rgState = 0; return; }
    host.innerHTML = t; z.rgState = 2; collect(z, host); apply(z); }).catch(() => { z.rgState = 0; });
}
function toSvg(z: Z, cx: number, cy: number) { const m = z.svg.getScreenCTM()!; const p = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return [p.x, p.y]; }
function zoomAt(z: Z, f: number, px: number, py: number) {
  const k = Math.min(MAX, Math.max(z.kmin, z.k * f)), r = k / z.k;
  z.tx = px - (px - z.tx) * r; z.ty = py - (py - z.ty) * r; z.k = k; apply(z);
}
const reset = (z: Z) => { z.k = 1; z.tx = 0; z.ty = 0; apply(z); };
export const resetAllZoom = () => Zs.forEach(reset);

function setup(svg: SVGSVGElement) {
  const g = svg.querySelector<SVGGElement>('g.zv'); if (!g) return;
  const vb = svg.viewBox.baseVal, rd = (svg.dataset.rbox || '').split(' ').map(Number), z: Z = { kmin: rd.length === 5 && rd[4] < 1 ? rd[4] : 1, rb: rd.length === 5 ? rd.slice(0, 4) : null, svg, g, W: vb.width, H: vb.height, k: 1, tx: 0, ty: 0, items: [], texts: [] };
  collect(z); Zs.set(svg, z);
  const host = svg.parentElement!; host.classList.add('zhost');
  const ctl = document.createElement('div'); ctl.className = 'zctl ui';
  ctl.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in">${icon('plus')}</button><button type="button" data-z="out" aria-label="Zoom out">${icon('minus')}</button><button type="button" data-z="reset" aria-label="Reset zoom">${icon('reset')}</button>`;
  host.appendChild(ctl);
  ctl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b || b.dataset.z === 'play') return; const c = [z.W / 2, z.H / 2]; if (b.dataset.z === 'in') zoomAt(z, 1.6, c[0], c[1]); else if (b.dataset.z === 'out') zoomAt(z, 1 / 1.6, c[0], c[1]); else reset(z); });
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = toSvg(z, e.clientX, e.clientY); zoomAt(z, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), x, y); }, { passive: false });
  svg.addEventListener('dblclick', (e) => { e.preventDefault(); const [x, y] = toSvg(z, e.clientX, e.clientY); zoomAt(z, e.shiftKey ? 1 / 2 : 2, x, y); });
  // mouse / pen drag to pan (touch is handled below so one finger still scrolls the page)
  let drag: { x: number; y: number; tx: number; ty: number } | null = null;
  svg.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' || e.button !== 0 || z.k === 1) return; const [x, y] = toSvg(z, e.clientX, e.clientY); drag = { x, y, tx: z.tx, ty: z.ty }; svg.setPointerCapture(e.pointerId); svg.classList.add('panning'); });
  svg.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = toSvg(z, e.clientX, e.clientY); z.tx = drag.tx + x - drag.x; z.ty = drag.ty + y - drag.y; apply(z); });
  const end = () => { drag = null; svg.classList.remove('panning'); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  // touch: two fingers pinch-zoom and pan; one finger is left to the page
  let pin: { d: number; mx: number; my: number; k: number; tx: number; ty: number } | null = null;
  const two = (t: TouchList) => { const a = toSvg(z, t[0].clientX, t[0].clientY), b = toSvg(z, t[1].clientX, t[1].clientY); return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; };
  svg.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { e.preventDefault(); const q = two(e.touches); pin = { ...q, k: z.k, tx: z.tx, ty: z.ty }; } }, { passive: false });
  svg.addEventListener('touchmove', (e) => {
    if (!pin || e.touches.length !== 2) return; e.preventDefault();
    const q = two(e.touches);
    // work in the pinch-start frame: point under the fingers' midpoint stays under it
    const k = Math.min(MAX, Math.max(z.kmin, pin.k * (q.d / (pin.d || 1)))), r = k / pin.k;
    const cx = (pin.mx - pin.tx) / pin.k, cy = (pin.my - pin.ty) / pin.k; // content point at pinch start
    // q.mx is measured in the current (already transformed) svg viewport coords
    z.k = k; z.tx = q.mx - cx * k; z.ty = q.my - cy * k; apply(z); void r;
  }, { passive: false });
  svg.addEventListener('touchend', (e) => { if (e.touches.length < 2) pin = null; });
}
export function initZoom() {
  if (matchMedia('print').matches) return;
  document.querySelectorAll<SVGSVGElement>('svg.mainmap').forEach(setup); // mini maps are static (no zoom/pan)
  addEventListener('beforeprint', resetAllZoom);
}
/** zoom an svg so the box (viewBox units) fills it (with a margin); null = reset */
export function zoomToBox(svg: SVGSVGElement, b: { x0: number; y0: number; x1: number; y1: number } | null) {
  const z = Zs.get(svg); if (!z) return; if (!b) return reset(z);
  const m = 0.06, w = (b.x1 - b.x0) * (1 + 2 * m), h = (b.y1 - b.y0) * (1 + 2 * m), k = Math.min(MAX, Math.max(z.kmin, Math.min(z.W / w, z.H / h)));
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; z.k = k; z.tx = z.W / 2 - cx * k; z.ty = z.H / 2 - cy * k; apply(z);
}
