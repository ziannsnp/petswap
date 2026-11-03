import { asUtcDay } from './bookingRules';

export interface BookingRequestFormValues {
  petId: string;
  startDate: string;
  endDate: string;
}

export type BookingRequestFormErrors = Partial<Record<keyof BookingRequestFormValues, string>>;

/**
 * Today as a `YYYY-MM-DD` calendar day in the visitor's own timezone, so "in the past"
 * means the same thing here as it does in the date picker they chose from.
 */
export function todayIsoDate(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function validateBookingRequestForm(
  values: BookingRequestFormValues,
  today: string = todayIsoDate(),
): BookingRequestFormErrors {
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
      const start = asUtcDay(values.startDate);

      if (start < asUtcDay(today)) {
        errors.startDate = 'Start date cannot be in the past.';
      }

      if (start >= asUtcDay(values.endDate)) {
        errors.endDate = 'End date must be later than the start date.';
      }
    } catch {
      errors.endDate = 'Enter valid dates.';
    }
  }

  return errors;
}
