'use client';

import { startTransition, useActionState, useState } from 'react';
import { imageSize, resizeImage } from '@/components/gallery/resize-image';
import { Button } from '@/components/ui/Button';
import { FormNotice } from '@/components/ui/Field';
import { uploadOwnerPhotos, type UploadState } from './actions';

export function OwnerUpload() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadOwnerPhotos, {});
  const [preparing, setPreparing] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const raw = new FormData(el);
        const files = raw.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
        setPreparing(true);
        const out = new FormData();
        const sizes: string[] = [];
        for (const f of files) {
          const small = await resizeImage(f);
          const size = await imageSize(small);
          sizes.push(size ? `${size.width}x${size.height}` : '0x0');
          out.append('photos', small);
        }
        out.set('sizes', sizes.join(','));
        out.set('caption', String(raw.get('caption') ?? ''));
        setPreparing(false);
        startTransition(() => action(out));
        el.reset();
      }}
    >
      {state.error ? <FormNotice tone="error">{state.error}</FormNotice> : null}
      {state.ok ? <FormNotice tone="success">Uploaded {state.ok} photo{state.ok === 1 ? '' : 's'}. Confirm consent below to publish.</FormNotice> : null}
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Photos (up to 20)
        <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="min-h-12 rounded-sm border-2 border-outline bg-paper p-2 text-paper-ink" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Caption for all (optional)
        <input name="caption" maxLength={140} className="min-h-12 rounded-sm border-2 border-outline bg-paper px-3 text-paper-ink" />
      </label>
      <Button type="submit" size="sm" loading={pending || preparing} className="self-start">
        Upload
      </Button>
    </form>
  );
}
