import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import { uuidv7 } from 'uuidv7';
import { has } from '@/lib/env';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class UploadError extends Error {}

/**
 * Store an uploaded image and return its public URL. Vercel Blob in
 * production; public/uploads in local development.
 */
export async function storeImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new UploadError('Photos must be JPG, PNG or WebP.');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('Photos must be 8 MB or smaller.');
  if (file.size === 0) throw new UploadError('That file is empty.');
  const name = `${folder}/${uuidv7()}.${ext}`;
  if (has.blob) {
    const blob = await put(name, file, { access: 'public', contentType: file.type });
    return blob.url;
  }
  if (process.env.NODE_ENV === 'production') throw new UploadError('Uploads are not configured (BLOB_READ_WRITE_TOKEN).');
  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), 'public', 'uploads', name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
