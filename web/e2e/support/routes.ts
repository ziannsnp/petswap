// App route paths, mirroring web/src/app/router.tsx. Keeping them in one place
// means a route rename breaks the e2e suite in one spot instead of many.
export const routes = {
  search: '/',
  login: '/login',
  privacy: '/privacy',
  terms: '/terms',
  profile: '/profile',
  pets: '/pets',
  listings: '/listings',
  newListing: '/listings/new',
  bookings: '/bookings',
} as const;
