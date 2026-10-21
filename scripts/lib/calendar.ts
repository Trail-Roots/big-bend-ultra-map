// Public race calendar ('Race: Big Bend Ultra', Google Calendar) — authoritative for locations and times.
// The build refreshes sources/calendar.ics from the public ICS feed when online and falls back to the committed snapshot.
import fs from 'node:fs';
import path from 'node:path';
export const CAL_ID = '675efabb5ff401596e499389adb77be58a5188d1ad975215381d536259ee1546@group.calendar.google.com';
export const CAL_ICS = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`;
export type CalEvent = { summary: string; start: Date | null; end: Date | null; location: string; description: string };
export async function loadCalendar(srcDir: string): Promise<{ events: CalEvent[]; fetched: boolean }> {
  const f = path.join(srcDir, 'calendar.ics'); let fetched = false;
  try { const r = await fetch(CAL_ICS, { signal: AbortSignal.timeout(15000) }); if (r.ok) { const t = await r.text(); if (t.includes('BEGIN:VCALENDAR')) { fs.writeFileSync(f, t); fetched = true; } } } catch { /* offline: use snapshot */ }
  const t = fs.readFileSync(f, 'utf8').replace(/\r?\n[ \t]/g, '');
  const un = (s: string) => s.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, '\n').replace(/\\\\/g, '\\');
  const dt = (v: string | undefined) => { if (!v) return null; const m = v.match(/(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?/); if (!m) return null; return m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))) : new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0) + 6, +(m[5] ?? 0))); }; // floating/TZID times are Central (CST, UTC-6 in January)
  // every VEVENT; recurring events (RRULE: DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL, BYDAY for WEEKLY; EXDATE) are
  // expanded into their occurrences, and a RECURRENCE-ID instance replaces the occurrence it overrides. Open-ended rules stop 3 years after
  // the fetch (the only bound; there is no other date window or event-type filter here).
  const HORIZON = Date.now() + 3 * 365 * 864e5, DOWS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  type Raw = CalEvent & { uid: string; rid: number | null; rrule: string; ex: number[] };
  const raw: Raw[] = t.split('BEGIN:VEVENT').slice(1).map((b) => { b = b.split('END:VEVENT')[0]; const g = (k: string) => b.match(new RegExp(`^${k}(?:;[^:]*)?:(.*)$`, 'm'))?.[1];
    const ex = [...b.matchAll(/^EXDATE(?:;[^:]*)?:(.*)$/gm)].flatMap((m) => m[1].split(',')).map((v) => dt(v.trim())?.getTime() ?? NaN).filter((v) => !isNaN(v));
    return { summary: un(g('SUMMARY') ?? '').trim(), start: dt(g('DTSTART')), end: dt(g('DTEND')), location: un(g('LOCATION') ?? '').trim(), description: un(g('DESCRIPTION') ?? '').trim(),
      uid: g('UID') ?? '', rid: dt(g('RECURRENCE-ID'))?.getTime() ?? null, rrule: g('RRULE') ?? '', ex }; });
  const overrides = new Map(raw.filter((e) => e.rid != null).map((e) => [e.uid + '@' + e.rid, e]));
  const events: CalEvent[] = [];
  const out = (e: Raw): CalEvent => ({ summary: e.summary, start: e.start, end: e.end, location: e.location, description: e.description });
  for (const e of raw) { if (e.rid != null) continue; if (!e.rrule || !e.start) { events.push(out(e)); continue; }
    const R = Object.fromEntries(e.rrule.split(';').map((kv) => kv.split('='))), iv = +(R.INTERVAL || 1), count = R.COUNT ? +R.COUNT : Infinity, until = R.UNTIL ? dt(R.UNTIL)!.getTime() : HORIZON;
    const dur = e.end ? +e.end - +e.start : 0, by = R.BYDAY ? R.BYDAY.split(',').map((d: string) => DOWS.indexOf(d.slice(-2))) : null; let n = 0;
    const emit = (d: Date) => { const k = d.getTime(); if (k > until || n >= count) return false; n++; if (!e.ex.includes(k)) { const o = overrides.get(e.uid + '@' + k); events.push(o ? out(o) : { ...out(e), start: d, end: e.end ? new Date(k + dur) : null }); } return true; };
    const s0 = e.start;
    for (let i = 0; i < 5000; i++) { const d = new Date(s0);
      if (R.FREQ === 'DAILY') d.setUTCDate(d.getUTCDate() + i * iv);
      else if (R.FREQ === 'WEEKLY') { d.setUTCDate(d.getUTCDate() + i * 7 * iv); if (by) { let go = true; const wk = new Date(d); wk.setUTCDate(wk.getUTCDate() - wk.getUTCDay());
          for (const w of by.sort()) { const x = new Date(wk); x.setUTCDate(wk.getUTCDate() + w); if (x < s0) continue; if (!emit(x)) { go = false; break; } } if (!go) break; continue; } }
      else if (R.FREQ === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + i * iv);
      else if (R.FREQ === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + i * iv);
      else { events.push(out(e)); break; }
      if (!emit(d)) break; } }
  // a RECURRENCE-ID instance whose series is missing still counts as an event
  for (const o of overrides.values()) if (!raw.some((e) => e.rid == null && e.uid === o.uid && e.rrule)) events.push(out(o));
  return { events, fetched };
}
/** minutes after midnight Jan 17 2027 Central (CST = UTC-6) */
export const raceMin = (d: Date) => (d.getTime() - Date.UTC(2027, 0, 17, 6, 0)) / 60000;
export const inRaceYear = (e: CalEvent) => !!e.start && e.start.getUTCFullYear() >= 2027 && raceMin(e.start) > -2000 && raceMin(e.start) < 3000;
