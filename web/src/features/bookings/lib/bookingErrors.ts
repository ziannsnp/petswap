import type { BookingConflictReason } from '../types';

/**
 * The database refused a confirmation (ADR 0011). Use the subclass to tell the two reasons apart;
 * neither message names the other booking, its dates, its listing, or its requester.
 */
export class BookingConflictError extends Error {
  constructor(
    public readonly reason: BookingConflictReason,
    message: string,
  ) {
    super(message);
    this.name = 'BookingConflictError';
  }
}

/** PBC01: confirming would put more pets on some night than the listing's capacity. */
export class BookingListingFullError extends BookingConflictError {
  constructor() {
    super('listing_full', 'This listing is full for some of these dates. Confirming this request would exceed its capacity on at least one night.');
    this.name = 'BookingListingFullError';
  }
}

/** PBP01: the pet already has a confirmed stay, at any listing, overlapping these dates. */
export class BookingPetUnavailableError extends BookingConflictError {
  constructor() {
    super('pet_booked', 'This pet already has a confirmed booking for some of these dates, so this request can no longer be confirmed.');
    this.name = 'BookingPetUnavailableError';
  }
}

export class BookingCompletionError extends Error {
  constructor() {
    super('This booking can only be marked completed once it is confirmed and its end date has arrived.');
    this.name = 'BookingCompletionError';
  }
}

/** The database's UTC day has already passed the requested start day (ADR 0011). */
export class BookingStartDateError extends Error {
  constructor() {
    super('That start date has already passed for bookings (the booking day changes at midnight UTC). Choose a later start date.');
    this.name = 'BookingStartDateError';
  }
}
