const ASCII_WITHOUT_SPACES_PATTERN = /^[\x21-\x7e]+$/;
const HAS_LOWERCASE_PATTERN = /[a-z]/;
const HAS_UPPERCASE_PATTERN = /[A-Z]/;
const HAS_NUMBER_PATTERN = /[0-9]/;
const HAS_SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

/**
 * bcrypt, which Supabase Auth uses, only reads the first 72 bytes, and the username sign-in
 * Edge Function refuses anything over 1024 characters. Capping sign-up at 72 keeps every
 * accepted password usable on both sign-in paths.
 */
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be 8 to 72 characters and include lowercase, uppercase, number, and special characters.';

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= PASSWORD_MAX_LENGTH &&
    ASCII_WITHOUT_SPACES_PATTERN.test(password) &&
    HAS_LOWERCASE_PATTERN.test(password) &&
    HAS_UPPERCASE_PATTERN.test(password) &&
    HAS_NUMBER_PATTERN.test(password) &&
    HAS_SPECIAL_CHARACTER_PATTERN.test(password)
  );
}
