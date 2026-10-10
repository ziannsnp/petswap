import { isPetSpecies, type PetSpecies } from '@/shared/lib/petSpecies';
import type { CreatePetValues } from './petApi';

/** Raw form input. Age stays a string so "1.5" or "abc" can be reported rather than
 * silently coerced, and species starts empty so the owner must choose one. */
export interface PetFormValues {
  name: string;
  species: PetSpecies | '';
  breed: string;
  age: string;
  description: string;
}

export type PetFormErrors = Partial<Record<keyof PetFormValues, string>>;

export type ParsedPetForm =
  | { ok: true; values: CreatePetValues }
  | { ok: false; errors: PetFormErrors };

export const EMPTY_PET_FORM_VALUES: PetFormValues = {
  name: '',
  species: '',
  breed: '',
  age: '',
  description: '',
};

const WHOLE_NUMBER = /^\d+$/;

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
  if (age && !WHOLE_NUMBER.test(age)) errors.age = 'Age must be a whole number of years, 0 or more.';
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
    },
  };
}

/**
 * These limits mirror the `pet-photos` bucket created in
 * `supabase/migrations/20261006090000_create_pet_photos_storage.sql`. Storage enforces
 * them on upload; rejecting here only lets the owner see the reason straight away.
 */
export const PET_PHOTO_MAX_BYTES = 10_485_760;

export const PET_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Returns why a chosen photo cannot be used, or null when it is acceptable. */
export function validatePetPhoto(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(PET_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.';
  }

  if (file.size > PET_PHOTO_MAX_BYTES) {
    return `Photo is larger than the ${PET_PHOTO_MAX_BYTES / 1_048_576} MB limit.`;
  }

  return null;
}
