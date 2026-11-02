export class BookingConflictError extends Error {
  constructor(readonly reason: 'capacity' | 'pet' = 'capacity') {
    super(reason === 'pet'
      ? 'This pet already has a confirmed booking for these dates. Choose different dates before confirming.'
      : 'This listing has no remaining capacity for these dates. Choose different dates before confirming.');
    this.name = 'BookingConflictError';
  }
}
