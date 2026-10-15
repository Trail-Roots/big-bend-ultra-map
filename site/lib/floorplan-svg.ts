// Both floor plans show Erik's drawing (sources/floorplan.svg, copied byte-for-byte to dist/plans/floorplan.svg) as an
// <img> of the untouched file; the only difference between the plans is the zoom, set with an SVG view fragment.
// Nothing is drawn on top of the drawing.
type View = { x: number; y: number; w: number; h: number };
export const FINISH_VIEW: View = { x: 1010, y: 1690, w: 830, h: 650 }; // lot, picnic area, S/F, building front, gate + drop-off at the Y
export const PARKING_VIEW: View = { x: 0, y: 0, w: 4100, h: 2900 }; // the whole drawing: every parking / no-parking stretch along FM 170
// classic split-needle north arrow, an overlay layer fixed in a map corner (outside the zoom stage, so it never scales or pans)
const NORTH = (corner: 'tl' | 'tr') => `<svg class="fp-north fp-${corner}" viewBox="0 0 28 52" width="28" height="52" role="img" aria-label="North"><text x="14" y="13" font-family="Georgia,serif" font-size="15" font-weight="700" text-anchor="middle" fill="#1e293b">N</text><path d="M14,16L14,40L6,49Z" fill="#1e293b"/><path d="M14,16L22,49L14,40Z" fill="#fff" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round"/><path d="M14,16L6,49L14,40Z" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const img = (v: View, alt: string, corner: 'tl' | 'tr') =>
  `<div class="fp-zoom" title="Wheel to zoom, drag to pan, double-click to reset"><div class="fp-stage"><img class="floorplan-img" src="plans/floorplan.svg#svgView(viewBox(${v.x},${v.y},${v.w},${v.h}))" width="${v.w}" height="${v.h}" alt="${alt}" style="display:block;width:100%;height:auto;aspect-ratio:${v.w}/${v.h};background:#fff" draggable="false"></div>${NORTH(corner)}</div>`;
export const renderFinishPlan = () => img(FINISH_VIEW, 'Finish area floor plan', 'tr') // top-right is open ground;
export const renderParkingPlan = () => img(PARKING_VIEW, 'Parking plan', 'tl') // top-left is open ground (property line runs down the right);

// legend swatches drawn with the drawing's own fills/strokes (taken from sources/floorplan.svg)
const box = (fill: string, stroke: string, sw = 1.6, extra = '') => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><rect x="2" y="2" width="26" height="16" rx="2" style="fill:${fill};stroke:${stroke};stroke-width:${sw}px"/>${extra}</svg>`;
const line = (inner: string) => `<svg viewBox="0 0 30 20" width="30" height="20" aria-hidden="true">${inner}</svg>`;
export const SW = {
  pavement: () => box('rgb(139,146,154)', 'rgb(71,82,94)', 1.8),
  trail: () => box('rgb(233,223,198)', 'rgb(194,178,147)', 1),
  sf: () => line(`<rect x="2" y="6" width="26" height="8" style="fill:rgb(15,23,42)"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${3 + i * 3.6}" y="${i % 2 ? 6 : 10}" width="1.8" height="4" fill="#fff"/>`).join('')}`),
  island: () => box('rgb(228,218,196)', 'rgb(123,134,148)', 0.9),
  tree: () => line(`<circle cx="15" cy="10" r="6.8" style="fill:rgb(79,119,59);stroke:rgb(37,56,27);stroke-width:1.3px"/><circle cx="15" cy="10" r="3.1" style="fill:rgb(57,87,42)"/>`),
  picnic: () => box('rgba(105,90,70,.75)', 'rgb(74,55,40)'),
  shelter: () => box('rgb(158,27,27)', 'rgb(43,18,18)', 1),
  building: () => box('rgb(245,248,252)', 'rgb(62,74,89)', 1.4),
  band: () => box('rgb(145,61,34)', 'rgb(62,74,89)', 1.4),
  stalls: () => line(`<rect x="1" y="1" width="28" height="18" style="fill:rgb(139,146,154)"/>${[6, 13, 20].map((x) => `<path d="M${x},3V14" style="stroke:white;stroke-width:1.6px"/>`).join('')}<path d="M4,17H11M17,17H24" style="stroke:rgb(234,179,8);stroke-width:2.6px"/>`),
  restroom: () => box('rgb(219,234,254)', 'rgb(29,78,216)', 1.1),
  radio: () => line(`<rect x="2" y="5" width="26" height="10" rx="1.5" style="fill:rgb(248,250,252);stroke:rgb(30,41,59);stroke-width:1.5px"/><rect x="19" y="5" width="9" height="10" style="fill:rgb(148,163,184);stroke:rgb(30,41,59);stroke-width:1.2px"/><circle cx="8" cy="10" r="2" style="fill:rgb(239,68,68)"/>`),
  gate: () => line(`<path d="M3,10H27" style="stroke:rgb(30,41,59);stroke-width:4.4px;stroke-linecap:round"/><path d="M3,10H27" style="stroke:rgb(239,68,68);stroke-width:3px;stroke-dasharray:3.5,3.5"/><path d="M3,10H27" style="stroke:white;stroke-width:3px;stroke-dasharray:0,3.5,3.5,0"/>`),
  dropoff: () => box('rgba(228,211,42,.26)', 'rgba(228,211,42,.26)', 0),
  noParkZone: () => line(`<rect x="2" y="6" width="26" height="8" fill="#fff"/>${[0, 1, 2, 3].map((i) => `<rect x="${2 + i * 7}" y="6" width="3.5" height="8" style="fill:rgb(239,68,68)"/>`).join('')}`),
  noParkSign: () => line(`<circle cx="15" cy="10" r="7.5" style="fill:white;stroke:rgb(220,38,38);stroke-width:2px"/><path d="M10,5L20,15" style="stroke:rgb(220,38,38);stroke-width:2px"/><text x="15" y="13.5" font-size="9" font-weight="700" text-anchor="middle" style="fill:rgb(30,41,59)">P</text>`),
  parkZone: () => box('rgba(59,130,246,.26)', 'rgb(29,78,216)', 2),
  parkSign: () => line(`<rect x="7" y="2" width="16" height="16" rx="2" style="fill:rgb(29,78,216);stroke:white;stroke-width:1px"/><text x="15" y="14.5" font-size="11" font-weight="700" text-anchor="middle" fill="white">P</text>`),
  boundary: () => line(`<path d="M1,10H29" style="stroke:rgb(220,38,38);stroke-width:2.4px;stroke-dasharray:7,3,2,3"/>`),
  pillarFence: () => line(`<path d="M2,10H28" style="stroke:rgb(43,27,16);stroke-width:3px"/><path d="M2,10H28" style="stroke:rgb(184,155,122);stroke-width:1.2px;stroke-dasharray:4,3"/>${[4, 15, 26].map((x) => `<rect x="${x - 2.5}" y="7.5" width="5" height="5" style="fill:rgb(239,232,216);stroke:rgb(62,53,43);stroke-width:1.1px"/>`).join('')}`),
  wireFence: () => line(`<path d="M2,10H28" style="stroke:rgb(61,49,36);stroke-width:1.7px"/>${[5, 15, 25].map((x) => `<circle cx="${x}" cy="10" r="1.8" style="fill:rgb(74,63,49);stroke:rgb(244,239,225);stroke-width:.6px"/>`).join('')}`),
  terrain: () => box('rgb(214,201,174)', 'rgb(189,169,136)', 1),
};
