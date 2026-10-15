// Per-race GPX distance matrix (used on the race pages). The separate aid-stations table page was dropped; its only unique data,
// station elevation, was replaced by the cumulative elevation gain from the start (same method as the site's gain readout).
import { esc } from './util';
import { cutMin } from './timeline';
import { cumGain, lerp } from './hover';
/** minutes per mile -> "m:ss /mi" */
export const paceStr = (minPerMi: number) => { const s = Math.round(minPerMi * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /mi`; };
// Distances are GPX-derived (content/cutoffs.json miles = cumulative GPX distance); cutoffs from the revised race sheet.
/** GPX distance matrix + cutoffs for one course */
export function courseTable(c, k: string) {
  const S = c.stations.stations, C = c.courses.courses[k], q = c.cutoffs[k], st = cutMin(C.start)!;
  // cumulative gain from the start: this race's GPX profile sampled every 0.05 mi, then cumGain (±0.25 mi moving average + 10 ft hysteresis),
  // exactly as the hover gain readout, so the Finish row equals the race's total gain
  const pr = c.profiles[k], dist = c.courseGeo[k].features[0].properties.distance_mi, ms: number[] = []; for (let m = 0; m <= dist + 1e-9; m += 0.05) ms.push(Math.round(m * 100) / 100);
  const g = cumGain(ms.map((m) => lerp(m, pr.mi, pr.ft))), gainAt = (mi: number, last: boolean) => g[last ? g.length - 1 : Math.min(g.length - 1, Math.round(mi / 0.05))];
  console.log(`  gain ${k}: ${gainAt(0, true)} ft total`);
  const body = q.map((x, i) => {
    const prev = i ? (x.mile - q[i - 1].mile).toFixed(1) : '—', next = i < q.length - 1 ? (q[i + 1].mile - x.mile).toFixed(1) : '—';
    let cm = cutMin(x.cutoff); if (cm != null && cm < st) cm += 1440;
    const pace = i && cm != null ? paceStr((cm - st) / x.mile).replace(' /mi', '') : '';
    const s = S[x.station], last = i === q.length - 1, first = i === 0;
    return `<tr><td>${esc(first ? 'Start' : last ? 'Finish' : s.name)}</td><td class="n">${x.mile.toFixed(1)}</td><td class="n">${prev}</td><td class="n">${next}</td><td class="n">${gainAt(x.mile, last).toLocaleString('en-US')}</td><td class="n">${esc(first ? `start ${sh(C.start)}` : x.cutoff === 'TBD' ? '—' : sh(x.cutoff))}</td><td class="n">${pace}</td></tr>`;
  }).join('');
  return `<table class="cuttab"><thead><tr><th>Station</th><th class="n">Mile</th><th class="n"><span class="fu">From prev.</span><span class="ab">Prev</span></th><th class="n"><span class="fu">To next</span><span class="ab">Next</span></th><th class="n"><span class="fu">Gain (ft)</span><span class="ab">Gain</span></th><th class="n">Cutoff</th><th class="n">Pace</th></tr></thead><tbody>${body}</tbody></table>`;
}
/** "10:30 AM" -> "10:30a" */
const sh = (t: string) => t.replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
export const TABLE_NOTE = 'Miles measured on each course GPX (the route of record). “Pace” = overall average min/mi from the start to reach that station by its cutoff (aid-station time included). “—” = no cutoff at that visit. Cutoffs: revised race sheet.';
