/** @jest-environment jsdom */
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { deletePet, getPet, listMyPets, updatePet, type Pet } from '../lib/petApi';
import { PetHasBookingsError } from '../lib/petErrors';
import { petKeys, useDeletePet, useMyPets, usePet, useUpdatePet } from './usePets';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/petApi', () => ({
  createPet: jest.fn(),
  deletePet: jest.fn(),
  getPet: jest.fn(),
  listMyPets: jest.fn(),
  updatePet: jest.fn(),
}));

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
// The keys the bookings feature caches its lists under.
const OUTGOING_BOOKINGS = ['bookings', 'outgoing'];
const INCOMING_BOOKINGS = ['bookings', 'incoming'];

function makePet(id: string, name: string): Pet {
  return {
    id,
    owner_id: OWNER_ID,
    name,
    species: 'dog',
    breed: null,
    age_year: 3,
    photo_url: null,
    description: null,
    feeding_instruction: null,
    medical_note: null,
    behavior_note: null,
    allergies: null,
    vaccination_info: null,
    special_requirement: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
  };
}

const rocket = makePet('20000000-0000-4000-8000-000000000001', 'Rocket');
const luna = makePet('20000000-0000-4000-8000-000000000002', 'Luna');
const renamedRocket: Pet = { ...rocket, name: 'Rocket Jr.' };
const values = { name: 'Rocket Jr.', species: 'dog' as const, breed: '', ageYear: 3, description: '' };

function serveFromApi(pets: Pet[]) {
  jest.mocked(listMyPets).mockResolvedValue(pets);
  jest.mocked(getPet).mockImplementation(async (petId) => pets.find((pet) => pet.id === petId) ?? null);
}

// The owner has opened My Pets, both edit screens, and both booking lists, then left them,
// so every query is cached but unmounted. Data never goes stale on its own here, so anything
// a test sees change was refreshed by the mutation hook.
async function renderAfterVisitingEveryScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  serveFromApi([rocket, luna]);
  const visited = renderHook(() => [useMyPets(), usePet(rocket.id), usePet(luna.id)], { wrapper });
  await waitFor(() => expect(visited.result.current.every((query) => query.isSuccess)).toBe(true));
  visited.unmount();
  await queryClient.fetchQuery({ queryKey: OUTGOING_BOOKINGS, queryFn: () => Promise.resolve([]) });
  await queryClient.fetchQuery({ queryKey: INCOMING_BOOKINGS, queryFn: () => Promise.resolve([]) });
  jest.mocked(listMyPets).mockClear();
  jest.mocked(getPet).mockClear();

  return {
    queryClient,
    wrapper,
    myPets: () => queryClient.getQueryData<Pet[]>(petKeys.mine(OWNER_ID)),
    cachedPet: (petId: string) => queryClient.getQueryData<Pet | null>(petKeys.detail(petId, OWNER_ID)),
    isOutOfDate: (queryKey: QueryKey) => queryClient.getQueryState(queryKey)?.isInvalidated,
  };
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({ user: { id: OWNER_ID }, isLoading: false } as ReturnType<typeof useAuth>);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('saving a pet and the cache', () => {
  async function renderEditScreen() {
    const cache = await renderAfterVisitingEveryScreen();
    const { result } = renderHook(() => ({ pet: usePet(rocket.id), update: useUpdatePet() }), { wrapper: cache.wrapper });
    return { ...cache, result };
  }

  it('shows the saved values on the edit screen and the closed My Pets list as soon as the save finishes', async () => {
    const cache = await renderEditScreen();
    jest.mocked(updatePet).mockResolvedValue(renamedRocket);
    serveFromApi([renamedRocket, luna]);

    await act(() => cache.result.current.update.mutateAsync({ petId: rocket.id, values }));

    expect(cache.cachedPet(rocket.id)).toEqual(renamedRocket);
    expect(cache.myPets()).toEqual([renamedRocket, luna]);
  });

  it('still refreshes the pets when the save fails, in case it committed before the response was lost', async () => {
    const cache = await renderEditScreen();
    const lostResponse = new Error('response lost');
    jest.mocked(updatePet).mockRejectedValue(lostResponse);
    serveFromApi([renamedRocket, luna]);

    await act(async () => {
      await expect(cache.result.current.update.mutateAsync({ petId: rocket.id, values })).rejects.toBe(lostResponse);
    });

    expect(cache.cachedPet(rocket.id)).toEqual(renamedRocket);
    expect(cache.myPets()).toEqual([renamedRocket, luna]);
  });

  it('keeps the pets as they were when a failed save did not commit', async () => {
    const cache = await renderEditScreen();
    jest.mocked(updatePet).mockRejectedValue(new Error('network down'));

    await act(async () => {
      await expect(cache.result.current.update.mutateAsync({ petId: rocket.id, values })).rejects.toThrow('network down');
    });

    expect(listMyPets).toHaveBeenCalledTimes(1);
    expect(cache.cachedPet(rocket.id)).toEqual(rocket);
    expect(cache.myPets()).toEqual([rocket, luna]);
  });

  it('marks both booking lists out of date, since they show the pet\'s name', async () => {
    const cache = await renderEditScreen();
    jest.mocked(updatePet).mockResolvedValue(renamedRocket);

    await act(() => cache.result.current.update.mutateAsync({ petId: rocket.id, values }));

    expect(cache.isOutOfDate(OUTGOING_BOOKINGS)).toBe(true);
    expect(cache.isOutOfDate(INCOMING_BOOKINGS)).toBe(true);
  });
});

describe('deleting a pet and the cache', () => {
  async function renderMyPetsScreen() {
    const cache = await renderAfterVisitingEveryScreen();
    const { result } = renderHook(() => ({ pets: useMyPets(), remove: useDeletePet() }), { wrapper: cache.wrapper });
    return { ...cache, result };
  }

  it('drops the pet from the open My Pets list before the delete finishes', async () => {
    const cache = await renderMyPetsScreen();
    jest.mocked(deletePet).mockResolvedValue(undefined);
    serveFromApi([luna]);

    await act(() => cache.result.current.remove.mutateAsync(rocket.id));

    expect(cache.myPets()).toEqual([luna]);
  });

  it('forgets the deleted pet\'s edit screen for every account, so reopening it cannot show the old details', async () => {
    const cache = await renderMyPetsScreen();
    // Someone else signed in earlier in this tab and opened the same URL.
    cache.queryClient.setQueryData(petKeys.detail(rocket.id, 'earlier-user'), null);
    jest.mocked(deletePet).mockResolvedValue(undefined);
    serveFromApi([luna]);

    await act(() => cache.result.current.remove.mutateAsync(rocket.id));

    expect(cache.queryClient.getQueryState(petKeys.detail(rocket.id, OWNER_ID))).toBeUndefined();
    expect(cache.queryClient.getQueryState(petKeys.detail(rocket.id, 'earlier-user'))).toBeUndefined();
    expect(cache.cachedPet(luna.id)).toEqual(luna);
  });

  it('keeps the pet on My Pets and its edit screen when bookings block the delete', async () => {
    const cache = await renderMyPetsScreen();
    jest.mocked(deletePet).mockRejectedValue(new PetHasBookingsError());

    await act(async () => {
      await expect(cache.result.current.remove.mutateAsync(rocket.id)).rejects.toBeInstanceOf(PetHasBookingsError);
    });

    // The list is still refetched, since deletePet may have changed the pet before failing.
    expect(listMyPets).toHaveBeenCalledTimes(1);
    expect(cache.myPets()).toEqual([rocket, luna]);
    expect(cache.cachedPet(rocket.id)).toEqual(rocket);
  });

  it('leaves the booking lists alone, since a pet with bookings cannot be deleted', async () => {
    const cache = await renderMyPetsScreen();
    jest.mocked(deletePet).mockResolvedValue(undefined);
    serveFromApi([luna]);

    await act(() => cache.result.current.remove.mutateAsync(rocket.id));

    expect(cache.isOutOfDate(OUTGOING_BOOKINGS)).toBe(false);
    expect(cache.isOutOfDate(INCOMING_BOOKINGS)).toBe(false);
  });
});
