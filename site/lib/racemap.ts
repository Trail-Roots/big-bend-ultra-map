import { northG, northBox, NORTH_INSET } from './north';
import { cardView, CARD_ASPECT } from './cardview';
import { turnaround } from './panels';
// Race-page map: ONLY one race's route, main-map styling (hillshade, paved roads, race-coloured route, arrows, aid stations with
// full-name subtitles), full bib with START band. No zoom / pan, no zoom boxes. Labels are auto-placed against every drawn element;
// the build fails if a label cannot be placed clear of the route, roads, markers, arrows, bib and the other labels.
import { hillImage, chevron, LOGO_PT } from './mainmap';
import { bib, BIB } from './panels';
import { accessPatterns, offRoads } from './mainmap';
import { BAND_TINT, tint, offsetLine, viewProjection, SHEET, f1, esc, station, leaderLine } from './util';
import { STATION_TPL } from './labels';

/** sheet-unit scale vs the mini-map view, so symbols and text use the main map's sizes at race-page print size */
export const RACE_F = 4;
type Bx = { x0: number; x1: number; y0: number; y1: number };
const wEst = (t: string, size: number) => t.length * size * 0.56;

export function renderRaceMap(c, k: string, card?: boolean) {
  // card thumbnails: the race view re-fit to the card's exact aspect (site/lib/cardview.ts), same symbol scale, one generated relief image over the whole frame
  const view0 = c.layout.views[k], view = card ? { ...view0, ...cardView(view0) } : view0, H = view0.fig[3] * SHEET.h * RACE_F, W = card ? H * CARD_ASPECT : view0.fig[2] * SHEET.w * RACE_F, V = viewProjection(view, W, H), col = c.colors, cc = c.courses.colors[k];
  let s = `<g class="topo">${card ? `<image href="hillshade/card-${k}.png" x="0" y="0" width="${f1(W)}" height="${f1(H)}" preserveAspectRatio="none"/>` : hillImage(c, k, V)}</g>`;
  const pts: [number, number][] = []; // every drawn line, sampled, for label collision tests
  const sample = (L: [number, number][][]) => { for (const l of L) for (let i = 1; i < l.length; i++) { const [a, b] = [l[i - 1], l[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3)); for (let j = 0; j <= n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); } };
  let base = ''; for (const f of c.network.features.filter((f) => f.properties.cls === 'paved')) { const d = V.path(f); sample(V.lines(f)); base += `<path d="${d}" class="ln" stroke="#fff" stroke-width="14"/><path d="${d}" class="ln" stroke="#333" stroke-width="10"/><path d="${d}" class="ln" stroke="#fff" stroke-width="2.2" stroke-dasharray="13.2 11"/>`; }
  for (const f of c.network.features.filter((f) => f.properties.cls === 'connector')) { const d = V.path(f); sample(V.lines(f)); base += `<path d="${d}" class="ln" stroke="${col.cream}" stroke-width="12" stroke-linecap="butt"/><path d="${d}" class="ln" stroke="#000" stroke-width="7"/>`; }
  // next longer race's route underneath at low opacity (as on the old mini maps); the 100K has none
  const O: string[] = c.courses.order, nk = O[O.indexOf(k) - 1];
  if (nk) { const nf = c.courseGeo[nk].features[0], o = card ? 15 : 7, sw = card ? 6 : 2.5; sample(V.lines(nf));
    // next longer race: thin dashed line in its full colour, offset beside the road (never on the trail-type pattern); the current race band covers it where they share the road
    s += `<path d="${V.lines(nf).filter((l) => l.length > 1).map((l) => 'M' + offsetLine(l, o).map((q) => `${f1(q[0])},${f1(q[1])}`).join('L')).join('')}" class="ln under" data-course="${nk}" fill="none" stroke="${c.courses.colors[nk]}" stroke-width="${sw}" stroke-dasharray="${f1(sw * 2.4)} ${f1(sw * 2)}" stroke-opacity=".8"/>`; }
  const rf = c.courseGeo[k].features[0], d = V.path(rf); sample(V.lines(rf));
  // race route = solid light tint band of the race colour BENEATH the full trail-type layer (every road / trail drawn exactly as without the band)
  s += `<path d="${d}" class="ln" stroke="${tint(cc, BAND_TINT)}" stroke-width="${card ? 42 : 18}" stroke-linejoin="round"/>` + base + offRoads(c.network.features, V) + accessPatterns(c.network.features.filter((f) => f.properties.on_course), V, col);
  for (const f of c.network.features) sample(V.lines(f)); // every drawn road / trail counts for label collisions
  // arrows: this race's arrows, at the main map's arrow size
  const arrows = c.arrows.features.filter((f) => f.properties.map === k).map((f) => ({ ...f, properties: { ...f.properties, size_pt: 12.4 } }));
  const ob: Bx[] = [];
  for (const f of arrows) { s += chevron(f, V, col); const [x, y] = V.p(f.geometry.coordinates[1]); ob.push({ x0: x - 16, x1: x + 16, y0: y - 16, y1: y + 16 }); }
  // 10K turnaround: a U-turn note at the far end
  if (k === '10K') { const f = c.pois.features.find((f) => f.properties.kind === 'turnaround'), [x, y] = V.p(f.geometry.coordinates[0]); ob.push({ x0: x - 12, x1: x + 12, y0: y - 12, y1: y + 12 }); s += turnaround(c, V, false); ob.push({ x0: x - 40, x1: x + 40, y0: y - 40, y1: y + 40 }); // black U-turn arrow (restored)
    s += `<g class="turnlab" data-at="${f1(x)},${f1(y)}"></g>`; }
  // aid stations on this race (each once)
  const sts = [...new Set<string>(c.cutoffs[k].map((q) => q.station))];
  const R = (st: string) => (st === 'S/F' ? Math.sqrt(2900 * 1.8) / 2 : c.stations.stations[st].spectator ? Math.sqrt(2000 * 1.8) / 2 : Math.sqrt(2000) / 2);
  for (const st of sts) { const S = c.stations.stations[st], [x, y] = V.p(S.lonlat), r = R(st); const rb = r * 1.45; ob.push({ x0: x - rb, x1: x + rb, y0: y - rb, y1: y + rb }); // includes the aid badge
    s += station(x, y, st, S.spectator, st === 'S/F' ? { s: 2900, fs: 34, colors: col } : { colors: col }); } /* circle opens the aid-station lightbox (app.ts) */
  // full bib (START band), top-right, scaled up to race-page size
  const BS = card ? (0.2 * W) / BIB.w /* card: bib ~20% of the frame width, readable at card size */ : 2.2, bx = W - 18 - BIB.w * BS, by = 18; ob.push({ x0: bx - 4, x1: W, y0: 0, y1: by + BIB.h * BS + 4 });
  const bibSvg = `<g transform="translate(${f1(bx)} ${f1(by)}) scale(${BS})">${bib(k, c.courses.courses[k].start, cc, BIB.w, BIB.h, col, 'band', [0, 0])}</g>`;
  // BBU logo (white halo, drawn last = on top): race pages only (not cards); fixed TOP-LEFT, same position / size proportion as on the
  // main map (x 8.0 %, y 2.14 %, width 9.15 % of the frame width). Placed before the north arrow and labels so those move around it;
  // build fails if a station marker, arrow or the bib would sit under it.
  let logoSvg = ''; if (!card) { const lw = W * 0.0915, lh = lw * 776 / 730, at: [number, number] = [W * 0.08, W * 0.0214];
    if (ob.some((o) => at[0] < o.x1 + 6 && o.x0 < at[0] + lw + 6 && at[1] < o.y1 + 6 && o.y0 < at[1] + lh + 6)) throw new Error(`[racemap ${k}] logo overlaps a marker / arrow / bib`);
    ob.push({ x0: at[0], x1: at[0] + lw, y0: at[1], y1: at[1] + lh });
    logoSvg = `<a href="https://trailroots.com/big-bend-ultra" target="_blank" rel="noopener"><image class="racelogo" filter="url(#logohalo${k})" href="logo_ink_crop.png" x="${f1(at[0])}" y="${f1(at[1])}" width="${f1(lw)}" height="${f1(lh)}" preserveAspectRatio="xMidYMid meet"/></a>`; }
  // north arrow (SSOT site/lib/north.ts): first clear corner (top-left, bottom-left, bottom-right) by the shared size rule
  let northSvg = ''; { const ins = W * NORTH_INSET, nb0 = northBox(W, 0, 0);
    for (const [nx, ny] of [[ins, ins], [ins, H - ins - nb0.h], [W - ins - nb0.w, H - ins - nb0.h]]) { const nb = northBox(W, nx, ny);
      if (pts.some(([px, py]) => px > nb.x0 - 4 && px < nb.x1 + 4 && py > nb.y0 - 4 && py < nb.y1 + 4) || ob.some((o) => nb.x0 < o.x1 && o.x0 < nb.x1 && nb.y0 < o.y1 && o.y0 < nb.y1)) continue;
      ob.push({ x0: nb.x0, x1: nb.x1, y0: nb.y0, y1: nb.y1 }); northSvg = northG(W, nx, ny); break; }
    if (!northSvg) throw new Error(`[racemap ${k}] no clear corner for the north arrow`); }
  // ---- labels: name (serif) + full-name subtitle (sans, wraps after " / "), placed at the nearest clear spot ----
  const T = STATION_TPL, placed: Bx[] = [];
  const free = (b: Bx) => b.x0 > 4 && b.x1 < W - 4 && b.y0 > 4 && b.y1 < H - 4 && !ob.some((o) => b.x0 < o.x1 + 3 && o.x0 < b.x1 + 3 && b.y0 < o.y1 + 3 && o.y0 < b.y1 + 3)
    && !placed.some((o) => b.x0 < o.x1 + 6 && o.x0 < b.x1 + 6 && b.y0 < o.y1 + 6 && o.y0 < b.y1 + 6) && !pts.some(([px, py]) => px > b.x0 - 6 && px < b.x1 + 6 && py > b.y0 - 6 && py < b.y1 + 6);
  let labels = '';
  const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  for (const st of sts) {
    const S = c.stations.stations[st], [x, y] = V.p(S.lonlat), r = R(st);
    // same text as the main-map label (content/station_labels.geojson + stations.json): name, full-name subtitle, then the hours line
    // filtered to this race: station opening (or this race's start at S/F) to this race's cutoff time(s) there
    const q = (c.stationLabels.features.find((f) => f.properties.station === st) || { properties: {} }).properties as any;
    const name = String(q.name ?? S.name).split('\n'), loc = q.location ?? (S.long && S.long !== S.name ? S.long : '');
    const shc = (t: string) => t.replace(/:00 ?([AP])M$/, (_, a) => a.toLowerCase()).replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
    const cts = [...new Set(c.cutoffs[k].filter((x) => x.station === st && x.mile > 0 && x.cutoff && x.cutoff !== 'TBD').map((x) => shc(x.cutoff)))];
    const open = st === 'S/F' ? shc(c.courses.courses[k].start) : String(S.hours ?? '').split(' - ')[0];
    const hrs = cts.length ? `${open} - ${cts.join(' / ')}` : '';
    const sub = loc ? (loc.length > 22 && loc.includes(' / ') ? [loc.slice(0, loc.indexOf(' / ') + 2), loc.slice(loc.indexOf(' / ') + 3)] : [loc]) : [];
    const lines = [...name.map((t) => ({ t, sz: T.name.size, serif: true })), ...[...sub, ...(hrs ? [hrs] : [])].map((t) => ({ t, sz: T.info.size, serif: false }))];
    const bw = Math.max(...lines.map((l) => wEst(l.t, l.sz))), bh = lines.reduce((a, l, i) => a + (i ? l.sz * 1.18 : l.sz), 0);
    let best: { b: Bx; al: 'start' | 'end' | 'middle'; ax: number } | null = null;
    outer: for (let dist = r + 8; dist <= r + 260; dist += 6) for (const [dx, dy] of dirs) {
      const cx = x + dx * dist, cy = y + dy * dist, al = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
      const x0 = al === 'start' ? cx : al === 'end' ? cx - bw : cx - bw / 2, y0 = dy < 0 ? cy - bh : dy > 0 ? cy : cy - bh / 2;
      const b = { x0, x1: x0 + bw, y0, y1: y0 + bh };
      if (free(b)) { best = { b, al, ax: al === 'start' ? x0 : al === 'end' ? x0 + bw : x0 + bw / 2 }; break outer; }
    }
    if (!best) throw new Error(`[racemap ${k}] no clear label spot for station ${st}`);
    placed.push(best.b);
    let ty = best.b.y0; const tx = best.ax;
    const txt = lines.map((l, i) => { ty += i ? l.sz * 1.18 : l.sz * 0.82; return `<text x="${f1(tx)}" y="${f1(ty)}" class="f-${l.serif ? 'serif' : 'sans'}" font-size="${l.sz}" fill="${l.serif ? T.name.color : T.info.color}" text-anchor="${best!.al}" stroke="#fff" stroke-width="${l.serif ? T.name.halo : T.info.halo}" paint-order="stroke" stroke-linejoin="round">${esc(l.t)}</text>`; }).join('');
    // leader only when the label sits away from the marker
    const nx = Math.max(best.b.x0, Math.min(x, best.b.x1)), ny = Math.max(best.b.y0, Math.min(y, best.b.y1)), far = Math.hypot(nx - x, ny - y) > r + 30;
    labels += `<g class="stlabel" data-station="${esc(st)}">${far ? leaderLine(nx, ny, x, y, 2, r) : ''}${txt}</g>`;
  }
  // 10K turnaround label
  if (k === '10K') { const m = s.match(/data-at="([\d.]+),([\d.]+)"/)!, x = +m[1], y = +m[2], t = '10K turnaround', bw = wEst(t, 22) * 1.05, bh = 24;
    let done = false; for (let dist = 16; dist < 200 && !done; dist += 6) for (const [dx, dy] of dirs) { const al = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', cx = x + dx * dist, cy = y + dy * dist, x0 = al === 'start' ? cx : al === 'end' ? cx - bw : cx - bw / 2, y0 = dy < 0 ? cy - bh : dy > 0 ? cy : cy - bh / 2, b = { x0, x1: x0 + bw, y0, y1: y0 + bh };
      if (free(b)) { placed.push(b); labels += `<text x="${f1(al === 'start' ? x0 : al === 'end' ? x0 + bw : x0 + bw / 2)}" y="${f1(y0 + bh * 0.78)}" class="f-serif" font-size="22" font-style="italic" font-weight="700" fill="${cc}" text-anchor="${al}" stroke="#fff" stroke-width="6" paint-order="stroke">${t}</text>`; done = true; break; } }
    if (!done) throw new Error('[racemap 10K] no clear spot for the turnaround label'); }
  console.log(`  racemap ${k}: ${placed.length} labels placed clear of ${pts.length} line samples, ${ob.length} symbols`);
  return `<svg class="racemap" data-race="${k}" data-f="${RACE_F}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} course map"><defs><filter id="logohalo${k}" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="4" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="rc${k}"><rect width="${f1(W)}" height="${f1(H)}"/></clipPath></defs><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/><g clip-path="url(#rc${k})">${s}${labels}</g>${bibSvg}${northSvg}${card ? '' : `<rect width="${f1(W)}" height="${f1(H)}" fill="none" stroke="#d4d4d4" stroke-width="2"/>`}${logoSvg}</svg>`;
}
