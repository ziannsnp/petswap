// The confirmation email's link goes through Supabase Auth, which verifies the token and
// then redirects to the `emailRedirectTo` the app passed at sign-up. That URL is the login
// page with this marker, so the login page can tell a visitor arriving from the email
// apart from one who simply opened it.
export const CONFIRMATION_PATH = '/login';
export const CONFIRMATION_MARKER = 'confirmed';

export type ConfirmationOutcome = 'confirmed' | 'failed';

export function buildConfirmationRedirectUrl(origin: string): string {
  return `${origin}${CONFIRMATION_PATH}?${CONFIRMATION_MARKER}=1`;
}

// Supabase reports a failed verification (an expired or already-used link) by appending
// `error` / `error_code` to the redirect: in the fragment for the implicit flow the
// client uses today, in the query for PKCE. Both are read so a later flow change does not
// silently turn a failure into a success message.
export function readConfirmationOutcome(search: string, hash: string): ConfirmationOutcome | null {
  const query = new URLSearchParams(search.replace(/^\?/, ''));
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));

  const failed = [query, fragment].some(
    (params) => params.has('error') || params.has('error_code'),
  );
  if (failed) {
    return 'failed';
  }

  return query.has(CONFIRMATION_MARKER) ? 'confirmed' : null;
}
