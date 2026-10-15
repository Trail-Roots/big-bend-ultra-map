// Race-day calendar (live Google Calendar embed, web only).
import { CAL_ID } from '../../scripts/lib/calendar';
export const meta = { id: 'info', title: 'Race-day calendar', print: false };
export function render() {
  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CAL_ID)}&ctz=America%2FChicago&mode=AGENDA&dates=20270116%2F20270119&showTitle=0&showPrint=0&showTabs=1&showCalendars=0`;
  return `<article class="doc info">
<section class="ui calview"><h2>Race-day calendar</h2><p class="note">Live view of the official race calendar (the source for start times, cutoffs and locations).</p><iframe title="Big Bend Ultra race calendar" src="${src}" loading="lazy" width="100%" height="560" frameborder="0"></iframe></section>
</article>`;
}
