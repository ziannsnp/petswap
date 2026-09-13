import { getInitials } from './initials';

describe('getInitials', () => {
  it('returns a single initial for a one-word name', () => {
    expect(getInitials('Alex')).toBe('A');
  });

  it('returns two initials for a two-word name', () => {
    expect(getInitials('Alex Rivera')).toBe('AR');
  });

  it('caps at two initials for a name with more than two words', () => {
    expect(getInitials('Alex John Rivera')).toBe('AJ');
  });

  it('ignores extra whitespace between and around words', () => {
    expect(getInitials('  Alex   Rivera  ')).toBe('AR');
  });

  it('uppercases lowercase initials', () => {
    expect(getInitials('alex rivera')).toBe('AR');
  });

  it('supports non-Latin scripts', () => {
    expect(getInitials('สมชาย สายลม')).toBe('สส');
  });

  it('returns an empty string for an empty name', () => {
    expect(getInitials('')).toBe('');
  });

  it('returns an empty string for a whitespace-only name', () => {
    expect(getInitials('   ')).toBe('');
  });

  it('returns an empty string for null or undefined', () => {
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
  });
});
