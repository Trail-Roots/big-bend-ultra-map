// One-off (local, never CI): cell towers = OSM man_made=mast|tower with communication:mobile_phone=yes (Overpass), regional extent -> regional.geojson (kind: celltower).
// OSM mapping is incomplete; this is not a coverage map (no coverage data is drawn). usage: bun tools/regional-towers.ts /tmp/tw.json
const j = await Bun.file(process.argv[2]).json(), P = 'sources/curated/regional.geojson', g = await Bun.file(P).json();
g.features = g.features.filter((f: any) => f.properties.kind !== 'celltower'); const got: number[][] = [];
for (const e of j.elements) { if (e.tags?.['communication:mobile_phone'] !== 'yes') continue; const c = [+e.lon.toFixed(5), +e.lat.toFixed(5)]; if (got.some((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) < 0.003)) continue; got.push(c);
  g.features.push({ type: 'Feature', properties: { kind: 'celltower', src: `osm node/${e.id}` }, geometry: { type: 'Point', coordinates: c } }); }
await Bun.write(P, JSON.stringify(g)); console.log(got.length, 'cell towers');
