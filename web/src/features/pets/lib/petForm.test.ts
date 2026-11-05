import { hasPetCareInfo, PET_CARE_FIELDS, PET_CARE_MAX_LENGTH, PET_MAX_AGE_YEARS, parsePetForm, petToFormValues, type PetFormValues } from './petForm';

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

  it.each([
    ['surrounding spaces', '  3  ', 3],
    ['leading zeros', '007', 7],
  ])('accepts an age with %s', (_, age, ageYear) => {
    expect(parsePetForm({ ...validValues, age })).toEqual({
      ok: true,
      values: expect.objectContaining({ ageYear }),
    });
  });

  it('reports an invalid age together with the missing required fields', () => {
    const result = parsePetForm({ ...validValues, name: '', age: '-2' });
    expect(result).toEqual({
      ok: false,
      errors: { name: 'Pet name is required.', age: 'Age must be a whole number of years, 0 or more.' },
    });
  });

  // Photo changes come from the photo picker, so parsing the text fields must never
  // produce a photo value that could replace or clear the stored one.
  it('never returns photo fields', () => {
    const result = parsePetForm(validValues);
    expect(result.ok && result.values).not.toHaveProperty('photo');
    expect(result.ok && result.values).not.toHaveProperty('removePhoto');
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

describe('parsePetForm care information (FR-2.2)', () => {
  it('leaves care fields out when the form never held them, so an update keeps stored values', () => {
    const result = parsePetForm(validValues);
    for (const { field } of PET_CARE_FIELDS) {
      expect(result.ok && result.values).not.toHaveProperty(field);
    }
  });

  it.each(PET_CARE_FIELDS.map(({ field }) => field))('turns a blank %s into null', (field) => {
    expect(parsePetForm({ ...validValues, [field]: '   ' })).toEqual({
      ok: true,
      values: expect.objectContaining({ [field]: null }),
    });
  });

  it('trims care notes and keeps their line breaks', () => {
    expect(parsePetForm({ ...validValues, feeding_instruction: '  1 cup at 8am\n1 cup at 6pm  ' })).toEqual({
      ok: true,
      values: expect.objectContaining({ feeding_instruction: '1 cup at 8am\n1 cup at 6pm' }),
    });
  });

  it.each(PET_CARE_FIELDS)('accepts $field at the length limit and rejects it above', ({ field, label }) => {
    // Surrounding spaces do not count toward the limit.
    const atLimit = ` ${'a'.repeat(PET_CARE_MAX_LENGTH)} `;
    expect(parsePetForm({ ...validValues, [field]: atLimit })).toEqual({
      ok: true,
      values: expect.objectContaining({ [field]: 'a'.repeat(PET_CARE_MAX_LENGTH) }),
    });
    expect(parsePetForm({ ...validValues, [field]: 'a'.repeat(PET_CARE_MAX_LENGTH + 1) })).toEqual({
      ok: false,
      errors: { [field]: `${label} must be ${PET_CARE_MAX_LENGTH} characters or fewer.` },
    });
  });

  it('reports a too-long care note together with a missing required field', () => {
    const result = parsePetForm({ ...validValues, name: '', allergies: 'a'.repeat(PET_CARE_MAX_LENGTH + 1) });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['allergies', 'name']);
  });
});

describe('petToFormValues care information', () => {
  const savedPet = {
    name: 'Rocket',
    species: 'dog' as const,
    breed: null,
    age_year: null,
    description: 'Friendly.',
    feeding_instruction: 'Twice a day',
    medical_note: null,
    behavior_note: null,
    allergies: 'Chicken',
    vaccination_info: null,
    special_requirement: null,
  };

  it('round-trips stored care notes through parsePetForm', () => {
    expect(parsePetForm(petToFormValues(savedPet))).toEqual({
      ok: true,
      values: expect.objectContaining({ feeding_instruction: 'Twice a day', allergies: 'Chicken' }),
    });
  });

  it('saves a cleared care note as null', () => {
    const values = { ...petToFormValues(savedPet), allergies: '' };
    expect(parsePetForm(values)).toEqual({ ok: true, values: expect.objectContaining({ allergies: null }) });
  });
});

describe('hasPetCareInfo', () => {
  it('is false when every care field is missing, null, or blank', () => {
    expect(hasPetCareInfo({})).toBe(false);
    expect(hasPetCareInfo({ feeding_instruction: null, allergies: '  \n ' })).toBe(false);
  });

  it('is true when any care field has text', () => {
    expect(hasPetCareInfo({ special_requirement: 'Needs a ramp' })).toBe(true);
  });
});
