import { getSupabaseClient } from '@/shared/lib/supabase';
import { CURRENT_CONSENT_VERSION } from '@/features/consent';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import type { SignUpErrorCode, SignUpInput, SignUpResult } from '../types';

const SIGN_UP_ERROR_MESSAGES: Record<SignUpErrorCode, string> = {
  EMAIL_ALREADY_USED: 'This email is already registered.',
  INVALID_EMAIL: 'Enter a valid email address.',
  WEAK_PASSWORD: 'Choose a stronger password.',
  RATE_LIMITED: 'Too many attempts. Please try again later.',
  UNKNOWN: "We couldn't create your account. Please try again.",
};

export class SignUpError extends Error {
  constructor(public readonly code: SignUpErrorCode) {
    super(SIGN_UP_ERROR_MESSAGES[code]);
    this.name = 'SignUpError';
  }
}

export function translateSignUpError(error: AuthError): SignUpError {
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

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
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
