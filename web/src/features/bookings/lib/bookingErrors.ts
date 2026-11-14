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

export class BookingExpiredError extends Error {
  constructor() {
    super("This request's start date has passed, so it can no longer be confirmed. Decline it to close the request.");
    this.name = 'BookingExpiredError';
  }
}

export class BookingCancellationError extends Error {
  constructor() {
    super('This stay has already ended and can no longer be cancelled.');
    this.name = 'BookingCancellationError';
  }
}

export class DuplicateBookingRequestError extends Error {
  constructor() {
    super('You already have a pending request for this pet on these dates.');
    this.name = 'DuplicateBookingRequestError';
  }
}
