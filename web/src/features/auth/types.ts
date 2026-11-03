import type { Session, User } from '@supabase/supabase-js';

export interface SignUpInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface SignUpResult {
  user: User;
  session: Session | null;
}

export type SignUpErrorCode =
  | 'EMAIL_ALREADY_USED'
  | 'USERNAME_ALREADY_USED'
  | 'INVALID_USERNAME'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface SignInResult {
  user: User;
  session: Session;
}

export type SignInErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_IDENTIFIER'
  | 'PASSWORD_REQUIRED'
  | 'EMAIL_NOT_CONFIRMED'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';
