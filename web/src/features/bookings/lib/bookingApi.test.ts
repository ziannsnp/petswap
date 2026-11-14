import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import {
  BookingCompletionError,
  BookingConflictError,
  BookingListingFullError,
  BookingPetUnavailableError,
  BookingStartDateError,
} from './bookingErrors';
import { createBookingRequest, listIncomingBookings, listOutgoingBookings, updateBookingStatus } from './bookingApi';

// Explicit factory so the real module (and its Vite-only `import.meta.env` usage) never loads under Jest.
jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockGetSupabaseClient = getSupabaseClient as jest.Mock;

interface QueryResult {
  readonly data: unknown;
  readonly error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    single: jest.fn(),
  };
  builder.insert.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue(result);
  builder.update.mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

function mockAuthenticatedClient(userId: string, queryResult: QueryResult) {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null });
  const builder = createQueryBuilder(queryResult);
  const from = jest.fn().mockReturnValue(builder);

  mockGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as unknown as AppSupabaseClient);

  return { builder, from, getUser };
}

function mockUnauthenticatedClient() {
  const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null });
  mockGetSupabaseClient.mockReturnValue({ auth: { getUser }, from: jest.fn() } as unknown as AppSupabaseClient);
}

const BOOKING_FIELDS = {
  id: 'booking-1',
  listing_id: 'listing-1',
  pet_id: 'pet-1',
  status: 'pending' as const,
  start_date: '2026-09-10',
  end_date: '2026-09-14',
  requester_note: null,
  owner_note: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  confirmed_at: null,
  declined_at: null,
  cancelled_at: null,
  completed_at: null,
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('listOutgoingBookings', () => {
  it('queries bookings filtered by requester_id for the current user', async () => {
    const row = {
      ...BOOKING_FIELDS,
      requester_id: 'user-1',
      pet: { id: 'pet-1', name: 'Milo', species: 'dog', photo_url: null },
      listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' },
    };
    const { builder, from } = mockAuthenticatedClient('user-1', { data: [row], error: null });

    const result = await listOutgoingBookings();

    expect(from).toHaveBeenCalledWith('bookings');
    expect(builder.eq).toHaveBeenCalledWith('requester_id', 'user-1');
    expect(result).toEqual([row]);
  });

  it('throws when there is no authenticated user', async () => {
    mockUnauthenticatedClient();

    await expect(listOutgoingBookings()).rejects.toThrow('You must be signed in to view bookings.');
  });
});

describe('listIncomingBookings', () => {
  it('queries bookings via an inner join on listings.owner_id for the current user', async () => {
    const row = {
      ...BOOKING_FIELDS,
      requester_id: 'requester-1',
      pet: { id: 'pet-1', name: 'Milo', species: 'dog', photo_url: null },
      listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin', owner_id: 'owner-1' },
    };
    const { builder, from } = mockAuthenticatedClient('owner-1', { data: [row], error: null });

    const result = await listIncomingBookings();

    expect(from).toHaveBeenCalledWith('bookings');
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('listings!inner(id, title, location, owner_id)'));
    // The host reads the pet's care notes on the request (FR-2.2).
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining(
      'pet:pets(id, name, species, photo_url, feeding_instruction, medical_note, behavior_note, allergies, vaccination_info, special_requirement)',
    ));
    expect(builder.eq).toHaveBeenCalledWith('listing.owner_id', 'owner-1');
    // owner_id is join-filter-only and must not leak into the returned listing summary
    expect(result).toEqual([{ ...row, listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' } }]);
  });

  it('throws when there is no authenticated user', async () => {
    mockUnauthenticatedClient();

    await expect(listIncomingBookings()).rejects.toThrow('You must be signed in to view bookings.');
  });
});

describe('updateBookingStatus', () => {
  it('explains that confirmation failed because the listing is full (PBC01)', async () => {
    const databaseError = { code: 'PBC01', message: 'This listing has no remaining capacity for these dates.' };
    const { builder, from } = mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    const update = updateBookingStatus('booking-1', 'confirmed');

    await expect(update).rejects.toBeInstanceOf(BookingListingFullError);
    await expect(update).rejects.toMatchObject({ reason: 'listing_full' });
    await expect(update).rejects.toThrow(
      'This listing is full for some of these dates. Confirming this request would exceed its capacity on at least one night.',
    );

    expect(from).toHaveBeenCalledWith('bookings');
    expect(builder.update).toHaveBeenCalledWith({ status: 'confirmed' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'booking-1');
  });

  it('explains that confirmation failed because the pet is already booked (PBP01)', async () => {
    const databaseError = { code: 'PBP01', message: 'This pet already has a confirmed booking for these dates.' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    const update = updateBookingStatus('booking-1', 'confirmed');

    await expect(update).rejects.toBeInstanceOf(BookingPetUnavailableError);
    await expect(update).rejects.toMatchObject({ reason: 'pet_booked' });
  });

  it('maps the per-pet exclusion backstop to the pet error without passing on its DETAIL', async () => {
    const databaseError = {
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint "bookings_no_confirmed_pet_overlap"',
      details: 'Key (pet_id, daterange(start_date, end_date, \'[)\'::text))=(pet-1, [2026-12-01,2026-12-05)) conflicts with existing key',
    };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    const refusal: unknown = await updateBookingStatus('booking-1', 'confirmed').catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(BookingPetUnavailableError);
    expect(refusal).not.toHaveProperty('details');
    expect(refusal).not.toHaveProperty('cause');
    expect((refusal as Error).message).not.toContain('2026-12-01');
  });

  it('keeps both refusals catchable as BookingConflictError', async () => {
    mockAuthenticatedClient('owner-1', { data: null, error: { code: 'PBC01', message: 'full' } });
    await expect(updateBookingStatus('booking-1', 'confirmed')).rejects.toBeInstanceOf(BookingConflictError);
  });

  it.each(['PBC01', 'PBP01', '23P01'])('keeps %s errors unchanged when not confirming', async (code) => {
    const databaseError = { code, message: 'refused' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'declined')).rejects.toBe(databaseError);
  });
});

describe('updateBookingStatus status changes', () => {
  it.each(['confirmed', 'declined', 'cancelled', 'completed'] as const)(
    'sends only the new %s status for the chosen booking and returns the saved row',
    async (status) => {
      const saved = { ...BOOKING_FIELDS, requester_id: 'requester-1', status };
      const { builder, from } = mockAuthenticatedClient('user-1', { data: saved, error: null });

      await expect(updateBookingStatus('booking-1', status)).resolves.toEqual(saved);

      expect(from).toHaveBeenCalledWith('bookings');
      expect(builder.update).toHaveBeenCalledWith({ status });
      expect(builder.eq).toHaveBeenCalledWith('id', 'booking-1');
    },
  );

  it('passes through the error when the database refuses a cancellation', async () => {
    const databaseError = { code: 'P0001', message: 'invalid booking status transition' };
    mockAuthenticatedClient('stranger-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'cancelled')).rejects.toBe(databaseError);
  });

  it('passes through the error when RLS hides the booking from the caller', async () => {
    const notFound = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' };
    mockAuthenticatedClient('stranger-1', { data: null, error: notFound });

    await expect(updateBookingStatus('booking-1', 'confirmed')).rejects.toBe(notFound);
  });
});

describe('updateBookingStatus completion', () => {
  it('explains that completion was refused because the stay has not finished', async () => {
    const databaseError = { code: 'P0001', message: 'invalid booking status transition' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    const update = updateBookingStatus('booking-1', 'completed');

    await expect(update).rejects.toBeInstanceOf(BookingCompletionError);
    await expect(update).rejects.toThrow(
      'This booking can only be marked completed once it is confirmed and its end date has arrived.',
    );
  });

  it('keeps unrelated errors unchanged when completing', async () => {
    const databaseError = { code: '42501', message: 'permission denied' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'completed')).rejects.toBe(databaseError);
  });
});

describe('createBookingRequest', () => {
  const request = {
    listing_id: 'listing-1',
    pet_id: 'pet-1',
    requester_id: 'requester-1',
    start_date: '2026-09-13',
    end_date: '2026-09-15',
  };

  it('explains that the database UTC day has already passed the start date', async () => {
    mockAuthenticatedClient('requester-1', {
      data: null,
      error: { code: 'P0001', message: 'booking start date cannot be in the past' },
    });

    await expect(createBookingRequest(request)).rejects.toBeInstanceOf(BookingStartDateError);
  });

  it('keeps other insert errors unchanged', async () => {
    const databaseError = { code: 'P0001', message: 'booking pet must belong to requester' };
    mockAuthenticatedClient('requester-1', { data: null, error: databaseError });

    await expect(createBookingRequest(request)).rejects.toBe(databaseError);
  });
});
