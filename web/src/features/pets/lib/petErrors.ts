export class PetHasBookingsError extends Error {
  constructor() {
    super('Cannot delete a pet that has active bookings.');
    this.name = 'PetHasBookingsError';
  }
}
