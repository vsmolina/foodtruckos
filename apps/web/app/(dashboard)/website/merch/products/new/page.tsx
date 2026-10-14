import Link from 'next/link';
import { Panel } from '@/components/website/ui';
import { ProductEditor } from '../../ProductEditor';

export default function NewMerchProductPage(): React.JSX.Element {
  return (
    <div className="grid max-w-4xl gap-4">
      <Link href="/website/merch" className="text-sm text-ink-2 hover:text-ink">
        ← Merch
      </Link>
      <Panel title="New product" description="It shows on the website’s merch page as soon as it’s saved and marked live.">
        <ProductEditor product={null} photoSrc={null} />
      </Panel>
    </div>
  );
}
