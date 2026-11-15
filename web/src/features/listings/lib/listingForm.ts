import { isPetSpecies, type PetSpecies } from '@/shared/lib/petSpecies';

/**
 * A host looks after a handful of pets at once. The bound also keeps the value far inside the
 * Postgres `integer` column, which a browser-only form would otherwise let overflow into a
 * generic save failure.
 */
export const LISTING_CAPACITY_MAX = 50;

export interface ListingFormValues {
  title: string;
  location: string;
  description: string;
  capacity: number | '';
  acceptedPetTypes: PetSpecies[];
}

export type ListingFormErrors = Partial<Record<keyof ListingFormValues, string>>;

export function validateListingForm(values: ListingFormValues): ListingFormErrors {
  const errors: ListingFormErrors = {};

  if (!values.title.trim()) errors.title = 'Listing title is required.';
  if (!values.location.trim()) errors.location = 'Location is required.';
  if (!values.description.trim()) errors.description = 'Description is required.';
  if (values.capacity === '') {
    errors.capacity = 'Capacity is required.';
  } else if (!Number.isInteger(values.capacity)) {
    errors.capacity = 'Capacity must be a whole number.';
  } else if (values.capacity < 1) {
    errors.capacity = 'Capacity must be at least 1.';
  } else if (values.capacity > LISTING_CAPACITY_MAX) {
    errors.capacity = `Capacity must be ${LISTING_CAPACITY_MAX} or fewer.`;
  }
  if (values.acceptedPetTypes.length === 0) {
    errors.acceptedPetTypes = 'Choose at least one accepted pet type.';
  } else if (values.acceptedPetTypes.some((petType) => !isPetSpecies(petType))) {
    errors.acceptedPetTypes = 'Accepted pet types must use a supported option.';
  }

  return errors;
}
