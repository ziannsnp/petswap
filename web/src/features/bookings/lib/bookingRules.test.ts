import {
  getBookingConflict,
  hasBookingConflict,
  isValidBookingTransition,
  assertValidWindow,
  asUtcDay,
  canCompleteBooking,
} from './bookingRules';
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

describe('capacity as peak nightly occupancy (ADR 0011)', () => {
  // Day n of a fixed month, so [1,3) reads as nights 1 and 2.
  const day = (n: number) => `2026-12-${String(n).padStart(2, '0')}`;
  const stay = (id: string, petId: string, start: number, end: number, status: BookingStatus = 'confirmed'): ExistingBooking => ({
    id, petId, listingId: 'listing-a', startDate: day(start), endDate: day(end), status,
  });
  const candidate = (id: string, petId: string, start: number, end: number) => ({
    id, petId, listingId: 'listing-a', startDate: day(start), endDate: day(end),
  });

  it('accepts A [1,3), B [3,5) and C [1,5) on a capacity-2 listing, confirmed in any order', () => {
    const a = stay('A', 'pet-a', 1, 3);
    const b = stay('B', 'pet-b', 3, 5);
    const c = stay('C', 'pet-c', 1, 5);
    const orders = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

    for (const order of orders) {
      const confirmed: ExistingBooking[] = [];
      for (const next of order) {
        const { id, petId, listingId, startDate, endDate } = next;
        expect(getBookingConflict({ id, petId, listingId, startDate, endDate }, confirmed, { capacity: 2 })).toBeNull();
        confirmed.push(next);
      }
    }
  });

  it('refuses a third pet on any single night, even when it overlaps only two stays that never meet', () => {
    const confirmed = [stay('A', 'pet-a', 1, 3), stay('B', 'pet-b', 3, 5), stay('C', 'pet-c', 1, 5)];

    // D [2,4) covers night 2 (A, C) and night 3 (B, C): each already holds two pets.
    expect(getBookingConflict(candidate('D', 'pet-d', 2, 4), confirmed, { capacity: 2 })).toBe('listing_full');
    // With capacity 3 every night has room again.
    expect(getBookingConflict(candidate('D', 'pet-d', 2, 4), confirmed, { capacity: 3 })).toBeNull();
  });

  it('counts occupancy per night rather than overlapping stays', () => {
    // Three stays overlap the candidate [1,7), but never more than one on the same night.
    const confirmed = [stay('A', 'pet-a', 1, 3), stay('B', 'pet-b', 3, 5), stay('C', 'pet-c', 5, 7)];

    expect(getBookingConflict(candidate('D', 'pet-d', 1, 7), confirmed, { capacity: 2 })).toBeNull();
    expect(getBookingConflict(candidate('D', 'pet-d', 1, 7), confirmed, { capacity: 1 })).toBe('listing_full');
  });

  it('finds a peak that starts after the candidate\'s first night', () => {
    const confirmed = [stay('A', 'pet-a', 4, 6), stay('B', 'pet-b', 5, 8)];

    // Night 1 is empty; night 5 holds A and B.
    expect(getBookingConflict(candidate('D', 'pet-d', 1, 6), confirmed, { capacity: 2 })).toBe('listing_full');
    // Ending before night 5 avoids the peak.
    expect(getBookingConflict(candidate('D', 'pet-d', 1, 5), confirmed, { capacity: 2 })).toBeNull();
  });

  it('lets back-to-back stays share a capacity-1 listing', () => {
    const confirmed = [stay('A', 'pet-a', 1, 3)];

    expect(getBookingConflict(candidate('B', 'pet-b', 3, 5), confirmed)).toBeNull();
    expect(getBookingConflict(candidate('B', 'pet-b', 2, 4), confirmed)).toBe('listing_full');
  });

  it.each(['pending', 'declined', 'cancelled', 'completed'] as const)(
    'never counts a %s stay toward occupancy',
    (status) => {
      const others = [stay('A', 'pet-a', 1, 5, status), stay('B', 'pet-b', 1, 5, status)];

      expect(getBookingConflict(candidate('C', 'pet-c', 1, 5), others)).toBeNull();
    },
  );

  it('releases a place when a confirmed stay is cancelled', () => {
    const before = [stay('A', 'pet-a', 1, 5), stay('B', 'pet-b', 1, 5)];
    const after = [stay('A', 'pet-a', 1, 5, 'cancelled'), stay('B', 'pet-b', 1, 5)];

    expect(getBookingConflict(candidate('C', 'pet-c', 2, 3), before, { capacity: 2 })).toBe('listing_full');
    expect(getBookingConflict(candidate('C', 'pet-c', 2, 3), after, { capacity: 2 })).toBeNull();
  });

  it('ignores stays on other listings when counting occupancy', () => {
    const elsewhere: ExistingBooking = { ...stay('A', 'pet-a', 1, 5), listingId: 'listing-b' };

    expect(getBookingConflict(candidate('B', 'pet-b', 1, 5), [elsewhere])).toBeNull();
  });

  it('does not count the candidate against itself', () => {
    expect(getBookingConflict(candidate('A', 'pet-a', 1, 5), [stay('A', 'pet-a', 1, 5)])).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects an invalid capacity of %p', (capacity) => {
    expect(() => getBookingConflict(candidate('A', 'pet-a', 1, 2), [], { capacity })).toThrow(RangeError);
  });

  it('agrees with hasBookingConflict()', () => {
    const confirmed = [stay('A', 'pet-a', 1, 3)];

    expect(hasBookingConflict(candidate('B', 'pet-b', 2, 4), confirmed)).toBe(true);
    expect(hasBookingConflict(candidate('B', 'pet-b', 2, 4), confirmed, { capacity: 2 })).toBe(false);
  });
});

describe('pet overlap across listings (ADR 0011)', () => {
  const confirmedElsewhere: ExistingBooking = {
    id: 'other-host-stay',
    petId: 'pet-1',
    listingId: 'listing-b',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    status: 'confirmed',
  };

  it('refuses a pet already confirmed on another listing for overlapping dates, whatever the capacity', () => {
    expect(getBookingConflict(
      { id: 'here', petId: 'pet-1', listingId: 'listing-a', startDate: '2026-12-04', endDate: '2026-12-08' },
      [confirmedElsewhere],
      { capacity: 10 },
    )).toBe('pet_booked');
  });

  it('reports the pet before the listing when both would refuse, like the database', () => {
    const fullHere: ExistingBooking = {
      id: 'full', petId: 'pet-9', listingId: 'listing-a', startDate: '2026-12-01', endDate: '2026-12-10', status: 'confirmed',
    };

    expect(getBookingConflict(
      { id: 'here', petId: 'pet-1', listingId: 'listing-a', startDate: '2026-12-02', endDate: '2026-12-04' },
      [confirmedElsewhere, fullHere],
    )).toBe('pet_booked');
  });

  it('allows the pet to start a stay on the day its other stay ends', () => {
    expect(getBookingConflict(
      { id: 'here', petId: 'pet-1', listingId: 'listing-a', startDate: '2026-12-05', endDate: '2026-12-08' },
      [confirmedElsewhere],
    )).toBeNull();
  });

  it('allows a different pet on the same dates', () => {
    expect(getBookingConflict(
      { id: 'here', petId: 'pet-2', listingId: 'listing-a', startDate: '2026-12-01', endDate: '2026-12-05' },
      [confirmedElsewhere],
    )).toBeNull();
  });

  it.each(['pending', 'declined', 'cancelled', 'completed'] as const)(
    'ignores the pet\'s %s stays elsewhere',
    (status) => {
      expect(getBookingConflict(
        { id: 'here', petId: 'pet-1', listingId: 'listing-a', startDate: '2026-12-02', endDate: '2026-12-04' },
        [{ ...confirmedElsewhere, status }],
      )).toBeNull();
    },
  );

  it('skips the pet check when the candidate pet is unknown', () => {
    expect(getBookingConflict(
      { id: 'here', listingId: 'listing-a', startDate: '2026-12-02', endDate: '2026-12-04' },
      [confirmedElsewhere],
    )).toBeNull();
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

describe('isValidBookingTransition actor-specific paths', () => {
  it.each(['confirmed', 'declined'] as const)('lets a listing owner respond to a pending request with %s', (to) => {
    expect(isValidBookingTransition('pending', to)).toBe(true);
  });

  it.each(['pending', 'confirmed'] as const)('lets a requester cancel a %s booking', (from) => {
    expect(isValidBookingTransition(from, 'cancelled')).toBe(true);
  });

  it.each(['declined', 'cancelled', 'completed'] as const)('does not allow cancelling a %s booking', (from) => {
    expect(isValidBookingTransition(from, 'cancelled')).toBe(false);
  });

  it.each(['pending', 'declined', 'cancelled', 'completed'] as const)(
    'only confirmed bookings can be completed, not %s ones',
    (from) => {
      expect(isValidBookingTransition(from, 'completed')).toBe(false);
    },
  );
});

describe('canCompleteBooking', () => {
  const endDate = '2026-10-10';

  it('allows completing a confirmed booking after its end date', () => {
    expect(canCompleteBooking({ status: 'confirmed', endDate }, '2026-10-12')).toBe(true);
  });

  it('allows completing a confirmed booking on its end date (check-out day)', () => {
    expect(canCompleteBooking({ status: 'confirmed', endDate }, '2026-10-10')).toBe(true);
  });

  it('blocks completing a confirmed booking before its end date', () => {
    expect(canCompleteBooking({ status: 'confirmed', endDate }, '2026-10-09')).toBe(false);
  });

  it('blocks completing a confirmed booking that has not started yet', () => {
    expect(canCompleteBooking({ status: 'confirmed', endDate }, '2026-09-01')).toBe(false);
  });

  it.each(['pending', 'declined', 'cancelled', 'completed'] as const)(
    'blocks completing a %s booking even after its end date',
    (status) => {
      expect(canCompleteBooking({ status, endDate }, '2026-10-12')).toBe(false);
    },
  );

  it('throws RangeError for an invalid date instead of guessing', () => {
    expect(() => canCompleteBooking({ status: 'confirmed', endDate }, 'not-a-date')).toThrow(RangeError);
  });
});
