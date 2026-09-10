import { test } from '@playwright/test';

// The one end-to-end journey the project keeps (docs/testing.md): a requester
// books a listing and the listing owner confirms it.
//
// Still skipped: it needs screens that are not on main yet - login/session, a
// listing detail view with a "request booking" entry point, the bookings page,
// and the owner's confirm action.
//
// To enable when those land:
//   1. remove the test.skip below
//   2. start the local stack and seed it:  npx supabase db reset
//      (test accounts and their password are documented in supabase/seed.sql)
//   3. point the app at local Supabase in web/.env.local
//   4. npm run test:e2e
test.describe('booking request and confirmation', () => {
  test.skip(
    true,
    'Enable when login, listing detail, and the bookings page with an owner confirm action are on main.',
  );

  test('a requester books a listing and the owner confirms it', async () => {
    // Sign in as the requester (casey@petswap.test).
    // Open a published listing and request a booking for a pet + date range.
    // Sign out; sign in as the listing owner (alex@petswap.test).
    // Open incoming bookings and confirm the request.
    // Sign back in as the requester; the booking shows as Confirmed.
  });
});
