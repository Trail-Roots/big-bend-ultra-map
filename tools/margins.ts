// Measure printed margins (inches) per page of the letter PDF renders: bbox of non-white pixels.
import { PNG } from 'pngjs'; import fs from 'node:fs';
const dpi = Number(process.argv[2] || 100);
for (const f of fs.readdirSync('previews').filter((f) => /^print-letter-\d+\.png$/.test(f)).sort()) {
  const p = PNG.sync.read(fs.readFileSync(`previews/${f}`)); let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) { const i = (y * p.width + x) * 4; if (p.data[i] < 245 || p.data[i + 1] < 245 || p.data[i + 2] < 245) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const r = (v: number) => (v / dpi).toFixed(2);
  console.log(f, `${(p.width / dpi).toFixed(1)}x${(p.height / dpi).toFixed(1)}in`, 'top', r(y0), 'bottom', r(p.height - 1 - y1), 'left', r(x0), 'right', r(p.width - 1 - x1));
}
