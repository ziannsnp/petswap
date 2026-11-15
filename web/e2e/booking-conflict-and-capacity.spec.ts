import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { routes } from './support/routes';

// Browser coverage for booking capacity, cross-listing pet exclusion, and end-exclusive
// back-to-back stays (FR-5.2, ADR 0011):
//   - overlapping confirmed stays are allowed up to a listing's capacity
//   - confirming a stay that would exceed the listing's capacity is rejected with a safe error
//   - confirming overlapping stays for the same pet across two listings is rejected with a safe error
//   - end-exclusive back-to-back stays confirm without conflict
//
// Needs the local Supabase stack, seeded via `npx supabase db reset`, and the app pointed at it
// in web/.env.local. Run with `npm run test:e2e -- booking-conflict-and-capacity.spec.ts`.

const SUNNY_GARDEN_ID = '30000000-0000-4000-8000-000000000001'; // Alex's listing, capacity 2, accepts dog/cat/rabbit.
const SUNNY_GARDEN_TITLE = 'Sunny garden room';
const COUNTRYSIDE_COTTAGE_ID = '30000000-0000-4000-8000-000000000003'; // Blair's listing, capacity 3, accepts dog/rabbit.
const COUNTRYSIDE_COTTAGE_TITLE = 'Countryside cottage';
const PASSWORD = 'petswap-local-dev';

const CAPACITY_CONFLICT_MESSAGE =
  'This listing has no remaining capacity for these dates. Choose different dates before confirming.';
const PET_CONFLICT_MESSAGE =
  'This pet already has a confirmed booking for these dates. Choose different dates before confirming.';

// All projects run in parallel against one database, so each gets its own month of
// 2029 - clear of booking-flow.spec.ts (2027) and booking-lifecycle.spec.ts (2028) -
// and stays never collide across projects.
const PROJECT_MONTH: Record<string, number> = {
  'desktop-chromium': 1,
  'mobile-chromium': 2,
  'desktop-firefox': 3,
};

function projectWindow(projectName: string, startDay: number, lengthDays = 4): { start: string; end: string } {
  const month = String(PROJECT_MONTH[projectName] ?? 4).padStart(2, '0');
  const day = (value: number) => String(value).padStart(2, '0');
  return {
    start: `2029-${month}-${day(startDay)}`,
    end: `2029-${month}-${day(startDay + lengthDays)}`,
  };
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
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

async function createPet(page: Page, name: string, speciesLabel = 'Dog'): Promise<void> {
  await page.goto(routes.newPet);
  await page.getByLabel(/^name/i).fill(name);
  await page.getByLabel(/^species/i).selectOption({ label: speciesLabel });
  await page.getByLabel(/^description/i).fill('Friendly dog for e2e capacity check.');
  await page.getByRole('button', { name: 'Save pet' }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.pets}$`));
}

async function requestBooking(
  page: Page,
  listingId: string,
  petLabel: string,
  dates: { start: string; end: string },
): Promise<void> {
  await page.goto(routes.listingDetail(listingId));
  await page.getByLabel('Pet', { exact: true }).selectOption({ label: petLabel });
  await page.getByLabel('Start date').fill(dates.start);
  await page.getByLabel('End date').fill(dates.end);
  await page.getByRole('button', { name: /request booking/i }).click();
  await expect(page.getByText(/your booking request has been sent/i)).toBeVisible();
}

function findBookingCard(
  page: Page,
  startDate: string,
  options: { petName?: string; listingTitle?: string } = {},
): Locator {
  let cards = page.getByRole('listitem').filter({ hasText: `${formatBookingDate(startDate)} –` });
  if (options.petName) {
    cards = cards.filter({ hasText: options.petName });
  }
  if (options.listingTitle) {
    cards = cards.filter({ hasText: options.listingTitle });
  }
  return cards.first();
}

test.describe('booking capacity, cross-listing pet overlap, and back-to-back stays', () => {
  test(
    'allows overlapping confirmed stays within capacity and rejects a confirmation that overflows capacity',
    async ({ browser }, testInfo) => {
      const anchorDates = projectWindow(testInfo.project.name, 1, 4); // days 01..05
      const overlappingDates = projectWindow(testInfo.project.name, 2, 4); // days 02..06 (overlaps days 02..05)
      const extraPetName = `Scout-${testInfo.project.name}`;

      const casey = await signIn(browser, 'casey@petswap.test');
      const blair = await signIn(browser, 'blair@petswap.test');
      const alex = await signIn(browser, 'alex@petswap.test');

      try {
        // Casey adds a second dog so three distinct pets can request Alex's capacity-2 listing.
        await createPet(casey, extraPetName, 'Dog');

        // 1. Casey requests Rocket on days 01..05; Blair requests Pixel on overlapping days 02..06;
        //    Casey requests Scout on overlapping days 02..06.
        await requestBooking(casey, SUNNY_GARDEN_ID, 'Rocket (Dog)', anchorDates);
        await requestBooking(blair, SUNNY_GARDEN_ID, 'Pixel (Rabbit)', overlappingDates);
        await requestBooking(casey, SUNNY_GARDEN_ID, `${extraPetName} (Dog)`, overlappingDates);

        await alex.goto(routes.bookings);

        // 2. Alex confirms Rocket (1 of 2 places filled) and Pixel (2 of 2 places filled - within capacity).
        const rocketCard = findBookingCard(alex, anchorDates.start, {
          petName: 'Rocket',
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await expect(rocketCard.getByText('Pending', { exact: true })).toBeVisible();
        await rocketCard.getByRole('button', { name: 'Confirm' }).click();
        await expect(rocketCard.getByText('Confirmed', { exact: true })).toBeVisible();

        const pixelCard = findBookingCard(alex, overlappingDates.start, {
          petName: 'Pixel',
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await expect(pixelCard.getByText('Pending', { exact: true })).toBeVisible();
        await pixelCard.getByRole('button', { name: 'Confirm' }).click();
        await expect(pixelCard.getByText('Confirmed', { exact: true })).toBeVisible();

        // 3. Alex tries to confirm Scout for the same overlapping window -> rejected with capacity error.
        const overflowCard = findBookingCard(alex, overlappingDates.start, {
          petName: extraPetName,
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await expect(overflowCard.getByText('Pending', { exact: true })).toBeVisible();
        await overflowCard.getByRole('button', { name: 'Confirm' }).click();

        const alert = overflowCard.getByRole('alert');
        await expect(alert).toBeVisible();
        await expect(alert).toHaveText(CAPACITY_CONFLICT_MESSAGE);
        await expect(overflowCard.getByText('Pending', { exact: true })).toBeVisible();
      } finally {
        await casey.context().close();
        await blair.context().close();
        await alex.context().close();
      }
    },
  );

  test(
    'rejects confirming a stay when the same pet already has an overlapping confirmed booking at another listing',
    async ({ browser }, testInfo) => {
      const firstStay = projectWindow(testInfo.project.name, 10, 4); // days 10..14 at Alex's listing
      const overlappingStay = projectWindow(testInfo.project.name, 12, 4); // days 12..16 at Blair's listing

      const casey = await signIn(browser, 'casey@petswap.test');
      const alex = await signIn(browser, 'alex@petswap.test');
      const blair = await signIn(browser, 'blair@petswap.test');

      try {
        // Casey requests Rocket at both Alex's Sunny garden room and Blair's Countryside cottage.
        await requestBooking(casey, SUNNY_GARDEN_ID, 'Rocket (Dog)', firstStay);
        await requestBooking(casey, COUNTRYSIDE_COTTAGE_ID, 'Rocket (Dog)', overlappingStay);

        // Alex confirms Rocket's first stay.
        await alex.goto(routes.bookings);
        const alexCard = findBookingCard(alex, firstStay.start, {
          petName: 'Rocket',
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await alexCard.getByRole('button', { name: 'Confirm' }).click();
        await expect(alexCard.getByText('Confirmed', { exact: true })).toBeVisible();

        // Blair tries to confirm Rocket for overlapping nights at Countryside cottage -> rejected with safe pet error.
        await blair.goto(routes.bookings);
        const blairCard = findBookingCard(blair, overlappingStay.start, {
          petName: 'Rocket',
          listingTitle: COUNTRYSIDE_COTTAGE_TITLE,
        });
        await expect(blairCard.getByText('Pending', { exact: true })).toBeVisible();
        await blairCard.getByRole('button', { name: 'Confirm' }).click();

        const alert = blairCard.getByRole('alert');
        await expect(alert).toBeVisible();
        await expect(alert).toHaveText(PET_CONFLICT_MESSAGE);
        await expect(blairCard.getByText('Pending', { exact: true })).toBeVisible();
      } finally {
        await casey.context().close();
        await alex.context().close();
        await blair.context().close();
      }
    },
  );

  test(
    'allows back-to-back confirmed stays where the second starts on the check-out day of the first',
    async ({ browser }, testInfo) => {
      const firstLeg = projectWindow(testInfo.project.name, 20, 4); // days 20..24
      const secondLeg = projectWindow(testInfo.project.name, 24, 4); // days 24..28 (starts on firstLeg's end date)

      const casey = await signIn(browser, 'casey@petswap.test');
      const alex = await signIn(browser, 'alex@petswap.test');

      try {
        await requestBooking(casey, SUNNY_GARDEN_ID, 'Rocket (Dog)', firstLeg);
        await requestBooking(casey, SUNNY_GARDEN_ID, 'Rocket (Dog)', secondLeg);

        await alex.goto(routes.bookings);

        const firstCard = findBookingCard(alex, firstLeg.start, {
          petName: 'Rocket',
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await firstCard.getByRole('button', { name: 'Confirm' }).click();
        await expect(firstCard.getByText('Confirmed', { exact: true })).toBeVisible();

        const secondCard = findBookingCard(alex, secondLeg.start, {
          petName: 'Rocket',
          listingTitle: SUNNY_GARDEN_TITLE,
        });
        await secondCard.getByRole('button', { name: 'Confirm' }).click();
        await expect(secondCard.getByText('Confirmed', { exact: true })).toBeVisible();
        await expect(secondCard.getByRole('alert')).toHaveCount(0);

        // Requester also sees both back-to-back stays as Confirmed.
        await casey.goto(routes.bookings);
        await expect(
          findBookingCard(casey, firstLeg.start, { listingTitle: SUNNY_GARDEN_TITLE }).getByText('Confirmed', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          findBookingCard(casey, secondLeg.start, { listingTitle: SUNNY_GARDEN_TITLE }).getByText('Confirmed', {
            exact: true,
          }),
        ).toBeVisible();
      } finally {
        await casey.context().close();
        await alex.context().close();
      }
    },
  );
});
