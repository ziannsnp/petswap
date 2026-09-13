import { expect, test, type Page } from '@playwright/test';
import { routes } from './support/routes';

// Covers the account-menu / logout flow this branch changed: the desktop
// avatar dropdown (Edit profile + Log out) and the mobile menu's Log out
// button, which used to close the menu without ever calling signOut().
//
// Needs the local Supabase stack and a seeded account (supabase/seed.sql):
//   1. supabase start   (or: npx supabase start)
//   2. point web/.env.local at the local project (see docs/getting-started.md)
//   3. npm run test:e2e -- navbar-account-menu.spec.ts

const TEST_EMAIL = 'alex@petswap.test';
const TEST_PASSWORD = 'petswap-local-dev';

async function signIn(page: Page) {
  await page.goto(routes.login);
  await page.getByLabel(/email or username/i).fill(TEST_EMAIL);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(new RegExp(`${routes.login}$`));
}

test.describe('desktop account menu', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opens Edit profile and Log out from the avatar dropdown, and logging out signs the user out', async ({
    page,
  }) => {
    await signIn(page);

    await expect(page.getByRole('menuitem', { name: /edit profile/i })).toHaveCount(0);
    await page.getByRole('button', { name: /account menu/i }).click();

    const profileLink = page.getByRole('menuitem', { name: /edit profile/i });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute('href', routes.profile);

    await page.getByRole('menuitem', { name: /log out/i }).click();

    const dialog = page.getByRole('dialog', { name: /log out/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^log out$/i }).click();

    // Proves the real signOut() ran, not just that the dialog closed.
    await expect(page).toHaveURL(new RegExp(`${routes.login}$`));
    await page.goto(routes.search);
    await expect(page.getByRole('link', { name: /^log in$/i })).toBeVisible();
  });
});

test.describe('mobile menu logout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('confirming logout from the mobile menu actually signs the user out', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: /toggle main menu/i }).click();
    await page.getByRole('button', { name: /log out/i }).click();

    const dialog = page.getByRole('dialog', { name: /log out/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^log out$/i }).click();

    // This is the regression this branch fixed: confirming used to close the
    // menu without calling signOut(), so the visitor stayed authenticated.
    await expect(page).toHaveURL(new RegExp(`${routes.login}$`));
    await page.goto(routes.search);
    await expect(page.getByRole('link', { name: /^log in$/i })).toBeVisible();
  });
});
