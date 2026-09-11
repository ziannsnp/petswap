import { PET_TYPE_OPTIONS, serializeFacilities } from './listingOptions';

describe('pet type options', () => {
  it('offers every pet species supported by the database vocabulary', () => {
    expect(PET_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'dog', 'cat', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'exotic_mammal', 'bird', 'other',
    ]);
  });
});

describe('facility text storage', () => {
  it('keeps arbitrary multi-line text while trimming surrounding whitespace', () => {
    expect(serializeFacilities('  Fenced yard\nClose to a 24-hour vet  ')).toBe(
      'Fenced yard\nClose to a 24-hour vet',
    );
  });

  it('stores null for blank facility text', () => {
    expect(serializeFacilities('')).toBeNull();
    expect(serializeFacilities('   \n ')).toBeNull();
  });
});
