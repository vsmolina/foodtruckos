export const STATUS_TONE = {
  pending: 'grey',
  paid: 'amber',
  fulfilled: 'green',
  cancelled: 'grey',
  refunded: 'blue',
} as const;
export const STATUS_LABEL = {
  pending: 'Awaiting payment',
  paid: 'To ship',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
} as const;
