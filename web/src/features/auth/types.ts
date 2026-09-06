import type { Session, User } from '@supabase/supabase-js';

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignUpResult {
  user: User;
  session: Session | null;
}

export type SignUpErrorCode =
  | 'EMAIL_ALREADY_USED'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'RATE_LIMITED'
  | 'UNKNOWN';
