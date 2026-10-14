// The Website section's tabs (dashboard → /website/*). Each manages part of
// the customer site through its admin API.
export const WEBSITE_TABS = [
  { href: '/website/status', label: 'Status' },
  { href: '/website/menu', label: 'Menu extras' },
  { href: '/website/specials', label: 'Specials' },
  { href: '/website/merch', label: 'Merch' },
  { href: '/website/gallery', label: 'Gallery' },
  { href: '/website/partners', label: 'Partners' },
  { href: '/website/catering', label: 'Catering' },
  { href: '/website/subscribers', label: 'Subscribers' },
  { href: '/website/insights', label: 'Web orders & traffic' },
] as const;
