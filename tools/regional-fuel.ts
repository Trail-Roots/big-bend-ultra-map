// One-off (local, never CI): OSM amenity=fuel (Overpass, regional extent) -> sources/curated/regional.geojson (kind: fuel, one point per town that has fuel).
// usage: bun tools/regional-fuel.ts overpass.json   (query: [out:json];nwr["amenity"="fuel"](29.0,-104.75,30.6,-103.2);out center tags;)
const j = await Bun.file(process.argv[2]).json(), P = 'sources/curated/regional.geojson', g = await Bun.file(P).json();
const TOWNS = ['Lajitas', 'Study Butte', 'Alpine', 'Marfa', 'Presidio'], km = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 96.5, (a[1] - b[1]) * 111);
const towns = g.features.filter((f: any) => f.properties.kind === 'town'), st = j.elements.map((e: any) => ({ id: `${e.type}/${e.id}`, name: e.tags?.name || e.tags?.brand || '', p: [e.lon ?? e.center.lon, e.lat ?? e.center.lat] }));
g.features = g.features.filter((f: any) => f.properties.kind !== 'fuel');
for (const n of TOWNS) { const t = towns.find((f: any) => f.properties.name === n).geometry.coordinates;
  // US side only (Ojinaga's Pemex stations across the river are not Presidio)
  const near = st.filter((s: any) => km(s.p, t) < 5 && !/pemex/i.test(s.name) && !(n === 'Presidio' && s.p[0] < -104.39));
  console.log(n, near.length ? near.map((s: any) => `${s.id} ${s.name}`).join('; ') : 'NO FUEL IN OSM');
  if (near.length) g.features.push({ type: 'Feature', properties: { kind: 'fuel', town: n, n: near.length, src: 'OSM amenity=fuel ' + near.map((s: any) => s.id).join(' ') }, geometry: { type: 'Point', coordinates: t } }); }
console.log('other fuel in frame (not drawn):', st.filter((s: any) => !TOWNS.some((n) => km(s.p, towns.find((f: any) => f.properties.name === n).geometry.coordinates) < 5) || /pemex/i.test(s.name) || s.p[0] < -104.39).map((s: any) => `${s.id} ${s.name} ${s.p.map((v: number) => v.toFixed(3))}`).join('\n'));
await Bun.write(P, JSON.stringify(g));
