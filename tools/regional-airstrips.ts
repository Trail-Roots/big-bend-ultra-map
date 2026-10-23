// One-off (local, never CI): add OSM airstrips (aeroway=aerodrome|airstrip, Overpass, regional extent) to sources/curated/regional.geojson.
// usage: bun tools/regional-airstrips.ts /tmp/aero.json   (Overpass: nwr["aeroway"~"aerodrome|airstrip"](29.19,-104.55,30.47,-103.35);out center tags;)
const SHORT: Record<string, string> = { 'Alpine-Casparis Municipal Airport': 'Alpine-Casparis Airport', 'Marfa Municipal Airport': 'Marfa Airport', 'Presidio Lely International Airport': 'Presidio Lely Airport', 'Lajitas International Airport': 'Lajitas Airport', 'Big Bend Ranch Airport': 'Sauceda airstrip', 'Terlingua Ranch Airport': 'Terlingua Ranch Airport' };
const j = await Bun.file(process.argv[2]).json(), P = 'sources/curated/regional.geojson', g = await Bun.file(P).json();
g.features = g.features.filter((f: any) => f.properties.kind !== 'airstrip');
for (const e of j.elements) { const n = e.tags?.name; if (!n || /abandoned/i.test(n)) continue; const c = e.center || e;
  g.features.push({ type: 'Feature', properties: { kind: 'airstrip', name: n, label: SHORT[n] || null, code: e.tags.faa || e.tags.icao || null, src: `osm ${e.type}/${e.id}` }, geometry: { type: 'Point', coordinates: [+c.lon.toFixed(5), +c.lat.toFixed(5)] } }); }
await Bun.write(P, JSON.stringify(g)); console.log(g.features.filter((f: any) => f.properties.kind === 'airstrip').length, 'airstrips');
export {};
