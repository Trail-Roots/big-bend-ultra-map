import { milestones } from '../lib/milestones';
import { routeSeqPage } from '../lib/routeseq';
// One landscape letter page per race (100K -> 10K): left half its own race map (only that route), right half its header, elevation
// profile and GPX distance / cutoff matrix. In the main PDF after page 1; each also prints alone as course-<k>.pdf.
import { esc, f1, station, BAND_OP } from '../lib/util';
import { miniBibSvg } from '../lib/panels';
import { courseTable, totalGain } from '../lib/coursetable';
import { renderRaceMap } from '../lib/racemap';
import { SITE_URL } from './10-map';
import { icon } from '../lib/icons';
import { renderRaceHeat } from '../lib/timeline';
import siteCfg from '../../content/site.json';
/** card thumbnail: the race's own map in the established race-map style (ids made unique) */
const thumb = (c, k: string) => uniq(renderRaceMap(c, k, true), `card${k}`).replace('class="racemap"', 'class="racemap rc-map"').replace(/ data-race="[^"]*"/, '');
function card(c, k: string) {
  const C = c.courses.courses[k], cc = c.courses.colors[k], club = (siteCfg as any).stravaClub as string;
  return `<article class="racecard" data-course="${k}" style="--rc:${cc}"><div class="rc-media"><button type="button" class="rc-open" data-course="${k}" aria-label="Open the full ${k} race page">${thumb(c, k)}</button><button type="button" class="rc-open rc-full" data-course="${k}">${icon('expand')}Full page</button></div>
<div class="rc-body"><h3 class="bibh">${miniBibSvg(k, cc, 0.8)}<span>Big Bend Ultra ${k}</span></h3>
<dl class="rc-stats"><div><dt>Distance</dt><dd>${C.distance_mi.toFixed(1)} mi</dd></div><div><dt>Elev gain</dt><dd>${totalGain(c, k).toLocaleString('en-US')} ft</dd></div><div><dt>Start</dt><dd>${esc(C.start)}</dd></div></dl>
<div class="rc-btns"><a href="${SITE_URL}${esc(C.gpx)}" download title="Download the ${k} GPX">${icon('route')}.GPX</a>${C.stravaUrl ? `<span class="splitbtn"><a href="${esc(C.stravaUrl)}" target="_blank" rel="noopener" title="${k} route on Strava (opens the Strava app on a phone)">${icon('strava')}Strava</a>${club ? `<a href="${esc(club)}" target="_blank" rel="noopener" title="Trail Roots club on Strava">Join our club</a>` : ''}</span>` : ''}</div></div></article>`;
}
export const meta = { id: 'courses', title: 'Race pages' };
const uniq = (svg: string, k: string) => svg.replace(/\bid="([^"]+)"/g, `id="$1-cp${k}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-cp${k})`).replace('class="mini"', 'class="mini mini-cp"').replace(/ data-mini="[^"]*"/, '');
function profile(c, k: string) {
  const p = c.profiles[k], col = c.colors, cc = c.courses.colors[k], D = c.courses.courses[k].distance_mi, W = 900, H = 420, PL = 70, PB = 34;
  const lo = Math.floor((Math.min(...p.ft) - 150) / 500) * 500, hi = Math.ceil((Math.max(...p.ft) + 250) / 500) * 500;
  const X = (m: number) => PL + (m / D) * (W - PL - 10), Y = (ft: number) => 10 + (1 - (ft - lo) / (hi - lo)) * (H - PB - 10);
  let s = `<rect width="${W}" height="${H}" fill="${col.cream}"/>`;
  for (let t = lo; t <= hi; t += 500) s += `<path d="M${PL},${f1(Y(t))}H${W - 10}" stroke="#d9d9d9"/><text x="0" y="${f1(Y(t) + 6)}" font-size="17" text-anchor="start" fill="${col.ink}">${t.toLocaleString('en-US')}</text>`;
  const step = D > 30 ? 10 : D > 15 ? 5 : 1;
  for (let v = 0; v <= D + 1e-6; v += step) s += `<path d="M${f1(X(v))},${H - PB}v8" stroke="${col.ink}"/><text x="${f1(X(v))}" y="${H - 8}" font-size="17" text-anchor="middle" fill="${col.ink}">${v} mi</text>`;
  const pts = p.mi.map((m: number, i: number) => `${f1(X(m))},${f1(Y(p.ft[i]))}`);
  s += `<path d="M${f1(X(0))},${H - PB}L${pts.join('L')}L${f1(X(p.mi[p.mi.length - 1]))},${H - PB}z" fill="${cc}" fill-opacity="${BAND_OP}"/><path d="M${pts.join('L')}" class="ln" stroke="${cc}" stroke-width="3.5"/>`;
  const ftAt = (m: number) => { let i = p.mi.findIndex((x: number) => x >= m); if (i < 0) i = p.mi.length - 1; return p.ft[i]; };
  // station icons straight above their mileage on a vertical stub; an icon that would hit an earlier one steps up a tier (never sideways)
  const IR = Math.sqrt(600 * 1.8) / 2, ipos: number[][] = [];
  for (const q of c.cutoffs[k]) { const x = X(q.mile), ly = Y(ftAt(q.mile)); let y = ly - 26; while (ipos.some(([px, py]) => Math.abs(px - x) < 2 * IR + 2 && Math.abs(py - y) < 2 * IR + 2)) y -= 2 * IR + 4; ipos.push([x, y]);
    s += `<path d="M${f1(x)},${f1(y + 12)}V${f1(ly)}" stroke="${col.ink}" stroke-width="1.5"/>` + station(x, y, q.station, c.stations.stations[q.station].spectator, { s: 600, fs: 19, badge: false, colors: col }); }
  // cutoff labels: a small time pill centered over each aid-station icon with a cutoff on this race, joined to the icon by a thin
  // dashed guide; staggered up a row at a time until pill + guide clear every other label/guide, every icon and the profile line (build fails otherwise)
  type Bx = { x0: number; x1: number; y0: number; y1: number }; const hit = (a: Bx, b: Bx, m = 2) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
  const icons: Bx[] = ipos.map(([x, y]) => ({ x0: x - IR, x1: x + IR, y0: y - IR, y1: y + IR }));
  const linePts = p.mi.map((m: number, i: number) => [X(m), Y(p.ft[i])]), fl: Bx[] = [], guides: Bx[] = [], FS = 15;
  const shc = (t: string) => t.replace(/:00 ?([AP])M$/, (_, a) => a.toLowerCase()).replace(/ ?([AP])M$/, (_, a) => a.toLowerCase());
  for (const q of c.cutoffs[k]) { if (!(q.mile > 0) || !q.cutoff || q.cutoff === 'TBD') continue;
    const t = shc(q.cutoff), w = 14 + t.length * FS * 0.6, h = 22, x = X(q.mile), gy = ipos[c.cutoffs[k].indexOf(q)][1] - IR - 1; let done = false;
    for (let row = 0; row < 14 && !done; row++) { const x0 = Math.min(W - 10 - w, Math.max(PL + 2, x - w / 2)), y1 = gy - 12 - row * (h + 4), b = { x0, x1: x0 + w, y0: y1 - h, y1 }, g = { x0: x - 1, x1: x + 1, y0: y1, y1: gy };
      if (b.y0 < 3 || [...fl, ...guides].some((o) => hit(o, b)) || fl.some((o) => hit(o, g, 1)) || icons.some((o) => hit(o, b, 1)) || linePts.some(([px, py]: number[]) => px > b.x0 - 2 && px < b.x1 + 2 && py > b.y0 - 2 && py < b.y1 + 2)) continue;
      fl.push(b); guides.push(g); done = true;
      s += `<g class="cpcut"><path d="M${f1(x)},${f1(gy)}V${f1(y1)}" stroke="${col.ink}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="3 3"/><rect x="${f1(b.x0)}" y="${f1(b.y0)}" width="${f1(w)}" height="${h}" rx="${h / 2}" fill="#fff" stroke="${cc}" stroke-width="1.5"/><text x="${f1(b.x0 + w / 2)}" y="${f1(b.y1 - 6)}" font-size="${FS}" font-weight="600" text-anchor="middle" fill="${col.ink}">${t}</text></g>`; }
    if (!done) throw new Error(`[${k} profile] no clear spot for the ${t} cutoff label at mi ${q.mile}`); }
  console.log(`  profile ${k}: ${fl.length} cutoff labels placed, no overlaps`);
  return `<svg class="cprofile" data-course="${k}" data-pl="${PL}" data-w="${W}" data-h="${H}" data-pb="${PB}" data-d="${D}" data-lo="${lo}" data-hi="${hi}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k} elevation profile">${s}</svg>`;
}
export function render(c) {
  const nav = c.courses.order.map((k) => `<a href="#course-${k}" style="color:${c.courses.colors[k]}">${miniBibSvg(k, c.courses.colors[k], 0.7)}</a>`).join('');
  const pages = c.courses.order.map((k) => {
    const C = c.courses.courses[k];
    return `<article class="doc coursepage" id="course-${k}" data-course="${k}"><figure class="cpmap">${renderRaceMap(c, k)}</figure><div class="cpright"><header class="cphead"><h2 class="bibh" style="color:${c.courses.colors[k]}">${miniBibSvg(k, c.courses.colors[k], 1)} ${C.distance_mi.toFixed(1)} mi · ${totalGain(c, k).toLocaleString('en-US')} ft gain · start ${esc(C.start)}</h2><span class="cplinks">${C.stravaUrl ? `<a href="${esc(C.stravaUrl)}" target="_blank" rel="noopener" title="${k} route on Strava">${icon('strava')}Strava</a>` : ''}</span><span class="ui cpbtns"><button type="button" class="printone" data-course="${k}">${icon('printer')}Print this course</button><a href="course-${k}.pdf" download aria-label="${k} course page (PDF)">${icon('filedown')}PDF</a></span></header>
${profile(c, k)}${milestones(c, k)}${courseTable(c, k)}<figure class="cpheat"><figcaption>Busiest times at ${k} aid stations · cutoffs</figcaption>${renderRaceHeat(c, k)}</figure></div></article>${routeSeqPage(c, k)}`;
  }).join('');
  void nav;
  // web: compact Strava-style race cards; each opens its full (print-view) race page in a lightbox. Print / PDF: the full pages, unchanged order.
  return `<div class="ui racecards" role="list">${c.courses.order.map((k) => card(c, k)).join('')}</div><div class="cppages">${pages}</div>
<dialog class="lightbox" id="racebox" aria-label="Race page"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body"></div></dialog>`;
}
