// Standard label templates. Content (/content/station_labels.geojson, poi_labels.geojson) holds position,
// alignment and text; styling + line layout live here so every station / POI label looks the same.
import { esc, f1, leaderLine } from './util';
import type { Ctx, Feature } from './types';

export type Align = 'left' | 'right' | 'center';
type Line = { text: string; size: number; serif: boolean; color: string; weight: number; italic: boolean; halo: number; cls?: string };

// Aid-station template (modeled on Contrabando): serif name, then sans info lines (location, hours) centred below.
export const STATION_TPL = { name: { size: 34, color: '#2a2a2a', halo: 7 }, info: { size: 22, color: '#555555', halo: 6 }, nameLead: 1.15, gap: 6, infoLead: 1.2 };
// POI template: serif semibold-italic title, serif italic notes.
export const POI_TPL = { title: { size: 21, color: '#6b665e', halo: 7 }, note: { size: 18, color: '#8a8580', halo: 7 }, titleLead: 1.15, gap: 4, noteLead: 1.25 };

const wEst = (l: Line) => l.text.length * l.size * (l.serif ? (l.italic ? 0.5 : 0.56) : 0.56);
/** lays out lines top-down from the block centre (x, y); returns svg + bbox */
function block(x: number, y: number, align: Align, lines: Line[], leads: number[]) {
  let h = 0; const ys: number[] = [];
  lines.forEach((l, i) => { if (i) h += leads[i]; ys.push(h); });
  const top = y - h / 2, anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const W = Math.max(...lines.map(wEst)), x0 = align === 'left' ? x : align === 'right' ? x - W : x - W / 2;
  const svg = lines.map((l, i) => `<text x="${f1(x)}" y="${f1(top + ys[i])}" class="f-${l.serif ? 'serif' : 'sans'}${l.cls ? ' ' + l.cls : ''}" font-size="${l.size}" fill="${l.color}" font-style="${l.italic ? 'italic' : 'normal'}" font-weight="${l.weight}" text-anchor="${anchor}" dominant-baseline="central" stroke="#ffffff" stroke-width="${l.halo}" paint-order="stroke" stroke-linejoin="round">${esc(l.text)}</text>`).join('');
  const b = { x0, x1: x0 + W, y0: top - lines[0].size / 2, y1: top + h + lines[lines.length - 1].size / 2 };
  const boxes = lines.map((l, i) => { const w = wEst(l), lx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2, cy = top + ys[i]; return { x0: lx, x1: lx + w, y0: cy - l.size * 0.42, y1: cy + l.size * 0.42 }; });
  const w0 = wEst(lines[0]), t0 = align === 'left' ? x : align === 'right' ? x - w0 : x - w0 / 2;
  const tb = { x0: t0, x1: t0 + w0, y0: top - lines[0].size / 2, y1: top + lines[0].size / 2 }; // first line only
  return { svg, b, tb, boxes };
}
type Box = { x0: number; x1: number; y0: number; y1: number };
/** leader from the label text (just below/above it when the marker is below/above, else nearest line edge) to the marker */
function leader(boxes: Box[], tx: number, ty: number, r: number) {
  const first = boxes[0], last = boxes[boxes.length - 1];
  let best: [number, number, number] | null = null;
  if (ty > last.y1) { const px = Math.max(last.x0, Math.min(tx, last.x1)); best = [px, last.y1, 0]; }
  else if (ty < first.y0) { const px = Math.max(first.x0, Math.min(tx, first.x1)); best = [px, first.y0, 0]; }
  else for (const b of boxes) { const px = Math.max(b.x0, Math.min(tx, b.x1)), py = Math.max(b.y0, Math.min(ty, b.y1)), d = Math.hypot(tx - px, ty - py); if (!best || d < best[2]) best = [px, py, d]; }
  return best ? leaderLine(best[0], best[1], tx, ty, 0, r) : '';
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
  const { svg, boxes } = block(x, y, (q.align ?? 'center') as Align, lines, leads);
  const [sx, sy] = p(s.lonlat);
  return `<g class="stlabel" data-station="${esc(q.station)}" data-ax="${f1(sx)}" data-ay="${f1(sy)}">${leader(boxes, sx, sy, radius(q.station))}${svg}</g>`;
}

export function poiLabel(f: Feature, p: (ll: [number, number]) => [number, number], targetR = 6) {
  const T = POI_TPL, q = f.properties, [x, y] = p(f.geometry.coordinates);
  const notes: { text: string; distance?: boolean }[] = q.notes ?? [];
  const lines: Line[] = [
    { text: q.title, size: T.title.size, serif: true, color: T.title.color, weight: 600, italic: true, halo: T.title.halo },
    ...notes.map((n) => ({ text: n.text, size: T.note.size, serif: true, color: T.note.color, weight: 400, italic: true, halo: T.note.halo, cls: n.distance ? 'dist' : '' })),
  ];
  const leads = lines.map((l, i) => (i === 0 ? 0 : i === 1 ? T.title.size / 2 + T.gap + T.note.size / 2 : T.note.size * T.noteLead));
  const { svg, boxes } = block(x, y, (q.align ?? 'center') as Align, lines, leads);
  // POI leaders always run from the title to the POI dot
  const lead = q.target ? (() => { const [tx, ty] = p(q.target); const b = boxes[0], my = (b.y0 + b.y1) / 2; const sx = tx < b.x0 ? b.x0 : tx > b.x1 ? b.x1 : Math.max(b.x0, Math.min(tx, b.x1)); const sy = tx < b.x0 || tx > b.x1 ? my : ty < b.y0 ? b.y0 : b.y1; return leaderLine(sx, sy, tx, ty, 0, targetR); })() : '';
  const [ax, ay] = q.target ? p(q.target) : [x, y];
  return `<g class="poilabel" data-poi="${esc(q.poi)}" data-ax="${f1(ax)}" data-ay="${f1(ay)}">${lead}${svg}</g>`;
}

/** area labels (Private, Big Bend Ranch State Park): one very subtle template; placements in content/area_labels.geojson */
export const AREA_TPL = { size: 19, color: '#8a8a8a', opacity: 0.45, lead: 1.2, halo: 5 };
export function areaLabel(f: Feature, p: (ll: [number, number]) => [number, number]) {
  const T = AREA_TPL, [x, y] = p(f.geometry.coordinates), lines = String(f.properties.text).split('\n'), y0 = y - ((lines.length - 1) * T.size * T.lead) / 2;
  const ts = lines.map((l, i) => `<tspan x="${f1(x)}" y="${f1(y0 + i * T.size * T.lead)}">${esc(l)}</tspan>`).join('');
  return `<text class="arealabel f-serif" font-size="${T.size}" fill="${T.color}" opacity="${T.opacity}" font-style="italic" font-weight="400" text-anchor="middle" dominant-baseline="central" stroke="#ffffff" stroke-width="${T.halo}" paint-order="stroke" stroke-linejoin="round">${ts}</text>`;
}
