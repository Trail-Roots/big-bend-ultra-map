import { esc } from '../lib/util';
import { miniBibSvg } from '../lib/panels';
import { cutMin } from '../lib/timeline';
export const meta = { id: 'stations', title: 'Aid stations, distances & cutoffs' };
/** minutes per mile -> "m:ss /mi" */
export const paceStr = (minPerMi: number) => { const s = Math.round(minPerMi * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /mi`; };
const openOf = (hours: string | undefined) => (hours ? hours.split('-')[0].trim() : '');
// Distances are GPX-derived (content/cutoffs.json miles = cumulative GPX distance); cutoffs from the revised race sheet.
/** GPX distance matrix + cutoffs for one course */
export function courseTable(c, k: string) {
  const S = c.stations.stations, C = c.courses.courses[k], q = c.cutoffs[k], st = cutMin(C.start)!;
  const body = q.map((x, i) => {
    const prev = i ? (x.mile - q[i - 1].mile).toFixed(1) : '—', next = i < q.length - 1 ? (q[i + 1].mile - x.mile).toFixed(1) : '—';
    let cm = cutMin(x.cutoff); if (cm != null && cm < st) cm += 1440;
    const pace = i && cm != null ? paceStr((cm - st) / x.mile).replace(' /mi', '') : '';
    const s = S[x.station], last = i === q.length - 1, first = i === 0;
    return `<tr><td>${esc(first ? 'Start' : last ? 'Finish' : s.name)}</td><td class="n">${x.mile.toFixed(1)}</td><td class="n">${prev}</td><td class="n">${next}</td><td>${first || last ? '' : esc(openOf(s.hours))}</td><td>${esc(first ? `start ${sh(C.start)}` : x.cutoff === 'TBD' ? '—' : sh(x.cutoff))}</td><td class="n">${pace}</td></tr>`;
  }).join('');
  return `<table class="cuttab"><thead><tr><th>Station</th><th class="n">Mile</th><th class="n">From prev.</th><th class="n">To next</th><th>Opens</th><th>Cutoff</th><th class="n">Pace needed</th></tr></thead><tbody>${body}</tbody></table>`;
}
/** "10:30 AM" -> "10:30a" */
const sh = (t: string) => t.replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
export const TABLE_NOTE = 'Miles measured on each course GPX (the route of record). “Pace needed” = average min/mi from the start to reach that station by its cutoff, aid-station time included. “—” = no cutoff at that visit. Cutoffs: revised race sheet.';
export function render(c) {
  const S = c.stations.stations;
  const rows = c.stations.order.map((k) => { const s = S[k]; return `<tr><td>${esc(k)}</td><td>${esc(s.name)}</td><td>${esc(s.long ?? s.name)}</td><td>${esc(s.hours || '')}</td><td>${s.spectator ? 'yes' : ''}</td><td>${s.elevation_ft ? s.elevation_ft.toLocaleString('en-US') : ''}</td></tr>`; }).join('');
  const per = c.courses.order.map((k) => `<div class="keep course-cut"><h4 class="bibh" style="color:${c.courses.colors[k]}">${miniBibSvg(k, c.courses.colors[k], 0.8)} ${c.courses.courses[k].distance_mi.toFixed(1)} mi · start ${esc(c.courses.courses[k].start)}</h4>${courseTable(c, k)}</div>`).join('');
  return `<article class="doc"><h2>Distances &amp; cutoffs by course</h2><p class="note">${TABLE_NOTE}</p>${per}<h3>Aid stations</h3><table><tr><th>#</th><th>Short name</th><th>Full name</th><th>Hours</th><th>Spectators</th><th>Elev (ft)</th></tr>${rows}</table></article>`;
}
