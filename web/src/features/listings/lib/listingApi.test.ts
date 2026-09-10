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

  it('does not start listing creation when authentication returns an error', async () => {
    const authError = new Error('auth failed');
    const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: authError });
    const from = jest.fn();
    const storageFrom = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from, storage: { from: storageFrom } } as never);

    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: [],
      photos: [],
    })).rejects.toThrow('auth failed');

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('does not start listing creation without an authenticated user', async () => {
    const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null });
    const from = jest.fn();
    const storageFrom = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from, storage: { from: storageFrom } } as never);

    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: [],
      photos: [],
    })).rejects.toThrow('You must be signed in');

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('creates a draft listing and stores its photos', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: 'Fenced yard',
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const insertedImage = {
      id: 'image-123',
      listing_id: 'listing-123',
      storage_path: 'listing-123/photo.jpg',
      alt_text: null,
      sort_order: 0,
      created_at: '2026-09-07T00:00:00.000Z',
    };
    const imageInsertSelect = jest.fn().mockResolvedValue({ data: [insertedImage], error: null });
    const imageInsert = jest.fn().mockReturnValue({ select: imageInsertSelect });
    const upload = jest.fn().mockResolvedValue({ data: { path: 'listing-123/photo.jpg' }, error: null });
    const storageFrom = jest.fn().mockReturnValue({
      upload,
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.test/photo.jpg' } }),
    });
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
      acceptedPetTypes: ['dog'],
      facilities: ['  ', 'Fenced yard', ' Daily photo updates '],
      photos: [photo],
    })).resolves.toMatchObject({
      id: 'listing-123',
      status: 'draft',
      listing_images: [insertedImage],
      cover_photo_url: 'https://example.test/photo.jpg',
    });

    expect(listingInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      accepted_pet_types: ['dog'],
      facilities: 'Fenced yard\nDaily photo updates',
      status: 'draft',
    }));
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^listing-123\/[0-9a-f-]+\.jpg$/),
      photo,
      { contentType: 'image/jpeg', upsert: false },
    );
    expect(imageInsert).toHaveBeenCalledWith([expect.objectContaining({
      listing_id: 'listing-123',
      alt_text: null,
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
      accepted_pet_types: ['dog'],
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
    const imageInsertSelect = jest.fn().mockResolvedValue({ data: null, error: new Error('metadata failed') });
    const imageInsert = jest.fn().mockReturnValue({ select: imageInsertSelect });
    const upload = jest.fn().mockResolvedValue({ data: { path: 'listing-123/photo.jpg' }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });
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
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).rejects.toThrow('metadata failed');

    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^listing-123\/[0-9a-f-]+\.jpg$/)]);
  });

  it('removes the listing when a photo upload fails', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
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
    const upload = jest.fn().mockResolvedValue({ data: null, error: new Error('upload failed') });
    const storageFrom = jest.fn().mockReturnValue({ upload });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert };
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
      acceptedPetTypes: ['dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).rejects.toThrow('upload failed');

    expect(upload).toHaveBeenCalled();
  });

  it('removes only previously uploaded photos when a later photo upload fails', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: 'Fenced yard',
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const imageInsert = jest.fn();
    const upload = jest.fn()
      .mockResolvedValueOnce({ data: { path: 'listing-123/first.jpg' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('second upload failed') });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });
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

    const firstPhoto = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const secondPhoto = new File(['second'], 'second.jpg', { type: 'image/jpeg' });
    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: ['Fenced yard'],
      photos: [firstPhoto, secondPhoto],
    })).rejects.toThrow('second upload failed');

    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(remove.mock.calls[0][0]).not.toContain(upload.mock.calls[1]?.[0]);
    expect(imageInsert).not.toHaveBeenCalled();
    expect(listingInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
  });

  it('reports a photo cleanup failure while leaving the listing as a draft', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: 'Fenced yard',
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const imageInsertSelect = jest.fn().mockResolvedValue({ data: null, error: new Error('metadata failed') });
    const imageInsert = jest.fn().mockReturnValue({ select: imageInsertSelect });
    const upload = jest.fn().mockResolvedValue({ data: { path: 'listing-123/photo.jpg' }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: null, error: new Error('cleanup failed') });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });
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
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: ['Fenced yard'],
      photos: [photo],
    })).rejects.toThrow('photo cleanup failed: cleanup failed');

    expect(remove).toHaveBeenCalled();
  });
});
