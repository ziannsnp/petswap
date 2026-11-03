import { describe, expect, it } from '@jest/globals';
import { isValidEmail, normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and converts letters to lowercase', () => {
    expect(normalizeEmail('  Pat@Example.COM  ')).toBe('pat@example.com');
  });
});

describe('isValidEmail', () => {
  it.each(['pet@example.com', 'pat.sitter+tag@example.co.uk', '  Pat@Example.COM  '])(
    'accepts %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    '',
    'pet',
    'pet@',
    '@example.com',
    'pet@example',
    'pet@example.c',
    'pet example@test.com',
    'pet@@example.com',
  ])('rejects %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
