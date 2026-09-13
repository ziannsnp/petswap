import { expect, test } from '@playwright/test';
import { routes } from './support/routes';

// The one end-to-end journey the project keeps (docs/testing.md): a requester
// books a listing and the listing owner confirms it.
//
// Needs the local Supabase stack, seeded via `npx supabase db reset`
// (test accounts and their password are documented in supabase/seed.sql), and
// the app pointed at it in web/.env.local. Run with `npm run test:e2e`.
//
// Requester and owner run in separate browser contexts (rather than signing
// out mid-test) so each keeps its own session, matching how two real users
// would use the app at once.

const LISTING_ID = '30000000-0000-4000-8000-000000000001'; // "Sunny garden room", owned by alex, accepts dog/cat/rabbit.
const PASSWORD = 'petswap-local-dev';

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

test.describe('booking request and confirmation', () => {
  test('a requester books a listing and the owner confirms it', async ({ browser }, testInfo) => {
    // desktop-chromium and mobile-chromium run this file in parallel against the
    // same local database, so each project needs a date range the other cannot
    // also pick - a fixed calendar date would create two identical-looking cards.
    const monthOffset = testInfo.project.name === 'mobile-chromium' ? 1 : 0;
    const START_DATE = `2027-0${2 + monthOffset}-01`;
    const END_DATE = `2027-0${2 + monthOffset}-05`;

    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    try {
      // Casey (requester) signs in and requests a booking for Rocket.
      await requesterPage.goto(routes.login);
      await requesterPage.getByLabel(/email or username/i).fill('casey@petswap.test');
      await requesterPage.getByLabel(/^password$/i).fill(PASSWORD);
      await requesterPage.getByRole('button', { name: /sign in/i }).click();
      await expect(requesterPage).toHaveURL(/\/profile$/);

      await requesterPage.goto(routes.listingDetail(LISTING_ID));
      await requesterPage.getByLabel('Pet', { exact: true }).selectOption({ label: 'Rocket (Dog)' });
      await requesterPage.getByLabel('Start date').fill(START_DATE);
      await requesterPage.getByLabel('End date').fill(END_DATE);
      await requesterPage.getByRole('button', { name: /request booking/i }).click();
      await expect(requesterPage.getByText(/your booking request has been sent/i)).toBeVisible();

      // Alex (listing owner), in a separate session, confirms the request.
      await ownerPage.goto(routes.login);
      await ownerPage.getByLabel(/email or username/i).fill('alex@petswap.test');
      await ownerPage.getByLabel(/^password$/i).fill(PASSWORD);
      await ownerPage.getByRole('button', { name: /sign in/i }).click();
      await expect(ownerPage).toHaveURL(/\/profile$/);

      await ownerPage.goto(routes.bookings);
      const incomingCard = ownerPage
        .getByRole('listitem')
        .filter({ hasText: formatBookingDate(START_DATE) });
      await expect(incomingCard).toBeVisible();
      await expect(incomingCard.getByText('Pending')).toBeVisible();
      await incomingCard.getByRole('button', { name: 'Confirm' }).click();
      await expect(incomingCard.getByText('Confirmed')).toBeVisible();
      await expect(incomingCard.getByRole('button', { name: 'Confirm' })).toHaveCount(0);

      // Back on the requester's session, the same booking now shows as Confirmed.
      await requesterPage.goto(routes.bookings);
      const outgoingCard = requesterPage
        .getByRole('listitem')
        .filter({ hasText: formatBookingDate(START_DATE) });
      await expect(outgoingCard.getByText('Confirmed')).toBeVisible();
    } finally {
      await requesterContext.close();
      await ownerContext.close();
    }
  });
});
