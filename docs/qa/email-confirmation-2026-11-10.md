# Manual test evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-1.1 — custom SMTP on hosted Supabase, email confirmation on hosted only, and a confirmed account logging in by email or username |
| Tester | Liger, run with Claude Code driving Chrome through Playwright; Liger signed in to the Supabase Dashboard and Gmail by hand |
| Date and environment | 2026-11-10, hosted Supabase project `gqtdnckwubfdghynavwg`. Steps 5–11 on `npm run dev` (`http://localhost:5173`) from `feature/email-confirmation` (`main` at `35798b4` plus this branch), with `web/.env.local` pointing at the hosted project, because Cloudflare currently builds no branch previews |
| Browser and viewport | Desktop: Chrome 156, 1280×900. Mobile not run: these cards change settings and documentation, not a screen |
| Test data | A fresh account `<tester>+confirm1@gmail.com`, username `confirm_test_1`, display name **Confirm Test**. The tester's own mailbox part of the address is blacked out in the screenshots, and the password is not recorded here |

Steps 1–4 only view Supabase Dashboard settings; nothing was changed there during the test. Local and Docker keep auto-confirm through `enable_confirmations = false` in `supabase/config.toml` and `GOTRUE_MAILER_AUTOCONFIRM: 'true'` in `docker-compose.yml`; neither file changes here.

## Steps and result

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Open Authentication → Emails → SMTP Settings. | Custom SMTP is on with the values in [environments.md](../environments.md#auth-email). | Custom SMTP is on: sender **PetSwap** `petswap.app.mail@gmail.com`, host `smtp.gmail.com`, port `587`. The dashboard warns that Gmail is a personal provider. | Pass | [01](evidence/email-confirm-01.png) |
| 2 | Open Authentication → Rate Limits. | Emails sent per hour is 50. | **50** emails/h. Minimum interval per user is **60** seconds, matching the Resend cooldown (`RESEND_COOLDOWN_SECONDS`). | Pass | [02](evidence/email-confirm-02.png) |
| 3 | Check that an auth email reaches an address outside the Supabase project. | It arrives from **PetSwap**. | Covered by step 7: the confirmation email reached `<tester>+confirm1@gmail.com` from **PetSwap** `<petswap.app.mail@gmail.com>`. Supabase's built-in sender cannot reach that address, so it went through custom SMTP. | Pass | [07](evidence/email-confirm-07.png) |
| 4 | Open Authentication → Sign In / Providers. | **Confirm email** is on. | **Confirm email** is on. | Pass | [04](evidence/email-confirm-04.png) |
| 5 | Register with the fresh address. | The **Check your email** screen opens with the address and a Resend button; the user is not signed in. | **Check your email** shows `<tester>+confirm1@gmail.com`, **Resend confirmation email**, and **Go to sign in**. | Pass | [05](evidence/email-confirm-05.png) |
| 6 | Before confirming, log in with the email, then with the username. | Both show **Confirm your email address before signing in.** | Both show **Confirm your email address before signing in.** and stay on the login page. | Pass | [06a](evidence/email-confirm-06a.png), [06b](evidence/email-confirm-06b.png) |
| 7 | Open the inbox. | The confirmation email arrives from **PetSwap**. | **Confirm your email address** from **PetSwap** `<petswap.app.mail@gmail.com>`, to `<tester>+confirm1`, with a **Confirm email address** link. | Pass | [07](evidence/email-confirm-07.png) |
| 8 | Open the link in the email. | The account is confirmed and the PetSwap app opens. | The app opened at `http://localhost:5173/` (the origin the sign-up came from) signed in as **Confirm Test**. | Pass | [08](evidence/email-confirm-08.png) |
| 9 | In a fresh signed-out session, log in with the email. | Signed in. | The app left the login page and shows **Account** with the **CT** avatar of Confirm Test. | Pass | [09a](evidence/email-confirm-09a.png), [09b](evidence/email-confirm-09b.png) |
| 10 | In a fresh signed-out session, log in with the username. | Signed in. | Same as step 9. | Pass | [10a](evidence/email-confirm-10a.png), [10b](evidence/email-confirm-10b.png) |
| 11 | Sign out and register again with the same email and a new username. | **This email is already registered.** No email is sent. | **This email is already registered.** under the email field and above the submit button; no new email arrived. | Pass | [11](evidence/email-confirm-11.png) |

## Defects / follow-up

No defects in this change. Two findings outside it:

1. **The confirmation link signs the user straight in** instead of returning to the login page with a success message, as FR-1.1 now asks. This is the separate "auth redirect URLs" card.
   - Issue link: none; tracked by that Sprint Backlog card
   - Owner: Pinn
   - Retest date/result: 2026-11-12, pass on localhost against hosted: the link lands on the login page with a success message. Cause and evidence: [email-confirm-redirect-2026-11-12.md](email-confirm-redirect-2026-11-12.md)
2. **Search shows "We could not load listings"** (visible in screenshots 08, 09b and 10b, and on production). The `Supabase DB Push` job failed on `main` after PR #100, so the hosted `search_published_listings` lacks the `p_sort` argument the app now sends (`PGRST202`).
   - Issue link: none yet; to raise with QA / Infra and the PR #100 author
   - Owner: QA / Scrum / Infra (Tonpai)
   - Retest date/result: not retested
