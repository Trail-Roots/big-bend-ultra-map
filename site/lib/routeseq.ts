// PDF-only route lists + master Intersections section.
// routeSeqPage: ONE portrait page right after each race page (the back of its duplex sheet): vertical route line, every trail with its
// approximate distance, the cumulative mile at each junction (numbered link to the master section) and aid stations.
// intersectionsSection: every physical junction once (shared junctions deduped by location + trails), with the races/miles that use it and
// 2 photo frames; photos come from sources/curated/intersections.json (junction id -> image paths under site/public/).
import fs from 'node:fs'; import path from 'node:path';
import { trailSequence, ways, type TSeg } from './sequence';
import { routeBranches, type Branch } from './junctions';
import { esc, station } from './util';
import { miniBibSvg } from './panels';
import type { Ctx } from './types';
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
// Erik's confirmed bearings win over computed ones: { "<junction id>": { "<trail taken>": "bear left" | "bear right" | "bear center" } }
const BEAR = path.join(import.meta.dir, '../../sources/curated/bearings.json');
const MAN = path.join(import.meta.dir, '../../sources/curated/intersections.json');
export type Junction = { id: string; mile: number; title: string; crit: boolean; stations: string[]; ll?: number[]; trails?: string[]; turn?: boolean; next?: string; how?: string; dirSrc?: "geom" | "neutral"; pass?: boolean };
/** segments (10K split at its turnaround) + junction nodes, in running order */
const RNC: Record<string, ReturnType<typeof routeNodes0>> = {};
export function routeNodes(c: Ctx, k: string) { return (RNC[k] ??= routeNodes0(c, k)); }
function routeNodes0(c: Ctx, k: string) {
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
  const others = (bs: Branch[], cur?: string) => { const by = new Map<string, Branch[]>(); for (const b of bs) (by.get(b.name) ?? by.set(b.name, []).get(b.name)!).push(b); return [...by].map(([n, L]) => { const rs = [...new Set(L.map((b) => b.race!))].sort((x, y) => parseInt(y) - parseInt(x)), sd = new Set(L.map((b) => b.side)), side = sd.size === 1 && L[0].side ? ` ${L[0].side}` : ""; return `${rs.join("/")} ${n === cur ? `stay${rs.length > 1 ? "" : "s"} on ${n}` : `use${rs.length > 1 ? "" : "s"} ${n}${side ? ` (${side.trim()})` : ""}`}`; }); }, and = (L: string[]) => L.length < 2 ? L.join("") : L.slice(0, -1).join(", ") + " and " + L[L.length - 1];
  const unres: string[] = [];
  const bearOf = (d: number, bs: Branch[], m: number) => { const o = bs.map((b) => b.ang).filter((a): a is number => a != null && Math.abs(a - d) > 8);
    if (o.length) return d > Math.max(...o) ? "bear left" : d < Math.min(...o) ? "bear right" : "bear center";
    // shallow turn with no other race on the other branch: compare against the mapped (OSM) trail(s) leaving the junction that the route does not take
    { const J = llAt(m), h = brg(m - 0.075, m - 0.025), near = co.filter((_, i) => Math.abs(mi[i] - m) < 0.15), angs: number[] = [];
      for (const w of ways()) for (const p of w.d) { const r = M(J, p); if (r < 40 || r > 120 || near.some((q) => M(q, p) < 25)) continue;
        let a = (Math.atan2((p[1] - J[1]) * 110540, (p[0] - J[0]) * 111320 * k0) - h) * 180 / Math.PI; a = ((a + 540) % 360) - 180; if (Math.abs(a) < 150) angs.push(a); }
      const o = angs.filter((a) => Math.abs(a - d) > 8); if (o.length) return d > Math.max(...o) ? "bear left" : d < Math.min(...o) ? "bear right" : "bear center"; }
    if (Math.abs(d) >= 8) return d > 0 ? "bear left" : "bear right";
    unres.push(`${k} mi ${m.toFixed(2)}`); return ""; };
  const howTo = (pn: string | null | undefined, nn: string | null | undefined, isTurn: boolean, m: number, bs: Branch[] = []) => {
    const P = pn ?? "the unnamed segment", N = nn ?? "the unnamed segment";
    const ob = bs.filter((b) => b.name !== N);
    if (isTurn) return { next: N, how: `Turn around on ${N} and return the way you came.`, dirSrc: "geom" as const };
    let d = (brg(m + 0.025, m + 0.075) - brg(m - 0.075, m - 0.025)) * 180 / Math.PI; d = ((d + 540) % 360) - 180;
    const dir = bearOf(d, ob, m), src = dir ? "geom" as const : "neutral" as const, pd = dir ? ` (${dir})` : "";
    if (/^Cross FM 170/.test(N)) return { next: "Finish", how: `Leave ${P}${pd} and cross FM 170 to the finish.`, dirSrc: src };
    if (/^Start area/.test(P)) return { next: N, how: `After crossing FM 170, take ${N}${pd}.`, dirSrc: src };
    return { next: N, how: `Take ${N}${pd}, leaving ${P}.`, dirSrc: src }; };
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
      items.push({ m: e.mile, f: () => nodes.push({ id: id(), mile: e.mile, title: T, crit: true, pass: true, stations: [], ll: co[e.i], next: T, how: (() => { let d = (brg(e.mile + 0.025, e.mile + 0.075) - brg(e.mile - 0.075, e.mile - 0.025)) * 180 / Math.PI; d = ((d + 540) % 360) - 180; const b = bearOf(d, ob, e.mile); return `Stay on ${T}${b ? ` (${b})` : ""} at its junction with ${and([...new Set(ob.map((x) => x.name))])}.`; })(), dirSrc: "geom", trails: [...new Set([T, ...ob.map((b) => b.name)])].sort() }) }); });
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
  if (unres.length) console.log(`  routeseq ${k}: bearing unresolved at ${unres.join(", ")}`);
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
  // Erik's overrides (sources/curated/bearings.json) keyed by junction id -> "<trail taken>" or "<prev trail> > <trail taken>"; then every
  // junction+turn (same junction, same from/to trails) is made to read identically on all races (majority of computed bearings; logged)
  const ov = fs.existsSync(BEAR) ? JSON.parse(fs.readFileSync(BEAR, "utf8")) : {}; let nov = 0;
  const RX = / \((?:bear |sharp )?(?:left|right|center)\)/, strip = (h: string) => h.replace(RX, "").replace(/^Continue onto ([^,]+), leaving (.+)$/, "Take $1, leaving $2");
  const bearIn = (h: string) => h.match(/\(((?:bear |sharp )?(?:left|right|center))\)/)?.[1] ?? (/^Continue onto/.test(h) ? "continue" : "");
  const prevOf = (h: string) => h.match(/leaving ([^.,]+)/)?.[1] ?? h.match(/^Leave ([^(.]+?)(?: \(| and)/)?.[1] ?? (/^After crossing FM 170/.test(h) ? "Start area" : "");
  const setB = (x: Junction, b: string) => { const h = strip(x.how!);
    if (b === "continue") { const lv = prevOf(h); if (!lv || /^Leave|^After/.test(h)) return false; x.how = `Continue onto ${x.next}, leaving ${lv}.`; x.dirSrc = "neutral"; return true; }
    const lw = h.toLowerCase(), a = lw.startsWith("leave ") ? "leave " + prevOf(h).toLowerCase() : "take " + x.next!.toLowerCase(), p0 = lw.indexOf(a); if (p0 < 0) return false;
    const p = p0 + a.length; x.how = h.slice(0, p) + ` (${b})` + h.slice(p); x.dirSrc = "geom"; return true; };
  const rows: { k: string; x: Junction; j: MJ; from: string }[] = [];
  for (const k of c.courses.order) for (const x of routeNodes(c, k)) { if ("seg" in x || !x.crit || !x.how) continue; const j = byNode.get(k + "/" + x.id); if (j) { const pr = rows[rows.length - 1]; rows.push({ k, x, j, from: pr && pr.k === k ? String(Math.round(Math.atan2(x.ll![1] - pr.x.ll![1], (x.ll![0] - pr.x.ll![0]) * 0.872) * 180 / Math.PI)) : "start" }); } }
  for (const r of rows) { const o = ov[r.j.id]; const b = o?.[`${prevOf(r.x.how!)} > ${r.x.next}`] ?? o?.[r.x.next!]; if (typeof b === "string" && setB(r.x, b)) { nov++; (r.x as any)._ov = 1; } }
  // same junction + same wording + same direction of travel (approach heading from the previous junction within 60 deg)
  const grp = new Map<string, typeof rows>(); const ad = (a: string, b: string) => { if (a === "start" || b === "start") return a === b ? 0 : 999; const d = Math.abs(+a - +b) % 360; return d > 180 ? 360 - d : d; };
  for (const r of rows) { const b0 = r.j.id + "|" + strip(r.x.how!); let g = [...grp.keys()].find((q) => q.startsWith(b0 + "|") && ad(q.slice(b0.length + 1), r.from) < 60) ?? b0 + "|" + r.from; (grp.get(g) ?? grp.set(g, []).get(g)!).push(r); }
  for (const [g, rs] of grp) { if (rs.length < 2) continue; const cnt = new Map<string, number>(); for (const r of rs) { const b = bearIn(r.x.how!); cnt.set(b, (cnt.get(b) ?? 0) + ((r.x as any)._ov ? 100 : 1)); }
    if (cnt.size < 2) continue; const srt = [...cnt].sort((a, b) => b[1] - a[1]), win = srt[1][1] === srt[0][1] ? "continue" : srt[0][0]; // tie = unresolved -> "Continue onto"
    console.log(`  bearing harmonised ${g}: ${rs.map((r) => `${r.k}=${bearIn(r.x.how!) || "none"}`).join(" ")} -> ${win || "none"}`);
    for (const r of rs) if (bearIn(r.x.how!) !== win) { if (win) setB(r.x, win); else { r.x.how = strip(r.x.how!); } } }
  for (const r of rows) { const u = r.j.uses.find((u) => u.k === r.k && u.node === r.x.id); if (u) { u.how = r.x.how!; u.src = r.x.dirSrc!; } }
  console.log(`  bearings: ${nov} junction rows from sources/curated/bearings.json`);
  return { list: out, byNode };
}
let MJC: ReturnType<typeof masterJunctions> | null = null; const mj = (c: Ctx) => (MJC ??= masterJunctions(c));
const jname = (j: MJ) => j.turn ? `Turnaround on ${j.trails[0]}` : j.trails.join(" / ");
export function routeSeqPage(c: Ctx, k: string) {
  const nodes = routeNodes(c, k), cc = c.courses.colors[k], { byNode } = mj(c);
  const R: { m: number; h: string }[] = []; let cur: TSeg | null = null; let rows = "", pend: Junction | null = null, segs = 0, links = 0;
  const cutAt = (st: string[], m: number) => { const q = (c.cutoffs[k] as any[]).find((q) => st.includes(q.station) && q.station !== "S/F" && Math.abs(q.mile - m) < 0.3); return q?.cutoff && q.cutoff !== "TBD" ? `<span class="rs-cut">Cutoff ${esc(q.cutoff.replace(/:00 ?([AP])M$/, (_: string, a: string) => a.toLowerCase()).replace(/ ?([AP])M$/, (_: string, a: string) => a.toLowerCase()))}</span>` : ""; };
  const aidOf = (x: Junction) => x.stations.filter((q) => q !== "S/F").map((q) => `Aid ${q} · ${esc(c.stations.stations[q].name)}`).join(", ");
  for (const x of nodes) {
    if ("seg" in x) { const s = x.seg; cur = s; segs++; const j = pend ? byNode.get(k + "/" + pend.id) : null; if (j) links++;
      const aid = pend ? aidOf(pend) : "";
      if (aid) R.push({ m: s.a - 1e-4, h: `<li class="rs-node rs-aidrow"><span class="rs-pin">${pend!.stations.filter((q) => q !== "S/F").map((q) => dot(c, q)).join("")}</span><span class="rs-mi">mi ${fmt(s.a)}</span><span class="rs-title">${pend!.stations.filter((q) => q !== "S/F").map((q) => esc(c.stations.stations[q].name) + " aid").join(", ")}</span>${cutAt(pend!.stations, s.a)}</li>` });
      R.push({ m: s.a, h: `<li class="rs-seg"${pend ? ` id="rs-${k}-${pend.id}"` : ""}><span class="rs-pin">${j ? `<a class="rs-jx" href="#ix-${j.id}" aria-label="Intersection photos"></a>` : "<i></i>"}</span><span class="rs-mi">${pend ? "mi " + fmt(s.a) : ""}</span><span class="rs-name${s.name ? "" : " rs-unk"}">${esc(s.name ?? "Unnamed segment")}</span><span class="rs-d">${(s.b - s.a).toFixed(1)} mi</span>${pend?.how ? `<span class="rs-dir">${esc(pend.how)}</span>` : ""}</li>` });
      pend = null; continue; }
    if (x.crit && x.pass) { const j = byNode.get(k + "/" + x.id); if (j) links++;
      R.push({ m: x.mile, h: `<li class="rs-seg rs-pass" id="rs-${k}-${x.id}"><span class="rs-pin">${j ? `<a class="rs-jx" href="#ix-${j.id}" aria-label="Intersection photos"></a>` : "<i></i>"}</span><span class="rs-mi">mi ${fmt(x.mile)}</span><span class="rs-name">${esc(x.next!)}</span><span class="rs-d"></span><span class="rs-dir">${esc(x.how!)}</span></li>` }); continue; }
    if (x.crit) { pend = x; continue; }
    const st = x.stations.map((q) => dot(c, q)).join(""), aid = aidOf(x);
    R.push({ m: x.mile, h: `<li class="rs-node${x.stations.some((q) => q !== "S/F") ? " rs-aidrow" : ""}"><span class="rs-pin">${st || "<i></i>"}</span><span class="rs-mi">mi ${fmt(x.mile)}</span><span class="rs-title">${esc(x.title)}</span>${x.title === "Start" && c.courses.courses?.[k]?.start ? `<span class="rs-cut">· ${esc(String(c.courses.courses[k].start).replace(/:00 ?([AP])M$/, (_: string, a: string) => a.toLowerCase()).replace(/ ?([AP])M$/, (_: string, a: string) => a.toLowerCase()))}</span>` : ""}${cutAt(x.stations, x.mile)}${aid && !/aid$/.test(x.title) ? `<span class="rs-aid">${aid}</span>` : ""}</li>` });
    if (cur && aid && x.mile > cur.a + 0.05 && x.mile < cur.b - 0.05) { const T = cur.name ?? "Unnamed segment", sn = x.stations.filter((q) => q !== "S/F").map((q) => c.stations.stations[q].name).join(" / ");
      R.push({ m: x.mile + 1e-4, h: `<li class="rs-seg rs-after"><span class="rs-pin"><i></i></span><span class="rs-mi"></span><span class="rs-name${cur.name ? "" : " rs-unk"}">${esc(T)}</span><span class="rs-d">%%D%%</span><span class="rs-dir">${esc(`From ${sn}, stay on ${T}.`)}</span></li>` }); }
  }
  { const J = nodes.filter((x): x is Junction => !("seg" in x) && x.crit); console.log(`  routeseq ${k}: ${segs} segments, ${J.length} junctions (${J.filter((x) => x.pass).length} pass-through), directions ${J.filter((x) => x.dirSrc === "geom").length} geometry / ${J.filter((x) => x.dirSrc !== "geom").length} neutral, ${links} links`); }
  if (process.env.JDUMP) for (const x of nodes) if (!("seg" in x) && x.crit) console.log(`JD ${k}\t${x.mile.toFixed(2)}\t${x.pass ? "PASS" : x.turn ? "TURN" : "NAME"}\t${x.title}\t${x.how}`);
  // two columns: OUT up to the turnaround (or, for loops / lollipops, the point farthest from the start), BACK after it
  R.forEach((r, i) => { if (r.h.includes("%%D%%")) { const nx = R.slice(i + 1).find((q) => q.m > r.m + 1e-3); r.h = r.h.replace("%%D%%", `${((nx?.m ?? r.m) - r.m).toFixed(1)} mi`); } });
  const sp = splitOf(c, k), col = (a: typeof R) => a.map((r) => r.h).join("");
  const A = R.filter((r) => r.m < sp.mile - 1e-6), B = R.filter((r) => r.m >= sp.mile - 1e-6);
  console.log(`  routeseq ${k}: split at mi ${sp.mile.toFixed(1)} (${sp.kind}), ${A.length} + ${B.length} rows`);
  return `<article class="doc routeseq" id="rs-${k}" data-course="${k}" style="--rc:${cc}"><h2 style="color:${cc}">${miniBibSvg(k, cc, 0.8)}</h2><div class="rs-cols"><div class="rs-col"><h3>${sp.out}</h3><ol class="rs">${col(A)}</ol></div><div class="rs-col"><h3>${sp.back}</h3><ol class="rs">${col(B)}</ol></div></div></article>`;
}
export function intersectionsSection(c: Ctx) {
  const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, "utf8")) : {}, imgs = man.junctions ?? {}, { list } = mj(c);
  const ent = list.map((j) => { const ph: string[] = imgs[j.id] ?? [];
    // Erik: just the junction (its trail names), the photo frames and link(s) back to the route lists — no miles / distances
    const twins = list.filter((q) => q.trails.join("|") === j.trails.join("|") && q.turn === j.turn), ns = (q: MJ) => q.ll[1] - j.ll[1], ew = (q: MJ) => q.ll[0] - j.ll[0];
    // same trail pair meeting twice: tell them apart by compass position (geometry only), never by mileage
    const pos = twins.length < 2 ? "" : (() => { const o = twins.filter((q) => q !== j); const vs = Math.max(...o.map((q) => Math.abs(ns(q)))) >= Math.max(...o.map((q) => Math.abs(ew(q)) * 0.87)); return vs ? (o.every((q) => ns(q) < 0) ? " (north)" : o.every((q) => ns(q) > 0) ? " (south)" : " (middle)") : (o.every((q) => ew(q) < 0) ? " (east)" : o.every((q) => ew(q) > 0) ? " (west)" : " (middle)"); })();
    const nm = j.trails.join(" & ") + (j.turn ? " (turnaround)" : "") + pos, seenR = new Set<string>();
    const back = j.uses.filter((u) => !seenR.has(u.k) && seenR.add(u.k)).map((u) => `<a href="#rs-${u.k}-${u.node}" style="color:${c.courses.colors[u.k]}">${u.k}</a>`).join(" · ");
    return `<section class="ixe" id="ix-${j.id}" data-r="${[...seenR].join(" ")}"><h3>${esc(nm)}</h3><p class="ixu">Back to route list: ${back}</p><div class="ixph">${[0, 1].map((i) => ph[i] ? `<figure class="rs-fr"><img src="${esc(ph[i])}" alt="${esc(nm)}"/></figure>` : `<figure class="rs-fr rs-empty"><span>Photo</span></figure>`).join("")}</div></section>`; }).join("");
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
