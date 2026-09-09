import { useQuery } from '@tanstack/react-query';
import { listMyListings, listPublishedListings } from '../lib/listingApi';

export const listingKeys = {
  all: ['listings'] as const,
  published: () => [...listingKeys.all, 'published'] as const,
  mine: (ownerId: string | undefined) => [...listingKeys.all, 'mine', ownerId ?? 'anonymous'] as const,
};

export function usePublishedListings() {
  return useQuery({
    queryKey: listingKeys.published(),
    queryFn: listPublishedListings,
  });
}

export function useMyListings(ownerId: string | undefined) {
  return useQuery({
    queryKey: listingKeys.mine(ownerId),
    queryFn: () => ownerId ? listMyListings(ownerId) : Promise.resolve([]),
    enabled: Boolean(ownerId),
  });
}
