// Milestone strip: a horizontal start -> finish line per race with trail / road names as labelled segments (on-course network lines named from
// the map's own curved labels or overlapping named roads, matched to the GPX) and aid stations as numbered markers at their GPX miles.
// Two variants share one layout routine: wide (desktop / print) and compact (phones, staggered rows); the build fails on any label overlap.
import { f1, esc, station } from './util';
import type { Ctx } from './types';

const M = (a: number[], b: number[]) => { const k = Math.cos((29.35 * Math.PI) / 180), dx = (a[0] - b[0]) * 111320 * k, dy = (a[1] - b[1]) * 110540; return Math.hypot(dx, dy); };
const near = (p: number[], line: number[][], lim: number) => { for (let i = 0; i < line.length; i += 1) if (M(p, line[i]) < lim) return true; return false; };
const SHORT: Record<string, string> = { 'Solitario Road': 'Solitario Rd', 'Solitario Road West': 'Solitario Rd', 'Fresno Canyon Road': 'Fresno Canyon Rd', 'Main Park Road': 'Main Park Rd', 'Plia Montoya Road': 'Pila Montoya', LoneStar: 'Lone Star', 'Contrabando connector': 'Contrabando connector' };

let NAMES: (string | null)[] | null = null;
/** name for every on-course network line: the map label lying along it, else an overlapping named road */
function netNames(c: Ctx) {
  if (NAMES) return NAMES;
  const net = c.network.features, labs = c.labels.features.filter((f: any) => f.geometry.type === 'LineString');
  const named = net.filter((f: any) => f.properties.name);
  // map labels sit beside their line (offset for legibility): each curved label names the network line it runs closest to on average
  const dmin = (q: number[], L: number[][]) => { let d = Infinity; for (const r of L) d = Math.min(d, M(q, r)); return d; };
  const fromLabel: (string | null)[] = net.map(() => null);
  for (const l of labs) { const pts = l.geometry.coordinates; let bj = -1, bd = 1000; net.forEach((f: any, j: number) => { const d = pts.reduce((t: number, q: number[]) => t + dmin(q, f.geometry.coordinates), 0) / pts.length; if (d < bd) { bd = d; bj = j; } }); if (bj >= 0 && !fromLabel[bj]) fromLabel[bj] = l.properties.text; }
  NAMES = net.map((f: any, j: number) => {
    if (fromLabel[j]) return fromLabel[j];
    if (f.properties.name) return SHORT[f.properties.name] ?? f.properties.name;
    const L = f.geometry.coordinates;
    for (const n of named) { const pts = n.geometry.coordinates, fr = pts.filter((q: number[]) => near(q, L, 40)).length / pts.length; if (fr > 0.6) return SHORT[n.properties.name] ?? n.properties.name; }
    return null;
  });
  return NAMES;
}
export type Seg = { a: number; b: number; name: string | null };
const CACHE: Record<string, Seg[]> = {};
/** labelled segments along race k (GPX miles) */
export function raceSegments(c: Ctx, k: string): Seg[] {
  if (CACHE[k]) return CACHE[k];
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], mi = f.properties.mi as number[], names = netNames(c), net = c.network.features;
  const raw: Seg[] = [];
  for (let i = 0; i < co.length; i += 3) {
    let bn: string | null = null, bd = 45;
    net.forEach((g: any, j: number) => { const L = g.geometry.coordinates; for (let q = 0; q < L.length; q++) { const d = M(co[i], L[q]); if (d < bd) { bd = d; bn = names[j]; } } });
    const m = mi[i], last = raw[raw.length - 1];
    if (last && last.name === bn) last.b = m; else { if (last) last.b = m; raw.push({ a: m, b: m, name: bn }); }
  }
  raw[raw.length - 1].b = mi[mi.length - 1];
  // absorb blips shorter than 0.35 mi into the neighbour, then merge equal neighbours
  let segs = raw;
  for (let pass = 0; pass < 3; pass++) {
    const out: Seg[] = [];
    for (const s of segs) { const p = out[out.length - 1]; if (p && (s.b - s.a < 0.35 || p.name === s.name)) { p.b = s.b; } else out.push({ ...s }); }
    segs = out;
  }
  return (CACHE[k] = segs);
}

type Box = { x0: number; x1: number; y: number };
/** one race strip; here = current station (lightbox / print page) gets a "You are here" marker */
export function milestoneStrip(c: Ctx, k: string, opt: { compact?: boolean; print?: boolean; here?: string; label?: boolean } = {}) {
  const W = opt.compact ? 420 : opt.print ? 1250 : 900, FS = opt.compact ? 15 : 14, LX = opt.compact ? 18 : 20, RX = W - (opt.compact ? 18 : 20), cw = FS * 0.62; /* generous glyph width so labels never run past the frame */
  const segs = raceSegments(c, k), D = segs[segs.length - 1].b, X = (m: number) => LX + (m / D) * (RX - LX), col = c.colors, cc = c.courses.colors[k];
  const NR = opt.compact ? 4 : 3, rowsUp: Box[][] = [[], [], [], []], rowsDn: Box[][] = [[], [], [], []], placed: { t: string; x: number; row: number; up: boolean }[] = [];
  const fits = (r: Box[], b: Box) => r.every((o) => b.x1 + 6 < o.x0 || b.x0 - 6 > o.x1);
  for (const s of segs) {
    if (!s.name) continue;
    const xm = (X(s.a) + X(s.b)) / 2; let t = s.name, w = t.length * cw;
    let b = { x0: Math.max(4, Math.min(W - 4 - w, xm - w / 2)), x1: 0, y: 0 }; b.x1 = b.x0 + w;
    const tryRows: [Box[], boolean, number][] = []; for (let i = 0; i < NR; i++) tryRows.push([rowsUp[i], true, i], [rowsDn[i], false, i]);
    let ok = tryRows.find(([r]) => fits(r, b));
    if (!ok) { // abbreviate to the segment width, then retry
      const n = Math.max(4, Math.floor((X(s.b) - X(s.a)) / cw)); t = t.slice(0, n - 1) + '…'; w = t.length * cw; b = { x0: Math.max(4, Math.min(W - 4 - w, xm - w / 2)), x1: 0, y: 0 }; b.x1 = b.x0 + w; ok = tryRows.find(([r]) => fits(r, b));
    }
    if (!ok) throw new Error(`[milestones ${k}${opt.compact ? ' compact' : ''}] no room for label "${s.name}"`);
    ok[0].push(b); placed.push({ t, x: (b.x0 + b.x1) / 2, row: ok[2], up: ok[1] });
  }
  const nUp = Math.max(1, rowsUp.filter((q) => q.length).length), nDn = rowsDn.filter((q) => q.length).length, LH = FS + 5;
  const top = 6 + (opt.here ? 20 : 0) + nUp * LH, Y = top + 16, H = Y + 22 + nDn * LH + 8; /* room for the mi 0 / mi N descenders */
  let s = `<rect width="${W}" height="${f1(H)}" fill="#fff"/>`;
  // one plain solid black line start -> finish
  s += `<path d="M${f1(LX)},${Y}H${f1(RX)}" stroke="#111" stroke-width="4" stroke-linecap="butt"/>`;
  for (const p of placed) { const y = p.up ? Y - 14 - p.row * LH : Y + 26 + FS * 0.75 + p.row * LH; s += `<text x="${f1(p.x)}" y="${f1(y)}" font-size="${FS}" text-anchor="middle" fill="${col.ink}">${esc(p.t)}</text>`; }
  // stations at their GPX miles (cutoffs.json, from the GPX); the start / finish ends use the S/F marker
  const r = opt.compact ? 11 : 10, ms = (r * 2) ** 2 / 1.8 * 1.0;
  for (const q of c.cutoffs[k]) {
    const x = X(q.mile), me = opt.here === q.station;
    if (me) s += `<circle cx="${f1(x)}" cy="${Y}" r="${r + 6}" fill="none" stroke="${cc}" stroke-width="3"/><text x="${f1(Math.max(4 + (FS - 1) * 0.62 * 7.5, Math.min(W - 4 - (FS - 1) * 0.62 * 7.5, x)))}" y="${f1(top - nUp * LH - 2)}" font-size="${FS - 1}" font-weight="700" text-anchor="middle" fill="${cc}">You are here</text>`;
    s += (me ? "<g class=\"ms-me\">" : "") + station(x, Y, q.station, false, { s: ms * (q.station === "S/F" ? 1.2 : 1), fs: q.station === "S/F" ? r * 0.95 : r * 1.25, badge: false, colors: col, link: !me }) + (me ? "</g>" : "");
  }
  s += `<text x="${LX}" y="${f1(H - 5)}" font-size="${FS - 3}" fill="${col.mute}">mi 0</text><text x="${RX}" y="${f1(H - 5)}" font-size="${FS - 3}" text-anchor="end" fill="${col.mute}">mi ${D.toFixed(1)}</text>`;
  return `<svg class="msline${opt.compact ? ' msl-c' : opt.print ? ' msl-p' : ' msl-w'}" data-course="${k}" viewBox="0 0 ${W} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} route milestones">${s}</svg>`;
}
/** both variants (CSS shows the wide one on desktop / print, compact on phones) */
export const milestones = (c: Ctx, k: string, here?: string) => `<figure class="msfig${here ? ' msfig-here' : ''}"${here ? ` data-here="${esc(here)}"` : ''}><figcaption><b style="color:${c.courses.colors[k]}">${k}</b> route</figcaption>${milestoneStrip(c, k, { here })}${milestoneStrip(c, k, { here, compact: true })}${milestoneStrip(c, k, { here, print: true })}</figure>`;
