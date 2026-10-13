// Downscale a photo in the browser before upload: phones shoot 4–12 MB images,
// the bar has one bar of signal, and Vercel caps request bodies at 4.5 MB.
// Returns a JPEG ≤ maxEdge px on its long edge, or the original file if it's
// already small or the browser can't decode it.

export async function resizeImage(file: File, maxEdge = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 600 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Natural size of an image file, or null. */
export async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const b = await createImageBitmap(file);
    const size = { width: b.width, height: b.height };
    b.close();
    return size;
  } catch {
    return null;
  }
}
