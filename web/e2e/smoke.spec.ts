import { expect, test } from '@playwright/test';
import { routes } from './support/routes';

// Smoke coverage for the public shell. These routes render without auth or a
// Supabase connection, so they are a fast guard against the router, the build,
// or a shared layout regressing. Runs on the desktop and mobile projects
// configured in playwright.config.ts. The authenticated journey lives in
// booking-flow.spec.ts.

test('the search screen is the landing page', async ({ page }) => {
  await page.goto(routes.search);
  await expect(page.getByRole('heading', { name: /find pet care/i })).toBeVisible();
});

test('an unknown route shows the not-found screen', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /back to search/i })).toBeVisible();
});

test('the privacy notice and terms are reachable and cross-link', async ({ page }) => {
  await page.goto(routes.privacy);
  await expect(page.getByRole('heading', { name: /privacy notice/i })).toBeVisible();

  await page.getByRole('link', { name: /terms of service/i }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.terms}$`));
  await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();

  await page.getByRole('link', { name: /privacy notice/i }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.privacy}$`));
  await expect(page.getByRole('heading', { name: /privacy notice/i })).toBeVisible();
});
