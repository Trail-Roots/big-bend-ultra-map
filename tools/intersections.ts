// Lists every master junction (deduped across races; id from location) and syncs sources/curated/intersections.json:
// { junctions: { <id>: [up to 2 image paths under site/public/] } }. Missing ids get [], ids no longer on any route are kept with photos
// (and reported) so nothing is lost. Local only.
import fs from 'node:fs'; import path from 'node:path';
import { masterJunctions } from '../site/lib/routeseq';
const C = path.resolve(import.meta.dir, '../content'), J = (f: string) => JSON.parse(fs.readFileSync(path.join(C, f), 'utf8'));
const c: any = { network: J('network.geojson'), networkFull: J('network_full.geojson'), labels: J('labels.geojson'), pois: J('pois.geojson'), cutoffs: J('cutoffs.json'), stations: J('stations.json'), courses: J('courses.json'), courseGeo: {} };
for (const k of c.courses.order) c.courseGeo[k] = J(`courses/${k}.geojson`);
const MF = path.resolve(import.meta.dir, '../sources/curated/intersections.json'), old = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, 'utf8')) : {};
const prev: Record<string, string[]> = old.junctions ?? {}, out: Record<string, string[]> = {}, { list } = masterJunctions(c);
for (const j of list) { out[j.id] = prev[j.id] ?? []; console.log(String(j.no).padStart(3), j.id.padEnd(14), (j.turn ? 'Turnaround on ' + j.trails[0] : j.trails.join(' / ')).padEnd(48), j.uses.map((u) => `${u.k} mi ${u.mile.toFixed(1)}`).join(', ')); }
for (const [id, v] of Object.entries(prev)) if (!(id in out) && v.length) { out[id] = v; console.log('kept (not on any route now):', id); }
fs.writeFileSync(MF, JSON.stringify({ note: 'Photos per physical junction (master Intersections section): junction id -> up to 2 image paths under site/public/. Ids come from the junction location (lat/lon to 3 decimals) so they stay stable when routes change. Regenerate with bun tools/intersections.ts.', junctions: out }, null, 1) + '\n');
