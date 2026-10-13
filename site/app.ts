import { initZoom, zoomOf } from './zoom';
// Layer toggles. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => { show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked); if (cb.dataset.layer === 'zoom') show('svg.mini g.zoombox', cb.checked); if (cb.dataset.layer === 'topo') show('svg.mini g.topo', cb.checked); }));
document.querySelectorAll<HTMLInputElement>('input[data-course]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.course[data-course="${cb.dataset.course}"]`, cb.checked)));

// ---- elevation-profile hover: marker on the main map + matching mini map, readout in the profile ----
type HD = { profile: { W: number; H: number; x: number[]; y: number[] }; courses: Record<string, { color: string; dist: number; s: number[][] }> };
const hdEl = document.getElementById('hoverdata');
const prof = document.querySelector<SVGSVGElement>('svg.profile');
if (hdEl && prof) {
  const HD: HD = JSON.parse(hdEl.textContent || '{}'), NS = 'http://www.w3.org/2000/svg';
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); parent.appendChild(e); return e; };
  const main = document.querySelector<SVGSVGElement>('svg.mainmap')!;
  const mk = (svg: SVGSVGElement, r: number, sw: number) => { const g = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, svg.querySelector('g.zv') ?? svg); el('circle', { r: r + sw, fill: '#fff' }, g); const c = el('circle', { r, fill: 'none', 'stroke-width': sw }, g); el('circle', { r: sw * 0.9, fill: '#111' }, g); return { g, c }; };
  // one marker per course on the main map, one on each course's own mini map
  const mains: Record<string, ReturnType<typeof mk>> = {}, minis: Record<string, ReturnType<typeof mk>> = {};
  for (const [k, c] of Object.entries(HD.courses)) { mains[k] = mk(main, 13, 5); mains[k].c.setAttribute('stroke', c.color); }
  document.querySelectorAll<SVGSVGElement>('svg.mini').forEach((s) => { const k = s.dataset.mini!; minis[k] = mk(s, 12, 4.5); if (HD.courses[k]) minis[k].c.setAttribute('stroke', HD.courses[k].color); });
  const pg = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, prof);
  const vline = el('line', { y1: 0, y2: HD.profile.H, stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, pg);
  const dots: Record<string, Element> = {};
  for (const [k, c] of Object.entries(HD.courses)) dots[k] = el('circle', { r: 7, fill: '#fff', 'stroke-width': 3.5, stroke: c.color }, pg);
  const box = el('rect', { fill: '#fff', 'fill-opacity': 0.92, stroke: '#bbb', 'stroke-width': 1, rx: 4 }, pg);
  const lab = el('text', { 'font-size': 22, 'font-weight': 700 }, pg);
  const { W, H, x: [x0, x1], y: [y0, y1] } = HD.profile;
  const X = (m: number) => ((m - x0) / (x1 - x0)) * W, Y = (ft: number) => (1 - (ft - y0) / (y1 - y0)) * H;
  const all = () => [...Object.values(mains), ...Object.values(minis)];
  const hide = () => { pg.style.display = 'none'; all().forEach((q) => (q.g.style.display = 'none')); };
  const move = (ev: PointerEvent) => {
    const ctm = prof.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    show(x0 + (p.x / W) * (x1 - x0));
  };
  const show = (mile: number) => {
    if (mile < 0) return hide();
    // every course that reaches this mile gets a marker; shorter courses show nothing
    const hits = Object.entries(HD.courses).filter(([, c]) => mile <= c.dist).map(([k, c]) => ({ k, c, v: c.s[Math.max(0, Math.min(c.s.length - 1, Math.round(mile / 0.05)))] }));
    if (!hits.length) return hide();
    hits.sort((a, b) => b.c.dist - a.c.dist); // longest course first (100K on top)
    all().forEach((q) => (q.g.style.display = 'none'));
    const px = X(mile); pg.style.display = ''; vline.setAttribute('x1', String(px)); vline.setAttribute('x2', String(px));
    for (const k in dots) (dots[k] as SVGElement).style.display = 'none';
    for (const { k, v } of hits) {
      const [, ft, ax, ay, bx, by] = v, d = dots[k] as SVGElement;
      d.style.display = ''; d.setAttribute('cx', String(X(v[0]))); d.setAttribute('cy', String(Y(ft)));
      mains[k].g.style.display = ''; mains[k].g.setAttribute('transform', `translate(${ax} ${ay}) scale(${1 / zoomOf(main)})`);
      if (minis[k]) { minis[k].g.style.display = ''; minis[k].g.setAttribute('transform', `translate(${bx} ${by}) scale(${1 / zoomOf(minis[k].g.ownerSVGElement)})`); }
    }
    // readout: one line per course, longest first: course · mile · cumulative gain from the start
    lab.textContent = '';
    const rows = hits.map(({ k, c, v }) => ({ t: `${k} · mi ${v[0].toFixed(1)} · +${v[6].toLocaleString('en-US')} ft gain`, fill: c.color }));
    const right = px < W * 0.7, lx = px + (right ? 16 : -16), ly = 14;
    rows.forEach((r, i) => { const ts = el('tspan', { x: lx, y: ly + 13 + i * 26, fill: r.fill }, lab); ts.textContent = r.t; });
    lab.setAttribute('text-anchor', right ? 'start' : 'end');
    const bb = (lab as SVGTextElement).getBBox();
    box.setAttribute('x', String(bb.x - 8)); box.setAttribute('y', String(bb.y - 5)); box.setAttribute('width', String(bb.width + 16)); box.setAttribute('height', String(bb.height + 10));
  };
  prof.style.touchAction = 'none'; prof.style.cursor = 'crosshair';
  // ---- auto-play: slow sweep 0 -> 100K finish, looping (web only; off for reduced motion; pause persisted) ----
  const LOOP_S = 75, END = Math.max(...Object.values(HD.courses).map((c) => c.dist)), KEY = 'bbu-autoplay-paused';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = localStorage.getItem(KEY) === '1', user = false, t0 = 0, mile0 = 0, raf = 0, last = 0;
  const running = () => !reduced && !paused && !user && !document.hidden && !matchMedia('print').matches;
  const tick = (t: number) => {
    raf = 0; if (!running()) return;
    if (!t0) t0 = t - (mile0 / END) * LOOP_S * 1000;
    const mile = (((t - t0) / 1000 / LOOP_S) % 1) * END; mile0 = mile;
    if (t - last > 50) { show(mile); last = t; } // ~20 fps is plenty for a slow sweep
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && running()) { t0 = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'autoplay ui';
  const label = () => { btn.textContent = paused ? '▶ Play' : '❚❚ Pause'; btn.setAttribute('aria-label', paused ? 'Play elevation sweep' : 'Pause elevation sweep'); btn.setAttribute('aria-pressed', String(!paused)); };
  if (!reduced) { label(); prof.parentElement!.appendChild(btn); }
  btn.addEventListener('click', () => { paused = !paused; localStorage.setItem(KEY, paused ? '1' : '0'); label(); if (paused) { stop(); hide(); } else start(); });
  prof.addEventListener('pointermove', move); prof.addEventListener('pointerdown', (e) => { user = true; stop(); move(e); });
  prof.addEventListener('pointerenter', () => { user = true; stop(); });
  prof.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hide(); user = false; start(); } });
  prof.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(() => { hide(); user = false; start(); }, 1500); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('beforeprint', () => { stop(); hide(); }); addEventListener('afterprint', start);
  start();
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

initZoom();
