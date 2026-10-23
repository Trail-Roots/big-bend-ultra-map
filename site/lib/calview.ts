// Race-day calendar viewer (our own; no third-party branding). Data: content/calendar.json, written by scripts/content.ts from the
// authoritative race calendar (sources/calendar.ics). Minutes are relative to midnight Jan 17 2027 Central (race day).
// ONE fixed structure, never dependent on today's date:
//  - web (site + embed): event-to-event AGENDA, grouped under a header per day (same structure every day); app.ts hides events that are
//    already over (from the current moment forward) and day headers left empty
//  - print / PDF: hour-by-hour TIME GRID from race day forward (race-day start → last event), day dividers at midnight
import type { Ctx } from './types';
import { esc } from './util';
export const MINDUR = 30; // shortest drawn block (minutes) in the print grid
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** day index relative to race day (0 = Sat Jan 17 2027) → "Sat, Jan 17" */
const dayName = (d: number) => { const t = new Date(Date.UTC(2027, 0, 17 + d)); return `${DOW[t.getUTCDay()]}, ${MON[t.getUTCMonth()]} ${t.getUTCDate()}`; };
const dayOf = (m: number) => Math.floor(m / 1440);
export const hm = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440, h = Math.floor(x / 60), mi = x % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const hr = (m: number) => { const h = Math.floor((((m % 1440) + 1440) % 1440) / 60); return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };
type E = { s: string; a: number; b: number | null; loc: string; d?: string };
/** Google Calendar description (HTML or plain text) -> safe HTML: only a[href http(s)/mailto] (new tab), br, p, b/strong/i/em/u, ul/ol/li; all other tags dropped (text kept), text escaped */
export function safeDesc(raw: string) {
  const ok = new Set(['br', 'p', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li']); let out = '', open: string[] = [];
  const src = /<[a-z!\/]/i.test(raw) ? raw : raw.replace(/\n/g, '<br>');
  for (const m of src.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+|<)/gi)) {
    if (m[4] != null) { out += esc(m[4].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")); continue; }
    const cl = m[1] === '/', t = m[2].toLowerCase();
    if (t === 'a') { if (cl) { if (open.includes('a')) { out += '</a>'; open.splice(open.lastIndexOf('a'), 1); } continue; }
      const h = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(m[3]), u = (h?.[1] ?? h?.[2] ?? '').replace(/&amp;/g, '&').trim();
      if (/^(https?:|mailto:)/i.test(u)) { out += `<a href="${esc(u)}" target="_blank" rel="noopener">`; open.push('a'); } continue; }
    if (!ok.has(t)) continue; if (t === 'br') { out += '<br>'; continue; }
    if (cl) { const i = open.lastIndexOf(t); if (i >= 0) { out += open.splice(i).reverse().map((x) => `</${x}>`).join(''); } } else { out += `<${t}>`; open.push(t); } }
  return out + open.reverse().map((x) => `</${x}>`).join('');
}
const mapsUrl = (l: string) => `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(l)}`;
const allDay = (e: E) => e.b != null && e.b - e.a >= 1440;
const when = (e: E) => allDay(e) ? 'All day' : e.b != null && e.b > e.a ? `${hm(e.a)} – ${hm(e.b)}` : hm(e.a);
/** location text: coordinates or the first part of a street address */
const place = (l: string) => l ? (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(l) ? l.split(',').map((v) => (+v).toFixed(5)).join(', ') : l.split(',').slice(0, 2).join(',')) : '';
export function renderCalendar(c: Ctx) {
  const ev = (c.calendar.events as E[]).slice().sort((x, y) => x.a - y.a || x.s.localeCompare(y.s));
  const race = (s: string) => c.courses.order.find((k) => new RegExp(`\\b${k}\\b`).test(s));
  const tip = (e: E) => esc([e.s, dayName(dayOf(e.a)) + ' · ' + when(e) + (allDay(e) ? '' : ' CT'), place(e.loc)].filter(Boolean).join('\n'));
  const attrs = (e: E, sty = true) => { const k = race(e.s); return ` data-a="${e.a}" data-b="${e.b ?? e.a}" data-tip="${tip(e)}" tabindex="0"${k && sty ? ` style="--rc:${c.courses.colors[k]}"` : ''}`; };
  // ---- web: agenda, one group per day ----
  const days = [...new Set(ev.map((e) => dayOf(e.a)))].sort((a, b) => a - b);
  const agenda = days.map((d) => `<section class="cv-dgrp" data-day="${d}"><h3 class="cv-day">${dayName(d)}${d === 0 ? ' · race day' : ''}</h3><ol>${ev.filter((e) => dayOf(e.a) === d).map((e) =>
    `<li class="cv-ev cv-item${race(e.s) ? ' cv-race' : ''}" data-race="${race(e.s) ?? ''}" role="button" aria-expanded="false"${attrs(e)}><span class="cv-t">${when(e)}</span><span class="cv-s">${esc(e.s)}</span>${e.loc ? `<span class="cv-l"><a class="cv-maplink" href="${mapsUrl(e.loc)}" target="_blank" rel="noopener">${esc(place(e.loc))}</a></span>` : ''}<div class="cv-det" hidden>${e.d ? `<div class="cv-desc">${safeDesc(e.d)}</div>` : ''}${e.loc ? `<p class="cv-dloc"><b>Location</b> <a class="cv-maplink" href="${mapsUrl(e.loc)}" target="_blank" rel="noopener">${esc(e.loc)}</a></p>` : ''}${!e.d && !e.loc ? '<p class="cv-dnone">No further details.</p>' : ''}</div></li>`).join('')}</ol></section>`).join('');
  // ---- print: hour-by-hour grid from race day forward ----
  const pe = ev.filter((e) => e.a >= 0 && e.a < 3000) /* print: race weekend only, as before */, timed = pe.filter((e) => !allDay(e)), alld = pe.filter(allDay);
  // one printed page per day (Erik): each page is that day's full 24 hours (12 AM - 12 AM) filling the page; overlap columns per day
  const end = (e: E) => Math.max(e.b ?? e.a, e.a + MINDUR);
  const pdays = [...new Set(pe.map((e) => dayOf(e.a)))].sort((x, y) => x - y);
  const dayPage = (d: number) => { const D0 = d * 1440, D1 = D0 + 1440, tm = timed.filter((e) => dayOf(e.a) === d), ad = alld.filter((e) => dayOf(e.a) === d), pos = new Map<E, { col: number; n: number }>();
    let cl: E[] = [], cend = -1e9; const cols: number[] = [];
    const flush = () => { const n = Math.max(1, ...cl.map((e) => pos.get(e)!.col + 1)); cl.forEach((e) => (pos.get(e)!.n = n)); cl = []; cols.length = 0; };
    for (const e of tm) { if (e.a >= cend && cl.length) flush(); let col = cols.findIndex((t) => t <= e.a); if (col < 0) { col = cols.length; cols.push(0); } cols[col] = end(e); pos.set(e, { col, n: 1 }); cl.push(e); cend = Math.max(cend, end(e)); }
    if (cl.length) flush();
    const Y = (m: number) => ((m - D0) / 60).toFixed(4), hours: number[] = []; for (let m = D0; m <= D1; m += 60) hours.push(m);
    const blocks = tm.map((e) => { const p = pos.get(e)!, dd = Math.min(end(e), D1) - e.a, k = race(e.s);
      return `<div class="cv-ev cv-blk${dd <= 45 ? ' cv-short' : ''}${k ? ' cv-race' : ''}"${attrs(e, false)} style="${k ? `--rc:${c.courses.colors[k]};` : ''}top:calc(${Y(e.a)} * var(--hh));height:calc(${(dd / 60).toFixed(4)} * var(--hh) - 2px);left:calc(${(p.col / p.n * 100).toFixed(3)}% + 1px);width:calc(${(100 / p.n).toFixed(3)}% - 3px)"><span class="cv-s">${esc(e.s).replace(/@/g, '@<wbr>')}</span><span class="cv-t">${when(e)}</span></div>`; }).join('');
    return `<div class="cv-dpage"><div class="cv-pday">${d !== pdays[0] ? "Race calendar (continued) · " : ""}${dayName(d)}${d === 0 ? ' · race day' : ''} · times CT</div>
    ${ad.map((e) => `<div class="cv-ev cv-allday"${attrs(e)}><span class="cv-t">All day</span><span class="cv-s">${esc(e.s)}</span></div>`).join('')}
    <div class="cv-grid" style="height:calc(24 * var(--hh))">
      ${hours.map((m) => `<div class="cv-hr${m === D0 || m === D1 ? ' cv-mid' : ''}" style="top:calc(${Y(m)} * var(--hh))"><span>${hr(m)}</span></div>`).join('')}
      <div class="cv-col">${blocks}</div>
    </div></div>`; };
  const grid = `<div class="cv-print">${pdays.map(dayPage).join('')}</div>`;
  return `<div class="cv">
  <div class="cv-head"><div class="cv-title"><b>Race calendar</b><span class="cv-date cv-web">Upcoming events · times CT</span><span class="cv-date cv-pr">From race day forward · times CT</span></div></div>
  <div class="cv-scroll" tabindex="0" aria-label="Race calendar events">${agenda}<p class="cv-empty" hidden>No upcoming events.</p></div>
  ${grid}
</div>`;
}
