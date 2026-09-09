import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  normalizeUsername,
  validateUsername,
  isValidUsername,
  validatePassword,
  isValidPassword,
  validatePasswordConfirmation,
  validateEmail,
  isValidEmail,
  validateDisplayName,
  validateRegistration,
  validateLogin,
} from './credentialValidation';

describe('credentialValidation', () => {
  describe('normalizeUsername', () => {
    it('trims leading and trailing whitespace without changing case', () => {
      expect(normalizeUsername('  FluffyCat_99  ')).toBe('FluffyCat_99');
    });
  });

  describe('validateUsername and isValidUsername', () => {
    it('accepts valid usernames at the minimum and maximum boundaries', () => {
      const minUsername = 'a'.repeat(USERNAME_MIN_LENGTH);
      const maxUsername = 'z'.repeat(USERNAME_MAX_LENGTH);

      expect(validateUsername(minUsername)).toBeNull();
      expect(isValidUsername(minUsername)).toBe(true);

      expect(validateUsername(maxUsername)).toBeNull();
      expect(isValidUsername(maxUsername)).toBe(true);
    });

    it('accepts usernames with letters, digits, underscores, and internal periods', () => {
      expect(validateUsername('dog_lover.99')).toBeNull();
      expect(isValidUsername('dog_lover.99')).toBe(true);
      expect(validateUsername('MeowMix_123')).toBeNull();
      expect(isValidUsername('MeowMix_123')).toBe(true);
    });

    it('rejects empty or whitespace-only usernames', () => {
      expect(validateUsername('')).toBe('Choose a username.');
      expect(validateUsername('   ')).toBe('Choose a username.');
      expect(isValidUsername('')).toBe(false);
    });

    it('rejects usernames shorter than the minimum length', () => {
      expect(validateUsername('ab')).toBe(
        `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`,
      );
      expect(isValidUsername('ab')).toBe(false);
    });

    it('rejects usernames longer than the maximum length', () => {
      const longUsername = 'a'.repeat(USERNAME_MAX_LENGTH + 1);
      expect(validateUsername(longUsername)).toBe(
        `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`,
      );
      expect(isValidUsername(longUsername)).toBe(false);
    });

    it('rejects usernames with invalid characters or spaces', () => {
      expect(validateUsername('user name')).toBe(
        'Username can use letters, digits, periods, and underscores only.',
      );
      expect(validateUsername('user@domain')).toBe(
        'Username can use letters, digits, periods, and underscores only.',
      );
      expect(validateUsername('pet!friend')).toBe(
        'Username can use letters, digits, periods, and underscores only.',
      );
    });

    it('rejects usernames that begin or end with a period', () => {
      expect(validateUsername('.catowner')).toBe(
        'Username cannot begin or end with a period.',
      );
      expect(validateUsername('catowner.')).toBe(
        'Username cannot begin or end with a period.',
      );
    });

    it('rejects usernames that contain consecutive periods', () => {
      expect(validateUsername('cat..owner')).toBe(
        'Username cannot contain two periods in a row.',
      );
    });
  });

  describe('validatePassword and isValidPassword', () => {
    it('accepts valid passwords containing letters and numbers/symbols', () => {
      expect(validatePassword('P@ssword123')).toBeNull();
      expect(isValidPassword('P@ssword123')).toBe(true);
      expect(validatePassword('secret-token-9')).toBeNull();
      expect(isValidPassword('secret-token-9')).toBe(true);
    });

    it('rejects empty passwords', () => {
      expect(validatePassword('')).toBe('Enter a password.');
      expect(isValidPassword('')).toBe(false);
    });

    it('rejects passwords shorter than the minimum length', () => {
      expect(validatePassword('P@ss1')).toBe(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
      expect(isValidPassword('P@ss1')).toBe(false);
    });

    it('rejects passwords longer than 72 characters (Supabase bcrypt limit)', () => {
      const longPassword = 'A1!' + 'a'.repeat(PASSWORD_MAX_LENGTH);
      expect(validatePassword(longPassword)).toBe(
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
      );
      expect(isValidPassword(longPassword)).toBe(false);
    });

    it('rejects passwords with whitespace or non-printable characters', () => {
      expect(validatePassword('password with spaces 123')).toBe(
        'Password can use English letters, digits, and symbols only.',
      );
    });

    it('rejects passwords missing letters', () => {
      expect(validatePassword('123456789!@#')).toBe(
        'Password must contain at least one letter.',
      );
      expect(isValidPassword('123456789!@#')).toBe(false);
    });

    it('rejects passwords missing digits or symbols', () => {
      expect(validatePassword('abcdefghijk')).toBe(
        'Password must contain at least one digit or symbol.',
      );
      expect(isValidPassword('abcdefghijk')).toBe(false);
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('accepts matching passwords', () => {
      expect(validatePasswordConfirmation('Secret123!', 'Secret123!')).toBeNull();
    });

    it('rejects empty confirmation', () => {
      expect(validatePasswordConfirmation('Secret123!', '')).toBe('Re-enter your password.');
    });

    it('rejects mismatched confirmation', () => {
      expect(validatePasswordConfirmation('Secret123!', 'Different123!')).toBe(
        'Both passwords must match.',
      );
    });
  });

  describe('validateEmail and isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('sitter@example.com')).toBeNull();
      expect(isValidEmail('sitter@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@sub.domain.org')).toBeNull();
    });

    it('rejects malformed email addresses', () => {
      expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(validateEmail('missing@domain')).toBe('Enter a valid email address.');
      expect(validateEmail('@missingusername.com')).toBe('Enter a valid email address.');
    });

    it('handles empty email based on required flag', () => {
      expect(validateEmail('', false)).toBeNull();
      expect(validateEmail('', true)).toBe('Enter an email address.');
    });
  });

  describe('validateDisplayName', () => {
    it('accepts non-empty display name', () => {
      expect(validateDisplayName('Alice Smith')).toBeNull();
    });

    it('rejects empty or whitespace-only display name', () => {
      expect(validateDisplayName('')).toBe('Enter a display name.');
      expect(validateDisplayName('   ')).toBe('Enter a display name.');
    });
  });

  describe('validateRegistration aggregate validator', () => {
    it('reports all invalid fields simultaneously', () => {
      const errors = validateRegistration({
        username: 'ab',
        email: 'invalid-email',
        password: 'weak',
        passwordConfirmation: 'different',
        displayName: '',
        acceptedTerms: false,
      });

      expect(errors.username).toBe(
        `Username must be ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`,
      );
      expect(errors.email).toBe('Enter a valid email address.');
      expect(errors.password).toBe(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
      expect(errors.passwordConfirmation).toBe('Both passwords must match.');
      expect(errors.displayName).toBe('Enter a display name.');
      expect(errors.acceptedTerms).toBe(
        'You must accept the Terms of Service and Privacy Policy.',
      );
    });

    it('returns empty errors object when all fields are valid', () => {
      const errors = validateRegistration({
        username: 'ValidUser_1',
        email: 'valid@example.com',
        password: 'ValidPassword123!',
        passwordConfirmation: 'ValidPassword123!',
        displayName: 'Valid User',
        acceptedTerms: true,
      });

      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateLogin aggregate validator', () => {
    it('reports empty username/email and password', () => {
      const errors = validateLogin({
        usernameOrEmail: '  ',
        password: '',
      });

      expect(errors.usernameOrEmail).toBe('Enter your username or email.');
      expect(errors.password).toBe('Enter your password.');
    });

    it('returns empty errors when credentials provided', () => {
      const errors = validateLogin({
        usernameOrEmail: 'valid_user',
        password: 'Password123!',
      });

      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
