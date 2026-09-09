# Username sign-in

## Overview

Supabase password authentication accepts an email address or phone number, not an application username. PetSwap requires a unique public username and allows a user to sign in with either that username or their private email address. Returning a username-to-email mapping from a public table or database function would expose private account data.

## Implementation

Email remains required and is stored only by Supabase Auth. `public.profiles.username` is the lowercase public identifier and does not duplicate the email address. Email sign-in calls Supabase Auth directly from the feature adapter. Username sign-in calls an unauthenticated Supabase Edge Function, which uses the service role only inside the trusted runtime to resolve the profile ID to its Auth user and perform the password grant. The function returns session tokens, never the resolved email, and credential failures use one generic error.

Usernames contain 3–30 lowercase ASCII letters, numbers, or underscores. Browser and adapter validation improve feedback; a database check constraint and unique constraint enforce the contract. A narrowly scoped availability function returns only whether a proposed username is available.

## Security and boundaries

The service-role key never enters the browser, and anonymous clients cannot query username-to-email mappings. The Edge Function must allow requests without an existing JWT because sign-in happens before authentication, so it validates origins and inputs and relies on Supabase Auth rate limits. Username availability is observable during registration, which is acceptable because usernames are public identifiers; email addresses remain private.

Login UI and TanStack mutation wiring remain separate from the adapter and Edge Function.
