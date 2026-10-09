import { getSupabaseClient } from '@/shared/lib/supabase';
import type { PetSpecies } from '@/shared/lib/petSpecies';
import type { Database } from '@/shared/types/database.types';

export type Pet = Database['public']['Tables']['pets']['Row'];

export const PET_PHOTO_BUCKET = 'pet-photos';
export const PET_PHOTO_SIGNED_URL_TTL_SECONDS = 3_600;

export interface CreatePetValues {
  name: string;
  species: PetSpecies;
  breed: string;
  ageYear: number | null;
  description: string;
  photo?: File | null;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Generates a storage path satisfying the pet-photos bucket RLS contract (<pet_id>/<filename>). */
export function petPhotoStoragePath(petId: string, file: File): string {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
  return `${petId}/${crypto.randomUUID()}${extension.toLowerCase()}`;
}

/** RLS also lets listing owners read pets booked at their listings, so "my pets"
 * must filter by owner explicitly rather than rely on RLS alone. The caller passes
 * the owner id it uses in the query key, so the cache entry and the filter always
 * name the same user. */
export async function listMyPets(ownerId: string): Promise<Pet[]> {
  const { data, error } = await getSupabaseClient()
    .from('pets')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/** Removes a pet from public.pets by id. */
export async function deletePet(petId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('pets')
    .delete()
    .eq('id', petId);

  if (error) {
    throw error;
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
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in to add a pet.');

  const { data: pet, error: insertError } = await supabase
    .from('pets')
    .insert({
      owner_id: userData.user.id,
      name: values.name.trim(),
      species: values.species,
      breed: blankToNull(values.breed),
      age_year: values.ageYear,
      description: blankToNull(values.description),
      photo_url: null,
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

    // Remove storage object first while pet row still exists in database
    // (RLS on storage.objects checks that the current user owns the pet)
    if (photoUploaded && storagePath) {
      try {
        const { error: removeError } = await supabase.storage
          .from(PET_PHOTO_BUCKET)
          .remove([storagePath]);
        if (removeError) throw removeError;
      } catch (storageCleanupError) {
        cleanupErrors.push(
          `photo cleanup failed: ${storageCleanupError instanceof Error ? storageCleanupError.message : String(storageCleanupError)}`,
        );
      }
    }

    try {
      const { error: deletePetError } = await supabase
        .from('pets')
        .delete()
        .eq('id', pet.id);
      if (deletePetError) throw deletePetError;
    } catch (petCleanupError) {
      cleanupErrors.push(
        `pet cleanup failed: ${petCleanupError instanceof Error ? petCleanupError.message : String(petCleanupError)}`,
      );
    }

    if (cleanupErrors.length > 0) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${originalMessage} (rollback incomplete: ${cleanupErrors.join(', ')})`);
    }

    throw error;
  }
}
