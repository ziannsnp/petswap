import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// The smoke suite (e2e/smoke.spec.ts) only touches public, static routes, so it
// runs against `npm run dev` with no Supabase env. The booking journey
// (e2e/booking-flow.spec.ts) needs the local Supabase stack running and reset
// (`npx supabase db reset`) so the seeded accounts from supabase/seed.sql exist.
//
// Set PLAYWRIGHT_BASE_URL to run against an already-running server or a deployed
// preview instead of starting one here.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A flaky end-to-end test is a defect to fix, not to paper over with retries
  // (docs/testing.md).
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    // retries stay at 0, so 'on-first-retry' would never fire — keep a trace
    // whenever a test fails instead.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
