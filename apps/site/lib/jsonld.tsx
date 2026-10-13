import { env } from '@/lib/env';
import type { DayHours, Settings } from '@/lib/status';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** schema.org FoodEstablishment for local search. */
export function foodEstablishment(settings: Settings, hours: DayHours[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    '@id': `${env.siteUrl}/#truck`,
    name: 'Barrio Burger Co.',
    description: 'Mexican-style burgers and bacon-wrapped hot dogs. Food truck on the Square in San Marcos, TX, open late.',
    servesCuisine: ['Mexican', 'Burgers', 'Hot dogs'],
    priceRange: '$',
    url: env.siteUrl,
    menu: `${env.siteUrl}/menu`,
    acceptsReservations: false,
    hasMenu: `${env.siteUrl}/menu`,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.locationName,
      addressLocality: 'San Marcos',
      addressRegion: 'TX',
      postalCode: '78666',
      addressCountry: 'US',
    },
    geo: { '@type': 'GeoCoordinates', latitude: Number(settings.lat), longitude: Number(settings.lng) },
    openingHoursSpecification: hours
      .filter((h) => !h.closed && h.opens && h.closes)
      .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[h.dayOfWeek], opens: h.opens, closes: h.closes })),
    sameAs: [`https://instagram.com/${settings.instagram}`],
    potentialAction: {
      '@type': 'OrderAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${env.siteUrl}/order`, actionPlatform: ['http://schema.org/MobileWebPlatform'] },
      deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp',
    },
  };
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD guide: escape < to avoid breaking out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
