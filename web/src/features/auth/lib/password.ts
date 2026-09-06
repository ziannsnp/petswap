const ASCII_WITHOUT_SPACES_PATTERN = /^[\x21-\x7e]+$/;
const HAS_LOWERCASE_PATTERN = /[a-z]/;
const HAS_UPPERCASE_PATTERN = /[A-Z]/;
const HAS_NUMBER_PATTERN = /[0-9]/;
const HAS_SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include lowercase, uppercase, number, and special characters.';

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    ASCII_WITHOUT_SPACES_PATTERN.test(password) &&
    HAS_LOWERCASE_PATTERN.test(password) &&
    HAS_UPPERCASE_PATTERN.test(password) &&
    HAS_NUMBER_PATTERN.test(password) &&
    HAS_SPECIAL_CHARACTER_PATTERN.test(password)
  );
}
