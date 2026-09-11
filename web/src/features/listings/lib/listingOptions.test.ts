import {
  FACILITY_OPTIONS,
  isPetSpecies,
  parseFacilities,
  petSpeciesLabel,
  PET_TYPE_OPTIONS,
  serializeFacilities,
} from './listingOptions';

describe('PET_TYPE_OPTIONS', () => {
  it('offers every pet_species value with display labels', () => {
    const expectedSpecies = [
      'dog',
      'cat',
      'rabbit',
      'hamster',
      'guinea_pig',
      'fish',
      'reptile',
      'exotic_mammal',
      'bird',
      'other',
    ];

    expect(PET_TYPE_OPTIONS.map(({ value }) => value)).toEqual(expectedSpecies);
    expect(PET_TYPE_OPTIONS.every(({ label }) => label.length > 0)).toBe(true);
  });

  it('checks and formats pet species values from the database enum', () => {
    expect(isPetSpecies('dog')).toBe(true);
    expect(isPetSpecies('guinea_pig')).toBe(true);
    expect(petSpeciesLabel('guinea_pig')).toBe('Guinea pig');
    expect(isPetSpecies('dragon')).toBe(false);
  });
});

describe('facilities round trip', () => {
  it('restores exactly what was selected', () => {
    const selected = ['Fenced yard', 'Air conditioning', 'Near a vet clinic'];

    expect(parseFacilities(serializeFacilities(selected))).toEqual(selected);
  });

  it('round-trips every offered facility', () => {
    const all = [...FACILITY_OPTIONS];

    expect(parseFacilities(serializeFacilities(all))).toEqual(all);
  });

  it('keeps a stored facility that is no longer an offered option', () => {
    expect(parseFacilities('Fenced yard\nHeated floor')).toEqual(['Fenced yard', 'Heated floor']);
    expect(serializeFacilities(['Fenced yard', 'Heated floor'])).toBe('Fenced yard\nHeated floor');
  });

  it('stores null rather than an empty string when nothing is selected', () => {
    expect(serializeFacilities([])).toBeNull();
    expect(serializeFacilities(['   '])).toBeNull();
    expect(parseFacilities(null)).toEqual([]);
    expect(parseFacilities('')).toEqual([]);
  });

  it('ignores blank lines and surrounding whitespace', () => {
    expect(parseFacilities('  Fenced yard  \n\n Air conditioning \n')).toEqual([
      'Fenced yard',
      'Air conditioning',
    ]);
  });
});
