import Link from 'next/link';
import { getCategories } from '@/lib/db/queries/menu';
import { Field, inputClass, NoticeBanner, PrimaryButton } from '@/components/dashboard/form';
import { createItem } from '../../actions';
import { noticeFor } from '../../notices';

export const dynamic = 'force-dynamic';

export default async function NewMenuItemPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  const [categories, sp] = await Promise.all([getCategories(), searchParams]);
  const preselect = typeof sp.category === 'string' ? sp.category : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/settings/menu" className="text-sm text-ink-2 hover:text-ink">
        ← Menu
      </Link>
      <h1 className="mt-2 font-display text-2xl text-ink">New item</h1>
      <NoticeBanner notice={noticeFor(sp.notice)} />

      {categories.length === 0 ? (
        <p className="mt-6 text-sm text-ink-3">Add a category first.</p>
      ) : (
        <form action={createItem} className="mt-6 flex max-w-[640px] flex-col gap-5">
          <Field label="Name">
            <input name="name" required maxLength={80} autoFocus className={inputClass} />
          </Field>
          <Field label="Category">
            <select
              name="categoryId"
              defaultValue={categories.some((c) => c.id === preselect) ? preselect : categories[0]!.id}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price" hint="In dollars. You can add more sizes after creating it.">
            <input
              name="price"
              required
              inputMode="decimal"
              placeholder="10.99"
              pattern="\$?\d{1,5}(\.\d{1,2})?"
              className={`${inputClass} max-w-32 font-mono`}
            />
          </Field>
          <Field label="Description" hint="Optional.">
            <textarea name="description" rows={2} maxLength={500} className={`${inputClass} resize-y`} />
          </Field>
          <div>
            <PrimaryButton>Create item</PrimaryButton>
          </div>
        </form>
      )}
    </div>
  );
}
