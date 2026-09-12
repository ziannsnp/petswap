import {
  FACILITY_OPTIONS,
  parseFacilities,
  PET_TYPE_OPTIONS,
  serializeFacilities,
} from './listingOptions';

describe('pet type options', () => {
  it('offers every pet species supported by the database vocabulary', () => {
    expect(PET_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'dog', 'cat', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'exotic_mammal', 'bird', 'other',
    ]);
  });
});

describe('facility options', () => {
  it('matches the six optional choices in the approved prototype', () => {
    expect(FACILITY_OPTIONS).toEqual([
      'Lawn',
      'Air-conditioned room',
      'Security cameras',
      'Enclosed fence',
      'Daily photo updates',
      'Near a veterinary clinic',
    ]);
  });

  it('serializes selected choices into the existing text column', () => {
    const selected = [FACILITY_OPTIONS[0], FACILITY_OPTIONS[4]];

    expect(serializeFacilities(selected)).toBe('Lawn\nDaily photo updates');
    expect(parseFacilities(serializeFacilities(selected))).toEqual(selected);
  });

  it('stores null when no optional facility is selected', () => {
    expect(serializeFacilities([])).toBeNull();
    expect(parseFacilities(null)).toEqual([]);
  });
});
