# Manual test evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-1.1 — the confirmation link returns the user to the login page with a success message, and an unconfirmed account cannot log in with its email or username |
| Tester | Pinn |
| Date and environment | 2026-11-12, hosted Supabase project `gqtdnckwubfdghynavwg`. Steps 1–6 on `npm run dev` (`http://localhost:5173`) from `feature/auth-confirm-redirect` (`main` at `e93c57c` plus this branch), with `web/.env.local` pointing at the hosted project, because the change is not deployed yet. Step 3b ran earlier the same day on production |
| Browser and viewport | Desktop: Chrome, about 1915×930. Mobile not run (see follow-up) |
| Test data | A fresh account `<tester>+2@gmail.com`. For step 3b, an earlier account on production. Addresses and usernames are blacked out in the screenshots, and passwords are not recorded here |

## Supabase redirect configuration

Before testing, the first registration from `localhost` still opened production signed in. The confirmation link's `redirect_to` was the production root, not the `emailRedirectTo` the app sent. Authentication → URL Configuration → Redirect URLs held entries that did not match [environments.md](../environments.md#auth-redirect-configuration):

| Entry found | Problem |
| --- | --- |
| `https://petswap-web.zianporrutai.workers.dev/` | No `**`, so only the root path matched |
| `https://%2A-petswap-web.zianporrutai.workers.dev/` | `*` was stored URL-encoded, so it was a literal character, not a wildcard |
| `http://localhost:5173/` | No `**`, so `/login?confirmed=1` was rejected and Supabase fell back to the Site URL |

Pinn replaced them with the three entries in environments.md. Calling `/auth/v1/verify` with an invalid token and different `redirect_to` values shows where Auth would send a user without confirming anything:

| `redirect_to` | Before the fix | After the fix |
| --- | --- | --- |
| `http://localhost:5173/login?confirmed=1` | Production root | Kept |
| `https://petswap-web.zianporrutai.workers.dev/login?confirmed=1` | Kept | Kept |
| `https://chore-x-petswap-web.zianporrutai.workers.dev/login?confirmed=1` (branch preview) | Production root | Kept |
| `https://evil.example.com/login?confirmed=1` | — | Production root (rejected) |
| `https://x.evil-petswap-web.zianporrutai.workers.dev/login` | — | Production root (rejected) |

The encoded `%2A` entry also means Google sign-in on branch previews could not have returned to the preview before this fix.

## Steps and result

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Register with the fresh address. | **Check your email** shows the address. | **Check your email** shows the address with **Resend confirmation email** and **Go to sign in**. | Pass | [01](evidence/email-redirect-01.png) |
| 2 | Open the inbox. | The confirmation email arrives from **PetSwap**. | **Confirm your email address** from **PetSwap** `<petswap.app.mail@gmail.com>`. Gmail put it in Spam, as [environments.md](../environments.md#auth-email) warns for a personal sender. | Pass | [02](evidence/email-redirect-02.png) |
| 3a | Before confirming, log in with the email. | **Confirm your email address before signing in.** | That message; the user stays on the login page. | Pass | [03a](evidence/email-redirect-03a.png) |
| 3b | Before confirming, log in with the username. | Same message. | That message. Run on production before this branch; the username check is in the `sign-in` Edge Function, which this branch does not change. | Pass | [03b](evidence/email-redirect-03b.png) |
| 4 | Open the link in the email. | The login page opens with **Your email is confirmed. Sign in to continue.**, signed out. | The login page shows that message above an empty form. The screenshot does not show the address bar. | Pass | [04](evidence/email-redirect-04.png) |
| 5 | Open the same link again. | The login page says the link is invalid or expired. | `localhost:5173/login?confirmed=1#error=access_denied&error_code=otp_expired…` shows **This confirmation link is invalid or has expired. Try signing in, or request a new link from the Check your email screen.** | Pass | [05](evidence/email-redirect-05.png) |
| 6 | After step 4, open `/pets`. | Redirected to `/login` (not signed in). | Not run. | Not run | — |
| 7 | After confirming, log in with the email, then with the username. | Signed in each time. | Not run on this account. The 2026-11-10 run covers it ([steps 9–10](email-confirmation-2026-11-10.md)), and this branch does not change sign-in. | Not run | — |

Automated coverage for the same behaviour: `authApi.test.ts` (an unconfirmed account cannot sign in with its email or its username, and no session is stored; the redirect URL sign-up and Resend send), `useConfirmationLanding.test.tsx` and `confirmationLink.test.ts` (success, failure, and plain visits), and `AuthScreen.test.tsx` (the messages, and staying on the login page when unconfirmed).

## Defects / follow-up

1. **Redirect URLs did not match the documentation.** Fixed in the dashboard during this test, as above.
   - Issue link: none; fixed in place
   - Owner: Pinn
   - Retest date/result: 2026-11-12, all allowed and rejected cases behave as expected
2. **Not yet verified:** that the link signs the user out (step 6), the mobile layout of both messages, and the same journey on production once this branch is merged.
   - Issue link: none; tracked by the Sprint Backlog card
   - Owner: Pinn
   - Retest date/result: not retested
