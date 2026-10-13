// Layer toggles + print button. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => { show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked); if (cb.dataset.layer === 'zoom') show('svg.mini g.zoombox', cb.checked); if (cb.dataset.layer === 'topo') show('svg.mini g.topo', cb.checked); }));
document.querySelectorAll<HTMLInputElement>('input[data-course]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.course[data-course="${cb.dataset.course}"]`, cb.checked)));
document.getElementById('printbtn')?.addEventListener('click', () => window.print());
document.querySelectorAll<HTMLInputElement>('input[data-dist]').forEach((cb) => cb.addEventListener('change', () => document.body.classList.toggle('hide-dist', !cb.checked)));

// ---- elevation-profile hover: marker on the main map + matching mini map, readout in the profile ----
type HD = { profile: { W: number; H: number; x: number[]; y: number[] }; courses: Record<string, { color: string; dist: number; s: number[][] }> };
const hdEl = document.getElementById('hoverdata');
const prof = document.querySelector<SVGSVGElement>('svg.profile');
if (hdEl && prof) {
  const HD: HD = JSON.parse(hdEl.textContent || '{}'), NS = 'http://www.w3.org/2000/svg';
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); parent.appendChild(e); return e; };
  const main = document.querySelector<SVGSVGElement>('svg.mainmap')!;
  const mk = (svg: SVGSVGElement, r: number, sw: number) => { const g = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, svg); el('circle', { r: r + sw, fill: '#fff' }, g); const c = el('circle', { r, fill: 'none', 'stroke-width': sw }, g); el('circle', { r: sw * 0.9, fill: '#111' }, g); return { g, c }; };
  const mm = mk(main, 16, 6), minis: Record<string, ReturnType<typeof mk>> = {};
  document.querySelectorAll<SVGSVGElement>('svg.mini').forEach((s) => (minis[s.dataset.mini!] = mk(s, 12, 4.5)));
  const pg = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, prof);
  const vline = el('line', { y1: 0, y2: HD.profile.H, stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, pg);
  const dot = el('circle', { r: 7, fill: '#fff', 'stroke-width': 3.5 }, pg);
  const lab = el('text', { 'font-size': 26, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 6, 'dominant-baseline': 'central' }, pg);
  const { W, H, x: [x0, x1], y: [y0, y1] } = HD.profile;
  const X = (m: number) => ((m - x0) / (x1 - x0)) * W, Y = (ft: number) => (1 - (ft - y0) / (y1 - y0)) * H;
  const hide = () => { pg.style.display = 'none'; mm.g.style.display = 'none'; Object.values(minis).forEach((q) => (q.g.style.display = 'none')); };
  const move = (ev: PointerEvent) => {
    const ctm = prof.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse()), mile = x0 + (p.x / W) * (x1 - x0);
    let best: { k: string; v: number[]; d: number } | null = null;
    for (const [k, c] of Object.entries(HD.courses)) {
      if (mile < 0 || mile > c.dist) continue;
      const v = c.s[Math.max(0, Math.min(c.s.length - 1, Math.round(mile / 0.05)))], d = Math.abs(Y(v[1]) - p.y);
      if (!best || d < best.d) best = { k, v, d };
    }
    if (!best) return hide();
    const c = HD.courses[best.k], [mi, ft, ax, ay, bx, by] = best.v, px = X(mi), py = Y(ft);
    pg.style.display = ''; vline.setAttribute('x1', String(px)); vline.setAttribute('x2', String(px));
    dot.setAttribute('cx', String(px)); dot.setAttribute('cy', String(py)); dot.setAttribute('stroke', c.color);
    const right = px < W * 0.8; lab.setAttribute('x', String(px + (right ? 14 : -14))); lab.setAttribute('y', String(Math.max(20, py - 30)));
    lab.setAttribute('text-anchor', right ? 'start' : 'end'); lab.setAttribute('fill', c.color);
    lab.textContent = `${best.k} · mile ${mi.toFixed(1)} · ${ft.toLocaleString('en-US')} ft`;
    mm.g.style.display = ''; mm.g.setAttribute('transform', `translate(${ax} ${ay})`); mm.c.setAttribute('stroke', c.color);
    Object.entries(minis).forEach(([k, q]) => (q.g.style.display = 'none'));
    const q = minis[best.k]; if (q) { q.g.style.display = ''; q.g.setAttribute('transform', `translate(${bx} ${by})`); q.c.setAttribute('stroke', c.color); }
  };
  prof.style.touchAction = 'none'; prof.style.cursor = 'crosshair';
  prof.addEventListener('pointermove', move); prof.addEventListener('pointerdown', move);
  prof.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  prof.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(hide, 1500); });
}

// keep the main-map logo exactly the rendered size of the header logo above the mini maps
const hdrLogo = document.querySelector<HTMLImageElement>('.hdr .logo img'), mapSvg = document.querySelector<SVGSVGElement>('svg.mainmap'), mapLogo = mapSvg?.querySelector<SVGImageElement>('image.maplogo');
const syncLogo = () => {
  if (!hdrLogo || !mapSvg || !mapLogo || matchMedia('print').matches) return;
  const k = mapSvg.getBoundingClientRect().width / mapSvg.viewBox.baseVal.width, w = hdrLogo.getBoundingClientRect().width / k;
  if (k > 0 && w > 0) { mapLogo.setAttribute('width', w.toFixed(1)); mapLogo.setAttribute('height', (w * 776 / 730).toFixed(1)); }
};
addEventListener('resize', syncLogo); hdrLogo?.addEventListener('load', syncLogo); syncLogo();
addEventListener('beforeprint', () => { if (mapLogo) { mapLogo.setAttribute('width', String(1.45 * 72)); mapLogo.setAttribute('height', String(1.45 * 72 * 776 / 730)); } });
addEventListener('afterprint', syncLogo);
