import { getSupabaseClient } from '../../../shared/lib/supabase';
import { makeListingRow } from '../testing/listingFixtures';
import { listMyListings } from './listingApi';

jest.mock('../../../shared/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = jest.mocked(getSupabaseClient);

describe('listMyListings', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('filters listings by the authenticated owner', async () => {
    const listing = makeListingRow({ owner_id: 'owner-123' });
    const order = jest.fn().mockResolvedValue({ data: [listing], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(listMyListings()).resolves.toEqual([
      { ...listing, cover_photo_url: null },
    ]);
    expect(getUser).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('listings');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-123');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns no listings when there is no authenticated user', async () => {
    const from = jest.fn();
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(listMyListings()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a failed owner-scoped query', async () => {
    const queryError = new Error('query failed');
    const order = jest.fn().mockResolvedValue({ data: null, error: queryError });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(listMyListings()).rejects.toBe(queryError);
  });

  it('surfaces an authentication lookup failure', async () => {
    const authError = new Error('auth failed');
    const from = jest.fn();
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: authError,
    });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(listMyListings()).rejects.toBe(authError);
    expect(from).not.toHaveBeenCalled();
  });
});
