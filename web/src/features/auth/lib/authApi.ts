import { getSupabaseClient } from '@/shared/lib/supabase';
import { CURRENT_CONSENT_VERSION } from '@/features/consent';
import {
  isAuthRetryableFetchError,
  type AuthError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import type {
  SignInErrorCode,
  SignInInput,
  SignInResult,
  SignUpErrorCode,
  SignUpInput,
  SignUpResult,
} from '../types';
import { isValidUsername, normalizeUsername, USERNAME_REQUIREMENTS_MESSAGE } from './username';

const SIGN_UP_ERROR_MESSAGES: Record<SignUpErrorCode, string> = {
  EMAIL_ALREADY_USED: 'This email is already registered.',
  USERNAME_ALREADY_USED: 'This username is already taken.',
  INVALID_USERNAME: USERNAME_REQUIREMENTS_MESSAGE,
  INVALID_EMAIL: 'Enter a valid email address.',
  WEAK_PASSWORD: 'Choose a stronger password.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  NETWORK: 'Unable to connect. Check your internet connection and try again.',
  UNKNOWN: "We couldn't create your account. Please try again.",
};

const SIGN_IN_ERROR_MESSAGES: Record<SignInErrorCode, string> = {
  INVALID_CREDENTIALS: 'Username/email or password is incorrect.',
  INVALID_IDENTIFIER: 'Enter a valid email address or username.',
  EMAIL_NOT_CONFIRMED: 'Confirm your email address before signing in.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  UNKNOWN: "We couldn't sign you in. Please try again.",
};

interface UsernameSignInResponse {
  accessToken: string;
  refreshToken: string;
}

interface FunctionErrorPayload {
  error?: { code?: SignInErrorCode };
}

export class SignUpError extends Error {
  constructor(public readonly code: SignUpErrorCode) {
    super(SIGN_UP_ERROR_MESSAGES[code]);
    this.name = 'SignUpError';
  }
}

export class SignInError extends Error {
  constructor(public readonly code: SignInErrorCode) {
    super(SIGN_IN_ERROR_MESSAGES[code]);
    this.name = 'SignInError';
  }
}

export function translateSignUpError(error: AuthError): SignUpError {
  if (isAuthRetryableFetchError(error)) {
    return new SignUpError('NETWORK');
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const errorDetails = `${error.message} ${cause instanceof Error ? cause.message : ''}`;
  if (errorDetails.includes('profiles_username_key')) {
    return new SignUpError('USERNAME_ALREADY_USED');
  }

  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
      return new SignUpError('EMAIL_ALREADY_USED');
    case 'email_address_invalid':
      return new SignUpError('INVALID_EMAIL');
    case 'weak_password':
      return new SignUpError('WEAK_PASSWORD');
    case 'over_email_send_rate_limit':
      return new SignUpError('RATE_LIMITED');
    default:
      return new SignUpError('UNKNOWN');
  }
}

export function translateSignInError(error: AuthError): SignInError {
  switch (error.code) {
    case 'invalid_credentials':
      return new SignInError('INVALID_CREDENTIALS');
    case 'email_not_confirmed':
      return new SignInError('EMAIL_NOT_CONFIRMED');
    case 'over_request_rate_limit':
      return new SignInError('RATE_LIMITED');
    default:
      return new SignInError('UNKNOWN');
  }
}

async function translateFunctionError(error: unknown): Promise<SignInError> {
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      const payload = (await context.json()) as FunctionErrorPayload;
      const code = payload.error?.code;
      if (code && Object.hasOwn(SIGN_IN_ERROR_MESSAGES, code)) {
        return new SignInError(code);
      }
    } catch {
      // A malformed function response is an implementation failure, not a user-facing detail.
    }
  }

  return new SignInError('UNKNOWN');
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const username = normalizeUsername(input.username);

  if (!isValidUsername(username)) {
    throw new SignUpError('INVALID_USERNAME');
  }

  const supabase = getSupabaseClient();
  const { data: usernameAvailable, error: availabilityError } = await supabase.rpc(
    'is_username_available',
    { candidate_username: username },
  );

  if (availabilityError) {
    throw new SignUpError('UNKNOWN');
  }

  if (!usernameAvailable) {
    throw new SignUpError('USERNAME_ALREADY_USED');
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        username,
        display_name: input.displayName.trim(),
        consent_version: CURRENT_CONSENT_VERSION,
      },
    },
  });

  if (error) {
    throw translateSignUpError(error);
  }

  if (!data.user) {
    throw new SignUpError('UNKNOWN');
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function signIn(input: SignInInput): Promise<SignInResult> {
  const identifier = input.identifier.trim();

  if (!identifier || !input.password) {
    throw new SignInError('INVALID_IDENTIFIER');
  }

  if (identifier.includes('@')) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: input.password,
    });

    if (error) {
      throw translateSignInError(error);
    }

    if (!data.user || !data.session) {
      throw new SignInError('UNKNOWN');
    }

    return { user: data.user, session: data.session };
  }

  const username = normalizeUsername(identifier);
  if (!isValidUsername(username)) {
    throw new SignInError('INVALID_IDENTIFIER');
  }

  const supabase = getSupabaseClient();

  const { data: tokenData, error: functionError } =
    await supabase.functions.invoke<UsernameSignInResponse>('sign-in', {
      body: { username, password: input.password },
    });

  if (functionError) {
    throw await translateFunctionError(functionError);
  }

  if (!tokenData?.accessToken || !tokenData.refreshToken) {
    throw new SignInError('UNKNOWN');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken,
  });

  if (error) {
    throw translateSignInError(error);
  }

  if (!data.user || !data.session) {
    throw new SignInError('UNKNOWN');
  }

  return { user: data.user, session: data.session };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) {
    throw error;
  }
}
