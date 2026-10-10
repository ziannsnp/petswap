export class BookingConflictError extends Error {
  constructor() {
    super('This request overlaps another confirmed booking on this listing. Choose different dates before confirming.');
    this.name = 'BookingConflictError';
  }
}
