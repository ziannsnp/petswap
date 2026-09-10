export interface ListingFormValues {
  title: string;
  location: string;
  description: string;
  capacity: number | '';
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
  }

  return errors;
}
