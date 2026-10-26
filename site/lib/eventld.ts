// schema.org SportsEvent (Google event rich results) for the race: injected into this page's <head> and, by embed.js / cards-embed.js,
// into the HOST page's <head> (once). Facts only: times/places from content/calendar.json (race calendar), course order from courses.json,
// fees + registration windows + URL from RunSignup race 163892 (fees exclude RunSignup's processing fee), wording from trailroots.com/big-bend-ultra.
const RACE_DAY = '2027-01-17', OFF = '-06:00'; // Terlingua, TX: US Central, standard time in January
const RACE_URL = 'https://trailroots.com/big-bend-ultra';
const IMAGE = 'https://trail-roots.github.io/big-bend-ultra-map/cards-embed.png';
// registration price schedule (all tiers per distance): sources/curated/registration.json, pulled from RunSignup race 163892
import REG from '../../sources/curated/registration.json';
const REG_URL = (REG as any).registrationUrl as string;
// "M/D/YYYY HH:MM" America/Chicago wall clock -> ISO with that moment's offset (CDT -05:00 / CST -06:00)
const chi = (t: string) => { const [d, hm] = t.split(' '), [M, D, Y] = d.split('/').map(Number), [h, m] = hm.split(':').map(Number);
  for (const off of [-5, -6]) { const u = Date.UTC(Y, M - 1, D, h - off, m), loc = new Date(u).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (loc.replace(',', '') === `${M}/${D}/${Y} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`) return `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-0${-off}:00`; }
  throw new Error('[event ld] bad time ' + t); };
const TIERS = (k: string) => { const t = (REG as any).events[k] as { opens: string; closes: string; price: string }[]; if (!t?.length) throw new Error('[event ld] no RunSignup tiers for ' + k); return t; };
const pad = (n: number) => String(n).padStart(2, '0');
const at = (min: number) => { const d = new Date(Date.parse(RACE_DAY + 'T00:00:00Z') + min * 60000); return `${d.toISOString().slice(0, 10)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00${OFF}`; };
export function eventLd(ctx: any) {
  const ev: any[] = ctx.calendar.events, order: string[] = ctx.courses.order;
  const one = (re: RegExp) => { const e = ev.filter((x) => re.test(x.s)); if (e.length !== 1) throw new Error('[event ld] calendar entry ' + re + ' x' + e.length); return e[0]; };
  const loc0 = one(/^\S+ 100K Race Start$/).loc as string; if (!/^Barton Warnock Visitor Center, 21800 FM170, Terlingua, TX 79852/.test(loc0)) throw new Error('[event ld] start location changed: ' + loc0);
  const place = { '@type': 'Place', name: 'Barton Warnock Visitor Center, Big Bend Ranch State Park', address: { '@type': 'PostalAddress', streetAddress: '21800 FM170', addressLocality: 'Terlingua', addressRegion: 'TX', postalCode: '79852', addressCountry: 'US' } };
  const org = { '@type': 'Organization', name: 'Trail Roots', url: 'https://trailroots.com' };
  const sub = order.map((k) => { const st = one(new RegExp(`^\\S+ ${k} Race Start$`)), fin = one(new RegExp(`^\\S+ ${k} Finish$`)), f = TIERS(k);
    if (!st.loc.startsWith('Barton Warnock') || !fin.loc.startsWith('Barton Warnock')) throw new Error('[event ld] ' + k + ' start/finish not at Barton Warnock');
    return { '@type': 'SportsEvent', name: `Big Bend Ultra 2027 ${k}`, sport: 'Trail running', startDate: at(st.a), endDate: at(fin.a), eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: place, organizer: org, url: RACE_URL, image: [IMAGE],
      description: `${k} trail race of the Big Bend Ultra at Big Bend Ranch State Park; start and finish at the Barton Warnock Visitor Center.`,
      offers: f.map((t) => ({ '@type': 'Offer', name: `${k} registration`, price: (+t.price).toFixed(2), priceCurrency: 'USD', validFrom: chi(t.opens), validThrough: chi(t.closes), priceValidUntil: chi(t.closes), availability: 'https://schema.org/InStock', url: REG_URL })) }; });
  const all = order.flatMap((k) => TIERS(k).map((t) => +t.price));
  return { '@context': 'https://schema.org', '@type': 'SportsEvent', name: 'Big Bend Ultra 2027', sport: 'Trail running', startDate: sub.map((s) => s.startDate).sort()[0], endDate: sub.map((s) => s.endDate).sort().at(-1),
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: place, organizer: org, url: RACE_URL, image: [IMAGE],
    description: 'Big Bend Ultra (23rd annual): 10K, 20K, 35K, 55K and 100K trail races at Big Bend Ranch State Park, Texas. All runners share the start and finish at the Barton Warnock Visitor Center.',
    offers: { '@type': 'AggregateOffer', lowPrice: Math.min(...all).toFixed(2), highPrice: Math.max(...all).toFixed(2), priceCurrency: 'USD', offerCount: all.length, validFrom: sub.flatMap((s) => s.offers.map((o) => o.validFrom)).sort()[0], validThrough: sub.flatMap((s) => s.offers.map((o) => o.validThrough)).sort().at(-1), availability: 'https://schema.org/InStock', url: REG_URL },
    subEvent: sub };
}
export const ldScript = (o: unknown) => `<script type="application/ld+json" data-bbu-event>${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
