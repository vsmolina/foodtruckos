import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Atkinson_Hyperlegible_Next, Bowlby_One, Permanent_Marker } from 'next/font/google';
import { env } from '@/lib/env';
import './globals.css';

// Display: Bowlby One (OFL) — fat poster lettering for headlines only.
// Body: Atkinson Hyperlegible Next (OFL) — built for legibility; menus, prices, forms.
// Hand: Permanent Marker (Apache 2.0) — sparing annotations ("¡la mera buena!").
const bowlby = Bowlby_One({ weight: '400', subsets: ['latin'], variable: '--font-bowlby', display: 'swap' });
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-atkinson',
  display: 'swap',
  // next/font has no metrics for this face; skip the generated fallback.
  adjustFontFallback: false,
});
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], variable: '--font-marker', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: 'Barrio Burger Co. — late-night Mexican burgers, San Marcos TX', template: '%s · Barrio Burger Co.' },
  description:
    'Mexican-style burgers and bacon-wrapped hot dogs on the Square in San Marcos, TX, behind Harper’s. Open late. Order ahead and skip the line.',
  openGraph: { siteName: 'Barrio Burger Co.', type: 'website', locale: 'en_US' },
};

export const viewport: Viewport = {
  themeColor: '#1f1915',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Dark by default (most visits are at night); the footer toggle stores a cookie.
  const theme = (await cookies()).get('theme')?.value === 'light' ? 'light' : 'dark';
  return (
    <html lang="en" data-theme={theme} className={`${bowlby.variable} ${atkinson.variable} ${marker.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
