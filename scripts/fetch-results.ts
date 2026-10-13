// Fetch Big Bend Ultra historical results from the public RunSignup REST API (race 163892) and store an
// anonymised snapshot: per event and result set, finish times in seconds + status counts. No names/bibs kept.
// bun scripts/fetch-results.ts  -> sources/results/runsignup-163892.json
import fs from 'node:fs';
import path from 'node:path';
const RACE = 163892, API = 'https://runsignup.com/Rest/race';
const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<any>; };
const sec = (t: string | null) => { if (!t || typeof t !== 'string' || !/^\d+:\d\d(:\d\d)?(\.\d+)?$/.test(t)) return null; const p = t.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
const race = (await get(`${API}/${RACE}?format=json&future_events_only=F&most_recent_events_only=F&include_participant_caps=T`)).race;
const events: any[] = [];
for (const e of race.events) {
  const year = Number(e.start_time.split(' ')[0].split('/')[2]);
  const ev: any = { event_id: e.event_id, year, name: e.name, start_time: e.start_time, distance: e.distance, participant_cap: e.participant_cap ?? null, result_sets: [] };
  if (year < 2027) {
    let page = 1; const sets = new Map<number, any>();
    for (;;) {
      const d = await get(`${API}/${RACE}/results/get-results?format=json&event_id=${e.event_id}&results_per_page=500&page=${page}`);
      let n = 0;
      for (const s of d.individual_results_sets ?? []) {
        const statusKey = Object.entries(s.results_headers ?? {}).find(([, v]) => /status/i.test(String(v)))?.[0];
        const lapKeys = Object.entries(s.results_headers ?? {}).filter(([, v]) => /^(lap|split)\b/i.test(String(v))).map(([k]) => k);
        const cur = sets.get(s.individual_result_set_id) ?? { id: s.individual_result_set_id, name: s.individual_result_set_name, finish_s: [] as number[], status: {} as Record<string, number>, rows: 0, lap_names: lapKeys.map((k) => s.results_headers[k]), splits: [] as { finish_s: number; laps: (number | null)[] }[] };
        for (const r of s.results) {
          n++; cur.rows++;
          const st = statusKey ? String(r[statusKey] ?? '') : '';
          if (st) cur.status[st] = (cur.status[st] ?? 0) + 1;
          const t = sec(r.chip_time) ?? sec(r.clock_time);
          if (t && t > 0 && !/dnf|dns|dq/i.test(st)) { cur.finish_s.push(t); if (lapKeys.length) cur.splits.push({ finish_s: t, laps: lapKeys.map((k) => sec(r[k])) }); }
        }
        sets.set(s.individual_result_set_id, cur);
      }
      if (n < 500) break; page++;
    }
    ev.result_sets = [...sets.values()].map((s) => ({ ...s, finish_s: s.finish_s.sort((a: number, b: number) => a - b) }));
  }
  events.push(ev);
  console.log(ev.year, ev.name, ev.result_sets.map((s: any) => `${s.name}: ${s.finish_s.length}/${s.rows} ${JSON.stringify(s.status)}`).join(' | '));
}
const out = { source: `RunSignup public REST API, race ${RACE} (${API}/${RACE}/results/get-results)`, fetched: new Date().toISOString(), events };
fs.writeFileSync(path.join(import.meta.dir, '..', 'sources', 'results', `runsignup-${RACE}.json`), JSON.stringify(out) + '\n');
