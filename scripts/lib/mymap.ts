// Erik's Google My Maps "Big Bend Ultra - Logistics Map" (KML). The build refreshes sources/mymap.kml when online,
// falling back to the committed copy. Parsed into simple point / line / polygon placemarks with their folder name.
import fs from 'node:fs';
import path from 'node:path';
export const MYMAP_KML = 'https://www.google.com/maps/d/kml?mid=167StUrbf_L4tWaGNkqkZGXB4gH2PX5M&forcekml=1';
export type Placemark = { folder: string; name: string; kind: 'point' | 'line' | 'polygon'; coords: [number, number][] };
export async function loadMyMap(srcDir: string): Promise<{ placemarks: Placemark[]; fetched: boolean }> {
  const f = path.join(srcDir, 'mymap.kml'); let fetched = false;
  try { const r = await fetch(MYMAP_KML, { signal: AbortSignal.timeout(15000) }); if (r.ok) { const t = await r.text(); if (t.includes('<kml') && t.includes('<Placemark')) { fs.writeFileSync(f, t); fetched = true; } } } catch { /* offline: committed copy */ }
  const t = fs.readFileSync(f, 'utf8'), out: Placemark[] = [];
  const unx = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();
  for (const fm of t.split('<Folder>').slice(1)) {
    const folder = unx(fm.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? '');
    for (const pm of fm.split('<Placemark>').slice(1)) {
      const body = pm.split('</Placemark>')[0], name = unx(body.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? '');
      const kind = body.includes('<Polygon') ? 'polygon' : body.includes('<LineString') ? 'line' : 'point';
      const coords = (body.match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1] ?? '').trim().split(/\s+/).filter(Boolean).map((c) => { const [lon, lat] = c.split(',').map(Number); return [lon, lat] as [number, number]; });
      out.push({ folder, name, kind, coords });
    }
  }
  return { placemarks: out, fetched };
}
