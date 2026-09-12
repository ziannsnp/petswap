import { asUtcDay } from './bookingRules';

export interface BookingRequestFormValues {
  petId: string;
  startDate: string;
  endDate: string;
}

export type BookingRequestFormErrors = Partial<Record<keyof BookingRequestFormValues, string>>;

export function validateBookingRequestForm(values: BookingRequestFormValues): BookingRequestFormErrors {
  const errors: BookingRequestFormErrors = {};

  if (!values.petId) {
    errors.petId = 'Choose which pet this booking is for.';
  }

  if (!values.startDate) {
    errors.startDate = 'Start date is required.';
  }

  if (!values.endDate) {
    errors.endDate = 'End date is required.';
  }

  if (values.startDate && values.endDate) {
    try {
      if (asUtcDay(values.startDate) >= asUtcDay(values.endDate)) {
        errors.endDate = 'End date must be later than the start date.';
      }
    } catch {
      errors.endDate = 'Enter valid dates.';
    }
  }

  return errors;
}
