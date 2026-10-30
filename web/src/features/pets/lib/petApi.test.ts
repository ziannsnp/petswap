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
import { PetHasBookingsError } from './petErrors';
import { validatePetPhoto as validatePetPhotoRule } from './petPhoto';

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

// The rules themselves are tested in petPhoto.test.ts; this checks petApi still exposes them.
describe('validatePetPhoto re-export', () => {
  it('is the same function the form uses', () => {
    expect(validatePetPhoto).toBe(validatePetPhotoRule);
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
    const is = jest.fn().mockReturnValue({ order });
    const eq = jest.fn().mockReturnValue({ is });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyPets('owner-123')).resolves.toEqual([]);
    expect(from).toHaveBeenCalledWith('pets');
    expect(eq).toHaveBeenCalledWith('owner_id', 'owner-123');
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('surfaces a database error instead of returning an empty list', async () => {
    const dbError = new Error('select failed');
    const order = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const from = jest.fn().mockReturnValue({ select: () => ({ eq: () => ({ is: () => ({ order }) }) }) });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(listMyPets('owner-123')).rejects.toBe(dbError);
  });
});

describe('deletePet', () => {
  // How delete_pet_with_active_booking_check refuses, as supabase-js hands it back: a plain
  // object, not an Error. The messages are the ones the migration raises.
  const rpcErrors = {
    activeBookings: { code: 'P0001', message: 'Pet has active bookings and cannot be deleted.', details: null, hint: null },
    alreadyDeleted: { code: 'P0001', message: 'Pet is already deleted.', details: null, hint: null },
    notOwner: { code: '42501', message: 'Only the pet owner can delete this pet.', details: null, hint: null },
  };

  function setupDeletePetMocks(options: {
    oldPhotoPath?: string | null;
    rpcError?: object | null;
    remove?: jest.Mock;
  } = {}) {
    const {
      oldPhotoPath = null,
      rpcError = null,
      remove = jest.fn().mockResolvedValue({ data: [{ name: 'pet-123/uuid-photo.png' }], error: null }),
    } = options;

    const rpc = jest.fn().mockResolvedValue({ data: rpcError ? null : oldPhotoPath, error: rpcError });
    const from = jest.fn();
    const storageFrom = jest.fn().mockReturnValue({ remove });

    mockedGetSupabaseClient.mockReturnValue({ rpc, from, storage: { from: storageFrom } } as never);

    return { rpc, from, storageFrom, remove };
  }

  it('deletes through the active-booking RPC, not a direct table delete', async () => {
    const { rpc, from, storageFrom } = setupDeletePetMocks();

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('delete_pet_with_active_booking_check', { target_pet_id: 'pet-123' });
    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('removes the photo path the RPC returns, after the pet is deleted', async () => {
    const { rpc, storageFrom, remove } = setupDeletePetMocks({ oldPhotoPath: 'pet-123/uuid-photo.png' });

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(storageFrom).toHaveBeenCalledWith(PET_PHOTO_BUCKET);
    expect(remove).toHaveBeenCalledWith(['pet-123/uuid-photo.png']);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('reports an active booking as PetHasBookingsError and leaves the photo alone', async () => {
    const { storageFrom } = setupDeletePetMocks({ rpcError: rpcErrors.activeBookings });

    const result = deletePet('pet-123');
    await expect(result).rejects.toBeInstanceOf(PetHasBookingsError);
    await expect(result).rejects.toThrow('Cannot delete a pet that has active bookings.');
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('treats a pet that is already deleted as deleted', async () => {
    const { storageFrom } = setupDeletePetMocks({ rpcError: rpcErrors.alreadyDeleted });

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it('surfaces any other RPC error unchanged', async () => {
    const { storageFrom } = setupDeletePetMocks({ rpcError: rpcErrors.notOwner });

    await expect(deletePet('pet-123')).rejects.toBe(rpcErrors.notOwner);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it.each([
    ['returns an error', jest.fn().mockResolvedValue({ data: null, error: new Error('storage down') })],
    ['removes nothing (RLS blocked)', jest.fn().mockResolvedValue({ data: [], error: null })],
    ['throws', jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('still resolves when photo removal %s, because the pet is already deleted', async (_case, remove) => {
    setupDeletePetMocks({ oldPhotoPath: 'pet-123/uuid-photo.png', remove });

    await expect(deletePet('pet-123')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(['pet-123/uuid-photo.png']);
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

// A dropped connection rejects the storage promise instead of resolving with `error`,
// so rollback must handle both shapes.
describe('createPet rollback when a storage call throws', () => {
  const values = {
    name: 'Rocket',
    species: 'dog' as const,
    breed: '',
    ageYear: null,
    description: 'Loves agility',
  };

  function setupCreateMocks({
    upload,
    updateError = null as Error | null,
    remove = jest.fn().mockImplementation((paths: string[]) => Promise.resolve({
      data: paths.map((path) => ({ name: path.split('/').pop() })),
      error: null,
    })),
  }: { upload: jest.Mock; updateError?: Error | null; remove?: jest.Mock }) {
    const insertSingle = jest.fn().mockResolvedValue({ data: { id: 'pet-1', photo_url: null }, error: null });
    const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: insertSingle }) });

    const updateSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: updateSingle }) }),
    });

    const deleteSelect = jest.fn().mockResolvedValue({ data: [{ id: 'pet-1' }], error: null });
    const deleteEq = jest.fn().mockReturnValue({ select: deleteSelect });
    const deleteMethod = jest.fn().mockReturnValue({ eq: deleteEq });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-123') },
      from: jest.fn().mockReturnValue({ insert, update, delete: deleteMethod }),
      storage: { from: jest.fn().mockReturnValue({ upload, remove }) },
    } as never);

    return { update, remove, deleteMethod, deleteEq };
  }

  function photo() {
    return new File(['image-bytes'], 'rocket.png', { type: 'image/png' });
  }

  it('deletes the new pet, and removes no file, when the upload throws', async () => {
    const networkError = new TypeError('Failed to fetch');
    const { update, remove, deleteEq } = setupCreateMocks({ upload: jest.fn().mockRejectedValue(networkError) });

    await expect(createPet({ ...values, photo: photo() })).rejects.toBe(networkError);

    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', 'pet-1');
  });

  it('removes the upload before deleting the pet when the photo_url update fails', async () => {
    const updateError = new Error('Update failed');
    const upload = jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null });
    const { remove, deleteMethod } = setupCreateMocks({ upload, updateError });

    await expect(createPet({ ...values, photo: photo() })).rejects.toBe(updateError);

    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    // Storage RLS checks that the pet row exists, so the file has to go first.
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deleteMethod.mock.invocationCallOrder[0]);
  });

  it('keeps the pet and reports an incomplete rollback when removing the upload throws', async () => {
    const updateError = new Error('Update failed');
    const { deleteMethod } = setupCreateMocks({
      upload: jest.fn().mockResolvedValue({ data: { path: 'uploaded' }, error: null }),
      updateError,
      remove: jest.fn().mockRejectedValue(new Error('socket hang up')),
    });

    const result = createPet({ ...values, photo: photo() });

    await expect(result).rejects.toThrow('Update failed (rollback incomplete: photo cleanup failed: socket hang up)');
    await expect(result).rejects.toHaveProperty('cause', updateError);
    // Deleting the pet would leave a file nobody may remove any more.
    expect(deleteMethod).not.toHaveBeenCalled();
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
      deleted_at: null,
    };

    const maybeSingle = jest.fn().mockResolvedValue({ data: mockPet, error: null });
    const is = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ is });
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
    expect(is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('returns null when the pet does not exist, is deleted, or is not accessible', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const is = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ is });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockedGetSupabaseClient.mockReturnValue({ from } as never);

    await expect(getPet('nonexistent-pet')).resolves.toBeNull();
  });

  it('surfaces database error when fetching pet fails', async () => {
    const dbError = new Error('Database connection failed');
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const is = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ is });
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

    const maybeSingle = jest.fn().mockResolvedValue({ data: updatedRecord, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
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
    expect(maybeSingle).toHaveBeenCalled();
  });

  it('converts blank breed and description strings to null', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'pet-123' }, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
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

  it('throws an error when no row matches during update (not found or not owned by user)', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eqOwner = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqOwner });
    const update = jest.fn().mockReturnValue({ eq: eqId });

    const from = jest.fn().mockReturnValue({ update });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-456') },
      from,
    } as never);

    await expect(updatePet('pet-123', validValues)).rejects.toThrow(
      'Pet with id pet-123 not found or you do not have permission to update it.',
    );
  });

  it('surfaces update error when database update fails', async () => {
    const updateError = new Error('Permission denied or row locked');
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: updateError });
    const select = jest.fn().mockReturnValue({ maybeSingle });
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

describe('updatePet photo changes', () => {
  const baseValues: UpdatePetValues = {
    name: 'Rocket',
    species: 'dog',
    breed: 'Beagle mix',
    ageYear: 4,
    description: 'Friendly with other dogs.',
  };
  const savedPet = { id: 'pet-1', owner_id: 'owner-1', name: 'Rocket', photo_url: 'pet-1/new.png' };

  function newPhoto() {
    return new File(['png'], 'new.png', { type: 'image/png' });
  }

  type RemoveOutcome = 'removed' | 'error' | 'throws' | 'empty';

  function setupPhotoUpdateMocks({
    currentPet = { photo_url: 'pet-1/old.png' } as { photo_url: string | null } | null,
    fetchError = null as Error | null,
    uploadError = null as Error | null,
    updateResult = { data: savedPet as unknown, error: null as Error | null },
    // What a re-read after a failed save finds: the old row, a row pointing at the new upload, or an error.
    reread = 'unchanged' as 'unchanged' | 'points-at-new' | 'error',
    removeOutcome = 'removed' as RemoveOutcome,
  } = {}) {
    const upload = jest.fn().mockResolvedValue({ data: {}, error: uploadError });

    const fetchMaybeSingle = jest.fn()
      .mockResolvedValueOnce({ data: currentPet, error: fetchError })
      .mockImplementation(() => {
        if (reread === 'error') return Promise.resolve({ data: null, error: new Error('network down') });
        const photoUrl = reread === 'points-at-new' ? upload.mock.calls[0]?.[0] : currentPet?.photo_url;
        return Promise.resolve({ data: { photo_url: photoUrl ?? null }, error: null });
      });
    const fetchEqOwner = jest.fn().mockReturnValue({ maybeSingle: fetchMaybeSingle });
    const fetchEqId = jest.fn().mockReturnValue({ eq: fetchEqOwner });
    const select = jest.fn().mockReturnValue({ eq: fetchEqId });

    const updateMaybeSingle = jest.fn().mockResolvedValue(updateResult);
    const updateSelect = jest.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
    const updateEqOwner = jest.fn().mockReturnValue({ select: updateSelect });
    const updateEqId = jest.fn().mockReturnValue({ eq: updateEqOwner });
    const update = jest.fn().mockReturnValue({ eq: updateEqId });

    const remove = jest.fn().mockImplementation((paths: string[]) => {
      switch (removeOutcome) {
        case 'error':
          return Promise.resolve({ data: null, error: new Error('permission denied') });
        case 'throws':
          return Promise.reject(new Error('socket hang up'));
        case 'empty':
          return Promise.resolve({ data: [], error: null });
        default:
          return Promise.resolve({ data: paths.map((path) => ({ name: path.split('/').pop() })), error: null });
      }
    });
    const storageFrom = jest.fn().mockReturnValue({ upload, remove });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser: signedIn('owner-1') },
      from: jest.fn().mockReturnValue({ select, update }),
      storage: { from: storageFrom },
    } as never);

    return { select, fetchEqOwner, update, updateEqOwner, upload, remove, storageFrom };
  }

  it('keeps the current photo when no photo change is given', async () => {
    const { select, update, storageFrom } = setupPhotoUpdateMocks();

    await updatePet('pet-1', baseValues);

    expect(select).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0]).not.toHaveProperty('photo_url');
  });

  it('keeps the current photo when removePhoto is false', async () => {
    const { storageFrom, update } = setupPhotoUpdateMocks();

    await updatePet('pet-1', { ...baseValues, removePhoto: false });

    expect(storageFrom).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0]).not.toHaveProperty('photo_url');
  });

  it('uploads the new photo, points the pet at it, then removes the old file', async () => {
    const { fetchEqOwner, upload, update, updateEqOwner, remove, storageFrom } = setupPhotoUpdateMocks();
    const photo = newPhoto();

    await expect(updatePet('pet-1', { ...baseValues, photo })).resolves.toEqual(savedPet);

    expect(fetchEqOwner).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(storageFrom).toHaveBeenCalledWith(PET_PHOTO_BUCKET);
    const newPath = upload.mock.calls[0][0] as string;
    expect(newPath).toMatch(/^pet-1\/[0-9a-f-]+\.png$/);
    expect(upload).toHaveBeenCalledWith(newPath, photo, { contentType: 'image/png', upsert: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rocket', photo_url: newPath }));
    expect(update.mock.calls[0][0]).not.toHaveProperty('owner_id');
    expect(updateEqOwner).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(['pet-1/old.png']);
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('replaces the photo when both a new photo and removePhoto are given', async () => {
    const { upload, update } = setupPhotoUpdateMocks();

    await updatePet('pet-1', { ...baseValues, photo: newPhoto(), removePhoto: true });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ photo_url: upload.mock.calls[0][0] }));
  });

  it('clears photo_url before removing the file when removePhoto is true', async () => {
    const { upload, update, remove } = setupPhotoUpdateMocks();

    await updatePet('pet-1', { ...baseValues, removePhoto: true });

    expect(upload).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ photo_url: null }));
    expect(remove).toHaveBeenCalledWith(['pet-1/old.png']);
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('removes no file when removePhoto is true but the pet has no photo', async () => {
    const { update, remove } = setupPhotoUpdateMocks({ currentPet: { photo_url: null } });

    await updatePet('pet-1', { ...baseValues, removePhoto: true });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ photo_url: null }));
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not try to remove a file when a pet without a photo gets its first one', async () => {
    const { upload, remove } = setupPhotoUpdateMocks({ currentPet: { photo_url: null } });

    await updatePet('pet-1', { ...baseValues, photo: newPhoto() });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('rejects an invalid photo before any network call', async () => {
    const photo = new File(['svg'], 'logo.svg', { type: 'image/svg+xml' });

    await expect(updatePet('pet-1', { ...baseValues, photo })).rejects.toThrow(/unsupported file type/i);
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('does not upload when the pet is not found or not owned', async () => {
    const { upload, update } = setupPhotoUpdateMocks({ currentPet: null });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toThrow(
      'Pet with id pet-1 not found or you do not have permission to update it.',
    );
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces a fetch error without uploading', async () => {
    const fetchError = new Error('network down');
    const { upload } = setupPhotoUpdateMocks({ fetchError });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toBe(fetchError);
    expect(upload).not.toHaveBeenCalled();
  });

  it('leaves the pet unchanged when the upload fails', async () => {
    const uploadError = new Error('quota exceeded');
    const { update, remove } = setupPhotoUpdateMocks({ uploadError });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toBe(uploadError);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes the new upload and keeps the old file when the update fails', async () => {
    const updateError = new Error('check constraint violated');
    const { upload, remove } = setupPhotoUpdateMocks({ updateResult: { data: null, error: updateError } });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toBe(updateError);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it('removes the new upload when the update matches no row', async () => {
    const { upload, remove } = setupPhotoUpdateMocks({ updateResult: { data: null, error: null } });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toThrow(
      'Pet with id pet-1 not found or you do not have permission to update it.',
    );
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it('keeps the new upload when the failed save actually committed', async () => {
    const lostResponse = new Error('Failed to fetch');
    const { remove } = setupPhotoUpdateMocks({
      updateResult: { data: null, error: lostResponse },
      reread: 'points-at-new',
    });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toBe(lostResponse);
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps the new upload when the row cannot be re-read after a failed save', async () => {
    const lostResponse = new Error('Failed to fetch');
    const { remove } = setupPhotoUpdateMocks({
      updateResult: { data: null, error: lostResponse },
      reread: 'error',
    });

    await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).rejects.toBe(lostResponse);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    ['returns an error', 'error', 'permission denied'],
    ['throws', 'throws', 'socket hang up'],
    ['reports nothing removed', 'empty', 'storage object not found or permission denied'],
  ] as const)('reports an incomplete rollback when removing the new upload %s', async (_label, removeOutcome, reason) => {
    const updateError = new Error('check constraint violated');
    setupPhotoUpdateMocks({ updateResult: { data: null, error: updateError }, removeOutcome });

    const result = updatePet('pet-1', { ...baseValues, photo: newPhoto() });

    await expect(result).rejects.toThrow(
      `check constraint violated (rollback incomplete: photo cleanup failed: ${reason})`,
    );
    await expect(result).rejects.toHaveProperty('cause', updateError);
  });

  it.each(['error', 'throws', 'empty'] as const)(
    'still returns the saved pet when removing the old file %s',
    async (removeOutcome) => {
      const { remove } = setupPhotoUpdateMocks({ removeOutcome });

      await expect(updatePet('pet-1', { ...baseValues, photo: newPhoto() })).resolves.toEqual(savedPet);
      expect(remove).toHaveBeenCalledWith(['pet-1/old.png']);
    },
  );
});
