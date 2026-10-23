// One-off (local, never CI): regional map v2 -> sources/curated/regional.geojson
//  - airstrips: keep only the labelled ones; attach real runway geometry (OSM aeroway=runway, Overpass; usage arg 1 = runway json)
//  - drive times shown at the points: OSRM (OSM) on paved roads; park dirt road Sauceda – FM 170 (logistics.kml line, ends at FM 170 = "Presidio Pavement") at 5 min/mi
//  - Lone Star Ranch Rd (logistics.kml "Lone Star Ranch Dirt to Mines Aid", OSM name "Lone Star Ranch Road") for its label
// usage: bun tools/regional-update.ts /tmp/rw.json
const P = 'sources/curated/regional.geojson', g = await Bun.file(P).json(), rw = await Bun.file(process.argv[2]).json();
const UA = { 'User-Agent': 'bbu-map/1.0 (github.com/Trail-Roots/big-bend-ultra-map)' };
const F = g.features as any[], pt = (k: string, n?: string) => F.find((f) => f.properties.kind === k && (!n || f.properties.name === n)).geometry.coordinates as number[];
// airstrips
g.features = F.filter((f) => f.properties.kind !== 'airstrip' || f.properties.label);
for (const f of g.features.filter((f: any) => f.properties.kind === 'airstrip')) { const [x, y] = f.geometry.coordinates;
  const ws = rw.elements.filter((e: any) => e.geometry.some((q: any) => Math.hypot(q.lon - x, q.lat - y) < 0.03));
  f.properties.runways = ws.map((e: any) => e.geometry.map((q: any) => [+q.lon.toFixed(5), +q.lat.toFixed(5)])); f.properties.rsrc = ws.map((e: any) => `osm way/${e.id}`).join(', ');
  console.log(f.properties.label, ws.length, 'runways'); }
// drive times
const kml = await Bun.file('sources/logistics.kml').text(), pm = kml.split('<Placemark>').slice(1);
const kpt = (n: string) => /<coordinates>\s*([-\d.]+),([-\d.]+)/.exec(pm.find((s) => s.includes(`<name>${n}</name>`))!)!.slice(1, 3).map(Number);
const kline = (n: string) => /<coordinates>([\s\S]*?)<\/coordinates>/.exec(pm.find((s) => s.includes(`<name>${n}</name>`) && s.includes('<LineString>'))!)![1].trim().split(/\s+/).map((q) => q.split(',').slice(0, 2).map(Number));
const st = await Bun.file('content/stations.json').json(), SF = st.stations['S/F'].lonlat, HOSP = pt('hospital'), PAVE = kpt('Presidio Pavement');
const osrm = async (a: number[], b: number[]) => { const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.join(',')};${b.join(',')}?overview=false`, { headers: UA })).json(); if (j.code !== 'Ok') throw new Error('osrm'); await Bun.sleep(1100); return { min: +(j.routes[0].duration / 60).toFixed(1), mi: +(j.routes[0].distance / 1609.344).toFixed(1) }; };
const dirt = g.features.find((f: any) => f.properties.kind === 'parkroad').properties; // Sauceda – FM 170 (Presidio Pavement), 5 min/mi
g.features = g.features.filter((f: any) => f.properties.kind !== 'drive' && f.properties.kind !== 'namedroad');
const D = (from: string, to: string, r: { min: number; mi: number }, src: string) => { g.features.push({ type: 'Feature', properties: { kind: 'drive', from, to, ...r, src }, geometry: null }); console.log(from, '->', to, r); };
for (const t of ['Lajitas', 'Terlingua', 'Study Butte', 'Presidio', 'Marfa', 'Alpine']) D('S/F', t, await osrm(SF, pt('town', t)), 'OSRM (OSM)');
const sfH = await osrm(SF, HOSP); D('S/F', 'Hospital', sfH, 'OSRM (OSM)');
D('Sauceda', 'FM 170', { min: dirt.min, mi: dirt.mi }, 'logistics.kml park road; 5 min/mi dirt');
const pS = await osrm(PAVE, SF), pH = await osrm(PAVE, HOSP);
D('Sauceda', 'S/F', { min: +(dirt.min + pS.min).toFixed(1), mi: +(dirt.mi + pS.mi).toFixed(1) }, 'park road 5 min/mi + OSRM FM 170');
D('Sauceda', 'Hospital', { min: +(dirt.min + pH.min).toFixed(1), mi: +(dirt.mi + pH.mi).toFixed(1) }, 'park road 5 min/mi + OSRM');
dirt.label = 'Main Park Road'; dirt.lsrc = 'OSM way/15366626 name';
const ls = kline('Directions from Lone Star Ranch Dirt to Mines Aid');
g.features.push({ type: 'Feature', properties: { kind: 'namedroad', name: 'Lone Star Ranch Rd', src: 'logistics.kml; OSM way/15158038 "Lone Star Ranch Road"' }, geometry: { type: 'LineString', coordinates: ls.slice(0, Math.ceil(ls.length / 3)).map((q) => q.map((v) => +v.toFixed(5))) } });
await Bun.write(P, JSON.stringify(g));
