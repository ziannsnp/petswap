import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import {
  BookingCancellationError,
  BookingCompletionError,
  BookingConflictError,
  BookingExpiredError,
  BookingListingFullError,
  BookingNotFoundError,
  BookingPetUnavailableError,
  BookingStartDateError,
  BookingStatusChangedError,
  DuplicateBookingRequestError,
} from './bookingErrors';
import {
  createBookingRequest,
  getBookingDetail,
  listIncomingBookings,
  listOutgoingBookings,
  updateBookingStatus,
} from './bookingApi';

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
  builder.insert.mockReturnValue(builder);
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

  it('passes through an error it has no safe words for', async () => {
    const databaseError = { code: 'P0001', message: 'booking ownership, pet, listing, and dates are immutable after request' };
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

describe('booking rules enforced by guard_booking_change', () => {
  it('explains that a request past its start date can no longer be confirmed', async () => {
    const databaseError = { code: 'P0001', message: 'a request whose start date has passed cannot be confirmed' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'confirmed')).rejects.toBeInstanceOf(BookingExpiredError);
  });

  it.each(['confirmed', 'declined', 'cancelled'] as const)(
    'tells the user a booking changed underneath them when %s is refused as an invalid transition',
    async (status) => {
      const databaseError = { code: 'P0001', message: 'invalid booking status transition' };
      mockAuthenticatedClient('user-1', { data: null, error: databaseError });

      await expect(updateBookingStatus('booking-1', status)).rejects.toBeInstanceOf(BookingStatusChangedError);
    },
  );

  it('keeps the completion message when completing is refused, since that raise also means "not ended yet"', async () => {
    const databaseError = { code: 'P0001', message: 'invalid booking status transition' };
    mockAuthenticatedClient('owner-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'completed')).rejects.toBeInstanceOf(BookingCompletionError);
  });

  it('explains that a stay which has ended can no longer be cancelled', async () => {
    const databaseError = { code: 'P0001', message: 'a stay that has ended cannot be cancelled' };
    mockAuthenticatedClient('requester-1', { data: null, error: databaseError });

    await expect(updateBookingStatus('booking-1', 'cancelled')).rejects.toBeInstanceOf(BookingCancellationError);
  });

  it('explains a duplicate pending request instead of blaming the connection', async () => {
    const databaseError = { code: 'P0001', message: 'an identical booking request is already pending' };
    mockAuthenticatedClient('requester-1', { data: null, error: databaseError });

    await expect(
      createBookingRequest({
        listing_id: 'listing-1',
        pet_id: 'pet-1',
        requester_id: 'requester-1',
        start_date: '2026-12-01',
        end_date: '2026-12-03',
      }),
    ).rejects.toBeInstanceOf(DuplicateBookingRequestError);
  });
});

describe('getBookingDetail', () => {
  const DETAIL_ROW = {
    id: 'booking-1',
    status: 'confirmed',
    start_date: '2027-03-01',
    end_date: '2027-03-04',
    requester_note: 'Please keep him off the sofa.',
    owner_note: null,
    created_at: '2027-02-01T10:00:00.000Z',
    confirmed_at: '2027-02-02T10:00:00.000Z',
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    viewer_role: 'owner',
    listing_id: 'listing-1',
    listing_title: 'Detail garden',
    listing_location: 'Chiang Mai',
    listing_status: 'published',
    pet_id: 'pet-1',
    pet_name: 'Milo',
    pet_species: 'dog',
    pet_breed: 'Corgi',
    pet_age_year: 4,
    pet_photo_url: 'pet-1/photo.jpg',
    pet_description: null,
    pet_feeding_instruction: 'two meals a day',
    pet_medical_note: null,
    pet_behavior_note: null,
    pet_allergies: null,
    pet_vaccination_info: null,
    pet_special_requirement: null,
    pet_deleted: false,
    peer_id: 'requester-1',
    peer_display_name: 'Casey Ito',
    peer_photo_url: null,
    peer_location: 'Nonthaburi',
  };

  function mockRpc(result: QueryResult) {
    const rpc = jest.fn().mockResolvedValue(result);
    mockGetSupabaseClient.mockReturnValue({ rpc } as unknown as AppSupabaseClient);
    return rpc;
  }

  it('asks the database for one booking and maps the row', async () => {
    const rpc = mockRpc({ data: [DETAIL_ROW], error: null });

    const detail = await getBookingDetail('booking-1');

    expect(rpc).toHaveBeenCalledWith('get_booking_detail', { target_booking_id: 'booking-1' });
    expect(detail).toMatchObject({
      id: 'booking-1',
      status: 'confirmed',
      startDate: '2027-03-01',
      endDate: '2027-03-04',
      requesterNote: 'Please keep him off the sofa.',
      viewerRole: 'owner',
      listing: { id: 'listing-1', title: 'Detail garden', location: 'Chiang Mai', status: 'published' },
      peer: { id: 'requester-1', displayName: 'Casey Ito', photoUrl: null, location: 'Nonthaburi' },
    });
    expect(detail.pet).toMatchObject({ id: 'pet-1', name: 'Milo', species: 'dog', feeding_instruction: 'two meals a day', isDeleted: false });
  });

  it('never carries an email address or phone number', async () => {
    mockRpc({ data: [DETAIL_ROW], error: null });

    const detail = await getBookingDetail('booking-1');

    expect(Object.keys(detail.peer).sort()).toEqual(['displayName', 'id', 'location', 'photoUrl']);
    expect(JSON.stringify(detail)).not.toMatch(/phone|email/i);
  });

  it('maps a pet that is not shared with the viewer to null', async () => {
    mockRpc({
      data: [{ ...DETAIL_ROW, status: 'declined', pet_id: null, pet_name: null, pet_species: null, pet_deleted: null }],
      error: null,
    });

    const detail = await getBookingDetail('booking-1');

    expect(detail.pet).toBeNull();
  });

  it('marks a soft-deleted pet and keeps a draft listing', async () => {
    mockRpc({ data: [{ ...DETAIL_ROW, viewer_role: 'requester', pet_deleted: true, listing_status: 'draft' }], error: null });

    const detail = await getBookingDetail('booking-1');

    expect(detail.viewerRole).toBe('requester');
    expect(detail.pet?.isDeleted).toBe(true);
    expect(detail.listing.status).toBe('draft');
  });

  it('treats no row as not found, whether the booking is missing or belongs to someone else', async () => {
    mockRpc({ data: [], error: null });

    await expect(getBookingDetail('someone-elses-booking')).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it('rethrows a database error unchanged', async () => {
    const failure = { code: '42501', message: 'permission denied for function get_booking_detail' };
    mockRpc({ data: null, error: failure });

    await expect(getBookingDetail('booking-1')).rejects.toBe(failure);
  });
});
