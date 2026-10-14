// Race-day calendar (live Google Calendar embed, web only) + clearly marked placeholders for the finish-area plan and sponsors.
import { CAL_ID } from '../../scripts/lib/calendar';
export const meta = { id: 'info', title: 'Calendar, finish area & sponsors' };
export function render() {
  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CAL_ID)}&ctz=America%2FChicago&mode=AGENDA&dates=20270116%2F20270119&showTitle=0&showPrint=0&showTabs=1&showCalendars=0`;
  return `<article class="doc info">
<section class="ui calview"><h2>Race-day calendar</h2><p class="note">Live view of the official race calendar (the source for start times, cutoffs and locations).</p><iframe title="Big Bend Ultra race calendar" src="${src}" loading="lazy" width="100%" height="560" frameborder="0"></iframe></section>
<section class="placeholder keep"><h2>Finish area &amp; parking</h2><div class="phbox">PLACEHOLDER — finish-area and parking floor plan to come (Barton Warnock Visitor Center). Not a layout.</div></section>
<section class="placeholder keep"><h2>Sponsors</h2><div class="phbox">PLACEHOLDER — sponsor logos to come.</div></section>
</article>`;
}
