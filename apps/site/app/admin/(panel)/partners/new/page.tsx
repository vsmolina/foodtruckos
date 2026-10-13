import Link from 'next/link';
import { AdminPage, Card } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { PartnerForm } from '../PartnerForm';

export default async function NewPartnerPage() {
  await requireAdmin();
  return (
    <AdminPage title="Add partner" actions={<Link href="/admin/partners" className="font-bold underline">← Partners</Link>}>
      <Card>
        <PartnerForm />
      </Card>
    </AdminPage>
  );
}
