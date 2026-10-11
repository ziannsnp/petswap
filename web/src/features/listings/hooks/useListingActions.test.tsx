/** @jest-environment jsdom */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deleteListing, setListingPublicationStatus } from '../lib/listingApi';
import type { Listing } from '../lib/listingApi';
import { deleteListingRpcErrors, LISTING_OWNER_ID, ownerActionListings } from '../testing/listingFixtures';
import { listingKeys, useDeleteListing, useSetListingPublicationStatus } from './useListings';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/listingApi', () => ({
  deleteListing: jest.fn(),
  getListing: jest.fn(),
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
  setListingPublicationStatus: jest.fn(),
}));

const { owned, ownedByOtherUser, alreadyDeleted } = ownerActionListings;

// Search holds the owner's listing next to someone else's, My listings holds it next to an
// earlier deleted one, and two viewers have its detail page cached.
function renderWithCachedListings<Result>(useHook: () => Result) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(listingKeys.published(), [owned, ownedByOtherUser]);
  queryClient.setQueryData(listingKeys.mine(LISTING_OWNER_ID), [owned, alreadyDeleted]);
  queryClient.setQueryData(listingKeys.detail(owned.id, 'public'), owned);
  queryClient.setQueryData(listingKeys.detail(owned.id, LISTING_OWNER_ID), owned);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });

  return {
    result,
    searchIds: () => queryClient.getQueryData<Listing[]>(listingKeys.published())?.map(({ id }) => id),
    myListings: () => queryClient.getQueryData<Listing[]>(listingKeys.mine(LISTING_OWNER_ID)),
    cachedDetail: (viewerId: string) => queryClient.getQueryData(listingKeys.detail(owned.id, viewerId)),
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('listing owner actions and the cache', () => {
  it('drops a deleted listing from search, My listings, and its detail pages straight away', async () => {
    jest.mocked(deleteListing).mockResolvedValue(undefined);
    const cache = renderWithCachedListings(() => useDeleteListing());

    await act(() => cache.result.current.mutateAsync(owned.id));

    expect(cache.searchIds()).toEqual([ownedByOtherUser.id]);
    expect(cache.myListings()?.map(({ id }) => id)).toEqual([alreadyDeleted.id]);
    expect(cache.cachedDetail('public')).toBeUndefined();
    expect(cache.cachedDetail(LISTING_OWNER_ID)).toBeUndefined();
  });

  it('takes an unpublished listing out of search and shows it as a draft in My listings', async () => {
    const draft: Listing = { ...owned, status: 'draft', published_at: null };
    jest.mocked(setListingPublicationStatus).mockResolvedValue(draft);
    const cache = renderWithCachedListings(() => useSetListingPublicationStatus());

    await act(() => cache.result.current.mutateAsync({ listingId: owned.id, status: 'draft' }));

    expect(cache.searchIds()).toEqual([ownedByOtherUser.id]);
    expect(cache.myListings()).toEqual([draft, alreadyDeleted]);
    expect(cache.cachedDetail('public')).toBeUndefined();
  });

  it('does not remove anything when a draft is published', async () => {
    jest.mocked(setListingPublicationStatus).mockResolvedValue(owned);
    const cache = renderWithCachedListings(() => useSetListingPublicationStatus());

    await act(() => cache.result.current.mutateAsync({ listingId: owned.id, status: 'published' }));

    expect(cache.searchIds()).toEqual([owned.id, ownedByOtherUser.id]);
    expect(cache.cachedDetail('public')).toBe(owned);
  });

  it.each(Object.entries(deleteListingRpcErrors))(
    'keeps every cache as it was when the delete is refused (%s)',
    async (_, rpcError) => {
      jest.mocked(deleteListing).mockRejectedValue(rpcError);
      const cache = renderWithCachedListings(() => useDeleteListing());

      await act(async () => {
        await expect(cache.result.current.mutateAsync(owned.id)).rejects.toBe(rpcError);
      });

      expect(cache.searchIds()).toEqual([owned.id, ownedByOtherUser.id]);
      expect(cache.myListings()).toEqual([owned, alreadyDeleted]);
      expect(cache.cachedDetail('public')).toBe(owned);
    },
  );
});
