import { describe, expect, it } from '@jest/globals';
import { isValidPassword } from './password';

describe('isValidPassword', () => {
  it.each(['Password1!', 'PETswap_2026', 'Aa1!aaaa'])('accepts %s', (password) => {
    expect(isValidPassword(password)).toBe(true);
  });

  it('accepts a password of exactly 72 characters', () => {
    expect(isValidPassword(`Aa1!${'a'.repeat(68)}`)).toBe(true);
  });

  it.each([
    'Pass1!',
    'PASSWORD1!',
    'password1!',
    'Password!',
    'Password1',
    'รหัสผ่านA1!',
    'Password 1!',
    'Password1😊',
    `Aa1!${'a'.repeat(69)}`,
    `Aa1!${'a'.repeat(1100)}`,
  ])('rejects %s', (password) => {
    expect(isValidPassword(password)).toBe(false);
  });
});
