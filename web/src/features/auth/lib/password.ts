const HAS_LETTER_PATTERN = /\p{L}/u;
const HAS_NON_LETTER_PATTERN = /[^\p{L}]/u;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include a letter and a non-letter.';

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    HAS_LETTER_PATTERN.test(password) &&
    HAS_NON_LETTER_PATTERN.test(password)
  );
}
