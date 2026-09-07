// Pure credential rules for authentication and registration.
// Keeping them free of React and Supabase lets the squad reuse them
// across login/registration forms and auth API adapters, and test them without a browser.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt, the hash behind Supabase Authentication, reads no more than 72 characters.
export const PASSWORD_MAX_LENGTH = 72;

export const USERNAME_ALLOWED_CHARACTERS = /^[A-Za-z0-9._]+$/;
// Every printable ASCII character except space (\x21 '!' to \x7E '~').
export const PASSWORD_ALLOWED_CHARACTERS = /^[\x21-\x7E]+$/;
export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const USERNAME_REQUIREMENTS_MESSAGE =
  'Username must be 3 to 30 characters and use letters, digits, periods, and underscores only.';
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be 8 to 72 characters and contain at least one letter and at least one digit or symbol.';

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);

  if (!username) {
    return 'Choose a username.';
  }
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_ALLOWED_CHARACTERS.test(username)) {
    return 'Username can use letters, digits, periods, and underscores only.';
  }
  if (username.startsWith('.') || username.endsWith('.')) {
    return 'Username cannot begin or end with a period.';
  }
  if (username.includes('..')) {
    return 'Username cannot contain two periods in a row.';
  }

  return null;
}

export function isValidUsername(value: string): boolean {
  return validateUsername(value) === null;
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return 'Enter a password.';
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!PASSWORD_ALLOWED_CHARACTERS.test(value)) {
    return 'Password can use English letters, digits, and symbols only.';
  }
  if (!/[a-zA-Z]/.test(value)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[^a-zA-Z]/.test(value)) {
    return 'Password must contain at least one digit or symbol.';
  }

  return null;
}

export function isValidPassword(value: string): boolean {
  return validatePassword(value) === null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) {
    return 'Re-enter your password.';
  }

  return password === confirmation ? null : 'Both passwords must match.';
}

export function validateEmail(value: string, required: boolean = true): string | null {
  const email = value.trim();

  if (!email) {
    return required ? 'Enter an email address.' : null;
  }

  return EMAIL_PATTERN.test(email) ? null : 'Enter a valid email address.';
}

export function isValidEmail(value: string): boolean {
  return validateEmail(value, true) === null;
}

export function validateDisplayName(value: string): string | null {
  return value.trim() ? null : 'Enter a display name.';
}

export interface RegistrationValidationFields {
  username: string;
  email?: string;
  password: string;
  passwordConfirmation?: string;
  displayName?: string;
  acceptedTerms: boolean;
}

export type RegistrationValidationErrors = Partial<Record<keyof RegistrationValidationFields, string>>;

export function validateRegistration(fields: RegistrationValidationFields): RegistrationValidationErrors {
  const errors: RegistrationValidationErrors = {};

  const usernameError = validateUsername(fields.username);
  if (usernameError) errors.username = usernameError;

  if (fields.email !== undefined) {
    const emailError = validateEmail(fields.email, false);
    if (emailError) errors.email = emailError;
  }

  const passwordError = validatePassword(fields.password);
  if (passwordError) errors.password = passwordError;

  if (fields.passwordConfirmation !== undefined) {
    const confirmError = validatePasswordConfirmation(fields.password, fields.passwordConfirmation);
    if (confirmError) errors.passwordConfirmation = confirmError;
  }

  if (fields.displayName !== undefined) {
    const nameError = validateDisplayName(fields.displayName);
    if (nameError) errors.displayName = nameError;
  }

  if (!fields.acceptedTerms) {
    errors.acceptedTerms = 'You must accept the Terms of Service and Privacy Policy.';
  }

  return errors;
}

export interface LoginValidationFields {
  usernameOrEmail: string;
  password: string;
}

export type LoginValidationErrors = Partial<Record<keyof LoginValidationFields, string>>;

export function validateLogin(fields: LoginValidationFields): LoginValidationErrors {
  const errors: LoginValidationErrors = {};

  if (!fields.usernameOrEmail.trim()) {
    errors.usernameOrEmail = 'Enter your username or email.';
  }

  if (!fields.password) {
    errors.password = 'Enter your password.';
  }

  return errors;
}
