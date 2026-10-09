import { getSupabaseClient } from '@/shared/lib/supabase';
import {
  PET_PHOTO_BUCKET,
  PET_PHOTO_SIGNED_URL_TTL_SECONDS,
  createPet,
  deletePet,
  getPetPhotoSignedUrl,
  listMyPets,
  petPhotoStoragePath,
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

describe('petPhotoStoragePath', () => {
  it('builds a storage path scoped to the pet id with a UUID filename and lowercase extension', () => {
    const file = new File(['binary'], 'Rocket_PHOTO.JPEG', { type: 'image/jpeg' });
    const path = petPhotoStoragePath('20000000-0000-4000-8000-000000000001', file);

    expect(path).toMatch(/^20000000-0000-4000-8000-000000000001\/[0-9a-f-]+\.jpeg$/);
  });

  it('handles files without an extension', () => {
    const file = new File(['binary'], 'photo-no-extension', { type: 'image/png' });
    const path = petPhotoStoragePath('20000000-0000-4000-8000-000000000001', file);

    expect(path).toMatch(/^20000000-0000-4000-8000-000000000001\/[0-9a-f-]+$/);
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
  it('removes a pet by id', async () => {
    const eq = jest.fn().mockResolvedValue({ data: null, error: null });
    const deleteMethod = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ delete: deleteMethod });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('pets');
    expect(deleteMethod).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'pet-123');
  });

  it('surfaces a database error when pet deletion fails', async () => {
    const dbError = new Error('delete failed');
    const eq = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const deleteMethod = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ delete: deleteMethod });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(deletePet('pet-123')).rejects.toBe(dbError);
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
  it('inserts a trimmed pet without a photo and stores blank optional fields as null', async () => {
    const created = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const single = jest.fn().mockResolvedValue({ data: created, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser: signedIn('owner-123') }, from } as never);

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
      photo_url: null,
    });
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
    const updatedPet = { ...createdPet, photo_url: 'pet-1/mock-uuid.jpg' };

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
      photo_url: null,
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

    const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
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

    const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    const from = jest.fn((table: string) => {
      if (table === 'pets') return { insert, update, delete: deleteMethod };
      throw new Error(`Unexpected table: ${table}`);
    });

    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
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
  });

  it('reports incomplete rollback when pet deletion fails after upload failure', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const deleteError = new Error('DB delete rejected');
    const deleteEq = jest.fn().mockResolvedValue({ data: null, error: deleteError });
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
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: file,
    })).rejects.toThrow('Storage failed (rollback incomplete: pet cleanup failed: DB delete rejected)');
  });

  it('reports incomplete rollback when both storage remove and pet delete fail after update failure', async () => {
    const createdPet = { id: 'pet-1', name: 'Rocket', photo_url: null };
    const insertSingle = jest.fn().mockResolvedValue({ data: createdPet, error: null });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const updateError = new Error('Update failed');
    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const deleteError = new Error('DB delete failed');
    const deleteEq = jest.fn().mockResolvedValue({ data: null, error: deleteError });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

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
    await expect(createPet({
      name: 'Rocket',
      species: 'dog',
      breed: '',
      ageYear: null,
      description: '',
      photo: file,
    })).rejects.toThrow('Update failed (rollback incomplete: photo cleanup failed: Storage remove failed, pet cleanup failed: DB delete failed)');
  });
});
