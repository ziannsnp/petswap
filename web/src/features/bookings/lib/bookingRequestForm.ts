import { earliestRequestStartDate, todayIsoDate } from './bookingDates';
import { asUtcDay } from './bookingRules';

export { earliestRequestStartDate, todayIsoDate };

export interface BookingRequestFormValues {
  petId: string;
  startDate: string;
  endDate: string;
}

export type BookingRequestFormErrors = Partial<Record<keyof BookingRequestFormValues, string>>;

/**
 * @param earliestStart the first allowed start day, normally `earliestRequestStartDate()`:
 *   the later of the visitor's local day and the database's UTC day.
 * @param localToday the visitor's own calendar day, used only to explain why a day that is
 *   still "today" locally is refused when UTC has already moved on.
 */
export function validateBookingRequestForm(
  values: BookingRequestFormValues,
  earliestStart: string = earliestRequestStartDate(),
  localToday: string = earliestStart,
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

      if (start < asUtcDay(earliestStart)) {
        errors.startDate = start >= asUtcDay(localToday)
          ? `Bookings can start from ${earliestStart}: the booking day changes at midnight UTC.`
          : 'Start date cannot be in the past.';
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
