// Aid-station lightbox (web only): click a station on the map, in the heat map, in a race table, or on an aid-station card.
// Zoomed map (cloned from the main map in site/app.ts), photo slot, amenities (sources/curated/amenities.json), busiest times, hours, cutoffs per race.
// Web cards + lightbox: every tracked service is listed (icon when present, red ✕ + "No …" when not). 4x4 and overnight camp are one info-only remote-volunteer note, only where it applies. Vehicle is never shown as "Any vehicle".
// Print station pages: still list only what a station has (plus a 4x4 limit when it applies), so the PDF layout is unchanged aside from dropping "Any vehicle".
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, station } from '../lib/util';
import { renderStationHeat } from '../lib/timeline';
import { milestones } from '../lib/milestones';
import { icon } from '../lib/icons';
import amen from '../../sources/curated/amenities.json';
import type { Ctx } from '../lib/types';
export const meta = { id: 'stations', title: 'Aid stations', print: false };
export const DROP_BAGS_HASH = '#drop-bags';
export const VOLUNTEER_HREF = 'https://trailroots.com/volunteers';
const CREW_LAB = 'Volunteer camp · 4x4 only';

type AmV = 'y' | 'n' | 'i' | 'u';
type AmRow = { v: AmV; lab: string; href?: string; ic?: string; races?: string[] };
const yn = (val: unknown): AmV => (val === true ? 'y' : val === false ? 'n' : 'u');
const toiletLab = (a: any) => (a.toilet === 'restrooms' ? 'Restrooms' : a.toilet === 'privy' ? 'Privy' : null);
// vehicle: only a real limitation (e.g. 4x4). "any" is omitted (Erik, Nov 2026).
const vehicleLimit = (a: any) => (a.vehicle && a.vehicle !== 'any' ? (a.vehicle === '4x4' ? '4x4 only' : String(a.vehicle)) : null);

/** Sheet station names → our ids (same map as scripts/content.ts). */
const SHEET_ID: Record<string, string> = { 'Barton Warnock': 'S/F', Finish: 'S/F', Waterhole: '1', 'Whit Roy': '3', 'Whit Roy Mine': '3', 'Right Hand Shutup': '4', 'Paso al Solitario': '5', Contrabando: '2', Contabando: '2' };
function csvRows(t: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
/** Per-station races with Drop Bags = YES on the official sheet, in course order (longest first). */
let _bagRaces: Record<string, string[]> | null = null;
function bagRacesFromSheet(order: string[]): Record<string, string[]> {
  if (_bagRaces) return _bagRaces;
  const sheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../sources/sheet.csv'), 'utf8');
  const by: Record<string, Set<string>> = {};
  let cur: string | null = null;
  for (const r of csvRows(sheet)) {
    if (order.includes(r[0]) && r[1] === 'Mileage') { cur = r[0]; continue; }
    if (!cur || !r[0]) { cur = r[0] ? cur : null; continue; }
    const id = SHEET_ID[r[0].trim()];
    if (!id) continue;
    if ((r[6] || '').trim().toUpperCase() === 'YES') (by[id] ??= new Set()).add(cur);
  }
  _bagRaces = Object.fromEntries(Object.entries(by).map(([id, set]) => [id, order.filter((k) => set.has(k))]));
  return _bagRaces;
}

/** Web and print: the same full set on every station (icon when present, red ✕ + "No …" when not). Volunteer camp is one info-only row where it applies. */
export function amRows(a: any, mode: 'web' | 'print', opt: { bagRaces?: string[]; linkBags?: boolean } = {}): AmRow[] {
  const aid = a.medic ? 'Medic & first aid' : 'Basic first aid';
  const toilet = toiletLab(a), veh = vehicleLimit(a);
  const races = opt.bagRaces ?? [];
  const bagsOn = races.length > 0 || a.dropBags === true;
  const bagLab = races.length ? `Drop bags: ${races.join(', ')}` : 'Drop bags';
  void mode;
  // spectator, drop bags, restrooms, first aid, then water and snacks; volunteer camp is one info row
  const rows: AmRow[] = [
    { v: yn(a.spectators), lab: a.spectators ? 'Spectator access' : 'No spectator access', ic: 'binoculars' },
    { v: bagsOn ? 'y' : 'n', lab: bagsOn ? bagLab : 'No drop bags', ic: 'bag', href: opt.linkBags && bagsOn ? DROP_BAGS_HASH : undefined, races: opt.linkBags && races.length ? races : undefined },
    { v: toilet ? 'y' : 'n', lab: toilet ?? 'No restrooms', ic: 'toilet' },
    { v: 'y', lab: aid, ic: 'firstaid' },
    { v: 'y', lab: 'Water + Skratch Labs', ic: 'droplet', mark: 'Skratch Labs', more: `Sports drinks are provided by <a href="https://www.skratchlabs.com/" target="_blank" rel="noopener">Skratch Labs</a>.` },
    { v: yn(a.snacks), lab: a.snacks ? 'Snacks' : 'No snacks', ic: 'utensils', more: a.snacks ? "You'll likely see a mix of sweet and salty snacks, fruit, and more substantial food at longer-race stations. Offerings vary." : undefined },
  ];
  // 4x4-limited stations (Waterhole, Whit Roy, Shutup, Solitario). Wording includes overnight camp at Erik's request for all four.
  if (veh === '4x4 only') {
    rows.push({ v: 'i', lab: CREW_LAB, ic: 'tent' });
  }
  return rows;
}

export function amList(a: any, mode: 'web' | 'print', opt: { bagRaces?: string[]; linkBags?: boolean } = {}) {
  const notes: string[] = [];
  const items = amRows(a, mode, opt).map((r) => {
    const mark = r.v === 'n' ? icon('x') : icon(r.ic || 'info');
    const racesAttr = r.races?.length ? ` data-races="${esc(r.races.join(" "))}"` : "";
    const labInner = r.mark ? esc(r.lab).replace(esc(r.mark), `<span class="am-sponsor">${esc(r.mark)}</span>`) : esc(r.lab);
    const lab = r.href ? `<a href="${esc(r.href)}" class="am-cal"${racesAttr}>${labInner}</a>` : labInner;
    if (r.more && mode === 'print') notes.push(r.more);
    const body = r.more && mode !== 'print'
      ? `<details class="am-more"><summary>${lab}</summary><div class="am-more-body">${r.more}</div></details>`
      : lab;
    return `<li class="am am-${r.v}${r.more ? ' am-exp' : ''}"><span class="amv" aria-hidden="true">${mark}</span>${body}</li>`;
  }).join('');
  const note = mode === 'print' && notes.length ? `<div class="am-notes">${notes.map((n) => `<p>${n}</p>`).join('')}</div>` : '';
  return `<ul class="amen">${items}</ul>${note}`;
}

/** Compact clock: "6:30 PM" → "6:30p", "9 AM" → "9a". */
const shortCut = (t: string) => t.replace(/(\d{1,2}:\d{2}) ?([AP])M/gi, (_, hm, a) => hm + a.toLowerCase()).replace(/(\d{1,2}) ?([AP])M/gi, (_, h, a) => h + a.toLowerCase()).replace(/, /g, ' / ');
/** Station hours start, e.g. "5:45a - 11p" → { short: "5:45a", long: "5:45 AM" }. */
function openFromHours(hours?: string): { short: string; long: string } | null {
  const m = (hours || '').match(/^\s*(\d{1,2}(?::\d{2})?)\s*([ap])m?\b/i);
  if (!m) return null;
  const ap = m[2].toLowerCase() === 'p' ? 'PM' : 'AM';
  return { short: shortCut(m[1] + ' ' + ap), long: m[1] + ' ' + ap };
}
export function cutsCol(c: Ctx, k: string) {
  const rows: string[] = [];
  const open = openFromHours(c.stations.stations[k]?.hours);
  if (open) rows.push(`<li class="stc-open"><span class="stc-dot stc-dot-g" aria-hidden="true"></span><span class="stc-clab">Opens</span> <span class="stc-ct">${esc(open.short)}</span></li>`);
  if (k === 'S/F') {
    for (const r of c.courses.order) {
      const start = c.cutoffs[r].find((x, i) => i === 0 && x.station === k && x.cutoff && x.cutoff !== 'TBD');
      if (start) rows.push(`<li class="stc-start"><span class="stc-dot stc-dot-g" aria-hidden="true"></span><span class="stc-cr">${esc(r)}</span> <span class="stc-clab">start</span> <span class="stc-ct">${esc(shortCut(start.cutoff))}</span></li>`);
    }
  }
  for (const r of c.courses.order) {
    const vs = c.cutoffs[r].map((x: any, i: number) => ({ x, i })).filter(({ x, i }: any) => x.station === k && i > 0 && x.cutoff && x.cutoff !== 'TBD');
    for (const v of vs) {
      const raw = (k === 'S/F' && (v.x.cutoff === '1:00 AM' || /Jan 18/.test(v.x.cutoff))) ? '1:00 AM Mon' : v.x.cutoff;
      rows.push(`<li class="stc-cut"><span class="stc-dot stc-dot-r" aria-hidden="true"></span><span class="stc-cr">${esc(r)}</span> <span class="stc-clab">cutoff</span> <span class="stc-ct">${esc(shortCut(raw))}</span></li>`);
    }
  }
  const list = rows.length ? rows.join('') : `<li class="stc-cnone">None</li>`;
  return `<div class="stc-cuts"><h4>Timing</h4><ul>${list}</ul></div>`;
}

function briefCard(c: Ctx, k: string) {
  const s = c.stations.stations[k], a = (amen as any)[k] ?? {};
  const title = s.name; // number is already in the aid icon; don't repeat it in the card title
  return `<article class="stcard-brief" data-station="${esc(k)}" role="listitem">
<header class="stc-head">
<button type="button" class="stc-mapbtn" data-station="${esc(k)}" tabindex="-1" aria-hidden="true"><div class="stc-map st-map" data-station="${esc(k)}"></div></button>
<svg class="st-badge" viewBox="-42 -42 84 84" overflow="visible" aria-hidden="true">${station(0, 0, k, s.spectator, { s: k === 'S/F' ? 2900 : 2000, fs: k === 'S/F' ? 34 : 28, badge: false, colors: c.colors, link: false })}</svg>
<div class="stc-title"><h3>${esc(title)}</h3>${s.long ? `<p class="stc-sub">${esc(s.long)}</p>` : ''}</div>
<button type="button" class="stc-full" data-station="${esc(k)}" aria-label="${esc(title)}: open full screen">${icon('expand')}</button>
</header>
<div class="stc-cols">${amList(a, 'web', { bagRaces: bagRacesFromSheet(c.courses.order)[k] ?? [], linkBags: false })}${cutsCol(c, k)}</div>
</article>`;
}

/** Screen-only grid of brief aid-station cards (embed + site), after the race cards. */
export function stCardsHtml(c: Ctx) {
  return `<div class="ui stcards-wrap" id="stations"><h2 class="stcards-h">Aid stations</h2><div class="stcards" role="list">${c.stations.order.map((k) => briefCard(c, k)).join('')}</div></div>`;
}

// secondary, subtler named-place link (the primary link is always coordinates); none where no valid named place exists
const NEAR: Record<string, string> = { 'S/F': 'Barton Warnock Visitor Center', '2': 'West Contrabando Trailhead', '3': 'Whit-Roy Cinnabar Mine', '5': 'Paso al Solitario' };
/** Full clock for the detail view: "5:30 AM"; the 100K finish is "1:00 AM Mon". */
function longCut(t: string, k: string): string {
  if (k === 'S/F' && (t === '1:00 AM' || /Jan 18/.test(t))) return '1:00 AM Mon';
  return t.replace(/, /g, ' ');
}
/** one station's detail block: the web lightbox template body, or (print) the same block (photo / placeholder and coordinates link included) */
export function stCard(c: Ctx, k: string, print = false) {
    const s = c.stations.stations[k], a = (amen as any)[k] ?? {}, LL = s.link_lonlat ?? s.lonlat, ll = `${LL[1].toFixed(6)},${LL[0].toFixed(6)}`, llTxt = `${LL[1].toFixed(5)}, ${LL[0].toFixed(5)}`; /* primary map link: ALWAYS coordinates, always visible (web + print) */
    /* Timing: one sentence per event. Finish cutoffs at S/F say "finish cutoff" / "must finish"; aid stations say "must leave". */
    const open = openFromHours(s.hours);
    const opens = open ? `<p class="st-opens"><span class="stc-dot stc-dot-g" aria-hidden="true"></span> Opens ${esc(open.long)}</p>` : '';
    const cuts = c.courses.order.flatMap((r) => c.cutoffs[r].map((x, i) => ({ x, i })).filter(({ x }) => x.station === k).map(({ x, i }, j) => {
      const kind = i === 0 ? 'start' : x.cutoff !== 'TBD' ? 'cutoff' : '';
      const mile = x.mile.toFixed(1);
      const time = kind ? longCut(x.cutoff, k) : '';
      const race = `<span class="cutr" style="color:${c.courses.colors[r]}">${esc(r)}</span>`;
      const finish = k === 'S/F' && kind === 'cutoff';
      const line = kind === 'start'
        ? `${race} start ${esc(time)} (mile ${esc(mile)})`
        : kind === 'cutoff' && finish
          ? `${race} finish cutoff ${esc(time)} — runners must finish by this time`
          : kind === 'cutoff'
            ? `${race} cutoff ${esc(time)} at mile ${esc(mile)} — runners must leave by this time`
            : `${race} at mile ${esc(mile)}`;
      const dot = kind === 'start' ? '<span class="stc-dot stc-dot-g" aria-hidden="true"></span>' : kind === 'cutoff' ? '<span class="stc-dot stc-dot-r" aria-hidden="true"></span>' : '';
      return `<li class="cutv${j ? '' : ' cut1'}${kind ? ' cut-' + kind : ''}"><span class="cutdot">${dot}</span><span class="cutline">${line}</span></li>`;
    })).join('');
    const photo = a.photo ? `<img src="${esc(a.photo)}" alt="${esc(s.name)} aid station">` : `<div class="ph-empty">${icon('pin')}<span>Photo coming soon</span></div>`;
    const title = (print || k === 'S/F') ? s.name : `${k} · ${s.name}`;
    return `<header class="st-head"><svg class="st-badge" viewBox="-42 -42 84 84" overflow="visible" aria-hidden="true">${station(0, 0, k, s.spectator, { s: k === 'S/F' ? 2900 : 2000, fs: k === 'S/F' ? 34 : 28, badge: false, colors: c.colors, link: false })}</svg><div><h2>${esc(title)}</h2><p class="note">${esc(s.long ?? '')} · ${(s.elevation_ft ?? 0).toLocaleString('en-US')} ft</p></div></header>
<div class="st-grid"><div class="st-map" data-station="${esc(k)}"></div><figure class="st-photo">${photo}</figure></div>
<div class="st-info"><section class="st-open"><h3>Open</h3><p class="st-hours"><span class="st-gico" aria-hidden="true">${icon('clock')}</span><b>${esc(s.hours ?? '?')}</b></p><h3 class="st-subh">Map</h3><p class="st-coordp"><span class="st-gico" aria-hidden="true">${icon('pin')}</span><a class="st-coord" href="https://www.google.com/maps?q=${ll}" target="_blank" rel="noopener"><span class="st-k">Map: </span>${llTxt}</a></p>${NEAR[k] ? `<h3 class="st-subh">Nearby</h3><p class="st-nearp"><span class="st-gico" aria-hidden="true">${icon('compass')}</span><span class="st-k">Nearby: </span><a class="st-near" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(NEAR[k] + ', TX')}" target="_blank" rel="noopener">${esc(NEAR[k])}</a></p>` : ''}</section>
<section class="st-avail"><h3>Available</h3>${amList(a, print ? 'print' : 'web', { bagRaces: bagRacesFromSheet(c.courses.order)[k] ?? [], linkBags: !print })}${!print && vehicleLimit(a) === '4x4 only' ? `<p class="st-vol"><a class="st-volbtn" href="${VOLUNTEER_HREF}" target="_blank" rel="noopener">Volunteer</a></p>` : ''}</section>
<section class="st-timing-sec"><h3>Timing</h3>${opens}<ul class="st-cuts st-timing">${cuts}</ul></section></div>
<section class="st-msl"><h3>Route</h3>${c.courses.order.filter((r) => c.cutoffs[r].some((q) => q.station === k)).map((r) => milestones(c, r, k)).join('')}</section>
<section class="st-heat"><h3>Busiest times <small>(modelled per 15 min)</small></h3>${renderStationHeat(c, k)}</section>`;
}
export function render(c: Ctx) {
  const tpl = c.stations.order.map((k) => `<template id="st-${k === 'S/F' ? 'SF' : k}">${stCard(c, k)}</template>`).join('');
  return `${tpl}<dialog class="lightbox stbox" id="stationbox" aria-label="Aid station"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body"></div></dialog>`;
}
