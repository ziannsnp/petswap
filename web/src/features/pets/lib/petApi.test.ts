import { getSupabaseClient } from '@/shared/lib/supabase';
import {
  PET_PHOTO_BUCKET,
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_SIGNED_URL_TTL_SECONDS,
  createPet,
  deletePet,
  getPet,
  getPetPhotoSignedUrl,
  listMyPets,
  petPhotoStoragePath,
  updatePet,
  validatePetPhoto,
  type UpdatePetValues,
} from './petApi';

jest.mock('@/shared/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetSupabaseClient = jest.mocked(getSupabaseClient);

function signedIn(userId: string | null) {
  return jest.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null });
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('validatePetPhoto', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])('accepts valid MIME type %s', (type) => {
    expect(validatePetPhoto({ type, size: 1024 })).toBeNull();
  });

  it.each(['image/svg+xml', 'application/pdf', 'application/octet-stream', ''])('rejects unsupported MIME type %p', (type) => {
    expect(validatePetPhoto({ type, size: 1024 })).toMatch(/unsupported file type/i);
  });

  it('accepts photos up to the 10 MB limit and rejects photos exceeding it', () => {
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES + 1 })).toMatch(/10 MB limit/);
  });
});

describe('petPhotoStoragePath', () => {
  it('derives the extension from MIME type when known', () => {
    const file = new File(['binary'], 'Rocket_PHOTO.weird', { type: 'image/jpeg' });
    const path = petPhotoStoragePath('20000000-0000-4000-8000-000000000001', file);

    expect(path).toMatch(/^20000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.jpg$/);
  });

  it('handles user filenames with trailing dots by relying on MIME type', () => {
    const file = new File(['binary'], 'photo.', { type: 'image/png' });
    const path = petPhotoStoragePath('20000000-0000-4000-8000-000000000001', file);

    expect(path).toMatch(/^20000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.png$/);
  });

  it('falls back to lowercase file extension when MIME type is unknown', () => {
    const file = { type: 'unknown/mime', name: 'photo.WEBP' };
    const path = petPhotoStoragePath('20000000-0000-4000-8000-000000000001', file);

    expect(path).toMatch(/^20000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.webp$/);
  });
});

describe('listMyPets', () => {
  it('filters pets by the given owner, not just RLS', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyPets('owner-123')).resolves.toEqual([]);
    expect(from).toHaveBeenCalledWith('pets');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-123');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('surfaces a database error instead of returning an empty list', async () => {
    const dbError = new Error('select failed');
    const order = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const from = jest.fn().mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyPets('owner-123')).rejects.toBe(dbError);
  });
});

describe('deletePet', () => {
  function setupDeletePetMocks(options: {
    userId?: string | null;
    userError?: Error | null;
    petRecord?: { id: string; photo_url: string | null; owner_id: string } | null;
    fetchError?: Error | null;
    bookings?: Array<{ id: string }> | null;
    bookingsError?: Error | null;
    removeData?: Array<{ name: string }> | null;
    removeError?: Error | null;
    deletedRows?: Array<{ id: string }> | null;
    deleteError?: Error | null;
  }) {
    const {
      userId = 'owner-123',
      userError = null,
      petRecord = { id: 'pet-123', photo_url: null, owner_id: 'owner-123' },
      fetchError = null,
      bookings = [],
      bookingsError = null,
      removeData = [{ name: 'pet-123/uuid-photo.png' }],
      removeError = null,
      deletedRows = [{ id: 'pet-123' }],
      deleteError = null,
    } = options;

    const fetchSingle = jest.fn().mockResolvedValue({ data: petRecord, error: fetchError });
    const fetchEqOwner = jest.fn().mockReturnValue({ maybeSingle: fetchSingle });
    const fetchEqId = jest.fn().mockReturnValue({ eq: fetchEqOwner, maybeSingle: fetchSingle });
    const fetchSelect = jest.fn().mockReturnValue({ eq: fetchEqId });

    const deleteSelect = jest.fn().mockResolvedValue({ data: deletedRows, error: deleteError });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const bookingsLimit = jest.fn().mockResolvedValue({ data: bookings, error: bookingsError });
    const bookingsEq = jest.fn().mockReturnValue({ limit: bookingsLimit });
    const bookingsSelect = jest.fn().mockReturnValue({ eq: bookingsEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') {
        return {
          select: fetchSelect,
          delete: deleteMethod,
        };
      }
      if (table === 'bookings') {
        return {
          select: bookingsSelect,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const remove = jest.fn().mockResolvedValue({ data: removeData, error: removeError });
    const storageFrom = jest.fn().mockReturnValue({ remove });

    const getUser = jest.fn().mockResolvedValue({
      data: { user: userId ? { id: userId } : null },
      error: userError,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      from,
      storage: { from: storageFrom },
    } as never);

    return {
      getUser,
      from,
      fetchSelect,
      fetchEqId,
      fetchEqOwner,
      bookingsSelect,
      bookingsEq,
      bookingsLimit,
      storageFrom,
      remove,
      deleteMethod,
      deleteEq,
      deleteSelect,
    };
  }

  it('throws an error when user is not signed in', async () => {
    setupDeletePetMocks({ userId: null });

    await expect(deletePet('pet-123')).rejects.toThrow('You must be signed in to delete a pet.');
  });

  it('surfaces auth error when getUser fails', async () => {
    const authErr = new Error('Auth failure');
    setupDeletePetMocks({ userError: authErr });

    await expect(deletePet('pet-123')).rejects.toBe(authErr);
  });

  it('removes a pet with no photo directly from the database without calling storage', async () => {
    const { storageFrom, deleteMethod, deleteEq, deleteSelect, fetchSelect, fetchEqId, fetchEqOwner } =
      setupDeletePetMocks({
        petRecord: { id: 'pet-123', photo_url: null, owner_id: 'owner-123' },
      });

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(fetchSelect).toHaveBeenCalledWith('id, photo_url, owner_id');
    expect(fetchEqId).toHaveBeenCalledWith('id', 'pet-123');
    expect(fetchEqOwner).toHaveBeenCalledWith('owner_id', 'owner-123');
    expect(storageFrom).not.toHaveBeenCalled();
    expect(deleteMethod).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'pet-123');
    expect(deleteSelect).toHaveBeenCalledWith('id');
  });

  it('removes pet photo from storage before deleting the database row', async () => {
    const { storageFrom, remove, deleteMethod, deleteEq } = setupDeletePetMocks({
      petRecord: { id: 'pet-123', photo_url: 'pet-123/uuid-photo.png', owner_id: 'owner-123' },
      removeData: [{ name: 'pet-123/uuid-photo.png' }],
    });

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(storageFrom).toHaveBeenCalledWith(PET_PHOTO_BUCKET);
    expect(remove).toHaveBeenCalledWith(['pet-123/uuid-photo.png']);
    expect(deleteMethod).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'pet-123');
  });

  it('throws an error if pet is not found or not owned by user during fetch', async () => {
    setupDeletePetMocks({ petRecord: null });

    await expect(deletePet('pet-123')).rejects.toThrow(
      'Pet with id pet-123 not found or you do not have permission to delete it.',
    );
  });

  it('surfaces fetch error when retrieving pet before deletion', async () => {
    const fetchError = new Error('network down');
    setupDeletePetMocks({ fetchError });

    await expect(deletePet('pet-123')).rejects.toBe(fetchError);
  });

  it('throws an error when pet has existing bookings and does not touch storage or delete row', async () => {
    const { storageFrom, deleteMethod } = setupDeletePetMocks({
      petRecord: { id: 'pet-123', photo_url: 'pet-123/uuid-photo.png', owner_id: 'owner-123' },
      bookings: [{ id: 'booking-1' }],
    });

    await expect(deletePet('pet-123')).rejects.toThrow('Cannot delete a pet that has existing bookings.');
    expect(storageFrom).not.toHaveBeenCalled();
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('surfaces bookings check error and does not touch storage or delete row', async () => {
    const bookingsError = new Error('bookings query failed');
    const { storageFrom, deleteMethod } = setupDeletePetMocks({ bookingsError });

    await expect(deletePet('pet-123')).rejects.toBe(bookingsError);
    expect(storageFrom).not.toHaveBeenCalled();
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('surfaces storage remove error and does not delete database row', async () => {
    const storageError = new Error('storage remove failed');
    const { deleteMethod } = setupDeletePetMocks({
      petRecord: { id: 'pet-123', photo_url: 'pet-123/uuid-photo.png', owner_id: 'owner-123' },
      removeError: storageError,
      removeData: null,
    });

    await expect(deletePet('pet-123')).rejects.toThrow('Failed to delete pet photo: storage remove failed');
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('throws an error when storage remove returns empty array (RLS blocked) and does not delete database row', async () => {
    const { deleteMethod } = setupDeletePetMocks({
      petRecord: { id: 'pet-123', photo_url: 'pet-123/uuid-photo.png', owner_id: 'owner-123' },
      removeData: [],
    });

    await expect(deletePet('pet-123')).rejects.toThrow('Failed to delete pet photo: permission denied or not found.');
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('throws an error when database delete affects 0 rows due to RLS filtering', async () => {
    setupDeletePetMocks({ deletedRows: [] });

    await expect(deletePet('pet-123')).rejects.toThrow('Could not delete pet pet-123: permission denied or pet not found.');
  });
});

describe('getPetPhotoSignedUrl', () => {
  it('generates a private signed URL from the pet-photos bucket using default TTL', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.test/signed/pet-1/photo.jpg' },
      error: null,
    });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });

    mockedGetSupabaseClient.mockReturnValue({ storage: { from: storageFrom } } as never);

    await expect(getPetPhotoSignedUrl('pet-1/photo.jpg')).resolves.toBe('https://storage.test/signed/pet-1/photo.jpg');
    expect(storageFrom).toHaveBeenCalledWith(PET_PHOTO_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith('pet-1/photo.jpg', PET_PHOTO_SIGNED_URL_TTL_SECONDS);
  });

  it('allows overriding the signed URL TTL', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.test/signed/pet-1/photo.jpg' },
      error: null,
    });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });

    mockedGetSupabaseClient.mockReturnValue({ storage: { from: storageFrom } } as never);

    await expect(getPetPhotoSignedUrl('pet-1/photo.jpg', 600)).resolves.toBe('https://storage.test/signed/pet-1/photo.jpg');
    expect(createSignedUrl).toHaveBeenCalledWith('pet-1/photo.jpg', 600);
  });

  it('surfaces storage errors when signed URL creation fails', async () => {
    const storageError = new Error('storage offline');
    const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: storageError });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });

    mockedGetSupabaseClient.mockReturnValue({ storage: { from: storageFrom } } as never);

    await expect(getPetPhotoSignedUrl('pet-1/photo.jpg')).rejects.toBe(storageError);
  });

  it('throws a descriptive error when signedUrl is missing from response', async () => {
    const createSignedUrl = jest.fn().mockResolvedValue({ data: null, error: null });
    const storageFrom = jest.fn().mockReturnValue({ createSignedUrl });

    mockedGetSupabaseClient.mockReturnValue({ storage: { from: storageFrom } } as never);

    await expect(getPetPhotoSignedUrl('pet-1/photo.jpg')).rejects.toThrow('Could not create signed URL for pet-1/photo.jpg');
  });
});

describe('createPet', () => {
  it('validates photo MIME type upfront and rejects before touching auth or database', async () => {
    const from = jest.fn();
    const getUser = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    const invalidFile = new File(['binary'], 'document.pdf', { type: 'application/pdf' });
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: invalidFile,
    })).rejects.toThrow('Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.');

    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('validates photo size upfront and rejects before touching auth or database', async () => {
    const from = jest.fn();
    const getUser = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as never);

    const oversizedFile = { type: 'image/png', size: PET_PHOTO_MAX_BYTES + 100 } as File;
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: oversizedFile,
    })).rejects.toThrow(/Photo is larger than the 10 MB limit/);

    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('inserts a trimmed pet without a photo and ensures storage is never called', async () => {
    const created = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const single = jest.fn().mockResolvedValue({ data: created, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    const storageFrom = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    await expect(createPet({
      name: '  Rocket ',
      species: 'dog',
      breed: '   ',
      ageYear: 3,
      description: ' Loves walks ',
    })).resolves.toEqual(created);

    expect(from).toHaveBeenCalledWith('pets');
    expect(insert).toHaveBeenCalledWith({
      owner_id: 'owner-123',
      name: 'Rocket',
      species: 'dog',
      breed: null,
      age_year: 3,
      description: 'Loves walks',
    });
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('refuses to create a pet when signed out', async () => {
    const from = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser: signedIn(null) }, from } as never);

    await expect(createPet({ name: 'Rocket', species: 'dog', breed: '', ageYear: null, description: '' }))
      .rejects.toThrow('You must be signed in to add a pet.');
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a database error instead of returning a pet when initial insert fails', async () => {
    const dbError = new Error('insert failed');
    const single = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const from = jest.fn().mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser: signedIn('owner-123') }, from } as never);

    await expect(createPet({ name: 'Rocket', species: 'dog', breed: '', ageYear: null, description: '' }))
      .rejects.toBe(dbError);
  });

  it('inserts pet, uploads photo to pet-photos bucket, and updates photo_url when photo is provided', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const updatedPet = { ...createdPet, photo_url: 'pet-1/mock-uuid.png' };

    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateSingle = jest.fn().mockResolvedValue({ data: updatedPet, error: null });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded-path' }, error: null });
    const storageFrom = jest.fn((bucket: string) => {
      if (bucket === PET_PHOTO_BUCKET) return { upload };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    const result = await createPet({
      name: 'Rocket',
      species: 'dog',
      breed: 'Corgi',
      ageYear: 2,
      description: 'Loves agility',
      photo: file,
    });

    expect(result).toEqual(updatedPet);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner-123',
      name: 'Rocket',
    }));
    expect(storageFrom).toHaveBeenCalledWith(PET_PHOTO_BUCKET);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^pet-1\/[0-9a-f-]+\.png$/),
      file,
      { contentType: 'image/png', upsert: false },
    );
    expect(update).toHaveBeenCalledWith({
      photo_url: expect.stringMatching(/^pet-1\/[0-9a-f-]+\.png$/),
    });
    expect(updateEq).toHaveBeenCalledWith('id', 'pet-1');
  });

  it('rolls back by deleting the inserted pet when photo upload fails', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const deleteSelect = jest.fn().mockResolvedValue({ data: [{ id: 'pet-1' }], error: null });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const uploadError = new Error('Storage network timeout');
    const upload = jest.fn().mockResolvedValue({ data: null, error: uploadError });
    const remove = jest.fn();
    const storageFrom = jest.fn((bucket: string) => {
      if (bucket === PET_PHOTO_BUCKET) return { upload, remove };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: file,
    })).rejects.toBe(uploadError);

    // Rollback deletes the created pet record
    expect(deleteMethod).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'pet-1');
    expect(deleteSelect).toHaveBeenCalledWith('id');
    // Storage remove should NOT be called since upload didn't succeed
    expect(remove).not.toHaveBeenCalled();
  });

  it('rolls back by removing the uploaded photo and deleting the pet when photo_url update fails', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateError = new Error('Database connection lost during update');
    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const deleteSelect = jest.fn().mockResolvedValue({ data: [{ id: 'pet-1' }], error: null });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const remove = jest.fn().mockImplementation((paths: string[]) =>
      Promise.resolve({
        data: paths.map((path) => ({ name: path })),
        error: null,
      }),
    );
    const storageFrom = jest.fn((bucket: string) => {
      if (bucket === PET_PHOTO_BUCKET) return { upload, remove };
      throw new Error(`Unexpected bucket: ${bucket}`);
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: file,
    })).rejects.toBe(updateError);

    // Rollback removes the uploaded photo object from storage first
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^pet-1\/[0-9a-f-]+\.png$/)]);
    // Then deletes the pet from the database
    expect(deleteMethod).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'pet-1');
    expect(deleteSelect).toHaveBeenCalledWith('id');
  });

  it('reports incomplete rollback and preserves cause when pet deletion fails after upload failure', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const deleteError = new Error('DB delete rejected');
    const deleteSelect = jest.fn().mockResolvedValue({ data: null, error: deleteError });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const uploadError = new Error('Storage failed');
    const upload = jest.fn().mockResolvedValue({ data: null, error: uploadError });
    const storageFrom = jest.fn().mockReturnValue({ upload });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    let caughtError: unknown;
    try {
      await createPet({
        name: 'Rocket',
        species: 'dog',
        breed: '',
        ageYear: null,
        description: '',
        photo: file,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      'Storage failed (rollback incomplete: pet cleanup failed: DB delete rejected)',
    );
    expect((caughtError as Error).cause).toBe(uploadError);
  });

  it('reports incomplete rollback and skips pet deletion when storage remove fails with error after update failure', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateError = new Error('Update failed');
    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const deleteMethod = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const removeError = new Error('Storage remove failed');
    const remove = jest.fn().mockResolvedValue({ data: null, error: removeError });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    let caughtError: unknown;
    try {
      await createPet({
        name: 'Rocket',
        species: 'dog',
        breed: '',
        ageYear: null,
        description: '',
        photo: file,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      'Update failed (rollback incomplete: photo cleanup failed: Storage remove failed)',
    );
    expect((caughtError as Error).cause).toBe(updateError);
    // Pet must not be deleted if photo cleanup failed, to avoid orphaning the storage object
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('reports incomplete rollback and skips pet deletion when storage remove returns 0 deleted objects (RLS blocked) after update failure', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateError = new Error('Update failed');
    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const deleteMethod = jest.fn();

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    let caughtError: unknown;
    try {
      await createPet({
        name: 'Rocket',
        species: 'dog',
        breed: '',
        ageYear: null,
        description: '',
        photo: file,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      'Update failed (rollback incomplete: photo cleanup failed: storage object not found or permission denied)',
    );
    expect((caughtError as Error).cause).toBe(updateError);
    expect(deleteMethod).not.toHaveBeenCalled();
  });

  it('reports incomplete rollback when pet delete returns 0 rows due to RLS blocking after successful photo cleanup', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateError = new Error('Update failed');
    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const deleteSelect = jest.fn().mockResolvedValue({ data: [], error: null });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const remove = jest.fn().mockImplementation((paths: string[]) =>
      Promise.resolve({
        data: paths.map((path) => ({ name: path })),
        error: null,
      }),
    );
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from,
      storage: { from: storageFrom },
    } as never);

    const file = new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
    let caughtError: unknown;
    try {
      await createPet({
        name: 'Rocket',
        species: 'dog',
        breed: '',
        ageYear: null,
        description: '',
        photo: file,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      'Update failed (rollback incomplete: pet cleanup failed: Could not delete pet pet-1: permission denied or pet not found.)',
    );
    expect((caughtError as Error).cause).toBe(updateError);
    expect(deleteMethod).toHaveBeenCalled();
  });
});

describe('getPet', () => {
  it('fetches a single pet by id and returns the row', async () => {
    const mockPet = {
      id: 'pet-123',
      owner_id: 'owner-1',
      name: 'Rocket',
      species: 'dog',
      breed: 'Beagle',
      age_year: 3,
      description: 'Friendly dog',
      photo_url: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const maybeSingle = jest.fn().mockResolvedValue({ data: mockPet, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn((table: string) => {
      if (table === 'pets') return { select };
      throw new Error(`Unexpected table: ${table}`);
    });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(getPet('pet-123')).resolves.toEqual(mockPet);
    expect(from).toHaveBeenCalledWith('pets');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('id', 'pet-123');
  });

  it('returns null when the pet does not exist or is not accessible', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(getPet('nonexistent-pet')).resolves.toBeNull();
  });

  it('surfaces database error when fetching pet fails', async () => {
    const dbError = new Error('Database connection failed');
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(getPet('pet-123')).rejects.toBe(dbError);
  });
});

describe('updatePet', () => {
  const validValues: UpdatePetValues = {
    name: '  Rocket Updated  ',
    species: 'dog',
    breed: '  Beagle Mix  ',
    ageYear: 4,
    description: '  Very active and friendly dog  ',
  };

  it('throws an error when user is not signed in', async () => {
    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn(null) },
    } as never);

    await expect(updatePet('pet-123', validValues)).rejects.toThrow('You must be signed in to update a pet.');
  });

  it('surfaces auth error when getUser fails', async () => {
    const authError = new Error('Session expired');
    const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: authError });
    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
    } as never);

    await expect(updatePet('pet-123', validValues)).rejects.toBe(authError);
  });

  it('updates pet attributes, trims text, never sends owner_id, and returns updated pet row', async () => {
    const updatedRecord = {
      id: 'pet-123',
      owner_id: 'owner-456',
      name: 'Rocket Updated',
      species: 'dog',
      breed: 'Beagle Mix',
      age_year: 4,
      description: 'Very active and friendly dog',
      photo_url: 'pet-123/photo.jpg',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    const single = jest.fn().mockResolvedValue({ data: updatedRecord, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eqOwner = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqOwner });
    const update = jest.fn().mockReturnValue({ eq: eqId });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { update };
      throw new Error(`Unexpected table: ${table}`);
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-456') },
      from,
    } as never);

    const result = await updatePet('pet-123', validValues);

    expect(result).toEqual(updatedRecord);
    expect(from).toHaveBeenCalledWith('pets');
    expect(update).toHaveBeenCalledWith({
      name: 'Rocket Updated',
      species: 'dog',
      breed: 'Beagle Mix',
      age_year: 4,
      description: 'Very active and friendly dog',
    });
    // Explicitly verify owner_id is NEVER sent in the update payload
    expect(update.mock.calls[0][0]).not.toHaveProperty('owner_id');
    expect(eqId).toHaveBeenCalledWith('id', 'pet-123');
    expect(eqOwner).toHaveBeenCalledWith('owner_id', 'owner-456');
    expect(select).toHaveBeenCalledWith('*');
    expect(single).toHaveBeenCalled();
  });

  it('converts blank breed and description strings to null', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'pet-123' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eqOwner = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqOwner });
    const update = jest.fn().mockReturnValue({ eq: eqId });

    const from = jest.fn().mockReturnValue({ update });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-456') },
      from,
    } as never);

    await updatePet('pet-123', {
      name: 'Milo',
      species: 'cat',
      breed: '   ',
      ageYear: null,
      description: '',
    });

    expect(update).toHaveBeenCalledWith({
      name: 'Milo',
      species: 'cat',
      breed: null,
      age_year: null,
      description: null,
    });
  });

  it('surfaces update error when database update fails', async () => {
    const updateError = new Error('Permission denied or row locked');
    const single = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const select = jest.fn().mockReturnValue({ single });
    const eqOwner = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqOwner });
    const update = jest.fn().mockReturnValue({ eq: eqId });

    const from = jest.fn().mockReturnValue({ update });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-456') },
      from,
    } as never);

    await expect(updatePet('pet-123', validValues)).rejects.toBe(updateError);
  });
});
