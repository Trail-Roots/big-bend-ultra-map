// Aid-station lightbox (web only): click a station on the map, in the heat map, in a race table, or on an aid-station card.
// Zoomed map (cloned from the main map in site/app.ts), photo slot, amenities (sources/curated/amenities.json), busiest times, hours, cutoffs per race.
// Web cards + lightbox: every tracked service is listed with ✓ or ✕ (never omitted), except volunteer overnight camp, which is an info note only where it applies. Vehicle is shown only when the data has a limit (4x4), never "Any vehicle".
// Print station pages: still list only what a station has (plus a 4x4 limit when it applies), so the PDF layout is unchanged aside from dropping "Any vehicle".
import { esc, station } from '../lib/util';
import { renderStationHeat } from '../lib/timeline';
import { milestones } from '../lib/milestones';
import { icon } from '../lib/icons';
import amen from '../../sources/curated/amenities.json';
import type { Ctx } from '../lib/types';
export const meta = { id: 'stations', title: 'Aid stations', print: false };
export const DROP_BAGS_HASH = '#drop-bags';

type AmV = 'y' | 'n' | 'i' | 'u';
type AmRow = { v: AmV; lab: string; href?: string };
const yn = (val: unknown): AmV => (val === true ? 'y' : val === false ? 'n' : 'u');
const toiletLab = (a: any) => (a.toilet === 'restrooms' ? 'Restrooms' : a.toilet === 'privy' ? 'Privy' : null);
// vehicle: only a real limitation (e.g. 4x4). "any" is omitted (Erik, Nov 2026).
const vehicleLimit = (a: any) => (a.vehicle && a.vehicle !== 'any' ? (a.vehicle === '4x4' ? '4x4 only' : String(a.vehicle)) : null);

/** Web: the same full set on every station, each ✓ or ✕. Print: only what the station has, plus a vehicle limit when it applies. */
export function amRows(a: any, mode: 'web' | 'print'): AmRow[] {
  const aid = a.medic ? 'Medic & first aid' : 'Basic first aid';
  const toilet = toiletLab(a), veh = vehicleLimit(a);
  if (mode === 'print') {
    const rows: AmRow[] = [{ v: 'y', lab: 'Water + sports drinks' }];
    if (a.snacks) rows.push({ v: 'y', lab: 'Snacks' });
    rows.push({ v: 'y', lab: aid });
    if (toilet) rows.push({ v: 'y', lab: toilet });
    if (a.dropBags === true) rows.push({ v: 'y', lab: 'Drop bags' });
    if (a.spectators) rows.push({ v: 'y', lab: 'Spectator access' });
    if (veh) rows.push({ v: 'i', lab: veh });
    if (a.camp) rows.push({ v: 'i', lab: 'Volunteers camp here overnight' });
    return rows;
  }
  const rows: AmRow[] = [
    { v: 'y', lab: 'Water + sports drinks' },
    { v: yn(a.snacks), lab: 'Snacks' },
    { v: 'y', lab: aid },
    toilet ? { v: 'y', lab: toilet } : { v: 'u', lab: 'Toilet' },
    { v: yn(a.dropBags), lab: 'Drop bags', href: a.dropBags === true ? DROP_BAGS_HASH : undefined },
    { v: yn(a.spectators), lab: 'Spectator access' },
  ];
  if (veh) rows.push({ v: 'i', lab: veh });
  if (a.camp) rows.push({ v: 'i', lab: 'Volunteer overnight camp' });
  return rows;
}

export function amList(a: any, mode: 'web' | 'print') {
  return `<ul class="amen">${amRows(a, mode).map((r) => {
    const mark = r.v === 'y' ? '✓' : r.v === 'n' ? '✕' : r.v === 'u' ? '?' : mode === 'print' ? 'i' : icon('info');
    const state = r.v === 'y' ? 'available' : r.v === 'n' ? 'not available' : r.v === 'u' ? 'unknown' : 'info';
    const lab = r.href ? `<a href="${esc(r.href)}" class="am-cal">${esc(r.lab)}</a>` : esc(r.lab);
    return `<li class="am am-${r.v}" aria-label="${esc(r.lab)}: ${esc(state)}"><span class="amv" aria-hidden="true">${mark}</span>${lab}</li>`;
  }).join('')}</ul>`;
}

/** Compact cutoff times for the brief cards: "6:30 PM" → "6:30p". Starts and TBD visits are omitted. */
const shortCut = (t: string) => t.replace(/(\d{1,2}:\d{2}) ?([AP])M/gi, (_, hm, a) => hm + a.toLowerCase()).replace(/, /g, ' / ');
export function cutsCol(c: Ctx, k: string) {
  const hits: { r: string; t: string }[] = [];
  for (const r of c.courses.order) {
    const vs = c.cutoffs[r].map((x: any, i: number) => ({ x, i })).filter(({ x, i }: any) => x.station === k && i > 0 && x.cutoff && x.cutoff !== 'TBD');
    if (!vs.length) continue;
    const raw = vs.length === 1 ? vs[0].x.cutoff : vs.map((v: any) => v.x.cutoff).join(', ');
    hits.push({ r, t: (k === 'S/F' && (raw === '1:00 AM' || /Jan 18/.test(raw))) ? '1:00 AM Mon' : raw });
  }
  const rows = hits.length
    ? hits.map((h) => `<li><span class="stc-cr">${esc(h.r)}</span> <span class="stc-ct">${esc(shortCut(h.t))}</span></li>`).join('')
    : `<li class="stc-cnone">None</li>`;
  return `<div class="stc-cuts"><h4>Cutoffs</h4><ul>${rows}</ul></div>`;
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
<div class="stc-cols">${amList(a, 'web')}${cutsCol(c, k)}</div>
</article>`;
}

/** Screen-only grid of brief aid-station cards (embed + site), after the race cards. */
export function stCardsHtml(c: Ctx) {
  return `<div class="ui stcards-wrap"><h2 class="stcards-h">Aid stations</h2><div class="stcards" role="list">${c.stations.order.map((k) => briefCard(c, k)).join('')}</div></div>`;
}

// secondary, subtler named-place link (the primary link is always coordinates); none where no valid named place exists
const NEAR: Record<string, string> = { 'S/F': 'Barton Warnock Visitor Center', '2': 'West Contrabando Trailhead', '3': 'Whit-Roy Cinnabar Mine', '5': 'Paso al Solitario' };
/** '5:30 AM' -> '\u20075:30a' (hour padded with a figure space so every time lines up digit for digit) */
const sh = (t: string) => t.replace(/^(\d{1,2}):(\d\d) ?([AP])M$/i, (_, h, m, a) => (h.length < 2 ? '\u2007' : '') + h + ':' + m + a.toLowerCase());
/** one station's detail block: the web lightbox template body, or (print) the same block (photo / placeholder and coordinates link included) */
export function stCard(c: Ctx, k: string, print = false) {
    const s = c.stations.stations[k], a = (amen as any)[k] ?? {}, LL = s.link_lonlat ?? s.lonlat, ll = `${LL[1].toFixed(6)},${LL[0].toFixed(6)}`, llTxt = `${LL[1].toFixed(5)}, ${LL[0].toFixed(5)}`; /* primary map link: ALWAYS coordinates, always visible (web + print) */
    /* Timing: one row per event (every visit of every race here): race | mileage (GPX, right-aligned) | start / cutoff | time (bold; Google Calendar), tabular numerals */
    const cuts = c.courses.order.flatMap((r) => c.cutoffs[r].map((x, i) => ({ x, i })).filter(({ x }) => x.station === k).map(({ x, i }, j) => { const lab = i === 0 ? 'start' : x.cutoff !== 'TBD' ? 'cutoff' : '', t = lab ? sh(x.cutoff) : '';
      return `<tr class="cutv${j ? '' : ' cut1'}"><th class="cutr" style="color:${c.courses.colors[r]}">${j ? '' : r}</th><td class="cutm">${x.mile.toFixed(1)}</td><td class="cutu">mi</td><td class="cutl">${lab || '—'}</td><td class="cutt">${t ? `<b>${esc(t)}</b>` : ''}</td></tr>`; })).join('');
    const photo = a.photo ? `<img src="${esc(a.photo)}" alt="${esc(s.name)} aid station">` : `<div class="ph-empty">${icon('pin')}<span>Photo coming soon</span></div>`;
    return `<header class="st-head"><svg class="st-badge" viewBox="-42 -42 84 84" overflow="visible" aria-hidden="true">${station(0, 0, k, s.spectator, { s: k === 'S/F' ? 2900 : 2000, fs: k === 'S/F' ? 34 : 28, badge: false, colors: c.colors, link: false })}</svg><div><h2>${esc(k === 'S/F' ? s.name : `${k} · ${s.name}`)}</h2><p class="note">${esc(s.long ?? '')} · ${(s.elevation_ft ?? 0).toLocaleString('en-US')} ft</p></div></header>
<div class="st-grid"><div class="st-map" data-station="${esc(k)}"></div><figure class="st-photo">${photo}</figure></div>
<div class="st-info"><section><h3>Open</h3><p class="st-hours"><b>${esc(s.hours ?? '?')}</b></p><p class="st-coordp"><a class="st-coord" href="https://www.google.com/maps?q=${ll}" target="_blank" rel="noopener">${icon('pin')}Map: ${llTxt}</a></p>${NEAR[k] ? `<p class="st-nearp">Nearby: <a class="st-near" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(NEAR[k] + ', TX')}" target="_blank" rel="noopener">${esc(NEAR[k])}</a></p>` : ''}</section>
<section><h3>Available</h3>${amList(a, print ? 'print' : 'web')}</section>
<section><h3>Timing</h3><table class="st-cuts st-timing"><tbody>${cuts}</tbody></table></section></div>
<section class="st-msl"><h3>Route</h3>${c.courses.order.filter((r) => c.cutoffs[r].some((q) => q.station === k)).map((r) => milestones(c, r, k)).join('')}</section>
<section class="st-heat"><h3>Busiest times <small>(modelled per 15 min)</small></h3>${renderStationHeat(c, k)}</section>`;
}
export function render(c: Ctx) {
  const tpl = c.stations.order.map((k) => `<template id="st-${k === 'S/F' ? 'SF' : k}">${stCard(c, k)}</template>`).join('');
  return `${tpl}<dialog class="lightbox stbox" id="stationbox" aria-label="Aid station"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body"></div></dialog>`;
}
