import { getSupabaseClient } from '../../../shared/lib/supabase';
import { createListing, getListing, listMyListings, setListingPublicationStatus, updateListing } from './listingApi';
import type { UpdateListingValues } from './listingApi';

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

describe('getListing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a private signed URL for the listing photo', async () => {
    const image = {
      id: 'image-1',
      listing_id: 'listing-1',
      storage_path: 'listing-1/front.jpg',
      alt_text: null,
      sort_order: 0,
      created_at: '2026-09-07T00:00:00.000Z',
    };
    const listing = {
      id: 'listing-1',
      owner_id: 'owner-1',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: 'Enclosed fence',
      status: 'published',
      deleted_at: null,
      published_at: '2026-09-07T00:00:00.000Z',
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
      listing_images: [image],
    };
    const listingMaybeSingle = jest.fn().mockResolvedValue({ data: listing, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle: listingMaybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [{ path: image.storage_path, signedUrl: 'https://example.test/private-front.jpg' }],
      error: null,
    });
    mockedGetSupabaseClient.mockReturnValue({
      from,
      storage: { from: jest.fn().mockReturnValue({ createSignedUrls }) },
    } as never);

    await expect(getListing('listing-1')).resolves.toMatchObject({
      id: 'listing-1',
      cover_photo_url: 'https://example.test/private-front.jpg',
      listing_images: [{ signed_url: 'https://example.test/private-front.jpg' }],
    });
  });
});

describe('setListingPublicationStatus', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('unpublishes a listing by writing the draft status', async () => {
    const listing = {
      id: 'listing-1',
      owner_id: 'owner-1',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: null,
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
      listing_images: [],
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(setListingPublicationStatus('listing-1', 'draft')).resolves.toMatchObject({
      id: 'listing-1',
      status: 'draft',
    });

    expect(from).toHaveBeenCalledWith('listings');
    expect(update).toHaveBeenCalledWith({ status: 'draft' });
    expect(eq).toHaveBeenCalledWith('id', 'listing-1');
  });

  it('surfaces the database error when the update is rejected', async () => {
    const updateError = new Error('permission denied');
    const single = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(setListingPublicationStatus('listing-1', 'published')).rejects.toThrow('permission denied');
  });
});

describe('createListing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects more than ten photos before accessing Supabase', async () => {
    const photos = Array.from(
      { length: 11 },
      (_, index) => new File(['photo'], `photo-${index}.jpg`, { type: 'image/jpeg' }),
    );

    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: [],
      photos,
      publicationMode: 'published',
    })).rejects.toThrow('A listing can have at most 10 photos.');

    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
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
      publicationMode: 'published',
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
      publicationMode: 'published',
    })).rejects.toThrow('You must be signed in');

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('publishes a listing only after storing its photos', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: 'Enclosed fence',
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingSelect = jest.fn().mockReturnValue({ single });
    const listingInsert = jest.fn().mockReturnValue({ select: listingSelect });
    const publishedListing = {
      ...listing,
      status: 'published',
      published_at: '2026-09-07T00:00:01.000Z',
    };
    const publicationSingle = jest.fn().mockResolvedValue({ data: publishedListing, error: null });
    const publicationSelect = jest.fn().mockReturnValue({ single: publicationSingle });
    const publicationEq = jest.fn().mockReturnValue({ select: publicationSelect });
    const listingUpdate = jest.fn().mockReturnValue({ eq: publicationEq });
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
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [{ path: insertedImage.storage_path, signedUrl: 'https://example.test/private-photo.jpg' }],
      error: null,
    });
    const storageFrom = jest.fn().mockReturnValue({
      upload,
      createSignedUrls,
    });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert, update: listingUpdate };
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
      facilities: ['Enclosed fence', 'Daily photo updates'],
      photos: [photo],
      publicationMode: 'published',
    })).resolves.toMatchObject({
      id: 'listing-123',
      status: 'published',
      published_at: '2026-09-07T00:00:01.000Z',
      listing_images: [insertedImage],
      cover_photo_url: 'https://example.test/private-photo.jpg',
    });

    expect(listingInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      accepted_pet_types: ['dog'],
      facilities: 'Enclosed fence\nDaily photo updates',
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
    expect(listingUpdate).toHaveBeenCalledWith({ status: 'published' });
    expect(publicationEq).toHaveBeenCalledWith('id', 'listing-123');
    expect(createSignedUrls).toHaveBeenCalledWith([insertedImage.storage_path], 3_600);
  });

  it('keeps a saved draft private instead of publishing it', async () => {
    const listing = {
      id: 'listing-draft',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: null,
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single }),
    });
    const listingUpdate = jest.fn();
    const from = jest.fn().mockReturnValue({ insert: listingInsert, update: listingUpdate });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });
    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: jest.fn() },
    } as never);

    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: [],
      photos: [],
      publicationMode: 'draft',
    })).resolves.toMatchObject({ id: 'listing-draft', status: 'draft' });

    expect(listingUpdate).not.toHaveBeenCalled();
  });

  it('removes the draft when publication fails', async () => {
    const listing = {
      id: 'listing-123',
      owner_id: 'owner-123',
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: null,
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
    };
    const single = jest.fn().mockResolvedValue({ data: listing, error: null });
    const listingInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single }),
    });
    const publicationSingle = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('publication failed'),
    });
    const listingUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single: publicationSingle }),
      }),
    });
    const listingDeleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
    const listingDelete = jest.fn().mockReturnValue({ eq: listingDeleteEq });
    const from = jest.fn((table: string) => {
      if (table === 'listings') {
        return { insert: listingInsert, update: listingUpdate, delete: listingDelete };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'owner-123' } },
      error: null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: jest.fn() },
    } as never);

    await expect(createListing({
      title: 'A quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: [],
      photos: [],
      publicationMode: 'published',
    })).rejects.toThrow('publication failed');

    expect(listingUpdate).toHaveBeenCalledWith({ status: 'published' });
    expect(listingDelete).toHaveBeenCalled();
    expect(listingDeleteEq).toHaveBeenCalledWith('id', 'listing-123');
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
      facilities: 'Enclosed fence',
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
    const listingDeleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
    const from = jest.fn((table: string) => {
      if (table === 'listings') return { insert: listingInsert, delete: jest.fn().mockReturnValue({ eq: listingDeleteEq }) };
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
      facilities: ['Enclosed fence'],
      photos: [photo],
      publicationMode: 'published',
    })).rejects.toThrow('metadata failed');

    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^listing-123\/[0-9a-f-]+\.jpg$/)]);
    expect(listingDeleteEq).toHaveBeenCalledWith('id', 'listing-123');
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
      facilities: 'Enclosed fence',
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
    const listingDeleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
    const listingDelete = jest.fn().mockReturnValue({ eq: listingDeleteEq });
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
      acceptedPetTypes: ['dog'],
      facilities: ['Enclosed fence'],
      photos: [photo],
      publicationMode: 'published',
    })).rejects.toThrow('upload failed');

    expect(upload).toHaveBeenCalled();
    expect(listingDelete).toHaveBeenCalled();
    expect(listingDeleteEq).toHaveBeenCalledWith('id', 'listing-123');
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
      facilities: 'Enclosed fence',
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
      facilities: ['Enclosed fence'],
      photos: [firstPhoto, secondPhoto],
      publicationMode: 'published',
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
      facilities: 'Enclosed fence',
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
      facilities: ['Enclosed fence'],
      photos: [photo],
      publicationMode: 'published',
    })).rejects.toThrow('photo cleanup failed: cleanup failed');

    expect(remove).toHaveBeenCalled();
  });
});

describe('updateListing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const values: UpdateListingValues = {
    title: 'Updated home',
    location: 'Chiang Mai',
    description: 'A calm place for pets.',
    capacity: 2,
    acceptedPetTypes: ['dog'],
    facilities: [],
    photos: [],
    publicationMode: 'published' as const,
  };

  it('does not access a listing when the caller is signed out', async () => {
    const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null });
    const from = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    await expect(updateListing('listing-1', values)).rejects.toThrow('You must be signed in');
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects an unsupported new photo before accessing Supabase', async () => {
    const photo = new File(['not an image'], 'notes.pdf', { type: 'application/pdf' });

    await expect(updateListing('listing-1', { ...values, photos: [{ kind: 'new', file: photo }] }))
      .rejects.toThrow('Unsupported file type');
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('commits listing fields and the complete photo order through the owner RPC', async () => {
    const listing = {
      id: 'listing-1',
      owner_id: 'owner-123',
      title: 'Old home',
      location: 'Chiang Mai',
      description: 'Old description.',
      capacity: 1,
      accepted_pet_types: ['dog'],
      facilities: null,
      status: 'draft',
      deleted_at: null,
      published_at: null,
      created_at: '2026-09-07T00:00:00.000Z',
      updated_at: '2026-09-07T00:00:00.000Z',
      listing_images: [],
    };
    const savedListing = { ...listing, title: values.title, status: 'published', listing_images: [] };
    const maybeSingle = jest.fn().mockResolvedValue({ data: listing, error: null });
    const single = jest.fn().mockResolvedValue({ data: savedListing, error: null });
    let selectCalls = 0;
    const select = jest.fn(() => {
      selectCalls += 1;
      const eq = jest.fn().mockReturnValue(selectCalls === 1 ? { maybeSingle } : { single });
      return { eq };
    });
    const from = jest.fn().mockReturnValue({ select });
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'owner-123' } }, error: null });
    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from, rpc } as never);

    await expect(updateListing('listing-1', values)).resolves.toMatchObject({
      id: 'listing-1',
      title: 'Updated home',
    });
    expect(rpc).toHaveBeenCalledWith('update_listing_with_images', expect.objectContaining({
      target_listing_id: 'listing-1',
      new_title: 'Updated home',
      retained_image_ids: [],
      ordered_image_ids: [],
      new_images: [],
    }));
  });

  it('preserves mixed existing and new photo order in the owner RPC payload', async () => {
    const existingImage = {
      id: 'img-existing',
      listing_id: 'listing-1',
      storage_path: 'listing-1/existing.jpg',
      alt_text: null,
      sort_order: 0,
      created_at: '2026-09-07T00:00:00.000Z',
    };
    const listing = {
      id: 'listing-1', owner_id: 'owner-123', title: 'Old home', location: 'Chiang Mai',
      description: 'Old description.', capacity: 1, accepted_pet_types: ['dog'], facilities: null,
      status: 'draft', deleted_at: null, published_at: null,
      created_at: '2026-09-07T00:00:00.000Z', updated_at: '2026-09-07T00:00:00.000Z',
      listing_images: [existingImage],
    };
    const savedListing = { ...listing, listing_images: [existingImage] };
    const maybeSingle = jest.fn().mockResolvedValue({ data: listing, error: null });
    const reloadSingle = jest.fn().mockResolvedValue({ data: savedListing, error: null });
    const select = jest.fn()
      .mockReturnValueOnce({ eq: jest.fn().mockReturnValue({ maybeSingle }) })
      .mockReturnValueOnce({ eq: jest.fn().mockReturnValue({ single: reloadSingle }) });
    const upload = jest.fn().mockResolvedValue({ error: null });
    const storageFrom = jest.fn().mockReturnValue({
      upload,
      createSignedUrls: jest.fn().mockResolvedValue({
        data: [{ path: existingImage.storage_path, signedUrl: 'https://example.test/existing.jpg' }],
        error: null,
      }),
    });
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ select });
    const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'owner-123' } }, error: null });
    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from, rpc, storage: { from: storageFrom } } as never);

    const newPhoto = new File(['photo'], 'new.jpg', { type: 'image/jpeg' });
    await updateListing('listing-1', {
      ...values,
      photos: [{ kind: 'new', file: newPhoto }, { kind: 'existing', id: 'img-existing' }],
    });

    const rpcPayload = rpc.mock.calls[0][1];
    expect(rpcPayload.ordered_image_ids).toHaveLength(2);
    expect(rpcPayload.ordered_image_ids).toEqual([
      rpcPayload.new_images[0].id,
      'img-existing',
    ]);
  });

  it('rejects a listing owned by another user before uploading or updating', async () => {
    const listing = {
      id: 'listing-1',
      owner_id: 'owner-1',
      listing_images: [],
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: listing, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'different-owner' } }, error: null });
    const storageFrom = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: storageFrom },
    } as never);

    await expect(updateListing('listing-1', values)).rejects.toThrow('only edit your own listings');
    expect(storageFrom).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });
});
