# Big Bend Ultra – course map website

Static, responsive and printable version of the Big Bend Ultra 2027 race map
(same geometry and placement decisions as `big-bend-ultra-2027-race-map.pdf`, page 1).

```
content/   data only (no styling decisions beyond named colors)
site/      rendering: build script, page modules, SVG renderers, CSS, tiny client JS
tools/     export_content.py (pipeline -> content), shoot.mjs (screens + print PDFs)
dist/      build output (git-ignored)
previews/  desktop / mobile / print renders
```

## Content (`/content`)
| file | what |
|---|---|
| `courses/{100K,55K,35K,20K,10K}.geojson` | course lines |
| `network.geojson` | every drawn road/trail. `cls`: `paved`, `unpaved`, `4x4`, `foot_bike`, `foot`, `connector`; `on_course` true = bold ink access style, false = thin gray off-course |
| `park.geojson` | park boundary ways (`kind: boundary`), park polygon, private inholdings |
| `zones.geojson` | access zones (4x4 only / ATV-emergency / no vehicles), hidden by default |
| `pois.geojson` | Rincon, 10K turnaround |
| `labels.geojson` | `kind: curved` LineStrings (rendered with `<textPath>`), plus every placed text (station labels/hours, Rincon, Sauceda, Private, zoom box labels…) as Points at their final position, with font size, halo and leader lines |
| `arrows.geojson` | the frozen arrow set from `arrows_approved.json` (36 chevrons; `map` = main or a course mini map) |
| `zoomboxes.geojson` | per-course zoom rectangles |
| `stations.json`, `cutoffs.json`, `courses.json`, `colors.json` | stations (hours, spectator access, elevation), per-course miles + cutoffs, start times, palette |
| `profiles/*.json` | elevation profile (mile, ft) per course + station callout placement |
| `layout.json` | sheet layout (figure fractions of the 36×24 in page), map view windows (EPSG:3857), legend box, scale bar, hillshade bounds |
| `hillshade/*.jpg` | the **only raster**: hillshade underlay for the main map (300 dpi at print size) and each mini map |

All coordinates are WGS84 lon/lat. The renderer projects with d3-geo Mercator fitted to the view windows in `layout.json`, so the SVG lines up exactly with the PDF axes.

### Editing content
* Small edits (cutoff time, station hours, label text, a color): edit the JSON/GeoJSON directly and rebuild.
* Moving a label: change its Point coordinate in `labels.geojson` (curved labels: edit the LineString the text follows).
* Geometry changes: edit the GeoJSON in any GIS tool (QGIS, geojson.io) keeping the `properties`.
* Full re-export from the Python map pipeline (`/workspace/big-bend-ultra-map`):
  `cp tools/export_content.py ../big-bend-ultra-map/ && cd ../big-bend-ultra-map && BBU_EXPORT=1 .venv/bin/python make.py`
  (make.py execs the exporter just before saving the PDF; it writes straight into `content/`).

## Rendering (`/site`)
Plain Node ESM, no framework. `site/build.mjs` loads `/content`, imports every module in `site/pages/*.mjs`
(each exports `meta = {path, title, nav}` and `render(ctx)`), wraps it in `site/template.html` and writes `dist/`.
**Add a page** = drop a new `site/pages/foo.mjs`; it is routed to `meta.path` and appears in the nav automatically.

* `lib/mainmap.mjs` – main map inline SVG; one `<g class="layer" data-layer=…>` per toggle (topo, park, zones, roads, access, courses, zoom, arrows, stations, pois, labels) + legend, scale bar, north arrow, logo.
* `lib/panels.mjs` – mini maps (bibs, turnaround glyph), timeline strips, elevation profile – all SVG.
* `public/` – CSS (screen + print), `app.js` (layer toggles, print size), DejaVu fonts (same fonts as the PDF).

Layout: side-by-side ≥1000 px wide, stacked below. Print: `@page 36in 24in`, UI hidden, every panel absolutely
positioned at its PDF figure position. Fallbacks: choose "tabloid" or "letter" in the print menu (or `?paper=tabloid`),
which scales the full sheet onto 17×11 / 11×8.5.

## Build / preview
```
npm ci
npm run build      # -> dist/
npm run preview    # http://localhost:8787
npm run shots      # previews/*.png + print PDFs (needs: npx playwright install chromium)
```

## Deploy (Cloudflare Pages)
Connect the GitHub repo in Cloudflare Pages → Framework preset: None
* Build command: `npm run build`
* Build output directory: `dist`
* Environment: `NODE_VERSION=20`

or from CLI: `npm run build && npx wrangler pages deploy dist` (`wrangler.toml` sets `pages_build_output_dir`).
