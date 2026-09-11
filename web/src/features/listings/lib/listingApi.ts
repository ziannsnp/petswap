import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';
import { serializeFacilities } from './listingOptions';
import type { PetSpecies } from './listingOptions';

export interface CreateListingValues {
  title: string;
  location: string;
  description: string;
  capacity: number;
  acceptedPetTypes: PetSpecies[];
  facilities: string[];
  photos: File[];
}

export type Listing = Database['public']['Tables']['listings']['Row'] & {
  listing_images: Database['public']['Tables']['listing_images']['Row'][];
  cover_photo_url: string | null;
};

function photoStoragePath(listingId: string, file: File): string {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
  return `${listingId}/${crypto.randomUUID()}${extension.toLowerCase()}`;
}

async function removeUploadedPhotos(storagePaths: string[]) {
  if (storagePaths.length === 0) return;

  const { error } = await getSupabaseClient().storage.from('listing-photos').remove(storagePaths);
  if (error) throw error;
}

export async function createListing(values: CreateListingValues): Promise<Listing> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in to create a listing.');

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      owner_id: userData.user.id,
      title: values.title.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
      capacity: values.capacity,
      accepted_pet_types: values.acceptedPetTypes,
      facilities: serializeFacilities(values.facilities),
      status: 'draft',
      published_at: null,
    })
    .select()
    .single();

  if (listingError) throw listingError;

  const storagePaths: string[] = [];
  try {
    const imageRows: Database['public']['Tables']['listing_images']['Insert'][] = [];

    for (const [sortOrder, photo] of values.photos.entries()) {
      const storagePath = photoStoragePath(listing.id, photo);
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(storagePath, photo, { contentType: photo.type, upsert: false });

      if (uploadError) throw uploadError;
      storagePaths.push(storagePath);
      imageRows.push({
        listing_id: listing.id,
        storage_path: storagePath,
        alt_text: null,
        sort_order: sortOrder,
      });
    }

    let insertedImages: Database['public']['Tables']['listing_images']['Row'][] = [];
    if (imageRows.length > 0) {
      const { data: imageData, error: imagesError } = await supabase
        .from('listing_images')
        .insert(imageRows)
        .select();
      if (imagesError) throw imagesError;
      insertedImages = imageData;
    }

    return addCoverPhotoUrl({ ...listing, listing_images: insertedImages });
  } catch (error) {
    const cleanupErrors: string[] = [];
    try {
      await removeUploadedPhotos(storagePaths);
    } catch (cleanupError) {
      cleanupErrors.push(`photo cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }

    try {
      const { error: listingCleanupError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id);
      if (listingCleanupError) throw listingCleanupError;
    } catch (listingCleanupError) {
      cleanupErrors.push(`listing cleanup failed: ${listingCleanupError instanceof Error ? listingCleanupError.message : String(listingCleanupError)}`);
    }

    if (cleanupErrors.length > 0) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Listing creation failed: ${originalMessage}; ${cleanupErrors.join('; ')}`);
    }
    throw error;
  }
}

function addCoverPhotoUrl(
  listing: Database['public']['Tables']['listings']['Row'] & {
    listing_images: Database['public']['Tables']['listing_images']['Row'][];
  },
): Listing {
  const listingImages = [...listing.listing_images].sort((left, right) => left.sort_order - right.sort_order);
  const coverImage = listingImages[0];
  const coverPhotoUrl = coverImage
    ? getSupabaseClient().storage.from('listing-photos').getPublicUrl(coverImage.storage_path).data.publicUrl
    : null;

  return { ...listing, listing_images: listingImages, cover_photo_url: coverPhotoUrl };
}

export async function listPublishedListings(): Promise<Listing[]> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select('*, listing_images(*)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addCoverPhotoUrl);
}

export async function getListing(listingId: string): Promise<Listing> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select('*, listing_images(*)')
    .eq('id', listingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Listing not found.');

  return addCoverPhotoUrl({ ...data, listing_images: data.listing_images ?? [] });
}

export async function listMyListings(): Promise<Listing[]> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(addCoverPhotoUrl);
}
