// Web-only zoom & pan for the main map and the mini maps.
// The map content sits in <g class="zv">; legend, logo, bib and frame stay outside and never move.
// Markers, arrows and labels are counter-scaled about their anchor so they keep a constant on-screen size.
import { icon } from './lib/icons';
const MAX = 8, MIN = 1;
type Z = { svg: SVGSVGElement; g: SVGGElement; W: number; H: number; k: number; tx: number; ty: number; items: { el: SVGGraphicsElement; base: string; cx: number; cy: number }[]; texts: { el: SVGTextElement; fs: number; sw: number }[] };
const Zs = new Map<SVGSVGElement, Z>();
/** current zoom factor of an svg (1 when not zoomable) */
export const zoomOf = (svg: Element | null) => (svg && Zs.get(svg as SVGSVGElement)?.k) || 1;

const COUNTER = 'g.marker, use.marker, path.arrow, g.stlabel, g.poilabel, g.turn, g.zoombox text, text';
function collect(z: Z) {
  const seen = new Set<Element>();
  z.g.querySelectorAll<SVGGraphicsElement>(COUNTER).forEach((el) => {
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
  z.tx = Math.min(0, Math.max(z.W - k * z.W, z.tx)); z.ty = Math.min(0, Math.max(z.H - k * z.H, z.ty));
  if (k === 1) z.g.removeAttribute('transform'); else z.g.setAttribute('transform', `translate(${z.tx} ${z.ty}) scale(${k})`);
  for (const it of z.items) {
    if (k === 1) { if (it.base) it.el.setAttribute('transform', it.base); else it.el.removeAttribute('transform'); continue; }
    it.el.setAttribute('transform', `${it.base} translate(${it.cx} ${it.cy}) scale(${1 / k}) translate(${-it.cx} ${-it.cy})`);
  }
  for (const t of z.texts) { t.el.setAttribute('font-size', String(t.fs / k)); if (t.sw) t.el.setAttribute('stroke-width', String(t.sw / k)); }
  scaleBar(z);
  z.svg.dispatchEvent(new CustomEvent('zoomchange'));
  const ctl = z.svg.parentElement?.querySelector('.zctl'); ctl?.classList.toggle('zoomed', k > 1);
}
/** scale bar follows the zoom: longest "nice" length (miles) that fits the bar's original width */
function scaleBar(z: Z) {
  const g = z.svg.querySelector<SVGGElement>('g.scalebar'); if (!g) return;
  const sx = +g.dataset.sx!, sy = +g.dataset.sy!, ppmi = +g.dataset.ppmi! * z.k, tick = +g.dataset.tick!, max = +g.dataset.max!;
  const L = [10, 5, 2, 1, 0.5, 0.25, 0.1].find((m) => m * ppmi <= max * 1.05) ?? 0.1, w = L * ppmi;
  g.querySelector('path')!.setAttribute('d', `M${sx},${sy}h${w}M${sx},${sy}v${-tick}M${sx + w / 2},${sy}v${-tick}M${sx + w},${sy}v${-tick}`);
  const t = g.querySelectorAll('text'); t[1].setAttribute('x', String(sx + w)); t[1].textContent = `${L} mi`;
}
function toSvg(z: Z, cx: number, cy: number) { const m = z.svg.getScreenCTM()!; const p = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return [p.x, p.y]; }
function zoomAt(z: Z, f: number, px: number, py: number) {
  const k = Math.min(MAX, Math.max(MIN, z.k * f)), r = k / z.k;
  z.tx = px - (px - z.tx) * r; z.ty = py - (py - z.ty) * r; z.k = k; apply(z);
}
const reset = (z: Z) => { z.k = 1; z.tx = 0; z.ty = 0; apply(z); };
export const resetAllZoom = () => Zs.forEach(reset);

function setup(svg: SVGSVGElement) {
  const g = svg.querySelector<SVGGElement>('g.zv'); if (!g) return;
  const vb = svg.viewBox.baseVal, z: Z = { svg, g, W: vb.width, H: vb.height, k: 1, tx: 0, ty: 0, items: [], texts: [] };
  collect(z); Zs.set(svg, z);
  const host = svg.parentElement!; host.classList.add('zhost');
  const ctl = document.createElement('div'); ctl.className = 'zctl ui';
  ctl.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in">${icon('plus')}</button><button type="button" data-z="out" aria-label="Zoom out">${icon('minus')}</button><button type="button" data-z="reset" aria-label="Reset zoom">${icon('reset')}</button>`;
  host.appendChild(ctl);
  ctl.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; const c = [z.W / 2, z.H / 2]; if (b.dataset.z === 'in') zoomAt(z, 1.6, c[0], c[1]); else if (b.dataset.z === 'out') zoomAt(z, 1 / 1.6, c[0], c[1]); else reset(z); });
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
    const k = Math.min(MAX, Math.max(MIN, pin.k * (q.d / (pin.d || 1)))), r = k / pin.k;
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
  const m = 0.06, w = (b.x1 - b.x0) * (1 + 2 * m), h = (b.y1 - b.y0) * (1 + 2 * m), k = Math.min(MAX, Math.max(MIN, Math.min(z.W / w, z.H / h)));
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; z.k = k; z.tx = z.W / 2 - cx * k; z.ty = z.H / 2 - cy * k; apply(z);
}
