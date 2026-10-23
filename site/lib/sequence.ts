// Trail-by-trail route sequence per race: every GPX point is named by the nearest named OSM way within 30 m
// (sources/curated/route_trails.geojson, seeded by tools/route-trails.ts); stretches with no OSM match fall back to the map's own
// network names (milestones.ts raceSegments); anything still unmatched stays unnamed (shown as "Unnamed segment", never guessed).
import fs from 'node:fs'; import path from 'node:path';
import { raceSegments } from './milestones';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
const DISPLAY: Record<string, string> = { 'Plia Montoya Road': 'Pila Montoya Rd', 'Pila Montoya': 'Pila Montoya Rd', 'Solitario Road West': 'Solitario Rd', 'Solitario Rd': 'Solitario Rd', Lone: 'Lone Star' };
export const trailName = (n: string) => DISPLAY[n] ?? n.replace(/ Road$/, ' Rd');
type W = { name: string; d: number[][] };
let WAYS: W[] | null = null;
export function ways(): W[] {
  if (WAYS) return WAYS;
  const g = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../../sources/curated/route_trails.geojson'), 'utf8'));
  return (WAYS = g.features.map((f: any) => { const c = f.geometry.coordinates, d: number[][] = [];
    for (let i = 1; i < c.length; i++) { const n = Math.max(1, Math.ceil(M(c[i - 1], c[i]) / 8)); for (let t = 0; t < n; t++) d.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t / n, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t / n]); }
    d.push(c[c.length - 1]); return { name: trailName(f.properties.name), d }; }));
}
export type TSeg = { a: number; b: number; name: string | null; src: 'osm' | 'map' | 'none'; i0: number; i1: number };
const CACHE: Record<string, TSeg[]> = {};
export function trailSequence(c: Ctx, k: string): TSeg[] {
  if (CACHE[k]) return CACHE[k];
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], mi = f.properties.mi as number[], W = ways(), ms = raceSegments(c, k);
  let raw: TSeg[] = [];
  for (let i = 0; i < co.length; i++) { let bn: string | null = null, bd = 30; for (const w of W) for (const p of w.d) { const d = M(co[i], p); if (d < bd) { bd = d; bn = w.name; } }
    const l = raw[raw.length - 1]; if (l && l.name === bn) { l.b = mi[i]; l.i1 = i; } else { if (l) { l.b = mi[i]; } raw.push({ a: mi[i], b: mi[i], name: bn, src: bn ? 'osm' : 'none', i0: i, i1: i }); } }
  raw[raw.length - 1].b = mi[mi.length - 1];
  // unmatched stretches: map network name covering most of the stretch
  for (const s of raw) if (!s.name && s.b - s.a >= 0.25) { const ov = new Map<string, number>(); for (const m of ms) if (m.name) { const o = Math.min(s.b, m.b) - Math.max(s.a, m.a); if (o > 0) ov.set(m.name, (ov.get(m.name) ?? 0) + o); }
    const best = [...ov].sort((x, y) => y[1] - x[1])[0]; if (best && best[1] > 0.6 * (s.b - s.a)) { s.name = trailName(best[0]); s.src = 'map'; } }
  // GPS-noise blips: unnamed bits < 0.25 mi and any piece < 0.045 mi merge into the previous segment; then join equal neighbours
  const mg = (L: TSeg[], drop: (s: TSeg, i: number) => boolean) => { const o: TSeg[] = []; L.forEach((s, i) => { const p = o[o.length - 1]; if (p && (drop(s, i) || p.name === s.name)) { p.b = s.b; p.i1 = s.i1; } else o.push({ ...s }); }); return o; };
  const N = raw.length; raw = mg(raw, (s, i) => i > 0 && i < N - 1 && ((!s.name && s.b - s.a < 0.25) || s.b - s.a < 0.045));
  raw = mg(raw, () => false);
  // start / finish: S/F area + FM 170 crossing collapse into one named piece at each end
  const ends = (s: TSeg | undefined) => s && (!s.name || s.name === 'FM 170') && s.b - s.a < 0.3;
  while (raw.length > 2 && ends(raw[0]) && ends(raw[1])) { raw[1].a = raw[0].a; raw[1].i0 = 0; raw.shift(); }
  while (raw.length > 2 && ends(raw[raw.length - 1]) && ends(raw[raw.length - 2])) { raw[raw.length - 2].b = raw[raw.length - 1].b; raw.pop(); }
  if (ends(raw[0])) { raw[0].name = 'Start area, cross FM 170'; raw[0].src = 'osm'; }
  if (ends(raw[raw.length - 1])) { raw[raw.length - 1].name = 'Cross FM 170 to finish'; raw[raw.length - 1].src = 'osm'; }
  // short leftover pieces between the end segments and the first trail
  return (CACHE[k] = raw);
}
