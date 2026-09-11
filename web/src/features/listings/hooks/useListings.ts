import { useQuery } from '@tanstack/react-query';
import { getListing, listMyListings, listPublishedListings } from '../lib/listingApi';

export const listingKeys = {
  all: ['listings'] as const,
  published: () => [...listingKeys.all, 'published'] as const,
  mine: () => [...listingKeys.all, 'mine'] as const,
};

export function usePublishedListings() {
  return useQuery({
    queryKey: listingKeys.published(),
    queryFn: listPublishedListings,
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: listingKeys.mine(),
    queryFn: listMyListings,
  });
}

export function useListing(listingId: string) {
  return useQuery({
    queryKey: ['listings', 'detail', listingId],
    queryFn: () => getListing(listingId),
  });
}
