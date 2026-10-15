// Static build (Bun): reads /content, stacks every site/sections/*.ts module into one page (dist/index.html), bundles site/app.ts.
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx, Section } from './lib/types';
import { markerDefs } from './lib/util';

// big semi-transparent red diagonal DRAFT watermark: on every printed page (fixed element repeats per page) and on every web paper sheet
const WM_SVG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><text x="500" y="500" transform="rotate(-35 500 500)" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="900" font-size="300" fill="#b3261e" fill-opacity=".16" letter-spacing="20">DRAFT</text></svg>')}")`;
const WATERMARK = `<style>.wm{display:none}@media print{.wm{display:block;position:fixed;inset:0;background:${WM_SVG} center/100% no-repeat;pointer-events:none;z-index:9999}}@media screen and (min-width:1100px){html .sec-map .pg1,html .sec-courses .coursepage,html .sec:not(.noprint):not(.sec-map):not(.sec-courses)>.doc{position:relative}html .sec-map .pg1::after,html .sec-courses .coursepage::after,html .sec:not(.noprint):not(.sec-map):not(.sec-courses)>.doc::after{content:"";position:absolute;inset:0;background:${WM_SVG} center/contain no-repeat;pointer-events:none;z-index:60}}</style><div class="wm" aria-hidden="true"></div>`;
const here = import.meta.dir, root = path.resolve(here, '..');
const C = path.join(root, 'content'), D = path.join(root, 'dist');
const J = (p: string) => JSON.parse(fs.readFileSync(path.join(C, p), 'utf8'));
const courses = J('courses.json');
const ctx: Ctx = {
  layout: J('layout.json'), colors: J('colors.json'), courses, stations: J('stations.json'), cutoffs: J('cutoffs.json'),
  network: J('network.geojson'), park: J('park.geojson'), pois: J('pois.geojson'), zoom: J('zoomboxes.geojson'),
  arrows: J('arrows.geojson'), labels: J('labels.geojson'), areaLabels: J('area_labels.geojson'), timeline: J('timeline.json'), stationLabels: J('station_labels.geojson'), poiLabels: J('poi_labels.geojson'),
  courseGeo: Object.fromEntries(courses.order.map((k: string) => [k, J(`courses/${k}.geojson`)])),
  logistics: J('logistics.json'),
  profiles: { ...Object.fromEntries(courses.order.map((k: string) => [k, J(`profiles/${k}.json`)])), callouts: J('profiles/callouts.json') },
};
fs.rmSync(D, { recursive: true, force: true }); fs.mkdirSync(D, { recursive: true });
// single scrollable page: every module in site/sections/*.ts (filename order) becomes a <section>
const sections: Section[] = [];
for (const f of fs.readdirSync(path.join(here, 'sections')).filter((f) => f.endsWith('.ts')).sort()) sections.push(await import(path.join(here, 'sections', f)));
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
const body = sections.map((s) => `<section class="sec sec-${s.meta.id}${s.meta.print === false ? ' noprint' : ''}" id="${s.meta.id}" aria-label="${s.meta.title}">${s.render(ctx)}</section>`).join('\n');
// draft markings: one flag in content/site.json (source: sources/curated/site.json)
const site = J('site.json'), draft = site.draft === true;
const gen = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'short', day: 'numeric' });
let html = tpl.replace('{{bodyclass}}', draft ? 'draft' : '')
  .replace('{{draftbanner}}', draft ? WATERMARK + `<style>@page{@top-center{content:"DRAFT — NOT FINAL · Subject to change · Generated ${gen}";font:800 8pt system-ui,sans-serif;letter-spacing:.06em;color:#fff;background:#b3261e;margin:.05in 0 .05in;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>` : '')
  .replace('{{draftnote}}', draft ? `<span class="draftnote" title="Generated ${gen}">Draft · subject to change</span>` : '').replace('{{base}}', './').replace(/{{title}}/g, sections[0].meta.title).replace('{{defs}}', markerDefs(ctx.colors)).replace('{{body}}', body).replace(/{{year}}/g, '2027');
// ---- link footnotes: every clickable link on the page, collected from the rendered HTML (same data the links come from) ----
const { SITE_URL } = await import('./sections/10-map');
const strip = (t: string) => t.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const attr = (tag: string, n: string) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1]?.replace(/&amp;/g, '&');
const seen = new Map<string, { label: string; url: string }>();
for (const m of html.matchAll(/<a\s[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
  const tag = m[0].slice(0, m[0].indexOf('>') + 1), href = attr(tag, 'href')!; if (href.startsWith('#')) continue;
  const url = /^[a-z]+:/i.test(href) ? href : new URL(href, SITE_URL).href;
  let label = (/trailroots\.com/.test(href) ? 'Trail Roots · Big Bend Ultra race page (header, logo, footer)' : '') || (attr(tag, 'aria-label') || attr(tag, 'title') || strip(m[1]) || url).replace(/ on Google Maps$/, '');
  if (!seen.has(url)) seen.set(url, { label, url }); else if (label.length > seen.get(url)!.label.length && !/Google Maps/.test(label)) seen.get(url)!.label = label;
}
const group = (u: string) => /google\.com\/maps/.test(u) ? 'Locations' : /strava\.com/.test(u) ? 'Routes' : /calendar/.test(u) ? 'Calendar' : /\.(gpx|pdf)$/.test(u) ? 'Downloads' : 'Other';
const G: Record<string, { label: string; url: string }[]> = { Locations: [], Routes: [], Downloads: [], Calendar: [], Other: [] };
for (const v of seen.values()) G[group(v.url)].push(v);
const linksHtml = `<section class="sec sec-links" id="links" aria-label="Links"><article class="doc links"><h2>Links</h2>${Object.entries(G).filter(([, v]) => v.length).map(([g, v]) => `<h4>${g}</h4><ol>${v.map((e) => `<li><span class="lk">${e.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span> <a href="${e.url.replace(/&/g, '&amp;')}">${e.url.replace(/&/g, '&amp;')}</a></li>`).join('')}</ol>`).join('')}</article></section>`;
html = html.replace('</main>', linksHtml + '</main>');
fs.writeFileSync(path.join(D, 'links.json'), JSON.stringify([...seen.values()], null, 1));
console.log('links', seen.size);
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
// site-plan aerial backdrops (USGS, public domain)
fs.mkdirSync(path.join(D, 'plans'), { recursive: true });
for (const f of ['finish_muted.jpg', 'parking_muted.jpg']) fs.copyFileSync(path.join(root, 'sources', 'curated', 'aerial', f), path.join(D, 'plans', f));
fs.copyFileSync(path.join(root, 'sources', 'floorplan.svg'), path.join(D, 'plans', 'floorplan.svg')); // Erik's floor-plan drawing, served byte-for-byte
