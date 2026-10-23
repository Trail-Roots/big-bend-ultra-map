# Big Bend Ultra – course map website

Static, responsive and printable Big Bend Ultra 2027 course & access map. 100 % TypeScript, built with **Bun**.
Live: https://trail-roots.github.io/big-bend-ultra-map/

```
sources/   raw inputs (GPX, stations sheet CSV, logistics KML, cached elevations, frozen arrows, curated layers, hillshade)
scripts/   content pipeline (sources -> content) + PDF export
content/   generated GeoJSON/JSON the site renders (committed so diffs are reviewable)
site/      rendering: build script, page modules, SVG renderers, CSS, client app.ts
tools/     dev helpers: local server, screenshots, content diff, image diff
dist/      build output (git-ignored), deployed to GitHub Pages
previews/  desktop / mobile / letter print renders
```

## Embed the map on another site
Paste this where the map should appear (any web page or site builder that accepts HTML):
```html
<script src="https://trail-roots.github.io/big-bend-ultra-map/embed.js" async></script>
```
It inserts an iframe of the embed view (`?view=embed`: the same paper-page layout as the site, on a transparent background) right at that spot, full width, and resizes its height automatically to fit the content. It also sends the host window size to the iframe, so maps and charts are capped at 85% of the host screen height (not the tall iframe). Optional: `data-height="700"` on the script tag sets the height used before the map loads.

Plain iframe (no script, fixed height):
```html
<iframe src="https://trail-roots.github.io/big-bend-ultra-map/?view=embed" title="Big Bend Ultra course map" style="width:100%;height:900px;border:0" loading="lazy"></iframe>
```

## Embed the race cards only (limited embed, e.g. RunSignup)
A lightweight preview of the five race cards (map thumbnail, race name, distance, elevation gain, start time). No GPX, Strava, lightbox, navbar, calendar or DRAFT marks. Every click (each card and the "Full race details" link) opens <https://trailroots.com/big-bend-ultra> in a new tab. Paste:
```html
<div id="bbu-cards"></div>
<script src="https://trail-roots.github.io/big-bend-ultra-map/cards-embed.js" async></script>
```
`cards-embed.js` puts an iframe of `cards-embed.html` into `#bbu-cards` (or right after the script tag if there is no such element) and keeps the iframe height equal to its content on load and on every resize (postMessage), so there is never an inner scrollbar. Responsive 320–1000 px and wider. Optional: `data-target="other-id"` (container id), `data-height="520"` (height before the first message). Thumbnails (`dist/cards/<race>.jpg`) are captured from the race-card maps by `scripts/pdf.ts`; `site/build.ts` fails if any link in the page points anywhere other than the Trail Roots race page.

Plain-iframe fallback (hosts that strip scripts): fixed height, so pick it for the container width. Measured content heights: about 560 px at 800–1000 px wide (4 cards per row), 920 px at 600 px, 1530–1790 px at 320–390 px (one card per row). With a too-short height the frame scrolls inside.
```html
<iframe src="https://trail-roots.github.io/big-bend-ultra-map/cards-embed.html" title="Big Bend Ultra races" style="display:block;width:100%;height:600px;border:0" loading="lazy"></iframe>
```
Desktop: `height:600px`. Mobile (one column, 320–390 px): `height:1800px`. If the host allows a style block, switch by width:
```html
<style>.bbu-cards-fixed{display:block;width:100%;height:600px;border:0}@media (max-width:700px){.bbu-cards-fixed{height:1000px}}@media (max-width:480px){.bbu-cards-fixed{height:1800px}}</style>
<iframe class="bbu-cards-fixed" src="https://trail-roots.github.io/big-bend-ultra-map/cards-embed.html" title="Big Bend Ultra races" loading="lazy"></iframe>
```
## Build
```
bun install
bunx playwright install chromium   # once, for the PDF + screenshots
bun run build      # content -> dist/ (HTML) -> dist/big-bend-ultra-2027-map.pdf
bun run preview    # http://localhost:8787
bun run shots      # previews/*.png
bun run check      # tsc type check
```
Steps can run separately: `bun run content`, `bun run site`, `bun run pdf`.

## Sources (`/sources`) and the content pipeline (`scripts/content.ts`)
| input | produces |
|---|---|
| `gpx/*.gpx` | `content/courses/*.geojson` (dedupe, spike removal, topology-preserving Douglas–Peucker ~10 m, Chaikin ×2, 12 m resample, DP 2.5 m) and `content/profiles/*.json` (GPX elevation, distance remapped so station passes fall on sheet mileage) + profile callout placement |
| `sheet.csv` (official stations Google Sheet export) | `cutoffs.json`, `courses.json`, station hours in `stations.json` |
| `logistics.kml` (Logistics My Map) | station positions |
| `stel.json` | station elevations (m, SRTM 30 m, cached) |
| `arrows.json` | `arrows.geojson`: direction-arrow mile markers per course and map on a 0.1 mi grid (`show` true/false + `reason`); position and heading come from the route at that mile. Markers are data only, never drawn as text. `scripts/seed-arrows.ts` re-seeds it from `arrows_approved.json` (the 36 arrows approved on the PDF) |
| `curated/park.geojson` | `park.geojson`, simplified (DP 2 m) |
| `curated/station_labels.geojson` | aid-station label position + `align` (left/right/center, default center); optional `name` (line breaks) and `location` line. Name/hours text comes from `stations.json` |
| `curated/poi_labels.geojson` | POI labels (Rincon, Sauceda): `title`, `notes[]` (`distance: true` marks a distance line), `align`, leader `target` |
| `curated/{network,labels,pois,zoomboxes}.geojson`, `curated/layout.json` | copied verbatim: hand-tuned road classification, label placement, zoom boxes and sheet layout as approved on the PDF |
| `hillshade/*.jpg`, `logos/*` | copied; the hillshade is the only raster layer |

**Station hours rule:** opens at earliest course start + miles × pace (4 min/mi Waterhole & Mines, 5 min/mi elsewhere),
rounded to the nearest 15 min and never before 5a; closes at the latest cutoff. Start/Finish is fixed at 4a – 1a.
Station labels render the computed hours directly.

### Editing
* Cutoffs / start times: update `sources/sheet.csv` (re-export the sheet), `bun run build`.
* Course change: replace `sources/gpx/<course>.gpx`.
* Moving a label / road style / arrow: edit the curated GeoJSON (any GIS tool, keep `properties`) or `arrows_approved.json`.
* `bun tools/diff-content.ts content <other-content-dir>` compares two content trees with numeric tolerance.

## Rendering (`/site`)
`site/build.ts` loads `/content`, imports every `site/sections/*.ts` in filename order (each exports `meta = {id, title}` and
`render(ctx)`) and stacks them as `<section id>` blocks on **one scrollable page** (`dist/index.html`, no tabs or page nav);
`site/app.ts` is bundled to `dist/app.js`. **Add a section** = drop e.g. `site/sections/30-crew.ts` (data from `/content`).
Current sections: `10-map` (side-by-side map sheet), `20-stations` (aid stations & cutoffs). Print/PDF contains the map sheet only.

* `lib/mainmap.ts` – main map inline SVG; one `<g class="layer">` per toggle + legend, scale bar, north arrow, logo.
* `lib/labels.ts` – the standard station and POI label templates (fonts, sizes, line spacing, alignment).
* `lib/util.ts` `LEADER` / `leaderLine()` – the one leader-line style used by every pointer line (labels, profile callouts).
* `lib/panels.ts` – mini maps, timeline strips, elevation profile (all SVG).
* `lib/util.ts` – projection (Mercator fitted to the layout view windows), page-space path simplification, styles.

Toggles: topo (main + mini hillshade), park boundary (incl. park area labels), routes per course, zoom boxes (main map and mini maps), POIs (dots plus their labels and leader lines; aid station labels always show).
Web view: wheel/trackpad, drag, double-click, two-finger pinch and +/−/reset buttons zoom and pan the main and mini maps (`site/zoom.ts`; markers, arrows and labels keep their on-screen size; print resets). Each mini map links its Strava route (from the GPX metadata) and a GPX download (`dist/gpx/`).
Always shown: off-course roads, access styles, arrows, aid stations, distances and all labels. Hovering or touch-dragging the elevation profile marks that mile on every course that reaches it (main map + each course mini map) and lists each course’s elevation there. Start bibs: fixed 86×72 pt with a black START band along the bottom and full start times like 5:00a (`BIB_STYLE` in `lib/panels.ts`; mockups via `bun tools/bib-variants.ts`).

Layout: side-by-side ≥ 1000 px wide, stacked below.

## Print / PDF
PDF page order (18 pages): 1 = main map only (portrait), 2 = course access header + elevation profile (landscape), 3 = race-day calendar, full race day 4 AM – 2 AM plus the day-before / day-after events (portrait; built from the race calendar), 4–8 = race pages 100K, 55K, 35K, 20K, 10K (landscape), 9 = finish area plan, 10 = parking plan, 11–16 = aid-station detail pages, one per portrait page (S/F, 1–5: zoomed map, photo placeholder, hours, coordinates map link, amenities, cutoffs, busiest-times row), 17 = Operations, race-day timeline: busiest times heat map + runners on course (landscape; its own collapsible section on the web, always expanded in print) — moved to the end at print time, 18 = regional map (portrait, PDF only: Alpine / Marfa / Presidio to Lajitas / Study Butte; highways, towns, the hospital in Alpine, airstrips, Rio Grande, park boundary, race routes, aid stations, drive times; `site/lib/regional.ts`, data `sources/curated/regional.geojson` fetched once by `tools/regional-fetch.ts` + `tools/regional-airstrips.ts`, never in CI). On the web the same regional layer appears when the main map is zoomed out past its default frame (lazy-loaded `dist/region.svg`). Station number graphics link to their station page inside the PDF. Every section in `site/sections/` follows on its own letter pages (opt out with `meta.print: false`; table rows never split).
(One letter page would shrink the 36×24 design to ~30 %, making map labels ~6 pt; two pages keep them ~10 pt.)
`scripts/pdf.ts` prints the built page with headless Chromium using the same print CSS, so the **Download PDF**
button (`dist/big-bend-ultra-2027-map.pdf`) matches what the browser prints. Everything is vector except the hillshade.

## Deploy
`.github/workflows/pages.yml`: on push to `main`, sets up Bun, installs Chromium, `bun run build`, publishes `dist/` to GitHub Pages.

## Race-day timeline
`scripts/fetch-results.ts` snapshots the public RunSignup results (race 163892) into `sources/results/` (finish times + status counts only, no names).
`scripts/timeline.ts` (run by `bun run content`) builds `content/timeline.json`: sun times (NOAA equations), per-distance finish-time distributions,
a grade-adjusted pace model, runners on course per 15 min and runners passing each aid station per 15 min. All modelling assumptions are listed in the JSON.
`site/lib/timeline.ts` renders it in place of the mile strips; web auto-play sweeps the race-day clock (runner dots on the main map, toggle "Runner dots").

### Expected runners
`sources/curated/site.json` → `expectedRunners` sets the expected 2027 starters per course (defaults = 2026 starters: 100K 81, 55K 143, 35K 145, 20K 218, 10K 165).
Change a number and run `bun run build`: the on-course bands, aid-station heat rows and finish-area crowd are the 2026-shaped simulation scaled by N / 2026 starters
(the expected value of resampling N runners from the 2026 empirical finish-time distribution, so the shape is unchanged). The map's runner dots
bootstrap whole 2026 runners (seeded, ±1 % time jitter) when N differs, so they keep the real 2026 clustering. The assumption is recorded in `content/timeline.json`.

### Temperatures

The "5y avg °F" readings on the timeline are the **hourly mean over the last 5 Big Bend Ultra race days (2022–2026)**; the hover shows that same value (e.g. "58°F"). Earlier years (2019, 2020) stay in the data file but are not averaged. Race dates come from the RunSignup API (race 163892); temperatures are hourly 2 m air temperature at the Start / Finish (Barton Warnock) from the [Open-Meteo historical weather API](https://open-meteo.com/) (ERA5 reanalysis), shifted to CST. Per-year data: `sources/curated/race-temps.json` and `sources/curated/race-temps.csv`. Refresh with `bun scripts/fetch-race-temps.ts`.

### Aid-station details

The station lightbox (click a station on the map, a heat-map row icon or a race-table name) reads amenities and photos from `sources/curated/amenities.json` (null = unknown, shown as TBC). The Strava club for the race cards is `stravaClub` in `sources/curated/site.json`.

## Draft markings

One flag controls all draft markings: `sources/curated/site.json` (copied to `content/site.json` by `bun run content`).

```json
{ "draft": true }
```

When `true`, the build adds a red "DRAFT — NOT FINAL · Subject to change · Generated <date>" banner in the top margin of every
printed / PDF page, a large faint diagonal "DRAFT" watermark on the two map pages, and a small "Draft · subject to change"
notice next to Download PDF on the web page. Set it to `false` and rebuild (`bun run build`) to remove every draft marking.

<!-- links:start (generated by site/build.ts from dist/links.json; do not edit) -->
## Links

### Locations

- Rincon: <https://www.google.com/maps/search/?api=1&query=29.407652,-103.857292>
- Sauceda: <https://www.google.com/maps/search/?api=1&query=29.469013,-103.957010>
- Start / Finish: <https://www.google.com/maps/search/?api=1&query=29.270540,-103.757188>
- Waterhole: <https://www.google.com/maps/search/?api=1&query=29.317977,-103.795332>
- Contrabando: <https://www.google.com/maps/search/?api=1&query=29.300373,-103.845625>
- Whit Roy: <https://www.google.com/maps/search/?api=1&query=29.344005,-103.818072>
- Shutup: <https://www.google.com/maps/search/?api=1&query=29.445718,-103.863270>
- Solitario: <https://www.google.com/maps/search/?api=1&query=29.491795,-103.803597>
- Lajitas Trail, 22403 Lone Star Ranch Rd, Terlingua, TX 79852, USA: <https://www.google.com/maps/search/?api=1&query=Lajitas%20Trail%2C%2022403%20Lone%20Star%20Ranch%20Rd%2C%20Terlingua%2C%20TX%2079852%2C%20USA>
- Barton Warnock Visitor Center, 21800 FM170, Terlingua, TX 79852, USA: <https://www.google.com/maps/search/?api=1&query=Barton%20Warnock%20Visitor%20Center%2C%2021800%20FM170%2C%20Terlingua%2C%20TX%2079852%2C%20USA>
- 29.445718309498755, -103.86327034213237: <https://www.google.com/maps/search/?api=1&query=29.445718309498755%2C%20-103.86327034213237>
- 29.300372549553572,-103.84562511477459: <https://www.google.com/maps/search/?api=1&query=29.300372549553572%2C-103.84562511477459>
- Whit-Roy Cinnabar Mine, 1900 Sauceda Ranch Road, Redford, TX 79846, USA: <https://www.google.com/maps/search/?api=1&query=Whit-Roy%20Cinnabar%20Mine%2C%201900%20Sauceda%20Ranch%20Road%2C%20Redford%2C%20TX%2079846%2C%20USA>
- Paso al Solitario, Solitario Road, Redford, TX 79846, USA: <https://www.google.com/maps/search/?api=1&query=Paso%20al%20Solitario%2C%20Solitario%20Road%2C%20Redford%2C%20TX%2079846%2C%20USA>
- 29.31797692590845, -103.79533238192568: <https://www.google.com/maps/search/?api=1&query=29.31797692590845%2C%20-103.79533238192568>
- Map: 29.27054, -103.75719: <https://www.google.com/maps?q=29.270540,-103.757188>
- Barton Warnock Visitor Center: <https://www.google.com/maps/search/?api=1&query=Barton%20Warnock%20Visitor%20Center%2C%20TX>
- Map: 29.31798, -103.79533: <https://www.google.com/maps?q=29.317977,-103.795332>
- Map: 29.30037, -103.84563: <https://www.google.com/maps?q=29.300373,-103.845625>
- West Contrabando Trailhead: <https://www.google.com/maps/search/?api=1&query=West%20Contrabando%20Trailhead%2C%20TX>
- Map: 29.34401, -103.81807: <https://www.google.com/maps?q=29.344005,-103.818072>
- Whit-Roy Cinnabar Mine: <https://www.google.com/maps/search/?api=1&query=Whit-Roy%20Cinnabar%20Mine%2C%20TX>
- Map: 29.44572, -103.86327: <https://www.google.com/maps?q=29.445718,-103.863270>
- Map: 29.49180, -103.80360: <https://www.google.com/maps?q=29.491795,-103.803597>
- Paso al Solitario: <https://www.google.com/maps/search/?api=1&query=Paso%20al%20Solitario%2C%20TX>

### Routes

- https://www.strava.com/routes/3178910612007281564: <https://www.google.com/url?q=https://www.strava.com/routes/3178910612007281564&sa=D&source=calendar&usd=2&usg=AOvVaw2uzF0LWSjn3oAf2iaEMg_Q>
- 100K route on Strava (opens the Strava app on a phone): <https://www.strava.com/routes/3450526029363380036>
- 55K route on Strava (opens the Strava app on a phone): <https://www.strava.com/routes/3450532671815509296>
- 35K route on Strava (opens the Strava app on a phone): <https://www.strava.com/routes/3450543498764908848>
- 20K route on Strava (opens the Strava app on a phone): <https://www.strava.com/routes/3476258112199931088>
- 10K route on Strava (opens the Strava app on a phone): <https://www.strava.com/routes/3476252579046666448>
- https://www.strava.com/routes/3373755190992143280: <https://www.google.com/url?q=https://www.strava.com/routes/3373755190992143280&sa=D&source=calendar&usd=2&usg=AOvVaw3P7pIBshy_IO-cTiPtCHnl>
- https://www.strava.com/routes/3096511228948922814: <https://www.google.com/url?q=https://www.strava.com/routes/3096511228948922814&sa=D&source=calendar&usd=2&usg=AOvVaw2VBF25KLHkb5SienGm4zBW>
- https://www.strava.com/routes/3372351312211083382: <https://www.google.com/url?q=https://www.strava.com/routes/3372351312211083382&sa=D&source=calendar&usd=2&usg=AOvVaw2wKiabTYYYebU15bCN1443>
- https://www.strava.com/routes/3372327015569488194: <https://www.google.com/url?q=https://www.strava.com/routes/3372327015569488194&sa=D&source=calendar&usd=2&usg=AOvVaw3rNB8v4uUjG-xA3qyj3Y1i>
- https://www.strava.com/routes/3372350029883714678: <https://www.google.com/url?q=https://www.strava.com/routes/3372350029883714678&sa=D&source=calendar&usd=2&usg=AOvVaw12Mz3klR3rXRJayvDMkjp7>
- Trail Roots club on Strava: <https://www.strava.com/clubs/trailroots>

### Downloads

- Download PDF: <https://trail-roots.github.io/big-bend-ultra-map/big-bend-ultra-2027-map.pdf>
- Download the 100K GPX: <https://trail-roots.github.io/big-bend-ultra-map/gpx/big-bend-ultra-100k.gpx>
- Download the 55K GPX: <https://trail-roots.github.io/big-bend-ultra-map/gpx/big-bend-ultra-55k.gpx>
- Download the 35K GPX: <https://trail-roots.github.io/big-bend-ultra-map/gpx/big-bend-ultra-35k.gpx>
- Download the 20K GPX: <https://trail-roots.github.io/big-bend-ultra-map/gpx/big-bend-ultra-20k.gpx>
- Download the 10K GPX: <https://trail-roots.github.io/big-bend-ultra-map/gpx/big-bend-ultra-10k.gpx>
- 100K course page (PDF): <https://trail-roots.github.io/big-bend-ultra-map/course-100K.pdf>
- 55K course page (PDF): <https://trail-roots.github.io/big-bend-ultra-map/course-55K.pdf>
- 35K course page (PDF): <https://trail-roots.github.io/big-bend-ultra-map/course-35K.pdf>
- 20K course page (PDF): <https://trail-roots.github.io/big-bend-ultra-map/course-20K.pdf>
- 10K course page (PDF): <https://trail-roots.github.io/big-bend-ultra-map/course-10K.pdf>

### Calendar

- Trail Roots · Big Bend Ultra race page (header, logo, footer): <https://www.google.com/url?q=https://trailroots.com/big-bend-ultra&sa=D&source=calendar&usd=2&usg=AOvVaw25940H7ew4JX2DJLRB0Eav>
- An issue: <https://www.google.com/url?q=https://bigbendsentinel.com/2022/02/23/terlingua-time-cell-phone-tower-in-terlingua-stuck-an-hour-behind/&sa=D&source=calendar&usd=2&usg=AOvVaw0xgduyQO3-s-1C3phHTWtr>
- iPhone: <https://www.google.com/url?q=https://support.apple.com/guide/iphone/change-the-date-and-time-iph65f82af3e/ios&sa=D&source=calendar&usd=2&usg=AOvVaw0Q5Hh7HOv_-iFkdshpGImF>
- Android: <https://www.google.com/url?q=https://support.google.com/android/answer/2841106?hl%3Den&sa=D&source=calendar&usd=2&usg=AOvVaw30_tMqD1dTudbGjqtTE_eh>
- cross-check your time: <https://www.google.com/url?q=https://www.time.gov/&sa=D&source=calendar&usd=2&usg=AOvVaw3OITahYAH9QtqBUjv2L991>
- Subscribe to the Race: Big Bend Ultra Google Calendar: <https://calendar.google.com/calendar/u/0?cid=Njc1ZWZhYmI1ZmY0MDE1OTZlNDk5Mzg5YWRiNzdiZTU4YTUxODhkMWFkOTc1MjE1MzgxZDUzNjI1OWVlMTU0NkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t>
- Subscribe in Apple / iCal (public calendar feed): <webcal://calendar.google.com/calendar/ical/675efabb5ff401596e499389adb77be58a5188d1ad975215381d536259ee1546%40group.calendar.google.com/public/basic.ics>

### Other

- Trail Roots · Big Bend Ultra race page (header, logo, footer): <https://trailroots.com/big-bend-ultra>
- Register: <https://runsignup.com/Race/Register/?raceId=163892>
- Accommodations (Stay22, opens in a new tab): <https://www.stay22.com/embed/6a3b6089aa090046926ecf10>
- Trail Roots · Big Bend Ultra race page (header, logo, footer): <https://trailroots.com/regulations>
- https://www.t-mobile.com/coverage/satellite-phone-service: <https://www.t-mobile.com/coverage/satellite-phone-service>
- Cutoff Times: <https://docs.google.com/spreadsheets/d/1FZw9u3cEPj2rPkT9pba0crKXQ9RnULilq0reSMw1LvU/edit?usp=sharing>
<!-- links:end -->
