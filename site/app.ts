import { initZoom, zoomOf, zoomToBox } from './zoom';
import { makeGlide, routeAt } from './glide';
import { icon } from './lib/icons';
import { placeTip } from './tip';
// race filter (checkboxes in the Map layers box): which races are shown
const raceOn = (k: string) => !document.documentElement.dataset['off' + k.replace(/\W/g, '')];
type Row = { b: string; l?: string; c?: string };
/** tooltip text with a clear hierarchy: bold value / title, then a lighter label */
const rich = (txt: SVGTextElement, rows: Row[], lh: number, x = 0, fsz?: number, y0 = 0) => { const NS2 = 'http://www.w3.org/2000/svg'; txt.textContent = ''; txt.setAttribute('font-weight', '400');
  rows.forEach((r2, i) => { const a1 = document.createElementNS(NS2, 'tspan'); a1.setAttribute('x', String(x)); a1.setAttribute('y', String(y0 + i * lh)); a1.setAttribute('font-weight', '700'); a1.setAttribute('fill', r2.c ?? '#111'); if (fsz && i === 0) a1.setAttribute('font-size', String(fsz)); a1.textContent = r2.b; txt.appendChild(a1);
    if (r2.l) { const a2 = document.createElementNS(NS2, 'tspan'); a2.setAttribute('font-weight', '400'); a2.setAttribute('fill', '#666'); a2.textContent = ' ' + r2.l; txt.appendChild(a2); } }); };
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
  const mk = (svg: SVGSVGElement, r: number, sw: number) => { const g = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, svg.querySelector('g.zv') ?? svg); const c = el('circle', { r: r * 0.72, fill: '#111', stroke: '#fff', 'stroke-width': sw * 0.8 }, g); /* race-colour dot, white stroke */ return { g, c }; };
  // one marker per course on the main map, one on each course's own mini map
  const mains: Record<string, ReturnType<typeof mk>> = {}, minis: Record<string, ReturnType<typeof mk>> = {};
  for (const [k, c] of Object.entries(HD.courses)) { mains[k] = mk(main, 13, 5); mains[k].c.setAttribute('fill', c.color); }
  document.querySelectorAll<SVGSVGElement>('svg.mini').forEach((s) => { const k = s.dataset.mini!; minis[k] = mk(s, 12, 4.5); if (HD.courses[k]) minis[k].c.setAttribute('fill', HD.courses[k].color); });
  const pg = el('g', { class: 'hov', style: 'display:none;pointer-events:none' }, prof);
  const vline = el('line', { y1: 0, y2: HD.profile.H, stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, pg);
  const dots: Record<string, Element> = {};
  for (const [k, c] of Object.entries(HD.courses)) dots[k] = el('circle', { r: 7, fill: '#fff', 'stroke-width': 3.5, stroke: c.color }, pg);
  const tipG = el('g', { class: 'tip' }, pg) as SVGGElement, box = el('rect', { fill: '#fff', 'fill-opacity': 0.94, stroke: '#bbb', 'stroke-width': 1, rx: 4 }, tipG);
  const lab = el('text', { 'font-size': 19, 'font-weight': 700 }, tipG), bibs = el('g', {}, tipG);
  const BW: number = (HD.courses as any)._bibw, BH: number = (HD.courses as any)._bibh; delete (HD.courses as any)._bibw; delete (HD.courses as any)._bibh;
  const { W, H } = HD.profile; let [x0, x1] = HD.profile.x, [y0, y1] = HD.profile.y;
  // race filter swaps the chart body (rescaled to the longest visible route): keep the hover's scale in step
  prof.addEventListener('profilescale', (e) => { const d = (e as CustomEvent).detail; [x0, x1] = d.x; [y0, y1] = d.y; });
  const X = (m: number) => ((m - x0) / (x1 - x0)) * W, Y = (ft: number) => (1 - (ft - y0) / (y1 - y0)) * H;
  const all = () => [...Object.values(mains), ...Object.values(minis)];
  const glide = makeGlide(HD.courses, mains, minis, zoomOf); void all;
  const hide = () => { pg.style.display = 'none'; glide.clear(); };
  const move = (ev: PointerEvent) => {
    const ctm = prof.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    // over a station marker: that station's cutoff time(s) and the overall pace they require, per visible race
    const pc0 = (ev.target as Element).closest?.('g.pcall') as SVGGElement | null;
    if (pc0) { const st = pc0.dataset.st!, mi = +pc0.dataset.mi!; const rows: Row[] = Object.entries(HD.courses).filter(([k]) => raceOn(k)).flatMap(([k, c]: [string, any]) => (c.cut as [number, number, string][]).filter(([m, , s2]) => s2 === st && Math.abs(m - mi) < 1.5).map(([m, mm]) => ({ b: `${k} cutoff ${fmt(HD.time.courses[k].start + mm)}`, l: `mi ${m.toFixed(1)} · ${pace(mm / m)}/mi`, c: c.color })));
      if (rows.length) { show(x0 + (p.x / W) * (x1 - x0), p.y, rows); return; } }
    show(x0 + (p.x / W) * (x1 - x0), p.y); // x decides the mile; every visible race marks its position
  };
  // average pace from the start needed to make the next cutoff at or beyond this mile
  const pace = (mpm: number) => { const s = Math.round(mpm * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const cutPace = (c: any, mile: number) => { const n = (c.cut as [number, number][]).find(([m]) => m >= mile - 1e-6 && m > 0); return n ? ` · cutoff pace ${pace(n[1] / n[0])}/mi` : ''; };
  // distance to the next aid station (or finish) along that course
  const nextStop = (c: any, mile: number) => { const n = (c.stops as [number, string][]).find(([m]) => m > mile + 0.05); return n ? `${(n[0] - mile).toFixed(1)} mi to ${n[1]}` : 'at the finish'; }; void cutPace;
  const show = (mile: number, py?: number, extra: Row[] = []) => {
    if (mile < 0) return hide();
    // every course that reaches this mile gets a marker; shorter courses show nothing
    const hits = Object.entries(HD.courses).filter(([k, c]) => mile <= c.dist && raceOn(k)).map(([k, c]) => ({ k, c, v: routeAt(c.s, mile) }));
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
    for (const k in HD.courses) glide.set(k, hits.some((h) => h.k === k) ? mile : null); void pick; // every shown race marks its own position at this mile
    // readout: one line per course, longest first: course · mile · cumulative gain from the start
    lab.textContent = '';
    // condensed: one line per course: bib · mile · gain so far · pace needed for the next cutoff
    const rows: (Row & { bib?: string })[] = [...hits.map(({ c, v }) => ({ bib: (c as any).bib, b: `${v[0].toFixed(1)} mi`, l: nextStop(c, v[0]) })), ...extra];
    const LH = 26, lx = BW + 6;
    rich(lab as SVGTextElement, rows, LH, lx, undefined, 13);
    lab.setAttribute('text-anchor', 'start');
    bibs.innerHTML = rows.filter((r) => r.bib).map((r, i) => `<g transform="translate(0 ${13 + i * LH - 7 - BH / 2})">${r.bib}</g>`).join('');
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
      tx.setAttribute('text-anchor', 'start');
      const ns = (C.stops as [number, string][]).find(([m]) => m > mile + 0.05), near = (C.cut as [number, number, string][]).find(([m]) => Math.abs(CX(m) - x) < 14);
      rich(tx as SVGTextElement, near ? [{ b: `${HD.courses[k] && (C.stops as [number, string][]).find(([m]) => Math.abs(m - near[0]) < 0.01)?.[1]} · mi ${near[0].toFixed(1)}` }, { b: `Cutoff ${fmt(st + near[1])}`, l: `${pace(near[1] / near[0])}/mi from the start`, c: C.color }]
        : [{ b: `${v[0].toFixed(1)} mi`, l: ns ? `${(ns[0] - mile).toFixed(1)} mi to ${ns[1]}` : 'at the finish' }], 21); void n;
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
  // 5-year average race-day temperature: per hour [minute, °F]
  const TD = JSON.parse(document.getElementById('tempdata')?.textContent || '{"s":[],"y":[]}'), TS: number[][] = TD.s;
  const tempAtJS = (m: number, j = 1) => { const i = TS.findIndex((p) => p[0] >= m); if (i < 1) return NaN; const [ma, va] = [TS[i - 1][0], TS[i - 1][j]], [mb, vb] = [TS[i][0], TS[i][j]]; return va + ((vb - va) * (m - ma)) / (mb - ma); };
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
    const g = el('g', { style: 'display:none;pointer-events:none' + (dupLead.has(bi) ? '' : ';opacity:.22') /* course-record marker faded, unless the leader IS the course record (same runner) */ }, dotLayer) as SVGGElement; el('circle', { fill: 'none', stroke: '#111' }, g); el('circle', { fill: 'none', stroke: HD.courses[k].color }, g); el('circle', { fill: HD.courses[k].color, stroke: '#fff' }, g); recDot[k] = g;
  }
  let tShown = -1, hovY = -1; // hovY: pointer y in the timeline (−1 = auto-play: time only)
  const pc = (mpm: number) => { const v = Math.round(mpm * 60); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
  // next cutoff after t for course k (optionally at one station): [mile, minutes after start, station]
  const nextCut = (k: string, t: number, st?: string) => ((HD.courses[k] as any).cut as [number, number, string][]).find(([, m, s2]) => TM.courses[k].start + m >= t && (!st || s2 === st));
  const paceRows = (t: number): Row[] => {
    if (!tl || hovY < 0) return [];
    const sTop = +tl.dataset.stop!, sr = +tl.dataset.sr!, sBot = +tl.dataset.sbot!, order = Object.keys(TM.courses).filter((k) => raceOn(k));
    if (hovY >= sTop && hovY < sBot) { // busiest-times row: that station's next cutoff per course + required pace
      const st = (tl.dataset.stations || '').split(',')[Math.floor((hovY - sTop) / sr)]; if (!st) return [];
      // cutoffs whose mark (its full width) overlaps the hovered 15-min cell
      const gEl = tl.querySelector<SVGGElement>(`g.tlst[data-station="${CSS.escape(st)}"]`), cw = +(gEl?.dataset.cw || 0), bs = TM.t0 + Math.floor((t - TM.t0) / 15) * 15;
      const here: Row[] = (JSON.parse(gEl?.dataset.cuts || '[]') as [number, string][]).filter(([ct, k]) => raceOn(k) && ct + cw / 2 >= bs && ct - cw / 2 <= bs + 15).map(([ct, k]) => ({ b: `${gEl?.dataset.name ?? st} cutoff ${fmt(ct)}`, l: k, c: HD.courses[k].color }));
      if (here.length) return here;
      return order.flatMap((k) => { const n = nextCut(k, t, st); return n ? [{ b: k, c: HD.courses[k].color, l: `cutoff ${fmt(TM.courses[k].start + n[1])} · ${pc(n[1] / n[0])}/mi needed` }] : []; });
    }
    return order.flatMap((k) => { const n = nextCut(k, t); if (!n || t < TM.courses[k].start) return [];
      return [{ b: k, c: HD.courses[k].color, l: `next cutoff ${fmt(TM.courses[k].start + n[1])} · ${pc(n[1] / n[0])}/mi needed` }]; });
  };
  // ONE shade (the elevation profile's background gray) for map night, timeline night and the notice box: colors.json shade / shade_op
  const SHADE: [string, number] = ['#888888', 0.17];
  // day / night indicator on the big map during the race-day simulation: badge (sun / twilight / moon + clock) and a light night tint
  const sky = TM.sun as { dawn: number; sunrise: number; sunset: number; dusk: number };
  const tint = dotLayer ? el('rect', { x: -5000, y: -5000, width: 20000, height: 20000, fill: SHADE[0], 'fill-opacity': 0, style: 'pointer-events:none' }, dotLayer) as SVGRectElement : null;
  if (tint) dotLayer!.insertBefore(tint, dotLayer!.firstChild);
  const badge = document.createElement('div'); badge.className = 'daynight ui'; badge.style.display = 'none'; main.parentElement!.appendChild(badge);
  // darkness 0..1 blended through civil twilight (dawn -> sunrise, sunset -> dusk), smoothstep for a gradual change
  const ss = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const dark = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return SHADE[1] * (m < 720 ? 1 - ss(sky.dawn - 20, sky.sunrise + 10, m) : ss(sky.sunset - 10, sky.dusk + 20, m)); };
  const phase = (t: number) => { const m = ((t % 1440) + 1440) % 1440; return m < sky.dawn || m >= sky.dusk ? 'night' : m < sky.sunrise || m >= sky.sunset ? 'twilight' : 'day'; };
  // runner-dot size: slightly larger on desktop, noticeably larger on phones (DS = factor over the original 3.4 radius)
  const DS = matchMedia('(max-width:699px)').matches ? 1.9 : 1.25;
  const setTime = (t: number) => {
    tShown = t; const z = 1 / zoomOf(main); document.dispatchEvent(new CustomEvent('racetime', { detail: t }));
    if (!Object.keys(TM.courses).some(raceOn)) { badge.style.display = 'none'; tint?.setAttribute('fill-opacity', '0'); } else { const ph = phase(t); badge.style.display = ''; badge.dataset.phase = ph; badge.textContent = `${ph === 'day' ? '☀' : ph === 'twilight' ? '◐' : '☾'} ${fmt(t)} · ${ph === 'day' ? 'daylight' : ph === 'twilight' ? ((((t % 1440) + 1440) % 1440) < 720 ? 'dawn' : 'dusk') : 'dark'}`; if (tint) tint.setAttribute('fill-opacity', dark(t).toFixed(3)); }
    const ends: Record<string, { lead?: [number, any]; last?: [number, any] }> = {};
    for (const d of dots2) {
      const C = TM.courses[d.k], f = (t - C.start - d.o) / d.T; const mile = effAt(d.cv, f);
      if (!raceOn(d.k) || f < 0 || f > 1 || (d.stop >= 0 && mile >= d.stop) || dupLead.has(dots2.indexOf(d))) { d.c.style.display = 'none'; continue; } // not started / finished / dropped (DNF)
      // spread runners slightly so a crowd reads as a crowd, not one dot
      const p = ptAt(d.k, mile), j = d.j;
      d.c.style.display = ''; d.c.setAttribute('cx', String(p[2] + Math.cos(j) * 3)); d.c.setAttribute('cy', String(p[3] + Math.sin(j) * 3)); d.c.setAttribute('r', String(3.4 * DS * z)); d.c.setAttribute('fill', HD.courses[d.k].color); d.c.setAttribute('stroke', '#fff'); d.c.setAttribute('stroke-width', String(0.9 * DS * z));
      const E = (ends[d.k] ??= {}); if (!E.last || mile < E.last[0]) E.last = [mile, d];
    }
    for (const k in leadIdx) { const d = dots2[leadIdx[k]]; if (d && d.c.style.display !== 'none') (ends[k] ??= {}).lead = [0, d]; }
    for (const [k, g] of Object.entries(recDot)) {
      const C = TM.courses[k], f = (t - C.start) / C.rec.T; if (!raceOn(k) || f < 0 || f > 1) { g.style.display = 'none'; continue; }
      const p = ptAt(k, effAt(C.curves[C.rec.fit], f)), cs = g.querySelectorAll('circle'); g.style.display = ''; g.setAttribute('transform', `translate(${p[2]} ${p[3]})`);
      cs[0].setAttribute('r', String(8.4 * DS * z)); cs[0].setAttribute('stroke-width', String(1.6 * DS * z)); cs[1].setAttribute('r', String(6.2 * DS * z)); cs[1].setAttribute('stroke-width', String(2.6 * DS * z)); cs[2].setAttribute('r', String(3.4 * DS * z)); cs[2].setAttribute('stroke-width', String(0.9 * DS * z));
      g.parentNode!.appendChild(g);
    }
    for (const k in leadRing) leadRing[k].style.display = 'none';
    // leader = standard dot + course-colour ring with a small gap; last runner = hollow ring (white fill, course-colour stroke). Small, drawn on top.
    for (const [k, E] of Object.entries(ends)) for (const [q, lead] of [[E.last, false], [E.lead, true]] as const) {
      if (!q) continue; const c = q[1].c as SVGCircleElement, col = HD.courses[k].color;
      if (lead) { const R = leadRing[k]; R.setAttribute('cx', c.getAttribute('cx')!); R.setAttribute('cy', c.getAttribute('cy')!); R.setAttribute('r', String(6.6 * DS * z)); R.setAttribute('stroke-width', String(2.2 * DS * z)); R.style.display = ''; c.parentNode!.appendChild(c); c.parentNode!.appendChild(R); continue; }
      c.setAttribute('r', String(4.2 * DS * z)); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', col); c.setAttribute('stroke-width', String(2 * DS * z));
      if (c.nextSibling) c.parentNode!.appendChild(c);
    }
    glide.clear(); // no median-runner markers during time play (profile distance-hover markers are separate)
    if (tl) {
      const t0 = +tl.dataset.t0!, t1 = +tl.dataset.t1!, lx = +tl.dataset.lx!, rx = +tl.dataset.rx!, x = lx + ((t - t0) / (t1 - t0)) * (rx - lx);
      const cur = tl.querySelector<SVGGElement>('g.tlcursor')!, txt = cur.querySelector('text')!, bx = cur.querySelector('rect')!, tg = cur.querySelector<SVGGElement>('g.tip')!;
      cur.style.display = ''; cur.querySelector('path')!.setAttribute('transform', `translate(${x} 0)`);
      const tc = Math.round(tempAtJS(t));
      txt.setAttribute('text-anchor', 'start'); txt.setAttribute('font-size', '15');
      rich(txt as SVGTextElement, [{ b: fmt(t), l: Number.isFinite(tc) ? `· ${tc}°F` : '' }, ...paceRows(t)], 20, 0, 17);
      const bb = (txt as SVGTextElement).getBBox(); bx.setAttribute('x', String(bb.x - 5)); bx.setAttribute('y', String(bb.y - 3)); bx.setAttribute('width', String(bb.width + 10)); bx.setAttribute('height', String(bb.height + 6));
      if (hovY >= 0) placeTip(tl, tg, x, hovY); else placeTip(tl, tg, x, 0);

      
    }
  };
  const clearTime = () => { tShown = -1; hovY = -1; badge.style.display = 'none'; tint?.setAttribute('fill-opacity', '0'); Object.values(recDot).forEach((g) => (g.style.display = 'none')); Object.values(leadRing).forEach((g) => (g.style.display = 'none')); dots2.forEach((d) => (d.c.style.display = 'none')); glide.clear(); tl?.querySelectorAll<SVGGElement>('g.sun').forEach((g) => (g.style.opacity = '')); const cur = tl?.querySelector<SVGGElement>('g.tlcursor'); if (cur) cur.style.display = 'none'; };
  main.addEventListener('zoomchange', () => { glide.redraw(); if (tShown >= 0) setTime(tShown); });
  document.querySelectorAll('svg.mini').forEach((m) => m.addEventListener('zoomchange', () => glide.redraw()));
  // auto-play (web only): slow sweep of the race-day clock, looping; off for reduced motion; pause persisted
  // play window: first race start → last runner off course (latest finish across all courses); loops back to the first start
  // loop window: first start -> last runner off course of the VISIBLE races only (race filter), 10 min padding each side
  let PA = 0, PB = 1; const span = () => { const CS = (Object.entries(TM.courses) as [string, any][]).filter(([k]) => raceOn(k)).map(([, C]) => C); const S = CS.length ? CS : Object.values(TM.courses) as any[];
    PA = Math.min(...S.map((C) => C.start)) - 10; PB = Math.max(...S.map((C) => C.start + 2 + Math.max(...C.T))) + 10; }; span(); document.addEventListener('change', (e) => { if ((e.target as Element).matches?.('input[data-race], input[data-race-all]')) span(); });
  document.querySelector('svg.profile')?.addEventListener('click', () => setTimeout(span, 0));
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
  const label = () => { btn.innerHTML = paused ? `${icon('play')}Play race day` : `${icon('pause')}Pause`; btn.setAttribute('aria-label', paused ? 'Play race-day animation' : 'Pause race-day animation'); btn.setAttribute('aria-pressed', String(!paused)); };
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
// logo stays the topmost map element even if anything is appended to the map later
const logoTop = () => { const a = mapLogo?.parentElement; if (a && mapSvg && mapSvg.lastElementChild !== a) mapSvg.appendChild(a); }; addEventListener('load', logoTop); new MutationObserver(logoTop).observe(mapSvg ?? document.createElement('svg'), { childList: true });
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
  box.querySelectorAll<HTMLButtonElement>('.fp-zoomctl button').forEach((b) => { b.addEventListener('click', () => { if (b.dataset.z === 'reset') { k = 1; x = y = 0; clamp(); } else zoomAt(b.dataset.z === 'in' ? 1.5 : 1 / 1.5, box.clientWidth / 2, box.clientHeight / 2); }); b.addEventListener('dblclick', (e) => e.stopPropagation()); });
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

// embed: a modal dialog's viewport is the whole auto-height iframe, so pin open lightboxes to the HOST viewport (embed.js sends the iframe top and
// the host window height); embed.js keeps the host scroll position while a lightbox is open and restores it on close
let hostTop = 0;
const inEmbed = document.documentElement.classList.contains('embed') && parent !== window;
function fitModal(d: HTMLDialogElement) { if (!inEmbed) return; const hv = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--host-vh')) * 100 || innerHeight;
  const y = Math.max(0, Math.min(-hostTop, document.documentElement.scrollHeight - hv)); Object.assign(d.style, { position: 'fixed', inset: 'auto 0 auto 0', top: y + 'px', height: hv + 'px', margin: '0' }); }
function embedModal(d: HTMLDialogElement, open: boolean) { if (!inEmbed) return; if (open) fitModal(d); parent.postMessage({ type: 'bbu-modal', open }, '*'); }
// ---- ?view=embed inside an iframe (dist/embed.js): report the content height to the parent so it can size the iframe ----
if (document.documentElement.classList.contains('embed') && parent !== window) {
  let last = 0; const post = () => { const h = document.documentElement.scrollHeight; if (Math.abs(h - last) > 1) { last = h; parent.postMessage({ type: 'bbu-embed-height', height: h }, '*'); } };
  // host viewport from embed.js -> --host-vw/--host-vh (1% of the parent window), so vh/vw size limits follow the HOST screen, not the auto-height iframe
  let hv = '';
  addEventListener('message', (e) => { const d = e.data; if (e.source !== parent || !d || d.type !== 'bbu-host-viewport' || !(d.w > 0 && d.h > 0)) return;
    const v = d.w + 'x' + d.h; if (v === hv) return; hv = v; const s = document.documentElement.style; s.setProperty('--host-vw', d.w / 100 + 'px'); s.setProperty('--host-vh', d.h / 100 + 'px'); });
  // pinned navbar inside the auto-height iframe: embed.js sends the iframe's top edge in the host window; shift the navbar down by what scrolled out
  addEventListener('message', (e) => { const d = e.data; if (e.source !== parent || !d || d.type !== 'bbu-host-scroll' || !Number.isFinite(d.top)) return;
    const nav = document.querySelector<HTMLElement>('.topnav'); if (!nav) return; const y = Math.max(0, Math.min(-d.top, document.documentElement.scrollHeight - nav.offsetHeight - nav.offsetTop));
    nav.style.transform = y ? `translateY(${y}px)` : ''; nav.classList.toggle('pinned', y > 0); hostTop = d.top; document.querySelectorAll<HTMLDialogElement>('dialog.lightbox[open]').forEach(fitModal); });
  new ResizeObserver(post).observe(document.body); addEventListener('load', post); post();
}

// ---- race filter: checkboxes (all on initially) hide the unchecked races everywhere: map zoom boxes + labels + runner dots, elevation
// lines + markers, timeline bands (restacked), heat map (recomputed from per-race counts), cutoff marks and race cards ----
{
  const NSf = 'http://www.w3.org/2000/svg', root = document.documentElement;
  const tlsvg = document.querySelector<SVGSVGElement>('svg.timeline'), tld = tlsvg?.querySelector('script.tldata');
  const TL = tld ? JSON.parse(tld.textContent || '{}') : null;
  const HDt = JSON.parse(document.getElementById('hoverdata')?.textContent || '{}').time;
  const heatRamp = (v: number) => { const S = [[255, 244, 222], [247, 182, 92], [214, 72, 40], [140, 18, 18], [74, 8, 8]], x = Math.min(1, Math.max(0, v)) * (S.length - 1), i = Math.min(S.length - 2, Math.floor(x)), f = x - i; return 'rgb(' + S[i].map((a, j) => Math.round(a + (S[i + 1][j] - a) * f)).join(',') + ')'; };
  const HD0 = JSON.parse(document.getElementById('hoverdata')?.textContent || '{}'); let origProf: { s: string; x: number[]; y: number[] } | null = null, profVariants: Promise<any> | null = null;
  const heatSrc = JSON.parse(document.getElementById('heatdata')?.textContent || 'null');
  // race filter: "All" checked + no individual race checked = every race; checking races shows only those; unchecking the last reverts to All
  const picked = (all: string[]) => { const p = [...document.querySelectorAll<HTMLInputElement>('input[data-race]')].filter((i) => i.checked).map((i) => i.dataset.race!); return p.length ? p : all; };
  const apply = (force?: string[]) => {
    const all = [...document.querySelectorAll<HTMLInputElement>('input[data-race]')].map((i) => i.dataset.race!), on = force ?? picked(all);
    for (const k of all) { const key = 'off' + k.replace(/\W/g, ''); if (on.includes(k)) delete root.dataset[key]; else root.dataset[key] = '1'; }
    // main map + page 1 charts + race cards
    document.querySelectorAll<SVGElement | HTMLElement>('.mainmap [data-course], .tlcut [data-course]').forEach((e) => (e.style.display = on.includes(e.dataset.course!) ? '' : 'none'));
    // page-1 elevation chart: body for exactly the visible races, scaled to the longest visible route
    { const pb = document.querySelector<SVGGElement>('svg.profile g.pbody'), prof2 = pb?.ownerSVGElement; if (pb && prof2) { const key = on.join(',');
      origProf ??= { s: pb.innerHTML, x: HD0.profile.x, y: HD0.profile.y };
      const put = (v: { s: string; x: number[]; y: number[] }) => { pb.innerHTML = v.s; prof2.dispatchEvent(new CustomEvent('profilescale', { detail: v })); };
      if (on.length === all.length) put(origProf); else (profVariants ??= fetch('profiles.json').then((r) => r.json())).then((V) => { if (V[key] && picked(all).join(',') === key) put(V[key]); }); } }
    // main map: race routes in race colours when fewer than all races are shown, and zoom to fit them (reset for all / none)
    { const mm = document.querySelector<SVGSVGElement>('svg.mainmap'), sub = on.length > 0 && on.length < all.length, bb = [Infinity, Infinity, -Infinity, -Infinity];
      document.querySelectorAll<SVGGElement>('.mainmap g.raceroute').forEach((g) => { const vis = sub && on.includes(g.dataset.rc!); g.style.display = vis ? '' : 'none'; if (vis) { const b = g.dataset.bb!.split(',').map(Number); bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); } });
      if (mm) zoomToBox(mm, sub && !force ? { x0: bb[0], y0: bb[1], x1: bb[2], y1: bb[3] } : null); }
    // heat-map cutoff marks shared by several races at one station + time: the row height is split evenly among the VISIBLE races (all heat maps)
    document.querySelectorAll<SVGGElement>('g.tlcut[data-r]').forEach((g) => { const [lo, hi] = g.dataset.r!.split(',').map(Number), vis = [...g.querySelectorAll<SVGRectElement>('rect[data-course]')].filter((r) => on.includes(r.dataset.course!)), n = vis.length, sh = (hi - lo) / Math.max(1, n);
      vis.forEach((r, j) => { const ya = lo + j * sh + (j ? 0.75 : 0), yb = lo + (j + 1) * sh - (j < n - 1 ? 0.75 : 0); r.setAttribute('y', ya.toFixed(1)); r.setAttribute('height', (yb - ya).toFixed(1)); }); });
    // "All" checkbox mirrors the state: checked = all, indeterminate = some, unchecked = none
    { const ab = document.querySelector<HTMLInputElement>('input[data-race-all]'); if (ab && !force) ab.checked = !document.querySelector('input[data-race]:checked'); }
    // timeline: restack the visible races
    if (TL && tlsvg) { const acc = TL.xs.map(() => 0), mx = Math.max(1, ...TL.xs.map((_: number, i: number) => on.reduce((s, k) => s + (TL.v[k]?.[i] ?? 0), 0)));
      const Y = (v: number) => TL.base - (v / mx) * TL.hgt;
      for (const k of Object.keys(TL.v)) { const band = tlsvg.querySelector<SVGPathElement>(`g.tlrow[data-course="${k}"] path`), top = tlsvg.querySelector<SVGPathElement>(`path.ln[data-course="${k}"]`); if (!band || !top) continue;
        const vis = on.includes(k); band.style.display = top.style.display = vis ? '' : 'none'; if (!vis) continue;
        const lo = acc.slice(); TL.xs.forEach((_: number, i: number) => (acc[i] += TL.v[k][i]));
        const up = TL.xs.map((x: number, i: number) => `${x},${Y(acc[i]).toFixed(1)}`), dn = TL.xs.map((x: number, i: number) => `${x},${Y(lo[i]).toFixed(1)}`).reverse();
        band.setAttribute('d', `M${up.join('L')}L${dn.join('L')}Z`); { let d = '', pen = false; for (let i = 0; i < TL.xs.length - 1; i++) { const th = (j: number) => Math.abs(TL.v[k][j] ?? 0) > 1e-6, on2 = th(i) || th(i + 1); if (on2) { if (!pen) d += `M${up[i]}`; d += `L${up[i + 1]}`; } pen = on2; } top.setAttribute('d', d || 'M0,0'); } } }
    // heat map: per-race counts summed over the visible races (same scales: S/F own, aid stations shared)
    if (heatSrc && tlsvg) { const sum = (st: string) => { const by = heatSrc[st] as Record<string, number[]>; const n = Math.max(...Object.values(by).map((a) => a.length)); return Array.from({ length: n }, (_, i) => on.reduce((s, k) => s + (by[k]?.[i] ?? 0), 0)); };
      const sums: Record<string, number[]> = Object.fromEntries(Object.keys(heatSrc).map((st) => [st, sum(st)])), G = Math.max(1, ...Object.entries(sums).filter(([st]) => st !== 'S/F').flatMap(([, a]) => a));
      tlsvg.querySelectorAll<SVGGElement>('g.tlst').forEach((g) => { const st = g.dataset.station!, a = sums[st]; if (!a) return; const m = Math.max(1, ...a); void G;
        g.querySelectorAll<SVGRectElement>('rect.hc').forEach((rc) => { const v = a[+rc.dataset.i!] || 0; rc.style.display = v ? '' : 'none'; rc.setAttribute('fill-opacity', (0.06 + 0.9 * Math.sqrt(Math.min(1, v / m))).toFixed(2)); }); }); }
    void NSf; void HDt;
  };
  document.querySelectorAll<HTMLInputElement>('input[data-race]').forEach((cb) => cb.addEventListener('change', () => apply()));
  document.querySelector<HTMLInputElement>('input[data-race-all]')?.addEventListener('change', () => { document.querySelectorAll<HTMLInputElement>('input[data-race]').forEach((i) => (i.checked = false)); apply(); });
  // elevation legend: click a race to toggle it (same as its checkbox)
  document.querySelector('svg.profile')?.addEventListener('click', (e) => { const g = (e.target as Element).closest<SVGGElement>('g.plegend'); if (!g) return; const cb = document.querySelector<HTMLInputElement>(`input[data-race="${g.dataset.legend}"]`); if (cb) { cb.checked = !cb.checked; apply(); } });
  // print always shows every race (the filter is a screen view only)
  addEventListener('beforeprint', () => apply([...document.querySelectorAll<HTMLInputElement>('input[data-race]')].map((i) => i.dataset.race!))); addEventListener('afterprint', () => apply());
}

// ---- lightboxes: race card -> full (print-view) race page; aid station -> station details ----
{
  const rbox = document.getElementById('racebox') as HTMLDialogElement | null, sbox = document.getElementById('stationbox') as HTMLDialogElement | null;
  let moved: { el: HTMLElement; parent: Node; next: Node | null } | null = null;
  const restore = () => { if (moved) { moved.parent.insertBefore(moved.el, moved.next); moved = null; } };
  const openRace = (k: string) => { if (!rbox) return; const pg = document.getElementById(`course-${k}`); if (!pg) return; restore();
    moved = { el: pg, parent: pg.parentNode!, next: pg.nextSibling }; rbox.querySelector('.lb-body')!.appendChild(pg); if (!rbox.open) { embedModal(rbox, true); rbox.showModal(); } rbox.scrollTop = 0; };
  rbox?.addEventListener('close', () => { embedModal(rbox, false); restore(); if (/^#course-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); });
  document.querySelectorAll<HTMLButtonElement>('.rc-open').forEach((b) => b.addEventListener('click', () => { openRace(b.dataset.course!); history.replaceState(null, '', `#course-${b.dataset.course}`); }));
  // print from inside a lightbox: put the page back first so print order is unchanged
  addEventListener('beforeprint', () => { if (rbox?.open) { const k = moved?.el.dataset.course; restore(); rbox.close(); /* put the race page back synchronously (the dialog close event is async) */ if (k && document.body.classList.contains('printone')) document.querySelectorAll('.coursepage').forEach((p) => p.classList.toggle('on', (p as HTMLElement).dataset.course === k)); } if (sbox?.open) sbox.close(); });
  const openStation = (k: string) => { if (!sbox) return; const t = document.getElementById(`st-${k === 'S/F' ? 'SF' : k}`) as HTMLTemplateElement | null; if (!t) return;
    const body = sbox.querySelector('.lb-body')!; body.innerHTML = ''; body.appendChild(t.content.cloneNode(true));
    // zoomed map: a copy of the main map framed on this station (zoom transform reset)
    const main = document.querySelector<SVGSVGElement>('svg.mainmap'), host = body.querySelector<HTMLElement>('.st-map'), mk = main?.querySelector<SVGGElement>(`g.stpick[data-station="${CSS.escape(k)}"] g.marker`);
    if (main && host && mk) { const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(mk.getAttribute('transform') || ''); if (m) { const x = +m[1], y = +m[2], R = main.viewBox.baseVal.width / 4.5;
      const cl = main.cloneNode(true) as SVGSVGElement; cl.removeAttribute('id'); cl.classList.remove('mainmap'); cl.classList.add('stzoom'); cl.querySelectorAll('g.hov,.daynight,g.layer[data-layer="dots"] circle').forEach((e) => e.remove()); cl.querySelectorAll<SVGGElement>('g.zv').forEach((g) => g.removeAttribute('transform'));
      cl.setAttribute('viewBox', `${x - R} ${y - R * 0.7} ${2 * R} ${1.4 * R}`); cl.removeAttribute('width'); cl.removeAttribute('height'); cl.style.cssText = 'width:100%;height:auto;aspect-ratio:2/1.4'; host.appendChild(cl); } }
    if (!sbox.open) { embedModal(sbox, true); sbox.showModal(); } };
  sbox?.addEventListener('close', () => { embedModal(sbox, false); if (/^#station-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); });
  // clicks: station markers on the main map (instead of jumping to Google Maps; the lightbox links there), heat-map icons, race-table names
  document.addEventListener('click', (e) => { const t = e.target as Element; if (!(t instanceof Element)) return;
    const a = t.closest<Element>('g.stpick, a.stlink'); if (!a || a.closest('.lightbox.stbox')) return; const k = (a as HTMLElement).dataset?.station ?? a.getAttribute('data-station'); if (!k) return;
    if (document.querySelector('svg.mainmap.panning')) return; e.preventDefault(); openStation(k); history.replaceState(null, '', `#station-${encodeURIComponent(k)}`); });
  for (const box of [rbox, sbox]) if (box) { box.querySelector('.lb-close')!.addEventListener('click', () => box.close()); box.addEventListener('click', (e) => { if (e.target === box) box.close(); }); }
  const fromHash = () => { const h = decodeURIComponent(location.hash); let m; if ((m = /^#course-(.+)$/.exec(h))) openRace(m[1]); else if ((m = /^#station-(.+)$/.exec(h))) openStation(m[1]); };
  addEventListener('hashchange', fromHash); fromHash();
}


// fixed navbar: reserve its height at the top of the page
{ const nav = document.querySelector<HTMLElement>('.topnav'); if (nav && !document.documentElement.classList.contains('embed')) { const set = () => document.documentElement.style.setProperty('--navh', nav.offsetHeight + 'px'); new ResizeObserver(set).observe(nav); set(); } }
