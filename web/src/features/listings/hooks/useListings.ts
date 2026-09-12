import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getListing, listMyListings, listPublishedListings } from '../lib/listingApi';

export const listingKeys = {
  all: ['listings'] as const,
  published: () => [...listingKeys.all, 'published'] as const,
  mine: (ownerId: string) => [...listingKeys.all, 'mine', ownerId] as const,
  detail: (listingId: string, viewerId: string) => (
    [...listingKeys.all, 'detail', listingId, viewerId] as const
  ),
};

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
