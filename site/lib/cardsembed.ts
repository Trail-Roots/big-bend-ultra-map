// LIMITED embed for other sites (e.g. RunSignup): dist/cards-embed.html = compact race-card previews only (thumbnail, race name,
// distance, elevation gain, start). No GPX / Strava / lightbox / nav / calendar / DRAFT marks. EVERY link goes to the Trail Roots race page
// in a new tab. Thumbnails: dist/cards/<race>.jpg, shot from the race-card maps by scripts/pdf.ts. Auto-height via cards-embed.js (postMessage).
import type { Ctx } from './types';
import { esc } from './util';
import { miniBibSvg } from './panels';
import { totalGain } from './coursetable';
export const CARDS_TARGET = 'https://trailroots.com/big-bend-ultra';
export function cardsEmbedHtml(c: Ctx) {
  const T = CARDS_TARGET, L = (inner: string, cls: string, label: string) => `<a class="${cls}" href="${T}" target="_blank" rel="noopener" aria-label="${esc(label)}">${inner}</a>`;
  const cards = c.courses.order.map((k) => { const C = c.courses.courses[k], cc = c.courses.colors[k];
    return `<li style="--rc:${cc}">${L(`<img src="cards/${encodeURIComponent(k)}.jpg" alt="" width="400" height="250"><span class="b"><span class="h">${miniBibSvg(k, cc, 0.8)}<span class="n">Big Bend Ultra ${esc(k)}</span></span><span class="s"><span><i>Distance</i>${C.distance_mi.toFixed(1)} mi</span><span><i>Elev gain</i>${totalGain(c, k).toLocaleString('en-US')} ft</span><span><i>Start</i>${esc(C.start)}</span></span></span>`, 'card', `Big Bend Ultra ${k}: full race details on trailroots.com`)}</li>`; }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Big Bend Ultra races</title><base target="_blank">
<style>
:root{--ink:#2a2a2a;--mute:#666;--line:#d4d4d4;--bg:#f4f4f4}
*{box-sizing:border-box}html,body{margin:0;background:transparent;overflow:hidden}body{font:400 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);padding:2px}
ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px}
a.card{display:flex;flex-direction:column;height:100%;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden;color:inherit;text-decoration:none;box-shadow:0 1px 2px #0000000f}
a.card:hover,a.card:focus-visible{border-color:#9a9a9a;box-shadow:0 2px 6px #0000001f;outline:none}
a.card img{display:block;width:100%;height:auto;background:var(--bg);border-bottom:3px solid var(--rc)}
.b{display:block;padding:8px 10px 10px}.h{display:flex;align-items:center;gap:6px;font-weight:700;font-size:15px}.h svg{flex:none;height:18px;width:auto}
.s{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-weight:650}.s span{display:flex;flex-direction:column}.s i{font-style:normal;font-weight:500;font-size:11.5px;color:var(--mute)}
.more{display:flex;justify-content:flex-end;margin-top:8px}.more a{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;background:var(--bg);border:1px solid var(--line);border-radius:6px;color:var(--ink);font-weight:600;font-size:13px;text-decoration:none}.more a:hover{background:#e9e9e9}
</style></head><body><ul>${cards}</ul><div class="more">${L('Full race details →', 'mlink', 'Full race details on trailroots.com')}</div>
<script>(function(){var last=0;function send(){var h=Math.ceil(document.documentElement.getBoundingClientRect().height);if(h&&h!==last){last=h;parent.postMessage({type:'bbu-cards-height',height:h},'*');}}
addEventListener('load',send);addEventListener('resize',send);if(window.ResizeObserver)new ResizeObserver(send).observe(document.body);document.querySelectorAll('img').forEach(function(i){i.addEventListener('load',send);});send();
addEventListener('message',function(e){if(e.data&&e.data.type==='bbu-cards-ping'){last=0;send();}});})();</script></body></html>`;
}
