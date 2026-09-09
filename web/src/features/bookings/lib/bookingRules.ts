import type { BookingStatus, BookingWindow, ExistingBooking } from '../types';

export function asUtcDay(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new RangeError(`Invalid booking date: ${date}`);
  }
  return timestamp;
}

export function assertValidWindow(window: BookingWindow): void {
  if (asUtcDay(window.startDate) >= asUtcDay(window.endDate)) {
    throw new RangeError('A booking end date must be later than its start date.');
  }
}

/**
 * Pure conflict check: Returns true when an existing confirmed booking on the same listing overlaps the candidate window.
 * - Same-listing only: Bookings on other listings never conflict.
 * - Confirmed only: Pending, declined, cancelled, and completed bookings do not block dates.
 * - End-exclusive intervals [start, end): Back-to-back bookings (where one ends on the day another begins) do not conflict.
 * - Self-check safe: If candidate and existing booking share the same ID, it is not considered a conflict with itself.
 */
export function hasBookingConflict(candidate: BookingWindow, existingBookings: readonly ExistingBooking[]): boolean {
  assertValidWindow(candidate);
  const candidateStart = asUtcDay(candidate.startDate);
  const candidateEnd = asUtcDay(candidate.endDate);

  return existingBookings.some((booking) => {
    if (candidate.id && booking.id && candidate.id === booking.id) {
      return false;
    }
    assertValidWindow(booking);
    return booking.listingId === candidate.listingId
      && booking.status === 'confirmed'
      && candidateStart < asUtcDay(booking.endDate)
      && asUtcDay(booking.startDate) < candidateEnd;
  });
}

/** Defines the booking lifecycle; actor authorization and completion date checks remain separate. */
export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  const transitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
    pending: ['confirmed', 'declined', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    declined: [],
    cancelled: [],
    completed: [],
  };

  return transitions[from].includes(to);
}
