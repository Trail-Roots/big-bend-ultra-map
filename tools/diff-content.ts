// Compare two content dirs: bun tools/diff-content.ts <a> <b> [tol]
import fs from 'node:fs'; import path from 'node:path';
const [A, B, tolS] = process.argv.slice(2); const tol = Number(tolS ?? 1e-6);
const walk = (d: string, p = ''): string[] => fs.readdirSync(path.join(d, p), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d, path.join(p, e.name)) : [path.join(p, e.name)]);
let bad = 0;
const cmp = (a: any, b: any, at: string, out: string[]): void => {
  if (out.length > 5) return;
  if (typeof a === 'number' && typeof b === 'number') { if (Math.abs(a - b) > tol * Math.max(1, Math.abs(b) > 1000 ? Math.abs(b) / 1000 : 1)) out.push(`${at}: ${a} vs ${b}`); return; }
  if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) { out.push(`${at}: len ${a.length} vs ${b.length}`); return; } a.forEach((v, i) => cmp(v, b[i], `${at}[${i}]`, out)); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], `${at}.${k}`, out); return; }
  if (a !== b) out.push(`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
};
const fa = new Set(walk(A)), fb = new Set(walk(B));
for (const f of [...new Set([...fa, ...fb])].sort()) {
  if (!fa.has(f) || !fb.has(f)) { console.log('ONLY IN', fa.has(f) ? 'A' : 'B', f); bad++; continue; }
  const x = fs.readFileSync(path.join(A, f)), y = fs.readFileSync(path.join(B, f));
  if (!/\.(json|geojson)$/.test(f)) { const same = x.equals(y); console.log(same ? 'same ' : 'DIFF ', f); bad += +!same; continue; }
  const out: string[] = []; cmp(JSON.parse(x.toString()), JSON.parse(y.toString()), '', out);
  console.log(out.length ? 'DIFF ' : 'ok   ', f, out.slice(0, 5).join(' | ')); bad += +!!out.length;
}
process.exit(bad ? 1 : 0);
