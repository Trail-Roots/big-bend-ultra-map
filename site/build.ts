// Static build (Bun): reads /content, stacks every site/sections/*.ts module into one page (dist/index.html), bundles site/app.ts.
import fs from 'node:fs';
import { icon } from './lib/icons';
import path from 'node:path';
import type { Ctx, Section } from './lib/types';
import { markerDefs } from './lib/util';

// big semi-transparent red diagonal DRAFT watermark: print / PDF only (fixed element repeats on every printed page); never shown on screen
const WM_SVG = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><text x="500" y="500" transform="rotate(-35 500 500)" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-weight="900" font-size="220" fill="#b3261e" fill-opacity=".16" letter-spacing="10">DRAFT</text></svg>')}")`;
const WATERMARK = `<style>.wm{display:none}@media print{.wm{display:block;position:fixed;inset:0;background:${WM_SVG} center/contain no-repeat;pointer-events:none;z-index:9999}}</style><div class="wm" aria-hidden="true"></div>`;
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
const { layersNav } = await import('./sections/10-map');
let html = tpl.replace('{{layers}}', layersNav(ctx)).replace('{{bodyclass}}', draft ? 'draft' : '')
  .replace('{{draftbanner}}', draft ? WATERMARK + `<style>@page{@top-center{content:"DRAFT — NOT FINAL · Subject to change · Generated ${gen}";font:800 8pt system-ui,sans-serif;letter-spacing:.06em;color:#fff;background:#b3261e;margin:.05in 0 .05in;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>` : '')
  .replace('{{draftnote}}', draft ? `<span class="draftnote" title="Generated ${gen}">Draft · subject to change</span>` : '').replace('{{base}}', './').replace(/{{ic:(\w+)}}/g, (_: string, n: string) => icon(n)).replace(/{{title}}/g, sections[0].meta.title).replace('{{defs}}', markerDefs(ctx.colors)).replace('{{body}}', body).replace(/{{year}}/g, '2027');
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
// the links list is not on the page / PDF any more: it is regenerated into README.md (between the links markers) at every build
const md = (t: string) => t.replace(/([\[\]])/g, '\\$1');
const linksMd = `<!-- links:start (generated by site/build.ts from dist/links.json; do not edit) -->\n## Links\n\n${Object.entries(G).filter(([, v]) => v.length).map(([g, v]) => `### ${g}\n\n${v.map((e) => `- ${md(e.label)}: <${e.url}>`).join('\n')}\n`).join('\n')}<!-- links:end -->`;
const RM = path.join(root, 'README.md'), rm = fs.readFileSync(RM, 'utf8'), re = /<!-- links:start[\s\S]*?<!-- links:end -->/;
const rm2 = re.test(rm) ? rm.replace(re, linksMd) : rm.trimEnd() + '\n\n' + linksMd + '\n';
if (rm2 !== rm) fs.writeFileSync(RM, rm2);
fs.writeFileSync(path.join(D, 'links.json'), JSON.stringify([...seen.values()], null, 1));
console.log('links', seen.size);
// no native browser tooltips anywhere: drop SVG <title> elements and title="" attributes in the body (info uses the custom tip.ts tooltips)
const noTitles = (h: string) => h.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/\s(?:xlink:)?title="[^"]*"/g, '');
{ const i = html.indexOf('<body'); html = html.slice(0, i) + noTitles(html.slice(i)); }
// build check: every map link (station lightboxes, print station pages, maps, plans) must point at coordinates, never a place name
{ const COORD = /^-?\d{1,2}\.\d+(?:,|%2C)-?\d{1,3}\.\d+$/i, bad: string[] = []; let n = 0;
  // the only exception: the subtle secondary "Nearby: <named place>" links (a.st-near) on aid-station details
  const scan = html.replace(/<a class="st-near"[^>]*>/g, '');
  for (const m of scan.matchAll(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com)[^"'\s<]*/g)) {
    const u = m[0].replace(/&amp;/g, '&'); if (/\/maps\/d\//.test(u)) continue; n++; // My Maps (KML) is a layer, not a place link
    const v = /[?&](?:query|q|destination)=([^&#]+)/.exec(u)?.[1]; if (!v || !COORD.test(v)) bad.push(u); }
  if (bad.length) throw new Error('[links] map links not coordinate-based:\n' + bad.join('\n'));
  console.log('map links', n, 'all coordinate-based'); }
fs.writeFileSync(path.join(D, 'index.html'), html);
// race filter: page-1 elevation chart for every visible-race subset (fetched by app.ts on the first filter change)
{ const { profileBody } = await import('./lib/panels'); const O: string[] = ctx.courses.order, V: Record<string, unknown> = {};
  for (let m = 0; m < (1 << O.length) - 1; m++) { const vis = O.filter((_, i) => m & (1 << i)), p = profileBody(ctx, vis); V[vis.join(',')] = { s: noTitles(p.s), x: p.x, y: p.y }; }
  fs.writeFileSync(path.join(D, 'profiles.json'), JSON.stringify(V)); console.log('profile variants', Object.keys(V).length); }
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
