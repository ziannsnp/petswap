import type {
  BookingCandidate,
  BookingConflictOptions,
  BookingConflictReason,
  BookingStatus,
  BookingWindow,
  ExistingBooking,
} from '../types';

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

function assertValidCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`A listing capacity must be a positive integer: ${capacity}`);
  }
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/**
 * Pure availability check for confirming `candidate` (ADR 0011). Returns why it would be refused, or null.
 *
 * - Confirmed only: pending, declined, cancelled, and completed bookings never block.
 * - End-exclusive intervals [start, end): back-to-back stays never conflict.
 * - Pet overlap first (`'pet_booked'`): when the candidate's `petId` is known, a confirmed booking for
 *   the same pet overlapping the window conflicts on any listing, whatever the capacity.
 * - Capacity is peak nightly occupancy (`'listing_full'`): confirmed bookings on the same listing are
 *   counted per night, and the candidate fits while no night of its window would exceed `capacity`
 *   (default 1). Overlap count is not occupancy: with capacity 2, A [1,3), B [3,5) and C [1,5) all fit.
 * - Self-check safe: an existing booking with the candidate's ID is ignored.
 *
 * The database (hold_booking_availability) makes the authoritative, concurrency-safe decision with the
 * same rules and order; this function lets the UI and tests reason about it without a round trip.
 */
export function getBookingConflict(
  candidate: BookingCandidate,
  existingBookings: readonly ExistingBooking[],
  { capacity = 1 }: BookingConflictOptions = {},
): BookingConflictReason | null {
  assertValidWindow(candidate);
  assertValidCapacity(capacity);
  const candidateStart = asUtcDay(candidate.startDate);
  const candidateEnd = asUtcDay(candidate.endDate);

  const confirmedOthers = existingBookings.filter((booking) => {
    assertValidWindow(booking);
    const isSelf = Boolean(candidate.id && booking.id && candidate.id === booking.id);
    return !isSelf && booking.status === 'confirmed';
  });

  const petBooked = candidate.petId !== undefined && confirmedOthers.some((booking) =>
    booking.petId === candidate.petId
    && overlaps(candidateStart, candidateEnd, asUtcDay(booking.startDate), asUtcDay(booking.endDate)));
  if (petBooked) {
    return 'pet_booked';
  }

  const sameListing = confirmedOthers
    .filter((booking) => booking.listingId === candidate.listingId)
    .map((booking) => ({ start: asUtcDay(booking.startDate), end: asUtcDay(booking.endDate) }))
    .filter((stay) => overlaps(candidateStart, candidateEnd, stay.start, stay.end));

  // Occupancy only rises when a stay arrives, so the peak within the window is reached on the
  // candidate's first night or on some other stay's arrival night inside the window.
  const arrivalNights = [candidateStart, ...sameListing.map((stay) => stay.start).filter((start) => start > candidateStart)];
  const peak = Math.max(0, ...arrivalNights.map((night) =>
    sameListing.filter((stay) => stay.start <= night && night < stay.end).length));

  return peak + 1 > capacity ? 'listing_full' : null;
}

/** True when confirming `candidate` would be refused; see getBookingConflict() for the rules. */
export function hasBookingConflict(
  candidate: BookingCandidate,
  existingBookings: readonly ExistingBooking[],
  options: BookingConflictOptions = {},
): boolean {
  return getBookingConflict(candidate, existingBookings, options) !== null;
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

/**
 * Pure completion check: a booking can be completed only when it is confirmed and its stay has finished.
 * - End-exclusive: the end date is check-out day, so completion is allowed on the end date itself.
 * - `today` is a `YYYY-MM-DD` calendar day. Callers pass the UTC day (`utcTodayIsoDate()`), the same
 *   day the database guard checks, so the UI never offers a completion the database refuses (ADR 0011).
 * - Actor authorization (listing owner only) is enforced separately.
 */
export function canCompleteBooking(
  booking: Pick<ExistingBooking, 'status' | 'endDate'>,
  today: string,
): boolean {
  return isValidBookingTransition(booking.status, 'completed') && asUtcDay(today) >= asUtcDay(booking.endDate);
}
