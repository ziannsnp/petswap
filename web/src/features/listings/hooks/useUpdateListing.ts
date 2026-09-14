import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateListing, type UpdateListingValues } from '../lib/listingApi';
import { listingKeys } from './useListings';

export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, values }: { listingId: string; values: UpdateListingValues }) => (
      updateListing(listingId, values)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}