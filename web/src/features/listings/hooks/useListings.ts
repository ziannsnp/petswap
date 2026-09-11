import { useQuery } from '@tanstack/react-query';
import { getListing, listMyListings, listPublishedListings } from '../lib/listingApi';

export function usePublishedListings() {
  return useQuery({
    queryKey: ['listings', 'published'],
    queryFn: listPublishedListings,
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: ['listings', 'mine'],
    queryFn: listMyListings,
  });
}

export function useListing(listingId: string) {
  return useQuery({
    queryKey: ['listings', 'detail', listingId],
    queryFn: () => getListing(listingId),
  });
}
