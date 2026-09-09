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
    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyListings('owner-123')).resolves.toEqual([
      { ...listing, cover_photo_url: null },
    ]);
    expect(from).toHaveBeenCalledWith('listings');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-123');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('surfaces a failed owner-scoped query', async () => {
    const queryError = new Error('query failed');
    const order = jest.fn().mockResolvedValue({ data: null, error: queryError });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyListings('owner-123')).rejects.toBe(queryError);
  });
});
