export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface BookingWindow {
  readonly id?: string;
  readonly listingId: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface ExistingBooking extends BookingWindow {
  readonly status: BookingStatus;
  /** The booked pet. A pet may not hold overlapping confirmed bookings on any listings (ADR 0011). */
  readonly petId?: string;
}

/** A candidate booking: the window plus, when known, the pet being booked. */
export interface BookingCandidate extends BookingWindow {
  readonly petId?: string;
}

/** Why a confirmation would be refused (ADR 0011), mirroring the database's PBC01 / PBP01. */
export type BookingConflictReason = 'listing_full' | 'pet_booked';

export interface BookingConflictOptions {
  /** The listing's capacity: confirmed pets it may hold on any one night. Defaults to 1. */
  readonly capacity?: number;
}
