import { initZoom, zoomOf } from './zoom';
import { makeGlide, routeAt } from './glide';
import { placeTip } from './tip';
// Layer toggles. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => { show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked); if (cb.dataset.layer === 'topo') show('svg.mini g.topo', cb.checked); }));

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
  const tipG = el('g', { class: 'tip' }, pg) as SVGGElement, box = el('rect', { fill: '#fff', 'fill-opacity': 0.94, stroke: '#bbb', 'stroke-width': 1, rx: 4 }, tipG);
  const lab = el('text', { 'font-size': 19, 'font-weight': 700 }, tipG), bibs = el('g', {}, tipG);
  const BW: number = (HD.courses as any)._bibw, BH: number = (HD.courses as any)._bibh; delete (HD.courses as any)._bibw; delete (HD.courses as any)._bibh;
  const { W, H, x: [x0, x1], y: [y0, y1] } = HD.profile;
  const X = (m: number) => ((m - x0) / (x1 - x0)) * W, Y = (ft: number) => (1 - (ft - y0) / (y1 - y0)) * H;
  const all = () => [...Object.values(mains), ...Object.values(minis)];
  const glide = makeGlide(HD.courses, mains, minis, zoomOf); void all;
  const hide = () => { pg.style.display = 'none'; glide.clear(); };
  const move = (ev: PointerEvent) => {
    const ctm = prof.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    show(x0 + (p.x / W) * (x1 - x0), p.y);
  };
  // average pace from the start needed to make the next cutoff at or beyond this mile
  const pace = (mpm: number) => { const s = Math.round(mpm * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const cutPace = (c: any, mile: number) => { const n = (c.cut as [number, number][]).find(([m]) => m >= mile - 1e-6 && m > 0); return n ? ` · cutoff pace ${pace(n[1] / n[0])}/mi` : ''; };
  const show = (mile: number, py?: number) => {
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
    // ONE tracking point on the main map: the course whose line is nearest the pointer (else the longest course here)
    const pick = py == null ? hits[0] : hits.reduce((a, b) => (Math.abs(Y(b.v[1]) - py) < Math.abs(Y(a.v[1]) - py) ? b : a));
    for (const k in HD.courses) glide.set(k, k === pick.k ? mile : null);
    // readout: one line per course, longest first: course · mile · cumulative gain from the start
    lab.textContent = '';
    // condensed: one line per course: bib · mile · gain so far · pace needed for the next cutoff
    const rows = hits.map(({ c, v }) => ({ bib: (c as any).bib, t: `${v[0].toFixed(1)} mi · +${Math.round(v[6]).toLocaleString('en-US')} ft${cutPace(c, v[0]).replace(' · cutoff pace ', ' · ').replace('/mi', '/mi to cutoff')}` }));
    const LH = 26, lx = BW + 6;
    rows.forEach((r, i) => { const ts = el('tspan', { x: lx, y: 13 + i * LH, fill: '#1a1a1a' }, lab); ts.textContent = r.t; });
    lab.setAttribute('text-anchor', 'start');
    bibs.innerHTML = rows.map((r, i) => `<g transform="translate(0 ${13 + i * LH - 7 - BH / 2})">${r.bib}</g>`).join('');
    const bb = (lab as SVGTextElement).getBBox(); bb.width += bb.x; bb.x = 0;
    box.setAttribute('x', String(bb.x - 5)); box.setAttribute('y', String(Math.min(bb.y, 13 - 7 - BH / 2) - 4)); box.setAttribute('width', String(bb.width + 10)); box.setAttribute('height', String(Math.max(bb.height, rows.length * LH) + 6));
    placeTip(prof, tipG, px, py ?? 20);
  };
  prof.style.touchAction = 'none'; prof.style.cursor = 'crosshair';
  // ---- race pages: each race's own elevation chart drives ONE tracking point on that race page's map; readout = distance, elevation,
  // gain so far and the pace needed for the next cutoff (as on the main chart) ----
  document.querySelectorAll<SVGSVGElement>('svg.cprofile').forEach((cp) => {
    const k = cp.dataset.course!, C = HD.courses[k] as any, rm = document.querySelector<SVGSVGElement>(`svg.racemap[data-race="${k}"]`); if (!C) return;
    const PL = +cp.dataset.pl!, CW = +cp.dataset.w!, CH = +cp.dataset.h!, PB = +cp.dataset.pb!, D = +cp.dataset.d!, lo = +cp.dataset.lo!, hi = +cp.dataset.hi!;
    const CX = (m: number) => PL + (m / D) * (CW - PL - 10), CY = (ft: number) => 10 + (1 - (ft - lo) / (hi - lo)) * (CH - PB - 10);
    const g = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, cp);
    const vl = el('line', { y1: 10, y2: CH - PB, stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g), dot = el('circle', { r: 7, fill: '#fff', 'stroke-width': 3.5, stroke: C.color }, g);
    const tg = el('g', { class: 'tip' }, g) as SVGGElement, bx = el('rect', { fill: '#fff', 'fill-opacity': 0.94, stroke: '#bbb', 'stroke-width': 1, rx: 4 }, tg), tx = el('text', { 'font-size': 17, 'font-weight': 700, fill: '#1a1a1a' }, tg);
    let mm: { g: SVGElement } | null = null;
    if (rm) { const f = +rm.dataset.f! || 1, vb = rm.viewBox.baseVal, R = vb.width / 90, mg = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, rm) as SVGElement;
      el('circle', { r: R * 1.35, fill: '#fff' }, mg); el('circle', { r: R, fill: 'none', stroke: C.color, 'stroke-width': R * 0.38 }, mg); el('circle', { r: R * 0.32, fill: '#111' }, mg); mm = { g: mg }; (mm as any).f = f; }
    const st = HD.time.courses[k].start as number;
    const hideC = () => { g.style.display = 'none'; if (mm) mm.g.style.display = 'none'; };
    const cmove = (ev: PointerEvent) => { const ctm = cp.getScreenCTM(); if (!ctm) return; const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse()), mile = ((p.x - PL) / (CW - PL - 10)) * D;
      if (mile < 0 || mile > D) return hideC();
      const v = routeAt(C.s, mile), x = CX(mile); g.style.display = ''; vl.setAttribute('x1', String(x)); vl.setAttribute('x2', String(x)); dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(CY(v[1])));
      const n = (C.cut as [number, number, string][]).find(([m]) => m >= mile - 1e-6 && m > 0);
      const lines = [`${v[0].toFixed(1)} mi · ${Math.round(v[1]).toLocaleString('en-US')} ft · +${Math.round(v[6]).toLocaleString('en-US')} ft`, n ? `cutoff ${fmt(st + n[1])} @ ${n[0].toFixed(1)} mi · ${pace(n[1] / n[0])}/mi` : 'no further cutoff'];
      tx.textContent = ''; tx.setAttribute('text-anchor', 'start');
      lines.forEach((t, i) => { const ts = el('tspan', { x: 0, y: i * 21 }, tx); ts.textContent = t; });
      const bb = (tx as SVGTextElement).getBBox(); bx.setAttribute('x', String(bb.x - 5)); bx.setAttribute('y', String(bb.y - 3)); bx.setAttribute('width', String(bb.width + 10)); bx.setAttribute('height', String(bb.height + 6));
      placeTip(cp, tg, x, p.y);
      if (mm) { const f = (mm as any).f; mm.g.style.display = ''; mm.g.setAttribute('transform', `translate(${v[4] * f} ${v[5] * f})`); } };
    cp.style.touchAction = 'none'; cp.style.cursor = 'crosshair';
    cp.addEventListener('pointermove', cmove); cp.addEventListener('pointerdown', cmove);
    cp.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideC(); });
    cp.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(hideC, 1500); });
  });
  // ---- race-day time: timeline cursor, median-runner markers, runner dots; auto-play sweeps the clock ----
  const TM = HD.time, tl = document.querySelector<SVGSVGElement>('svg.timeline');
  // elapsed fraction -> mile on a runner's fitness-class curve (flat steps = aid-station dwell)
  const effAt = (e: { mi: number[]; f: number[] }, f: number) => { if (f <= 0) return 0; if (f >= 1) return e.mi[e.mi.length - 1]; let lo = 0, hi = e.f.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (e.f[m] <= f) lo = m; else hi = m; } return e.mi[lo] + ((e.mi[hi] - e.mi[lo]) * (f - e.f[lo])) / (e.f[hi] - e.f[lo] || 1); };
  const ptAt = (k: string, mile: number) => routeAt(HD.courses[k].s, mile);
  const fmt = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`; };
  // runner dots (one per simulated runner) on the main map
  const dotLayer = main.querySelector('g.layer[data-layer="dots"]');
  const dots2: { k: string; T: number; o: number; stop: number; c: SVGCircleElement; j: number; cv: any }[] = [];
  if (dotLayer) for (const [k, C] of Object.entries(TM.courses) as [string, any][]) C.T.forEach((T: number, i: number) => { const c = el('circle', { r: 3.4, fill: HD.courses[k].color, stroke: '#fff', 'stroke-width': 0.9, style: 'display:none' }, dotLayer) as SVGCircleElement; dots2.push({ k, T, o: C.off?.[i] ?? 0, stop: C.stop[i], c, j: (dots2.length * 2.399) % 6.283, cv: C.curves[C.fit[i]] }); });
  // leader = the course's eventual first finisher (fastest 2026 time), not whoever is in front right now: course-colour ring around their dot.
  // course record = a ghost runner at course-record pace: course-colour dot with a heavier dark ring. "You" = bib-lookup runner (black ring).
  const dupLead = new Set<number>(), leadRing: Record<string, SVGCircleElement> = {}, leadIdx: Record<string, number> = {}, recDot: Record<string, SVGGElement> = {};
  if (dotLayer) for (const [k, C] of Object.entries(TM.courses) as [string, any][]) {
    leadRing[k] = el('circle', { fill: 'none', stroke: HD.courses[k].color, style: 'display:none;pointer-events:none' }, dotLayer) as SVGCircleElement;
    let bi = -1; dots2.forEach((d, i) => { if (d.k === k && d.stop < 0 && (bi < 0 || d.T < dots2[bi].T)) bi = i; }); leadIdx[k] = bi;
    if (bi >= 0 && C.rec.year === 2026 && Math.abs(dots2[bi].T - C.rec.T) < 0.2) { dupLead.add(bi); leadIdx[k] = -1; } // same performance: course-record dot only
    const g = el('g', { style: 'display:none;pointer-events:none' }, dotLayer) as SVGGElement; el('circle', { fill: 'none', stroke: '#111' }, g); el('circle', { fill: 'none', stroke: HD.courses[k].color }, g); el('circle', { fill: HD.courses[k].color, stroke: '#fff' }, g); recDot[k] = g;
  }
  let tShown = -1, hovY = -1; // hovY: pointer y in the timeline (−1 = auto-play: time only)
  const pc = (mpm: number) => { const v = Math.round(mpm * 60); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  // modelled median-runner pace at time t (min/mi), from the median fitness-class curve
  const medPace = (k: string, t: number) => { const C = TM.courses[k], cv = C.curves[C.medFit], f = (t - C.start) / C.med; if (f <= 0 || f >= 1) return null; const a = effAt(cv, (t - 6 - C.start) / C.med), b2 = effAt(cv, (t + 6 - C.start) / C.med); return b2 - a > 0.02 ? 12 / (b2 - a) : null; };
  // next cutoff after t for course k (optionally at one station): [mile, minutes after start, station]
  const nextCut = (k: string, t: number, st?: string) => ((HD.courses[k] as any).cut as [number, number, string][]).find(([, m, s2]) => TM.courses[k].start + m >= t && (!st || s2 === st));
  const paceRows = (t: number): string[] => {
    if (!tl || hovY < 0) return [];
    const sTop = +tl.dataset.stop!, sr = +tl.dataset.sr!, order = Object.keys(TM.courses);
    if (hovY >= sTop) { // busiest-times row: that station's next cutoff per course + required pace
      const st = (tl.dataset.stations || '').split(',')[Math.floor((hovY - sTop) / sr)]; if (!st) return [];
      return order.flatMap((k) => { const n = nextCut(k, t, st); return n ? [`${k} cutoff ${fmt(TM.courses[k].start + n[1])} · ${pc(n[1] / n[0])}/mi`] : []; });
    }
    return order.flatMap((k) => { const mp = medPace(k, t), n = nextCut(k, t); if (mp == null && !n) return []; if (t < TM.courses[k].start) return [];
      return [`${k}${mp != null ? ` median ${pc(mp)}` : ''}${n ? ` · cutoff ${pc(n[1] / n[0])}/mi` : '/mi'}`]; });
  };
  // day / night indicator on the big map during the race-day simulation: badge (sun / twilight / moon + clock) and a light night tint
  const sky = TM.sun as { dawn: number; sunrise: number; sunset: number; dusk: number };
  const tint = dotLayer ? el('rect', { x: -5000, y: -5000, width: 20000, height: 20000, fill: '#1f2a44', 'fill-opacity': 0, style: 'pointer-events:none' }, dotLayer) as SVGRectElement : null;
  if (tint) dotLayer!.insertBefore(tint, dotLayer!.firstChild);
  const badge = document.createElement('div'); badge.className = 'daynight ui'; badge.style.display = 'none'; main.parentElement!.appendChild(badge);
  // darkness 0..1 blended through civil twilight (dawn -> sunrise, sunset -> dusk), smoothstep for a gradual change
  const ss = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const dark = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return 0.24 * (m < 720 ? 1 - ss(sky.dawn - 20, sky.sunrise + 10, m) : ss(sky.sunset - 10, sky.dusk + 20, m)); };
  const phase = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return m < sky.dawn || m >= sky.dusk ? 'night' : m < sky.sunrise || m >= sky.sunset ? 'twilight' : 'day'; };
  const setTime = (t: number) => {
    tShown = t; const z = 1 / zoomOf(main);
    { const ph = phase(t); badge.style.display = ''; badge.dataset.phase = ph; badge.textContent = `${ph === 'day' ? '☀' : ph === 'twilight' ? '◐' : '☾'} ${fmt(t)} · ${ph === 'day' ? 'daylight' : ph === 'twilight' ? 'twilight' : 'dark'}`; if (tint) tint.setAttribute('fill-opacity', dark(t).toFixed(3)); }
    const ends: Record<string, { lead?: [number, any]; last?: [number, any] }> = {};
    for (const d of dots2) {
      const C = TM.courses[d.k], f = (t - C.start - d.o) / d.T; const mile = effAt(d.cv, f);
      if (f < 0 || f > 1 || (d.stop >= 0 && mile >= d.stop) || dupLead.has(dots2.indexOf(d))) { d.c.style.display = 'none'; continue; } // not started / finished / dropped (DNF)
      // spread runners slightly so a crowd reads as a crowd, not one dot
      const p = ptAt(d.k, mile), j = d.j;
      d.c.style.display = ''; d.c.setAttribute('cx', String(p[2] + Math.cos(j) * 3)); d.c.setAttribute('cy', String(p[3] + Math.sin(j) * 3)); d.c.setAttribute('r', String(3.4 * z)); d.c.setAttribute('fill', HD.courses[d.k].color); d.c.setAttribute('stroke', '#fff'); d.c.setAttribute('stroke-width', String(0.9 * z));
      const E = (ends[d.k] ??= {}); if (!E.last || mile < E.last[0]) E.last = [mile, d];
    }
    for (const k in leadIdx) { const d = dots2[leadIdx[k]]; if (d && d.c.style.display !== 'none') (ends[k] ??= {}).lead = [0, d]; }
    for (const [k, g] of Object.entries(recDot)) {
      const C = TM.courses[k], f = (t - C.start) / C.rec.T; if (f < 0 || f > 1) { g.style.display = 'none'; continue; }
      const p = ptAt(k, effAt(C.curves[C.rec.fit], f)), cs = g.querySelectorAll('circle'); g.style.display = ''; g.setAttribute('transform', `translate(${p[2]} ${p[3]})`);
      cs[0].setAttribute('r', String(8.4 * z)); cs[0].setAttribute('stroke-width', String(1.6 * z)); cs[1].setAttribute('r', String(6.2 * z)); cs[1].setAttribute('stroke-width', String(2.6 * z)); cs[2].setAttribute('r', String(3.4 * z)); cs[2].setAttribute('stroke-width', String(0.9 * z));
      g.parentNode!.appendChild(g);
    }
    for (const k in leadRing) leadRing[k].style.display = 'none';
    // leader = standard dot + course-colour ring with a small gap; last runner = hollow ring (white fill, course-colour stroke). Small, drawn on top.
    for (const [k, E] of Object.entries(ends)) for (const [q, lead] of [[E.last, false], [E.lead, true]] as const) {
      if (!q) continue; const c = q[1].c as SVGCircleElement, col = HD.courses[k].color;
      if (lead) { const R = leadRing[k]; R.setAttribute('cx', c.getAttribute('cx')!); R.setAttribute('cy', c.getAttribute('cy')!); R.setAttribute('r', String(6.6 * z)); R.setAttribute('stroke-width', String(2.2 * z)); R.style.display = ''; c.parentNode!.appendChild(c); c.parentNode!.appendChild(R); continue; }
      c.setAttribute('r', String(4.2 * z)); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', String(2 * z));
      if (c.nextSibling) c.parentNode!.appendChild(c);
    }
    glide.clear(); // no median-runner markers during time play (profile distance-hover markers are separate)
    if (tl) {
      const t0 = +tl.dataset.t0!, t1 = +tl.dataset.t1!, lx = +tl.dataset.lx!, rx = +tl.dataset.rx!, x = lx + ((t - t0) / (t1 - t0)) * (rx - lx);
      const cur = tl.querySelector<SVGGElement>('g.tlcursor')!, txt = cur.querySelector('text')!, bx = cur.querySelector('rect')!, tg = cur.querySelector<SVGGElement>('g.tip')!;
      cur.style.display = ''; cur.querySelector('path')!.setAttribute('transform', `translate(${x} 0)`);
      const rows = [fmt(t), ...paceRows(t)];
      txt.textContent = ''; txt.setAttribute('text-anchor', 'start');
      rows.forEach((r, i) => { const ts = document.createElementNS(NS, 'tspan'); ts.setAttribute('x', '0'); ts.setAttribute('y', String(i ? 4 + i * 18 : 0)); ts.textContent = String(r); ts.setAttribute('font-size', i ? '14' : '17'); if (i) ts.setAttribute('font-weight', '600'); txt.appendChild(ts); });
      const bb = (txt as SVGTextElement).getBBox(); bx.setAttribute('x', String(bb.x - 5)); bx.setAttribute('y', String(bb.y - 3)); bx.setAttribute('width', String(bb.width + 10)); bx.setAttribute('height', String(bb.height + 6));
      if (hovY >= 0) placeTip(tl, tg, x, hovY); else placeTip(tl, tg, x, 0);
    }
  };
  const clearTime = () => { tShown = -1; hovY = -1; badge.style.display = 'none'; tint?.setAttribute('fill-opacity', '0'); Object.values(recDot).forEach((g) => (g.style.display = 'none')); Object.values(leadRing).forEach((g) => (g.style.display = 'none')); dots2.forEach((d) => (d.c.style.display = 'none')); glide.clear(); const cur = tl?.querySelector<SVGGElement>('g.tlcursor'); if (cur) cur.style.display = 'none'; };
  main.addEventListener('zoomchange', () => { glide.redraw(); if (tShown >= 0) setTime(tShown); });
  document.querySelectorAll('svg.mini').forEach((m) => m.addEventListener('zoomchange', () => glide.redraw()));
  // auto-play (web only): slow sweep of the race-day clock, looping; off for reduced motion; pause persisted
  // play window: first race start → last runner off course (latest finish across all courses); loops back to the first start
  const CS = Object.values(TM.courses) as any[], PA = Math.min(...CS.map((C) => C.start)), PB = Math.max(...CS.map((C) => C.start + 2 + Math.max(...C.T)));
  const LOOP_S = 90, KEY = 'bbu-autoplay-paused';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = localStorage.getItem(KEY) === '1', user = false, t0 = 0, f0 = 0, raf = 0, last = 0;
  const running = () => !reduced && !paused && !user && !document.hidden && !matchMedia('print').matches;
  const tick = (t: number) => {
    raf = 0; if (!running()) return;
    if (!t0) t0 = t - f0 * LOOP_S * 1000;
    const f = (((t - t0) / 1000 / LOOP_S) % 1); f0 = f;
    setTime(PA + f * (PB - PA)); last = t; // every frame, continuous (fractional) clock
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
  // timeline: hover scrubs the clock; a click seeks playback to that time and plays on from there (starting it if paused).
  // After a click, hover stays out of the way until the pointer leaves the chart so the playback is visible.
  if (tl) {
    let seek = false;
    const tAt = (e: PointerEvent | MouseEvent) => { const ctm = tl.getScreenCTM(); if (!ctm) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()), lx = +tl.dataset.lx!, rx = +tl.dataset.rx!; const t = TM.t0 + ((p.x - lx) / (rx - lx)) * (TM.t1 - TM.t0); return t < TM.t0 || t > TM.t1 ? null : { t, y: p.y }; };
    const tmove = (e: PointerEvent) => { if (seek) return; const q = tAt(e); if (!q) return; hovY = q.y; hide(); setTime(q.t); };
    tl.style.cursor = 'crosshair';
    tl.addEventListener('pointerenter', () => { if (!seek) suspend(); }); tl.addEventListener('pointermove', tmove); tl.addEventListener('pointerdown', (e) => { if (!seek) { suspend(); tmove(e); } });
    tl.addEventListener('click', (e) => { const q = tAt(e); if (!q || reduced) return;
      seek = true; paused = false; localStorage.setItem(KEY, '0'); label(); hovY = -1;
      f0 = Math.min(0.9999, Math.max(0, (q.t - PA) / (PB - PA))); stop(); user = false; t0 = 0; setTime(PA + f0 * (PB - PA)); start(); });
    tl.addEventListener('pointerleave', (e) => { if (seek) { seek = false; return; } if (e.pointerType === 'mouse') { clearTime(); resume(); } });
    tl.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(() => { if (seek) return; clearTime(); resume(); }, 1500); });
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


// ---- course pages: print one course only ----
document.querySelectorAll<HTMLButtonElement>('button.printone').forEach((b) => b.addEventListener('click', () => {
  document.body.classList.add('printone'); document.querySelectorAll('.coursepage').forEach((p) => p.classList.toggle('on', (p as HTMLElement).dataset.course === b.dataset.course));
  const done = () => { document.body.classList.remove('printone'); removeEventListener('afterprint', done); }; addEventListener('afterprint', done); print();
}));

// ---- floor plans: wheel zoom toward the cursor, drag / touch pan, pinch, double-click reset; web only (reset in print) ----
document.querySelectorAll<HTMLElement>('.fp-zoom').forEach((box) => {
  const st = box.querySelector<HTMLElement>('.fp-stage')!; let k = 1, x = 0, y = 0;
  const clamp = () => { k = Math.min(8, Math.max(1, k)); const w = box.clientWidth, h = box.clientHeight; x = Math.min(0, Math.max(w - w * k, x)); y = Math.min(0, Math.max(h - h * k, y)); st.style.transform = k === 1 ? '' : `translate(${x}px,${y}px) scale(${k})`; };
  const zoomAt = (f: number, cx: number, cy: number) => { const nk = Math.min(8, Math.max(1, k * f)); x = cx - ((cx - x) * nk) / k; y = cy - ((cy - y) * nk) / k; k = nk; clamp(); };
  box.querySelectorAll<HTMLButtonElement>('.fp-zoomctl button').forEach((b) => { b.addEventListener('click', () => zoomAt(b.dataset.z === 'in' ? 1.5 : 1 / 1.5, box.clientWidth / 2, box.clientHeight / 2)); b.addEventListener('dblclick', (e) => e.stopPropagation()); });
  box.addEventListener('dblclick', () => { k = 1; x = y = 0; clamp(); });
  box.addEventListener('wheel', (e) => { e.preventDefault(); const r = box.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const pts = new Map<number, { x: number; y: number }>(); let last: { x: number; y: number; d: number } | null = null;
  const state = () => { const p = [...pts.values()], r = box.getBoundingClientRect(), cx = p.reduce((s, q) => s + q.x, 0) / p.length - r.left, cy = p.reduce((s, q) => s + q.y, 0) / p.length - r.top; return { x: cx, y: cy, d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 }; };
  st.addEventListener('pointerdown', (e) => { st.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = state(); st.classList.add('drag'); });
  st.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const s = state(); if (last) { x += s.x - last.x; y += s.y - last.y; if (s.d && last.d) zoomAt(s.d / last.d, s.x, s.y); else clamp(); } last = s; });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); last = pts.size ? state() : null; if (!pts.size) st.classList.remove('drag'); };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  addEventListener('beforeprint', () => { k = 1; x = y = 0; clamp(); });
});

// ---- ?view=embed inside an iframe (dist/embed.js): report the content height to the parent so it can size the iframe ----
if (document.documentElement.classList.contains('embed') && parent !== window) {
  let last = 0; const post = () => { const h = document.documentElement.scrollHeight; if (Math.abs(h - last) > 1) { last = h; parent.postMessage({ type: 'bbu-embed-height', height: h }, '*'); } };
  new ResizeObserver(post).observe(document.body); addEventListener('load', post); post();
}
