// PDF-only route lists + master Intersections section.
// routeSeqPage: ONE portrait page right after each race page (the back of its duplex sheet): vertical route line, every trail with its
// approximate distance, the cumulative mile at each junction (numbered link to the master section) and aid stations.
// intersectionsSection: every physical junction once (shared junctions deduped by location + trails), with the races/miles that use it and
// 2 photo frames; photos come from sources/curated/intersections.json (junction id -> image paths under site/public/).
import fs from 'node:fs'; import path from 'node:path';
import { trailSequence, type TSeg } from './sequence';
import { routeBranches, type Branch } from './junctions';
import { esc, station } from './util';
import { miniBibSvg } from './panels';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
const MAN = path.join(import.meta.dir, '../../sources/curated/intersections.json');
export type Junction = { id: string; mile: number; title: string; crit: boolean; stations: string[]; ll?: number[]; trails?: string[]; turn?: boolean; next?: string; how?: string; dirSrc?: "geom" | "neutral"; pass?: boolean };
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
  // turn direction from the GPX: route bearing over 40-120 m before vs after the junction (local meters). <25 deg = no direction stated
  const brg = (m0: number, m1: number) => { const a = llAt(m0), b = llAt(m1); return Math.atan2((b[1] - a[1]) * 110540, (b[0] - a[0]) * 111320 * k0); };
  const others = (bs: Branch[]) => [...new Set(bs.map((b) => b.name))].map((n) => { const sd = new Set(bs.filter((b) => b.name === n).map((b) => b.side)); return sd.has("left") && sd.has("right") ? `${n} on both sides` : sd.has("left") ? `${n} on the left` : sd.has("right") ? `${n} on the right` : n; }), and = (L: string[]) => L.length < 2 ? L.join("") : L.slice(0, -1).join(", ") + " and " + L[L.length - 1];
  const howTo = (pn: string | null | undefined, nn: string | null | undefined, isTurn: boolean, m: number, bs: Branch[] = []) => {
    const P = pn ?? "the unnamed segment", N = nn ?? "the unnamed segment";
    const sf = /^Start area/.test(P) || /^Cross FM 170/.test(N), ob = bs.filter((b) => b.name !== N && b.name !== P && !(sf && b.name === "FM 170")), pass = ob.length ? `, passing ${and(others(ob))}` : "", anyS = ob.some((b) => b.side);
    if (isTurn) return { next: N, how: `Turn around on ${N} and return the way you came${ob.length ? ` (${and(ob.map((b) => b.name))} also meets here)` : ""}.`, dirSrc: "geom" as const };
    let d = (brg(m + 0.025, m + 0.075) - brg(m - 0.075, m - 0.025)) * 180 / Math.PI; d = ((d + 540) % 360) - 180; const a = Math.abs(d), side = d > 0 ? "left" : "right";
    const dir = a < 25 ? "" : a < 60 ? `bear ${side}` : a < 135 ? side : `sharp ${side}`, src = a < 25 && !anyS ? "neutral" as const : "geom" as const, pd = dir ? ` (${dir})` : "";
    if (/^Cross FM 170/.test(N)) return { next: "Finish", how: `Leave ${P}${pd} and cross FM 170 to the finish${pass}.`, dirSrc: src };
    if (/^Start area/.test(P)) return { next: N, how: `After crossing FM 170, take ${N}${pd}${pass}.`, dirSrc: src };
    return { next: N, how: `Take ${N}${pd}, leaving ${P}${pass}.`, dirSrc: src }; };
  const ev = routeBranches(c, k), evUsed = new Set<number>();
  const evAt = (m: number) => { const o: Branch[] = []; ev.forEach((e, i) => { if (!evUsed.has(i) && Math.abs(e.mile - m) < 0.06) { evUsed.add(i); o.push(...e.branches); } }); return o; };
  const cuts = c.cutoffs[k] as { station: string; mile: number }[], used = new Set<number>();
  const near = (m: number) => cuts.map((q, i) => [q, i] as const).filter(([q, i]) => !used.has(i) && Math.abs(q.mile - m) < 0.2).map(([q, i]) => (used.add(i), q.station));
  const nodes: (Junction | { seg: TSeg })[] = [];
  // claim the trail-change junctions' branches first so pass-throughs never double them
  for (let i = 1; i < segs.length; i++) ev.forEach((e, j) => { if (Math.abs(e.mile - segs[i].a) < 0.06) evUsed.add(j); });
  const evTC = new Set(evUsed); evUsed.clear();
  const inner = (p: TSeg, end: number) => { const items: { m: number; f: () => void }[] = [];
    for (const q of cuts) { const ix = cuts.indexOf(q); if (!used.has(ix) && q.mile > p.a + 0.2 && q.mile < end - 0.2) { used.add(ix); items.push({ m: q.mile, f: () => nodes.push({ id: id(), mile: q.mile, title: `${c.stations.stations[q.station].name} aid`, crit: false, stations: [q.station] }) }); } }
    ev.forEach((e, j) => { if (evTC.has(j) || evUsed.has(j) || e.mile <= p.a || e.mile >= end) return; const T = p.name ?? "the unnamed segment", ob = e.branches.filter((b) => b.name !== T); evUsed.add(j); if (!ob.length) return;
      items.push({ m: e.mile, f: () => nodes.push({ id: id(), mile: e.mile, title: T, crit: true, pass: true, stations: [], ll: co[e.i], next: T, how: `Stay on ${T}, passing ${and(others(ob))}.`.replace(/passing (FM 170) on both sides/, "crossing $1"), dirSrc: ob.some((b) => b.side) ? "geom" : "neutral", trails: [...new Set([T, ...ob.map((b) => b.name)])].sort() }) }); });
    items.sort((a, b) => a.m - b.m).forEach((x) => x.f()); };
  let n = 0; const id = () => `${k}-${String(++n).padStart(2, '0')}`;
  nodes.push({ id: id(), mile: 0, title: 'Start', crit: false, stations: near(0) });
  segs.forEach((s, i) => {
    if (i > 0) { const p = segs[i - 1], isTurn = Math.abs(s.a - turn) < 1e-6;
      // aid stations that fall inside the previous segment come first
      inner(p, s.a);
      const bs = isTurn ? evAt(s.a) : evAt(s.a);
      nodes.push({ id: id(), mile: s.a, title: isTurn ? `Turnaround on ${p.name}` : `${p.name ?? 'Unnamed segment'} → ${s.name ?? 'Unnamed segment'}`, crit: true, stations: near(s.a), ll: llAt(s.a), turn: isTurn, ...howTo(p.name, s.name, isTurn, s.a, bs), trails: isTurn ? [p.name ?? "Unnamed segment"] : [...new Set([p.name ?? "Unnamed segment", s.name ?? "Unnamed segment"])].sort() }); }
    nodes.push({ seg: s });
  });
  { const p = segs[segs.length - 1]; inner(p, p.b); }
  nodes.push({ id: id(), mile: f.properties.distance_mi, title: 'Finish', crit: false, stations: near(f.properties.distance_mi) });
  return nodes;
}
const fmt = (m: number) => m.toFixed(1);
const dot = (c: Ctx, st: string) => `<svg class="rs-st" viewBox="-26 -26 52 52">${station(0, 0, st, false, { s: st === "S/F" ? 1500 : 1100, fs: st === "S/F" ? 13 : 22, badge: false, colors: c.colors, link: false })}</svg>`;
export type MJ = { id: string; no: number; ll: number[]; trails: string[]; turn: boolean; uses: { k: string; mile: number; node: string; next: string; how: string; src: string }[] };
/** deduped physical junctions across all races. id = location (lat/lon to 3 decimals, ~100 m) so it survives route edits; a letter is added on a clash */
export function masterJunctions(c: Ctx) {
  const out: MJ[] = [], byNode = new Map<string, MJ>();
  for (const k of c.courses.order) for (const x of routeNodes(c, k)) { if ("seg" in x || !x.crit) continue;
    const fm = (t: string) => (/^Start area|^Cross FM 170/.test(t) ? "FM 170 crossing" : t), tr = [...new Set(x.trails!.map(fm))].sort(), key = tr.join("|"); let m = out.find((j) => j.trails.join("|") === key && j.turn === !!x.turn && M(j.ll, x.ll!) < 150);
    if (!m) { m = { id: "", no: out.length + 1, ll: x.ll!, trails: tr, turn: !!x.turn, uses: [] }; out.push(m); }
    m.uses.push({ k, mile: x.mile, node: x.id, next: x.next!, how: x.how!, src: x.dirSrc! }); byNode.set(k + "/" + x.id, m); }
  const seen = new Set<string>(); for (const j of out) { const b = `J${Math.round(j.ll[1] * 1000)}-${Math.round(-j.ll[0] * 1000)}`; let id = b, n = 0; while (seen.has(id)) id = b + String.fromCharCode(98 + n++); seen.add(id); j.id = id; }
  return { list: out, byNode };
}
let MJC: ReturnType<typeof masterJunctions> | null = null; const mj = (c: Ctx) => (MJC ??= masterJunctions(c));
const jname = (j: MJ) => j.turn ? `Turnaround on ${j.trails[0]}` : j.trails.join(" / ");
export function routeSeqPage(c: Ctx, k: string) {
  const nodes = routeNodes(c, k), cc = c.courses.colors[k], { byNode } = mj(c);
  const R: { m: number; h: string }[] = []; let rows = "", pend: Junction | null = null, segs = 0, links = 0;
  const cutAt = (st: string[], m: number) => { const q = (c.cutoffs[k] as any[]).find((q) => st.includes(q.station) && q.station !== "S/F" && Math.abs(q.mile - m) < 0.3); return q?.cutoff && q.cutoff !== "TBD" ? `<span class="rs-cut">Cutoff ${esc(q.cutoff.replace(/:00 ?([AP])M$/, (_: string, a: string) => a.toLowerCase()).replace(/ ?([AP])M$/, (_: string, a: string) => a.toLowerCase()))}</span>` : ""; };
  const aidOf = (x: Junction) => x.stations.filter((q) => q !== "S/F").map((q) => `Aid ${q} · ${esc(c.stations.stations[q].name)}`).join(", ");
  for (const x of nodes) {
    if ("seg" in x) { const s = x.seg; segs++; const j = pend ? byNode.get(k + "/" + pend.id) : null; if (j) links++;
      const aid = pend ? aidOf(pend) : "";
      if (aid) R.push({ m: s.a - 1e-4, h: `<li class="rs-node rs-aidrow"><span class="rs-pin">${pend!.stations.filter((q) => q !== "S/F").map((q) => dot(c, q)).join("")}</span><span class="rs-mi">mi ${fmt(s.a)}</span><span class="rs-title">${pend!.stations.filter((q) => q !== "S/F").map((q) => esc(c.stations.stations[q].name) + " aid").join(", ")}</span>${cutAt(pend!.stations, s.a)}</li>` });
      R.push({ m: s.a, h: `<li class="rs-seg"${pend ? ` id="rs-${k}-${pend.id}"` : ""}><span class="rs-pin">${j ? `<a class="rs-jx" href="#ix-${j.id}" aria-label="Intersection photos"></a>` : "<i></i>"}</span><span class="rs-mi">${pend ? "mi " + fmt(s.a) : ""}</span><span class="rs-name${s.name ? "" : " rs-unk"}">${esc(s.name ?? "Unnamed segment")}</span><span class="rs-d">${(s.b - s.a).toFixed(1)} mi</span>${pend?.how ? `<span class="rs-dir">${esc(pend.how)}</span>` : ""}</li>` });
      pend = null; continue; }
    if (x.crit && x.pass) { const j = byNode.get(k + "/" + x.id); if (j) links++;
      R.push({ m: x.mile, h: `<li class="rs-seg rs-pass" id="rs-${k}-${x.id}"><span class="rs-pin">${j ? `<a class="rs-jx" href="#ix-${j.id}" aria-label="Intersection photos"></a>` : "<i></i>"}</span><span class="rs-mi">mi ${fmt(x.mile)}</span><span class="rs-name">${esc(x.next!)}</span><span class="rs-d"></span><span class="rs-dir">${esc(x.how!)}</span></li>` }); continue; }
    if (x.crit) { pend = x; continue; }
    const st = x.stations.map((q) => dot(c, q)).join(""), aid = aidOf(x);
    R.push({ m: x.mile, h: `<li class="rs-node${x.stations.some((q) => q !== "S/F") ? " rs-aidrow" : ""}"><span class="rs-pin">${st || "<i></i>"}</span><span class="rs-mi">mi ${fmt(x.mile)}</span><span class="rs-title">${esc(x.title)}</span>${cutAt(x.stations, x.mile)}${aid && !/aid$/.test(x.title) ? `<span class="rs-aid">${aid}</span>` : ""}</li>` });
  }
  { const J = nodes.filter((x): x is Junction => !("seg" in x) && x.crit); console.log(`  routeseq ${k}: ${segs} segments, ${J.length} junctions (${J.filter((x) => x.pass).length} pass-through), directions ${J.filter((x) => x.dirSrc === "geom").length} geometry / ${J.filter((x) => x.dirSrc !== "geom").length} neutral, ${links} links`); }
  // two columns: OUT up to the turnaround (or, for loops / lollipops, the point farthest from the start), BACK after it
  const sp = splitOf(c, k), col = (a: typeof R) => a.map((r) => r.h).join("");
  const A = R.filter((r) => r.m < sp.mile - 1e-6), B = R.filter((r) => r.m >= sp.mile - 1e-6);
  console.log(`  routeseq ${k}: split at mi ${sp.mile.toFixed(1)} (${sp.kind}), ${A.length} + ${B.length} rows`);
  return `<article class="doc routeseq" id="rs-${k}" data-course="${k}" style="--rc:${cc}"><h2 style="color:${cc}">${miniBibSvg(k, cc, 0.8)}</h2><div class="rs-cols"><div class="rs-col"><h3>${sp.out}</h3><ol class="rs">${col(A)}</ol></div><div class="rs-col"><h3>${sp.back}</h3><ol class="rs">${col(B)}</ol></div></div></article>`;
}
export function intersectionsSection(c: Ctx) {
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, "utf8")) : {}, imgs = man.junctions ?? {}, { list } = mj(c);
  const ent = list.map((j) => { const ph: string[] = imgs[j.id] ?? [];
    // primary label: the next trail (first use); one light line per distinct instruction, with the runs/miles that use it (links back)
    const g = new Map<string, MJ["uses"]>(); for (const u of j.uses) (g.get(u.how) ?? g.set(u.how, []).get(u.how)!).push(u);
    const lines = [...g].map(([how, us]) => `<p class="ixu"><span class="ixhow">${esc(how)}</span> ${us.map((u) => `<a href="#rs-${u.k}-${u.node}" style="color:${c.courses.colors[u.k]}">${u.k} mi ${fmt(u.mile)}</a>`).join(" · ")}</p>`).join("");
    return `<section class="ixe" id="ix-${j.id}" data-r="${[...new Set(j.uses.map((u) => u.k))].join(" ")}"><h3>${esc(j.uses[0].next)}</h3>${lines}<div class="ixph">${[0, 1].map((i) => ph[i] ? `<figure class="rs-fr"><img src="${esc(ph[i])}" alt="${esc(j.uses[0].next)}"/></figure>` : `<figure class="rs-fr rs-empty"><span>Photo</span></figure>`).join("")}</div></section>`; }).join("");
  const dd = list.flatMap((j) => j.uses); console.log(`  intersections directions: ${dd.filter((u) => u.src === "geom").length} from geometry, ${dd.filter((u) => u.src === "neutral").length} neutral (Continue)`);
  console.log(`  intersections: ${list.length} junctions (from ${list.reduce((a, j) => a + j.uses.length, 0)} route junctions)`);
  return `<article class="doc ixsec"><h2>Intersections</h2><div class="ixg">${ent}</div></article>`;
}

/** where the list splits into OUT / BACK. Turnaround POI if the race has one; else the GPX point farthest (straight line) from the start.
 *  Pure out-and-back = the return trail order mirrors the outbound one. */
export function splitOf(c: Ctx, k: string) {
  const f = c.courseGeo[k].features[0], co = f.geometry.coordinates as number[][], mi = f.properties.mi as number[];
  const tp = c.pois.features.find((p: any) => p.properties.kind === 'turnaround' && p.properties.course === k);
  let mile = 0, kind = "turnaround";
  if (tp) { const q = tp.geometry.coordinates[0]; let bd = Infinity; co.forEach((p, i) => { const d = M(p, q); if (d < bd) { bd = d; mile = mi[i]; } }); }
  else { kind = "farthest point"; let bd = -1; co.forEach((p, i) => { const d = M(p, co[0]); if (d > bd) { bd = d; mile = mi[i]; } }); }
  // snap to the nearest junction / segment start so a row is never split
  const segs = routeNodes(c, k).filter((x): x is { seg: TSeg } => "seg" in x).map((x) => x.seg);
  const sn = segs.reduce((b, x) => Math.abs(x.a - mile) < Math.abs(b - mile) ? x.a : b, segs[0].a); if (!tp) mile = sn;
  const nm = (L: TSeg[]) => L.map((x) => (/^Start area|^Cross FM 170/.test(x.name ?? "") ? "FM 170" : x.name)).filter((n, i, a) => n !== a[i - 1]);
  const o = nm(segs.filter((x) => x.a < mile)), b = nm(segs.filter((x) => x.a >= mile)).reverse(), pure = o.length === b.length && o.every((n, i) => n === b[i]);
  return pure ? { mile, kind, pure, out: `Out · to the turnaround, mi ${mile.toFixed(1)}`, back: "Back · same way to the finish" }
    : { mile, kind, pure, out: `Out · to mi ${mile.toFixed(1)} (${kind === "turnaround" ? "turnaround" : "farthest from start"})`, back: "Back · different return to the finish" };
}
