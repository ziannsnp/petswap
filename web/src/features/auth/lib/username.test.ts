import { describe, expect, it } from '@jest/globals';
import { isValidUsername, normalizeUsername } from './username';

describe('normalizeUsername', () => {
  it('trims surrounding whitespace and converts letters to lowercase', () => {
    expect(normalizeUsername('  Pat_Sitter  ')).toBe('pat_sitter');
  });
});

describe('isValidUsername', () => {
  it.each(['pet', 'pat_sitter', 'user_123', 'a'.repeat(30)])('accepts %s', (username) => {
    expect(isValidUsername(username)).toBe(true);
  });

  it.each([
    'ab',
    'a'.repeat(31),
    'pat sitter',
    'pat-sitter',
    'แพท',
    'pat.sitter',
  ])('rejects %s', (username) => {
    expect(isValidUsername(username)).toBe(false);
  });
});
