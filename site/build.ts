// Static build (Bun): reads /content, stacks every site/sections/*.ts module into one page (dist/index.html), bundles site/app.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx, Section } from './lib/types';
import { markerDefs } from './lib/util';

const here = import.meta.dir, root = path.resolve(here, '..');
const C = path.join(root, 'content'), D = path.join(root, 'dist');
const J = (p: string) => JSON.parse(fs.readFileSync(path.join(C, p), 'utf8'));
const courses = J('courses.json');
const ctx: Ctx = {
  layout: J('layout.json'), colors: J('colors.json'), courses, stations: J('stations.json'), cutoffs: J('cutoffs.json'),
  network: J('network.geojson'), park: J('park.geojson'), pois: J('pois.geojson'), zoom: J('zoomboxes.geojson'),
  arrows: J('arrows.geojson'), labels: J('labels.geojson'), areaLabels: J('area_labels.geojson'), stationLabels: J('station_labels.geojson'), poiLabels: J('poi_labels.geojson'),
  courseGeo: Object.fromEntries(courses.order.map((k: string) => [k, J(`courses/${k}.geojson`)])),
  profiles: { ...Object.fromEntries(courses.order.map((k: string) => [k, J(`profiles/${k}.json`)])), callouts: J('profiles/callouts.json') },
};
fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
// single scrollable page: every module in site/sections/*.ts (filename order) becomes a <section>
const sections: Section[] = [];
for (const f of fs.readdirSync(path.join(here, 'sections')).filter((f) => f.endsWith('.ts')).sort()) sections.push(await import(path.join(here, 'sections', f)));
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
const body = sections.map((s) => `<section class="sec sec-${s.meta.id}${s.meta.print === false ? ' noprint' : ''}" id="${s.meta.id}" aria-label="${s.meta.title}">${s.render(ctx)}</section>`).join('\n');
const html = tpl.replace('{{base}}', './').replace(/{{title}}/g, sections[0].meta.title).replace('{{defs}}', markerDefs(ctx.colors)).replace('{{body}}', body).replace(/{{year}}/g, '2027');
fs.writeFileSync(path.join(D, 'index.html'), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB,', sections.length, 'sections:', sections.map((s) => s.meta.id).join(', '));
fs.cpSync(path.join(here, 'public'), D, { recursive: true });
const app = await Bun.build({ entrypoints: [path.join(here, 'app.ts')], outdir: D, minify: true, target: 'browser' });
if (!app.success) throw new AggregateError(app.logs, 'app.ts bundle failed');
fs.cpSync(path.join(C, 'hillshade'), path.join(D, 'hillshade'), { recursive: true });
// course GPX downloads, straight from /sources
fs.mkdirSync(path.join(D, 'gpx'), { recursive: true });
for (const k of ctx.courses.order) fs.copyFileSync(path.join(here, '..', 'sources', 'gpx', `${k}.gpx`), path.join(D, ctx.courses.courses[k].gpx));
for (const f of ['logo_ink_crop.png', 'logo_white_crop.png']) fs.copyFileSync(path.join(C, f), path.join(D, f));
