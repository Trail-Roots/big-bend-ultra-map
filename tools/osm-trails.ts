// Background park trails from OpenStreetMap (Overpass): named highway=path/track/footway ways in Big Bend Ranch SP near the
// Contrabando / Buena Suerte / Waterhole part of the course (North Lone Star Mine is already the curated LoneStar road) -> sources/curated/park_trails.geojson (drawn only when zoomed to the 1 mi scale bar).
// Usage: bun tools/osm-trails.ts [cached-overpass.json]
import fs from 'node:fs';
const NAMES = ['Buena Suerte', 'Dog Cholla', 'Camino Viejo', 'Crystal Trail', 'Waterhole Trail', 'West Main Trail', 'Dome Trail', 'Fresno Divide'];
const Q = '[out:json][timeout:120];(way["highway"~"^(path|footway|track)$"](29.24,-103.85,29.42,-103.55););out geom tags;';
const src = process.argv[2];
const j = src ? JSON.parse(fs.readFileSync(src, 'utf8')) : await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'bbu-map/1.0' }, body: new URLSearchParams({ data: Q }) })).json();
let features = j.elements.filter((w: any) => NAMES.includes(w.tags?.name)).map((w: any) => ({ type: 'Feature', properties: { name: w.tags.name, osm: `way/${w.id}`, highway: w.tags.highway }, geometry: { type: 'LineString', coordinates: w.geometry.map((n: any) => [+n.lon.toFixed(6), +n.lat.toFixed(6)]) } }));
// drop stretches that run along a curated network line (>= 60 m within 35 m: already drawn, e.g. the LoneStar road); crossings stay
const net = JSON.parse(fs.readFileSync('sources/curated/network.geojson', 'utf8')).features;
const kx = 111320 * Math.cos((29.3 * Math.PI) / 180), ky = 110540, P = (c: number[]) => [c[0] * kx, c[1] * ky], U = (p: number[]) => [+(p[0] / kx).toFixed(6), +(p[1] / ky).toFixed(6)];
const segs = net.flatMap((f: any) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap((l: number[][]) => l.slice(1).map((q, i) => [P(l[i]), P(q)])));
const dist = (p: number[]) => { let m = Infinity; for (const [a, b] of segs) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; m = Math.min(m, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); } return m; };
const out: any[] = [];
for (const f of features) { const src = f.geometry.coordinates.map(P), pts: number[][] = [src[0]];
  for (let i = 1; i < src.length; i++) { const a = src[i - 1], b = src[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5)); for (let j = 1; j <= n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  const keep = pts.map((p) => dist(p) >= 35);
  for (let i = 0; i < pts.length;) { if (keep[i]) { i++; continue; } let j = i, L = 0; while (j + 1 < pts.length && !keep[j + 1]) { L += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]); j++; } if (L < 60) for (let k = i; k <= j; k++) keep[k] = true; i = j + 1; }
  for (let i = 0; i < pts.length;) { if (!keep[i]) { i++; continue; } let j = i; while (j + 1 < pts.length && keep[j + 1]) j++;
    const line = pts.slice(i, j + 1).filter((_, k, a) => k % 4 === 0 || k === a.length - 1); if (j - i >= 4) out.push({ ...f, geometry: { type: 'LineString', coordinates: line.map(U) } }); i = j + 1; } }
features.length = 0; features.push(...out);
fs.writeFileSync('sources/curated/park_trails.geojson', JSON.stringify({ type: 'FeatureCollection', attribution: '© OpenStreetMap contributors (ODbL)', features }));
console.log(`park_trails: ${features.length} ways: ${features.map((f: any) => f.properties.name).join(', ')}`);
