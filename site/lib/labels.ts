// Standard label templates. Content (/content/station_labels.geojson, poi_labels.geojson) holds position,
// alignment and text; styling + line layout live here so every station / POI label looks the same.
import { esc, f1 } from './util';
import type { Ctx, Feature } from './types';

export type Align = 'left' | 'right' | 'center';
type Line = { text: string; size: number; serif: boolean; color: string; weight: number; italic: boolean; halo: number; cls?: string };

// Aid-station template (modeled on Contrabando): serif name, then sans info lines (location, hours) centred below.
export const STATION_TPL = { name: { size: 34, color: '#2a2a2a', halo: 7 }, info: { size: 22, color: '#555555', halo: 6 }, nameLead: 1.15, gap: 6, infoLead: 1.2, leader: { color: '#555555', width: 1.3, minGap: 14, pad: 5 } };
// POI template: serif semibold-italic title, serif italic notes.
export const POI_TPL = { title: { size: 21, color: '#6b665e', halo: 7 }, note: { size: 18, color: '#8a8580', halo: 7 }, titleLead: 1.15, gap: 4, noteLead: 1.25, leader: { color: '#555555', width: 1.3, minGap: 10, pad: 4 } };

const wEst = (l: Line) => l.text.length * l.size * (l.serif ? 0.6 : 0.58);
/** lays out lines top-down from the block centre (x, y); returns svg + bbox */
function block(x: number, y: number, align: Align, lines: Line[], leads: number[]) {
  let h = 0; const ys: number[] = [];
  lines.forEach((l, i) => { if (i) h += leads[i]; ys.push(h); });
  const top = y - h / 2, anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const W = Math.max(...lines.map(wEst)), x0 = align === 'left' ? x : align === 'right' ? x - W : x - W / 2;
  const svg = lines.map((l, i) => `<text x="${f1(x)}" y="${f1(top + ys[i])}" class="f-${l.serif ? 'serif' : 'sans'}${l.cls ? ' ' + l.cls : ''}" font-size="${l.size}" fill="${l.color}" font-style="${l.italic ? 'italic' : 'normal'}" font-weight="${l.weight}" text-anchor="${anchor}" dominant-baseline="central" stroke="#ffffff" stroke-width="${l.halo}" paint-order="stroke" stroke-linejoin="round">${esc(l.text)}</text>`).join('');
  const b = { x0, x1: x0 + W, y0: top - lines[0].size / 2, y1: top + h + lines[lines.length - 1].size / 2 };
  return { svg, b };
}
/** straight leader from the block edge to a target circle of radius r (skipped when the label is already close) */
function leader(b: { x0: number; x1: number; y0: number; y1: number }, tx: number, ty: number, r: number, L: { color: string; width: number; minGap: number; pad: number }) {
  const px = Math.max(b.x0, Math.min(tx, b.x1)), py = Math.max(b.y0, Math.min(ty, b.y1));
  const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
  if (d - r < L.minGap) return '';
  const ux = dx / d, uy = dy / d;
  return `<path d="M${f1(px + ux * L.pad)},${f1(py + uy * L.pad)}L${f1(tx - ux * (r + L.pad))},${f1(ty - uy * (r + L.pad))}" fill="none" stroke="${L.color}" stroke-width="${L.width}"/>`;
}

export function stationLabel(c: Ctx, f: Feature, p: (ll: [number, number]) => [number, number], radius: (k: string) => number) {
  const T = STATION_TPL, q = f.properties, s = c.stations.stations[q.station];
  const [x, y] = p(f.geometry.coordinates);
  const nameLines = String(q.name ?? s.name).split('\n');
  const info = [...(q.location ? [q.location] : []), ...(s.hours ? [s.hours] : [])];
  const lines: Line[] = [
    ...nameLines.map((t) => ({ text: t, size: T.name.size, serif: true, color: T.name.color, weight: 400, italic: false, halo: T.name.halo })),
    ...info.map((t) => ({ text: t, size: T.info.size, serif: false, color: T.info.color, weight: 400, italic: false, halo: T.info.halo })),
  ];
  const leads = lines.map((l, i) => (i === 0 ? 0 : i < nameLines.length ? T.name.size * T.nameLead : i === nameLines.length ? T.name.size / 2 + T.gap + T.info.size / 2 : T.info.size * T.infoLead));
  const { svg, b } = block(x, y, (q.align ?? 'center') as Align, lines, leads);
  const [sx, sy] = p(s.lonlat);
  return `<g class="stlabel" data-station="${esc(q.station)}">${leader(b, sx, sy, radius(q.station), T.leader)}${svg}</g>`;
}

export function poiLabel(f: Feature, p: (ll: [number, number]) => [number, number], targetR = 6) {
  const T = POI_TPL, q = f.properties, [x, y] = p(f.geometry.coordinates);
  const notes: { text: string; distance?: boolean }[] = q.notes ?? [];
  const lines: Line[] = [
    { text: q.title, size: T.title.size, serif: true, color: T.title.color, weight: 600, italic: true, halo: T.title.halo },
    ...notes.map((n) => ({ text: n.text, size: T.note.size, serif: true, color: T.note.color, weight: 400, italic: true, halo: T.note.halo, cls: n.distance ? 'dist' : '' })),
  ];
  const leads = lines.map((l, i) => (i === 0 ? 0 : i === 1 ? T.title.size / 2 + T.gap + T.note.size / 2 : T.note.size * T.noteLead));
  const { svg, b } = block(x, y, (q.align ?? 'center') as Align, lines, leads);
  const lead = q.target ? (() => { const [tx, ty] = p(q.target); return leader(b, tx, ty, targetR, T.leader); })() : '';
  return `<g class="poilabel" data-poi="${esc(q.poi)}">${lead}${svg}</g>`;
}
