import { expect, test, type Browser, type Page } from '@playwright/test';
import { routes } from './support/routes';

// P-09: the cross-feature journey of ADR 0011 in a real browser. A requester finds a listing with a
// date-filtered search, the dates carry into the request, both people open the booking detail, the host
// confirms it, and the requester cancels it. It also covers what the detail must not do: show a booking to
// someone who is not in it, show contact details, or leave a stale action working.
//
// Completion is covered in booking-lifecycle.spec.ts, which owns the seeded finished stay (completing it is
// one-way, so one test holds it).
//
// Needs the local Supabase stack, seeded via `npx supabase db reset`, and the app pointed at it in
// web/.env.local. Run with `npm run test:e2e -- booking-detail-journey.spec.ts`.

const LISTING_TITLE = 'Sunny garden room'; // Alex's listing in Chiang Mai, capacity 2, accepts dog/cat/rabbit.
const LISTING_LOCATION = 'Chiang Mai';
const PASSWORD = 'petswap-local-dev';

// All projects run in parallel against one database, so each gets its own month of 2030, clear of
// booking-flow (2027), booking-lifecycle (2028) and booking-conflict-and-capacity (2029), and confirmed
// stays never collide across projects.
const PROJECT_MONTH: Record<string, number> = { 'desktop-chromium': 1, 'mobile-chromium': 2, 'desktop-firefox': 3 };

function projectDates(projectName: string, startDay: number): { start: string; end: string } {
  const month = String(PROJECT_MONTH[projectName] ?? 4).padStart(2, '0');
  const day = (value: number) => String(value).padStart(2, '0');
  return { start: `2030-${month}-${day(startDay)}`, end: `2030-${month}-${day(startDay + 4)}` };
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

// Search for the dates, open the result, and send the request the form was pre-filled for.
async function requestThroughSearch(page: Page, dates: { start: string; end: string }): Promise<void> {
  await page.goto(`${routes.search}?location=${encodeURIComponent(LISTING_LOCATION)}&startDate=${dates.start}&endDate=${dates.end}`);
  await page.getByRole('link', { name: new RegExp(LISTING_TITLE) }).click();
  await expect(page.getByLabel('Start date')).toHaveValue(dates.start);
  await expect(page.getByLabel('End date')).toHaveValue(dates.end);
  await page.getByLabel('Pet', { exact: true }).selectOption({ label: 'Rocket (Dog)' });
  await page.getByRole('button', { name: /request booking/i }).click();
  await expect(page.getByText(/your booking request has been sent/i)).toBeVisible();
}

// Lists are newest first, so .first() is the booking this run created even if an earlier run without a
// database reset left one on the same dates.
async function openDetailFromList(page: Page, startDate: string): Promise<void> {
  await page.goto(routes.bookings);
  // Match "<start> –" so a card that only ENDS on this date is never picked by mistake.
  const card = page
    .getByRole('listitem')
    .filter({ hasText: `${formatBookingDate(startDate)} –` })
    .filter({ hasText: LISTING_TITLE })
    .first();
  await card.getByRole('link', { name: /view details/i }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Booking details' })).toBeVisible();
}

function status(page: Page, label: string) {
  return page.locator(`.booking-status--${label.toLowerCase()}`);
}

async function expectNoContactDetails(page: Page): Promise<void> {
  const body = page.locator('body');
  await expect(body).not.toContainText(/@petswap\.test/);
  await expect(body).not.toContainText(/0800000\d{3}/);
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('booking detail journey', () => {
  test('search by dates, request, open the detail, confirm, then cancel', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 1);
    const requester = await signIn(browser, 'casey@petswap.test');
    const host = await signIn(browser, 'alex@petswap.test');

    try {
      // 1. Date-filtered search -> listing -> request, with the searched dates carried over.
      await requestThroughSearch(requester, dates);

      // 2. The requester's detail: pending, the host is the peer, no contact details, fits the screen.
      await openDetailFromList(requester, dates.start);
      await expect(status(requester, 'Pending')).toBeVisible();
      await expect(requester.getByRole('region', { name: 'Stay' })).toContainText(`${formatBookingDate(dates.start)} – ${formatBookingDate(dates.end)}`);
      await expect(requester.getByRole('region', { name: 'Host' })).toContainText('Alex Rivera');
      await expect(requester.getByRole('region', { name: 'Listing' })).toContainText(LISTING_TITLE);
      await expect(requester.getByRole('region', { name: 'Pet' })).toContainText('Rocket');
      await expect(requester.getByRole('button', { name: 'Cancel booking' })).toBeVisible();
      await expect(requester.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
      await expectNoContactDetails(requester);
      await expectNoSidewaysScroll(requester);
      const bookingUrl = requester.url();

      // 3. The host's detail: the requester is the peer, the pet's care notes are readable, and Confirm is
      //    reached and used with the keyboard.
      await openDetailFromList(host, dates.start);
      await expect(host.getByRole('region', { name: 'Requester' })).toContainText('Casey Ito');
      await expect(host.getByRole('region', { name: 'Pet' })).toContainText('Rocket');
      await expectNoContactDetails(host);
      await expectNoSidewaysScroll(host);
      const confirm = host.getByRole('button', { name: 'Confirm' });
      await confirm.focus();
      await expect(confirm).toBeFocused();
      await host.keyboard.press('Enter');
      await expect(status(host, 'Confirmed')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Confirm' })).toHaveCount(0);

      // 4. The requester sees the confirmation on a reload and cancels from the detail screen.
      await requester.goto(bookingUrl);
      await expect(status(requester, 'Confirmed')).toBeVisible();
      await requester.getByRole('button', { name: 'Cancel booking' }).click();
      const dialog = requester.getByRole('alertdialog', { name: /cancel booking for/i });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel booking' }).click();
      await expect(status(requester, 'Cancelled')).toBeVisible();
      await expect(requester.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

      // 5. After a cancellation the host keeps the booking but the pet is no longer shared.
      await host.reload();
      await expect(status(host, 'Cancelled')).toBeVisible();
      await expect(host.getByRole('region', { name: 'Pet' })).toContainText('no longer shared');
    } finally {
      await requester.context().close();
      await host.context().close();
    }
  });

  test('a booking is shown only to the two people in it', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 8);
    const requester = await signIn(browser, 'casey@petswap.test');
    const stranger = await signIn(browser, 'blair@petswap.test');

    try {
      await requestThroughSearch(requester, dates);
      await openDetailFromList(requester, dates.start);
      const bookingUrl = requester.url();

      // A signed-in stranger who has the exact URL gets the same answer as for a booking that does not exist.
      await stranger.goto(bookingUrl);
      await expect(stranger.getByRole('alert')).toContainText('Booking not found');
      await expect(stranger.locator('body')).not.toContainText('Casey Ito');
      await expect(stranger.locator('body')).not.toContainText('Rocket');
      await stranger.goto('/bookings/00000000-0000-4000-8000-000000000000');
      await expect(stranger.getByRole('alert')).toContainText('Booking not found');

      // Cancel so the pending request does not linger on a later run's lists.
      await requester.getByRole('button', { name: 'Cancel booking' }).click();
      await requester.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking' }).click();
      await expect(status(requester, 'Cancelled')).toBeVisible();
    } finally {
      await requester.context().close();
      await stranger.context().close();
    }
  });

  test('a stale confirmation is refused, explained, and the screen refreshes', async ({ browser }, testInfo) => {
    const dates = projectDates(testInfo.project.name, 15);
    const requester = await signIn(browser, 'casey@petswap.test');
    const host = await signIn(browser, 'alex@petswap.test');

    try {
      await requestThroughSearch(requester, dates);
      await openDetailFromList(requester, dates.start);
      const bookingUrl = requester.url();

      // The host has the request on screen, still pending.
      await openDetailFromList(host, dates.start);
      await expect(status(host, 'Pending')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Confirm' })).toBeVisible();

      // Meanwhile the requester cancels it in another session.
      await requester.goto(bookingUrl);
      await requester.getByRole('button', { name: 'Cancel booking' }).click();
      await requester.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking' }).click();
      await expect(status(requester, 'Cancelled')).toBeVisible();

      // The host's stale Confirm is refused with a reason that names no one else, and the screen refreshes
      // to the real status, so no action that can no longer work is left on it.
      await host.getByRole('button', { name: 'Confirm' }).click();
      await expect(host.getByRole('alert')).toContainText('changed by someone else');
      await expect(status(host, 'Cancelled')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
      await expect(host.getByRole('button', { name: 'Decline' })).toHaveCount(0);
    } finally {
      await requester.context().close();
      await host.context().close();
    }
  });
});
