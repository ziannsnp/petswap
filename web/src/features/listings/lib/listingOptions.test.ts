import { PET_TYPE_OPTIONS, type PetSpecies } from './listingOptions';

describe('PET_TYPE_OPTIONS', () => {
  it('offers every pet_species value with a display label', () => {
    const expectedSpecies: PetSpecies[] = [
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
});
