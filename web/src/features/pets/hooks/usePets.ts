import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { createPet, listMyPets, type CreatePetValues } from '../lib/petApi';

export const petKeys = {
  all: ['pets'] as const,
  mine: (ownerId: string) => [...petKeys.all, 'mine', ownerId] as const,
};

export function useMyPets() {
  const { user, isLoading } = useAuth();
  const ownerId = user?.id;

  return useQuery({
    queryKey: petKeys.mine(ownerId ?? 'anonymous'),
    // enabled guarantees ownerId is set whenever the query runs.
    queryFn: () => listMyPets(ownerId as string),
    enabled: !isLoading && Boolean(ownerId),
  });
}

export function useCreatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreatePetValues) => createPet(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: petKeys.all });
    },
  });
}
