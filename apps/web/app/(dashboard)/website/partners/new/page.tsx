import Link from 'next/link';
import { Panel } from '@/components/website/ui';
import { PartnerForm } from '../PartnerForm';

export const dynamic = 'force-dynamic';

export default function NewPartnerPage(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Link href="/website/partners" className="text-sm text-ink-2 hover:text-ink">
        ← Partners
      </Link>
      <Panel title="Add partner">
        <PartnerForm />
      </Panel>
    </div>
  );
}
