// Static build (Bun): reads /content, renders every module in site/pages/*.ts to /dist, bundles site/app.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx, Page } from './lib/types';

const here = import.meta.dir, root = path.resolve(here, '..');
const C = path.join(root, 'content'), D = path.join(root, 'dist');
const J = (p: string) => JSON.parse(fs.readFileSync(path.join(C, p), 'utf8'));
const courses = J('courses.json');
const ctx: Ctx = {
  layout: J('layout.json'), colors: J('colors.json'), courses, stations: J('stations.json'), cutoffs: J('cutoffs.json'),
  network: J('network.geojson'), park: J('park.geojson'), zones: J('zones.geojson'), pois: J('pois.geojson'), zoom: J('zoomboxes.geojson'),
  arrows: J('arrows.geojson'), labels: J('labels.geojson'),
  courseGeo: Object.fromEntries(courses.order.map((k: string) => [k, J(`courses/${k}.geojson`)])),
  profiles: { ...Object.fromEntries(courses.order.map((k: string) => [k, J(`profiles/${k}.json`)])), callouts: J('profiles/callouts.json') },
};
fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
const pages: Page[] = [];
for (const f of fs.readdirSync(path.join(here, 'pages')).filter((f) => f.endsWith('.ts')).sort()) pages.push(await import(path.join(here, 'pages', f)));
pages.sort((a, b) => (a.meta.path === 'index.html' ? -1 : b.meta.path === 'index.html' ? 1 : 0));
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
for (const p of pages) {
  const depth = p.meta.path.split('/').length - 1, base = depth ? '../'.repeat(depth) : './';
  const nav = pages.map((q) => `<a href="${base}${q.meta.path.replace(/index\.html$/, '')}"${q === p ? ' aria-current="page"' : ''}>${q.meta.nav}</a>`).join('');
  const html = tpl.replace('{{base}}', base).replace(/{{title}}/g, p.meta.title).replace('{{nav}}', nav).replace('{{body}}', p.render(ctx)).replace(/{{year}}/g, '2027');
  const out = path.join(D, p.meta.path); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
  console.log('page', p.meta.path, (html.length / 1024).toFixed(0) + ' KB');
}
fs.cpSync(path.join(here, 'public'), D, { recursive: true });
const app = await Bun.build({ entrypoints: [path.join(here, 'app.ts')], outdir: D, minify: true, target: 'browser' });
if (!app.success) throw new AggregateError(app.logs, 'app.ts bundle failed');
fs.cpSync(path.join(C, 'hillshade'), path.join(D, 'hillshade'), { recursive: true });
for (const f of ['logo_ink_crop.png', 'logo_white_crop.png']) fs.copyFileSync(path.join(C, f), path.join(D, f));
