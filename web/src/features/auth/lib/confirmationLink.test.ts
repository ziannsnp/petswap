import { describe, expect, it } from '@jest/globals';
import { buildConfirmationRedirectUrl, readConfirmationOutcome } from './confirmationLink';

describe('buildConfirmationRedirectUrl', () => {
  it('points the confirmation link at the login page of the current origin', () => {
    expect(buildConfirmationRedirectUrl('https://petswap-web.zianporrutai.workers.dev')).toBe(
      'https://petswap-web.zianporrutai.workers.dev/login?confirmed=1',
    );
    expect(buildConfirmationRedirectUrl('http://localhost:5173')).toBe(
      'http://localhost:5173/login?confirmed=1',
    );
  });
});

describe('readConfirmationOutcome', () => {
  it('reports nothing for a plain visit to the login page', () => {
    expect(readConfirmationOutcome('', '')).toBeNull();
    expect(readConfirmationOutcome('?next=/pets', '')).toBeNull();
  });

  it('reports a confirmation when the marker is present', () => {
    expect(readConfirmationOutcome('?confirmed=1', '')).toBe('confirmed');
    expect(
      readConfirmationOutcome('?confirmed=1', '#access_token=a&refresh_token=r&type=signup'),
    ).toBe('confirmed');
  });

  it('reports a failure that Supabase puts in the fragment', () => {
    expect(
      readConfirmationOutcome(
        '?confirmed=1',
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toBe('failed');
  });

  it('reports a failure that Supabase puts in the query', () => {
    expect(readConfirmationOutcome('?confirmed=1&error_code=otp_expired', '')).toBe('failed');
    expect(readConfirmationOutcome('?error=access_denied', '')).toBe('failed');
  });
});
