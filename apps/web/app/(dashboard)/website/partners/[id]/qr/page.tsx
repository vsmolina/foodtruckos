import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteApi, SiteUnavailableError } from '@/lib/site/api';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

// Printable bar-top / table-tent card. Print CSS hides the dashboard chrome
// (sidebar, Website tabs) and prints the card black on white, one per page.
export default async function PartnerQrCardPage({ params }: PageProps<'/website/partners/[id]/qr'>): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await siteApi('partners.qr', { id });
  if (!result.ok) {
    if (result.fieldErrors || /no longer exists/.test(result.error)) notFound();
    throw new SiteUnavailableError(result.error);
  }
  const { partner: p, svg, referralUrl } = result.data;
  const shortUrl = referralUrl.replace(/^https?:\/\//, '');

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{`
        @page { size: letter portrait; margin: 0.5in; }
        @media print {
          html, body { background: #fff !important; }
          aside, nav, h1, .no-print, a[target="_blank"] { display: none !important; }
          body > div { display: block !important; }
          main { padding: 0 !important; }
          .qr-card { border-color: #000 !important; break-inside: avoid; }
        }
      `}</style>
      <div className="no-print flex w-full flex-wrap items-center justify-between gap-3">
        <Link href={`/website/partners/${p.id}`} className="text-sm text-ink-2 hover:text-ink">
          ← {p.name}
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-ink-3 sm:block">Prints one card per page.</p>
          <PrintButton />
        </div>
      </div>

      <article className="qr-card flex w-full max-w-[5.5in] flex-col items-center gap-4 rounded-[var(--radius-lg)] border-4 border-[#14110e] bg-white p-8 text-center text-[#14110e]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">Barrio Burger Co.</p>
        <h2 className="font-display text-3xl leading-tight sm:text-4xl">
          Order ahead from {p.kind === 'bartender' ? 'the bar' : p.name}
        </h2>
        <p className="text-lg">Scan, pay, and grab it at the truck. No line.</p>
        <div className="w-60 max-w-full border-2 border-[#14110e] bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="break-all font-mono text-sm">{shortUrl}</p>
      </article>
    </div>
  );
}
