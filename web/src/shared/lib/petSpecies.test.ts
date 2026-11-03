import { isPetSpecies, PET_SPECIES_OPTIONS, petSpeciesLabel } from './petSpecies';

describe('pet species vocabulary', () => {
  it('offers every pet species supported by the database vocabulary', () => {
    expect(PET_SPECIES_OPTIONS.map((option) => option.value)).toEqual([
      'dog', 'cat', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'exotic_mammal', 'bird', 'other',
    ]);
  });

  it('maps enum values to display labels', () => {
    expect(petSpeciesLabel('guinea_pig')).toBe('Guinea pig');
    expect(petSpeciesLabel('exotic_mammal')).toBe('Exotic mammal');
  });

  it('accepts enum values and rejects display labels or unknown species', () => {
    expect(isPetSpecies('dog')).toBe(true);
    expect(isPetSpecies('Dog')).toBe(false);
    expect(isPetSpecies('dragon')).toBe(false);
  });
});
