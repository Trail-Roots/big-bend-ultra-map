// Print the built site from different window sizes (as a user would with Ctrl+P) to catch viewport-dependent print bugs.
import { chromium } from 'playwright';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch();
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(`http://localhost:${srv.port}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.pdf({ path: `/tmp/print-${w}.pdf`, preferCSSPageSize: true, printBackground: true });
    await p.close();
  }
} finally { await b.close(); srv.stop(true); }
