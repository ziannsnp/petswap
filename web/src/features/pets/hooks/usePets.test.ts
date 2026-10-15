import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreatePet, useDeletePet, useMyPets, usePet, useUpdatePet } from './usePets';
import { createPet, deletePet, getPet, listMyPets, updatePet } from '../lib/petApi';
import { useAuth } from '@/features/auth';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options) => options),
  useMutation: jest.fn((options) => options),
  useQueryClient: jest.fn(),
}));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/petApi', () => ({
  createPet: jest.fn(),
  deletePet: jest.fn(),
  getPet: jest.fn(),
  listMyPets: jest.fn(),
  updatePet: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseMutation = jest.mocked(useMutation);
const mockedUseQueryClient = jest.mocked(useQueryClient);
const mockedCreatePet = jest.mocked(createPet);
const mockedDeletePet = jest.mocked(deletePet);
const mockedGetPet = jest.mocked(getPet);
const mockedListMyPets = jest.mocked(listMyPets);
const mockedUpdatePet = jest.mocked(updatePet);

function authState(userId: string | null, isLoading: boolean) {
  mockedUseAuth.mockReturnValue({
    user: userId ? { id: userId } : null,
    isLoading,
  } as ReturnType<typeof useAuth>);
}

afterEach(() => {
  jest.clearAllMocks();
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Asserts that `settled` stays pending until every one of `refetches` has resolved. */
async function expectToWaitFor(settled: Promise<unknown>, refetches: Array<ReturnType<typeof deferred>>) {
  let isSettled = false;
  void settled.then(() => { isSettled = true; });

  for (const refetch of refetches) {
    await Promise.resolve();
    expect(isSettled).toBe(false);
    refetch.resolve();
  }

  await settled;
  expect(isSettled).toBe(true);
}

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

describe('usePet', () => {
  type PetQueryOptions = { queryKey: unknown; enabled: boolean; queryFn: () => Promise<unknown> };
  const petId = '20000000-0000-4000-8000-000000000001';

  it('loads the pet under a cache key scoped to the pet and the owner', async () => {
    authState('owner-123', false);
    mockedGetPet.mockResolvedValue({ id: petId, owner_id: 'owner-123' } as never);

    const options = usePet(petId) as unknown as PetQueryOptions;

    expect(options.queryKey).toEqual(['pets', 'detail', petId, 'owner-123']);
    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toEqual({ id: petId, owner_id: 'owner-123' });
    expect(mockedGetPet).toHaveBeenCalledWith(petId);
  });

  it('treats a pet owned by someone else as not found', async () => {
    authState('listing-owner', false);
    mockedGetPet.mockResolvedValue({ id: petId, owner_id: 'owner-123' } as never);

    const options = usePet(petId) as unknown as PetQueryOptions;

    await expect(options.queryFn()).resolves.toBeNull();
  });

  it('returns null when the pet does not exist', async () => {
    authState('owner-123', false);
    mockedGetPet.mockResolvedValue(null);

    const options = usePet(petId) as unknown as PetQueryOptions;

    await expect(options.queryFn()).resolves.toBeNull();
    expect(mockedGetPet).toHaveBeenCalledWith(petId);
  });

  it('accepts an id written in uppercase', async () => {
    authState('owner-123', false);
    mockedGetPet.mockResolvedValue({ id: petId, owner_id: 'owner-123' } as never);

    const options = usePet(petId.toUpperCase()) as unknown as PetQueryOptions;

    await expect(options.queryFn()).resolves.toEqual({ id: petId, owner_id: 'owner-123' });
    expect(mockedGetPet).toHaveBeenCalledWith(petId.toUpperCase());
  });

  it.each(['abc', 'pet-1', `${petId}x`, ' '])('treats the malformed id %p as not found without a request', async (badId) => {
    authState('owner-123', false);

    const options = usePet(badId) as unknown as PetQueryOptions;

    await expect(options.queryFn()).resolves.toBeNull();
    expect(mockedGetPet).not.toHaveBeenCalled();
  });

  it('does not query before authentication resolves', () => {
    authState(null, true);

    expect(usePet(petId)).toMatchObject({ enabled: false });
  });

  it('does not query for a signed-out visitor', () => {
    authState(null, false);

    expect(usePet(petId)).toMatchObject({ queryKey: ['pets', 'detail', petId, 'anonymous'], enabled: false });
  });

  it('does not query without a pet id', () => {
    authState('owner-123', false);

    expect(usePet('')).toMatchObject({ enabled: false });
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

  it('refetches every pet query, including the unmounted list, when create settles', () => {
    const invalidateQueries = jest.fn();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries } as never);

    useCreatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];
    options?.onSettled?.({} as never, null, values, undefined, undefined as never);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pets'], refetchType: 'all' });
  });

  it('makes the mutation wait until the refetch finishes', async () => {
    const refetch = deferred();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn(() => refetch.promise) } as never);

    useCreatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];

    await expectToWaitFor(Promise.resolve(options?.onSettled?.({} as never, null, values, undefined, undefined as never)), [refetch]);
  });
});

describe('useUpdatePet', () => {
  const values = { name: 'Rocket', species: 'dog' as const, breed: '', ageYear: 4, description: 'Calm now' };

  it('updates the pet through the API adapter', async () => {
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() } as never);
    mockedUpdatePet.mockResolvedValue({ id: 'pet-1' } as never);

    useUpdatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];

    await expect(options?.mutationFn?.({ petId: 'pet-1', values }, undefined as never)).resolves.toEqual({ id: 'pet-1' });
    expect(mockedUpdatePet).toHaveBeenCalledWith('pet-1', values);
  });

  it('refreshes pet and booking queries when the update settles, including after a failure', () => {
    const invalidateQueries = jest.fn();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries } as never);

    useUpdatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];
    options?.onSettled?.(undefined, new Error('response lost'), { petId: 'pet-1', values }, undefined, undefined as never);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pets'], refetchType: 'all' });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });

  it('makes the mutation wait until both refetches finish', async () => {
    const petsRefetch = deferred();
    const bookingsRefetch = deferred();
    const invalidateQueries = jest.fn()
      .mockReturnValueOnce(petsRefetch.promise)
      .mockReturnValueOnce(bookingsRefetch.promise);
    mockedUseQueryClient.mockReturnValue({ invalidateQueries } as never);

    useUpdatePet();
    const options = mockedUseMutation.mock.lastCall?.[0];
    const settled = Promise.resolve(
      options?.onSettled?.({} as never, null, { petId: 'pet-1', values }, undefined, undefined as never),
    );

    await expectToWaitFor(settled, [petsRefetch, bookingsRefetch]);
  });
});

describe('useDeletePet', () => {
  it('deletes the pet through the API adapter', async () => {
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() } as never);
    mockedDeletePet.mockResolvedValue(undefined);

    useDeletePet();
    const options = mockedUseMutation.mock.lastCall?.[0];

    await options?.mutationFn?.('pet-1', undefined as never);
    expect(mockedDeletePet).toHaveBeenCalledWith('pet-1');
  });

  it('refreshes pet queries when the delete settles, including after a failure', () => {
    const invalidateQueries = jest.fn();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries } as never);

    useDeletePet();
    const options = mockedUseMutation.mock.lastCall?.[0];
    options?.onSettled?.(undefined, new Error('photo removed, row kept'), 'pet-1', undefined, undefined as never);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pets'] });
  });

  it('rejects with the API error', async () => {
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() } as never);
    mockedDeletePet.mockRejectedValue(new Error('pet has bookings'));

    useDeletePet();
    const options = mockedUseMutation.mock.lastCall?.[0];

    await expect(options?.mutationFn?.('pet-1', undefined as never)).rejects.toThrow('pet has bookings');
  });
});
