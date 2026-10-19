import { getSupabaseClient } from '@/shared/lib/supabase';
import type { PetSpecies } from '@/shared/lib/petSpecies';
import type { Database } from '@/shared/types/database.types';
import { PetHasBookingsError } from './petErrors';
import { validatePetPhoto } from './petPhoto';

export { PET_PHOTO_MAX_BYTES, PET_PHOTO_MIME_TYPES, validatePetPhoto } from './petPhoto';

export type Pet = Database['public']['Tables']['pets']['Row'];

export const PET_PHOTO_BUCKET = 'pet-photos';
export const PET_PHOTO_SIGNED_URL_TTL_SECONDS = 3_600;

export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export interface CreatePetValues {
  name: string;
  species: PetSpecies;
  breed: string;
  ageYear: number | null;
  description: string;
  photo?: File | null;
}

/**
 * Leaving out both photo fields keeps the current photo. Removal needs its own flag so that a
 * form sending `photo: null` for "nothing chosen" cannot delete the photo by accident.
 */
export interface UpdatePetValues extends Omit<CreatePetValues, 'photo'> {
  /** A new photo that replaces the current one. */
  photo?: File;
  /** Removes the current photo. Ignored when a new photo is given. */
  removePhoto?: boolean;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPetRowAttributes(values: Omit<CreatePetValues, 'photo'>) {
  return {
    name: values.name.trim(),
    species: values.species,
    breed: blankToNull(values.breed),
    age_year: values.ageYear,
    description: blankToNull(values.description),
  };
}

/** Generates a storage path satisfying the pet-photos bucket RLS contract (<pet_id>/<uuid>.<ext>). */
export function petPhotoStoragePath(petId: string, file: Pick<File, 'type' | 'name'>): string {
  const extension = MIME_TO_EXTENSION[file.type]
    ?? (file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '');
  return `${petId}/${crypto.randomUUID()}${extension}`;
}

/**
 * Retrieves a single pet by id. Returns null if not found, deleted, or not visible under RLS.
 *
 * Note: RLS allows listing owners to read pets booked at their listings, so this
 * function may return a pet owned by another user. Callers that require ownership
 * (such as pet edit screens) must verify `pet.owner_id` against the current user.
 */
export async function getPet(petId: string): Promise<Pet | null> {
  const { data, error } = await getSupabaseClient()
    .from('pets')
    .select('*')
    .eq('id', petId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/** RLS also lets listing owners read pets booked at their listings, so "my pets"
 * must filter by owner explicitly rather than rely on RLS alone. The caller passes
 * the owner id it uses in the query key, so the cache entry and the filter always
 * name the same user. Deleted pets stay readable for booking history, so they are
 * filtered out here too. */
export async function listMyPets(ownerId: string): Promise<Pet[]> {
  const { data, error } = await getSupabaseClient()
    .from('pets')
    .select('*')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

type SupabaseClient = ReturnType<typeof getSupabaseClient>;
type PetUpdate = Database['public']['Tables']['pets']['Update'];

function petUpdateNotFoundMessage(petId: string): string {
  return `Pet with id ${petId} not found or you do not have permission to update it.`;
}

async function savePetRow(supabase: SupabaseClient, petId: string, ownerId: string, row: PetUpdate): Promise<Pet> {
  const { data: updatedPet, error: updateError } = await supabase
    .from('pets')
    .update(row)
    .eq('id', petId)
    .eq('owner_id', ownerId)
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updatedPet) {
    throw new Error(petUpdateNotFoundMessage(petId));
  }

  return updatedPet;
}

/** Removes one photo file. Returns why it failed, or null on success, so callers decide whether a failure matters. */
async function removePetPhotoFile(supabase: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(PET_PHOTO_BUCKET).remove([path]);
    if (error) return error.message;
    return isStoragePathRemoved(data, path) ? null : 'storage object not found or permission denied';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** False only when the row is known not to point at the path; an unreadable row counts as true so the file is kept. */
async function petMayPointAtPhoto(
  supabase: SupabaseClient,
  petId: string,
  ownerId: string,
  path: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('photo_url')
      .eq('id', petId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) return true;
    return data?.photo_url === path;
  } catch {
    return true;
  }
}

/**
 * Updates an existing pet. Scoped to the authenticated owner; never updates or sends owner_id.
 *
 * A new photo is uploaded before the row points at it, and the old file is removed only after
 * the row is saved, so a failed save never leaves the pet without a working photo.
 */
export async function updatePet(petId: string, values: UpdatePetValues): Promise<Pet> {
  if (values.photo) {
    const photoError = validatePetPhoto(values.photo);
    if (photoError) {
      throw new Error(photoError);
    }
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) {
    throw new Error('You must be signed in to update a pet.');
  }

  const ownerId = userData.user.id;

  if (!values.photo && !values.removePhoto) {
    return savePetRow(supabase, petId, ownerId, toPetRowAttributes(values));
  }

  const { data: currentPet, error: fetchError } = await supabase
    .from('pets')
    .select('photo_url')
    .eq('id', petId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!currentPet) {
    throw new Error(petUpdateNotFoundMessage(petId));
  }

  let newPhotoPath: string | null = null;

  if (values.photo) {
    newPhotoPath = petPhotoStoragePath(petId, values.photo);
    const { error: uploadError } = await supabase.storage
      .from(PET_PHOTO_BUCKET)
      .upload(newPhotoPath, values.photo, {
        contentType: values.photo.type || undefined,
        upsert: false,
      });

    if (uploadError) throw uploadError;
  }

  let updatedPet: Pet;

  try {
    updatedPet = await savePetRow(supabase, petId, ownerId, {
      ...toPetRowAttributes(values),
      photo_url: newPhotoPath,
    });
  } catch (error) {
    // A save can commit even though its response is lost, so only remove the new upload
    // once the row is known not to point at it.
    const cleanupError = newPhotoPath && !(await petMayPointAtPhoto(supabase, petId, ownerId, newPhotoPath))
      ? await removePetPhotoFile(supabase, newPhotoPath)
      : null;

    if (cleanupError) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${originalMessage} (rollback incomplete: photo cleanup failed: ${cleanupError})`, { cause: error });
    }

    throw error;
  }

  // The pet is already saved, so failing to remove the old file only leaves an unused file
  // in the private bucket; it must not turn a successful save into an error.
  if (currentPet.photo_url && currentPet.photo_url !== newPhotoPath) {
    await removePetPhotoFile(supabase, currentPet.photo_url);
  }

  return updatedPet;
}

function isStoragePathRemoved(
  data: Array<{ name: string }> | null | undefined,
  path: string,
): boolean {
  if (!data || data.length === 0) return false;
  const fileName = path.includes('/') ? path.split('/').pop() : path;
  return data.some((item) => item.name === path || item.name === fileName);
}

// The messages delete_pet_with_active_booking_check raises (20261019000000_soft_delete_pets.sql).
const PET_HAS_ACTIVE_BOOKINGS_MESSAGE = 'Pet has active bookings and cannot be deleted.';
const PET_ALREADY_DELETED_MESSAGE = 'Pet is already deleted.';

/**
 * Deletes the current user's pet. The RPC refuses a pet with a pending or confirmed booking;
 * otherwise it soft-deletes the pet, so past bookings keep it, and returns the old photo path.
 *
 * The photo file is removed afterwards, while the soft-deleted row still proves ownership to the
 * storage policy. The pet is already deleted by then, so a failed removal only leaves an unused
 * file in the private bucket; it must not turn a successful delete into an error.
 */
export async function deletePet(petId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: oldPhotoPath, error } = await supabase.rpc('delete_pet_with_active_booking_check', {
    target_pet_id: petId,
  });

  if (error) {
    if (error.code === 'P0001' && error.message === PET_HAS_ACTIVE_BOOKINGS_MESSAGE) {
      throw new PetHasBookingsError();
    }
    // Another tab, or a retry after a lost response, already deleted it: the user's intent holds.
    if (error.code === 'P0001' && error.message === PET_ALREADY_DELETED_MESSAGE) {
      return;
    }
    throw error;
  }

  if (oldPhotoPath) {
    await removePetPhotoFile(supabase, oldPhotoPath);
  }
}

/** Obtains a signed URL for a private pet photo. */
export async function getPetPhotoSignedUrl(
  storagePath: string,
  expiresInSeconds: number = PET_PHOTO_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(PET_PHOTO_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error(`Could not create signed URL for ${storagePath}`);
  }

  return data.signedUrl;
}

export async function createPet(values: CreatePetValues): Promise<Pet> {
  if (values.photo) {
    const photoError = validatePetPhoto(values.photo);
    if (photoError) {
      throw new Error(photoError);
    }
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in to add a pet.');

  const { data: pet, error: insertError } = await supabase
    .from('pets')
    .insert({
      owner_id: userData.user.id,
      ...toPetRowAttributes(values),
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  if (!values.photo) {
    return pet;
  }

  let photoUploaded = false;
  let storagePath: string | null = null;

  try {
    storagePath = petPhotoStoragePath(pet.id, values.photo);
    const { error: uploadError } = await supabase.storage
      .from(PET_PHOTO_BUCKET)
      .upload(storagePath, values.photo, {
        contentType: values.photo.type || undefined,
        upsert: false,
      });

    if (uploadError) throw uploadError;
    photoUploaded = true;

    const { data: updatedPet, error: updateError } = await supabase
      .from('pets')
      .update({ photo_url: storagePath })
      .eq('id', pet.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return updatedPet;
  } catch (error) {
    const cleanupErrors: string[] = [];
    let photoCleanupFailed = false;

    // Remove storage object first while pet row still exists in database
    // (RLS on storage.objects checks that the current user owns the pet)
    if (photoUploaded && storagePath) {
      try {
        const { data: removeData, error: removeError } = await supabase.storage
          .from(PET_PHOTO_BUCKET)
          .remove([storagePath]);

        if (removeError) throw removeError;

        if (!isStoragePathRemoved(removeData, storagePath)) {
          throw new Error('storage object not found or permission denied');
        }
      } catch (storageCleanupError) {
        photoCleanupFailed = true;
        cleanupErrors.push(
          `photo cleanup failed: ${storageCleanupError instanceof Error ? storageCleanupError.message : String(storageCleanupError)}`,
        );
      }
    }

    // Only attempt to delete the pet row if photo cleanup was not needed (no photo was uploaded)
    // or if photo cleanup succeeded. If photo cleanup failed, we MUST keep the pet row so that
    // the owner still has permission to access/delete the photo later; deleting the pet row first
    // would permanently orphan the storage object under RLS.
    if (!photoCleanupFailed) {
      try {
        const { data: deletedRows, error: deletePetError } = await supabase
          .from('pets')
          .delete()
          .eq('id', pet.id)
          .select('id');

        if (deletePetError) throw deletePetError;

        if (!deletedRows || deletedRows.length === 0) {
          throw new Error(`Could not delete pet ${pet.id}: permission denied or pet not found.`);
        }
      } catch (petCleanupError) {
        cleanupErrors.push(
          `pet cleanup failed: ${petCleanupError instanceof Error ? petCleanupError.message : String(petCleanupError)}`,
        );
      }
    }

    if (cleanupErrors.length > 0) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${originalMessage} (rollback incomplete: ${cleanupErrors.join(', ')})`, { cause: error });
    }

    throw error;
  }
}
