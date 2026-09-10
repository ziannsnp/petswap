// Sibling of username.ts and password.ts: one credential rule per module, kept
// free of React and Supabase so the registration form and the auth adapters can
// share it and Jest can cover it without a browser.

// Deliberately narrower than RFC 5322: a single @, no spaces, and a dotted domain
// with a 2+ character TLD. The authoritative check is Supabase rejecting the
// address at signup; this only catches typos before a network round trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const EMAIL_REQUIREMENTS_MESSAGE = 'Enter a valid email address, for example name@example.com.';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}
