import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { LogoSlot } from '@/components/ui/Slots';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { partners } from '@/lib/db/schema';
import { referralQrSvg, referralUrl } from '@/lib/partners/qr';

export const dynamic = 'force-dynamic';

// Printable table-tent / bar-top card. Print CSS hides the admin chrome and
// prints the card black-on-white at a fixed size.
export default async function PartnerQrPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  if (!p) notFound();
  const svg = await referralQrSvg(p.code);
  const url = referralUrl(p.code).replace(/^https?:\/\//, '');

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{`
        @page { size: letter portrait; margin: 0.5in; }
        @media print {
          html, body { background: #fff !important; }
          body::before { display: none !important; }
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          .qr-card { box-shadow: none !important; rotate: 0deg !important; }
        }
      `}</style>
      <div className="no-print flex w-full flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/partners/${p.id}`} className="font-bold underline">
          ← {p.name}
        </Link>
        <p className="text-sm text-ink-muted">Use your browser’s Print (⌘P / Share → Print). Prints one card per page.</p>
      </div>

      <article className="qr-card shadow-hard-lg flex w-full max-w-[5.5in] flex-col items-center gap-4 rounded-md border-[6px] border-[#14110E] bg-[#F7EFE2] p-8 text-center text-[#14110E]">
        <LogoSlot size="lg" />
        <p className="font-hand text-2xl text-[#b3261e]">¿Ya te dio hambre?</p>
        <h1 className="font-display text-4xl uppercase leading-none">Order ahead from {p.kind === 'bartender' ? 'the bar' : p.name}</h1>
        <p className="text-lg font-bold">Scan, pay, and grab it at the Barrio Burger truck — no line.</p>
        <div className="w-64 border-4 border-[#14110E] bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="font-mono text-sm">{url}</p>
        <p className="font-display text-xl uppercase">Barrio Burger Co.</p>
      </article>
    </div>
  );
}
