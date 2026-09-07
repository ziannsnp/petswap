import { getSupabaseClient } from '../../../shared/lib/supabase';
import { createListing, listMyListings } from './listingApi';

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

describe('createListing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a published listing and stores its photos', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['Dog'],
      facilities: 'Fenced yard',
      status: 'published',
      deleted_at: null,
      published_at: '2026-09-07T00:00:00.000Z',
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const imageInsert = jest.fn().mockResolvedValue({ data: [], error: null });
    const upload = jest.fn().mockResolvedValue({ data: { path: 'listing-123/photo.jpg' }, error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert };
      if (table === 'listing_images') return { insert: imageInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: storageFrom },
    } as never);

    const photo = new File(['photo'], 'front-yard.jpg', { type: 'image/jpeg' });
    await expect(createListing({
      title: ' A quiet home ',
      location: ' Chiang Mai ',
      description: ' A calm place for pets. ',
      capacity: 2,
      acceptedPetTypes: ['Dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).resolves.toMatchObject({ id: 'listing-123', status: 'published' });

    expect(listingInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      facilities: 'Fenced yard',
      status: 'published',
    }));
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^listing-123\/[0-9a-f-]+\.jpg$/),
      photo,
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(imageInsert).toHaveBeenCalledWith([expect.objectContaining({
      listing_id: 'listing-123',
      alt_text: 'front-yard.jpg',
      sort_order: 0,
    })]);
  });

  it('removes the listing and uploaded photos when image metadata fails', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['Dog'],
      facilities: 'Fenced yard',
      status: 'published',
      deleted_at: null,
      published_at: '2026-09-07T00:00:00.000Z',
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const imageInsert = jest.fn().mockResolvedValue({ data: null, error: new Error('metadata failed') });
    const upload = jest.fn().mockResolvedValue({ data: { path: 'listing-123/photo.jpg' }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert, delete: listingDelete };
      if (table === 'listing_images') return { insert: imageInsert };
      throw new Error(`Unexpected table: ${table}`);
    });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: storageFrom },
    } as never);

    const photo = new File(['photo'], 'front-yard.jpg', { type: 'image/jpeg' });
    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['Dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).rejects.toThrow('metadata failed');

    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^listing-123\/[0-9a-f-]+\.jpg$/)]);
    expect(listingDelete).toHaveBeenCalled();
  });

  it('removes the listing when a photo upload fails', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['Dog'],
      facilities: 'Fenced yard',
      status: 'published',
      deleted_at: null,
      published_at: '2026-09-07T00:00:00.000Z',
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const upload = jest.fn().mockResolvedValue({ data: null, error: new Error('upload failed') });
    const storageFrom = jest.fn().mockReturnValue({ upload });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert, delete: listingDelete };
      if (table === 'listing_images') return { insert: jest.fn() };
      throw new Error(`Unexpected table: ${table}`);
    });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: storageFrom },
    } as never);

    const photo = new File(['photo'], 'front-yard.jpg', { type: 'image/jpeg' });
    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['Dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).rejects.toThrow('upload failed');

    expect(upload).toHaveBeenCalled();
    expect(listingDelete).toHaveBeenCalled();
  });
});
