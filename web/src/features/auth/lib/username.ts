const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const USERNAME_REQUIREMENTS_MESSAGE =
  'Username must be 3–30 characters and contain only letters, numbers, and underscores.';

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}
