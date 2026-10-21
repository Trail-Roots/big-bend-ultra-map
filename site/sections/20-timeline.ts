import { renderTimeline, renderIdleHeat } from '../lib/timeline';
import { renderCalendar } from '../lib/calview';
import { renderParkingViewer, renderFinishViewer, SW } from '../lib/floorplan-svg';
import { planLegend } from '../lib/siteplan';
import { CAL_LINKS } from './10-map';
import type { Ctx } from '../lib/types';
import { icon } from '../lib/icons';
// Web: ONE section with a right-aligned view toggle (Race calendar = default | Race timeline | Race parking | Race finish); only the active
// view shows. The calendar view has a race filter (one race + universal events). Print: unchanged, this section prints only the race-day
// timeline page (always expanded); the calendar prints from the map section (page 3) and the plans from 36-finish / 37-parking.
export const meta = { id: 'timeline', title: 'Race-day timeline' };
const VIEWS: [string, string][] = [['cal', 'Race calendar'], ['tl', 'Race timeline'], ['park', 'Race parking'], ['fin', 'Race finish']];
const NOTICES = `<p class="tow-notice" style="border-left:4px solid #c4161c;background:#fbeeee;padding:6px 10px;margin:8px 0;font-weight:600">Park fully off the pavement. If any part of your vehicle is over the pavement, it may be towed or ticketed.</p>
<p class="infobox"><b>Only Bibbed Runners Allowed On Course</b></p>`;
const prev = (k: string, im: string) => `<button type="button" class="pl-prev" data-plan="${k}" aria-label="View the ${k === 'park' ? 'parking' : 'finish area'} plan full size (pan and zoom)">${im}<span class="pl-full">${icon('expand')}View full size</span></button>`;
export function render(c: Ctx) {
  const tabs = `<div class="ui vw-tabs" role="tablist" aria-label="Race day views">${VIEWS.map(([k, t], i) => `<button type="button" role="tab" class="vw-tab" id="vw-tab-${k}" data-view="${k}" aria-controls="vw-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join('')}</div>`;
  const races = `<div class="ui cv-rf" role="group" aria-label="Show events for race"><button type="button" class="cv-rbtn" data-race="" aria-pressed="true">All races</button>${c.courses.order.map((k) => `<button type="button" class="cv-rbtn" data-race="${k}" aria-pressed="false" style="--c:${c.courses.colors[k]}"><i aria-hidden="true"></i>${k}</button>`).join('')}</div>`;
  return `<div class="doc tlpage" data-view="cal">
  <div class="tl-head"><h2 class="vw-pr">Race-day timeline</h2><h2 class="ui vw-ttl">Race calendar</h2>${tabs}</div>
  <div class="ui vw-pane vw-cal on" id="vw-cal" role="tabpanel" aria-labelledby="vw-tab-cal">${races}<div class="calbox vw-calbox">${renderCalendar(c)}${CAL_LINKS}</div></div>
  <div class="vw-pane vw-tl" id="vw-tl" role="tabpanel" aria-labelledby="vw-tab-tl">
  <p class="note tl-note">Busiest times at each aid station (modelled per 15 min) and runners on course through race day.</p>
  <div class="tlbox" id="tl-body">${renderTimeline(c)}</div></div>
  <div class="ui vw-pane vw-park plan" id="vw-park" role="tabpanel" aria-labelledby="vw-tab-park"><h3 class="vw-sub">Parking · Barton Warnock Visitor Center</h3>${prev('park', renderParkingViewer(false))}
${planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.gate(), 'Restricted entry gate'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories']])}
${NOTICES}</div>
  <div class="ui vw-pane vw-fin plan" id="vw-fin" role="tabpanel" aria-labelledby="vw-tab-fin"><h3 class="vw-sub">Finish area · Barton Warnock Visitor Center</h3>${prev('fin', renderFinishViewer(false))}
${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.noParkZone(), 'No parking zone']])}
<figure class="idlebox"><figcaption>Runners off course at the start / finish (waiting to start or finished) · modelled: arrive 15–75 min before their start, stay 1–2 h after finishing</figcaption>${renderIdleHeat(c)}</figure></div>
</div>
<dialog class="lightbox planbox" id="planbox" aria-label="Site plan"><button type="button" class="lb-close" aria-label="Close">${icon('x')}</button><div class="lb-body"><div class="plan pl-one" data-plan="park"><h3>Parking · Barton Warnock Visitor Center</h3>${renderParkingViewer()}${planLegend([[SW.parkZone(), 'Parking zone'], [SW.parkSign(), 'Parking'], [SW.noParkZone(), 'No parking zone'], [SW.noParkSign(), 'No parking'], [SW.trail(), 'Trail'], [SW.sf(), 'Start / Finish line'], [SW.gate(), 'Restricted entry gate'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories']])}</div><div class="plan pl-one" data-plan="fin" hidden><h3>Finish area · Barton Warnock Visitor Center</h3>${renderFinishViewer()}${planLegend([[SW.sf(), 'Start / Finish line'], [SW.trail(), 'Trail'], [SW.radio(), 'Radio Command'], [SW.restroom(), 'Lavatories'], [SW.gate(), 'Restricted entry gate'], [SW.noParkZone(), 'No parking zone']])}</div></div></dialog>`;
}
