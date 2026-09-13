// App route paths, mirroring web/src/app/router.tsx. Keeping them in one place
// means a route rename breaks the e2e suite in one spot instead of many.
export const routes = {
  search: '/',
  login: '/login',
  register: '/register',
  privacy: '/privacy',
  terms: '/terms',
  profile: '/profile',
  pets: '/pets',
  listings: '/listings',
  newListing: '/listings/new',
  bookings: '/bookings',
  listingDetail: (listingId: string) => `/listings/${listingId}`,
} as const;
