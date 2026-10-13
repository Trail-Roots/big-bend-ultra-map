import { initZoom, zoomOf } from './zoom';
// Layer toggles + print button. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => { show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked); if (cb.dataset.layer === 'zoom') show('svg.mini g.zoombox', cb.checked); if (cb.dataset.layer === 'topo') show('svg.mini g.topo', cb.checked); }));
document.querySelectorAll<HTMLInputElement>('input[data-course]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.course[data-course="${cb.dataset.course}"]`, cb.checked)));
document.getElementById('printbtn')?.addEventListener('click', () => window.print());

// ---- elevation-profile hover: marker on the main map + matching mini map, readout in the profile ----
type HD = { profile: { W: number; H: number; x: number[]; y: number[] }; courses: Record<string, { color: string; dist: number; s: number[][] }>; time: any };
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
  // ---- race-day time: timeline cursor, median-runner markers, runner dots; auto-play sweeps the clock ----
  const TM = HD.time, tl = document.querySelector<SVGSVGElement>('svg.timeline');
  const effAt = (e: { mi: number[]; e: number[] }, f: number) => { if (f <= 0) return 0; if (f >= 1) return e.mi[e.mi.length - 1]; let lo = 0, hi = e.e.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (e.e[m] <= f) lo = m; else hi = m; } return e.mi[lo] + ((e.mi[hi] - e.mi[lo]) * (f - e.e[lo])) / (e.e[hi] - e.e[lo] || 1); };
  const ptAt = (k: string, mile: number) => HD.courses[k].s[Math.max(0, Math.min(HD.courses[k].s.length - 1, Math.round(mile / 0.05)))];
  const fmt = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`; };
  // runner dots (one per simulated runner) on the main map
  const dotLayer = main.querySelector('g.layer[data-layer="dots"]');
  const dots2: { k: string; T: number; stop: number; c: SVGCircleElement; j: number }[] = [];
  if (dotLayer) for (const [k, C] of Object.entries(TM.courses) as [string, any][]) C.T.forEach((T: number, i: number) => { const c = el('circle', { r: 3.4, fill: HD.courses[k].color, stroke: '#fff', 'stroke-width': 0.9, style: 'display:none' }, dotLayer) as SVGCircleElement; dots2.push({ k, T, stop: C.stop[i], c, j: (dots2.length * 2.399) % 6.283 }); });
  let tShown = -1;
  const setTime = (t: number) => {
    tShown = t; const z = 1 / zoomOf(main);
    for (const d of dots2) {
      const C = TM.courses[d.k], f = (t - C.start) / d.T; const mile = effAt(C.eff, f);
      if (f < 0 || f > 1 || (d.stop >= 0 && mile >= d.stop)) { d.c.style.display = 'none'; continue; } // not started / finished / dropped (DNF)
      // spread runners slightly so a crowd reads as a crowd, not one dot
      const p = ptAt(d.k, mile), j = d.j;
      d.c.style.display = ''; d.c.setAttribute('cx', String(p[2] + Math.cos(j) * 3)); d.c.setAttribute('cy', String(p[3] + Math.sin(j) * 3)); d.c.setAttribute('r', String(3.4 * z));
    }
    // median runner of each course on the main + mini maps
    all().forEach((q) => (q.g.style.display = 'none'));
    for (const [k, C] of Object.entries(TM.courses) as [string, any][]) {
      const f = (t - C.start) / C.med; if (f < 0 || f > 1) continue;
      const p = ptAt(k, effAt(C.eff, f));
      mains[k].g.style.display = ''; mains[k].g.setAttribute('transform', `translate(${p[2]} ${p[3]}) scale(${z})`);
      if (minis[k]) { minis[k].g.style.display = ''; minis[k].g.setAttribute('transform', `translate(${p[4]} ${p[5]}) scale(${1 / zoomOf(minis[k].g.ownerSVGElement)})`); }
    }
    if (tl) {
      const t0 = +tl.dataset.t0!, t1 = +tl.dataset.t1!, lx = +tl.dataset.lx!, rx = +tl.dataset.rx!, x = lx + ((t - t0) / (t1 - t0)) * (rx - lx);
      const cur = tl.querySelector<SVGGElement>('g.tlcursor')!, txt = cur.querySelector('text')!, bx = cur.querySelector('rect')!;
      cur.style.display = ''; cur.querySelector('path')!.setAttribute('transform', `translate(${x} 0)`);
      const b = Math.floor((t - TM.t0) / TM.bin), rows = [fmt(t), ...Object.entries(TM.courses).map(([k, C]: [string, any]) => ({ k, n: C.on[b] ?? 0 })).filter((r) => r.n).map((r) => `${r.k} ${r.n}`)];
      txt.textContent = ''; const right = x < rx - 260;
      rows.forEach((r, i) => { const ts = document.createElementNS(NS, 'tspan'); ts.setAttribute('x', String(x + (right ? 10 : -10))); ts.setAttribute('dx', '0'); ts.textContent = i === 0 ? String(r) : String(r); if (i) ts.setAttribute('dx', '8'); ts.setAttribute('y', '58'); if (i === 0) ts.setAttribute('font-size', '19'); txt.appendChild(ts); });
      // lay the readout out on one line
      txt.querySelectorAll('tspan').forEach((ts, i) => { if (i) ts.removeAttribute('x'); });
      txt.setAttribute('text-anchor', right ? 'start' : 'end');
      const bb = (txt as SVGTextElement).getBBox(); bx.setAttribute('x', String(bb.x - 6)); bx.setAttribute('y', String(bb.y - 3)); bx.setAttribute('width', String(bb.width + 12)); bx.setAttribute('height', String(bb.height + 6));
    }
  };
  const clearTime = () => { tShown = -1; dots2.forEach((d) => (d.c.style.display = 'none')); all().forEach((q) => (q.g.style.display = 'none')); const cur = tl?.querySelector<SVGGElement>('g.tlcursor'); if (cur) cur.style.display = 'none'; };
  main.addEventListener('zoomchange', () => { if (tShown >= 0) setTime(tShown); });
  // auto-play (web only): slow sweep of the race-day clock, looping; off for reduced motion; pause persisted
  const LOOP_S = 90, KEY = 'bbu-autoplay-paused';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = localStorage.getItem(KEY) === '1', user = false, t0 = 0, f0 = 0, raf = 0, last = 0;
  const running = () => !reduced && !paused && !user && !document.hidden && !matchMedia('print').matches;
  const tick = (t: number) => {
    raf = 0; if (!running()) return;
    if (!t0) t0 = t - f0 * LOOP_S * 1000;
    const f = (((t - t0) / 1000 / LOOP_S) % 1); f0 = f;
    if (t - last > 50) { setTime(TM.t0 + f * (TM.t1 - TM.t0)); last = t; }
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && running()) { t0 = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'autoplay ui';
  const label = () => { btn.textContent = paused ? '▶ Play race day' : '❚❚ Pause'; btn.setAttribute('aria-label', paused ? 'Play race-day animation' : 'Pause race-day animation'); btn.setAttribute('aria-pressed', String(!paused)); };
  if (!reduced) { label(); prof.parentElement!.appendChild(btn); }
  btn.addEventListener('click', () => { paused = !paused; localStorage.setItem(KEY, paused ? '1' : '0'); label(); if (paused) { stop(); clearTime(); } else start(); });
  const suspend = () => { user = true; stop(); };
  const resume = () => { user = false; start(); };
  // profile: distance hover (unchanged)
  prof.addEventListener('pointermove', move); prof.addEventListener('pointerdown', (e) => { suspend(); clearTime(); move(e); });
  prof.addEventListener('pointerenter', () => { suspend(); clearTime(); });
  prof.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hide(); resume(); } });
  prof.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(() => { hide(); resume(); }, 1500); });
  // timeline: scrub the clock
  if (tl) {
    const tmove = (e: PointerEvent) => { const ctm = tl.getScreenCTM(); if (!ctm) return; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()), lx = +tl.dataset.lx!, rx = +tl.dataset.rx!; const t = TM.t0 + ((p.x - lx) / (rx - lx)) * (TM.t1 - TM.t0); if (t < TM.t0 || t > TM.t1) return; hide(); setTime(t); };
    tl.style.cursor = 'crosshair';
    tl.addEventListener('pointerenter', suspend); tl.addEventListener('pointermove', tmove); tl.addEventListener('pointerdown', (e) => { suspend(); tmove(e); });
    tl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { clearTime(); resume(); } });
    tl.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(() => { clearTime(); resume(); }, 1500); });
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  addEventListener('beforeprint', () => { stop(); hide(); clearTime(); }); addEventListener('afterprint', start);
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
