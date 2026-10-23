// One-off (local, never in CI): data the main map lacks for the regional view -> sources/curated/regional.geojson
// towns: Nominatim (OSM); drive routes: OSRM public demo server (OSM road data); Rio Grande: Overpass (OSM);
// hospital: sources/logistics.kml placemark; park road to Sauceda: logistics.kml "Directions from Presidio Pavement to Sauceda Bunkhouse".
// Usage: bun tools/regional-fetch.ts [river.json from Overpass if the API is down]
import fs from 'node:fs';
const UA = { 'User-Agent': 'bbu-map/1.0 (github.com/Trail-Roots/big-bend-ultra-map)' };
const kml = fs.readFileSync('sources/logistics.kml', 'utf8'), pm = kml.split('<Placemark>').slice(1);
const kpt = (n: string) => { const p = pm.find((s) => s.includes(`<name>${n}</name>`))!; return /<coordinates>\s*([-\d.]+),([-\d.]+)/.exec(p)!.slice(1, 3).map(Number) as [number, number]; };
const kline = (n: string) => /<coordinates>([\s\S]*?)<\/coordinates>/.exec(pm.find((s) => s.includes(`<name>${n}</name>`) && s.includes('<LineString>'))!)![1].trim().split(/\s+/).map((q) => q.split(',').slice(0, 2).map(Number));
const st = JSON.parse(fs.readFileSync('content/stations.json', 'utf8')), SF = st.stations['S/F'].lonlat as [number, number];
// Douglas-Peucker in degrees (~0.0002 deg ≈ 20 m: invisible at regional scale)
const dp = (P: number[][], e = 0.0002): number[][] => { if (P.length < 3) return P; let m = 0, k = 0; const [a, b] = [P[0], P.at(-1)!], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs(dy * P[i][0] - dx * P[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > m) { m = d; k = i; } } return m > e ? [...dp(P.slice(0, k + 1), e).slice(0, -1), ...dp(P.slice(k), e)] : [a, b]; };
const r6 = (P: number[][]) => P.map((q) => q.map((v) => +v.toFixed(5)));
const F: any[] = [];
const TOWNS = ['Alpine', 'Marfa', 'Presidio', 'Redford', 'Lajitas', 'Terlingua', 'Study Butte'], T: Record<string, [number, number]> = {};
for (const t of TOWNS) { const j = await (await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(t)}&state=Texas&country=USA&format=json&limit=1`, { headers: UA })).json(); T[t] = [+(+j[0].lon).toFixed(5), +(+j[0].lat).toFixed(5)];
  F.push({ type: 'Feature', properties: { kind: 'town', name: t, src: `OSM ${j[0].osm_type}/${j[0].osm_id}` }, geometry: { type: 'Point', coordinates: T[t] } }); await Bun.sleep(1100); }
const HOSP = kpt('Big Bend Regional Medical Center'), PAVE = kline('Directions from Presidio Pavement to Sauceda Bunkhouse');
F.push({ type: 'Feature', properties: { kind: 'hospital', name: 'Big Bend Regional Medical Center', town: 'Alpine' }, geometry: { type: 'Point', coordinates: HOSP } });
F.push({ type: 'Feature', properties: { kind: 'town', name: 'Sauceda', src: 'logistics.kml Sauceda Bunkhouse' }, geometry: { type: 'Point', coordinates: kpt('Sauceda Bunkhouse') } });
const osrm = async (a: number[], b: number[]) => { const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson`, { headers: UA })).json(); if (j.code !== 'Ok') throw new Error('osrm ' + j.code); await Bun.sleep(1100); return j.routes[0]; };
// road legs (drawn + labelled with drive time / distance)
const LEGS: [string, string, number[], number[]][] = [['FM 170', 'S/F – Presidio', SF, T.Presidio], ['FM 170', 'S/F – Lajitas', SF, T.Lajitas], ['FM 170', 'Lajitas – Study Butte', T.Lajitas, T['Study Butte']],
  ['TX 118', 'Study Butte – Alpine', T['Study Butte'], T.Alpine], ['US 67', 'Presidio – Marfa', T.Presidio, T.Marfa], ['US 90', 'Marfa – Alpine', T.Marfa, T.Alpine], ['FM 169', 'Presidio – park road (end of pavement)', T.Presidio, PAVE[0]]];
for (const [ref, name, a, b] of LEGS) { const r = await osrm(a, b); F.push({ type: 'Feature', properties: { kind: 'road', ref, name, min: +(r.duration / 60).toFixed(1), mi: +(r.distance / 1609.344).toFixed(1), src: 'OSRM (OSM)' }, geometry: { type: 'LineString', coordinates: r6(dp(r.geometry.coordinates)) } }); }
// drive times from the Start / Finish (fastest route; table on the map)
for (const [to, b] of [['Lajitas', T.Lajitas], ['Terlingua', T.Terlingua], ['Study Butte', T['Study Butte']], ['Presidio', T.Presidio], ['Alpine (hospital)', HOSP], ['Marfa', T.Marfa]] as [string, number[]][]) { const r = await osrm(SF, b);
  F.push({ type: 'Feature', properties: { kind: 'drive', from: 'S/F', to, min: +(r.duration / 60).toFixed(1), mi: +(r.distance / 1609.344).toFixed(1), src: 'OSRM (OSM)' }, geometry: null }); }
// park road (dirt): project convention 5 min / mi
{ const h = (a: number[], b: number[]) => { const R = 3958.8, t = Math.PI / 180, d = Math.sin((b[1] - a[1]) * t / 2) ** 2 + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin((b[0] - a[0]) * t / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(d)); };
  let mi = 0; for (let i = 1; i < PAVE.length; i++) mi += h(PAVE[i - 1], PAVE[i]);
  F.push({ type: 'Feature', properties: { kind: 'parkroad', name: 'End of pavement – Sauceda', mi: +mi.toFixed(1), min: +(mi * 5).toFixed(1), src: 'logistics.kml; 5 min/mi dirt-road convention' }, geometry: { type: 'LineString', coordinates: r6(dp(PAVE)) } }); }
// Rio Grande (international border)
{ const Q = '[out:json][timeout:60];way["waterway"="river"]["name"~"Rio Grande|Río Bravo"](29.0,-104.6,29.8,-103.4);out geom;';
  const j = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(Q), headers: UA })).json();
  const ws = j.elements.map((w: any) => w.geometry.map((g: any) => [g.lon, g.lat])); // chain ways end-to-end
  const chains: number[][][] = []; for (const w of ws) { const c = chains.find((c) => c.at(-1)![0] === w[0][0] && c.at(-1)![1] === w[0][1]); if (c) c.push(...w.slice(1)); else chains.push(w); }
  for (let ch = true; ch;) { ch = false; for (const a of chains) for (const b of chains) if (a !== b && a.at(-1)![0] === b[0][0] && a.at(-1)![1] === b[0][1]) { a.push(...b.slice(1)); chains.splice(chains.indexOf(b), 1); ch = true; break; } }
  F.push({ type: 'Feature', properties: { kind: 'river', name: 'Rio Grande', src: 'OSM waterway=river (Overpass)' }, geometry: { type: 'MultiLineString', coordinates: chains.map((c) => r6(dp(c))) } }); }
fs.writeFileSync('sources/curated/regional.geojson', JSON.stringify({ type: 'FeatureCollection', fetched: new Date().toISOString(), features: F }));
for (const f of F) if (f.properties.min) console.log(f.properties.kind, f.properties.name || f.properties.to, f.properties.min, 'min', f.properties.mi, 'mi');
console.log('regional.geojson', (fs.statSync('sources/curated/regional.geojson').size / 1024).toFixed(0), 'KB');
