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
