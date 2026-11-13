import { expect, test, type Browser, type Page } from '@playwright/test';
import { routes } from './support/routes';

// The rest of the booking lifecycle after booking-flow.spec.ts's request โ’ confirm:
// an owner declines, a requester cancels (pending and confirmed), and an owner marks a
// finished stay completed.
//
// Needs the local Supabase stack, seeded via `npx supabase db reset` (test accounts and
// their password are documented in supabase/seed.sql), and the app pointed at it in
// web/.env.local. Run with `npm run test:e2e -- booking-lifecycle.spec.ts`.

const LISTING_ID = '30000000-0000-4000-8000-000000000001'; // "Sunny garden room", owned by alex.
const PASSWORD = 'petswap-local-dev';

// All projects run in parallel against one database, so each gets its own month of
// 2028 - clear of booking-flow.spec.ts's 2027 dates - and confirmed stays never overlap.
const PROJECT_MONTH: Record<string, number> = { 'desktop-chromium': 1, 'mobile-chromium': 2, 'desktop-firefox': 3 };

function projectDates(projectName: string, startDay: number): { start: string; end: string } {
  const month = String(PROJECT_MONTH[projectName] ?? 4).padStart(2, '0');
  const day = (value: number) => String(value).padStart(2, '0');
  return { start: `2028-${month}-${day(startDay)}`, end: `2028-${month}-${day(startDay + 4)}` };
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(routes.login);
  await page.getByLabel(/email or username/i).fill(email);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.search}$`));
  return page;
}

async function requestBooking(page: Page, dates: { start: string; end: string }): Promise<void> {
  await page.goto(routes.listingDetail(LISTING_ID));
  await page.getByLabel('Pet', { exact: true }).selectOption({ label: 'Rocket (Dog)' });
  await page.getByLabel('Start date').fill(dates.start);
  await page.getByLabel('End date').fill(dates.end);
  await page.getByRole('button', { name: /request booking/i }).click();
  await expect(page.getByText(/your booking request has been sent/i)).toBeVisible();
}

// Lists are newest first, so .first() is the booking this run created even if an earlier
// run without a database reset left one on the same dates.
async function openBookingCard(page: Page, startDate: string) {
  await page.goto(routes.bookings);
  return page.getByRole('listitem').filter({ hasText: formatBookingDate(startDate) }).first();
}

test.describe('booking lifecycle after the request', () => {
  test('a listing owner declines a pending request', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 1);
    const requester = await signIn(browser, 'casey@petswap.test');
    const owner = await signIn(browser, 'alex@petswap.test');

    try {
      await requestBooking(requester, dates);

      const incomingCard = await openBookingCard(owner, dates.start);
      await expect(incomingCard.getByText('Pending', { exact: true })).toBeVisible();
      await incomingCard.getByRole('button', { name: 'Decline' }).click();
      await expect(incomingCard.getByText('Declined', { exact: true })).toBeVisible();
      await expect(incomingCard.getByRole('button')).toHaveCount(0);

      // A declined request is final: the requester can no longer cancel it.
      const outgoingCard = await openBookingCard(requester, dates.start);
      await expect(outgoingCard.getByText('Declined', { exact: true })).toBeVisible();
      await expect(outgoingCard.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
    } finally {
      await requester.context().close();
      await owner.context().close();
    }
  });

  test('a requester cancels a pending request', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 10);
    const requester = await signIn(browser, 'casey@petswap.test');
    const owner = await signIn(browser, 'alex@petswap.test');

    try {
      await requestBooking(requester, dates);

      const outgoingCard = await openBookingCard(requester, dates.start);
      await expect(outgoingCard.getByText('Pending', { exact: true })).toBeVisible();
      await outgoingCard.getByRole('button', { name: 'Cancel booking' }).click();
      await expect(outgoingCard.getByText('Cancelled', { exact: true })).toBeVisible();
      await expect(outgoingCard.getByRole('button')).toHaveCount(0);

      // The owner can no longer respond to a cancelled request.
      const incomingCard = await openBookingCard(owner, dates.start);
      await expect(incomingCard.getByText('Cancelled', { exact: true })).toBeVisible();
      await expect(incomingCard.getByRole('button')).toHaveCount(0);
    } finally {
      await requester.context().close();
      await owner.context().close();
    }
  });

  test('a requester cancels a confirmed booking', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 20);
    const requester = await signIn(browser, 'casey@petswap.test');
    const owner = await signIn(browser, 'alex@petswap.test');

    try {
      await requestBooking(requester, dates);

      const incomingCard = await openBookingCard(owner, dates.start);
      await incomingCard.getByRole('button', { name: 'Confirm' }).click();
      await expect(incomingCard.getByText('Confirmed', { exact: true })).toBeVisible();
      // The owner cannot cancel on the requester's behalf.
      await expect(incomingCard.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

      const outgoingCard = await openBookingCard(requester, dates.start);
      await expect(outgoingCard.getByText('Confirmed', { exact: true })).toBeVisible();
      await outgoingCard.getByRole('button', { name: 'Cancel booking' }).click();
      await expect(outgoingCard.getByText('Cancelled', { exact: true })).toBeVisible();

      const ownerView = await openBookingCard(owner, dates.start);
      await expect(ownerView.getByText('Cancelled', { exact: true })).toBeVisible();
    } finally {
      await requester.context().close();
      await owner.context().close();
    }
  });

  test('a listing owner marks a finished confirmed booking completed', async ({ browser }, testInfo) => {
    // supabase/seed.sql holds a single finished stay (Rocket at Blair's "Countryside
    // cottage", ending six days before the reset), and completing it is one-way, so only
    // one project can run this. Re-run after `npx supabase db reset`.
    test.skip(testInfo.project.name !== 'desktop-chromium', 'the seeded finished stay can be completed only once');

    const seededStart = new Date();
    seededStart.setUTCDate(seededStart.getUTCDate() - 10);
    const startDate = seededStart.toISOString().slice(0, 10);

    const owner = await signIn(browser, 'blair@petswap.test');
    const requester = await signIn(browser, 'casey@petswap.test');

    try {
      const incomingCard = await openBookingCard(owner, startDate);
      await expect(incomingCard.getByText('Confirmed', { exact: true })).toBeVisible();

      // The requester sees the same finished stay but cannot complete it themselves.
      const outgoingCard = await openBookingCard(requester, startDate);
      await expect(outgoingCard.getByText('Confirmed', { exact: true })).toBeVisible();
      await expect(outgoingCard.getByRole('button', { name: 'Mark completed' })).toHaveCount(0);

      await incomingCard.getByRole('button', { name: 'Mark completed' }).click();
      await expect(incomingCard.getByText('Completed', { exact: true })).toBeVisible();
      await expect(incomingCard.getByRole('button')).toHaveCount(0);

      // Completed is final: the requester can no longer cancel it.
      const finishedCard = await openBookingCard(requester, startDate);
      await expect(finishedCard.getByText('Completed', { exact: true })).toBeVisible();
      await expect(finishedCard.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
    } finally {
      await owner.context().close();
      await requester.context().close();
    }
  });
});
