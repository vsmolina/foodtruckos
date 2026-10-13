import type { ApiResult, FieldErrors } from '@barrio/site-contract';
import { revalidatePath } from 'next/cache';

// FormData → op input helpers and the state shape every Website form returns
// (rendered by components/website/ActionForm).

export type FormState = {
  ok?: string;
  error?: string;
  fieldErrors?: FieldErrors;
  /** Changes on every submit so the same message re-announces. */
  at?: number;
};

export const initialFormState: FormState = {};

export function toFormState(result: ApiResult<unknown>, okText: string): FormState {
  if (result.ok) {
    revalidatePath('/website', 'layout');
    return { ok: okText, at: Date.now() };
  }
  return { error: result.error, ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}), at: Date.now() };
}

export function str(fd: FormData, key: string, max = 2000): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export const bool = (fd: FormData, key: string): boolean => fd.get(key) === 'on' || fd.get(key) === 'true';

/** Number from a field; NaN when blank or not numeric (the site validates). */
export function num(fd: FormData, key: string): number {
  const s = str(fd, key, 32);
  return s === '' ? Number.NaN : Number(s);
}

/** An uploaded file, or null when the input was left empty. */
export function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}
