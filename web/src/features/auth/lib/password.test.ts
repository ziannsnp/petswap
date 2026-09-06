import { describe, expect, it } from '@jest/globals';
import { isValidPassword } from './password';

describe('isValidPassword', () => {
  it.each(['abcdefg1', 'password!', 'รหัสผ่าน1'])('accepts %s', (password) => {
    expect(isValidPassword(password)).toBe(true);
  });

  it.each(['abcdef1', 'abcdefgh', '12345678', '!!!!!!!!'])('rejects %s', (password) => {
    expect(isValidPassword(password)).toBe(false);
  });
});
