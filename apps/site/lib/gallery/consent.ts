// The exact consent wording shown on the forms. Whatever is shown is what gets
// stored with the photo, so change it here only.

export const SUBMIT_CONSENT = {
  rights: 'I took this photo or have the right to share it.',
  people:
    'Everyone identifiable in this photo has agreed to have it published on the Barrio Burger Co. website and social media.',
  terms: 'I agree to the photo terms.',
} as const;

export const ADMIN_CONSENT =
  'Owner confirmed that everyone identifiable in this photo agreed to have it published on the Barrio Burger Co. website and social media.';

/** Normalise an Instagram handle: strips @, URLs and whitespace. */
export function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .slice(0, 30);
}
