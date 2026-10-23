// Lists every critical junction id per race (for sources/curated/intersections.json) and adds missing ids with empty image lists. Local only.
import fs from 'node:fs'; import path from 'node:path';
import { routeNodes } from '../site/lib/routeseq';
const C = path.resolve(import.meta.dir, '../content'), J = (f: string) => JSON.parse(fs.readFileSync(path.join(C, f), 'utf8'));
const c: any = { network: J('network.geojson'), networkFull: J('network_full.geojson'), labels: J('labels.geojson'), pois: J('pois.geojson'), cutoffs: J('cutoffs.json'), stations: J('stations.json'), courses: J('courses.json'), courseGeo: {} };
const MF = path.resolve(import.meta.dir, '../sources/curated/intersections.json'); const man = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, 'utf8')) : { note: 'Photos per critical junction: route -> junction id -> up to 2 image paths under site/public/. Ids are sequential along each route and renumber if the route changes. Regenerate with bun tools/intersections.ts.' }; man.routes ??= {};
for (const k of c.courses.order) { c.courseGeo[k] = J(`courses/${k}.geojson`); const r = (man.routes[k] ??= {});
  for (const x of routeNodes(c, k)) if ('crit' in x && x.crit) { r[x.id] ??= []; console.log(x.id.padEnd(9), ('mi ' + x.mile.toFixed(1)).padEnd(8), x.title); } }
fs.writeFileSync(MF, JSON.stringify(man, null, 1) + '\n');
