export class BookingConflictError extends Error {
  constructor() {
    super('This request overlaps another confirmed booking on this listing. Choose different dates before confirming.');
    this.name = 'BookingConflictError';
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
