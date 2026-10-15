import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import {
  createPet,
  deletePet,
  getPet,
  listMyPets,
  updatePet,
  type CreatePetValues,
  type UpdatePetValues,
} from '../lib/petApi';

export const petKeys = {
  all: ['pets'] as const,
  mine: (ownerId: string) => [...petKeys.all, 'mine', ownerId] as const,
  detail: (petId: string, ownerId: string) => [...petKeys.all, 'detail', petId, ownerId] as const,
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

/** Loads one of the signed-in user's pets, or null when it does not exist or is not theirs. */
export function usePet(petId: string) {
  const { user, isLoading } = useAuth();
  const ownerId = user?.id;

  return useQuery({
    queryKey: petKeys.detail(petId, ownerId ?? 'anonymous'),
    queryFn: async () => {
      const pet = await getPet(petId);
      // RLS also lets listing owners read pets booked at their listings, so a pet
      // the user can see is not necessarily one they may edit.
      return pet && pet.owner_id === ownerId ? pet : null;
    },
    enabled: !isLoading && Boolean(ownerId) && Boolean(petId),
  });
}

export function useCreatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreatePetValues) => createPet(values),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: petKeys.all });
    },
  });
}

export function useUpdatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ petId, values }: { petId: string; values: UpdatePetValues }) => (
      updatePet(petId, values)
    ),
    // A save whose response is lost may still have committed, so refresh after failures too.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: petKeys.all });
      // Bookings show the pet's name, so they must not keep the old details.
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (petId: string) => deletePet(petId),
    // deletePet removes the photo before the row, so a failed delete can still change the pet.
    // Bookings are not refreshed: deletePet refuses to delete a pet that has bookings.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: petKeys.all });
    },
  });
}
