import type { Metadata } from 'next';
import './globals.css';

// Fonts are declared as CSS families in globals.css (design system). Self-host
// the real faces from /public/fonts later; system fallbacks apply until then.
export const metadata: Metadata = {
  title: 'foodtruck-os',
  description: "Victor's food truck operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
