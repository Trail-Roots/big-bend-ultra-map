// ONE north arrow for every map (SSOT): the classic split-needle with a serif "N" (28 x 52 design units).
// Size rule everywhere: needle height = 6.5 % of the map's width, inset 1.5 % of the width from its corner.
const NEEDLE = '<text x="14" y="13" font-family="Georgia,serif" font-size="15" font-weight="700" text-anchor="middle" fill="#1e293b">N</text><path d="M14,16L14,40L6,49Z" fill="#1e293b"/><path d="M14,16L22,49L14,40Z" fill="#fff" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round"/><path d="M14,16L6,49L14,40Z" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-linejoin="round"/>';
export const NORTH_H = 0.065, NORTH_INSET = 0.015, NORTH_AR = 28 / 52;
/** inside an SVG map of width W: the arrow's box with its top-left at (x, y) */
export const northBox = (W: number, x: number, y: number) => { const h = W * NORTH_H, w = h * NORTH_AR; return { x0: x, y0: y, x1: x + w, y1: y + h, w, h }; };
export const northG = (W: number, x: number, y: number) => { const b = northBox(W, x, y), k = b.h / 52; return `<g class="north" transform="translate(${b.x0.toFixed(1)} ${b.y0.toFixed(1)}) scale(${k.toFixed(4)})" role="img" aria-label="North">${NEEDLE}</g>`; };
/** stand-alone icon (HTML overlays, e.g. floor plans); CSS sizes it by the same rule (6.5 % of the map width) */
export const northIcon = (cls = '') => `<svg class="north-ic ${cls}" viewBox="0 0 28 52" role="img" aria-label="North">${NEEDLE}</svg>`;
