// Race-day temperatures, every past Big Bend Ultra (race dates from the RunSignup API, race 163892: /Rest/race/163892?most_recent_events_only=F),
// hourly 2 m air temperature at the Start / Finish (Barton Warnock) from the Open-Meteo historical archive (ERA5 reanalysis), shifted to CST (UTC-6).
// Writes sources/curated/race-temps.json { source, years: [{ year, date, hourly: [[min after race-day 00:00 CST, °F]] }], summary: [[min, min°F, median°F, max°F]] }
// and sources/curated/race-temps.csv (one row per year, one column per hour). Last 10 race years (all available if fewer). Run: bun scripts/fetch-race-temps.ts
import fs from 'node:fs';
const [lat, lon] = [29.270545, -103.757135];
const race = await (await fetch('https://runsignup.com/Rest/race/163892?format=json&most_recent_events_only=F')).json();
const today = new Date().toISOString().slice(0, 10);
const dates = [...new Set<string>(race.race.events.map((e: any) => { const [m, d, y] = e.start_time.split(' ')[0].split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }))].filter((d) => d < today).sort().slice(-10);
const years: { year: number; date: string; hourly: number[][] }[] = [];
for (const date of dates) {
  const [y, m, d] = date.split('-').map(Number), base = Date.UTC(y, m - 1, d, 6), next = new Date(base + 2 * 86400000).toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${next}&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=GMT`;
  const j = await (await fetch(url)).json();
  const hourly = j.hourly.time.map((t: string, i: number) => [Math.round((Date.parse(t + 'Z') - base) / 60000), j.hourly.temperature_2m[i]]).filter(([mm, v]: number[]) => mm >= 0 && mm <= 1800 && v != null);
  years.push({ year: y, date, hourly }); console.log(date, hourly.length, 'h', Math.min(...hourly.map((h: number[]) => h[1])), '-', Math.max(...hourly.map((h: number[]) => h[1])));
}
const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const summary: number[][] = []; for (let mm = 0; mm <= 1800; mm += 60) { const v = years.map((Y) => Y.hourly.find((h) => h[0] === mm)?.[1]).filter((x): x is number => x != null); if (v.length) summary.push([mm, Math.min(...v), +med(v).toFixed(1), Math.max(...v)]); }
fs.writeFileSync('sources/curated/race-temps.json', JSON.stringify({ source: 'Open-Meteo historical weather API (ERA5 reanalysis), https://open-meteo.com/; race dates: RunSignup race 163892', location: 'Start / Finish, Barton Warnock Visitor Center', lat, lon, tz: 'CST (UTC-6)', years, summary }, null, 1));
fs.writeFileSync('sources/curated/race-temps.csv', ['date,' + summary.map((s) => `${String(Math.floor(s[0] / 60) % 24).padStart(2, '0')}:00${s[0] >= 1440 ? '+1' : ''}`).join(',')].concat(years.map((Y) => Y.date + ',' + summary.map((s) => Y.hourly.find((h) => h[0] === s[0])?.[1] ?? '').join(','))).join('\n') + '\n');
console.log('years', years.map((Y) => Y.year).join(' '));
