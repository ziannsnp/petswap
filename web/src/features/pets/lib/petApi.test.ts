import { getSupabaseClient } from '@/shared/lib/supabase';
import { createPet, listMyPets } from './petApi';

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

describe('createPet', () => {
  it('inserts a trimmed pet owned by the current user and stores blank optional fields as null', async () => {
    const created = { id: 'pet-1', name: 'Rocket' };
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
    });
  });

  it('refuses to create a pet when signed out', async () => {
    const from = jest.fn();

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser: signedIn(null) }, from } as never);

    await expect(createPet({ name: 'Rocket', species: 'dog', breed: '', ageYear: null, description: '' }))
      .rejects.toThrow('You must be signed in to add a pet.');
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a database error instead of returning a pet', async () => {
    const dbError = new Error('insert failed');
    const single = jest.fn().mockResolvedValue({ data: null, error: dbError });
    const from = jest.fn().mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });

    mockedGetSupabaseClient.mockReturnValue({ auth: { getUser: signedIn('owner-123') }, from } as never);

    await expect(createPet({ name: 'Rocket', species: 'dog', breed: '', ageYear: null, description: '' }))
      .rejects.toBe(dbError);
  });
});
