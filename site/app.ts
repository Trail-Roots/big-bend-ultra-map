import { initZoom, zoomOf } from './zoom';
import { makeGlide, routeAt } from './glide';
// Layer toggles. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => { show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked); if (cb.dataset.layer === 'zoom') show('svg.mini g.zoombox', cb.checked); if (cb.dataset.layer === 'topo') show('svg.mini g.topo', cb.checked); }));
document.querySelectorAll<HTMLInputElement>('input[data-course]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.course[data-course="${cb.dataset.course}"]`, cb.checked)));

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
  const lab = el('text', { 'font-size': 22, 'font-weight': 700 }, pg), bibs = el('g', {}, pg);
  const BW: number = (HD.courses as any)._bibw, BH: number = (HD.courses as any)._bibh; delete (HD.courses as any)._bibw; delete (HD.courses as any)._bibh;
  const { W, H, x: [x0, x1], y: [y0, y1] } = HD.profile;
  const X = (m: number) => ((m - x0) / (x1 - x0)) * W, Y = (ft: number) => (1 - (ft - y0) / (y1 - y0)) * H;
  const all = () => [...Object.values(mains), ...Object.values(minis)];
  const glide = makeGlide(HD.courses, mains, minis, zoomOf); void all;
  const hide = () => { pg.style.display = 'none'; glide.clear(); };
  const move = (ev: PointerEvent) => {
    const ctm = prof.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    show(x0 + (p.x / W) * (x1 - x0));
  };
  const show = (mile: number) => {
    if (mile < 0) return hide();
    // every course that reaches this mile gets a marker; shorter courses show nothing
    const hits = Object.entries(HD.courses).filter(([, c]) => mile <= c.dist).map(([k, c]) => ({ k, c, v: routeAt(c.s, mile) }));
    if (!hits.length) return hide();
    hits.sort((a, b) => b.c.dist - a.c.dist); // longest course first (100K on top)
    const px = X(mile); pg.style.display = ''; vline.setAttribute('x1', String(px)); vline.setAttribute('x2', String(px));
    for (const k in dots) (dots[k] as SVGElement).style.display = 'none';
    for (const { k, v } of hits) {
      const ft = v[1], d = dots[k] as SVGElement;
      d.style.display = ''; d.setAttribute('cx', String(X(mile))); d.setAttribute('cy', String(Y(ft)));
    }
    for (const k in HD.courses) glide.set(k, hits.some((h) => h.k === k) ? mile : null);
    // readout: one line per course, longest first: course · mile · cumulative gain from the start
    lab.textContent = '';
    const rows = hits.map(({ k, c, v }) => ({ k, bib: (c as any).bib, t: `mi ${v[0].toFixed(1)} · +${Math.round(v[6]).toLocaleString('en-US')} ft gain` }));
    const right = px < W * 0.7, lx = px + (right ? 16 + BW + 8 : -16), ly = 14;
    rows.forEach((r, i) => { const ts = el('tspan', { x: lx, y: ly + 13 + i * 30, fill: '#1a1a1a' }, lab); ts.textContent = r.t; });
    lab.setAttribute('text-anchor', right ? 'start' : 'end');
    const bb = (lab as SVGTextElement).getBBox(), bx = bb.x - BW - 8;
    bibs.innerHTML = rows.map((r, i) => `<g transform="translate(${bx} ${ly + 13 + i * 30 - 8 - BH / 2})">${r.bib}</g>`).join('');
    bb.width += bb.x - bx; bb.x = bx;
    box.setAttribute('x', String(bb.x - 8)); box.setAttribute('y', String(bb.y - 5)); box.setAttribute('width', String(bb.width + 16)); box.setAttribute('height', String(bb.height + 10));
  };
  prof.style.touchAction = 'none'; prof.style.cursor = 'crosshair';
  // ---- race-day time: timeline cursor, median-runner markers, runner dots; auto-play sweeps the clock ----
  const TM = HD.time, tl = document.querySelector<SVGSVGElement>('svg.timeline');
  // elapsed fraction -> mile on a runner's fitness-class curve (flat steps = aid-station dwell)
  const effAt = (e: { mi: number[]; f: number[] }, f: number) => { if (f <= 0) return 0; if (f >= 1) return e.mi[e.mi.length - 1]; let lo = 0, hi = e.f.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (e.f[m] <= f) lo = m; else hi = m; } return e.mi[lo] + ((e.mi[hi] - e.mi[lo]) * (f - e.f[lo])) / (e.f[hi] - e.f[lo] || 1); };
  const ptAt = (k: string, mile: number) => routeAt(HD.courses[k].s, mile);
  const fmt = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`; };
  // runner dots (one per simulated runner) on the main map
  const dotLayer = main.querySelector('g.layer[data-layer="dots"]');
  const dots2: { k: string; T: number; stop: number; c: SVGCircleElement; j: number; cv: any }[] = [];
  if (dotLayer) for (const [k, C] of Object.entries(TM.courses) as [string, any][]) C.T.forEach((T: number, i: number) => { const c = el('circle', { r: 3.4, fill: HD.courses[k].color, stroke: '#fff', 'stroke-width': 0.9, style: 'display:none' }, dotLayer) as SVGCircleElement; dots2.push({ k, T, stop: C.stop[i], c, j: (dots2.length * 2.399) % 6.283, cv: C.curves[C.fit[i]] }); });
  // leader ring: one per course, a course-colour ring around the leader's standard dot (small gap)
  const leadRing: Record<string, SVGCircleElement> = {};
  if (dotLayer) for (const k of Object.keys(TM.courses)) leadRing[k] = el('circle', { fill: 'none', stroke: HD.courses[k].color, style: 'display:none;pointer-events:none' }, dotLayer) as SVGCircleElement;
  let tShown = -1;
  const setTime = (t: number) => {
    tShown = t; const z = 1 / zoomOf(main);
    const ends: Record<string, { lead?: [number, any]; last?: [number, any] }> = {};
    for (const d of dots2) {
      const C = TM.courses[d.k], f = (t - C.start) / d.T; const mile = effAt(d.cv, f);
      if (f < 0 || f > 1 || (d.stop >= 0 && mile >= d.stop)) { d.c.style.display = 'none'; continue; } // not started / finished / dropped (DNF)
      // spread runners slightly so a crowd reads as a crowd, not one dot
      const p = ptAt(d.k, mile), j = d.j;
      d.c.style.display = ''; d.c.setAttribute('cx', String(p[2] + Math.cos(j) * 3)); d.c.setAttribute('cy', String(p[3] + Math.sin(j) * 3)); d.c.setAttribute('r', String(3.4 * z)); d.c.setAttribute('fill', HD.courses[d.k].color); d.c.setAttribute('stroke', '#fff'); d.c.setAttribute('stroke-width', String(0.9 * z));
      const E = (ends[d.k] ??= {}); if (!E.lead || mile > E.lead[0]) E.lead = [mile, d]; if (!E.last || mile < E.last[0]) E.last = [mile, d];
    }
    for (const k in leadRing) leadRing[k].style.display = 'none';
    // leader = standard dot + course-colour ring with a small gap; last runner = hollow ring (white fill, course-colour stroke). Small, drawn on top.
    for (const [k, E] of Object.entries(ends)) for (const [q, lead] of [[E.last, false], [E.lead, true]] as const) {
      if (!q) continue; const c = q[1].c as SVGCircleElement, col = HD.courses[k].color;
      if (lead) { const R = leadRing[k]; R.setAttribute('cx', c.getAttribute('cx')!); R.setAttribute('cy', c.getAttribute('cy')!); R.setAttribute('r', String(6.4 * z)); R.setAttribute('stroke-width', String(1.5 * z)); R.style.display = ''; c.parentNode!.appendChild(c); c.parentNode!.appendChild(R); continue; }
      c.setAttribute('r', String(4.2 * z)); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', String(2 * z));
      if (c.nextSibling) c.parentNode!.appendChild(c);
    }
    glide.clear(); // no median-runner markers during time play (profile distance-hover markers are separate)
    if (tl) {
      const t0 = +tl.dataset.t0!, t1 = +tl.dataset.t1!, lx = +tl.dataset.lx!, rx = +tl.dataset.rx!, x = lx + ((t - t0) / (t1 - t0)) * (rx - lx);
      const cur = tl.querySelector<SVGGElement>('g.tlcursor')!, txt = cur.querySelector('text')!, bx = cur.querySelector('rect')!;
      cur.style.display = ''; cur.querySelector('path')!.setAttribute('transform', `translate(${x} 0)`);
      const b = Math.floor((t - TM.t0) / TM.bin), rows = [fmt(t)]; void b; // time of day only
      txt.textContent = ''; const right = x < rx - 260;
      rows.forEach((r, i) => { const ts = document.createElementNS(NS, 'tspan'); ts.setAttribute('x', String(x + (right ? 10 : -10))); ts.setAttribute('dx', '0'); ts.textContent = i === 0 ? String(r) : String(r); if (i) ts.setAttribute('dx', '8'); ts.setAttribute('y', '23'); if (i === 0) ts.setAttribute('font-size', '19'); txt.appendChild(ts); });
      // lay the readout out on one line
      txt.querySelectorAll('tspan').forEach((ts, i) => { if (i) ts.removeAttribute('x'); });
      txt.setAttribute('text-anchor', right ? 'start' : 'end');
      const bb = (txt as SVGTextElement).getBBox(); bx.setAttribute('x', String(bb.x - 6)); bx.setAttribute('y', String(bb.y - 3)); bx.setAttribute('width', String(bb.width + 12)); bx.setAttribute('height', String(bb.height + 6));
    }
  };
  const clearTime = () => { tShown = -1; dots2.forEach((d) => (d.c.style.display = 'none')); glide.clear(); const cur = tl?.querySelector<SVGGElement>('g.tlcursor'); if (cur) cur.style.display = 'none'; };
  main.addEventListener('zoomchange', () => { glide.redraw(); if (tShown >= 0) setTime(tShown); });
  document.querySelectorAll('svg.mini').forEach((m) => m.addEventListener('zoomchange', () => glide.redraw()));
  // auto-play (web only): slow sweep of the race-day clock, looping; off for reduced motion; pause persisted
  const LOOP_S = 90, KEY = 'bbu-autoplay-paused';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = localStorage.getItem(KEY) === '1', user = false, t0 = 0, f0 = 0, raf = 0, last = 0;
  const running = () => !reduced && !paused && !user && !document.hidden && !matchMedia('print').matches;
  const tick = (t: number) => {
    raf = 0; if (!running()) return;
    if (!t0) t0 = t - f0 * LOOP_S * 1000;
    const f = (((t - t0) / 1000 / LOOP_S) % 1); f0 = f;
    setTime(TM.t0 + f * (TM.t1 - TM.t0)); last = t; // every frame, continuous (fractional) clock
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && running()) { t0 = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'autoplay ui';
  const label = () => { btn.textContent = paused ? '▶ Play race day' : '❚❚ Pause'; btn.setAttribute('aria-label', paused ? 'Play race-day animation' : 'Pause race-day animation'); btn.setAttribute('aria-pressed', String(!paused)); };
  if (!reduced) { label(); prof.parentElement!.appendChild(btn); }
  // key for the runner-dot markers (web only, like the dots themselves)
  if (dotLayer && tl) { const key = document.createElement('div'); key.className = 'runkey ui'; key.innerHTML = '<svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true"><circle r="3.4" fill="#666" stroke="#fff" stroke-width=".9"/><circle r="6.4" fill="none" stroke="#666" stroke-width="1.5"/></svg> Leader <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><circle r="4" fill="#fff" stroke="#666" stroke-width="2"/></svg> Last runner <span>(course colour)</span>'; tl.insertAdjacentElement('afterend', key); }
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
