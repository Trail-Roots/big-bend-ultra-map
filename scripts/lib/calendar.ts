// Public race calendar ('Race: Big Bend Ultra', Google Calendar) — authoritative for locations and times.
// The build refreshes sources/calendar.ics from the public ICS feed when online and falls back to the committed snapshot.
import fs from 'node:fs';
import path from 'node:path';
export const CAL_ID = '675efabb5ff401596e499389adb77be58a5188d1ad975215381d536259ee1546@group.calendar.google.com';
export const CAL_ICS = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`;
export type CalEvent = { summary: string; start: Date | null; end: Date | null; location: string };
export async function loadCalendar(srcDir: string): Promise<{ events: CalEvent[]; fetched: boolean }> {
  const f = path.join(srcDir, 'calendar.ics'); let fetched = false;
  try { const r = await fetch(CAL_ICS, { signal: AbortSignal.timeout(15000) }); if (r.ok) { const t = await r.text(); if (t.includes('BEGIN:VCALENDAR')) { fs.writeFileSync(f, t); fetched = true; } } } catch { /* offline: use snapshot */ }
  const t = fs.readFileSync(f, 'utf8').replace(/\r?\n[ \t]/g, '');
  const un = (s: string) => s.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, '\n').replace(/\\\\/g, '\\');
  const dt = (v: string | undefined) => { if (!v) return null; const m = v.match(/(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?/); if (!m) return null; return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))) : new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0) + 6, +(m[5] ?? 0))); }; // floating/TZID times are Central (CST, UTC-6 in January)
  const events = t.split('BEGIN:VEVENT').slice(1).map((b) => { const g = (k: string) => b.match(new RegExp(`^${k}(?:;[^:]*)?:(.*)$`, 'm'))?.[1]; return { summary: un(g('SUMMARY') ?? '').trim(), start: dt(g('DTSTART')), end: dt(g('DTEND')), location: un(g('LOCATION') ?? '').trim() }; });
  return { events, fetched };
}
/** minutes after midnight Jan 17 2027 Central (CST = UTC-6) */
export const raceMin = (d: Date) => (d.getTime() - Date.UTC(2027, 0, 17, 6, 0)) / 60000;
export const inRaceYear = (e: CalEvent) => !!e.start && e.start.getUTCFullYear() >= 2027 && raceMin(e.start) > -2000 && raceMin(e.start) < 3000;
