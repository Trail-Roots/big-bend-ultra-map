// Race-day calendar viewer (our own, modelled on a calendar day / agenda view; no third-party branding).
// Data: content/calendar.json, written by scripts/content.ts from the authoritative race calendar (sources/calendar.ics).
// Minutes are relative to midnight Jan 17 2027 Central (race day). Day grid = race day 4a → 2a; earlier / later events are agenda lists.
import type { Ctx } from './types';
import { esc } from './util';
export const GRID0 = 240, GRID1 = 1560, MINDUR = 30; // grid window (minutes) and the shortest drawn block
const DAY = ['Fri, Jan 16', 'Sat, Jan 17', 'Sun, Jan 18'];
export const hm = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440, h = Math.floor(x / 60), mi = x % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const hr = (m: number) => { const h = Math.floor((((m % 1440) + 1440) % 1440) / 60); return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
type E = { s: string; a: number; b: number | null; loc: string };
const when = (e: E) => e.b != null && e.b > e.a ? `${hm(e.a)} – ${hm(e.b)}` : hm(e.a);
/** location text: coordinates or the first part of a street address */
const place = (l: string) => l ? (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(l) ? l.split(',').map((v) => (+v).toFixed(5)).join(', ') : l.split(',').slice(0, 2).join(',')) : '';
export function renderCalendar(c: Ctx) {
  const ev = (c.calendar.events as E[]).slice().sort((x, y) => x.a - y.a);
  const race = (s: string) => c.courses.order.find((k) => new RegExp(`\\b${k}\\b`).test(s));
  const tip = (e: E) => esc([e.s, (e.a < 0 ? DAY[0] : e.a >= 1440 ? DAY[2] : DAY[1]) + ' · ' + when(e) + ' CT', place(e.loc)].filter(Boolean).join('\n'));
  const attrs = (e: E, sty = true) => { const k = race(e.s); return ` data-a="${e.a}" data-b="${e.b ?? e.a}" data-tip="${tip(e)}" tabindex="0"${k && sty ? ` style="--rc:${c.courses.colors[k]}"` : ''}`; };
  const allday = ev.filter((e) => e.b != null && e.b - e.a >= 1440), timed = ev.filter((e) => !allday.includes(e));
  const before = timed.filter((e) => e.a < GRID0), grid = timed.filter((e) => e.a >= GRID0 && e.a < GRID1), after = timed.filter((e) => e.a >= GRID1);
  const agenda = (day: string, L: E[]) => !L.length ? '' : `<div class="cv-agenda"><div class="cv-day">${day}</div><ol>${L.map((e) => `<li class="cv-ev cv-item${race(e.s) ? ' cv-race' : ''}"${attrs(e)}><span class="cv-t">${when(e)}</span><span class="cv-s">${esc(e.s)}</span>${e.loc ? `<span class="cv-l">${esc(place(e.loc))}</span>` : ''}</li>`).join('')}</ol></div>`;
  // overlap packing (calendar style): clusters of overlapping blocks share the width, greedy columns inside a cluster
  const end = (e: E) => Math.max(e.b ?? e.a, e.a + MINDUR), pos = new Map<E, { col: number; n: number }>();
  let cl: E[] = [], cend = -1e9; const cols: number[] = [];
  const flush = () => { const n = Math.max(1, ...cl.map((e) => pos.get(e)!.col + 1)); cl.forEach((e) => (pos.get(e)!.n = n)); cl = []; cols.length = 0; };
  for (const e of grid) { if (e.a >= cend && cl.length) flush(); let col = cols.findIndex((t) => t <= e.a); if (col < 0) { col = cols.length; cols.push(0); } cols[col] = end(e); pos.set(e, { col, n: 1 }); cl.push(e); cend = Math.max(cend, end(e)); }
  if (cl.length) flush();
  const hours = []; for (let m = GRID0; m <= GRID1; m += 60) hours.push(m);
  const H = (GRID1 - GRID0) / 60;
  const blocks = grid.map((e) => { const p = pos.get(e)!, d = end(e) - e.a, short = d <= 45;
    return `<div class="cv-ev cv-blk${short ? ' cv-short' : ''}${race(e.s) ? ' cv-race' : ''}"${attrs(e, false)} style="${race(e.s) ? `--rc:${c.courses.colors[race(e.s)!]};` : ''}top:calc(${((e.a - GRID0) / 60).toFixed(4)} * var(--hh));height:calc(${(d / 60).toFixed(4)} * var(--hh) - 2px);left:calc(${(p.col / p.n * 100).toFixed(3)}% + 1px);width:calc(${(100 / p.n).toFixed(3)}% - 3px)"><span class="cv-s">${esc(e.s).replace(/@/g, "@<wbr>")}</span><span class="cv-t">${when(e)}</span></div>`; }).join('');
  return `<div class="cv" data-grid0="${GRID0}" data-grid1="${GRID1}">
  <div class="cv-head"><div class="cv-title"><b>Race-day calendar</b><span class="cv-date">${DAY[1]}, 2027 · times CT</span></div></div>
  <div class="cv-scroll" tabindex="0" aria-label="Race-day calendar events">
    ${agenda(DAY[0] + ' · day before', before)}
    <div class="cv-day cv-day-race">${DAY[1]} · race day</div>
    ${allday.map((e) => `<div class="cv-ev cv-allday"${attrs(e)}><span class="cv-t">All day</span><span class="cv-s">${esc(e.s)}</span></div>`).join('')}
    <div class="cv-grid" style="height:calc(${H} * var(--hh))">
      ${hours.map((m) => `<div class="cv-hr" style="top:calc(${((m - GRID0) / 60)} * var(--hh))"><span>${m === 1440 ? 'Sun 12 AM' : hr(m)}</span></div>`).join('')}
      <div class="cv-col">${blocks}<div class="cv-now" hidden></div></div>
    </div>
    ${agenda(DAY[2] + ' · day after', after)}
  </div>
</div>`;
}
