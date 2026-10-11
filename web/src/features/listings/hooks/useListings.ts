import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { deleteListing, getListing, listMyListings, listPublishedListings, setListingPublicationStatus } from '../lib/listingApi';
import type { Listing, ListingPublicationMode } from '../lib/listingApi';

export const listingKeys = {
  all: ['listings'] as const,
  published: () => [...listingKeys.all, 'published'] as const,
  allMine: () => [...listingKeys.all, 'mine'] as const,
  mine: (ownerId: string) => [...listingKeys.allMine(), ownerId] as const,
  allDetails: (listingId: string) => [...listingKeys.all, 'detail', listingId] as const,
  detail: (listingId: string, viewerId: string) => (
    [...listingKeys.allDetails(listingId), viewerId] as const
  ),
};

// A listing that has just been hidden must leave search and the detail cache straight away:
// the refetch that follows runs in the background, and until it lands the cached copy would
// still offer the hidden listing to anyone browsing in this tab.
function hideListingFromCaches(
  queryClient: QueryClient,
  listingId: string,
  updateOwnerCopy: (listings: Listing[]) => Listing[],
) {
  queryClient.setQueryData<Listing[]>(
    listingKeys.published(),
    (listings) => listings?.filter((listing) => listing.id !== listingId),
  );
  queryClient.setQueriesData<Listing[]>(
    { queryKey: listingKeys.allMine() },
    (listings) => (listings ? updateOwnerCopy(listings) : listings),
  );
  queryClient.removeQueries({ queryKey: listingKeys.allDetails(listingId) });
}

export function usePublishedListings() {
  return useQuery({
    queryKey: listingKeys.published(),
    queryFn: listPublishedListings,
  });
}

export function useMyListings() {
  const { user, isLoading } = useAuth();
  const ownerId = user?.id;

  return useQuery({
    queryKey: listingKeys.mine(ownerId ?? 'anonymous'),
    queryFn: listMyListings,
    enabled: !isLoading && Boolean(ownerId),
  });
}

export function useListing(listingId: string) {
  const { user, isLoading } = useAuth();

  return useQuery({
    queryKey: listingKeys.detail(listingId, user?.id ?? 'public'),
    queryFn: () => getListing(listingId),
    enabled: !isLoading && Boolean(listingId),
  });
}

/** Toggles a listing between draft and published: unpublishing hides it from search and,
 * via RLS, from every non-owner's detail view, which is what stops new booking requests. */
export function useSetListingPublicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: ListingPublicationMode }) => (
      setListingPublicationStatus(listingId, status)
    ),
    onSuccess: (savedListing, { listingId, status }) => {
      // My listings shows the saved row at once either way, so its status badge agrees with
      // the confirmation message instead of lagging until the refetch lands.
      const showSavedCopy = (listings: Listing[]) => listings.map(
        (listing) => (listing.id === listingId ? savedListing : listing),
      );
      if (status === 'draft') {
        hideListingFromCaches(queryClient, listingId, showSavedCopy);
      } else {
        queryClient.setQueriesData<Listing[]>(
          { queryKey: listingKeys.allMine() },
          (listings) => (listings ? showSavedCopy(listings) : listings),
        );
      }
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) => deleteListing(listingId),
    onSuccess: (_, listingId) => {
      hideListingFromCaches(queryClient, listingId, (listings) => listings.filter(
        (listing) => listing.id !== listingId,
      ));
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}
