import { getSupabaseClient, type AppSupabaseClient } from '@/shared/lib/supabase';
import { AVATAR_MAX_BYTES, deleteAvatar, getProfile, updateProfile, uploadAvatar } from './profileApi';

jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockedGetSupabaseClient = jest.mocked(getSupabaseClient);

const profile = {
  id: 'user-1',
  display_name: 'Pinn',
  username: 'pinn',
  photo_url: null,
  phone_number: null,
  location: null,
  created_at: '2026-09-12T00:00:00.000Z',
  updated_at: '2026-09-12T00:00:00.000Z',
  consent_version: null,
  consent_given_at: null,
};

function mockClient(options: {
  user?: { id: string } | null;
  userError?: Error | null;
  profileResult?: { data: typeof profile | null; error: Error | null };
}) {
  const maybeSingle = jest.fn().mockResolvedValue(options.profileResult ?? { data: profile, error: null });
  const single = jest.fn().mockResolvedValue(options.profileResult ?? { data: profile, error: null });
  const getEq = jest.fn().mockReturnValue({ maybeSingle });
  const getSelect = jest.fn().mockReturnValue({ eq: getEq });
  const updateSelect = jest.fn().mockReturnValue({ single });
  const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
  const update = jest.fn().mockReturnValue({ eq: updateEq });
  const from = jest.fn().mockReturnValue({ select: getSelect, update });
  const getUser = jest.fn().mockResolvedValue({
    data: { user: options.user === undefined ? { id: 'user-1' } : options.user },
    error: options.userError ?? null,
  });

  mockedGetSupabaseClient.mockReturnValue({ auth: { getUser }, from } as unknown as AppSupabaseClient);
  return { from, getUser, update, getEq, updateEq };
}

describe('getProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the currently authenticated user profile', async () => {
    const { from, getEq } = mockClient({});

    await expect(getProfile()).resolves.toEqual(profile);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(getEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns null when there is no authenticated user', async () => {
    const { from } = mockClient({ user: null });

    await expect(getProfile()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates an authentication error', async () => {
    const error = new Error('Auth unavailable');
    mockClient({ userError: error });

    await expect(getProfile()).rejects.toBe(error);
  });

  it('propagates a profile query error', async () => {
    const error = new Error('Profile read rejected');
    mockClient({ profileResult: { data: null, error } });

    await expect(getProfile()).rejects.toBe(error);
  });
});

describe('updateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates only the authenticated user profile and returns the saved row', async () => {
    const { from, update, updateEq } = mockClient({});
    const values = { display_name: 'Pinn P.', phone_number: '0812345678', location: 'Bangkok' };

    await expect(updateProfile(values)).resolves.toEqual(profile);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(values);
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('rejects an update without an authenticated user', async () => {
    const { from } = mockClient({ user: null });

    await expect(updateProfile({ location: 'Bangkok' })).rejects.toThrow(
      'You must be signed in to update your profile.',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates an authentication error', async () => {
    const error = new Error('Auth unavailable');
    const { from } = mockClient({ userError: error });

    await expect(updateProfile({ location: 'Bangkok' })).rejects.toBe(error);
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates a profile update error', async () => {
    const error = new Error('Update rejected');
    mockClient({ profileResult: { data: null, error } });

    await expect(updateProfile({ photo_url: 'https://example.com/avatar.jpg' })).rejects.toBe(error);
  });

  it('rejects an update when targetProfileId does not match the authenticated user', async () => {
    const { from } = mockClient({ user: { id: 'user-1' } });

    await expect(
      updateProfile({ display_name: 'Imposter' }, 'user-2'),
    ).rejects.toThrow("You cannot edit another user's profile.");
    expect(from).not.toHaveBeenCalled();
  });

  it('allows an update when targetProfileId matches the authenticated user', async () => {
    const { from, update, updateEq } = mockClient({ user: { id: 'user-1' } });
    const values = { display_name: 'Self' };

    await expect(updateProfile(values, 'user-1')).resolves.toEqual(profile);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(values);
    expect(updateEq).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('uploadAvatar', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  function mockAvatarClient(options: {
    user?: { id: string } | null;
    userError?: Error | null;
    uploadError?: Error | null;
    removeError?: Error | null;
    publicUrl?: string;
  }) {
    const upload = jest.fn().mockResolvedValue({ error: options.uploadError ?? null });
    const remove = jest.fn().mockResolvedValue({ error: options.removeError ?? null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: options.publicUrl ?? 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar' },
    });
    const from = jest.fn().mockReturnValue({ upload, remove, getPublicUrl });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: options.user === undefined ? { id: 'user-1' } : options.user },
      error: options.userError ?? null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      storage: { from },
    } as unknown as AppSupabaseClient);
    return { from, upload, remove, getPublicUrl };
  }

  const jpegAvatar = { name: 'portrait.jpg', type: 'image/jpeg' } as File;

  it('uploads to the current user path, replaces an existing avatar, and returns its public URL', async () => {
    const { from, upload, getPublicUrl } = mockAvatarClient({});
    jest.spyOn(Date, 'now').mockReturnValue(1_789_876_543_210);

    await expect(uploadAvatar(jpegAvatar)).resolves.toBe(
      'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar?v=1789876543210',
    );
    expect(from).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith('user-1/avatar', jpegAvatar, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(getPublicUrl).toHaveBeenCalledWith('user-1/avatar');
  });

  it('rejects an upload without an authenticated user', async () => {
    const { from } = mockAvatarClient({ user: null });

    await expect(uploadAvatar(jpegAvatar)).rejects.toThrow('You must be signed in to upload an avatar.');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates an authentication error', async () => {
    const error = new Error('Auth unavailable');
    const { from } = mockAvatarClient({ userError: error });

    await expect(uploadAvatar(jpegAvatar)).rejects.toBe(error);
    expect(from).not.toHaveBeenCalled();
  });

  it('accepts uppercase MIME types', async () => {
    const { upload } = mockAvatarClient({});
    const uppercaseJpeg = { name: 'portrait.jpg', type: 'image/JPEG', size: 1024 } as File;

    await expect(uploadAvatar(uppercaseJpeg)).resolves.toContain('/avatars/user-1/avatar?v=');
    expect(upload).toHaveBeenCalledWith('user-1/avatar', uppercaseJpeg, {
      contentType: 'image/JPEG',
      upsert: true,
    });
  });

  it('rejects a file exceeding the 10 MB Storage limit before authenticating', async () => {
    const oversizedJpeg = {
      name: 'portrait.jpg',
      type: 'image/jpeg',
      size: AVATAR_MAX_BYTES + 1,
    } as File;

    await expect(uploadAvatar(oversizedJpeg)).rejects.toThrow('Avatar image must be smaller than 10 MB.');
    expect(mockedGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects unsupported image types before uploading', async () => {
    const { from } = mockAvatarClient({});

    await expect(uploadAvatar({ name: 'portrait.svg', type: 'image/svg+xml' } as File)).rejects.toThrow(
      'Unsupported avatar type. Choose a JPG, PNG, WebP, or GIF image.',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates a storage upload error', async () => {
    const error = new Error('Storage unavailable');
    const { getPublicUrl } = mockAvatarClient({ uploadError: error });

    await expect(uploadAvatar(jpegAvatar)).rejects.toBe(error);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
});

describe('deleteAvatar', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockDeleteAvatarClient(options: {
    user?: { id: string } | null;
    userError?: Error | null;
    removeError?: Error | null;
  }) {
    const remove = jest.fn().mockResolvedValue({ error: options.removeError ?? null });
    const from = jest.fn().mockReturnValue({ remove });
    const getUser = jest.fn().mockResolvedValue({
      data: { user: options.user === undefined ? { id: 'user-1' } : options.user },
      error: options.userError ?? null,
    });

    mockedGetSupabaseClient.mockReturnValue({
      auth: { getUser },
      storage: { from },
    } as unknown as AppSupabaseClient);
    return { from, remove };
  }

  it('removes the current user avatar through the Storage API', async () => {
    const { from, remove } = mockDeleteAvatarClient({});

    await expect(deleteAvatar()).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('avatars');
    expect(remove).toHaveBeenCalledWith(['user-1/avatar']);
  });

  it('rejects a delete without an authenticated user', async () => {
    const { from } = mockDeleteAvatarClient({ user: null });

    await expect(deleteAvatar()).rejects.toThrow('You must be signed in to delete an avatar.');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates a Storage API delete error', async () => {
    const error = new Error('Storage unavailable');
    mockDeleteAvatarClient({ removeError: error });

    await expect(deleteAvatar()).rejects.toBe(error);
  });
});
