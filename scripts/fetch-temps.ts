// Race-day temperatures for the timeline: hourly 2 m air temperature on Jan 17 2026 (last year's race day) at the Start / Finish
// (Barton Warnock), from the Open-Meteo historical weather archive (ERA5 reanalysis). Fetched in UTC and shifted to CST (UTC-6).
// Writes sources/temps.json -> { source, date, tz, hourly: [[minutes after Jan 17 00:00 CST, °F], ...] }. Run: bun scripts/fetch-temps.ts
import fs from 'node:fs';
const [lat, lon] = [29.270545, -103.757135];
const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=2026-01-17&end_date=2026-01-19&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=GMT`;
const j = await (await fetch(url)).json();
const base = Date.UTC(2026, 0, 17, 6); // Jan 17 00:00 CST
const hourly = j.hourly.time.map((t: string, i: number) => [Math.round((Date.parse(t + 'Z') - base) / 60000), j.hourly.temperature_2m[i]]).filter(([m]: number[]) => m >= 0 && m <= 1800);
fs.writeFileSync(new URL('../sources/temps.json', import.meta.url), JSON.stringify({ source: 'Open-Meteo historical weather API (ERA5 reanalysis), https://open-meteo.com/', url, date: '2026-01-17 (2026 race day)', location: 'Start / Finish, Barton Warnock Visitor Center', tz: 'CST (UTC-6)', hourly }));
console.log('temps', hourly.length, 'hours; min', Math.min(...hourly.map((h: number[]) => h[1])), 'max', Math.max(...hourly.map((h: number[]) => h[1])));
