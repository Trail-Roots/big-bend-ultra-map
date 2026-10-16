// Print the built (or live) site the way a desktop browser does: full Chromium (not the headless shell), 1440 window, Ctrl+P equivalent.
// usage: bun tools/printcheck.ts [url] [out.pdf]
import { chromium } from 'playwright';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch({ channel: 'chromium' });
try {
  const url = process.argv[2] ?? `http://localhost:${srv.port}/`, out = process.argv[3] ?? '/tmp/print-full.pdf';
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  console.log('printed', out);
} finally { await b.close(); srv.stop(true); }
