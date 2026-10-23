// Seeds sources/curated/route_trails.geojson: named OSM ways (Overpass) that the race routes run on, used to name every route segment
// (site/lib/sequence.ts). Local only (CI never fetches). OSM_CACHE=<overpass json> reuses a saved response.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(import.meta.dir, '..');
const q = `[out:json][timeout:90];way["highway"]["name"](29.25,-103.99,29.52,-103.74);out geom;`;
const j = process.env.OSM_CACHE ? JSON.parse(fs.readFileSync(process.env.OSM_CACHE, 'utf8')) : await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) })).json();
const k0 = Math.cos((29.35 * Math.PI) / 180), M = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 111320 * k0, (a[1] - b[1]) * 110540);
const route: number[][] = []; for (const k of ['100K', '55K', '35K', '20K', '10K']) route.push(...JSON.parse(fs.readFileSync(path.join(ROOT, `content/courses/${k}.geojson`), 'utf8')).features[0].geometry.coordinates);
const feats = j.elements.filter((w: any) => w.geometry?.some((g: any) => route.some((r) => M(r, [g.lon, g.lat]) < 80))).map((w: any) => ({ type: 'Feature', properties: { name: w.tags.name, highway: w.tags.highway, osm: 'way/' + w.id }, geometry: { type: 'LineString', coordinates: w.geometry.map((g: any) => [+g.lon.toFixed(6), +g.lat.toFixed(6)]) } }));
fs.writeFileSync(path.join(ROOT, 'sources/curated/route_trails.geojson'), JSON.stringify({ type: 'FeatureCollection', features: feats }) + '\n');
console.log('route_trails', feats.length, [...new Set(feats.map((f: any) => f.properties.name))].join(', '));
