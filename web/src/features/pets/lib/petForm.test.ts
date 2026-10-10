import { PET_PHOTO_MAX_BYTES, parsePetForm, validatePetPhoto, type PetFormValues } from './petForm';

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

  it('reports every missing required field at once', () => {
    const result = parsePetForm({ name: '', species: '', breed: '', age: '', description: '' });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['description', 'name', 'species']);
  });
});

describe('validatePetPhoto', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])('accepts %s', (type) => {
    expect(validatePetPhoto({ type, size: 1024 })).toBeNull();
  });

  it.each(['image/svg+xml', 'application/pdf', ''])('rejects unsupported type %p', (type) => {
    expect(validatePetPhoto({ type, size: 1024 })).toMatch(/unsupported file type/i);
  });

  it('accepts a photo exactly at the size limit and rejects one byte over', () => {
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES + 1 })).toMatch(/10 MB limit/);
  });
});
