// Pure validation rules for profile management. These mirror FR-1.2 in docs/requirements.md
// and the profiles table schema in supabase/migrations. Keeping them pure and decoupled from React
// and Supabase enables direct reuse in profile forms and API adapters, and easy testing.

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const PHONE_NUMBER_MIN_LENGTH = 9;
export const PHONE_NUMBER_MAX_LENGTH = 10;
export const LOCATION_MAX_LENGTH = 100;

const DIGITS_ONLY_PATTERN = /^\d+$/;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Strips formatting characters (spaces, dashes, parentheses) from a phone number string.
 */
export function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s\-()]/g, '');
}

/**
 * Validates display name per FR-1.2. Required, non-empty, and bounded length.
 */
export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Display name cannot be empty.';
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }

  return null;
}

export function isValidDisplayName(value: string): boolean {
  return validateDisplayName(value) === null;
}

/**
 * Validates phone number per FR-1.2 and DB varchar(10) constraint.
 * Requires 9 to 10 digits (standard Thai format, e.g. 0812345678 or 021234567).
 */
export function validatePhoneNumber(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Phone number cannot be empty.';
  }

  const normalized = normalizePhoneNumber(trimmed);

  if (!DIGITS_ONLY_PATTERN.test(normalized)) {
    return 'Phone number can contain digits only.';
  }

  if (
    normalized.length < PHONE_NUMBER_MIN_LENGTH ||
    normalized.length > PHONE_NUMBER_MAX_LENGTH
  ) {
    return `Phone number must be ${PHONE_NUMBER_MIN_LENGTH} to ${PHONE_NUMBER_MAX_LENGTH} digits.`;
  }

  return null;
}

export function isValidPhoneNumber(value: string): boolean {
  return validatePhoneNumber(value) === null;
}

/**
 * Validates location per FR-1.2. Required, non-empty, and bounded length.
 */
export function validateLocation(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Location cannot be empty.';
  }

  if (trimmed.length > LOCATION_MAX_LENGTH) {
    return `Location must be at most ${LOCATION_MAX_LENGTH} characters.`;
  }

  return null;
}

export function isValidLocation(value: string): boolean {
  return validateLocation(value) === null;
}

/**
 * Validates optional photo URL. If provided, must be a valid http or https URL.
 */
export function validatePhotoUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return URL_PATTERN.test(trimmed)
    ? null
    : 'Enter a valid photo URL starting with http:// or https://.';
}

export function isValidPhotoUrl(value: string | null | undefined): boolean {
  return validatePhotoUrl(value) === null;
}

export interface ProfileFormFields {
  displayName?: string;
  display_name?: string;
  phoneNumber?: string;
  phone_number?: string;
  location?: string;
  photoUrl?: string | null;
  photo_url?: string | null;
}

export interface ProfileValidationErrors {
  displayName?: string;
  phoneNumber?: string;
  location?: string;
  photoUrl?: string;
}

/**
 * Validates all profile fields at once, returning an error object containing
 * all invalid field messages. Returns an empty object if valid.
 */
export function validateProfileForm(fields: ProfileFormFields): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  const nameVal = fields.displayName ?? fields.display_name ?? '';
  const nameError = validateDisplayName(nameVal);
  if (nameError) {
    errors.displayName = nameError;
  }

  const phoneVal = fields.phoneNumber ?? fields.phone_number ?? '';
  const phoneError = validatePhoneNumber(phoneVal);
  if (phoneError) {
    errors.phoneNumber = phoneError;
  }

  const locVal = fields.location ?? '';
  const locError = validateLocation(locVal);
  if (locError) {
    errors.location = locError;
  }

  const photoVal = fields.photoUrl !== undefined ? fields.photoUrl : fields.photo_url;
  const photoError = validatePhotoUrl(photoVal);
  if (photoError) {
    errors.photoUrl = photoError;
  }

  return errors;
}
