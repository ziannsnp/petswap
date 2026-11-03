export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface BookingWindow {
  readonly id?: string;
  readonly listingId: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface ExistingBooking extends BookingWindow {
  readonly status: BookingStatus;
}
