import {
  DISPLAY_NAME_MAX_LENGTH,
  PHONE_NUMBER_MIN_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  normalizePhoneNumber,
  validateDisplayName,
  isValidDisplayName,
  validatePhoneNumber,
  isValidPhoneNumber,
  validateLocation,
  isValidLocation,
  validatePhotoUrl,
  isValidPhotoUrl,
  validateProfileForm,
} from './profileValidation';

describe('profileValidation', () => {
  describe('normalizePhoneNumber', () => {
    it('strips dashes, spaces, and parentheses from phone number', () => {
      expect(normalizePhoneNumber('081-234-5678')).toBe('0812345678');
      expect(normalizePhoneNumber('(081) 234 5678')).toBe('0812345678');
      expect(normalizePhoneNumber(' 02-123-4567 ')).toBe('021234567');
    });

    it('converts international Thai prefix +66 and 66 to standard leading 0', () => {
      expect(normalizePhoneNumber('+66812345678')).toBe('0812345678');
      expect(normalizePhoneNumber('+66-81-234-5678')).toBe('0812345678');
      expect(normalizePhoneNumber('+66 (81) 234-5678')).toBe('0812345678');
      expect(normalizePhoneNumber('66812345678')).toBe('0812345678');
      expect(normalizePhoneNumber('+6621234567')).toBe('021234567');
    });
  });

  describe('validateDisplayName and isValidDisplayName', () => {
    it('accepts valid display names', () => {
      expect(validateDisplayName('Alice Smith')).toBeNull();
      expect(isValidDisplayName('Alice Smith')).toBe(true);
      expect(validateDisplayName('Somchai')).toBeNull();
    });

    it('accepts a display name up to the maximum character limit', () => {
      const maxName = 'A'.repeat(DISPLAY_NAME_MAX_LENGTH);
      expect(validateDisplayName(maxName)).toBeNull();
      expect(isValidDisplayName(maxName)).toBe(true);
    });

    it('rejects empty or whitespace-only display names', () => {
      expect(validateDisplayName('')).toBe('Display name cannot be empty.');
      expect(validateDisplayName('   ')).toBe('Display name cannot be empty.');
      expect(isValidDisplayName('')).toBe(false);
      expect(isValidDisplayName('   ')).toBe(false);
    });

    it('rejects display names exceeding the maximum length', () => {
      const longName = 'A'.repeat(DISPLAY_NAME_MAX_LENGTH + 1);
      expect(validateDisplayName(longName)).toBe(
        `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
      );
      expect(isValidDisplayName(longName)).toBe(false);
    });
  });

  describe('validatePhoneNumber and isValidPhoneNumber', () => {
    it('accepts valid 10-digit mobile numbers', () => {
      expect(validatePhoneNumber('0812345678')).toBeNull();
      expect(isValidPhoneNumber('0812345678')).toBe(true);
    });

    it('accepts valid 9-digit landline numbers', () => {
      expect(validatePhoneNumber('021234567')).toBeNull();
      expect(isValidPhoneNumber('021234567')).toBe(true);
    });

    it('accepts formatted numbers with dashes or spaces', () => {
      expect(validatePhoneNumber('081-234-5678')).toBeNull();
      expect(isValidPhoneNumber('081-234-5678')).toBe(true);
      expect(validatePhoneNumber('(02) 123-4567')).toBeNull();
    });

    it('accepts numbers with international prefix +66 and normalizes to 10 digits', () => {
      expect(validatePhoneNumber('+66812345678')).toBeNull();
      expect(isValidPhoneNumber('+66812345678')).toBe(true);
      expect(validatePhoneNumber('+66-81-234-5678')).toBeNull();
      expect(isValidPhoneNumber('+66-81-234-5678')).toBe(true);
    });

    it('rejects empty or whitespace-only phone numbers', () => {
      expect(validatePhoneNumber('')).toBe('Phone number cannot be empty.');
      expect(validatePhoneNumber('   ')).toBe('Phone number cannot be empty.');
      expect(isValidPhoneNumber('')).toBe(false);
    });

    it('rejects phone numbers with non-numeric characters', () => {
      expect(validatePhoneNumber('08123abcde')).toBe('Phone number can contain digits only.');
      expect(isValidPhoneNumber('08123abcde')).toBe(false);
    });

    it('rejects phone numbers shorter than the minimum length', () => {
      expect(validatePhoneNumber('12345678')).toBe(
        `Phone number must be ${PHONE_NUMBER_MIN_LENGTH} to ${PHONE_NUMBER_MAX_LENGTH} digits.`,
      );
      expect(isValidPhoneNumber('12345678')).toBe(false);
    });

    it('rejects phone numbers exceeding 10 digits (database varchar(10) limit)', () => {
      expect(validatePhoneNumber('08123456789')).toBe(
        `Phone number must be ${PHONE_NUMBER_MIN_LENGTH} to ${PHONE_NUMBER_MAX_LENGTH} digits.`,
      );
      expect(isValidPhoneNumber('08123456789')).toBe(false);
    });
  });

  describe('validateLocation and isValidLocation', () => {
    it('accepts valid locations', () => {
      expect(validateLocation('Bangkok, Thailand')).toBeNull();
      expect(isValidLocation('Bangkok, Thailand')).toBe(true);
      expect(validateLocation('Chiang Mai')).toBeNull();
    });

    it('rejects empty or whitespace-only locations', () => {
      expect(validateLocation('')).toBe('Location cannot be empty.');
      expect(validateLocation('   ')).toBe('Location cannot be empty.');
      expect(isValidLocation('')).toBe(false);
    });

    it('rejects locations exceeding the maximum length', () => {
      const longLocation = 'L'.repeat(LOCATION_MAX_LENGTH + 1);
      expect(validateLocation(longLocation)).toBe(
        `Location must be at most ${LOCATION_MAX_LENGTH} characters.`,
      );
      expect(isValidLocation(longLocation)).toBe(false);
    });
  });

  describe('validatePhotoUrl and isValidPhotoUrl', () => {
    it('accepts null, undefined, or empty string as optional photo URL', () => {
      expect(validatePhotoUrl(null)).toBeNull();
      expect(validatePhotoUrl(undefined)).toBeNull();
      expect(validatePhotoUrl('')).toBeNull();
      expect(validatePhotoUrl('   ')).toBeNull();
      expect(isValidPhotoUrl(null)).toBe(true);
    });

    it('accepts valid http and https URLs', () => {
      expect(validatePhotoUrl('https://example.com/avatar.jpg')).toBeNull();
      expect(isValidPhotoUrl('https://example.com/avatar.jpg')).toBe(true);
      expect(validatePhotoUrl('http://cdn.petswap.com/u/123.png')).toBeNull();
    });

    it('rejects malformed or non-http URLs', () => {
      expect(validatePhotoUrl('not-a-valid-url')).toBe(
        'Enter a valid photo URL starting with http:// or https://.',
      );
      expect(isValidPhotoUrl('not-a-valid-url')).toBe(false);
      expect(validatePhotoUrl('ftp://example.com/file.jpg')).toBe(
        'Enter a valid photo URL starting with http:// or https://.',
      );
    });
  });

  describe('validateProfileForm aggregate validator', () => {
    it('reports all required field errors when fields are empty', () => {
      const result = validateProfileForm({
        displayName: '',
        phoneNumber: '',
        location: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toBe('Display name cannot be empty.');
      expect(result.errors.phoneNumber).toBe('Phone number cannot be empty.');
      expect(result.errors.location).toBe('Location cannot be empty.');
    });

    it('reports malformed photo URL alongside required field errors if invalid', () => {
      const result = validateProfileForm({
        displayName: 'Alice',
        phoneNumber: '0812345678',
        location: 'Bangkok',
        photoUrl: 'bad-url',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toBeUndefined();
      expect(result.errors.phoneNumber).toBeUndefined();
      expect(result.errors.location).toBeUndefined();
      expect(result.errors.photoUrl).toBe('Enter a valid photo URL starting with http:// or https://.');
    });

    it('returns empty errors object and sanitized database-ready values when all fields are valid', () => {
      const result = validateProfileForm({
        displayName: '  Alice Smith  ',
        phoneNumber: '  +66-81-234-5678  ',
        location: '  Bangkok, Thailand  ',
        photoUrl: '  https://images.petswap.com/avatars/user1.jpg  ',
      });

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);

      // Ensures caller receives clean, sanitized values safe for varchar(10)
      expect(result.sanitizedValues).toEqual({
        displayName: 'Alice Smith',
        phoneNumber: '0812345678',
        location: 'Bangkok, Thailand',
        photoUrl: 'https://images.petswap.com/avatars/user1.jpg',
      });
      expect(result.sanitizedValues.phoneNumber.length).toBeLessThanOrEqual(10);
    });

    it('supports snake_case database property names interchangeably and sets empty photoUrl to null', () => {
      const result = validateProfileForm({
        display_name: 'Bob Marley',
        phone_number: '0898765432',
        location: 'Phuket',
        photo_url: '',
      });

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
      expect(result.sanitizedValues.photoUrl).toBeNull();
      expect(result.sanitizedValues.phoneNumber).toBe('0898765432');
    });
  });
});
