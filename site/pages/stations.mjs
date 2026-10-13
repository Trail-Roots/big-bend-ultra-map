import { esc } from '../lib/util.mjs';
export const meta = { path: 'stations/index.html', title: 'Aid stations & cutoffs', nav: 'Stations' };
export function render(c) {
  const rows = c.stations.order.map(k => { const s = c.stations.stations[k]; return `<tr><td>${esc(k)}</td><td>${esc(s.name)}</td><td>${esc(s.hours || '')}</td><td>${s.spectator ? 'yes' : ''}</td><td>${s.elevation_ft || ''}</td></tr>`; }).join('');
  const cuts = c.courses.order.map(k => `<h3 style="color:${c.courses.colors[k]}">${k} · start ${esc(c.courses.courses[k].start)}</h3><table><tr><th>Station</th><th>Mile</th><th>Cutoff</th></tr>${c.cutoffs[k].map(q => `<tr><td>${esc(c.stations.stations[q.station].name)}</td><td>${q.mile}</td><td>${esc(q.cutoff)}</td></tr>`).join('')}</table>`).join('');
  return `<article class="doc"><h1>Aid stations</h1><table><tr><th>#</th><th>Name</th><th>Hours</th><th>Spectators</th><th>Elev (ft)</th></tr>${rows}</table><h2>Cutoffs by course</h2>${cuts}</article>`;
}
