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
| `arrows_approved.json` | `arrows.geojson` — the frozen, approved 36 direction arrows (no auto-placement) |
| `curated/park.geojson` | `park.geojson`, simplified (DP 2 m) |
| `curated/station_labels.geojson` | aid-station label position + `align` (left/right/center, default center); optional `name` (line breaks) and `location` line. Name/hours text comes from `stations.json` |
| `curated/poi_labels.geojson` | POI labels (Rincon, Sauceda): `title`, `notes[]` (`distance: true` marks text hidden by the Distances toggle), `align`, leader `target` |
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
`site/build.ts` loads `/content`, imports every `site/pages/*.ts` (each exports `meta = {path, title, nav}` and
`render(ctx)`), wraps it in `site/template.html` and writes `dist/`; `site/app.ts` is bundled to `dist/app.js`.
**Add a page** = drop `site/pages/foo.ts`; it is routed to `meta.path` and appears in the nav automatically.

* `lib/mainmap.ts` – main map inline SVG; one `<g class="layer">` per toggle + legend, scale bar, north arrow, logo.
* `lib/labels.ts` – the standard station and POI label templates (fonts, sizes, line spacing, alignment, leaders).
* `lib/panels.ts` – mini maps, timeline strips, elevation profile (all SVG).
* `lib/util.ts` – projection (Mercator fitted to the layout view windows), page-space path simplification, styles.

Toggles: topo, park boundary, off-course roads, per-course routes, zoom boxes, POIs, labels, and Distances (hides every
distance text: timeline mileages, profile mile axis, POI distance notes). Access styles, arrows and aid stations are always on.

Layout: side-by-side ≥ 1000 px wide, stacked below.

## Print / PDF
US Letter portrait only, 2 pages: page 1 = main map, page 2 = header, mini maps, timelines and elevation profile.
(One letter page would shrink the 36×24 design to ~30 %, making map labels ~6 pt; two pages keep them ~10 pt.)
`scripts/pdf.ts` prints the built page with headless Chromium using the same print CSS, so the **Download PDF**
button (`dist/big-bend-ultra-2027-map.pdf`) matches what the browser prints. Everything is vector except the hillshade.

## Deploy
`.github/workflows/pages.yml`: on push to `main`, sets up Bun, installs Chromium, `bun run build`, publishes `dist/` to GitHub Pages.
