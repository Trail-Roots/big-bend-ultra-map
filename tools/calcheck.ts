// QA for the race calendar, Register link and map badge, with a faked clock: before / during / after race day.
// Calendar: the web layout is the SAME agenda structure at every clock (day groups, no hourly grid on screen), shows only events not yet
// over, in time order, without clipped text; print shows the hour grid from race day forward. Register: navbar link (new tab) at every
// width; build check for both draft states. usage: bun tools/calcheck.ts [url] [shots-prefix]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist } from './serve';
import { loadCalendar, raceMin } from '../scripts/lib/calendar';
// expected: every event in the race calendar feed (recurrences expanded), keyed title@start-minute
const ICS = (await loadCalendar(path.resolve(import.meta.dir, '..', 'sources'))).events.filter((e) => e.start).map((e) => ({ k: e.summary + '@' + Math.round(raceMin(e.start!)), b: raceMin(e.end ?? e.start!) }));
const root = path.resolve(import.meta.dir, '..'), srv = serveDist(0), U = process.argv[2] || `http://localhost:${srv.port}/`, out = process.argv[3];
const T0 = Date.UTC(2027, 0, 17, 6, 0), CLOCKS: [string, string][] = [['before', '2026-10-19T20:00:00Z'], ['during', '2027-01-17T19:10:00Z'], ['after', '2027-01-25T12:00:00Z']];
const b = await chromium.launch(); const bad: string[] = []; let sig0 = '';
try {
  for (const [w, q] of [[1440, ''], [390, ''], [360, ''], [800, '?view=embed']] as [number, string][]) for (const [tag, iso] of CLOCKS) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } }); await p.clock.setFixedTime(new Date(iso)); const errs: string[] = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(U + q, { waitUntil: 'networkidle', timeout: 90000 }); await p.waitForSelector('#pb-cal .cv-scroll', { state: 'attached', timeout: 30000 }); await p.waitForTimeout(400); const now = (Date.parse(iso) - T0) / 60000;
    const r = await p.evaluate((now) => { const sc = document.querySelector<HTMLElement>('#pb-cal .cv-scroll')!, vis = (e: Element) => !!(e as HTMLElement).offsetParent;
      const items = [...sc.querySelectorAll<HTMLElement>('.cv-item')], shown = items.filter(vis);
      const clip = shown.filter((e) => [...e.children].some((x) => (x as HTMLElement).scrollWidth > (x as HTMLElement).clientWidth + 1)).map((e) => e.querySelector('.cv-s')!.textContent);
      const reg = document.querySelector<HTMLAnchorElement>('.topnav a.navreg'), rb = reg?.getBoundingClientRect();
      return { sig: [...sc.querySelectorAll('.cv-dgrp')].map((g) => g.getAttribute('data-day') + ':' + g.querySelectorAll('.cv-item').length).join(',') + '|grid:' + !!sc.querySelector('.cv-grid'),
        printGridShown: vis(document.querySelector('.cv-print')!), n: shown.length, stale: shown.filter((e) => +e.dataset.b! < now).length, hiddenFuture: items.filter((e) => !vis(e) && +e.dataset.b! >= now).length,
        order: shown.every((e, i) => !i || +shown[i - 1].dataset.a! <= +e.dataset.a!), first: shown[0]?.querySelector('.cv-s')?.textContent ?? '(none)', empty: vis(sc.querySelector('.cv-empty')!), clip,
        reg: reg ? [reg.href, reg.target, rb!.width > 0 && rb!.right <= innerWidth + 0.5 && rb!.left >= -0.5] : null, ov: document.documentElement.scrollWidth - innerWidth }; }, now);
    if (!sig0) sig0 = r.sig; else if (r.sig !== sig0) bad.push(`${w}${q} ${tag}: layout differs (${r.sig})`);
    if (r.printGridShown) bad.push(`${w}${q} ${tag}: hour grid shown on screen`);
    if (r.stale || r.hiddenFuture || !r.order || r.clip.length || r.ov || errs.length) bad.push(`${w}${q} ${tag}: stale ${r.stale} hiddenFuture ${r.hiddenFuture} order ${r.order} clip ${r.clip} overflow ${r.ov} ${errs}`);
    if (tag === 'after' ? !(r.empty && r.n === 0) : r.n === 0) bad.push(`${w}${q} ${tag}: empty-state wrong (${r.n} shown)`);
    if (!r.reg || !String(r.reg[0]).includes('raceId=163892') || r.reg[1] !== '_blank' || !r.reg[2]) bad.push(`${w}${q}: Register link ${JSON.stringify(r.reg)}`);
    // shared race selection drives the calendar: each race via the elevation legend AND via the navbar (Layers) checkbox shows only its own
    // events + universal ones (title names no race); back to all races = every event. Embed / no toggles = all events (checked above).
    { const f = await p.evaluate(async (now) => { const items = [...document.querySelectorAll<HTMLElement>('#pb-cal .cv-item')], vis = (e: Element) => !!(e as HTMLElement).offsetParent, out: string[] = [];
        const cbs = [...document.querySelectorAll<HTMLInputElement>('input[data-race]')], chk = (k: string, how: string) => { for (const e of items) { const want = +e.dataset.b! >= now && (!k || !e.dataset.race || e.dataset.race === k); if (vis(e) !== want) out.push(`${how} ${k || 'all'}: ${e.querySelector('.cv-s')!.textContent}`); } };
        for (const cb of cbs) { const k = cb.dataset.race!, lg = document.querySelector<SVGGElement>(`svg.profile g.plegend[data-legend="${k}"]`);
          if (lg) { lg.dispatchEvent(new MouseEvent('click', { bubbles: true })); chk(k, 'legend'); lg.dispatchEvent(new MouseEvent('click', { bubbles: true })); chk('', 'legend-off'); } else out.push('no legend ' + k);
          cb.click(); chk(k, 'navbar'); cb.click(); chk('', 'navbar-off'); }
        return out; }, now);
      if (f.length) bad.push(`${w}${q} ${tag}: race filter ${f.slice(0, 6).join('; ')}`); }
    // feed coverage: every not-yet-ended feed event is listed, no ended one is
    { const shown = await p.evaluate(() => [...document.querySelectorAll<HTMLElement>('#pb-cal .cv-item')].filter((e) => !!e.offsetParent).map((e) => e.querySelector('.cv-s')!.textContent + '@' + Math.round(+e.dataset.a!)));
      const want = ICS.filter((e) => e.b >= now).map((e) => e.k), miss = want.filter((k) => !shown.includes(k)), extra = shown.filter((k) => !want.includes(k));
      if (miss.length || extra.length) bad.push(`${w}${q} ${tag}: feed coverage missing [${miss.join(', ')}] extra [${extra.join(', ')}]`); }
    console.log(w, q || 'site', tag, 'shown', r.n, 'first', r.first, r.empty ? '(empty state)' : '');
    if (out) { const c = await p.$('#pb-cal'); await c!.scrollIntoViewIfNeeded(); await c!.screenshot({ path: `${out}-cal-${w}${q ? '-embed' : ''}-${tag}.png` }); if (tag === 'during') await p.screenshot({ path: `${out}-nav-${w}${q ? '-embed' : ''}.png`, clip: { x: 0, y: 0, width: w, height: 60 } }); }
    await p.close(); }
  // map badge: temperature (5y avg) on the daylight badge, no clipping at 360
  for (const w of [1440, 360]) { const p = await b.newPage({ viewport: { width: w, height: 900 } }); await p.goto(U, { waitUntil: 'networkidle', timeout: 90000 }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const e = document.querySelector<HTMLElement>('.daynight')!, m = document.querySelector('svg.mainmap')!.getBoundingClientRect(), r = e.getBoundingClientRect(); return [e.textContent, getComputedStyle(e).display !== 'none' && r.left >= m.left - .5 && r.right <= m.right + .5 && e.scrollWidth <= e.clientWidth + 1]; });
    if (!/\d+°F$/.test(String(r[0])) || !r[1]) bad.push(`${w}: badge ${JSON.stringify(r)}`); console.log(w, 'badge', r[0]);
    if (out) { const e = await p.$('.daynight'); const bb = (await e!.boundingBox())!; await p.screenshot({ path: `${out}-badge-${w}.png`, clip: { x: Math.max(0, bb.x - 30), y: Math.max(0, bb.y - 10), width: Math.min(w - Math.max(0, bb.x - 30), bb.width + 60), height: bb.height + 20 } }); }
    await p.close(); }
} finally { await b.close(); srv.stop(true); }
// Register in print follows the draft flag: build once with draft=false into a temp dir and check, then restore
if (!process.argv[2]) { const f = path.join(root, 'content', 'site.json'), orig = fs.readFileSync(f, 'utf8'), D = path.join(root, 'dist'), bak = D + '.calcheck-bak';
  fs.rmSync(bak, { recursive: true, force: true }); fs.cpSync(D, bak, { recursive: true }); // the test build replaces dist/: keep the real build (PDF, print images) and put it back
  try { fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(orig), draft: false })); const r = Bun.spawnSync(['bun', 'site/build.ts'], { cwd: root });
    const h = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8'); if (r.exitCode || h.includes('class="regprint"') || !h.includes('class="ui navreg"')) bad.push('final build: print Register line must be gone, navbar link kept');
    else console.log('final (draft=false) build: navbar Register kept, print Register line removed'); }
  finally { fs.writeFileSync(f, orig); fs.rmSync(D, { recursive: true, force: true }); fs.renameSync(bak, D); } }
if (bad.length) { console.error('[calcheck] ' + bad.join('\n[calcheck] ')); process.exit(1); } console.log('calcheck ok');
