import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import { SignUpError, signUp } from './authApi';

jest.mock('@/shared/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = jest.mocked(getSupabaseClient);

function authError(code: string): AuthError {
  return { code, message: 'Backend detail must not reach the user' } as AuthError;
}

function arrangeSignUpResult(result: {
  data: { user: User | null; session: Session | null };
  error: AuthError | null;
}) {
  type SignUpRequest = Parameters<AppSupabaseClient['auth']['signUp']>[0];
  const signUpMock = jest.fn<(credentials: SignUpRequest) => Promise<typeof result>>(
    async () => result,
  );
  mockedGetSupabaseClient.mockReturnValue({
    auth: { signUp: signUpMock },
  } as unknown as AppSupabaseClient);
  return signUpMock;
}

describe('signUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs up with trimmed profile metadata and preserves the password', async () => {
    const user = { id: 'user-1' } as User;
    const session = { access_token: 'token' } as Session;
    const signUpMock = arrangeSignUpResult({ data: { user, session }, error: null });

    await expect(
      signUp({ email: '  pet@example.com ', password: ' password ', displayName: '  Pat  ' }),
    ).resolves.toEqual({ user, session });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'pet@example.com',
      password: ' password ',
      options: { data: { display_name: 'Pat' } },
    });
  });

  it('accepts a successful signup without a session', async () => {
    const user = { id: 'user-1' } as User;
    arrangeSignUpResult({ data: { user, session: null }, error: null });

    await expect(
      signUp({ email: 'pet@example.com', password: 'password', displayName: 'Pat' }),
    ).resolves.toEqual({ user, session: null });
  });

  it.each([
    ['email_exists', 'EMAIL_ALREADY_USED', 'This email is already registered.'],
    ['user_already_exists', 'EMAIL_ALREADY_USED', 'This email is already registered.'],
    ['email_address_invalid', 'INVALID_EMAIL', 'Enter a valid email address.'],
    ['weak_password', 'WEAK_PASSWORD', 'Choose a stronger password.'],
    ['over_email_send_rate_limit', 'RATE_LIMITED', 'Too many attempts. Please try again later.'],
    ['unexpected_failure', 'UNKNOWN', "We couldn't create your account. Please try again."],
  ])('translates %s without exposing backend details', async (backendCode, appCode, message) => {
    arrangeSignUpResult({
      data: { user: null, session: null },
      error: authError(backendCode),
    });

    const result = signUp({ email: 'pet@example.com', password: 'password', displayName: 'Pat' });

    await expect(result).rejects.toMatchObject({
      name: 'SignUpError',
      code: appCode,
      message,
    });
  });

  it('returns a safe unknown error when Supabase returns no user', async () => {
    arrangeSignUpResult({ data: { user: null, session: null }, error: null });

    const result = signUp({ email: 'pet@example.com', password: 'password', displayName: 'Pat' });

    await expect(result).rejects.toEqual(new SignUpError('UNKNOWN'));
  });
});
