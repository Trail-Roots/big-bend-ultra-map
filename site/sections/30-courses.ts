// One landscape letter page per race (100K -> 10K): left half its own race map (only that route), right half its header, elevation
// profile and GPX distance / cutoff matrix. In the main PDF after page 1; each also prints alone as course-<k>.pdf.
import { esc, f1, station } from '../lib/util';
import { miniBibSvg } from '../lib/panels';
import { courseTable, TABLE_NOTE } from '../lib/coursetable';
import { renderRaceMap } from '../lib/racemap';
export const meta = { id: 'courses', title: 'Race pages' };
const uniq = (svg: string, k: string) => svg.replace(/\bid="([^"]+)"/g, `id="$1-cp${k}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-cp${k})`).replace('class="mini"', 'class="mini mini-cp"').replace(/ data-mini="[^"]*"/, '');
function profile(c, k: string) {
  const p = c.profiles[k], col = c.colors, cc = c.courses.colors[k], D = c.courses.courses[k].distance_mi, W = 900, H = 420, PL = 70, PB = 34;
  const lo = Math.floor((Math.min(...p.ft) - 150) / 500) * 500, hi = Math.ceil((Math.max(...p.ft) + 250) / 500) * 500;
  const X = (m: number) => PL + (m / D) * (W - PL - 10), Y = (ft: number) => 10 + (1 - (ft - lo) / (hi - lo)) * (H - PB - 10);
  let s = `<rect width="${W}" height="${H}" fill="${col.cream}"/>`;
  for (let t = lo; t <= hi; t += 500) s += `<path d="M${PL},${f1(Y(t))}H${W - 10}" stroke="#d8d0c0"/><text x="4" y="${f1(Y(t) + 6)}" font-size="17" text-anchor="start" fill="${col.ink}">${t.toLocaleString('en-US')}</text>`;
  const step = D > 30 ? 10 : D > 15 ? 5 : 1;
  for (let v = 0; v <= D + 1e-6; v += step) s += `<path d="M${f1(X(v))},${H - PB}v8" stroke="${col.ink}"/><text x="${f1(X(v))}" y="${H - 8}" font-size="17" text-anchor="middle" fill="${col.ink}">${v} mi</text>`;
  const pts = p.mi.map((m: number, i: number) => `${f1(X(m))},${f1(Y(p.ft[i]))}`);
  s += `<path d="M${f1(X(0))},${H - PB}L${pts.join('L')}L${f1(X(p.mi[p.mi.length - 1]))},${H - PB}z" fill="${cc}" fill-opacity=".15"/><path d="M${pts.join('L')}" class="ln" stroke="${cc}" stroke-width="3.5"/>`;
  const ftAt = (m: number) => { let i = p.mi.findIndex((x: number) => x >= m); if (i < 0) i = p.mi.length - 1; return p.ft[i]; };
  for (const q of c.cutoffs[k]) { const x = X(q.mile), y = Y(ftAt(q.mile)) - 26; s += `<path d="M${f1(x)},${f1(y + 12)}V${f1(Y(ftAt(q.mile)))}" stroke="${col.ink}" stroke-width="1.5"/>` + station(x, y, q.station, c.stations.stations[q.station].spectator, { s: 600, fs: 19, badge: false, colors: col }); }
  return `<svg class="cprofile" data-course="${k}" data-pl="${PL}" data-w="${W}" data-h="${H}" data-pb="${PB}" data-d="${D}" data-lo="${lo}" data-hi="${hi}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} elevation profile">${s}</svg>`;
}
export function render(c) {
  const nav = c.courses.order.map((k) => `<a href="#course-${k}" style="color:${c.courses.colors[k]}">${miniBibSvg(k, c.courses.colors[k], 0.7)}</a>`).join('');
  const pages = c.courses.order.map((k) => {
    const C = c.courses.courses[k];
    return `<article class="doc coursepage" id="course-${k}" data-course="${k}"><figure class="cpmap">${renderRaceMap(c, k)}</figure><div class="cpright"><header class="cphead"><h2 class="bibh" style="color:${c.courses.colors[k]}">${miniBibSvg(k, c.courses.colors[k], 1)} ${C.distance_mi.toFixed(1)} mi · start ${esc(C.start)}</h2><span class="ui cpbtns"><button type="button" class="printone" data-course="${k}">Print this course</button><a href="course-${k}.pdf" download aria-label="${k} course page (PDF)">PDF</a></span></header>
${profile(c, k)}<p class="note">${TABLE_NOTE}</p>${courseTable(c, k)}</div></article>`;
  }).join('');
  return `<nav class="ui cpnav"><strong>Course pages</strong> ${nav}</nav>${pages}`;
}
