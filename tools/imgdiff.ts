// bun tools/imgdiff.ts a.png b.png [diff.png] -> % pixels differing
import fs from 'node:fs'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
const [a, b, o] = process.argv.slice(2); const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
if (A.width !== B.width || A.height !== B.height) { console.log(`size ${A.width}x${A.height} vs ${B.width}x${B.height}`); process.exit(1); }
const D = new PNG({ width: A.width, height: A.height }); const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
if (o) fs.writeFileSync(o, PNG.sync.write(D));
console.log(`${a}: ${n} px differ (${((100 * n) / (A.width * A.height)).toFixed(3)}%)`);
