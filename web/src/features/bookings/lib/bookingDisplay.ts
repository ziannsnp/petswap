import type { Database } from '@/shared/types/database.types';
import { asUtcDay } from './bookingRules';

export type BookingStatus = Database['public']['Enums']['booking_status'];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/** A booking date (a plain UTC calendar day) as "Mar 1, 2027". */
export function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

/** A timestamp from the database, shown in UTC like the booking day itself. */
export function formatBookingTimestamp(timestamp: string): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatSpecies(species: string): string {
  return species.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

/** Nights in an end-exclusive stay: check-in day to the check-out day. */
export function countNights(startDate: string, endDate: string): number {
  return Math.round((asUtcDay(endDate) - asUtcDay(startDate)) / 86_400_000);
}
