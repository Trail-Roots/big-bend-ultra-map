// Browser-style print scenarios: whole site printed while a race lightbox is open, and "Print this course" from inside the lightbox.
import { chromium } from 'playwright';
import { serveDist } from './serve';
const srv = serveDist(0), b = await chromium.launch({ channel: 'chromium' }), url = process.argv[2] ?? `http://localhost:${srv.port}/`;
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.click('.racecard[data-course="35K"] .rc-full'); await p.waitForTimeout(300);
  await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await p.pdf({ path: '/tmp/print-lb.pdf', preferCSSPageSize: true, printBackground: true });
  await p.evaluate(() => dispatchEvent(new Event('afterprint')));
  // print one course from inside the lightbox (window.print stubbed: fire the events around the PDF instead)
  await p.evaluate(() => { (window as any).print = () => {}; });
  await p.click('.racecard[data-course="20K"] .rc-full'); await p.waitForTimeout(300);
  await p.click('#racebox button.printone'); await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await p.pdf({ path: '/tmp/print-one.pdf', preferCSSPageSize: true, printBackground: true });
  console.log('ok');
} finally { await b.close(); srv.stop(true); }
