import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import { listIncomingBookings, listOutgoingBookings } from './bookingApi';

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
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue(result);
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
    expect(builder.eq).toHaveBeenCalledWith('listing.owner_id', 'owner-1');
    // owner_id is join-filter-only and must not leak into the returned listing summary
    expect(result).toEqual([{ ...row, listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' } }]);
  });

  it('throws when there is no authenticated user', async () => {
    mockUnauthenticatedClient();

    await expect(listIncomingBookings()).rejects.toThrow('You must be signed in to view bookings.');
  });
});
