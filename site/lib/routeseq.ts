// PDF-only "trail by trail" pages (one or more portrait pages directly after each race page): a vertical start -> finish line in running
// order with every trail segment (name, distance, mile range), aid stations, and at every critical junction (the route changes trail, or the
// 10K turnaround) 2 photo frames. Images come from sources/curated/intersections.json (route -> junction id -> image paths under site/public/);
// empty lists print clean placeholder frames.
import fs from 'node:fs'; import path from 'node:path';
import { trailSequence, type TSeg } from './sequence';
import { esc, station } from './util';
import { miniBibSvg } from './panels';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
const MAN = path.join(import.meta.dir, '../../sources/curated/intersections.json');
export type Junction = { id: string; mile: number; title: string; crit: boolean; stations: string[] };
/** segments (10K split at its turnaround) + junction nodes, in running order */
export function routeNodes(c: Ctx, k: string) {
  let segs: TSeg[] = trailSequence(c, k).map((s) => ({ ...s }));
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], mi = f.properties.mi as number[];
  const tp = c.pois.features.find((p: any) => p.properties.kind === 'turnaround' && p.properties.course === k);
  let turn = -1; if (tp) { const q = tp.geometry.coordinates[0]; let bd = Infinity; co.forEach((p, i) => { const d = M(p, q); if (d < bd) { bd = d; turn = mi[i]; } });
    const j = segs.findIndex((s) => s.a < turn && s.b > turn); if (j >= 0) segs.splice(j, 1, { ...segs[j], b: turn }, { ...segs[j], a: turn }); }
  const cuts = c.cutoffs[k] as { station: string; mile: number }[], used = new Set<number>();
  const near = (m: number) => cuts.map((q, i) => [q, i] as const).filter(([q, i]) => !used.has(i) && Math.abs(q.mile - m) < 0.2).map(([q, i]) => (used.add(i), q.station));
  const nodes: (Junction | { seg: TSeg })[] = [];
  let n = 0; const id = () => `${k}-${String(++n).padStart(2, '0')}`;
  nodes.push({ id: id(), mile: 0, title: 'Start', crit: false, stations: near(0) });
  segs.forEach((s, i) => {
    if (i > 0) { const p = segs[i - 1], isTurn = Math.abs(s.a - turn) < 1e-6;
      // aid stations that fall inside the previous segment come first
      for (const q of cuts) { const ix = cuts.indexOf(q); if (!used.has(ix) && q.mile > p.a + 0.2 && q.mile < s.a - 0.2) { used.add(ix); nodes.push({ id: id(), mile: q.mile, title: `${c.stations.stations[q.station].name} aid`, crit: false, stations: [q.station] }); } }
      nodes.push({ id: id(), mile: s.a, title: isTurn ? `Turnaround on ${p.name}` : `${p.name ?? 'Unnamed segment'} → ${s.name ?? 'Unnamed segment'}`, crit: true, stations: near(s.a) }); }
    nodes.push({ seg: s });
  });
  { const p = segs[segs.length - 1]; for (const q of cuts) { const ix = cuts.indexOf(q); if (!used.has(ix) && q.mile > p.a + 0.2 && q.mile < p.b - 0.2) { used.add(ix); nodes.push({ id: id(), mile: q.mile, title: `${c.stations.stations[q.station].name} aid`, crit: false, stations: [q.station] }); } } }
  nodes.push({ id: id(), mile: f.properties.distance_mi, title: 'Finish', crit: false, stations: near(f.properties.distance_mi) });
  return nodes;
}
const fmt = (m: number) => m.toFixed(1);
const dot = (c: Ctx, st: string) => `<svg class="rs-st" viewBox="-26 -26 52 52">${station(0, 0, st, false, { s: st === 'S/F' ? 1500 : 1100, fs: st === 'S/F' ? 13 : 22, badge: false, colors: c.colors, link: false })}</svg>`;
export function routeSeqPage(c: Ctx, k: string) {
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : { routes: {} }, imgs = man.routes?.[k] ?? {};
  const nodes = routeNodes(c, k), cc = c.courses.colors[k];
  let crit = 0, rows = '';
  for (const x of nodes) {
    if ('seg' in x) { const s = x.seg; rows += `<li class="rs-seg"><span class="rs-name${s.name ? '' : ' rs-unk'}">${esc(s.name ?? 'Unnamed segment')}</span> <span class="rs-d">${(s.b - s.a).toFixed(1)} mi</span> <span class="rs-r">mi ${fmt(s.a)}–${fmt(s.b)}</span></li>`; continue; }
    const st = x.stations.map((q) => dot(c, q)).join(''), aid = x.stations.filter((q) => q !== 'S/F').map((q) => `Aid ${q} · ${esc(c.stations.stations[q].name)}`).join(', ');
    let ph = '';
    if (x.crit) { crit++; const list: string[] = imgs[x.id] ?? [];
      ph = `<div class="rs-ph">${[0, 1].map((i) => list[i] ? `<figure class="rs-fr"><img src="${esc(list[i])}" alt="${esc(x.title)}"/></figure>` : `<figure class="rs-fr rs-empty"><span>Photo</span><small>${esc(x.title)} · mi ${fmt(x.mile)}</small></figure>`).join('')}</div>`; }
    rows += `<li class="rs-node${x.crit ? ' rs-crit' : ''}" data-id="${x.id}"><span class="rs-pin">${st || '<i></i>'}</span><div class="rs-txt"><b>mi ${fmt(x.mile)}</b> ${esc(x.title)}${aid ? `<span class="rs-aid">${aid}</span>` : ''}</div>${ph}</li>`;
  }
  console.log(`  routeseq ${k}: ${nodes.filter((x) => 'seg' in x).length} segments, ${crit} critical junctions`);
  return `<article class="doc routeseq" data-course="${k}" style="--rc:${cc}"><header class="rs-head"><h2 style="color:${cc}">${miniBibSvg(k, cc, 0.8)} ${k} · trail by trail</h2><p class="note">Running order, top to bottom. Segment distances are approximate (from the GPX); trail names from OpenStreetMap and park maps. Each junction where the route changes trail has space for photos.</p></header><ol class="rs">${rows}</ol></article>`;
}
