// Bib lookup data from the public RunSignup REST API (race 163892): per year and event, [bib, finish seconds | null, status].
// No names, ages or places of residence are stored. bun scripts/fetch-bibs.ts -> sources/results/bibs-163892.json
import fs from 'node:fs';
import path from 'node:path';
const RACE = 163892, API = 'https://runsignup.com/Rest/race';
const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<any>; };
const sec = (t: unknown) => { if (typeof t !== 'string' || !/^\d+:\d\d(:\d\d)?(\.\d+)?$/.test(t)) return null; const p = t.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + Math.round(p[2]) : p[0] * 60 + Math.round(p[1]); };
const race = (await get(`${API}/${RACE}?format=json&future_events_only=F&most_recent_events_only=F`)).race;
const years: Record<string, Record<string, [number, number | null, string][]>> = {};
for (const e of race.events) {
  const year = Number(e.start_time.split(' ')[0].split('/')[2]); if (year >= 2027) continue;
  const rows: [number, number | null, string][] = [];
  for (let page = 1; ; page++) {
    const d = await get(`${API}/${RACE}/results/get-results?format=json&event_id=${e.event_id}&results_per_page=500&page=${page}`); let n = 0;
    for (const s of (d.individual_results_sets ?? []).slice(0, 1)) {
      const stKey = Object.entries(s.results_headers ?? {}).find(([, v]) => /status/i.test(String(v)))?.[0];
      for (const r of s.results) { n++; if (r.bib == null || r.bib === '') continue; const st = stKey ? String(r[stKey] ?? '') : ''; const t = /dnf|dns|dq/i.test(st) ? null : sec(r.chip_time) ?? sec(r.clock_time); rows.push([Number(r.bib), t, t ? 'Finished' : st || 'No time']); }
    }
    if (n < 500) break;
  }
  (years[year] ??= {})[e.name.toUpperCase().replace(/\s+/g, '')] = rows;
  console.log(year, e.name, rows.length);
}
fs.writeFileSync(path.join(import.meta.dir, '..', 'sources', 'results', `bibs-${RACE}.json`), JSON.stringify({ source: `RunSignup public REST API, race ${RACE}`, fetched: new Date().toISOString(), years }) + '\n');
