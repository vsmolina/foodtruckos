import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { galleryPhotos } from '@/lib/db/schema';

export type PublicPhoto = { id: string; url: string; width: number | null; height: number | null; caption: string | null; credit: string | null };

/** Only approved photos whose consent has been confirmed are ever public. */
export async function getPublishedPhotos(limit = 120): Promise<PublicPhoto[]> {
  const rows = await db
    .select()
    .from(galleryPhotos)
    .where(and(eq(galleryPhotos.status, 'approved'), eq(galleryPhotos.consentConfirmed, true)))
    .orderBy(desc(galleryPhotos.reviewedAt), desc(galleryPhotos.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    width: r.width,
    height: r.height,
    caption: r.caption,
    credit: r.submitterInstagram ? `@${r.submitterInstagram}` : r.source === 'submission' ? r.submitterName : null,
  }));
}
