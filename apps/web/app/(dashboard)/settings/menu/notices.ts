// Fixed set of post-action messages, passed as ?notice=<code>. Only known codes
// render, so the URL can't inject arbitrary text into the page.
export const NOTICES = {
  saved: { tone: 'ok', text: 'Saved.' },
  created: { tone: 'ok', text: 'Created.' },
  deleted: { tone: 'ok', text: 'Deleted.' },
  err_name: { tone: 'error', text: 'Name is required.' },
  err_price: { tone: 'error', text: 'Enter a price like 10.99.' },
  err_not_found: { tone: 'error', text: 'That no longer exists — it may have been deleted.' },
  err_not_empty: { tone: 'error', text: 'Move or delete the items in this category first.' },
  err_last_variation: { tone: 'error', text: 'An item needs at least one price. Add another before deleting this one.' },
  err_in_use: {
    tone: 'error',
    text: 'This item appears on past orders, so it can’t be deleted. Mark it unavailable instead.',
  },
} as const;

export type Notice = keyof typeof NOTICES;

export function noticeFor(code: string | string[] | undefined): (typeof NOTICES)[Notice] | null {
  const c = Array.isArray(code) ? code[0] : code;
  return c && c in NOTICES ? NOTICES[c as Notice] : null;
}
