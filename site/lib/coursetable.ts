// Per-race GPX distance matrix (used on the race pages). The separate aid-stations table page was dropped; its only unique data,
// station elevation, is kept here as a column.
import { esc } from './util';
import { cutMin } from './timeline';
/** minutes per mile -> "m:ss /mi" */
export const paceStr = (minPerMi: number) => { const s = Math.round(minPerMi * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /mi`; };
// Distances are GPX-derived (content/cutoffs.json miles = cumulative GPX distance); cutoffs from the revised race sheet.
/** GPX distance matrix + cutoffs for one course */
export function courseTable(c, k: string) {
  const S = c.stations.stations, C = c.courses.courses[k], q = c.cutoffs[k], st = cutMin(C.start)!;
  const body = q.map((x, i) => {
    const prev = i ? (x.mile - q[i - 1].mile).toFixed(1) : '—', next = i < q.length - 1 ? (q[i + 1].mile - x.mile).toFixed(1) : '—';
    let cm = cutMin(x.cutoff); if (cm != null && cm < st) cm += 1440;
    const pace = i && cm != null ? paceStr((cm - st) / x.mile).replace(' /mi', '') : '', mov = i && cm != null ? `${((cm - st) / 60).toFixed(1)} h` : '';
    const s = S[x.station], last = i === q.length - 1, first = i === 0;
    return `<tr><td>${esc(first ? 'Start' : last ? 'Finish' : s.name)}</td><td class="n">${x.mile.toFixed(1)}</td><td class="n">${prev}</td><td class="n">${next}</td><td>${esc(first ? `start ${sh(C.start)}` : x.cutoff === 'TBD' ? '—' : sh(x.cutoff))}</td><td class="n">${pace}</td><td class="n">${mov}</td><td class="n">${s.elevation_ft ? s.elevation_ft.toLocaleString('en-US') : ''}</td></tr>`;
  }).join('');
  return `<table class="cuttab"><thead><tr><th>Station</th><th class="n">Mile</th><th class="n">From prev.</th><th class="n">To next</th><th>Cutoff</th><th class="n">Overall pace</th><th class="n">Moving time</th><th class="n">Elev (ft)</th></tr></thead><tbody>${body}</tbody></table>`;
}
/** "10:30 AM" -> "10:30a" */
const sh = (t: string) => t.replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
export const TABLE_NOTE = 'Miles measured on each course GPX (the route of record). “Overall pace” = average min/mi from the start to reach that station by its cutoff; “Moving time” = the hours available from the start to that cutoff at that overall pace (aid-station time included). “—” = no cutoff at that visit. Cutoffs: revised race sheet.';
