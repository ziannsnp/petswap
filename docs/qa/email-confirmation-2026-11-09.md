# Manual test evidence

| Field | Record |
| --- | --- |
| Requirement / story | FR-1.1 — custom SMTP on hosted Supabase, email confirmation on hosted only, and a confirmed account logging in by email or username |
| Tester | Liger |
| Date and environment | TODO, hosted Supabase project `gqtdnckwubfdghynavwg`. Steps 5–11 on `npm run dev` (`http://localhost:5173`) from this branch (`main` at `35798b4` plus this branch) with `web/.env.local` pointing at the hosted project, because Cloudflare builds no branch previews; the confirmation link opens the Site URL (production) |
| Browser and viewport | TODO |
| Test data | A fresh Gmail `+tag` address outside the Supabase project, e.g. `<name>+confirm1@gmail.com`, username TODO. No password is recorded here |

Steps 1–4 are Supabase Dashboard settings; steps 5–11 run in the browser. Local and Docker keep auto-confirm through `enable_confirmations = false` in `supabase/config.toml` and `GOTRUE_MAILER_AUTOCONFIRM: 'true'` in `docker-compose.yml`; neither file changes here.

## Steps and result

| # | Action | Expected result | Actual result | Pass/Fail | Evidence link |
| --- | --- | --- | --- | --- | --- |
| 1 | Open Authentication → Emails → SMTP Settings. | Custom SMTP is on with the values in [environments.md](../environments.md#auth-email); the password field is hidden. | TODO | TODO | [01](evidence/email-confirm-01.png) |
| 2 | Open Authentication → Rate Limits. | Emails sent per hour is 50. | TODO | TODO | [02](evidence/email-confirm-02.png) |
| 3 | Send a password recovery email to an address outside the Supabase project. | It arrives from **PetSwap** and appears in the team Gmail's Sent folder. | TODO | TODO | [03](evidence/email-confirm-03.png) |
| 4 | Open Authentication → Sign In / Providers → Email and turn on **Confirm email**. | The setting is saved as on. | TODO | TODO | [04](evidence/email-confirm-04.png) |
| 5 | Register with the fresh address. | The **Check your email** screen opens with the address and a Resend button; the user is not signed in. | TODO | TODO | [05](evidence/email-confirm-05.png) |
| 6 | Before confirming, log in with the email, then with the username. | Both show **Confirm your email address before signing in.** | TODO | TODO | [06a](evidence/email-confirm-06a.png), [06b](evidence/email-confirm-06b.png) |
| 7 | Open the inbox. | The confirmation email arrives from **PetSwap**. | TODO | TODO | [07](evidence/email-confirm-07.png) |
| 8 | Click the link in the email. | It opens the PetSwap site, not `localhost`. | TODO | TODO | [08](evidence/email-confirm-08.png) |
| 9 | Log in with the email. | Signed in. | TODO | TODO | [09](evidence/email-confirm-09.png) |
| 10 | Log out, then log in with the username. | Signed in. | TODO | TODO | [10](evidence/email-confirm-10.png) |
| 11 | Log out and register again with the same email and a new username. | **This email is already registered.** No email is sent. | TODO | TODO | [11](evidence/email-confirm-11.png) |

## Defects / follow-up

- Issue link: TODO
- Owner: TODO
- Retest date/result: TODO
