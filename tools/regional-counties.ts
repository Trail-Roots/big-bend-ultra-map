// One-off (local, never CI): county lines (OSM boundary=administrative admin_level=6, Overpass) -> sources/curated/regional.geojson (kind: county).
// usage: bun tools/regional-counties.ts /tmp/co.json   (Overpass: rel["boundary"="administrative"]["admin_level"="6"]["name"~"^(Brewster|Presidio|Jeff Davis) County"];out geom;)
// Stored as the outer member ways clipped to the regional extent (shared lines drawn twice are harmless at this scale).
const j = await Bun.file(process.argv[2]).json(), P = 'sources/curated/regional.geojson', g = await Bun.file(P).json();
const dp = (P: number[][], e = 0.0005): number[][] => { if (P.length < 3) return P; let m = 0, k = 0; const [a, b] = [P[0], P.at(-1)!], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs(dy * P[i][0] - dx * P[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > m) { m = d; k = i; } } return m > e ? [...dp(P.slice(0, k + 1), e).slice(0, -1), ...dp(P.slice(k), e)] : [a, b]; };
const IN = (q: number[]) => q[0] > -104.9 && q[0] < -103.0 && q[1] > 29.0 && q[1] < 30.8;
g.features = g.features.filter((f: any) => f.properties.kind !== 'county');
const seen = new Set<number>();
for (const r of j.elements) { const lines: number[][][] = [];
  for (const m of r.members) { if (m.type !== 'way' || m.role !== 'outer' || seen.has(m.ref)) continue; seen.add(m.ref);
    let cur: number[][] = []; for (const p of m.geometry) { const q = [p.lon, p.lat]; if (IN(q)) cur.push(q); else { if (cur.length > 1) lines.push(cur); cur = []; } } if (cur.length > 1) lines.push(cur); }
  if (lines.length) g.features.push({ type: 'Feature', properties: { kind: 'county', name: r.tags.name, src: `OSM relation/${r.id}` }, geometry: { type: 'MultiLineString', coordinates: lines.map((l) => dp(l).map((q) => q.map((v) => +v.toFixed(4)))) } }); }
await Bun.write(P, JSON.stringify(g)); console.log(g.features.filter((f: any) => f.properties.kind === 'county').map((f: any) => f.properties.name + ' ' + f.geometry.coordinates.length));
