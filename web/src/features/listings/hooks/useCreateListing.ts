import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createListing, type CreateListingValues } from '../lib/listingApi';

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateListingValues) => createListing(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}