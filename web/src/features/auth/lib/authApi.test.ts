import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthRetryableFetchError, type AuthError, type Session, type User } from '@supabase/supabase-js';
import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import { CURRENT_CONSENT_VERSION } from '@/features/consent';
import { SignInError, SignUpError, signIn, signUp } from './authApi';

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
  const rpcMock = jest.fn<
    (
      functionName: string,
      args: { candidate_username: string },
    ) => Promise<{ data: boolean; error: null }>
  >(async () => ({ data: true, error: null }));
  mockedGetSupabaseClient.mockReturnValue({
    rpc: rpcMock,
    auth: { signUp: signUpMock },
  } as unknown as AppSupabaseClient);
  return { rpcMock, signUpMock };
}

describe('signUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs up with trimmed profile metadata and preserves the password', async () => {
    const user = { id: 'user-1' } as User;
    const session = { access_token: 'token' } as Session;
    const { rpcMock, signUpMock } = arrangeSignUpResult({
      data: { user, session },
      error: null,
    });

    await expect(
      signUp({
        email: '  pet@example.com ',
        username: '  Pat_Sitter  ',
        password: ' password ',
        displayName: '  Pat  ',
      }),
    ).resolves.toEqual({ user, session });

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'pet@example.com',
      password: ' password ',
      options: {
        data: {
          username: 'pat_sitter',
          display_name: 'Pat',
          consent_version: CURRENT_CONSENT_VERSION,
        },
      },
    });
    expect(rpcMock).toHaveBeenCalledWith('is_username_available', {
      candidate_username: 'pat_sitter',
    });
  });

  it('rejects an invalid username before calling Supabase', async () => {
    const result = signUp({
      email: 'pet@example.com',
      username: 'pat-sitter',
      password: 'password',
      displayName: 'Pat',
    });

    await expect(result).rejects.toMatchObject({
      name: 'SignUpError',
      code: 'INVALID_USERNAME',
      message:
        'Username must be 3–30 characters and contain only letters, numbers, and underscores.',
    });
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects a username that is already taken before creating the auth user', async () => {
    const signUpMock = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({
      rpc: jest.fn(async () => ({ data: false, error: null })),
      auth: { signUp: signUpMock },
    } as unknown as AppSupabaseClient);

    const result = signUp({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'password',
      displayName: 'Pat',
    });

    await expect(result).rejects.toEqual(new SignUpError('USERNAME_ALREADY_USED'));
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('accepts a successful signup without a session', async () => {
    const user = { id: 'user-1' } as User;
    arrangeSignUpResult({ data: { user, session: null }, error: null });

    await expect(
      signUp({
        email: 'pet@example.com',
        username: 'pat_sitter',
        password: 'password',
        displayName: 'Pat',
      }),
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

    const result = signUp({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'password',
      displayName: 'Pat',
    });

    await expect(result).rejects.toMatchObject({
      name: 'SignUpError',
      code: appCode,
      message,
    });
  });

  it('returns a safe unknown error when Supabase returns no user', async () => {
    arrangeSignUpResult({ data: { user: null, session: null }, error: null });

    const result = signUp({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'password',
      displayName: 'Pat',
    });

    await expect(result).rejects.toEqual(new SignUpError('UNKNOWN'));
  });
});

describe('signIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('translates retryable Auth fetch failures into a network error', async () => {
    arrangeSignUpResult({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError('fetch failed', 0),
    });

    const result = signUp({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'password1',
      displayName: 'Pat',
    });

    await expect(result).rejects.toEqual(new SignUpError('NETWORK'));
  });

  it('translates a profile username unique violation', async () => {
    arrangeSignUpResult({
      data: { user: null, session: null },
      error: {
        code: 'unexpected_failure',
        message: 'duplicate key violates unique constraint profiles_username_key',
      } as AuthError,
    });

    const result = signUp({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'password1',
      displayName: 'Pat',
    });

    await expect(result).rejects.toEqual(new SignUpError('USERNAME_ALREADY_USED'));
  });

  it('signs in directly with a trimmed email identifier', async () => {
    const user = { id: 'user-1' } as User;
    const session = { access_token: 'access', refresh_token: 'refresh' } as Session;
    const signInWithPassword = jest.fn<
      (credentials: { email: string; password: string }) =>
        Promise<{ data: { user: User; session: Session }; error: null }>
    >(async () => ({ data: { user, session }, error: null }));
    mockedGetSupabaseClient.mockReturnValue({
      auth: { signInWithPassword },
    } as unknown as AppSupabaseClient);

    await expect(
      signIn({ identifier: '  pet@example.com  ', password: ' password ' }),
    ).resolves.toEqual({ user, session });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'pet@example.com',
      password: ' password ',
    });
  });

  it('resolves a normalized username through the Edge Function and persists its session', async () => {
    const user = { id: 'user-1' } as User;
    const session = { access_token: 'access', refresh_token: 'refresh' } as Session;
    const invoke = jest.fn<
      (
        functionName: string,
        options: { body: { username: string; password: string } },
      ) => Promise<{
        data: { accessToken: string; refreshToken: string };
        error: null;
      }>
    >(async () => ({
      data: { accessToken: 'access', refreshToken: 'refresh' },
      error: null,
    }));
    const setSession = jest.fn<
      (tokens: { access_token: string; refresh_token: string }) =>
        Promise<{ data: { user: User; session: Session }; error: null }>
    >(async () => ({ data: { user, session }, error: null }));
    mockedGetSupabaseClient.mockReturnValue({
      functions: { invoke },
      auth: { setSession },
    } as unknown as AppSupabaseClient);

    await expect(
      signIn({ identifier: '  Pat_Sitter  ', password: ' password ' }),
    ).resolves.toEqual({ user, session });
    expect(invoke).toHaveBeenCalledWith('sign-in', {
      body: { username: 'pat_sitter', password: ' password ' },
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  it('translates invalid email credentials without exposing backend details', async () => {
    mockedGetSupabaseClient.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn(async () => ({
          data: { user: null, session: null },
          error: authError('invalid_credentials'),
        })),
      },
    } as unknown as AppSupabaseClient);

    const result = signIn({ identifier: 'pet@example.com', password: 'wrong' });

    await expect(result).rejects.toEqual(new SignInError('INVALID_CREDENTIALS'));
  });

  it('translates structured Edge Function errors', async () => {
    mockedGetSupabaseClient.mockReturnValue({
      functions: {
        invoke: jest.fn(async () => ({
          data: null,
          error: {
            context: Response.json(
              { error: { code: 'INVALID_CREDENTIALS' } },
              { status: 401 },
            ),
          },
        })),
      },
    } as unknown as AppSupabaseClient);

    const result = signIn({ identifier: 'pat_sitter', password: 'wrong' });

    await expect(result).rejects.toEqual(new SignInError('INVALID_CREDENTIALS'));
  });

  it('rejects malformed identifiers before calling Supabase', async () => {
    const result = signIn({ identifier: 'not-valid!', password: 'password' });

    await expect(result).rejects.toEqual(new SignInError('INVALID_IDENTIFIER'));
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });
});
