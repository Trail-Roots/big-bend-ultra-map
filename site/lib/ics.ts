// Race-day calendar (.ics, RFC 5545) built from content: starts, aid-station visits with cutoffs, finish cutoffs,
// plus (all-races file) each aid station's open window. Times are wall-clock America/Chicago (TZID + VTIMEZONE),
// every event carries the place name, GEO coordinates and a Google Maps link so it works offline on a phone.
import { cutMin } from './timeline';
import type { Ctx } from './types';
const DAY = [2027, 1, 17];
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:America/Chicago', 'BEGIN:STANDARD', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'END:STANDARD', 'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'END:DAYLIGHT', 'END:VTIMEZONE'];
const p2 = (n: number) => String(n).padStart(2, '0');
/** minutes after midnight Jan 17 (may exceed 1440) -> local DATE-TIME */
const dt = (m: number) => { const d = new Date(Date.UTC(DAY[0], DAY[1] - 1, DAY[2]) + Math.round(m) * 60000); return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00`; };
const escT = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
/** fold to 75 octets per RFC 5545 */
const fold = (l: string) => { const b = Buffer.from(l, 'utf8'); if (b.length <= 75) return l; const out: string[] = []; let cur = '', n = 0, lim = 75; for (const ch of l) { const w = Buffer.byteLength(ch); if (n + w > lim) { out.push(cur); cur = ''; n = 0; lim = 74; } cur += ch; n += w; } out.push(cur); return out.join('\r\n '); };
const hm = (s: string) => { const m = s.trim().match(/^(\d+)(?::(\d\d))?([ap])$/)!; return (Number(m[1]) % 12 + (m[3] === 'p' ? 12 : 0)) * 60 + Number(m[2] ?? 0); };
type Ev = { uid: string; sum: string; a: number; b: number; st: string; desc: string };
export function buildIcs(c: Ctx, siteUrl: string) {
  const S = c.stations.stations, stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const place = (k: string) => { const s = S[k], [lon, lat] = s.lonlat; return { name: k === 'S/F' ? `${s.name} (Barton Warnock)` : `Aid ${k} · ${s.name}`, lat: lat.toFixed(6), lon: lon.toFixed(6), url: `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}` }; };
  const vev = (e: Ev) => { const p = place(e.st); return ['BEGIN:VEVENT', `UID:${e.uid}@big-bend-ultra-2027`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Chicago:${dt(e.a)}`, `DTEND;TZID=America/Chicago:${dt(e.b)}`, `SUMMARY:${escT(e.sum)}`, `LOCATION:${escT(`${p.name} — ${p.lat}, ${p.lon}`)}`, `GEO:${p.lat};${p.lon}`, `DESCRIPTION:${escT(`${e.desc}\n${p.name}\nGPS ${p.lat}, ${p.lon}\nMap: ${p.url}\nAll times Central (CST). Course map: ${siteUrl}`)}`, `URL:${p.url}`, 'END:VEVENT']; };
  const cal = (name: string, evs: Ev[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trail Roots//Big Bend Ultra 2027//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escT(name)}`, 'X-WR-TIMEZONE:America/Chicago', ...VTZ, ...evs.flatMap(vev), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  const courseEvents = (k: string): Ev[] => {
    const cuts = c.cutoffs[k], start = cutMin(c.courses.courses[k].start)!, last = cuts.length - 1, ev: Ev[] = [];
    ev.push({ uid: `${k}-start`, sum: `BBU ${k} start`, a: start, b: start + 15, st: 'S/F', desc: `${k} (${c.courses.courses[k].distance_mi} mi) start ${c.courses.courses[k].start}.` });
    cuts.forEach((q, i) => {
      if (i === 0) return; const t0 = cutMin(q.cutoff), t = t0 == null ? null : t0 < start ? t0 + 1440 : t0, name = S[q.station].name;
      if (i === last) { if (t != null) ev.push({ uid: `${k}-finish`, sum: `BBU ${k} finish cutoff`, a: t, b: t + 15, st: q.station, desc: `${k} finish cutoff ${q.cutoff} at mile ${q.mile}.` }); return; }
      if (t == null) return; // TBD cutoffs get no calendar entry
      ev.push({ uid: `${k}-cut-${i}`, sum: `BBU ${k} cutoff · ${name} (mi ${q.mile})`, a: t, b: t + 15, st: q.station, desc: `${k} cutoff at aid station ${q.station} ${name}, mile ${q.mile}: ${q.cutoff}.` });
    });
    return ev;
  };
  const stationEvents: Ev[] = c.stations.order.filter((k: string) => S[k].hours).map((k: string) => { const [a, b0] = S[k].hours.split('-').map(hm), b = b0 < a ? b0 + 1440 : b0; return { uid: `station-${k}`, sum: `BBU aid station open · ${S[k].name}`, a, b, st: k, desc: `${k === 'S/F' ? 'Start / Finish' : `Aid station ${k} ${S[k].name}`} open ${S[k].hours}.` }; });
  const files: Record<string, string> = {};
  for (const k of c.courses.order) files[`calendar/big-bend-ultra-2027-${k.toLowerCase()}.ics`] = cal(`Big Bend Ultra 2027 · ${k}`, courseEvents(k));
  files['calendar/big-bend-ultra-2027-all.ics'] = cal('Big Bend Ultra 2027 · all races', [...c.courses.order.flatMap(courseEvents), ...stationEvents]);
  return files;
}
