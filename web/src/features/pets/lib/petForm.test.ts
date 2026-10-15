import { PET_MAX_AGE_YEARS, parsePetForm, petToFormValues, type PetFormValues } from './petForm';

const validValues: PetFormValues = {
  name: 'Mali',
  species: 'dog',
  breed: '',
  age: '3',
  description: 'Friendly and loves walks.',
};

describe('parsePetForm', () => {
  it('accepts a complete pet and converts age to a number', () => {
    expect(parsePetForm(validValues)).toEqual({
      ok: true,
      values: { name: 'Mali', species: 'dog', breed: '', ageYear: 3, description: 'Friendly and loves walks.' },
    });
  });

  it('treats a blank age as unknown and leaves breed optional', () => {
    const result = parsePetForm({ ...validValues, age: '  ', breed: '' });
    expect(result).toEqual({ ok: true, values: expect.objectContaining({ ageYear: null, breed: '' }) });
  });

  it('accepts an age of zero for pets under one year old', () => {
    expect(parsePetForm({ ...validValues, age: '0' })).toEqual({
      ok: true,
      values: expect.objectContaining({ ageYear: 0 }),
    });
  });

  it.each([
    ['name is blank', { name: '   ' }, { name: 'Pet name is required.' }],
    ['species is not chosen', { species: '' }, { species: 'Choose a species.' }],
    ['species is not in the vocabulary', { species: 'Dog' }, { species: 'Species must use a supported option.' }],
    ['description is blank', { description: '  ' }, { description: 'Description is required.' }],
  ] as const)('blocks submission when %s', (_, overrides, expectedErrors) => {
    expect(parsePetForm({ ...validValues, ...overrides } as PetFormValues)).toEqual({ ok: false, errors: expectedErrors });
  });

  it.each(['-1', '1.5', 'abc', '3 years', '1e2'])('rejects age %p as not a whole number of years', (age) => {
    expect(parsePetForm({ ...validValues, age })).toEqual({
      ok: false,
      errors: { age: 'Age must be a whole number of years, 0 or more.' },
    });
  });

  it('accepts the maximum age and rejects anything above it', () => {
    expect(parsePetForm({ ...validValues, age: String(PET_MAX_AGE_YEARS) })).toEqual({
      ok: true,
      values: expect.objectContaining({ ageYear: PET_MAX_AGE_YEARS }),
    });
    expect(parsePetForm({ ...validValues, age: String(PET_MAX_AGE_YEARS + 1) })).toEqual({
      ok: false,
      errors: { age: `Age must be ${PET_MAX_AGE_YEARS} years or less.` },
    });
    expect(parsePetForm({ ...validValues, age: '99999999999' }).ok).toBe(false);
  });

  it('reports every missing required field at once', () => {
    const result = parsePetForm({ name: '', species: '', breed: '', age: '', description: '' });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['description', 'name', 'species']);
  });
});

describe('petToFormValues', () => {
  const savedPet = {
    name: 'Rocket',
    species: 'dog' as const,
    breed: 'Beagle mix',
    age_year: 4,
    description: 'Friendly with other dogs.',
  };

  it('copies a saved pet into form input', () => {
    expect(petToFormValues(savedPet)).toEqual({
      name: 'Rocket',
      species: 'dog',
      breed: 'Beagle mix',
      age: '4',
      description: 'Friendly with other dogs.',
    });
  });

  it('turns empty optional fields into blank input', () => {
    expect(petToFormValues({ ...savedPet, breed: null, age_year: null, description: null })).toMatchObject({
      breed: '',
      age: '',
      description: '',
    });
  });

  it('keeps age 0 instead of treating it as blank', () => {
    expect(petToFormValues({ ...savedPet, age_year: 0 }).age).toBe('0');
  });

  it('round-trips through parsePetForm unchanged', () => {
    expect(parsePetForm(petToFormValues(savedPet))).toEqual({
      ok: true,
      values: { name: 'Rocket', species: 'dog', breed: 'Beagle mix', ageYear: 4, description: 'Friendly with other dogs.' },
    });
  });
});
