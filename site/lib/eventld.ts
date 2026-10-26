// schema.org SportsEvent (Google event rich results) for the race: injected into this page's <head> and, by embed.js / cards-embed.js,
// into the HOST page's <head> (once). Facts only: times/places from content/calendar.json (race calendar), course order from courses.json,
// fees + registration windows + URL from RunSignup race 163892 (fees exclude RunSignup's processing fee), wording from trailroots.com/big-bend-ultra.
const RACE_DAY = '2027-01-17', OFF = '-06:00'; // Terlingua, TX: US Central, standard time in January
const RACE_URL = 'https://trailroots.com/big-bend-ultra', REG_URL = 'https://runsignup.com/Race/TX/Terlingua/BigBendUltra';
const IMAGE = 'https://trail-roots.github.io/big-bend-ultra-map/cards-embed.png';
// RunSignup registration periods (America/Chicago) and race fees per distance
const PERIODS: [string, string][] = [['2026-07-04T01:00:00-05:00', '2026-09-27T00:59:00-05:00'], ['2026-09-27T01:00:00-05:00', '2026-11-15T00:59:00-06:00'], ['2026-11-15T01:00:00-06:00', '2027-01-17T12:59:00-06:00']];
const FEES: Record<string, number[]> = { '10K': [110, 125, 140], '20K': [120, 135, 150], '35K': [130, 145, 160], '55K': [155, 175, 195], '100K': [210, 240, 280] };
const pad = (n: number) => String(n).padStart(2, '0');
const at = (min: number) => { const d = new Date(Date.parse(RACE_DAY + 'T00:00:00Z') + min * 60000); return `${d.toISOString().slice(0, 10)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${OFF}`; };
export function eventLd(ctx: any) {
  const ev: any[] = ctx.calendar.events, order: string[] = ctx.courses.order;
  const one = (re: RegExp) => { const e = ev.filter((x) => re.test(x.s)); if (e.length !== 1) throw new Error('[event ld] calendar entry ' + re + ' x' + e.length); return e[0]; };
  const loc0 = one(/^\S+ 100K Race Start$/).loc as string; if (!/^Barton Warnock Visitor Center, 21800 FM170, Terlingua, TX 79852/.test(loc0)) throw new Error('[event ld] start location changed: ' + loc0);
  const place = { '@type': 'Place', name: 'Barton Warnock Visitor Center, Big Bend Ranch State Park', address: { '@type': 'PostalAddress', streetAddress: '21800 FM170', addressLocality: 'Terlingua', addressRegion: 'TX', postalCode: '79852', addressCountry: 'US' } };
  const org = { '@type': 'Organization', name: 'Trail Roots', url: 'https://trailroots.com' };
  const sub = order.map((k) => { const st = one(new RegExp(`^\\S+ ${k} Race Start$`)), fin = one(new RegExp(`^\\S+ ${k} Finish$`)), f = FEES[k]; if (!f) throw new Error('[event ld] no fee for ' + k);
    if (!st.loc.startsWith('Barton Warnock') || !fin.loc.startsWith('Barton Warnock')) throw new Error('[event ld] ' + k + ' start/finish not at Barton Warnock');
    return { '@type': 'SportsEvent', name: `Big Bend Ultra 2027 ${k}`, sport: 'Trail running', startDate: at(st.a), endDate: at(fin.a), eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: place, organizer: org, url: RACE_URL, image: [IMAGE],
      description: `${k} trail race of the Big Bend Ultra at Big Bend Ranch State Park; start and finish at the Barton Warnock Visitor Center.`,
      offers: PERIODS.map(([a, b], i) => ({ '@type': 'Offer', name: `${k} registration`, price: f[i].toFixed(2), priceCurrency: 'USD', validFrom: a, validThrough: b, availability: 'https://schema.org/InStock', url: REG_URL })) }; });
  const all = order.flatMap((k) => FEES[k]);
  return { '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'Big Bend Ultra 2027', sport: 'Trail running', startDate: sub.map((s) => s.startDate).sort()[0], endDate: sub.map((s) => s.endDate).sort().at(-1),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: place, organizer: org, url: RACE_URL, image: [IMAGE],
    description: 'Big Bend Ultra (23rd annual): 10K, 20K, 35K, 55K and 100K trail races at Big Bend Ranch State Park, Texas. All runners share the start and finish at the Barton Warnock Visitor Center.',
    offers: { '@type': 'AggregateOffer', lowPrice: Math.min(...all).toFixed(2), highPrice: Math.max(...all).toFixed(2), priceCurrency: 'USD', offerCount: all.length, availability: 'https://schema.org/InStock', url: REG_URL },
    subEvent: sub };
}
export const ldScript = (o: unknown) => `<script type="application/ld+json" data-bbu-event>${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
