// Aid-station lightbox (web only): click a station on the map, in the heat map or in a race table. Zoomed map (cloned from the main
// map in site/app.ts), photo slot, amenities (sources/curated/amenities.json; unknowns flagged "TBC"), busiest times, hours, cutoffs per race.
import { esc, station } from '../lib/util';
import { renderStationHeat } from '../lib/timeline';
import { icon } from '../lib/icons';
import amen from '../../sources/curated/amenities.json';
import type { Ctx } from '../lib/types';
export const meta = { id: 'stations', title: 'Aid stations', print: false };
const AM: [string, string][] = [['aid', 'Aid station'], ['water', 'Water'], ['snacks', 'Snacks'], ['toilet', 'Toilet'], ['medic', 'Medic'], ['dropBags', 'Drop bags'], ['spectators', 'Spectator access'], ['parking', 'Parking']];
const sh = (t: string) => t.replace(/:00 ?([AP])M$/, (_, a) => a.toLowerCase()).replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
export function render(c: Ctx) {
  const tpl = c.stations.order.map((k) => {
    const s = c.stations.stations[k], a = (amen as any)[k] ?? {}, q = encodeURIComponent((s.link_lonlat ?? s.lonlat).slice().reverse().join(','));
    const am = AM.map(([f, lab]) => { const v = a[f]; return `<li class="am am-${v === true ? 'y' : v === false ? 'n' : 'u'}"><span class="amv" aria-hidden="true">${v === true ? '✓' : v === false ? '✕' : '?'}</span>${lab}${v == null ? ' <em>TBC</em>' : v === false ? ' <em>no</em>' : ''}</li>`; }).join('');
    const cuts = c.courses.order.map((r) => { const v = c.cutoffs[r].filter((x, i) => x.station === k && i > 0); if (!v.length) return '';
      return `<tr><th style="color:${c.courses.colors[r]}">${r}</th><td>${v.map((x) => `<span class="cutv"><b>${x.cutoff === 'TBD' ? 'no cutoff' : sh(x.cutoff)}</b> <small>mi ${x.mile.toFixed(1)}</small></span>`).join(' ')}</td></tr>`; }).join('');
    const photo = a.photo ? `<img src="${esc(a.photo)}" alt="${esc(s.name)} aid station">` : `<div class="ph-empty">${icon('pin')}<span>Photo coming soon</span></div>`;
    return `<template id="st-${k === 'S/F' ? 'SF' : k}"><header class="st-head"><svg class="st-badge" viewBox="-30 -30 60 60" aria-hidden="true">${station(0, 0, k, s.spectator, { s: k === 'S/F' ? 2900 : 2000, fs: k === 'S/F' ? 34 : 28, badge: false, colors: c.colors })}</svg><div><h2>${esc(k === 'S/F' ? s.name : `${k} · ${s.name}`)}</h2><p class="note">${esc(s.long ?? '')} · ${(s.elevation_ft ?? 0).toLocaleString('en-US')} ft</p></div></header>
<div class="st-grid"><div class="st-map" data-station="${esc(k)}"></div><figure class="st-photo">${photo}</figure></div>
<div class="st-info"><section><h3>Open</h3><p class="st-hours"><b>${esc(s.hours ?? 'TBC')}</b></p><p><a class="st-gmap" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${icon('pin')}Open in Google Maps</a></p></section>
<section><h3>Available</h3><ul class="amen">${am}</ul></section>
<section><h3>Cutoffs</h3>${cuts ? `<table class="st-cuts">${cuts}</table>` : '<p class="note">No cutoffs here (start / finish).</p>'}</section></div>
<section class="st-heat"><h3>Busiest times <small>(2026 runners, modelled per 15 min)</small></h3>${renderStationHeat(c, k)}</section></template>`;
  }).join('');
  return `${tpl}<dialog class="lightbox stbox" id="stationbox" aria-label="Aid station"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body"></div></dialog>`;
}
