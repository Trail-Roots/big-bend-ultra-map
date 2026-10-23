// Text advance widths from the bundled DejaVu fonts (TTF cmap format 4 + hmtx), for build-time label placement (regplace.ts).
import fs from 'node:fs';
import path from 'node:path';
type M = { upm: number; adv: Map<number, number>; def: number };
const cache = new Map<string, M>();
function load(file: string): M {
  const b = fs.readFileSync(path.join(import.meta.dir, '..', 'public', 'fonts', file)), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getUint16(4), T: Record<string, number> = {};
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; T[String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])] = dv.getUint32(o + 8); }
  const upm = dv.getUint16(T.head + 18), nH = dv.getUint16(T.hhea + 34), hm = (g: number) => dv.getUint16(T.hmtx + Math.min(g, nH - 1) * 4);
  const adv = new Map<number, number>(), nt = dv.getUint16(T.cmap + 2);
  for (let i = 0; i < nt; i++) { const pid = dv.getUint16(T.cmap + 4 + i * 8), eid = dv.getUint16(T.cmap + 6 + i * 8), so = T.cmap + dv.getUint32(T.cmap + 8 + i * 8);
    if (pid !== 3 || eid !== 1 || dv.getUint16(so) !== 4) continue;
    const sc = dv.getUint16(so + 6) / 2, e = so + 14, s0 = e + sc * 2 + 2, d0 = s0 + sc * 2, r0 = d0 + sc * 2;
    for (let k = 0; k < sc; k++) { const end = dv.getUint16(e + k * 2), st = dv.getUint16(s0 + k * 2), dl = dv.getInt16(d0 + k * 2), ro = dv.getUint16(r0 + k * 2);
      for (let cp = st; cp <= end && cp < 0x3000; cp++) { let g = 0; if (!ro) g = (cp + dl) & 0xffff; else { const gi = dv.getUint16(r0 + k * 2 + ro + (cp - st) * 2); g = gi ? (gi + dl) & 0xffff : 0; } if (g) adv.set(cp, hm(g)); } }
    break; }
  return { upm, adv, def: hm(0) };
}
/** advance width of plain text s at font size fs (bold / italic select the face; ls = letter-spacing in output units) */
export function textW(s: string, fs: number, bold = false, italic = false, ls = 0) {
  const f = `DejaVuSans${bold ? '-Bold' : ''}${italic ? (bold ? 'Oblique' : '-Oblique') : ''}.ttf`;
  let m = cache.get(f); if (!m) cache.set(f, (m = load(f)));
  let w = 0; for (const ch of s) w += m.adv.get(ch.codePointAt(0)!) ?? m.def;
  return w / m.upm * fs + ls * [...s].length;
}
