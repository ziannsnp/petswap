import { hasBookingConflict, isValidBookingTransition, assertValidWindow, asUtcDay } from './bookingRules';
import type { BookingStatus, ExistingBooking } from '../types';

describe('hasBookingConflict', () => {
  const confirmedListingA: ExistingBooking = {
    id: 'b-1',
    listingId: 'listing-a',
    startDate: '2026-09-10',
    endDate: '2026-09-14',
    status: 'confirmed',
  };

  describe('overlap on the same listing with confirmed status', () => {
    it('detects exact same date range overlap', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14' },
          [confirmedListingA],
        ),
      ).toBe(true);
    });

    it('detects overlap when candidate starts before and ends inside existing booking', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-08', endDate: '2026-09-12' },
          [confirmedListingA],
        ),
      ).toBe(true);
    });

    it('detects overlap when candidate starts inside and ends after existing booking', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-12', endDate: '2026-09-16' },
          [confirmedListingA],
        ),
      ).toBe(true);
    });

    it('detects overlap when candidate is completely inside existing booking window', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-11', endDate: '2026-09-13' },
          [confirmedListingA],
        ),
      ).toBe(true);
    });

    it('detects overlap when candidate completely encloses existing booking window', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-05', endDate: '2026-09-20' },
          [confirmedListingA],
        ),
      ).toBe(true);
    });
  });

  describe('end-exclusive date logic (back-to-back bookings)', () => {
    it('allows back-to-back booking where candidate starts on the exact day existing booking ends', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-14', endDate: '2026-09-18' },
          [confirmedListingA],
        ),
      ).toBe(false);
    });

    it('allows back-to-back booking where candidate ends on the exact day existing booking starts', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-06', endDate: '2026-09-10' },
          [confirmedListingA],
        ),
      ).toBe(false);
    });

    it('allows booking that fits cleanly between two adjacent confirmed bookings', () => {
      const earlierConfirmed: ExistingBooking = {
        listingId: 'listing-a',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        status: 'confirmed',
      };
      const laterConfirmed: ExistingBooking = {
        listingId: 'listing-a',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        status: 'confirmed',
      };

      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-05', endDate: '2026-09-10' },
          [earlierConfirmed, laterConfirmed],
        ),
      ).toBe(false);
    });
  });

  describe('different listing isolation', () => {
    it('allows overlapping dates if existing confirmed booking is on a different listing', () => {
      expect(
        hasBookingConflict(
          { listingId: 'listing-b', startDate: '2026-09-10', endDate: '2026-09-14' },
          [confirmedListingA],
        ),
      ).toBe(false);
    });
  });

  describe('ignoring non-confirmed statuses', () => {
    const nonConfirmedStatuses: BookingStatus[] = ['pending', 'declined', 'cancelled', 'completed'];

    test.each(nonConfirmedStatuses)(
      'does not conflict with %s bookings on the same listing with identical dates',
      (status) => {
        const nonConfirmedBooking: ExistingBooking = {
          listingId: 'listing-a',
          startDate: '2026-09-10',
          endDate: '2026-09-14',
          status,
        };

        expect(
          hasBookingConflict(
            { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14' },
            [nonConfirmedBooking],
          ),
        ).toBe(false);
      },
    );

    it('ignores multiple non-confirmed bookings while detecting a confirmed overlap in a mixed list', () => {
      const mixedBookings: ExistingBooking[] = [
        { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14', status: 'pending' },
        { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14', status: 'declined' },
        { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14', status: 'cancelled' },
        { listingId: 'listing-b', startDate: '2026-09-10', endDate: '2026-09-14', status: 'confirmed' },
        { listingId: 'listing-a', startDate: '2026-09-12', endDate: '2026-09-16', status: 'confirmed' },
      ];

      // Conflicts with the confirmed listing-a booking (2026-09-12 to 2026-09-16)
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-11', endDate: '2026-09-13' },
          mixedBookings,
        ),
      ).toBe(true);

      // Does not conflict when candidate only overlaps the pending/declined/cancelled dates
      expect(
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-08', endDate: '2026-09-11' },
          [
            { listingId: 'listing-a', startDate: '2026-09-08', endDate: '2026-09-11', status: 'pending' },
            { listingId: 'listing-a', startDate: '2026-09-08', endDate: '2026-09-11', status: 'cancelled' },
          ],
        ),
      ).toBe(false);
    });
  });

  describe('rechecking before confirmation & self-exclusion', () => {
    it('does not treat the candidate itself as a conflict when matching IDs are provided', () => {
      const candidate = {
        id: 'booking-123',
        listingId: 'listing-a',
        startDate: '2026-09-10',
        endDate: '2026-09-14',
      };
      const existingSelf: ExistingBooking = {
        id: 'booking-123',
        listingId: 'listing-a',
        startDate: '2026-09-10',
        endDate: '2026-09-14',
        status: 'confirmed',
      };

      expect(hasBookingConflict(candidate, [existingSelf])).toBe(false);
    });

    it('detects conflict when confirming a pending booking against an already confirmed distinct booking', () => {
      const candidateToConfirm = {
        id: 'booking-pending-1',
        listingId: 'listing-a',
        startDate: '2026-09-10',
        endDate: '2026-09-14',
      };
      const existingList: ExistingBooking[] = [
        {
          id: 'booking-pending-1',
          listingId: 'listing-a',
          startDate: '2026-09-10',
          endDate: '2026-09-14',
          status: 'pending',
        },
        {
          id: 'booking-confirmed-already',
          listingId: 'listing-a',
          startDate: '2026-09-12',
          endDate: '2026-09-15',
          status: 'confirmed',
        },
      ];

      expect(hasBookingConflict(candidateToConfirm, existingList)).toBe(true);
    });
  });

  describe('validation and error handling', () => {
    it('throws RangeError when candidate end date is on or before start date', () => {
      expect(() =>
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-14', endDate: '2026-09-14' },
          [],
        ),
      ).toThrow(RangeError);

      expect(() =>
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-15', endDate: '2026-09-14' },
          [],
        ),
      ).toThrow(RangeError);
    });

    it('throws RangeError when candidate date is invalid', () => {
      expect(() =>
        hasBookingConflict(
          { listingId: 'listing-a', startDate: 'not-a-date', endDate: '2026-09-14' },
          [],
        ),
      ).toThrow(RangeError);
    });

    it('throws RangeError when an existing booking window is invalid', () => {
      expect(() =>
        hasBookingConflict(
          { listingId: 'listing-a', startDate: '2026-09-10', endDate: '2026-09-14' },
          [{ listingId: 'listing-a', startDate: '2026-09-15', endDate: '2026-09-10', status: 'confirmed' }],
        ),
      ).toThrow(RangeError);
    });
  });
});

describe('assertValidWindow and asUtcDay helpers', () => {
  it('parses valid UTC date strings into numeric timestamps', () => {
    expect(asUtcDay('2026-09-10')).toBe(Date.parse('2026-09-10T00:00:00.000Z'));
  });

  it('throws for invalid date strings in asUtcDay', () => {
    expect(() => asUtcDay('invalid')).toThrow(RangeError);
  });

  it('validates proper date windows', () => {
    expect(() =>
      assertValidWindow({ listingId: 'l1', startDate: '2026-09-10', endDate: '2026-09-11' }),
    ).not.toThrow();
  });
});

describe('isValidBookingTransition', () => {
  it('allows valid transitions from pending', () => {
    expect(isValidBookingTransition('pending', 'confirmed')).toBe(true);
    expect(isValidBookingTransition('pending', 'declined')).toBe(true);
    expect(isValidBookingTransition('pending', 'cancelled')).toBe(true);
  });

  it('allows valid transitions from confirmed', () => {
    expect(isValidBookingTransition('confirmed', 'completed')).toBe(true);
    expect(isValidBookingTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('rejects invalid transitions from pending', () => {
    expect(isValidBookingTransition('pending', 'completed')).toBe(false);
    expect(isValidBookingTransition('pending', 'pending')).toBe(false);
  });

  it('rejects invalid transitions from confirmed', () => {
    expect(isValidBookingTransition('confirmed', 'declined')).toBe(false);
    expect(isValidBookingTransition('confirmed', 'confirmed')).toBe(false);
    expect(isValidBookingTransition('confirmed', 'pending')).toBe(false);
  });

  it('rejects terminal status transitions (declined, cancelled, completed)', () => {
    const terminalStatuses: BookingStatus[] = ['declined', 'cancelled', 'completed'];
    const allStatuses: BookingStatus[] = ['pending', 'confirmed', 'declined', 'cancelled', 'completed'];

    terminalStatuses.forEach((terminal) => {
      allStatuses.forEach((target) => {
        expect(isValidBookingTransition(terminal, target)).toBe(false);
      });
    });
  });
});
