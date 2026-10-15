export class PetHasBookingsError extends Error {
  constructor() {
    super('Cannot delete a pet that has existing bookings.');
    this.name = 'PetHasBookingsError';
  }
}
