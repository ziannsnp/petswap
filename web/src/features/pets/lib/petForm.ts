import { isPetSpecies, type PetSpecies } from '@/shared/lib/petSpecies';
import type { CreatePetValues, Pet } from './petApi';

/** Raw form input. Age stays a string so "1.5" or "abc" can be reported rather than
 * silently coerced, and species starts empty so the owner must choose one. */
export interface PetFormValues {
  name: string;
  species: PetSpecies | '';
  breed: string;
  age: string;
  description: string;
  feeding_instruction?: string;
  medical_note?: string;
  behavior_note?: string;
  allergies?: string;
  vaccination_info?: string;
  special_requirement?: string;
}

export type PetFormErrors = Partial<Record<keyof PetFormValues, string>>;

export type ParsedPetForm =
  | { ok: true; values: Omit<CreatePetValues, 'photo'> }
  | { ok: false; errors: PetFormErrors };

export const EMPTY_PET_FORM_VALUES: PetFormValues = {
  name: '',
  species: '',
  breed: '',
  age: '',
  description: '',
};

/** Turns a saved pet into form input, so the edit form starts from what is stored. */
export function petToFormValues(
  pet: Pick<Pet, 'name' | 'species' | 'breed' | 'age_year' | 'description'> &
    Partial<Pick<Pet, 'feeding_instruction' | 'medical_note' | 'behavior_note' | 'allergies' | 'vaccination_info' | 'special_requirement'>>,
): PetFormValues {
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? '',
    age: pet.age_year === null ? '' : String(pet.age_year),
    description: pet.description ?? '',
    ...(pet.feeding_instruction ? { feeding_instruction: pet.feeding_instruction } : {}),
    ...(pet.medical_note ? { medical_note: pet.medical_note } : {}),
    ...(pet.behavior_note ? { behavior_note: pet.behavior_note } : {}),
    ...(pet.allergies ? { allergies: pet.allergies } : {}),
    ...(pet.vaccination_info ? { vaccination_info: pet.vaccination_info } : {}),
    ...(pet.special_requirement ? { special_requirement: pet.special_requirement } : {}),
  };
}

const WHOLE_NUMBER = /^\d+$/;

/** Generous enough for any real pet, and far below the Postgres `integer` limit. */
export const PET_MAX_AGE_YEARS = 100;

/**
 * Validates the form and, only when it is valid, returns the values the API adapter
 * accepts, so a screen cannot submit a pet without passing validation first.
 */
export function parsePetForm(values: PetFormValues): ParsedPetForm {
  const errors: PetFormErrors = {};
  const age = values.age.trim();

  if (!values.name.trim()) errors.name = 'Pet name is required.';
  if (values.species === '') {
    errors.species = 'Choose a species.';
  } else if (!isPetSpecies(values.species)) {
    errors.species = 'Species must use a supported option.';
  }
  if (age && !WHOLE_NUMBER.test(age)) {
    errors.age = 'Age must be a whole number of years, 0 or more.';
  } else if (age && Number(age) > PET_MAX_AGE_YEARS) {
    errors.age = `Age must be ${PET_MAX_AGE_YEARS} years or less.`;
  }
  if (!values.description.trim()) errors.description = 'Description is required.';

  if (Object.keys(errors).length > 0 || values.species === '') {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      name: values.name,
      species: values.species,
      breed: values.breed,
      ageYear: age ? Number(age) : null,
      description: values.description,
      ...(values.feeding_instruction !== undefined && {
        feeding_instruction: values.feeding_instruction.trim() || null,
      }),
      ...(values.medical_note !== undefined && {
        medical_note: values.medical_note.trim() || null,
      }),
      ...(values.behavior_note !== undefined && {
        behavior_note: values.behavior_note.trim() || null,
      }),
      ...(values.allergies !== undefined && {
        allergies: values.allergies.trim() || null,
      }),
      ...(values.vaccination_info !== undefined && {
        vaccination_info: values.vaccination_info.trim() || null,
      }),
      ...(values.special_requirement !== undefined && {
        special_requirement: values.special_requirement.trim() || null,
      }),
    },
  };
}
