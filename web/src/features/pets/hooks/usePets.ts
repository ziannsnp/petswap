import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import {
  createPet,
  deletePet,
  getPet,
  getPetPhotoSignedUrl,
  listMyPets,
  PET_PHOTO_SIGNED_URL_TTL_SECONDS,
  updatePet,
  type CreatePetValues,
  type UpdatePetValues,
} from '../lib/petApi';

export const petKeys = {
  all: ['pets'] as const,
  mine: (ownerId: string) => [...petKeys.all, 'mine', ownerId] as const,
  allDetails: (petId: string) => [...petKeys.all, 'detail', petId] as const,
  detail: (petId: string, ownerId: string) => [...petKeys.allDetails(petId), ownerId] as const,
  photo: (photoPath: string) => [...petKeys.all, 'photo', photoPath] as const,
};

/** Pet photos sit in a private bucket, so they are shown through short-lived signed URLs. */
export function usePetPhotoUrl(photoPath: string | null) {
  return useQuery({
    queryKey: petKeys.photo(photoPath ?? ''),
    // enabled guarantees photoPath is set whenever the query runs.
    queryFn: () => getPetPhotoSignedUrl(photoPath as string),
    enabled: Boolean(photoPath),
    // Sign a fresh URL five minutes before the cached one expires.
    staleTime: (PET_PHOTO_SIGNED_URL_TTL_SECONDS - 300) * 1000,
  });
}

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loads one of the signed-in user's pets, or null when it does not exist or is not theirs. */
export function usePet(petId: string) {
  const { user, isLoading } = useAuth();
  const ownerId = user?.id;

  return useQuery({
    queryKey: petKeys.detail(petId, ownerId ?? 'anonymous'),
    queryFn: async () => {
      // pets.id is a uuid, so a malformed URL id cannot be a pet; Postgres would reject it
      // with an error instead of returning no row.
      if (!UUID_PATTERN.test(petId)) return null;

      const pet = await getPet(petId);
      // RLS also lets listing owners read pets booked at their listings, so a pet
      // the user can see is not necessarily one they may edit.
      return pet && pet.owner_id === ownerId ? pet : null;
    },
    enabled: !isLoading && Boolean(ownerId) && Boolean(petId),
  });
}

/**
 * Returning the refetch from onSettled makes mutateAsync wait for it, so the next screen
 * already shows the change. A failure still starts the refetch but does not wait for it:
 * against an unreachable server its retries would hold the error back for about 15 seconds.
 */
function waitOnlyAfterSuccess(error: Error | null, refetch: Promise<unknown>) {
  return error ? undefined : refetch;
}

export function useCreatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreatePetValues) => createPet(values),
    // 'all' includes the My Pets list, which is not mounted on this screen, so waiting for it
    // means the list shows the new pet on arrival.
    onSettled: (_data, error) => waitOnlyAfterSuccess(
      error,
      queryClient.invalidateQueries({ queryKey: petKeys.all, refetchType: 'all' }),
    ),
  });
}

export function useUpdatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ petId, values }: { petId: string; values: UpdatePetValues }) => (
      updatePet(petId, values)
    ),
    // A save whose response is lost may still have committed, so refresh after failures too.
    // 'all' includes the unmounted My Pets list, which the screen navigates to next.
    onSettled: (_data, error) => waitOnlyAfterSuccess(error, Promise.all([
      queryClient.invalidateQueries({ queryKey: petKeys.all, refetchType: 'all' }),
      // Bookings show the pet's name, so they must not keep the old details.
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    ])),
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (petId: string) => deletePet(petId),
    // Invalidating only refetches mounted queries, so the edit screen's cached copy would
    // otherwise flash the deleted pet before 'Pet not found'. A blocked delete keeps the pet,
    // so only a successful one drops it.
    onSuccess: (_data, petId) => {
      queryClient.removeQueries({ queryKey: petKeys.allDetails(petId) });
    },
    // deletePet removes the photo before the row, so a failed delete can still change the pet.
    // Bookings are not refreshed: deletePet refuses to delete a pet that has bookings.
    // After a success, waiting keeps the dialog open until My Pets has dropped the card.
    onSettled: (_data, error) => waitOnlyAfterSuccess(
      error,
      queryClient.invalidateQueries({ queryKey: petKeys.all }),
    ),
  });
}
