// PDF-only route lists + master Intersections section.
// routeSeqPage: ONE portrait page right after each race page (the back of its duplex sheet): vertical route line, every trail with its
// approximate distance, the cumulative mile at each junction (numbered link to the master section) and aid stations.
// intersectionsSection: every physical junction once (shared junctions deduped by location + trails), with the races/miles that use it and
// 2 photo frames; photos come from sources/curated/intersections.json (junction id -> image paths under site/public/).
import fs from 'node:fs'; import path from 'node:path';
import { trailSequence, type TSeg } from './sequence';
import { esc, station } from './util';
import { miniBibSvg } from './panels';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
const MAN = path.join(import.meta.dir, '../../sources/curated/intersections.json');
export type Junction = { id: string; mile: number; title: string; crit: boolean; stations: string[]; ll?: number[]; trails?: string[]; turn?: boolean };
/** segments (10K split at its turnaround) + junction nodes, in running order */
export function routeNodes(c: Ctx, k: string) {
  let segs: TSeg[] = trailSequence(c, k).map((s) => ({ ...s }));
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], mi = f.properties.mi as number[];
  const tp = c.pois.features.find((p: any) => p.properties.kind === 'turnaround' && p.properties.course === k);
  let turn = -1; if (tp) { const q = tp.geometry.coordinates[0]; let bd = Infinity; co.forEach((p, i) => { const d = M(p, q); if (d < bd) { bd = d; turn = mi[i]; } });
    const j = segs.findIndex((s) => s.a < turn && s.b > turn); if (j >= 0) segs.splice(j, 1, { ...segs[j], b: turn }, { ...segs[j], a: turn }); }
  // drop sub-0.05 mi slivers (GPS noise at a junction): the previous segment absorbs them, and merges with the next if it is the same trail
  for (let i = 1; i < segs.length - 1; i++) if (segs[i].b - segs[i].a < 0.05) { segs[i - 1].b = segs[i].b; segs.splice(i, 1); if (segs[i] && segs[i].name === segs[i - 1].name && Math.abs(segs[i].a - turn) > 1e-6) { segs[i - 1].b = segs[i].b; segs.splice(i, 1); } i--; }
  const llAt = (m: number) => { let bi = 0, bd = Infinity; mi.forEach((v, i) => { const d = Math.abs(v - m); if (d < bd) { bd = d; bi = i; } }); return co[bi]; };
  const cuts = c.cutoffs[k] as { station: string; mile: number }[], used = new Set<number>();
  const near = (m: number) => cuts.map((q, i) => [q, i] as const).filter(([q, i]) => !used.has(i) && Math.abs(q.mile - m) < 0.2).map(([q, i]) => (used.add(i), q.station));
  const nodes: (Junction | { seg: TSeg })[] = [];
  let n = 0; const id = () => `${k}-${String(++n).padStart(2, '0')}`;
  nodes.push({ id: id(), mile: 0, title: 'Start', crit: false, stations: near(0) });
  segs.forEach((s, i) => {
    if (i > 0) { const p = segs[i - 1], isTurn = Math.abs(s.a - turn) < 1e-6;
      // aid stations that fall inside the previous segment come first
      for (const q of cuts) { const ix = cuts.indexOf(q); if (!used.has(ix) && q.mile > p.a + 0.2 && q.mile < s.a - 0.2) { used.add(ix); nodes.push({ id: id(), mile: q.mile, title: `${c.stations.stations[q.station].name} aid`, crit: false, stations: [q.station] }); } }
      nodes.push({ id: id(), mile: s.a, title: isTurn ? `Turnaround on ${p.name}` : `${p.name ?? 'Unnamed segment'} → ${s.name ?? 'Unnamed segment'}`, crit: true, stations: near(s.a), ll: llAt(s.a), turn: isTurn, trails: isTurn ? [p.name ?? "Unnamed segment"] : [...new Set([p.name ?? "Unnamed segment", s.name ?? "Unnamed segment"])].sort() }); }
    nodes.push({ seg: s });
  });
  { const p = segs[segs.length - 1]; for (const q of cuts) { const ix = cuts.indexOf(q); if (!used.has(ix) && q.mile > p.a + 0.2 && q.mile < p.b - 0.2) { used.add(ix); nodes.push({ id: id(), mile: q.mile, title: `${c.stations.stations[q.station].name} aid`, crit: false, stations: [q.station] }); } } }
  nodes.push({ id: id(), mile: f.properties.distance_mi, title: 'Finish', crit: false, stations: near(f.properties.distance_mi) });
  return nodes;
}
const fmt = (m: number) => m.toFixed(1);
const dot = (c: Ctx, st: string) => `<svg class="rs-st" viewBox="-26 -26 52 52">${station(0, 0, st, false, { s: st === "S/F" ? 1500 : 1100, fs: st === "S/F" ? 13 : 22, badge: false, colors: c.colors, link: false })}</svg>`;
export type MJ = { id: string; no: number; ll: number[]; trails: string[]; turn: boolean; uses: { k: string; mile: number; node: string }[] };
/** deduped physical junctions across all races. id = location (lat/lon to 3 decimals, ~100 m) so it survives route edits; a letter is added on a clash */
export function masterJunctions(c: Ctx) {
  const out: MJ[] = [], byNode = new Map<string, MJ>();
  for (const k of c.courses.order) for (const x of routeNodes(c, k)) { if ("seg" in x || !x.crit) continue;
    const fm = (t: string) => (/^Start area|^Cross FM 170/.test(t) ? "FM 170 crossing" : t), tr = [...new Set(x.trails!.map(fm))].sort(), key = tr.join("|"); let m = out.find((j) => j.trails.join("|") === key && j.turn === !!x.turn && M(j.ll, x.ll!) < 150);
    if (!m) { m = { id: "", no: out.length + 1, ll: x.ll!, trails: tr, turn: !!x.turn, uses: [] }; out.push(m); }
    m.uses.push({ k, mile: x.mile, node: x.id }); byNode.set(k + "/" + x.id, m); }
  const seen = new Set<string>(); for (const j of out) { const b = `J${Math.round(j.ll[1] * 1000)}-${Math.round(-j.ll[0] * 1000)}`; let id = b, n = 0; while (seen.has(id)) id = b + String.fromCharCode(98 + n++); seen.add(id); j.id = id; }
  return { list: out, byNode };
}
let MJC: ReturnType<typeof masterJunctions> | null = null; const mj = (c: Ctx) => (MJC ??= masterJunctions(c));
const jname = (j: MJ) => j.turn ? `Turnaround on ${j.trails[0]}` : j.trails.join(" / ");
export function routeSeqPage(c: Ctx, k: string) {
  const nodes = routeNodes(c, k), cc = c.courses.colors[k], { byNode } = mj(c);
  let rows = "", pend: Junction | null = null, segs = 0, links = 0;
  const aidOf = (x: Junction) => x.stations.filter((q) => q !== "S/F").map((q) => `Aid ${q} · ${esc(c.stations.stations[q].name)}`).join(", ");
  for (const x of nodes) {
    if ("seg" in x) { const s = x.seg; segs++; const j = pend ? byNode.get(k + "/" + pend.id) : null; if (j) links++;
      const aid = pend ? aidOf(pend) : "";
      rows += `<li class="rs-seg"${pend ? ` id="rs-${k}-${pend.id}"` : ""}><span class="rs-pin">${j ? `<a class="rs-no" href="#ix-${j.id}">${j.no}</a>` : "<i></i>"}</span><span class="rs-mi">${pend ? "mi " + fmt(s.a) : ""}</span><span class="rs-name${s.name ? "" : " rs-unk"}">${esc(s.name ?? "Unnamed segment")}${pend?.turn ? " <em>(turnaround, return)</em>" : ""}</span><span class="rs-d">${(s.b - s.a).toFixed(1)} mi</span>${aid ? `<span class="rs-aid">${aid}</span>` : ""}</li>`;
      pend = null; continue; }
    if (x.crit) { pend = x; continue; }
    const st = x.stations.map((q) => dot(c, q)).join(""), aid = aidOf(x);
    rows += `<li class="rs-node"><span class="rs-pin">${st || "<i></i>"}</span><span class="rs-mi">mi ${fmt(x.mile)}</span><span class="rs-title">${esc(x.title)}</span>${aid && !/aid$/.test(x.title) ? `<span class="rs-aid">${aid}</span>` : ""}</li>`;
  }
  console.log(`  routeseq ${k}: ${segs} segments, ${links} junction links`);
  return `<article class="doc routeseq" id="rs-${k}" data-course="${k}" style="--rc:${cc}"><h2 style="color:${cc}">${miniBibSvg(k, cc, 0.8)}</h2><ol class="rs">${rows}</ol></article>`;
}
export function intersectionsSection(c: Ctx) {
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, "utf8")) : {}, imgs = man.junctions ?? {}, { list } = mj(c);
  const ent = list.map((j) => { const ph: string[] = imgs[j.id] ?? [];
    return `<section class="ixe" id="ix-${j.id}" data-r="${[...new Set(j.uses.map((u) => u.k))].join(" ")}"><h3><span class="rs-no">${j.no}</span> ${esc(jname(j))}</h3><p class="ixu">${j.uses.map((u) => `<a href="#rs-${u.k}-${u.node}" style="color:${c.courses.colors[u.k]}">${u.k} mi ${fmt(u.mile)}</a>`).join(" · ")}<span class="ixid">${j.id}</span></p><div class="ixph">${[0, 1].map((i) => ph[i] ? `<figure class="rs-fr"><img src="${esc(ph[i])}" alt="${esc(jname(j))}"/></figure>` : `<figure class="rs-fr rs-empty"><span>Photo</span></figure>`).join("")}</div></section>`; }).join("");
  console.log(`  intersections: ${list.length} junctions (from ${list.reduce((a, j) => a + j.uses.length, 0)} route junctions)`);
  return `<article class="doc ixsec"><h2>Intersections</h2><div class="ixg">${ent}</div></article>`;
}
