import { getSupabaseClient } from '../../../shared/lib/supabase';
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
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(listMyListings()).resolves.toEqual([]);
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
});
