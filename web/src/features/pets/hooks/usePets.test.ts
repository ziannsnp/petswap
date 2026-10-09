import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreatePet, useMyPets } from './usePets';
import { createPet, listMyPets } from '../lib/petApi';
import { useAuth } from '@/features/auth';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options) => options),
  useMutation: jest.fn((options) => options),
  useQueryClient: jest.fn(),
}));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/petApi', () => ({
  createPet: jest.fn(),
  listMyPets: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseMutation = jest.mocked(useMutation);
const mockedUseQueryClient = jest.mocked(useQueryClient);
const mockedCreatePet = jest.mocked(createPet);
const mockedListMyPets = jest.mocked(listMyPets);

function authState(userId: string | null, isLoading: boolean) {
  mockedUseAuth.mockReturnValue({
    user: userId ? { id: userId } : null,
    isLoading,
  } as ReturnType<typeof useAuth>);
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('useMyPets', () => {
  it('fetches the pets of the same owner the cache key is scoped to', async () => {
    authState('owner-123', false);
    mockedListMyPets.mockResolvedValue([]);

    const options = useMyPets() as unknown as { queryKey: unknown; enabled: boolean; queryFn: () => Promise<unknown> };

    expect(options.queryKey).toEqual(['pets', 'mine', 'owner-123']);
    expect(options.enabled).toBe(true);
    await options.queryFn();
    expect(mockedListMyPets).toHaveBeenCalledWith('owner-123');
  });

  it('does not query pets before authentication resolves', () => {
    authState(null, true);

    expect(useMyPets()).toMatchObject({ queryKey: ['pets', 'mine', 'anonymous'], enabled: false });
  });

  it('does not query pets for a signed-out visitor', () => {
    authState(null, false);

    expect(useMyPets()).toMatchObject({ queryKey: ['pets', 'mine', 'anonymous'], enabled: false });
  });
});

describe('useCreatePet', () => {
  const values = { name: 'Rocket', species: 'dog' as const, breed: '', ageYear: 3, description: 'Friendly' };

  it('creates the pet through the API adapter', async () => {
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() } as never);
    mockedCreatePet.mockResolvedValue({ id: 'pet-1' } as never);

    useCreatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];

    await expect(options?.mutationFn?.(values, undefined as never)).resolves.toEqual({ id: 'pet-1' });
    expect(mockedCreatePet).toHaveBeenCalledWith(values);
  });

  it('refreshes every pet query after a successful create', () => {
    const invalidateQueries = jest.fn();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries } as never);

    useCreatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];
    options?.onSuccess?.({} as never, values, undefined, undefined as never);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pets'] });
  });
});
